export async function ExecuteRest(host, method, params = []) {
  const port = this.getServicePort("REST", 3001);
  console.log(
    "[REST]Nuevo servicio .....Port:",
    port,
    "Host:",
    host,
    "Metodo:",
    method,
    "Params:",
    params,
  );

  const response = await fetch(`http://${host}:${port}/calculadora/methods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });

  const data = await response.json();
  return data;
}

export async function HttpPostJson(url, body, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(parsed?.error || `HTTP ${response.status} en ${url}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
