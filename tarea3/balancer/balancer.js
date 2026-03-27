import { get } from "http";
import { readFileSync } from "fs";
import express from "express";
import os from "os";
import { ExecuteRest, HttpPostJson } from "./methods/Rest.js";
import { ExecuteRefugio, GetRefugioMetrics } from "./methods/gRCP.js";
import { ExecuteRsi, getMetricas } from "./methods/Rsi.js";
import { ExecuteMqtt, GetMqttMetrics } from "./methods/mqtt.js";

let lista_pcs = [];
const serviceStart = Date.now();

class Balanceador {
  constructor() {
    this.services = [];
    this.lastExecution = null;
    this.leerPCs();
    this.clienteProto = new Map();
    this.getBalancerMetrics = this.getBalancerMetrics.bind(this);
    this.executeRest = ExecuteRest.bind(this);
    this.httpPostJson = HttpPostJson.bind(this);

    this.executeRefugio = ExecuteRefugio.bind(this);
    this.getRefugioMetrics = GetRefugioMetrics.bind(this);

    this.getAhorcadoMetrics = getMetricas.bind(this);
    this.executeRsi = ExecuteRsi.bind(this);

    this.getMqttMetrics = GetMqttMetrics.bind(this);
    this.executeMqtt = ExecuteMqtt.bind(this);
  }

  leerPCs() {
    const data = readFileSync("./balancer/config.json", "utf8");
    lista_pcs = JSON.parse(data);
    this.services = lista_pcs.services;
    console.log("Listas de PC operando", lista_pcs.pcs);
    console.log(
      "Servicios",
      this.services.map((s) => s.name),
    );
    console.log(
      "Nombre de Pc:",
      lista_pcs.pcs.map((pc) => pc.id),
      "| Host:",
      lista_pcs.pcs.map((pc) => pc.host),
    );
  }

  getServicePort(name, fallbackPort) {
    const service = this.services.find((s) => s.name === name);
    return service?.port ?? fallbackPort;
  }

  getBalancerMetrics() {
    return {
      service: "balancer",
      uptimeSeconds: Math.floor((Date.now() - serviceStart) / 1000),
      loadedServices: this.services?.map((s) => s.name) ?? [],
      configuredPCs: lista_pcs.pcs?.length ?? 0,
      cpuUsage: os.loadavg(),
      freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(3),
      totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(3),
    };
  }

  safeMetricsFetch(fetcher) {
    return fetcher()
      .then((data) => ({ ok: true, data }))
      .catch((err) => ({ ok: false, error: err.message }));
  }

  httpGetJson(url, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const req = get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} en ${url}`));
          }

          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Respuesta invalida en ${url}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Timeout consultando ${url}`));
      });
    });
  }

  async getAllServiceMetrics() {
    const Metrics = {};
    for (const pc of lista_pcs.pcs ?? []) {
      try {
        const [calculadora, refugio, ahorcado, mqtt] = await Promise.all([
          this.safeMetricsFetch(() =>
            this.httpGetJson(
              `http://${pc.host}:${this.getServicePort("REST", 3001)}/calculadora/metricas`,
            ),
          ),
          this.safeMetricsFetch(() =>
            this.getRefugioMetrics(
              pc.host,
              this.getServicePort("REFUGIO", 5051),
            ),
          ),
          this.safeMetricsFetch(() =>
            this.getAhorcadoMetrics(pc.host, this.getServicePort("RSI", 3003)),
          ),
          this.safeMetricsFetch(() => this.getMqttMetrics()),
        ]);
        Metrics[pc.id] = {
          calculadora,
          refugio,
          ahorcado,
          mqtt,
        };
      } catch (error) {
        console.error(`Error consultando metricas para PC ${pc.id}:`, error);
      }
    }

    return {
      balancer: this.getBalancerMetrics(),
      ...Metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  normalizeServiceName(serviceName) {
    const normalized = (serviceName ?? "").toUpperCase();
    return normalized;
  }

  normalizeMetrics(rawMetrics = {}) {
    const cpuRaw = rawMetrics.cpuUsage ?? rawMetrics.cpu_usage ?? 0;
    const cpu = Array.isArray(cpuRaw) ? Number(cpuRaw[0] ?? 0) : Number(cpuRaw);
    return {
      cpu: Number.isNaN(cpu) ? Number.MAX_VALUE : cpu,
      mem: parseFloat(rawMetrics.freeMemory ?? rawMetrics.free_memory ?? 0),
      uptime: Number(
        rawMetrics.uptimeSeconds ?? rawMetrics.uptime_seconds ?? 0,
      ),
      raw: rawMetrics,
    };
  }

  compareNormalizedMetrics(current, best) {
    let scoreCurrent = 0;
    let scoreBest = 0;

    if (current.mem > best.mem) scoreCurrent += 2;
    else if (current.mem < best.mem) scoreBest += 2;

    if (current.cpu < best.cpu) scoreCurrent += 1;
    else if (current.cpu > best.cpu) scoreBest += 1;

    if (current.uptime > best.uptime) scoreCurrent += 1;
    else if (current.uptime < best.uptime) scoreBest += 1;

    return scoreCurrent > scoreBest;
  }

  async getMetricsForService(host, serviceName) {
    const normalizedService = this.normalizeServiceName(serviceName);

    if (normalizedService === "REST") {
      return this.httpGetJson(
        `http://${host}:${this.getServicePort("REST", 3001)}/calculadora/metricas`,
      );
    }

    if (normalizedService === "RSI") {
      return this.getAhorcadoMetrics(host, this.getServicePort("RSI", 3003));
    }

    if (normalizedService === "MQTT") {
      return this.getMqttMetrics();
    }

    if (normalizedService === "JSON_RPC") {
      return this.getRefugioMetrics(
        host,
        this.getServicePort("JSON_RPC", 5051),
      );
    }

    throw new Error(`Servicio no soportado para metricas: ${serviceName}`);
  }

  async compareMetrics(serviceName) {
    const normalizedService = this.normalizeServiceName(serviceName);

    const entries = await Promise.all(
      (lista_pcs.pcs ?? []).map(async (pc) => {
        const res = await this.safeMetricsFetch(() =>
          this.getMetricsForService(pc.host, normalizedService),
        );
        return { pcId: pc.id, host: pc.host, result: res };
      }),
    );
    let best = null;

    for (const { pcId, host, result } of entries) {
      if (!result.ok) {
        continue;
      }

      const normalized = this.normalizeMetrics(result.data);
      if (!best) {
        best = { pcId, host, ...normalized };
        continue;
      }

      if (this.compareNormalizedMetrics(normalized, best)) {
        best = { pcId, host, ...normalized };
      }
    }

    if (!best) {
      throw new Error(
        `No se pudo seleccionar host para el servicio ${normalizedService}`,
      );
    }

    console.log("[BALANCER] Pc con mejor metrica:", best.pcId);

    return {
      service: normalizedService,
      pcId: best.pcId,
      host: best.host,
      metrics: best.raw,
    };
  }

  async execute(serviceName, method, params) {
    const normalizedService = this.normalizeServiceName(serviceName);
    const best = await this.compareMetrics(normalizedService);
    console.log(
      "[Ejecucion del servicio] serviceName:",
      serviceName,
      "| metrod:",
      method,
      "| Params:",
      params,
    );

    if (normalizedService === "REST") {
      const result = await this.executeRest(best.host, method, params);

      const execution = { service: normalizedService, host: best.host, result };
      this.lastExecution = {
        service: normalizedService,
        host: best.host,
        method,
        at: new Date().toISOString(),
      };
      return execution;
    }

    if (normalizedService === "RSI") {
      let targetHost = best.host;
      if (
        method === "jugar" &&
        params?.id &&
        this.clienteProto.has(params.id)
      ) {
        targetHost = this.clienteProto.get(params.id);
      }

      const result = await this.executeRsi(
        targetHost,
        this.getServicePort("RSI", 3003),
        method,
        params,
      );

      if (method === "iniciar" && result?.id) {
        this.clienteProto.set(result.id, targetHost);
      }

      if (
        method === "jugar" &&
        params?.id &&
        (result?.ganado || result?.perdido)
      ) {
        this.clienteProto.delete(params.id);
      }

      const execution = {
        service: normalizedService,
        host: targetHost,
        result: result,
      };
      this.lastExecution = {
        service: normalizedService,
        host: targetHost,
        method,
        at: new Date().toISOString(),
      };
      return execution;
    }

    if (normalizedService === "MQTT") {
      const result = await this.executeMqtt(method, params);
      const execution = {
        service: normalizedService,
        host: best.host,
        result: result,
      };
      this.lastExecution = {
        service: normalizedService,
        host: best.host,
        method,
        at: new Date().toISOString(),
      };
      return execution;
    }

    if (normalizedService === "JSON_RPC") {
      const result = await this.executeRefugio(best.host, method, params);
      const resultComplete = {
        service: normalizedService,
        host: best.host,
        result: result,
      };
      this.lastExecution = {
        service: normalizedService,
        host: best.host,
        method,
        at: new Date().toISOString(),
      };
      return resultComplete;
    }

    throw new Error(`Servicio no soportado en execute: ${serviceName}`);
  }

  createServer() {
    const app = express();
    app.use(express.json());

    app.get("/balancer/metricas", (_req, res) => {
      res.status(200).json(this.getBalancerMetrics());
    });

    app.get("/metricas", async (_req, res) => {
      try {
        const metrics = await this.getAllServiceMetrics();
        res.status(200).json(metrics);
      } catch (error) {
        res.status(500).json({
          error: error.message || "Error obteniendo metricas",
        });
      }
    });

    app.get("/stats", (_req, res) => {
      res.status(200).json(lista_pcs);
    });

    app.get("/servicio-activo", (_req, res) => {
      if (!this.lastExecution) {
        return res.status(200).json({
          message: "Aun no se ha ejecutado ningun servicio",
        });
      }

      return res.status(200).json(this.lastExecution);
    });

    app.post("/execute", async (req, res) => {
      try {
        const { serviceName, method, params } = req.body || {};
        // console.log(
        //   "[MENSAJE IMPORTANTE], Servicio:",
        //   serviceName,
        //   "| Metodo:",
        //   method,
        //   "| Params:",
        //   params,
        // );

        if (!serviceName || !method) {
          return res.status(400).json({
            error: "serviceName y method son obligatorios",
          });
        }

        const result = await this.execute(serviceName, method, params);
        console.log("Resultado de la ejecucion gRPC....:", result);
        return res.status(200).json(result);
      } catch (error) {
        return res.status(500).json({
          error: error.message || "Error interno del balanceador",
        });
      }
    });

    app.use((_req, res) => {
      res.status(404).json({ error: "Ruta no encontrada" });
    });

    return app.listen(8000, "0.0.0.0", () => {
      console.log(
        "Endpoint de metricas del balanceador en http://localhost:8000/balancer/metricas",
      );
      console.log(
        "Endpoint agregado de metricas en http://localhost:8000/metricas",
      );
      console.log("Endpoint de ejecucion en http://localhost:8000/execute");
      console.log(
        "Endpoint de ultimo servicio ejecutado en http://localhost:8000/servicio-activo",
      );
    });
  }
}

const balanceador = new Balanceador();
balanceador.createServer();
