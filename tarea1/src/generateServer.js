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
import net from "net";
import ${content.className} from "./${content.className}.js";

const instance = new ${content.className}();

const server = net.createServer(socket => {
socket.on("data", data => {
    const req = JSON.parse(data.toString());
    const { method, params } = req;

    if (typeof instance[method] === "function") {
        const result = instance[method](...params);
        socket.write(JSON.stringify({ result }));
    } else {
        socket.write(JSON.stringify({ error: "Método no existe" }));
    }
    });
});

server.listen(5000, () => {
    console.log("Servidor escuchando en 5000");
});
    `;

  fs.writeFileSync(path.join(dir, "server.js"), serverCode);
}
