import sendRequest from "./clientConnect.js";

export default class ProxyCalculadora {
  async sumar(a, b) {
    const res = await sendRequest({
      method: "sumar",
      params: [a, b],
    });
    return res.result;
  }

  async restar(a, b) {
    const res = await sendRequest({
      method: "restar",
      params: [a, b],
    });
    return res.result;
  }
}
