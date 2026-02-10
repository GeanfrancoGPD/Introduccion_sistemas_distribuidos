
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

