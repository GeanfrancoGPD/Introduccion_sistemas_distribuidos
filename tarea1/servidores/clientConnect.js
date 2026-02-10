
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
