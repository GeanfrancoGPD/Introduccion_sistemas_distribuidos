import { createServer } from "net";
import os from "os";

const serviceStart = Date.now();

function createSessionId() {
  return `sess-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

class Ahorcado {
  constructor() {
    this.lista = ["SISTEMAS", "NODOS", "JAVASCRIPT", "REDES"];
    this.reset();
  }

  reset() {
    this.palabra = this.lista[Math.floor(Math.random() * this.lista.length)];
    this.letras = [];
    this.vidas = 6;
  }

  estado() {
    return this.palabra
      .split("")
      .map((l) => (this.letras.includes(l) ? l : "_"))
      .join(" ");
  }

  jugar(letra) {
    letra = letra.toUpperCase();

    if (!this.letras.includes(letra)) {
      this.letras.push(letra);
      if (!this.palabra.includes(letra)) this.vidas--;
    }

    const tablero = this.estado();
    const ganado = !tablero.includes("_");
    const perdido = this.vidas <= 0;

    return {
      tablero,
      vidas: this.vidas,
      ganado,
      perdido,
    };
  }
}

// juegos por cliente
const sessions = new Map();

function getMetrics() {
  return {
    service: "ahorcado-rsi",
    uptimeSeconds: Math.floor((Date.now() - serviceStart) / 1000),
    sesionesActivas: sessions.size,
    cpuUsage: os.loadavg(),
    freeMemory: (os.freemem() / 1024 ** 3).toFixed(3),
    totalMemory: (os.totalmem() / 1024 ** 3).toFixed(3),
  };
}

createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log("[RSI] Cliente conectado:", clientId);

  socket.on("data", (data) => {
    let req;

    try {
      req = JSON.parse(data.toString());
    } catch {
      socket.write(JSON.stringify({ error: "JSON invalido" }));
      return;
    }

    const { method, params = {} } = req;

    // INICIAR PARTIDA
    if (method === "iniciar") {
      const game = new Ahorcado();
      const sessionId = createSessionId();
      sessions.set(sessionId, game);

      socket.write(
        JSON.stringify({
          id: sessionId,
          message: "Partida iniciada",
          tablero: game.estado(),
          vidas: game.vidas,
        }),
      );
      return;
    }

    // JUGAR LETRA
    if (method === "jugar") {
      const game = sessions.get(params.id);
      console.log(params.id, game);

      if (!game) {
        socket.write(JSON.stringify({ error: "No hay partida iniciada" }));
        return;
      }

      const result = game.jugar(params.letra || "A");

      if (result.ganado || result.perdido) {
        sessions.delete(params.id);
      }

      socket.write(JSON.stringify(result));
      return;
    }

    // 🟡 METRICAS
    if (method === "metricas") {
      socket.write(JSON.stringify(getMetrics()));
      return;
    }

    socket.write(JSON.stringify({ error: "Metodo no soportado" }));
  });

  socket.on("close", () => {
    console.log("[RSI] Cliente desconectado:", clientId);
  });
}).listen(3003, "0.0.0.0");

console.log("[RSI] Servidor escuchando en puerto 3003");
