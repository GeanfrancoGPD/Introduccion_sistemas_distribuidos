import http from 'http';
import { loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import grpc from "@grpc/grpc-js";

const packageDef = loadSync("refugio.proto", { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

// Conectar al servidor gRPC
const client = new refugioProto.RefugioService(
  "127.0.0.1:50051",
  grpc.credentials.createInsecure()
);

http.createServer((req, res) => {
  // Generamos un ID aleatorio del 1 al 4
  const idAleatorio = Math.floor(Math.random() * 4) + 1;

  client.AdoptarPerro({ id_perro: idAleatorio }, (err, response) => {
    if (err) {
      console.error(`[GATEWAY] Error gRPC intentando adoptar ID ${idAleatorio}:`, err.message);
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
    
    // Imprimimos el log explicito de lo que respondio el servidor
    const status = response.exito ? "EXITO" : "FALLO";
    console.log(`[GATEWAY HTTP->gRPC] Peticion ID ${idAleatorio} -> ${status}: ${response.mensaje}`);
    
    res.end(JSON.stringify({ resultado: response }));
  });
}).listen(3002, '0.0.0.0', () => console.log("[GATEWAY] Refugio HTTP->gRPC escuchando en puerto 3002..."));