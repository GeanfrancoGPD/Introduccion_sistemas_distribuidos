import fs from "fs";
import path from "path";

export default function generateClient(content) {
  const dir = content.path || "./clientes";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // clientConnect
  const connectCode = `
import WebSocket from "ws";

export default class ClientConnect {
  constructor() {
    this.socket = new WebSocket("ws://localhost:5000");
  }

  serialize(method, params) {
    return JSON.stringify({ method, params });
  }

  deserialize(buffer) {
    return JSON.parse(buffer.toString());
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      try {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(this.serialize(method, params));
        } else {
          this.socket.once("open", () => {
            this.socket.send(this.serialize(method, params));
          });
        }

        return this.socket.once("message", (message) => {
          const res = this.deserialize(message);
          resolve(res.result);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

`;

  fs.writeFileSync(path.join(dir, "clientConnect.js"), connectCode);

  // Proxy
  let proxyCode = `
import ClientConnect from "./clientConnect.js";

export default class ProxyCalculadora {
  constructor() {
    this.client = new ClientConnect();
  }

  async sumar(a, b) {
    return this.client.send("sumar", [a, b]);
  }

  async restar(a, b) {
    return this.client.send("restar", [a, b]);
  }
}


`;

  fs.writeFileSync(path.join(dir, `proxy${content.className}.js`), proxyCode);
}
