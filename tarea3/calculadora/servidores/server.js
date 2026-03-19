import { WebSocketServer } from "ws";
import { createServer } from "http";
import os from "os";
import Calculadora from "./Calculadora.js";

const instance = new Calculadora();
const serviceStart = Date.now();

function getMetrics() {
  return {
    service: "calculadora",
    uptimeSeconds: Math.floor((Date.now() - serviceStart) / 1000),
    cpuUsage: os.loadavg(),
    freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(3),
    totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(3),
  };
}

const httpServer = createServer((req, res) => {
  if (req.url === "/calculadora/metricas") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(getMetrics()));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Ruta no encontrada" }));
});

export default class server {
  constructor() {
    // Un solo puerto (5000): HTTP para metricas y upgrade para WebSocket.
    this.socket = new WebSocketServer({ server: httpServer });
  }

  start() {
    this.socket.on("connection", (ws) => {
      console.log("Cliente conectado");
      ws.on("message", (message) => {
        const req = JSON.parse(message);
        const { method, params } = req;
        console.log("Recibido método:", method, "con params:", params);
        if (typeof instance[method] === "function") {
          const result = instance[method](...params);
          console.log("Enviado resultado:", result);
          ws.send(JSON.stringify({ result }));
        } else {
          ws.send(JSON.stringify({ error: "Método no existe" }));
        }
      });
    });

    console.log("Servidor escuchando en 5000");
    console.log(
      "Endpoint de metricas calculadora en http://localhost:5000/calculadora/metricas",
    );
    httpServer.listen(5000, "0.0.0.0");
  }
}

const serverInstance = new server();
serverInstance.start();
