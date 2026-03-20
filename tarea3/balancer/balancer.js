import { get, createServer } from "http";
import { connect as connectNet } from "net";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { connect as connectMqtt } from "mqtt";
import { loadSync } from "@grpc/proto-loader";
import {
  loadPackageDefinition,
  credentials as grpcCredentials,
} from "@grpc/grpc-js";
import os from "os";

let lista_pcs = [];
const serviceStart = Date.now();
const MQTT_BROKER = "mqtt://broker.hivemq.com";
const MQTT_METRICS_REQ_TOPIC = "mqtt/metricas/get";
const MQTT_METRICS_RES_BASE_TOPIC = "mqtt/metricas/resp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const protoPath = join(__dirname, "..", "refugio", "refugio.proto");
const packageDef = loadSync(protoPath, { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

class Balanceador {
  constructor() {
    this.services = [];
    this.leerPCs();
    this.getBalancerMetrics = this.getBalancerMetrics.bind(this);
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

  getRefugioMetrics(host, port) {
    return new Promise((resolve, reject) => {
      const client = new refugioProto.RefugioService(
        `${host}:${port}`,
        grpcCredentials.createInsecure(),
      );

      client.ObtenerMetricas({}, (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  }

  getAhorcadoMetrics(host, port) {
    return new Promise((resolve, reject) => {
      const socket = connectNet(port, host, () => {
        socket.write("metricas");
      });

      socket.setTimeout(3000);
      socket.once("data", (data) => {
        try {
          resolve(JSON.parse(data.toString()));
        } catch {
          reject(new Error("Respuesta invalida del servicio RSI"));
        } finally {
          socket.end();
        }
      });

      socket.once("error", reject);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout consultando metricas RSI"));
      });
    });
  }

  getMqttMetrics() {
    return new Promise((resolve, reject) => {
      const correlationId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const responseTopic = `${MQTT_METRICS_RES_BASE_TOPIC}/${correlationId}`;
      const client = connectMqtt(MQTT_BROKER);

      const failAndClose = (error) => {
        client.end(true, () => reject(error));
      };

      const timeout = setTimeout(() => {
        failAndClose(new Error("Timeout consultando metricas MQTT"));
      }, 4000);

      client.on("connect", () => {
        client.subscribe(responseTopic, (subError) => {
          if (subError) {
            clearTimeout(timeout);
            failAndClose(subError);
            return;
          }

          client.publish(
            MQTT_METRICS_REQ_TOPIC,
            JSON.stringify({ correlationId }),
          );
        });
      });

      client.on("message", (topic, payload) => {
        if (topic !== responseTopic) {
          return;
        }

        clearTimeout(timeout);
        try {
          const metrics = JSON.parse(payload.toString());
          client.end(true, () => resolve(metrics));
        } catch {
          failAndClose(new Error("Respuesta invalida de metricas MQTT"));
        }
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        failAndClose(err);
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
    if (normalized === "GRPC") return "REFUGIO";
    if (normalized === "JSON_RPC") return "REFUGIO";
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

    if (normalizedService === "REFUGIO") {
      return this.getRefugioMetrics(host, this.getServicePort("REFUGIO", 5051));
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

    return {
      service: normalizedService,
      pcId: best.pcId,
      host: best.host,
      metrics: best.raw,
    };
  }

  async httpPostJson(url, body, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(parsed?.error || `HTTP ${response.status} en ${url}`);
      }

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  async executeRest(host, method, params = []) {
    const port = this.getServicePort("REST", 3001);
    return this.httpPostJson(`http://${host}:${port}/calculadora/methods`, {
      method,
      params,
    });
  }

  async executeRsi(host, method, params = []) {
    const port = this.getServicePort("RSI", 3003);

    return new Promise((resolve, reject) => {
      const socket = connectNet(port, host, () => {
        if (method === "play") {
          socket.write(`play:${params?.[0] ?? "A"}`);
          return;
        }

        if (method === "metricas") {
          socket.write("metricas");
          return;
        }

        socket.destroy();
        reject(new Error(`Metodo RSI no soportado: ${method}`));
      });

      socket.setTimeout(4000);

      socket.once("data", (data) => {
        try {
          resolve(JSON.parse(data.toString()));
        } catch {
          reject(new Error("Respuesta invalida del servicio RSI"));
        } finally {
          socket.end();
        }
      });

      socket.once("error", reject);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout ejecutando solicitud RSI"));
      });
    });
  }

  async executeRefugio(host, method, params = {}) {
    const port = this.getServicePort("REFUGIO", 5051);
    const client = new refugioProto.RefugioService(
      `${host}:${port}`,
      grpcCredentials.createInsecure(),
    );

    const mapMethods = {
      ObtenerPerros: () =>
        new Promise((resolve, reject) => {
          client.ObtenerPerros({}, (err, response) => {
            if (err) return reject(err);
            resolve(response);
          });
        }),
      AdoptarPerro: () =>
        new Promise((resolve, reject) => {
          client.AdoptarPerro(params, (err, response) => {
            if (err) return reject(err);
            resolve(response);
          });
        }),
      ObtenerMetricas: () =>
        new Promise((resolve, reject) => {
          client.ObtenerMetricas({}, (err, response) => {
            if (err) return reject(err);
            resolve(response);
          });
        }),
    };

    if (!mapMethods[method]) {
      throw new Error(`Metodo gRPC no soportado: ${method}`);
    }

    return mapMethods[method]();
  }

  async executeMqtt(_host, method, params = {}) {
    if (method === "metricas") {
      return this.getMqttMetrics();
    }

    const topic = params.topic || "mqtt/lorem";
    const payload =
      params.payload || `Mensaje desde balanceador: ${Date.now()}`;

    return new Promise((resolve, reject) => {
      const client = connectMqtt(MQTT_BROKER);
      const timeout = setTimeout(() => {
        client.end(true, () => reject(new Error("Timeout publicando en MQTT")));
      }, 4000);

      client.on("connect", () => {
        client.publish(topic, String(payload), (err) => {
          clearTimeout(timeout);
          if (err) {
            client.end(true, () => reject(err));
            return;
          }
          client.end(true, () => resolve({ published: true, topic, payload }));
        });
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.end(true, () => reject(err));
      });
    });
  }

  async execute(serviceName, method, params) {
    const normalizedService = this.normalizeServiceName(serviceName);
    const best = await this.compareMetrics(normalizedService);

    if (normalizedService === "REST") {
      const result = await this.executeRest(best.host, method, params);
      return { service: normalizedService, host: best.host, result };
    }

    if (normalizedService === "RSI") {
      const result = await this.executeRsi(best.host, method, params);
      return { service: normalizedService, host: best.host, result };
    }

    if (normalizedService === "MQTT") {
      const result = await this.executeMqtt(best.host, method, params);
      return { service: normalizedService, host: best.host, result };
    }

    if (normalizedService === "REFUGIO") {
      const result = await this.executeRefugio(best.host, method, params);
      return { service: normalizedService, host: best.host, result };
    }

    throw new Error(`Servicio no soportado en execute: ${serviceName}`);
  }

  createServer() {
    return createServer(async (req, res) => {
      if (req.url === "/balancer/metricas") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(this.getBalancerMetrics()));
      }
      if (req.url === "/metricas") {
        const metrics = await this.getAllServiceMetrics();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(metrics));
      }

      if (req.url === "/stats") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(lista_pcs, null, 2));
      }

      if (req.url === "/execute" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const { serviceName, method, params } = JSON.parse(body || "{}");
            if (!serviceName || !method) {
              res.writeHead(400, { "Content-Type": "application/json" });
              return res.end(
                JSON.stringify({
                  error: "serviceName y method son obligatorios",
                }),
              );
            }

            const result = await this.execute(serviceName, method, params);
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify(result));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                error: error.message || "Error interno del balanceador",
              }),
            );
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Ruta no encontrada" }));
    }).listen(8000, "0.0.0.0", () => {
      console.log(
        "Endpoint de metricas del balanceador en http://localhost:8000/balancer/metricas",
      );
      console.log(
        "Endpoint agregado de metricas en http://localhost:8000/metricas",
      );
      console.log("Endpoint de ejecucion en http://localhost:8000/execute");
    });
  }
}

const balanceador = new Balanceador();
balanceador.createServer();
