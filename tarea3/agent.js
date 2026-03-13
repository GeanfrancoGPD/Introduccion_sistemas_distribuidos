const http = require('http');
const os = require('os');

// Permite recibir el puerto por consola, por defecto usa 4000
const port = process.argv[2] || 4000;

http.createServer((req, res) => {
  if (req.url === '/specs') {
    // Lee los hilos del CPU y convierte los MHz a GHz
    const cpus = os.cpus();
    const cpu_speed = parseFloat((cpus[0].speed / 1000).toFixed(2)); 
    
    // Lee la memoria total en Bytes y la convierte a GB
    const ram = Math.round(os.totalmem() / (1024 ** 3)); 

    console.log(`[AGENTE] El balanceador solicitó las specs -> CPU: ${cpu_speed}GHz | RAM: ${ram}GB`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cpu_speed, ram }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(port, '0.0.0.0', () => console.log(`Agente de Hardware escuchando en el puerto ${port}...`));