const gatewayHost =
  process.env.GATEWAY_HOST || process.env.GATEWAY_IP || "192.168.88.176";
const gatewayPort = process.env.GATEWAY_PORT || "8081";
const gatewayBaseUrl =
  process.env.GATEWAY_URL || `http://${gatewayHost}:${gatewayPort}`;

const totalRequests = Number(process.env.TOTAL_REQUESTS || 10000);
const concurrency = Number(process.env.CONCURRENCY || 50);
const serviceName = process.env.SERVICE_NAME || "REST";
const methodName = process.env.METHOD_NAME || "sumar";

// Para REST se espera arreglo en params. Para otros servicios puedes pasar JSON por PAYLOAD.
const payloadFromEnv = process.env.PAYLOAD;
const params = payloadFromEnv ? JSON.parse(payloadFromEnv) : [2, 2];

let completed = 0;
let success = 0;
let failed = 0;
let totalLatencyMs = 0;
let minLatencyMs = Number.POSITIVE_INFINITY;
let maxLatencyMs = 0;
const errors = new Map();

function trackError(message) {
  const count = errors.get(message) || 0;
  errors.set(message, count + 1);
}

async function sendOne(index) {
  const url = `${gatewayBaseUrl}/api/${serviceName}/${methodName}`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params }),
    });

    const body = await response.json().catch(() => ({}));
    const latency = Date.now() - start;

    totalLatencyMs += latency;
    if (latency < minLatencyMs) minLatencyMs = latency;
    if (latency > maxLatencyMs) maxLatencyMs = latency;

    if (!response.ok) {
      failed++;
      trackError(body?.error || `HTTP ${response.status}`);
    } else {
      success++;
    }
  } catch (error) {
    failed++;
    trackError(error?.cause?.code || error.message || "Error desconocido");
  } finally {
    completed++;
    if (index % 1000 === 0 || completed === totalRequests) {
      console.log(`Progreso: ${completed}/${totalRequests}`);
    }
  }
}

async function runLoad() {
  console.log("----- Cliente de Carga -----");
  console.log("Gateway:", gatewayBaseUrl);
  console.log("Servicio:", serviceName);
  console.log("Metodo:", methodName);
  console.log("Params:", params);
  console.log("Total requests:", totalRequests);
  console.log("Concurrencia:", concurrency);

  const runStart = Date.now();
  let nextIndex = 1;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex++;

      if (current > totalRequests) {
        return;
      }

      await sendOne(current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await Promise.all(workers);

  const totalTimeMs = Date.now() - runStart;
  const avgLatency =
    completed > 0 ? (totalLatencyMs / completed).toFixed(2) : 0;
  const rps =
    totalTimeMs > 0 ? ((completed * 1000) / totalTimeMs).toFixed(2) : 0;

  console.log("\n----- Resumen -----");
  console.log("Completadas:", completed);
  console.log("Exitosas:", success);
  console.log("Fallidas:", failed);
  console.log("Tiempo total (ms):", totalTimeMs);
  console.log("Latencia promedio (ms):", avgLatency);
  console.log(
    "Latencia minima (ms):",
    Number.isFinite(minLatencyMs) ? minLatencyMs : 0,
  );
  console.log("Latencia maxima (ms):", maxLatencyMs);
  console.log("Requests por segundo:", rps);

  if (errors.size > 0) {
    console.log("\nErrores detectados:");
    for (const [message, count] of errors.entries()) {
      console.log(`- ${message}: ${count}`);
    }
  }
}

runLoad().catch((error) => {
  console.error("Error fatal en cliente de carga:", error);
  process.exitCode = 1;
});
