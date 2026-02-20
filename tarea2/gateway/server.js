const express = require('express');
const { selectBestServer } = require('./balancer');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/api/operacion', async (req, res) => {
    const server = await selectBestServer();
    if (!server) return res.status(503).json({ error: "No hay servidores" });

    try {
        const response = await axios.post(`${server.url}/compute`, req.body);
        res.json({ info: `Atendido por ${server.id}`, data: response.data });
    } catch (e) { res.status(500).send("Error de conexión"); }
});

app.listen(3000, () => console.log("API REST / Balancer en puerto 3000"));