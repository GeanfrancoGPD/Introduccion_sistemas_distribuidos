const http = require('http');
const net = require('net');
const httpProxy = require('http-proxy');
const config = require('./config.json');

const proxy = httpProxy.createProxyServer({});
let stats = [];

// 1. Fase de Descubrimiento (Auto-Discovery)
async function initNodes() {
  console.log("Detectando hardware de los nodos en la red...");
  
  for (const node of config.nodes) {
    try {
      const specs = await new Promise((resolve, reject) => {
        http.get(`http://${node.host}:${node.agent_port}/specs`, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve(JSON.parse(data)));
        }).on("error", reject);
      });
      
      stats.push({ ...node, specs, activeConnections: 0, latency: 0, totalRequests: 0 });
      console.log(`[OK] ${node.id} detectada -> CPU: ${specs.cpu_speed}GHz, RAM: ${specs.ram}GB`);
    } catch (err) {
      console.log(`[ERROR] No se encontro el Agente en ${node.id} (${node.host}:${node.agent_port})`);
    }
  }

  if (stats.length === 0) {
    console.error("Ningun nodo respondio. Apagando balanceador.");
    process.exit(1);
  }
  
  startBalancer(); // Iniciar el balanceador solo si hay hardware detectado
}

// 2. Logica del Balanceador
function getBestNode() {
  return stats.sort((a, b) => {
    const scoreA = (a.activeConnections * a.latency + 1) / (a.specs.cpu_speed * a.specs.ram);
    const scoreB = (b.activeConnections * b.latency + 1) / (b.specs.cpu_speed * b.specs.ram);
    return scoreA - scoreB;
  })[0];
}

function startBalancer() {
  // Balanceador HTTP (REST y gRPC-Gateway)
  http.createServer((req, res) => {
    // NUEVA RUTA: El cliente llama aqui para que el balanceador imprima
    if (req.url === '/print-stats') {
      console.log("\n=======================================================");
      console.log("       ESTADISTICAS FINALES DE BALANCEO");
      console.table(stats.map(s => ({
        Nodo: s.id,
        "CPU (GHz)": s.specs.cpu_speed,
        "RAM (GB)": s.specs.ram,
        Latencia_ms: s.latency,
        Peticiones_Atendidas: s.totalRequests
      })));
      console.log("=======================================================\n");
      res.writeHead(200);
      return res.end("Impreso en consola del balanceador");
    }

    if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(stats, null, 2));
    }

    const node = getBestNode();
    const start = Date.now();
    const port = req.url.includes('/rpc') ? config.services.JSON_RPC : config.services.REST;
    
    node.activeConnections++;
    proxy.web(req, res, { target: `http://${node.host}:${port}` }, () => node.activeConnections--);
    
    res.on('finish', () => {
      node.activeConnections--;
      node.latency = Date.now() - start;
      node.totalRequests++;
      console.log(`[BALANCER] HTTP derivado a -> ${node.id}`);
    });
  }).listen(8000, '0.0.0.0');

  // Balanceador TCP (RSI)
  net.createServer((cSocket) => {
    const node = getBestNode();
    const start = Date.now();
    node.activeConnections++;
    const sSocket = net.connect(config.services.RSI, node.host, () => {
      cSocket.pipe(sSocket);
      sSocket.pipe(cSocket);
    });
    cSocket.on('close', () => {
      node.activeConnections--;
      node.latency = Date.now() - start;
      node.totalRequests++;
      console.log(`[BALANCER] TCP/RSI derivado a -> ${node.id}`);
    });
    sSocket.on('error', () => cSocket.end());
    cSocket.on('error', () => sSocket.end());
  }).listen(8001, '0.0.0.0');

  console.log("\nBALANCEADOR ONLINE | HTTP: 8000 | RSI: 8001");
}

// Ejecutar la secuencia
initNodes();