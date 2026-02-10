
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


