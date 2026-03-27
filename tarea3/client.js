import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const gatewayHost =
  process.env.GATEWAY_HOST || process.env.GATEWAY_IP || "192.168.88.176";
const gatewayPort = process.env.GATEWAY_PORT || "8081";
const gatewayBaseUrl =
  process.env.GATEWAY_URL || `http://${gatewayHost}:${gatewayPort}`;

const rl = readline.createInterface({ input, output });

function toNumber(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Numero invalido: ${value}`);
  }
  return parsed;
}

async function callGateway(serviceName, method, params = {}) {
  const url = `${gatewayBaseUrl}/api/${serviceName}/${method}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    return payload.result;
  } catch (error) {
    if (error?.cause?.code === "ECONNREFUSED") {
      throw new Error(
        `No se pudo conectar al gateway en ${gatewayBaseUrl}. ` +
          "Revise IP, puerto, firewall y que mygateway.js este levantado.",
      );
    }
    throw error;
  }
}

async function runRest() {
  console.log("\n[REST] Metodos: sumar, restar, multiplicar, division");
  const method = (await rl.question("Metodo REST: ")).trim();
  const a = toNumber((await rl.question("Primer numero: ")).trim());
  const b = toNumber((await rl.question("Segundo numero: ")).trim());

  let params = [a, b];
  if (method === "multiplicar") {
    const cRaw = (
      await rl.question("Tercer numero (opcional, Enter = 1): ")
    ).trim();
    const c = cRaw ? toNumber(cRaw) : 1;
    params = [a, b, c];
  }

  const result = await callGateway("REST", method, params);
  console.log("Resultado REST:", result);
}

async function runJsonRpc() {
  console.log("\n[JSON_RPC] 1) ObtenerPerros  2) AdoptarPerro");
  const option = (await rl.question("Opcion: ")).trim();

  if (option === "1") {
    const result = await callGateway("JSON_RPC", "ObtenerPerros", {});
    console.log("Resultado JSON_RPC:", result);
    return;
  }

  if (option === "2") {
    const idPerro = toNumber(
      (await rl.question("ID del perro a adoptar: ")).trim(),
    );
    const result = await callGateway("JSON_RPC", "AdoptarPerro", {
      id_perro: idPerro,
    });
    console.log("Resultado JSON_RPC:", result);
    return;
  }

  console.log("Opcion invalida.");
}

async function runMqtt() {
  console.log("\n[MQTT] 1) saludar  2) suscribir");
  const option = (await rl.question("Opcion: ")).trim();

  if (option === "1") {
    const nombre = (await rl.question("Nombre: ")).trim() || "Invitado";
    const result = await callGateway("MQTT", "saludar", { nombre });
    console.log("Resultado MQTT:", result);
    return;
  }

  if (option === "2") {
    const topic = (await rl.question("Topic: ")).trim();
    const result = await callGateway("MQTT", "suscribir", { topic });
    console.log("Resultado MQTT:", result);
    return;
  }

  console.log("Opcion invalida.");
}

async function runRsi() {
  const startResult = await callGateway("RSI", "iniciar", {});
  console.log("\nPartida iniciada:", startResult);

  if (!startResult?.id) {
    console.log("No se recibio ID de sesion.");
    return;
  }

  while (true) {
    const letra = (await rl.question("Letra para jugar (o salir): ")).trim();
    if (!letra || letra.toLowerCase() === "salir") {
      break;
    }

    const result = await callGateway("RSI", "jugar", {
      id: startResult.id,
      letra,
    });

    console.log("Resultado RSI:", result);

    if (result?.ganado || result?.perdido || result?.error) {
      break;
    }
  }
}

async function main() {
  console.log("----- Cliente -----");
  console.log("Gateway:", gatewayBaseUrl);

  while (true) {
    console.log("\nSeleccione servicio:");
    console.log("1. REST (Calculadora)");
    console.log("2. JSON_RPC (Refugio)");
    console.log("3. MQTT");
    console.log("4. RSI (Ahorcado)");
    console.log("5. Salir");

    const option = (await rl.question("Opcion: ")).trim();

    try {
      if (option === "1") {
        await runRest();
      } else if (option === "2") {
        await runJsonRpc();
      } else if (option === "3") {
        await runMqtt();
      } else if (option === "4") {
        await runRsi();
      } else if (option === "5") {
        console.log("Cerrando cliente.");
        break;
      } else {
        console.log("Opcion invalida.");
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("Fallo fatal:", error);
  rl.close();
});
