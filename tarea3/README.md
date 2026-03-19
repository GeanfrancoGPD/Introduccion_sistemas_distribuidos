# Load Balancer Dinámico Multi-Tecnología

Este proyecto es un sistema de balanceo de carga dinámico desarrollado en **Node.js**, diseñado para distribuir tareas entre múltiples nodos (PCs) basándose en métricas de hardware y rendimiento en tiempo real.

## Tecnologías Implementadas

El sistema expone 4 servicios distintos, cada uno utilizando una arquitectura de comunicación diferente:

1.  **REST (Calculadora):** Microservicio HTTP para operaciones matemáticas simples.
2.  **JSON-RPC (Refugio de Animales):** Gestión de datos estructurados (CRUD) para procesos de adopción.
3.  **MQTT (Lorem Ipsum):** Generador de tráfico masivo para pruebas de saturación de red.
4.  **RSI (Ahorcado):** _Remote Subroutine Invocation_ sobre TCP para lógica de estado (Juego del Ahorcado).

---

## Algoritmo de Balanceo (Hardware-Aware)

El balanceador elige el mejor nodo calculando un **Score de Aptitud** basado en:

- **Specs:** CPU (GHz), RAM (GB) y Tipo de Disco (SSD/HDD).
- **Rendimiento:** Latencia (ms) y Conexiones Activas.

---

## Guía de Arranque del Proyecto (PowerShell)

Siga estos pasos para ejecutar el sistema correctamente en su entorno local o en red utilizando **PowerShell**.

### 1. Requisitos Previos

Asegúrese de tener instalado [Node.js](https://nodejs.org/). Instale las dependencias necesarias abriendo una terminal en la carpeta del proyecto:

```powershell
npm install http-proxy jayson mqtt

2. Iniciar todos los Servicios

Para arrancar el balanceador y los 4 servicios tecnológicos en ventanas independientes, copie y pegue el siguiente comando:

Start-Process node agent.js 4000; Start-Process node agent.js 4001; Start-Process node balancer/balancer.js; Start-Process node calculadora/servidores/server.js; Start-Process node calculadora/service_rest.js; Start-Process node refugio/server.js; Start-Process node refugio/service_jsonrpc.js; Start-Process node lorem_ipsum/service_mqtt.js; Start-Process node ahorcado/service_rsi.js

3. Iniciar el Cliente de Estrés (Prueba Infinita)
Para ver al sistema balancear carga en tiempo real, ejecute el cliente en su terminal principal:

node client_infinite.js

4. Detener la Prueba y Ver Estadísticas
Para finalizar la prueba de carga:

Presione Ctrl + C en la terminal donde corre el cliente.

Automáticamente se mostrará una tabla con el resumen de Total de Peticiones y Latencia por cada PC.

5. Detener todos los Servicios (Limpieza)
Si desea cerrar todas las ventanas de los servicios y detener el balanceador de golpe, ejecute:

Stop-Process -Name node -Force

📊 Monitoreo y Configuración
Web Stats: Puede consultar el estado de los nodos en vivo en: http://localhost:8000/stats
```
