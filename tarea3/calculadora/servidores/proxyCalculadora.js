import ClientConnect from "./clientConnect.js";

export default class ProxyCalculadora {
  constructor() {
    this.client = new ClientConnect();
  }

  async status() {
    return this.client.send("status", []);
  }

  async sumar(a, b) {
    return this.client.send("sumar", [a, b]);
  }

  async restar(a, b) {
    return this.client.send("restar", [a, b]);
  }

  async multiplicar(a, b, c) {
    return this.client.send("multiplicar", [a, b, c]);
  }

  async division(a, b) {
    return this.client.send("division", [a, b]);
  }
}
