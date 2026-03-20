// import { WebSocketServer } from "ws";
import express from "express";
import os from "os";
import Calculadora from "./Calculadora.js";

const instance = new Calculadora();
const serviceStart = Date.now();
const app = express();

app.use(express.json());

function getMetrics() {
  return {
    service: "calculadora",
    uptimeSeconds: Math.floor((Date.now() - serviceStart) / 1000),
    cpuUsage: os.loadavg(),
    freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(3),
    totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(3),
  };
}
app.get("/calculadora/metricas", (_req, res) => {
  return res.status(200).json(getMetrics());
});

app.get("/calculadora/methods", (_req, res) => {
  const methods = Object.getOwnPropertyNames(Calculadora.prototype).filter(
    (m) => m !== "constructor",
  );
  return res.status(200).json({ methods });
});

app.post("/calculadora/methods", (req, res) => {
  try {
    const { method, params } = req.body || {};
    if (typeof instance[method] === "function") {
      const safeParams = Array.isArray(params) ? params : [];
      const result = instance[method](...safeParams);
      return res.status(200).json({ result });
    }

    return res.status(400).json({ error: "Método no existe" });
  } catch {
    return res.status(400).json({ error: "JSON inválido" });
  }
});

app.use((_req, res) => {
  return res.status(404).json({ error: "Endpoint no encontrado" });
});

app.listen(3001, "0.0.0.0", () => {
  console.log("[REST]Servidor de calculadora escuchando en puerto 3001");
});

//"Endpoint de métodos en http://localhost:3001/calculadora/methods (GET para listar, POST para ejecutar)",

// export default class server {
//   constructor() {
//     // Un solo puerto (5000): HTTP para metricas y upgrade para WebSocket.
//     this.socket = new WebSocketServer({ server: httpServer });
//   }

//   start() {
//     this.socket.on("connection", (ws) => {
//       console.log("Cliente conectado");
//       ws.on("message", (message) => {
//         const req = JSON.parse(message);
//         const { method, params } = req;
//         console.log("Recibido método:", method, "con params:", params);
//         if (typeof instance[method] === "function") {
//           const result = instance[method](...params);
//           console.log("Enviado resultado:", result);
//           ws.send(JSON.stringify({ result }));
//         } else {
//           ws.send(JSON.stringify({ error: "Método no existe" }));
//         }
//       });
//     });

//     console.log("Servidor escuchando en 5000");
//     console.log(
//       "Endpoint de metricas calculadora en http://localhost:5000/calculadora/metricas",
//     );
//     httpServer.listen(5000, "0.0.0.0");
//   }
// }

// const serverInstance = new server();
// serverInstance.start();
