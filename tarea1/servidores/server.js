
import { WebSocketServer } from "ws";
import Calculadora from "./Calculadora.js";

const instance = new Calculadora();


export default class server {
  constructor() {
    this.socket = new WebSocketServer({ port: 5000 });
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
  }
}

const serverInstance = new server();
serverInstance.start();
