import express from "express";

const app = express();
const Port = 8081;
app.use(express.json());

app.get("/api/:serviceName/:method", (req, res) => {
  const serviceName = req.params.serviceName;
  const method = req.params.method;
  const params = req.body;

  res.json({
    result: "Success",
    serviceName,
    method,
    params,
  });
});

app.post("/api/:serviceName/:method", (req, res) => {
  const serviceName = req.params.serviceName;
  const method = req.params.method;
  const params = req.body.params;
  console.log(
    "Nombre del servicio:",
    serviceName,
    "| metodo:",
    method,
    "| parametro:",
    params,
  );

  fetch(`http://localhost:8000/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ serviceName, method, params }),
  })
    .then((response) => response.json())
    .then((data) => {
      let result = data.result;

      console.log("Resultado del servicio:", result);
      res.json({ result });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

app.listen(Port, "0.0.0.0", () =>
  console.log("[GATEWAY] corriendo en " + Port),
);

// let mango = new Map();
// mango.set("host", "localhost");
// console.log(mango.get("host"));
// console.log(mango.has("192.168.0.1"));
