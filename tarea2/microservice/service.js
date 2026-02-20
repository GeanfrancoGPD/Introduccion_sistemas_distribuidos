const express = require('express');
const si = require('systeminformation');
const app = express();
app.use(express.json());

const PORT = process.argv[2] || 3001;

app.get('/status', async (req, res) => {
    const cpu = await si.cpu();
    const mem = await si.mem();
    const disk = await si.fsSize();
    
    res.json({
        cpuSpeed: cpu.speed,         
        memFree: mem.available,     
        diskType: disk[0].type,     
        processTime: Math.random() * 50 
    });
});

app.post('/compute', (req, res) => {
    const { op, a, b } = req.body;
    let result = 0;
    const ops = {
        'sumar': (x, y) => x + y,
        'restar': (x, y) => x - y,
        'multiplicar': (x, y) => x * y,
        'dividir': (x, y) => y !== 0 ? x / y : 'Error'
    };

    result = ops[op] ? ops[op](a, b) : 'Operación inválida';
    console.log(`✅ ${op} resuelta en puerto ${PORT}`);
    res.json({ result, server: `Puerto ${PORT}` });
});

app.listen(PORT, () => console.log(`Microservicio listo en puerto ${PORT}`));