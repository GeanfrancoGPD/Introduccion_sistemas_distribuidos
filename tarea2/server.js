import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Cargar el archivo .proto
const packageDef = loadSync("refugio.proto", { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta a la base de datos JSON
const DB_FILE = join(__dirname, "perros.json");

class RefugioServer {
  constructor() {
    this.server = new Server();
    this.server.addService(refugioProto.RefugioService.service, {
      ObtenerPerros: this.obtenerPerros.bind(this),
      AdoptarPerro: this.adoptarPerro.bind(this),
    });
    this.data = this.leerBD();
  }

  start() {
    this.server.bindAsync(
      "127.0.0.1:50051",
      ServerCredentials.createInsecure(),
      () => {
        console.log(
          "Servidor gRPC del Refugio corriendo en el puerto 50051...",
        );
      },
    );
  }

  leerBD() {
    const data = readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  }

  // Guardar datos

  guardarBD(data) {
    writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  // Implementación del servicio ObtenerPerros
  obtenerPerros(call, callback) {
    const perros = this.data;
    console.log(perros);

    const disponibles = perros.filter((p) => p.disponible);
    return callback(null, { perros: disponibles });
  }

  // Implementación del servicio AdoptarPerro
  adoptarPerro(call, callback) {
    const perros = this.data;
    const id = call.request.id_perro; // ahora sí llega
    console.log("[Servidor] ID recibido:", id);

    const index = perros.findIndex((p) => p.id === id);

    if (index !== -1 && perros[index].disponible) {
      perros[index].disponible = false; // Actualizar estado
      this.data = perros; // Actualizar this.data
      this.guardarBD(this.data); // Persistir el cambio

      console.log(
        `[Servidor] ¡${perros[index].nombre} ha sido adoptado! Base de datos actualizada.`,
      );
      callback(null, {
        exito: true,
        mensaje: `Adopción de ${perros[index].nombre} confirmada con éxito.`,
      });
    } else {
      console.log(`[Servidor] Intento de adopción fallido para el ID: ${id}`);
      callback(null, {
        exito: false,
        mensaje: "El perro no está disponible o el ID no existe.",
      });
    }
  }
}

const server = new RefugioServer();
server.start();
