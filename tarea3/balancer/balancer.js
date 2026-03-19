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
const MQTT_BROKER = "mqtt://test.mosquitto.org";
const MQTT_METRICS_REQ_TOPIC = "tarea3/mqtt/metricas/get";
const MQTT_METRICS_RES_BASE_TOPIC = "tarea3/mqtt/metricas/resp";

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
        const [calculadora, refugio, ahorcado, mqtt, agentes] =
          await Promise.all([
            this.safeMetricsFetch(() =>
              this.httpGetJson("http://127.0.0.1:5000/calculadora/metricas"),
            ),
            this.safeMetricsFetch(() =>
              this.getRefugioMetrics("127.0.0.1", 5051),
            ),
            this.safeMetricsFetch(() =>
              this.getAhorcadoMetrics(
                "127.0.0.1",
                this.getServicePort("RSI", 3003),
              ),
            ),
            this.safeMetricsFetch(this.getMqttMetrics),
          ]);
        Metrics[pc.id] = {
          calculadora,
          refugio,
          ahorcado,
          mqtt,
          agentes,
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
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Ruta no encontrada" }));
    }).listen(8000, "0.0.0.0", () => {
      console.log(
        "Endpoint de metricas del balanceador en http://localhost:8000/balancer/metricas",
      );
      console.log(
        "Endpoint agregado de metricas en http://localhost:8000/metricas",
      );
    });
  }
}

const balanceador = new Balanceador();
balanceador.createServer();
