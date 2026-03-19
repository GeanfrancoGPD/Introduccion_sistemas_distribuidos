import { loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import grpc from "@grpc/grpc-js";

// Cargar el archivo .proto
const packageDef = loadSync("refugio.proto", { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

// Conectar al servidor
const client = new refugioProto.RefugioService(
  "127.0.0.1:50051",
  grpc.credentials.createInsecure(),
);

console.log("Conectando al servidor del refugio...\n");

// 1. Obtener la lista de perros disponibles
client.ObtenerPerros({}, (err, response) => {
  if (err) {
    console.error("Error al obtener la lista:", err.message);
    return;
  }

  console.log("--- Perros Disponibles en el Refugio ---");
  if (response.perros && response.perros.length > 0) {
    response.perros.forEach((p) => {
      console.log(`ID: ${p.id} | Nombre: ${p.nombre} | Raza: ${p.raza}`);
    });
  } else {
    console.log("No hay perros disponibles en este momento.");
  }

  // 2. Intentar adoptar un perro (cambia el ID aquí para probar distintos escenarios)
  const id_Perro = 1;
  console.log(`\nSolicitando adopción del perro con ID: ${id_Perro}...`);

  client.AdoptarPerro({ id_perro: id_Perro }, (err, res) => {
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
