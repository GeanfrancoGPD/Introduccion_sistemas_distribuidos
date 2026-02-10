import fs from "fs";
import path from "path";

export default function generateServer(content) {
  const dir = content.path || "./servidores";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // Para las clases
  let Classcode = `export default class ${content.className} {\n`;

  for (const method of content.methods) {
    Classcode += `  ${method.name}(${method.params.join(", ")}) {\n`;
    Classcode += `    // TODO: Implementar lógica para ${method.name}\n`;
    Classcode += `  }\n`;
  }
  Classcode += `}\n`;

  fs.writeFileSync(path.join(dir, `${content.className}.js`), Classcode);

  // Para el servidor
  const serverCode = `
import { WebSocketServer } from "ws";
import ${content.className} from "./${content.className}.js";

const instance = new ${content.className}();


export default class server {
  constructor() {
    this.socket = new WebSocketServer({ port: 5000 });
  }

  start() {
    this.socket.on("connection", (ws) => {
      console.log("Cliente conectado");
      ws.on("message", (message) => {
        const req = JSON.parse(message);
        const { method, params } = req;
        console.log("Recibido método:", method, "con params:", params);
        if (typeof instance[method] === "function") {
          const result = instance[method](...params);
          console.log("Enviado resultado:", result);
          ws.send(JSON.stringify({ result }));
        } else {
          ws.send(JSON.stringify({ error: "Método no existe" }));
        }
      });
    });

    console.log("Servidor escuchando en 5000");
  }
}

const serverInstance = new server();
serverInstance.start();
`;

  fs.writeFileSync(path.join(dir, "server.js"), serverCode);
}
