const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const path = require('path');

// Cargar el archivo .proto
const packageDef = protoLoader.loadSync("refugio.proto", {});
const refugioProto = grpc.loadPackageDefinition(packageDef).refugio;

// Ruta a la base de datos JSON
const DB_FILE = path.join(__dirname, 'perros.json');

// Leer datos
function leerBD() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

// Guardar datos
function guardarBD(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Implementación del servicio ObtenerPerros
function obtenerPerros(call, callback) {
  const perros = leerBD();
  const disponibles = perros.filter(p => p.disponible);
  callback(null, { perros: disponibles });
}

// Implementación del servicio AdoptarPerro
function adoptarPerro(call, callback) {
  const perros = leerBD();
  const id = call.request.id_perro;
  
  const index = perros.findIndex(p => p.id === id);

  if (index !== -1 && perros[index].disponible) {
    perros[index].disponible = false; // Actualizar estado
    guardarBD(perros); // Persistir el cambio
    
    console.log(`[Servidor] ¡${perros[index].nombre} ha sido adoptado! Base de datos actualizada.`);
    callback(null, { exito: true, mensaje: `Adopción de ${perros[index].nombre} confirmada con éxito.` });
  } else {
    console.log(`[Servidor] Intento de adopción fallido para el ID: ${id}`);
    callback(null, { exito: false, mensaje: "El perro no está disponible o el ID no existe." });
  }
}

// Iniciar servidor
const server = new grpc.Server();
server.addService(refugioProto.RefugioService.service, {
  obtenerPerros: obtenerPerros,
  adoptarPerro: adoptarPerro
});

server.bindAsync('127.0.0.1:50051', grpc.ServerCredentials.createInsecure(), () => {
  console.log("Servidor gRPC del Refugio corriendo en el puerto 50051...");
  server.start();
});