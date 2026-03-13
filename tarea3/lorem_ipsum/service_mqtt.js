const mqtt = require('mqtt');

console.log("[MQTT] Iniciando servicio... buscando broker publico.");
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log("[MQTT] Conectado exitosamente al broker publico.");
  
  setInterval(() => {
    const msg = "Lorem Ipsum dolor sit amet...";
    console.log(`[MQTT] Publicando rafaga: ${msg}`);
    client.publish('universidad/tarea3/lorem', msg);
  }, 1000);
});

client.on('error', (err) => {
  console.log("[MQTT] Error de conexion:", err.message);
});