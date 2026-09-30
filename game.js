'use strict';
/* ===== Configuración ===== */
const SIZE = 19;
// start = índice en PATH de la casilla de salida; corner = esquina de la casa
// lane(i) = casillas del camino final; goal = desplazamiento en la meta central
const COLORS = {
  red:    {name:'ROJO',     emoji:'🔴', hex:'#e53935', start:0,  corner:[0,11],  lane:i=>[1+i,9],   goal:[-.3,0], file:'ficha-roja.png'},
  green:  {name:'VERDE',    emoji:'🟢', hex:'#16a34a', start:17, corner:[11,11], lane:i=>[9,17-i],  goal:[0,.3],  file:'ficha-verde.png'},
  blue:   {name:'AZUL',     emoji:'🔵', hex:'#1e88e5', start:51, corner:[0,0],   lane:i=>[9,1+i],   goal:[0,-.3], file:'ficha-azul.png'},
  yellow: {name:'AMARILLO', emoji:'🟡', hex:'#e6b31e', start:34, corner:[11,0],  lane:i=>[17-i,9],  goal:[.3,0],  file:'ficha-amarilla.png'}
};
const SETUP = {2:['red','blue'], 3:['red','green','blue'], 4:['red','green','blue','yellow']};
const SAFE = new Set([0,7,12,17,24,29,34,41,46,51,58,63]); // casillas 1,8,13,18,25,30,35,42,47,52,59,64
const GOAL = 71;       // pos 0-63 recorrido, 64-70 camino final, 71 meta
const EXIT_ROLL = 5;

// Recorrido principal: 68 casillas (x,y) en rejilla de 19x19. PATH[0] = casilla nº 1
const PATH = [];
const add = (x, y) => PATH.push([x, y]);
for (let x=4;x<=7;x++) add(x,10);
for (let y=11;y<=18;y++) add(8,y);
add(9,18);
for (let y=18;y>=11;y--) add(10,y);
for (let x=11;x<=18;x++) add(x,10);
add(18,9);
for (let x=18;x>=11;x--) add(x,8);
for (let y=7;y>=0;y--) add(10,y);
add(9,0);
for (let y=0;y<=7;y++) add(8,y);
for (let x=7;x>=0;x--) add(x,8);
add(0,9);
for (let x=0;x<=3;x++) add(x,10);

/* ===== Assets con fallback ===== */
function loadAsset(path) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(path);
    img.onerror = () => res(null);   // si no existe, se usa el dibujo CSS
    img.src = path;
  });
}
async function applyAssets() {
  const root = document.documentElement.style;
  const board = await loadAsset('assets/tablero.png');
  if (board) { const b = document.getElementById('board'); b.classList.add('has-img'); b.style.backgroundImage = `url(${board})`; }
  const dice = await loadAsset('assets/dado.png');
  if (dice) { root.setProperty('--img-dice', `url(${dice})`); Game.diceImg = true; }
  for (const c in COLORS) {
    const p = await loadAsset('assets/' + COLORS[c].file);
    if (p) { root.setProperty('--img-' + c, `url(${p})`); document.body.classList.add('img-' + c); }
  }
}

/* ===== Sonido (estructura preparada, sin archivos externos) ===== */
function beep(f, d) {
  try {
    const a = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = f; g.gain.value = .05; o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + d);
  } catch (e) {}
}
const playDiceSound = () => beep(220, .15);
const playMoveSound = () => beep(440, .06);
const playCaptureSound = () => beep(120, .35);
const playWinSound = () => { beep(523,.2); setTimeout(()=>beep(784,.4),200); };

/* ===== Clases ===== */
class Piece {
  constructor(player, id) { this.player = player; this.id = id; this.pos = -1; this.el = null; }
  get color() { return this.player.color; }
  get atHome() { return this.pos === -1; }
  get done() { return this.pos === GOAL; }
  get onTrack() { return this.pos >= 0 && this.pos <= 63; }
  get trackIndex() { return (COLORS[this.color].start + this.pos) % 68; }
}
class Player {
  constructor(color) { this.color = color; this.pieces = [0,1,2,3].map(i => new Piece(this, i)); }
  get goalCount() { return this.pieces.filter(p => p.done).length; }
}

class Board {
  constructor(el) { this.el = el; }
  place(div, x, y, w = 1, h = 1) {
    const u = 100 / SIZE;
    Object.assign(div.style, {left:x*u+'%', top:y*u+'%', width:w*u+'%', height:h*u+'%'});
    this.el.appendChild(div);
  }
  build() {
    this.el.innerHTML = '';
    const mk = (cls, txt) => { const d = document.createElement('div'); d.className = cls; if (txt) d.textContent = txt; return d; };
    for (const c in COLORS) {
      const [cx, cy] = COLORS[c].corner;
      this.place(mk('corner ' + c), cx, cy, 8, 8);
      for (let i = 0; i < 4; i++) this.place(mk('spot'), cx + 1.8 + (i%2)*3 + .2, cy + 1.8 + Math.floor(i/2)*3 + .2, 1.6, 1.6);
    }
    PATH.forEach(([x, y], i) => {
      let cls = 'cell';
      if (SAFE.has(i)) cls += ' safe';
      for (const c in COLORS) if (COLORS[c].start === i) cls += ' start ' + c;
      this.place(mk(cls, i + 1), x, y);
    });
    for (const c in COLORS) for (let i = 0; i < 7; i++) {
      const [x, y] = COLORS[c].lane(i); this.place(mk('cell lane ' + c), x, y);
    }
    this.place(mk('center'), 8, 8, 3, 3);
  }
  // Coordenadas lógicas (centro de casilla) de una ficha según su posición
  coord(piece) {
    const c = COLORS[piece.color];
    if (piece.atHome) { const [cx, cy] = c.corner; return [cx + 2.5 + (piece.id%2)*3, cy + 2.5 + Math.floor(piece.id/2)*3]; }
    if (piece.onTrack) { const [x, y] = PATH[piece.trackIndex]; return [x + .5, y + .5]; }
    if (piece.pos < GOAL) { const [x, y] = c.lane(piece.pos - 64); return [x + .5, y + .5]; }
    const s = (piece.id - 1.5) * .3;   // separa las fichas dentro de la meta
    return [9.5 + c.goal[0]*2 + (c.goal[0] ? 0 : s), 9.5 + c.goal[1]*2 + (c.goal[0] ? s : 0)];
  }
}

class Dice {
  constructor(el) { this.el = el; this.value = 0; this.show(1); }
  roll() { return 1 + Math.floor(Math.random() * 6); }
  show(v) {
    this.value = v;
    const P = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[v];
    this.el.classList.toggle('img', !!Game.diceImg);
    this.el.innerHTML = '';
    for (let i = 0; i < 9; i++) { const d = document.createElement('div'); if (P.includes(i)) d.className = 'pip'; this.el.appendChild(d); }
  }
}

/* ===== Juego ===== */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const Game = {
  diceImg: false, players: [], current: 0, rolled: 0, phase: 'idle', valid: [], n: 2,

  init() {
    this.board = new Board($('board'));
    this.dice = new Dice($('die'));
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => this.show(b.dataset.go));
    document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => this.start(+b.dataset.n));
    $('rollBtn').onclick = () => this.roll();
    $('quitBtn').onclick = () => { this.phase = 'idle'; this.show('menu'); };
    $('again').onclick = () => this.start(this.n);
    $('toMenu').onclick = () => this.show('menu');
    applyAssets();
  },
  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  },
  start(n) {
    this.n = n; this.players = SETUP[n].map(c => new Player(c));
    this.current = 0; this.rolled = 0; this.phase = 'roll';
    this.board.build();
    this.players.forEach(pl => pl.pieces.forEach(pc => {
      const el = document.createElement('div'); el.className = 'piece';
      el.innerHTML = `<div class="pc ${pl.color}"></div>`;
      el.onclick = () => this.choose(pc);
      pc.el = el; this.board.el.appendChild(el);
    }));
    this.show('game'); this.renderPieces(); this.updateUI();
    this.setStatus('Pulsa «Lanzar dado» para empezar.');
  },
  get player() { return this.players[this.current]; },

  renderPieces() {
    const groups = {};
    this.players.forEach(pl => pl.pieces.forEach(pc => {
      const [x, y] = this.board.coord(pc);
      (groups[x + ',' + y] = groups[x + ',' + y] || []).push([pc, x, y]);
    }));
    for (const k in groups) {
      const g = groups[k];
      g.forEach(([pc, x, y], i) => {
        if (g.length > 1 && !pc.atHome) { const a = Math.PI * 2 * i / g.length; x += Math.cos(a) * .22; y += Math.sin(a) * .22; }
        pc.el.style.left = x * 100 / SIZE + '%'; pc.el.style.top = y * 100 / SIZE + '%';
      });
    }
  },
  updateUI() {
    const c = COLORS[this.player.color];
    $('turn').textContent = 'Turno de ' + c.name; $('turn').style.setProperty('--tc', c.hex);
    $('rollBtn').disabled = this.phase !== 'roll';
    $('score').innerHTML = this.players.map((pl, i) => {
      const k = COLORS[pl.color];
      return `<div class="${i === this.current ? 'cur' : ''}" style="--k:${k.hex}"><span>${k.emoji} ${k.name}</span><span>Meta: ${pl.goalCount}/4</span></div>`;
    }).join('');
  },
  setStatus(t) { $('status').textContent = t; },
  toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 1400); },

  canMove(pc, r) {
    if (pc.done) return false;
    if (pc.atHome) return r === EXIT_ROLL;
    return pc.pos + r <= GOAL;
  },
  async roll() {
    if (this.phase !== 'roll') return;
    this.phase = 'rolling'; this.updateUI(); playDiceSound();
    const d = $('die'); d.classList.add('rolling');
    for (let i = 0; i < 6; i++) { this.dice.show(this.dice.roll()); await sleep(70); }
    d.classList.remove('rolling');
    const r = this.dice.roll(); this.dice.show(r); this.rolled = r;
    $('result').textContent = 'Resultado: ' + r;
    this.valid = this.player.pieces.filter(p => this.canMove(p, r));
    if (!this.valid.length) {
      this.setStatus(r === EXIT_ROLL ? 'No hay movimientos posibles.' : 'Sin movimientos posibles. Necesitas un 5 para sacar ficha.');
      this.phase = 'wait'; await sleep(1300); return this.endTurn();
    }
    this.phase = 'select';
    this.valid.forEach(p => p.el.classList.add('movable'));
    if (this.valid.length === 1) { this.setStatus('Único movimiento posible…'); await sleep(600); this.choose(this.valid[0]); }
    else this.setStatus('Elige una ficha resaltada.');
  },
  choose(pc) {
    if (this.phase !== 'select' || !this.valid.includes(pc)) return;
    this.phase = 'moving';
    this.valid.forEach(p => p.el.classList.remove('movable'));
    this.move(pc, this.rolled);
  },
  async move(pc, r) {
    pc.el.classList.add('moving');
    if (pc.atHome) { pc.pos = 0; playMoveSound(); this.renderPieces(); await sleep(300); }
    else for (let i = 0; i < r; i++) { pc.pos++; playMoveSound(); this.renderPieces(); await sleep(190); }
    pc.el.classList.remove('moving');
    let captured = false;
    if (pc.onTrack && !SAFE.has(pc.trackIndex)) {
      for (const pl of this.players) if (pl !== pc.player) for (const e of pl.pieces)
        if (e.onTrack && e.trackIndex === pc.trackIndex) { this.sendHome(e); captured = true; }
    }
    if (captured) { playCaptureSound(); this.toast('¡FICHA CAPTURADA!'); this.renderPieces(); await sleep(700); }
    this.updateUI();
    if (this.player.goalCount === 4) return this.win();
    if (pc.done) this.toast('¡Ficha en la meta!');
    this.endTurn();
  },
  sendHome(p) {
    p.pos = -1; p.el.classList.add('captured');
    setTimeout(() => p.el.classList.remove('captured'), 600);
  },
  endTurn() {
    this.current = (this.current + 1) % this.players.length;
    this.phase = 'roll'; this.rolled = 0; this.valid = [];
    $('result').textContent = '–';
    this.updateUI(); this.renderPieces();
    this.setStatus('Lanza el dado.');
  },
  win() {
    this.phase = 'over'; playWinSound();
    $('winTitle').textContent = `¡${COLORS[this.player.color].name} HA GANADO!`;
    this.show('game'); $('victory').classList.add('active');
    $('again').onclick = () => { $('victory').classList.remove('active'); this.start(this.n); };
    $('toMenu').onclick = () => { $('victory').classList.remove('active'); this.show('menu'); };
  }
};
window.addEventListener('DOMContentLoaded', () => Game.init());