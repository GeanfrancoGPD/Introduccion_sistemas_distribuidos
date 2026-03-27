import { connect as connectMqtt } from "mqtt";

const BROKER = "mqtt://broker.hivemq.com";

const TOPICS = {
  METRICS_REQ: "mqtt/metricas/get",
  METRICS_RES: "mqtt/metricas/resp",
  SALUDAR: "mqtt/api/saludar",
  SUSCRIBIR: "mqtt/api/suscribir",
  API_RES: "mqtt/api/resp",
};

// Helper genérico request/response
function mqttRequest(requestTopic, responseBase, payload = {}) {
  return new Promise((resolve, reject) => {
    const correlationId = `${Date.now()}-${Math.random()}`;
    const responseTopic = `${responseBase}/${correlationId}`;
    const client = connectMqtt(BROKER);

    const timeout = setTimeout(() => {
      client.end(true, () => reject(new Error("Timeout MQTT")));
    }, 4000);

    client.on("connect", () => {
      client.subscribe(responseTopic, (err) => {
        if (err) {
          clearTimeout(timeout);
          client.end(true, () => reject(err));
          return;
        }

        client.publish(
          requestTopic,
          JSON.stringify({ correlationId, ...payload }),
        );
      });
    });

    client.on("message", (topic, message) => {
      if (topic !== responseTopic) return;

      clearTimeout(timeout);

      try {
        const data = JSON.parse(message.toString());
        client.end(true, () => resolve(data));
      } catch {
        client.end(true, () => reject(new Error("Respuesta inválida")));
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      client.end(true, () => reject(err));
    });
  });
}

// Metodos
export function GetMqttMetrics() {
  return mqttRequest(TOPICS.METRICS_REQ, TOPICS.METRICS_RES);
}

function Saludar(nombre) {
  console.log("Saludar a ", nombre);

  return mqttRequest(TOPICS.SALUDAR, TOPICS.API_RES, { nombre });
}

function Suscribir(topic) {
  return mqttRequest(TOPICS.SUSCRIBIR, TOPICS.API_RES, { topic });
}

export async function ExecuteMqtt(method, params) {
  switch (method) {
    case "saludar":
      return await Saludar(params.nombre);
    case "suscribir":
      return await Suscribir(params.topic);
    default:
      throw new Error("Método MQTT no encontrado");
  }
}
