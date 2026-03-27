// PRUEBA para rest
const prueba = await fetch("http://localhost:8081/api/REST/sumar", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ params: [2, 2] }),
});

let dataresult = await prueba.json();
console.log(dataresult.result);

//Prueba para GRPC

// const prueba = await fetch("http://localhost:8081/api/JSON_RPC/ObtenerPerros", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//   },
//   body: JSON.stringify({ params: {} }),
// });

// let dataresult = await prueba.json();
// console.log(dataresult.result);

//Prueba para MQTT
// const prueba = await fetch("http://localhost:8081/api/MQTT/saludar", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//   },
//   body: JSON.stringify({ params: { nombre: "Juan" } }),
// });

// let dataresult = await prueba.json();
// console.log(dataresult.result);

//Prueba para RSI
// const jugar = await fetch("http://localhost:8081/api/RSI/iniciar", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//   },
//   body: JSON.stringify({ params: {} }),
// });

// let jugar_2 = await jugar.json();
// console.log(jugar_2.result);

// const prueba = await fetch("http://localhost:8081/api/RSI/jugar", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//   },
//   body: JSON.stringify({ params: { id: jugar_2.result.id, letra: "a" } }),
// });

// let dataresult = await prueba.json();
// console.log(dataresult.result);
