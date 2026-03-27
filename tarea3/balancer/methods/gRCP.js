import {
  loadPackageDefinition,
  credentials as grpcCredentials,
} from "@grpc/grpc-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadSync } from "@grpc/proto-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const protoPath = join(__dirname, "refugio.proto");
const packageDef = loadSync(protoPath, { keepCase: true });
const refugioProto = loadPackageDefinition(packageDef).refugio;

export async function GetRefugioMetrics(host, port) {
  return new Promise((resolve, reject) => {
    const client = new refugioProto.RefugioService(
      `${host}:${port}`,
      grpcCredentials.createInsecure(),
    );

    client.ObtenerMetricas({}, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}

export async function ExecuteRefugio(host, method, params = {}) {
  const port = this.getServicePort("REFUGIO", 5051);
  const client = new refugioProto.RefugioService(
    `${host}:${port}`,
    grpcCredentials.createInsecure(),
  );

  console.log("En ejecucion de metodo gRPC");
  console.log("Port:", port);
  console.log("Host:", host);
  console.log("Metodo:", method);
  console.log("Params:", params);

  const mapMethods = {
    ObtenerPerros: () =>
      new Promise((resolve, reject) => {
        client.ObtenerPerros({}, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      }),
    AdoptarPerro: () =>
      new Promise((resolve, reject) => {
        client.AdoptarPerro(params, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      }),
    ObtenerMetricas: () =>
      new Promise((resolve, reject) => {
        client.ObtenerMetricas({}, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      }),
  };

  if (!mapMethods[method]) {
    throw new Error(`Metodo gRPC no soportado: ${method}`);
  } else {
    console.log(`Ejecutando metodo gRPC: ${method}`);
  }

  let result = await mapMethods[method]();
  console.log("Resultado del metodo gRPC:", result);

  return result;
}
