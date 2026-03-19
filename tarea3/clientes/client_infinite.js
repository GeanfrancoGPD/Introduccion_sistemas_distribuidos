const http = require('http');
const net = require('net');

console.log("EJECUTANDO ESTRES INFINITO... (Presiona Ctrl+C para finalizar)");

const loop = setInterval(() => {
  // 1. Peticion a la Calculadora
  http.get('http://localhost:8000/sumar?a=10&b=20', () => {});
  
  // 2. Peticion al Refugio (pasa por el balanceador al puerto 8000)
  const req = http.request({ hostname: 'localhost', port: 8000, path: '/rpc', method: 'POST' });
  req.write(JSON.stringify({ jsonrpc: "2.0", method: "adoptar" }));
  req.end();

  // 3. Peticion al Ahorcado
  const rsi = net.connect(8001, 'localhost', () => {
    const char = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    rsi.write(`play:${char}`);
    rsi.destroy();
  });
  
  process.stdout.write(".");
}, 500); // 1 peticion cada medio segundo

// CAPTURA EL CTRL + C
process.on('SIGINT', () => {
  clearInterval(loop);
  console.log("\n\n[CLIENTE] Deteniendo estres de red...");
  console.log("[CLIENTE] Solicitando reporte al Balanceador...");
  
  // Llama a la ruta del balanceador para imprimir tabla
  http.get('http://localhost:8000/print-stats', () => {
    console.log("[CLIENTE] Listo! Revisa la ventana negra del BALANCEADOR para ver la tabla estadistica. Hasta luego!");
    process.exit();
  }).on('error', () => {
    console.log("[CLIENTE] Error: El balanceador ya estaba cerrado.");
    process.exit();
  });
});