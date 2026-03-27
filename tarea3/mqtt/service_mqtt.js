import { connect } from "mqtt";
import os from "os";

const brokerUrl = "mqtt://broker.hivemq.com";

// Topics base
const TOPICS = {
  METRICS_REQ: "mqtt/metricas/get",
  METRICS_RES: "mqtt/metricas/resp",
  SALUDAR: "mqtt/api/saludar",
  SUSCRIBIR: "mqtt/api/suscribir",
  API_RES: "mqtt/api/resp",
};

const state = {
  start: Date.now(),
  connected: false,
  publishedMessages: 0,
  lastPublishedAt: null,
};

function getMetrics() {
  return {
    service: "mqtt",
    brokerUrl,
    connected: state.connected,
    uptimeSeconds: Math.floor((Date.now() - state.start) / 1000),
    publishedMessages: state.publishedMessages,
    lastPublishedAt: state.lastPublishedAt,
    cpuUsage: os.loadavg(),
    freeMemory: (os.freemem() / 1024 ** 3).toFixed(3),
    totalMemory: (os.totalmem() / 1024 ** 3).toFixed(3),
  };
}

const client = connect(brokerUrl, {
  clientId: "mqtt_service_" + Math.random().toString(16).slice(2),
  reconnectPeriod: 2000,
});

console.log("[MQTT] Iniciando servicio...");

client.on("connect", () => {
  state.connected = true;
  console.log("[MQTT] Conectado");

  client.subscribe(
    [TOPICS.METRICS_REQ, TOPICS.SALUDAR, TOPICS.SUSCRIBIR],
    (err) => {
      if (err) {
        console.log("[MQTT] Error suscripción:", err.message);
        return;
      }
      console.log("[MQTT] Metodos listos: metricas, saludar, suscribir");
    },
  );

  // Publicación automática
  setInterval(() => {
    const msg = "Holaaa Suscribete...";
    client.publish("mqtt/lorem", msg);
    state.publishedMessages++;
    state.lastPublishedAt = new Date().toISOString();
  }, 1500);
});

client.on("message", (topic, payload) => {
  let body = {};

  try {
    body = JSON.parse(payload.toString() || "{}");
  } catch {
    console.log("[MQTT] JSON inválido");
    return;
  }

  const correlationId = body.correlationId || Date.now().toString();

  // METRICAS
  if (topic === TOPICS.METRICS_REQ) {
    const resTopic = `${TOPICS.METRICS_RES}/${correlationId}`;
    client.publish(resTopic, JSON.stringify(getMetrics()));
    return;
  }

  const resTopic = `${TOPICS.API_RES}/${correlationId}`;

  // Saludar
  if (topic === TOPICS.SALUDAR) {
    const nombre = body.nombre || "anonimo";

    client.publish(
      resTopic,
      JSON.stringify({
        message: `Hola!! ${nombre}`,
      }),
    );
    return;
  }

  // SUSCRIBIR
  if (topic === TOPICS.SUSCRIBIR) {
    const newTopic = body.topic;

    if (!newTopic) {
      client.publish(resTopic, JSON.stringify({ error: "Falta topic" }));
      return;
    }

    client.subscribe(newTopic, (err) => {
      if (err) {
        client.publish(resTopic, JSON.stringify({ error: err.message }));
        return;
      }

      client.publish(
        resTopic,
        JSON.stringify({ message: `Suscrito a ${newTopic}` }),
      );
    });
  }
});

client.on("error", (err) => {
  state.connected = false;
  console.log("[MQTT] Error:", err.message);
});

client.on("close", () => {
  state.connected = false;
  console.log("[MQTT] Conexión cerrada");
});
