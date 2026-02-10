import ProxyCalculadora from "./servidores/proxyCalculadora.js";

async function main() {
  const cli = new ProxyCalculadora();

  const sum = await cli.sumar(17, 3);
  console.log("Resultado de sumar:", sum);

  const res = await cli.restar(5, 3);
  console.log("Resultado de restar:", res);
}

main();
