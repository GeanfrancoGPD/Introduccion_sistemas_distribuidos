const axios = require('axios');

const SERVERS = [
    { id: "Servidor 1", url: "http://localhost:3001" },
    { id: "Servidor 2", url: "http://192.168.1.XX:3002" } 
];

async function selectBestServer() {
    let best = null;
    let maxScore = -1;

    console.log("\n--- Reporte Estadísticas (Notificar) ---");

    for (let s of SERVERS) {
        try {
            const { data } = await axios.get(`${s.url}/status`, { timeout: 800 });
            
            let score = 0;
            score += (data.cpuSpeed * 0.20);            
            score += (data.memFree / 1e9 * 0.10);         
            score += (data.diskType.includes('SSD') ? 30 : 10); 
            score += (100 - data.processTime) * 0.40;     
            console.log(`> ${s.id}: Score total: ${score.toFixed(2)}`);

            if (score > maxScore) {
                maxScore = score;
                best = s;
            }
        } catch (e) { console.log(`> ${s.id}: Inalcanzable.`); }
    }
    return best;
}

module.exports = { selectBestServer };