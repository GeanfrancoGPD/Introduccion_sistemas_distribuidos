import fs from "fs";
import path from "path";

export default function generateClient(content) {
  const dir = content.path || "./clientes";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  // clientConnect
  const connectCode = `
import net from "net";

export default function sendRequest(payload) {
return new Promise((resolve, reject) => {
    const client = net.createConnection(
        { port: 5000 },
        () => client.write(JSON.stringify(payload))
    );

    client.on("data", data => {
        resolve(JSON.parse(data.toString()));
        client.end();
    });

    client.on("error", reject);
    });
};
`;

  fs.writeFileSync(path.join(dir, "clientConnect.js"), connectCode);

  // Proxy
  let proxyCode = `
import sendRequest from "./clientConnect.js";\n\n

export default class Proxy${content.className} {\n`;

  for (const m of content.methods) {
    proxyCode += `
async ${m.name}(${m.params.join(", ")}) {
    const res = await sendRequest({
    method: "${m.name}",
    params: [${m.params.join(", ")}]
    });
    return res.result;
}\n`;
  }

  proxyCode += `
}


`;

  fs.writeFileSync(path.join(dir, `proxy${content.className}.js`), proxyCode);
}
