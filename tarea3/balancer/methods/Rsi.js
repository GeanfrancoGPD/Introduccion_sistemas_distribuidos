import { connect as connectNet } from "net";

function rsiRequest(host, port, params) {
  return new Promise((resolve, reject) => {
    const socket = connectNet(port, host);

    socket.setTimeout(4000);

    socket.on("connect", () => {
      socket.write(JSON.stringify(params));
    });

    socket.on("data", (data) => {
      try {
        const res = JSON.parse(data.toString());
        resolve(res);
      } catch {
        reject(new Error("Respuesta inválida RSI"));
      } finally {
        socket.end();
      }
    });

    socket.on("error", reject);

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Timeout RSI"));
    });
  });
}

// MÉTODOS

function iniciar(host, port) {
  return rsiRequest(host, port, {
    method: "iniciar",
  });
}

function jugarLetra(host, letra, port, id) {
  return rsiRequest(host, port, {
    method: "jugar",
    params: { letra, id },
  });
}

export function getMetricas(host, port) {
  return rsiRequest(host, port, {
    method: "metricas",
  });
}

export function ExecuteRsi(host, port = 3003, method, params) {
  switch (method) {
    case "iniciar":
      return iniciar(host, port);
    case "jugar":
      return jugarLetra(host, params.letra || "A", port, params.id);
    default:
      throw new Error("Metodo RSI no soportado");
  }
}
