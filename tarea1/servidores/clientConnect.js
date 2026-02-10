import WebSocket from "ws";

export default class ClientConnect {
  constructor() {
    this.socket = new WebSocket("ws://localhost:5000");
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      try {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ method, params }));
        } else {
          this.socket.once("open", () => {
            this.socket.send(JSON.stringify({ method, params }));
          });
        }

        return this.socket.once("message", (message) => {
          const res = JSON.parse(message);
          resolve(res.result);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
