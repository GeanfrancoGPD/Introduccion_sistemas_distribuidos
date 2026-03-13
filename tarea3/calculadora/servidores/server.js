const WebSocket = require('ws');
const Calculadora = require('./Calculadora.js');

const wss = new WebSocket.Server({ port: 5000 });
const calc = new Calculadora();

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { method, params } = JSON.parse(message);
    let result = method === 'status' ? "OK" : (calc[method] ? calc[method](...params) : "Error");
    ws.send(JSON.stringify({ result }));
  });
});
console.log("Servidor WebSocket (Calculadora) corriendo en el puerto 5000...");