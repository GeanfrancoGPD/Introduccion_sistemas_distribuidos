import { connect } from "mqtt";
import os from "os";

const serviceStart = Date.now();
const brokerUrl = "mqtt://broker.hivemq.com";
let isConnected = false;
let publishedMessages = 0;
let lastPublishedAt = null;
const METRICS_REQ_TOPIC = "mqtt/metricas/get";
const METRICS_RES_BASE_TOPIC = "mqtt/metricas/resp";

function getMetrics() {
  return {
    service: "mqtt",
    brokerUrl,
    connected: isConnected,
    uptimeSeconds: Math.floor((Date.now() - serviceStart) / 1000),
    publishedMessages,
    lastPublishedAt,
    cpuUsage: os.loadavg(),
    freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(3),
    totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(3),
  };
}

console.log("[MQTT] Iniciando servicio... buscando broker publico.");
const client = connect(brokerUrl, {
  clientId: "mqtt_service_" + Math.random().toString(16).slice(2),
  reconnectPeriod: 2000,
  keepalive: 60,
  connectTimeout: 5000,
  clean: true,
});
client.on("connect", () => {
  isConnected = true;
  console.log("[MQTT] Conectado exitosamente al broker publico.");

  client.subscribe(METRICS_REQ_TOPIC, (err) => {
    if (err) {
      console.log(
        "[MQTT] Error al suscribirse al topic de metricas:",
        err.message,
      );
      return;
    }
    console.log(
      `[MQTT] Escuchando solicitudes de metricas en ${METRICS_REQ_TOPIC}`,
    );
  });

  setInterval(() => {
    const msg = "Lorem Ipsum dolor sit amet...";
    console.log(`[MQTT] Publicando rafaga: ${msg}`);
    client.publish("mqtt/lorem", msg);
    publishedMessages += 1;
    lastPublishedAt = new Date().toISOString();
  }, 1500);
});

client.on("message", (topic, payload) => {
  if (topic !== METRICS_REQ_TOPIC) {
    return;
  }

  try {
    const body = JSON.parse(payload.toString() || "{}");
    const correlationId = body.correlationId || Date.now().toString();
    const responseTopic = `${METRICS_RES_BASE_TOPIC}/${correlationId}`;
    client.publish(responseTopic, JSON.stringify(getMetrics()));
  } catch (err) {
    console.log("[MQTT] Error procesando solicitud de metricas:", err.message);
  }
});

client.on("error", (err) => {
  isConnected = false;
  console.log("[MQTT] Error de conexion:", err.message);
});

client.on("close", () => {
  isConnected = false;
  console.log("[MQTT] Conexion cerrada");
});

client.on("offline", () => {
  console.log("[MQTT] Cliente offline");
});

client.on("reconnect", () => {
  console.log("[MQTT] Reintentando conexion...");
});
