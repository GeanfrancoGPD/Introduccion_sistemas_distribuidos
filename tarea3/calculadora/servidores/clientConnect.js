const WebSocket = require("ws");

class ClientConnect {
  constructor() {
    this.socket = new WebSocket("ws://localhost:5000");
  }
  serialize(method, params) { return JSON.stringify({ method, params }); }
  deserialize(buffer) { return JSON.parse(buffer.toString()); }

  send(method, params) {
    return new Promise((resolve, reject) => {
      try {
        const sendMsg = () => this.socket.send(this.serialize(method, params));
        if (this.socket.readyState === WebSocket.OPEN) sendMsg();
        else this.socket.once("open", sendMsg);

        this.socket.once("message", (message) => {
          resolve(this.deserialize(message).result);
        });
      } catch (err) { reject(err); }
    });
  }
}
module.exports = ClientConnect;