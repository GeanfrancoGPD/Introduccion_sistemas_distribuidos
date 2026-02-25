const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Cargar el archivo .proto
const packageDef = protoLoader.loadSync("refugio.proto", {});
const refugioProto = grpc.loadPackageDefinition(packageDef).refugio;

// Conectar al servidor
const client = new refugioProto.RefugioService(
  '127.0.0.1:50051',
  grpc.ServerCredentials.createInsecure()
);

console.log("Conectando al servidor del refugio...\n");

// 1. Obtener la lista de perros disponibles
client.obtenerPerros({}, (err, response) => {
  if (err) {
    console.error("Error al obtener la lista:", err.message);
    return;
  }
  
  console.log("--- Perros Disponibles en el Refugio ---");
  if (response.perros && response.perros.length > 0) {
    response.perros.forEach(p => {
      console.log(`ID: ${p.id} | Nombre: ${p.nombre} | Raza: ${p.raza}`);
    });
  } else {
    console.log("No hay perros disponibles en este momento.");
  }

  // 2. Intentar adoptar un perro (cambia el ID aquí para probar distintos escenarios)
  const idParaAdoptar = 1; 
  console.log(`\nSolicitando adopción del perro con ID: ${idParaAdoptar}...`);
  
  client.adoptarPerro({ id_perro: idParaAdoptar }, (err, res) => {
    if (err) {
      console.error("Error en la solicitud de adopción:", err.message);
      return;
    }
    
    if (res.exito) {
      console.log("✅ RESPUESTA DEL SERVIDOR:", res.mensaje);
    } else {
      console.log("❌ RESPUESTA DEL SERVIDOR:", res.mensaje);
    }
  });
});