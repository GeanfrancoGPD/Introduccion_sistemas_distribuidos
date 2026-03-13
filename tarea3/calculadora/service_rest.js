const http = require('http');
const url = require('url');
const ProxyCalculadora = require('./servidores/proxyCalculadora.js');

const proxyCalc = new ProxyCalculadora();

http.createServer(async (req, res) => {
  const q = url.parse(req.url, true).query;
  const a = parseFloat(q.a) || 0;
  const b = parseFloat(q.b) || 0;
  
  let result = 0;
  let op = "DESCONOCIDA";

  if (req.url.includes('sumar')) {
    op = 'SUMANDO';
    result = await proxyCalc.sumar(a, b);
  } else if (req.url.includes('restar')) {
    op = 'RESTANDO';
    result = await proxyCalc.restar(a, b);
  }

  console.log(`[GATEWAY REST->WS] Operación: ${op} | Valores: ${a}, ${b} | Resultado: ${result}`);
  res.end(JSON.stringify({ tecnologia: "REST -> WebSocket", result }));
}).listen(3001, '0.0.0.0', () => console.log("Gateway Calculadora (REST->WS) en espera en 3001..."));