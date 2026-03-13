const net = require('net');

class Ahorcado {
  constructor() {
    this.lista = ["SISTEMAS", "NODOS", "JAVASCRIPT", "REDES"];
    this.reset();
  }
  reset() {
    this.p = this.lista[Math.floor(Math.random() * this.lista.length)];
    this.l = [];
    this.v = 6;
    console.log(`\n[RSI] --- NUEVA PALABRA: ${this.p} ---`);
  }
  play(letra) {
    letra = letra.toUpperCase();
    if (!this.l.includes(letra)) {
      this.l.push(letra);
      if (!this.p.includes(letra)) this.v--;
    }
    const res = this.p.split('').map(x => this.l.includes(x) ? x : "_").join(' ');
    console.log(`[RSI] Letra: ${letra} | Tablero: ${res} | Vidas: ${this.v}`);
    if (!res.includes("_") || this.v <= 0) {
      console.log(this.v > 0 ? "[RSI] GANÓ" : "[RSI] PERDIÓ");
      this.reset();
    }
    return { res, v: this.v };
  }
}

const game = new Ahorcado();
net.createServer(s => {
  s.on('data', d => {
    const msg = d.toString().trim();
    if (msg.startsWith('play:')) s.write(JSON.stringify(game.play(msg.split(':')[1])));
  });
}).listen(3003, '0.0.0.0');