import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import os from "os";

// Cargar el archivo .proto
const packageDef = loadSync("./refugio/refugio.proto", { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceStart = Date.now();

// Ruta a la base de datos JSON
const DB_FILE = join(__dirname, "perros.json");

class RefugioServer {
  constructor() {
    this.server = new Server();
    this.server.addService(refugioProto.RefugioService.service, {
      ObtenerPerros: this.obtenerPerros.bind(this),
      AdoptarPerro: this.adoptarPerro.bind(this),
      ObtenerMetricas: this.obtenerMetricas.bind(this),
    });
    this.data = this.leerBD();
    this.Port = 5051;
  }

  start() {
    this.server.bindAsync(
      `127.0.0.1:${this.Port}`,
      ServerCredentials.createInsecure(),
      () => {
        console.log(
          `Servidor gRPC del Refugio corriendo en el puerto ${this.Port}...`,
        );
      },
    );
  }

  leerBD() {
    const data = readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  }

  guardarBD(data) {
    writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  }

  // NUEVO: Método para reiniciar la base de datos a su estado original
  reiniciarBD() {
    const inicial = [
      { id: 1, nombre: "Rex", raza: "Pastor Alemán", disponible: true },
      { id: 2, nombre: "Toby", raza: "Golden Retriever", disponible: true },
      { id: 3, nombre: "Luna", raza: "Husky", disponible: true },
      { id: 4, nombre: "Max", raza: "Bulldog", disponible: true },
    ];
    this.data = inicial;
    this.guardarBD(this.data);
    console.log(
      "[Servidor] !!! TODOS ADOPTADOS - REINICIANDO BASE DE DATOS !!!",
    );
  }

  // Implementación del servicio ObtenerPerros
  obtenerPerros(call, callback) {
    const perros = this.data;
    console.log("[Servidor] Consultando lista de perros...");

    const disponibles = perros.filter((p) => p.disponible);
    return callback(null, { perros: disponibles });
  }

  // Implementación del servicio AdoptarPerro
  adoptarPerro(call, callback) {
    const perros = this.data;
    const id = call.request.id_perro;
    console.log("[Servidor] ID recibido para adopción:", id);

    const index = perros.findIndex((p) => p.id === id);

    if (index !== -1 && perros[index].disponible) {
      perros[index].disponible = false; // Actualizar estado
      this.data = perros; // Actualizar this.data
      this.guardarBD(this.data); // Persistir el cambio

      console.log(
        `[Servidor] ¡${perros[index].nombre} ha sido adoptado! Base de datos actualizada.`,
      );

      // NUEVO: Validación de reinicio infinito
      if (this.data.every((p) => !p.disponible)) {
        this.reiniciarBD();
      }

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

  obtenerMetricas(call, callback) {
    const metrics = {
      service: "refugio",
      uptime_seconds: Math.floor((Date.now() - serviceStart) / 1000),
      cpu_usage: os.loadavg(),
      free_memory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(3),
      total_memory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(3),
      perros_disponibles: this.data.filter((p) => p.disponible).length,
    };

    callback(null, metrics);
  }
}

const server = new RefugioServer();
server.start();
