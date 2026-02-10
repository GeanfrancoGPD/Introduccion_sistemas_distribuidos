
import net from "net";
import Calculadora from "./Calculadora.js";

const instance = new Calculadora();

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
    