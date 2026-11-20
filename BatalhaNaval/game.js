"use strict";

// =====================================================================
// Batalha Naval — DinoGames
// =====================================================================

const SIZE = 10;
const LETTERS = "ABCDEFGHIJ";
const FLEET = [
    { name: "Porta-aviões", size: 5, type: "carrier" },
    { name: "Encouraçado", size: 4, type: "battleship" },
    { name: "Cruzador", size: 3, type: "cruiser" },
    { name: "Submarino", size: 3, type: "submarine" },
    { name: "Destróier", size: 2, type: "destroyer" },
];
const ENEMY_DELAY = 750; // ms até a IA atirar
const READY_TEXT = "Frota pronta! Toque num navio para girar ou arraste para mover.";
const DRAG_THRESHOLD = 6; // px de movimento para considerar arrasto (e não toque)
const WINS_KEY = "dinogames-naval-wins";
const SOUND_KEY = "dinogames-naval-sound";
const DIFF_KEY = "dinogames-naval-difficulty";
const STYLE_KEY = "dinogames-naval-ships";
const SCENE_KEY = "dinogames-naval-scene";
const THEME_KEY = "dinogames-naval-theme";

const $ = (id) => document.getElementById(id);
const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
};
const randInt = (n) => Math.floor(Math.random() * n);
const coord = (r, c) => `${LETTERS[r]}${c + 1}`;

// =====================================================================
// Sons (Web Audio, sintetizados)
// =====================================================================

const audio = {
    ctx: null,
    enabled: storage.get(SOUND_KEY) !== "0",

    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
    },

    noise(duration, { freq = 800, q = 0.7, gain = 0.4, type = "lowpass", decay = 6 } = {}) {
        const ctx = this.ensure();
        if (!ctx || !this.enabled) return;
        const length = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * decay);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start();
    },

    tone(freq, duration, { type = "sine", gain = 0.15, slide = 0, delay = 0 } = {}) {
        const ctx = this.ensure();
        if (!ctx || !this.enabled) return;
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.05);
    },

    fire() {
        this.noise(0.25, { freq: 2200, type: "bandpass", q: 1.2, gain: 0.25, decay: 5 });
        this.tone(420, 0.22, { type: "triangle", gain: 0.06, slide: -300 });
    },
    splash() {
        this.noise(0.6, { freq: 1100, gain: 0.35, decay: 5 });
    },
    explosion() {
        this.noise(0.9, { freq: 420, gain: 0.9, decay: 4 });
        this.tone(70, 0.5, { type: "sine", gain: 0.35, slide: -35 });
    },
    sunk() {
        this.noise(1.4, { freq: 260, gain: 0.8, decay: 3 });
        this.tone(220, 0.3, { type: "square", gain: 0.05, delay: 0.15 });
        this.tone(165, 0.45, { type: "square", gain: 0.05, delay: 0.45 });
    },
    sonar() {
        this.tone(1320, 0.5, { type: "sine", gain: 0.05 });
    },
    victory() {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: "triangle", gain: 0.12, delay: i * 0.12 }));
    },
    defeat() {
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, { type: "triangle", gain: 0.12, delay: i * 0.18 }));
    },
};

// =====================================================================
// Desenhos dos navios (vista de cima, proa para a direita)
// viewBox: largura = tamanho * 100, altura = 100
// =====================================================================

const C = {
    hull: "#8796a8",
    deck: "#a9b6c4",
    dark: "#4d5b6b",
    line: "#33404e",
    light: "#d5dee8",
};

// Casco com proa pontiaguda à direita e popa arredondada à esquerda.
const hullPath = (w, top = 20, bottom = 80, r = 12) =>
    `M10 ${top + r} Q10 ${top} ${10 + r} ${top} L${w * 0.74} ${top} Q${w - 14} ${top + 3} ${w - 4} 50 ` +
    `Q${w - 14} ${bottom - 3} ${w * 0.74} ${bottom} L${10 + r} ${bottom} Q10 ${bottom} 10 ${bottom - r} Z`;

// Torre de canhão (círculo + dois canos apontando para dir = 1 proa / -1 popa).
const turret = (x, dir = 1, r = 11) => `
    <rect x="${dir > 0 ? x : x - r - 20}" y="44" width="${r + 20}" height="4" rx="2" fill="${C.line}"/>
    <rect x="${dir > 0 ? x : x - r - 20}" y="52" width="${r + 20}" height="4" rx="2" fill="${C.line}"/>
    <circle cx="${x}" cy="50" r="${r}" fill="${C.dark}" stroke="${C.line}" stroke-width="2"/>
    <circle cx="${x}" cy="50" r="${r * 0.4}" fill="${C.deck}"/>`;

const plane = (x, y) =>
    `<path d="M${x} ${y} l14 0 l0 -9 l4 0 l0 9 l6 0 l3 -4 l3 0 l-1 6 l1 6 l-3 0 l-3 -4 l-6 0 l0 9 l-4 0 l0 -9 l-14 0 Z"
        transform="translate(0 0)" fill="${C.light}" opacity="0.9"/>`;

const SHIP_ART = {
    carrier: () => `
        <path d="M10 26 L360 26 L392 12 L468 12 L494 50 L468 88 L10 88 Z" fill="${C.hull}" stroke="${C.line}" stroke-width="3"/>
        <path d="M22 34 L470 34 L470 76 L22 76 Z" fill="${C.dark}"/>
        <line x1="34" y1="62" x2="460" y2="62" stroke="#fff" stroke-width="2.5" stroke-dasharray="16 12" opacity="0.85"/>
        <line x1="40" y1="48" x2="250" y2="70" stroke="#ffe08a" stroke-width="2" opacity="0.6"/>
        ${plane(70, 46)}${plane(118, 46)}${plane(166, 46)}${plane(380, 54)}
        <rect x="300" y="72" width="70" height="18" rx="3" fill="${C.deck}" stroke="${C.line}" stroke-width="2"/>
        <rect x="318" y="76" width="22" height="10" rx="2" fill="${C.dark}"/>
        <circle cx="352" cy="81" r="4" fill="${C.light}"/>`,

    battleship: () => `
        <path d="${hullPath(400, 18, 82, 14)}" fill="${C.hull}" stroke="${C.line}" stroke-width="3"/>
        <path d="${hullPath(380, 28, 72, 10)}" fill="${C.deck}" transform="translate(8 0)"/>
        ${turret(70, -1, 13)}${turret(300, 1, 13)}${turret(250, 1, 11)}
        <rect x="130" y="34" width="90" height="32" rx="5" fill="${C.light}" stroke="${C.line}" stroke-width="2"/>
        <rect x="150" y="40" width="40" height="20" rx="3" fill="${C.dark}"/>
        <ellipse cx="205" cy="50" rx="9" ry="7" fill="${C.line}"/>
        <line x1="16" y1="50" x2="40" y2="50" stroke="${C.line}" stroke-width="2"/>`,

    cruiser: () => `
        <path d="${hullPath(300, 22, 78, 12)}" fill="${C.hull}" stroke="${C.line}" stroke-width="3"/>
        <path d="${hullPath(284, 31, 69, 8)}" fill="${C.deck}" transform="translate(6 0)"/>
        ${turret(56, -1, 11)}${turret(222, 1, 11)}
        <rect x="100" y="36" width="72" height="28" rx="4" fill="${C.light}" stroke="${C.line}" stroke-width="2"/>
        <rect x="114" y="42" width="28" height="16" rx="3" fill="${C.dark}"/>
        <circle cx="158" cy="50" r="6" fill="${C.line}"/>`,

    submarine: () => `
        <path d="M46 40 L56 22 L66 22 L70 40 Z M46 60 L56 78 L66 78 L70 60 Z" fill="#2a3f4b" stroke="#17262f" stroke-width="2" stroke-linejoin="round"/>
        <line x1="14" y1="50" x2="34" y2="50" stroke="#17262f" stroke-width="3"/>
        <rect x="12" y="40" width="6" height="20" rx="3" fill="#2a3f4b" stroke="#17262f" stroke-width="2"/>
        <path d="M28 50 Q58 31 112 30 L250 30 Q292 32 295 50 Q292 68 250 70 L112 70 Q58 69 28 50 Z"
            fill="#3f5a69" stroke="#17262f" stroke-width="3"/>
        <path d="M64 44 Q100 37 140 37 L250 37 Q280 38 286 46" fill="none" stroke="#6b8d9e" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        <path d="M70 50 L268 50" stroke="#2c4250" stroke-width="1.5" stroke-dasharray="10 8" opacity="0.8"/>
        <path d="M178 40 L183 31 L193 31 L195 40 Z M178 60 L183 69 L193 69 L195 60 Z" fill="#2a3f4b" stroke="#17262f" stroke-width="2" stroke-linejoin="round"/>
        <path d="M150 50 Q152 40 172 40 L198 41 Q210 44 210 50 Q210 56 198 59 L172 60 Q152 60 150 50 Z" fill="#253844" stroke="#17262f" stroke-width="2"/>
        <circle cx="170" cy="50" r="3" fill="#8fa9b6"/>
        <circle cx="180" cy="50" r="3" fill="#8fa9b6"/>
        <circle cx="192" cy="50" r="2.5" fill="#9fd8ff"/>`,

    destroyer: () => `
        <path d="${hullPath(200, 26, 74, 10)}" fill="${C.hull}" stroke="${C.line}" stroke-width="3"/>
        <path d="${hullPath(186, 34, 66, 7)}" fill="${C.deck}" transform="translate(5 0)"/>
        ${turret(150, 1, 9)}
        <rect x="56" y="38" width="50" height="24" rx="4" fill="${C.light}" stroke="${C.line}" stroke-width="2"/>
        <rect x="66" y="43" width="20" height="14" rx="2" fill="${C.dark}"/>
        <circle cx="34" cy="50" r="5" fill="${C.dark}"/>`,
};

const shipSvg = (spec, cls = "") =>
    `<svg class="${cls}" viewBox="0 0 ${spec.size * 100} 100" aria-hidden="true" focusable="false">${SHIP_ART[spec.type]()}</svg>`;

// =====================================================================
// Modelo do tabuleiro
// =====================================================================

const createBoard = () => ({
    ships: [], // { name, size, cells: [{r,c}], hits: number, horizontal }
    occupied: Array.from({ length: SIZE }, () => Array(SIZE).fill(-1)), // índice do navio
    shots: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), // 0 nada, 1 água, 2 acerto
});

const shipCells = (r, c, size, horizontal) =>
    Array.from({ length: size }, (_, i) => (horizontal ? { r, c: c + i } : { r: r + i, c }));

// `ignore`: índice de um navio que pode ser sobreposto (o próprio navio sendo movido/girado).
const canPlace = (board, r, c, size, horizontal, ignore = -1) =>
    shipCells(r, c, size, horizontal).every((p) => {
        if (p.r < 0 || p.r >= SIZE || p.c < 0 || p.c >= SIZE) return false;
        const at = board.occupied[p.r][p.c];
        return at === -1 || at === ignore;
    });

const placeShip = (board, spec, r, c, horizontal) => {
    const index = board.ships.length;
    const cells = shipCells(r, c, spec.size, horizontal);
    cells.forEach((p) => (board.occupied[p.r][p.c] = index));
    board.ships.push({ name: spec.name, size: spec.size, type: spec.type, cells, hits: 0, horizontal });
};

// Reposiciona um navio já colocado (usado ao arrastar ou girar no posicionamento).
const moveShip = (board, index, r, c, horizontal) => {
    const ship = board.ships[index];
    ship.cells.forEach((p) => (board.occupied[p.r][p.c] = -1));
    ship.cells = shipCells(r, c, ship.size, horizontal);
    ship.horizontal = horizontal;
    ship.cells.forEach((p) => (board.occupied[p.r][p.c] = index));
};

// Mantém o navio inteiro dentro do tabuleiro.
const clampAnchor = (r, c, size, horizontal) => ({
    r: Math.max(0, Math.min(r, SIZE - (horizontal ? 1 : size))),
    c: Math.max(0, Math.min(c, SIZE - (horizontal ? size : 1))),
});

const randomFleet = (board) => {
    FLEET.forEach((spec) => {
        for (;;) {
            const horizontal = Math.random() < 0.5;
            const r = randInt(SIZE);
            const c = randInt(SIZE);
            if (canPlace(board, r, c, spec.size, horizontal)) {
                placeShip(board, spec, r, c, horizontal);
                return;
            }
        }
    });
};

// Dispara numa célula. Retorna { result: "miss" | "hit" | "sunk", ship }
const fireAt = (board, r, c) => {
    const index = board.occupied[r][c];
    if (index === -1) {
        board.shots[r][c] = 1;
        return { result: "miss" };
    }
    board.shots[r][c] = 2;
    const ship = board.ships[index];
    ship.hits++;
    return { result: ship.hits === ship.size ? "sunk" : "hit", ship };
};

const shipsLeft = (board) => board.ships.filter((s) => s.hits < s.size).length;

// =====================================================================
// IA do adversário
// =====================================================================

const ai = {
    targets: [], // fila de alvos (modo "caça" após acerto)

    reset() {
        this.targets = [];
    },

    // Fácil: tiros aleatórios.
    easy(board) {
        const free = [];
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board.shots[r][c]) free.push({ r, c });
        return free[randInt(free.length)];
    },

    // Normal: procura em xadrez e, após acertar, investiga os vizinhos.
    normal(board) {
        while (this.targets.length) {
            const t = this.targets.shift();
            if (!board.shots[t.r][t.c]) return t;
        }
        const free = [];
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) if (!board.shots[r][c] && (r + c) % 2 === 0) free.push({ r, c });
        }
        return free.length ? free[randInt(free.length)] : this.easy(board);
    },

    // Difícil: mapa de probabilidade com os navios restantes (acertos não afundados pesam muito).
    hard(board) {
        const heat = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        const sunkCells = new Set();
        board.ships.forEach((s) => {
            if (s.hits === s.size) s.cells.forEach((p) => sunkCells.add(p.r * SIZE + p.c));
        });
        const remaining = board.ships.filter((s) => s.hits < s.size).map((s) => s.size);

        remaining.forEach((size) => {
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    [true, false].forEach((horizontal) => {
                        const cells = shipCells(r, c, size, horizontal);
                        let hits = 0;
                        const valid = cells.every((p) => {
                            if (p.r >= SIZE || p.c >= SIZE) return false;
                            const shot = board.shots[p.r][p.c];
                            if (shot === 1 || sunkCells.has(p.r * SIZE + p.c)) return false;
                            if (shot === 2) hits++;
                            return true;
                        });
                        if (!valid) return;
                        const weight = 1 + hits * 30;
                        cells.forEach((p) => {
                            if (!board.shots[p.r][p.c]) heat[p.r][p.c] += weight;
                        });
                    });
                }
            }
        });

        let best = [];
        let max = -1;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (board.shots[r][c]) continue;
                // leve preferência pelo padrão xadrez quando não há alvos abertos
                const v = heat[r][c] + ((r + c) % 2 === 0 ? 0.5 : 0);
                if (v > max) { max = v; best = [{ r, c }]; }
                else if (v === max) best.push({ r, c });
            }
        }
        return best.length ? best[randInt(best.length)] : this.easy(board);
    },

    pick(board, level) {
        return this[level] ? this[level](board) : this.normal(board);
    },

    // Informa o resultado para o modo Normal.
    report(r, c, result) {
        if (result === "hit") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) this.targets.push({ r: nr, c: nc });
            });
        } else if (result === "sunk") {
            this.targets = [];
        }
    },
};

// =====================================================================
// Estado e interface
// =====================================================================

const ui = {
    game: $("game"),
    status: $("status"),
    playerBoard: $("player-board"),
    enemyBoard: $("enemy-board"),
    shipList: $("ship-list"),
    setup: $("setup"),
    stats: $("stats"),
    log: $("log"),
    overlay: $("overlay"),
    difficulty: $("difficulty"),
    shipStyle: $("ship-style"),
    scene: $("scene"),
};

const state = {
    phase: "setup", // setup | battle | over
    player: createBoard(),
    enemy: createBoard(),
    placingIndex: 0,
    horizontal: true,
    turn: "player",
    shots: 0,
    hits: 0,
    wins: Number(storage.get(WINS_KEY)) || 0,
    cursor: { r: 0, c: 0 },
    hover: null,
    // Arrasto/toque num navio já posicionado:
    // { index, seg, x, y, moved, r, c, valid, tap: {r,c} }
    drag: null,
    suppressClick: false,
};

const playerCells = [];
const enemyCells = [];
const useSprites = () => ui.shipStyle.value === "sprites";

const buildBoard = (el, cells, isEnemy) => {
    el.querySelectorAll(".cell, .label, .ship-layer, .clouds").forEach((n) => n.remove());

    // Camada com os desenhos dos navios (mesma grade do tabuleiro).
    const layer = document.createElement("div");
    layer.className = "ship-layer";
    layer.setAttribute("aria-hidden", "true");
    el.shipLayer = layer;
    el.shipEls = new Map();

    // Nuvens que atravessam o tabuleiro durante a batalha.
    const clouds = document.createElement("div");
    clouds.className = "clouds";
    clouds.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
        const cloud = document.createElement("span");
        cloud.className = "cloud";
        const duration = 32 + Math.random() * 26;
        cloud.style.setProperty("--y", `${8 + i * 30 + Math.random() * 14}%`);
        cloud.style.setProperty("--s", (0.8 + Math.random() * 0.6).toFixed(2));
        cloud.style.setProperty("--d", `${duration.toFixed(1)}s`);
        cloud.style.setProperty("--delay", `${(-Math.random() * duration).toFixed(1)}s`);
        clouds.appendChild(cloud);
    }

    const corner = document.createElement("span");
    corner.className = "label";
    el.appendChild(corner);
    for (let c = 0; c < SIZE; c++) {
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = c + 1;
        el.appendChild(label);
    }
    for (let r = 0; r < SIZE; r++) {
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = LETTERS[r];
        el.appendChild(label);
        cells[r] = [];
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.setAttribute("aria-label", coord(r, c));
            cell.tabIndex = isEnemy ? 0 : -1;
            el.appendChild(cell);
            cells[r][c] = cell;
        }
    }
    el.appendChild(layer);
    el.appendChild(clouds);
};

const setStatus = (text, tone = "") => {
    ui.status.textContent = text;
    ui.status.className = `status ${tone}`;
};

const addLog = (text, cls) => {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    ui.log.prepend(li);
};

// Item de exibição: { key, spec, r, c, horizontal, sunk, ghost, solid, invalid }
const shipView = (ship, key) => ({
    key,
    spec: ship,
    r: ship.cells[0].r,
    c: ship.cells[0].c,
    horizontal: ship.horizontal,
    sunk: ship.hits === ship.size,
});

// Desenha os disparos e os navios (em blocos nas células e/ou como desenho na camada).
const renderBoard = (boardEl, board, cells, views) => {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = cells[r][c];
            cell.className = "cell";
            const shot = board.shots[r][c];
            if (shot) cell.classList.add("shot", shot === 1 ? "miss" : "hit");
        }
    }
    views.forEach((v) => {
        shipCells(v.r, v.c, v.spec.size, v.horizontal).forEach((p, i) => {
            if (p.r >= SIZE || p.c >= SIZE) return;
            const cell = cells[p.r][p.c];
            if (v.ghost) {
                cell.classList.add("preview");
                if (v.invalid) cell.classList.add("invalid");
                if (!v.solid) return;
            }
            cell.classList.add("ship", v.horizontal ? "h" : "v");
            if (i === 0) cell.classList.add("start");
            if (i === v.spec.size - 1) cell.classList.add("end");
            if (v.sunk) cell.classList.add("sunk", "sunk-cell");
        });
    });
    renderSprites(boardEl, useSprites() ? views : []);
};

// Mantém um elemento por navio (reaproveitado entre renders para não reiniciar as animações).
const renderSprites = (boardEl, views) => {
    const seen = new Set();
    views.forEach((v) => {
        seen.add(v.key);
        let el = boardEl.shipEls.get(v.key);
        if (!el) {
            el = document.createElement("div");
            el.innerHTML = `<div class="hull"><div class="bob"><span class="wake"></span><span class="bow-wave"></span></div></div>`;
            boardEl.shipLayer.appendChild(el);
            boardEl.shipEls.set(v.key, el);
        }
        if (el.dataset.type !== v.spec.type) {
            el.dataset.type = v.spec.type;
            el.querySelector(".bob svg")?.remove();
            el.querySelector(".bob").insertAdjacentHTML("beforeend", shipSvg(v.spec));
        }
        const n = v.spec.size;
        el.className = ["sprite", v.horizontal ? "h" : "v", v.sunk && "sunk", v.ghost && "ghost",
            v.solid && "solid", v.invalid && "invalid"].filter(Boolean).join(" ");
        el.style.gridRow = `${v.r + 2} / span ${v.horizontal ? 1 : n}`;
        el.style.gridColumn = `${v.c + 2} / span ${v.horizontal ? n : 1}`;
        el.style.setProperty("--n", n);
    });
    boardEl.shipEls.forEach((el, key) => {
        if (!seen.has(key)) {
            el.remove();
            boardEl.shipEls.delete(key);
        }
    });
};

const renderShipList = () => {
    const sprites = useSprites();
    ui.shipList.innerHTML = FLEET.map((ship, i) => `
        <li class="${i < state.placingIndex ? "placed" : ""} ${i === state.placingIndex ? "current" : ""}">
            <span>${ship.name}</span>
            ${sprites
                ? `<span class="ship-mini" style="--n:${ship.size}">${shipSvg(ship)}</span>`
                : `<span class="ship-dots">${"<i></i>".repeat(ship.size)}</span>`}
        </li>`).join("");
    $("btn-start").disabled = state.placingIndex < FLEET.length;
};

// Navios do jogador, considerando o arrasto e a pré-visualização do próximo navio.
const playerViews = () => {
    const views = state.player.ships.map((ship, i) => shipView(ship, `s${i}`));
    const d = state.drag;
    if (state.phase === "setup" && d?.moved) {
        Object.assign(views[d.index], { r: d.r, c: d.c, ghost: true, solid: true, invalid: !d.valid });
    } else if (state.phase === "setup" && state.hover && state.placingIndex < FLEET.length) {
        const spec = FLEET[state.placingIndex];
        const { r, c } = state.hover;
        views.push({
            key: "preview", spec, r, c, horizontal: state.horizontal, ghost: true,
            invalid: !canPlace(state.player, r, c, spec.size, state.horizontal),
        });
    }
    return views;
};

const renderCounts = () => {
    $("player-left").textContent = state.phase === "setup" ? "" : `${shipsLeft(state.player)} navios`;
    $("enemy-left").textContent = state.phase === "setup" ? "" : `${shipsLeft(state.enemy)} navios`;
    $("stat-shots").textContent = state.shots;
    $("stat-hits").textContent = state.hits;
    $("stat-acc").textContent = state.shots ? `${Math.round((state.hits / state.shots) * 100)}%` : "0%";
    $("stat-wins").textContent = state.wins;
};

const render = () => {
    renderBoard(ui.playerBoard, state.player, playerCells, playerViews());
    const revealEnemy = state.phase === "over";
    renderBoard(ui.enemyBoard, state.enemy, enemyCells, state.enemy.ships
        .map((ship, i) => shipView(ship, `s${i}`))
        .filter((v) => revealEnemy || v.sunk));
    ui.game.classList.toggle("sprites", useSprites());
    ui.game.classList.toggle("dragging", !!state.drag?.moved);

    if (state.phase === "battle") {
        enemyCells[state.cursor.r][state.cursor.c].classList.add("cursor");
    }
    ui.enemyBoard.classList.toggle("locked", state.phase !== "battle" || state.turn !== "player");
    renderShipList();
    renderCounts();
};

// =====================================================================
// Efeitos visuais
// =====================================================================

const spawnFx = (boardEl, cell, kind) => {
    const cellRect = cell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const x = cellRect.left - boardRect.left + cellRect.width / 2;
    const y = cellRect.top - boardRect.top + cellRect.height / 2;
    const size = cellRect.width;

    const main = document.createElement("span");
    main.className = `fx ${kind === "miss" ? "splash" : "boom"}`;
    Object.assign(main.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
    boardEl.appendChild(main);
    setTimeout(() => main.remove(), 800);

    const count = kind === "miss" ? 8 : kind === "sunk" ? 22 : 12;
    for (let i = 0; i < count; i++) {
        const p = document.createElement("span");
        p.className = `fx ${kind === "miss" ? "drop" : "spark"}`;
        const ang = Math.random() * Math.PI * 2;
        const dist = size * (0.6 + Math.random() * (kind === "sunk" ? 2.2 : 1.2));
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
        p.style.setProperty("--dy", `${Math.sin(ang) * dist - (kind === "miss" ? size * 0.5 : 0)}px`);
        boardEl.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }

    if (kind !== "miss") {
        boardEl.classList.remove("shake");
        void boardEl.offsetWidth; // reinicia a animação
        boardEl.classList.add("shake");
    }
};

// =====================================================================
// Fluxo do jogo
// =====================================================================

const newGame = () => {
    state.phase = "setup";
    state.player = createBoard();
    state.enemy = createBoard();
    state.placingIndex = 0;
    state.horizontal = true;
    state.turn = "player";
    state.shots = 0;
    state.hits = 0;
    state.cursor = { r: 0, c: 0 };
    state.drag = null;
    state.hover = null;
    ai.reset();
    ui.game.classList.remove("battle");
    ui.setup.hidden = false;
    ui.stats.hidden = true;
    ui.overlay.hidden = true;
    ui.log.innerHTML = "";
    setStatus("Posicione sua frota.");
    render();
};

const placeCurrentShip = (r, c) => {
    if (state.placingIndex >= FLEET.length) return;
    const spec = FLEET[state.placingIndex];
    if (!canPlace(state.player, r, c, spec.size, state.horizontal)) {
        audio.tone(160, 0.12, { type: "square", gain: 0.05 });
        return;
    }
    placeShip(state.player, spec, r, c, state.horizontal);
    state.placingIndex++;
    audio.tone(660, 0.08, { type: "triangle", gain: 0.08 });
    setStatus(state.placingIndex < FLEET.length
        ? `Posicione: ${FLEET[state.placingIndex].name} (${FLEET[state.placingIndex].size})`
        : READY_TEXT, state.placingIndex >= FLEET.length ? "good" : "");
    render();
};

const randomizePlayer = () => {
    state.player = createBoard();
    randomFleet(state.player);
    state.placingIndex = FLEET.length;
    setStatus(READY_TEXT, "good");
    render();
};

const startBattle = () => {
    if (state.placingIndex < FLEET.length) return;
    state.enemy = createBoard();
    randomFleet(state.enemy);
    state.phase = "battle";
    state.turn = "player";
    ui.game.classList.add("battle");
    ui.setup.hidden = true;
    ui.stats.hidden = false;
    setStatus("Sua vez! Escolha um alvo.", "good");
    audio.sonar();
    render();
    enemyCells[0][0].focus({ preventScroll: true });
};

const playerFire = (r, c) => {
    if (state.phase !== "battle" || state.turn !== "player" || state.enemy.shots[r][c]) return;
    state.cursor = { r, c };
    state.shots++;
    audio.fire();
    const { result, ship } = fireAt(state.enemy, r, c);
    const cell = enemyCells[r][c];

    if (result === "miss") {
        audio.splash();
        addLog(`Você: ${coord(r, c)} — água`, "you");
        setStatus("Água! Vez do inimigo…");
    } else {
        state.hits++;
        audio.explosion();
        if (result === "sunk") {
            audio.sunk();
            addLog(`Você afundou o ${ship.name}!`, "big");
            setStatus(`Você afundou o ${ship.name}!`, "good");
        } else {
            addLog(`Você: ${coord(r, c)} — fogo!`, "you");
            setStatus("Fogo! Acertou. Vez do inimigo…", "good");
        }
    }
    render();
    spawnFx(ui.enemyBoard, cell, result);

    if (!shipsLeft(state.enemy)) {
        endGame(true);
        return;
    }
    state.turn = "enemy";
    render();
    setTimeout(enemyTurn, ENEMY_DELAY);
};

const enemyTurn = () => {
    if (state.phase !== "battle") return;
    const { r, c } = ai.pick(state.player, ui.difficulty.value);
    audio.fire();
    const { result, ship } = fireAt(state.player, r, c);
    ai.report(r, c, result);

    if (result === "miss") {
        audio.splash();
        addLog(`Inimigo: ${coord(r, c)} — água`, "enemy");
    } else {
        audio.explosion();
        if (result === "sunk") {
            audio.sunk();
            addLog(`O inimigo afundou seu ${ship.name}!`, "big");
        } else {
            addLog(`Inimigo: ${coord(r, c)} — acertou!`, "enemy");
        }
    }
    render();
    spawnFx(ui.playerBoard, playerCells[r][c], result);

    if (!shipsLeft(state.player)) {
        endGame(false);
        return;
    }
    state.turn = "player";
    setStatus(result === "miss" ? "O inimigo errou. Sua vez!" : "Você foi atingido! Sua vez.", result === "miss" ? "good" : "bad");
    render();
};

const endGame = (won) => {
    state.phase = "over";
    if (won) {
        state.wins++;
        storage.set(WINS_KEY, String(state.wins));
        audio.victory();
    } else {
        audio.defeat();
    }
    render();
    const acc = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
    $("overlay-title").textContent = won ? "Vitória!" : "Derrota";
    $("overlay-text").textContent = won
        ? `Você afundou toda a frota inimiga com ${state.shots} disparos (${acc}% de precisão).`
        : `Sua frota foi afundada. Você acertou ${state.hits} de ${state.shots} disparos.`;
    ui.overlay.className = `overlay ${won ? "win" : "lose"}`;
    setTimeout(() => {
        ui.overlay.hidden = false;
        $("btn-again").focus();
    }, 900);
    setStatus(won ? "Vitória! 🎉" : "Sua frota foi derrotada.", won ? "good" : "bad");
};

// =====================================================================
// Eventos
// =====================================================================

const cellFromEvent = (event) => {
    const cell = event.target.closest(".cell");
    return cell ? { r: Number(cell.dataset.r), c: Number(cell.dataset.c) } : null;
};



// Gira um navio posicionado em torno da casa tocada; se não couber, tenta deslocá-lo.
const rotatePlacedShip = (index, tap) => {
    const ship = state.player.ships[index];
    const horizontal = !ship.horizontal;
    const seg = ship.cells.findIndex((p) => p.r === tap.r && p.c === tap.c);
    const order = Array.from({ length: ship.size }, (_, k) => k).sort((a, b) => Math.abs(a - seg) - Math.abs(b - seg));
    for (const k of order) {
        const r = horizontal ? tap.r : tap.r - k;
        const c = horizontal ? tap.c - k : tap.c;
        if (canPlace(state.player, r, c, ship.size, horizontal, index)) {
            moveShip(state.player, index, r, c, horizontal);
            audio.tone(520, 0.08, { type: "triangle", gain: 0.07 });
            return;
        }
    }
    audio.tone(160, 0.12, { type: "square", gain: 0.05 });
    setStatus(`Sem espaço para girar o ${ship.name}.`, "bad");
};

ui.playerBoard.addEventListener("pointerdown", (event) => {
    state.suppressClick = false;
    if (state.phase !== "setup" || event.button > 0) return;
    const p = cellFromEvent(event);
    if (!p) return;
    const index = state.player.occupied[p.r][p.c];
    if (index === -1) return; // casa vazia: o clique posiciona o próximo navio
    const ship = state.player.ships[index];
    state.drag = {
        index,
        seg: ship.cells.findIndex((q) => q.r === p.r && q.c === p.c),
        x: event.clientX,
        y: event.clientY,
        moved: false,
        r: ship.cells[0].r,
        c: ship.cells[0].c,
        valid: true,
        tap: p,
    };
    ui.playerBoard.setPointerCapture?.(event.pointerId);
    event.preventDefault();
});

ui.playerBoard.addEventListener("pointermove", (event) => {
    const d = state.drag;
    if (!d) return;
    const first = !d.moved;
    if (first && Math.hypot(event.clientX - d.x, event.clientY - d.y) < DRAG_THRESHOLD) return;
    d.moved = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("#player-board .cell");
    if (!target) {
        if (first) render();
        return;
    }
    const ship = state.player.ships[d.index];
    const tr = Number(target.dataset.r);
    const tc = Number(target.dataset.c);
    const { r, c } = clampAnchor(
        ship.horizontal ? tr : tr - d.seg,
        ship.horizontal ? tc - d.seg : tc,
        ship.size,
        ship.horizontal
    );
    if (!first && r === d.r && c === d.c) return;
    d.r = r;
    d.c = c;
    d.valid = canPlace(state.player, r, c, ship.size, ship.horizontal, d.index);
    render();
});

const endDrag = (event, cancelled) => {
    const d = state.drag;
    if (!d) return;
    state.drag = null;
    state.suppressClick = true; // o "click" que vem depois não deve posicionar outro navio
    ui.playerBoard.releasePointerCapture?.(event.pointerId);
    if (!cancelled) {
        if (!d.moved) {
            rotatePlacedShip(d.index, d.tap);
        } else if (d.valid) {
            const ship = state.player.ships[d.index];
            moveShip(state.player, d.index, d.r, d.c, ship.horizontal);
            audio.tone(660, 0.08, { type: "triangle", gain: 0.08 });
        } else {
            audio.tone(160, 0.12, { type: "square", gain: 0.05 });
        }
    }
    render();
};

ui.playerBoard.addEventListener("pointerup", (event) => endDrag(event, false));
ui.playerBoard.addEventListener("pointercancel", (event) => endDrag(event, true));

ui.playerBoard.addEventListener("click", (event) => {
    if (state.suppressClick) {
        state.suppressClick = false;
        return;
    }
    const p = cellFromEvent(event);
    if (p && state.phase === "setup" && state.player.occupied[p.r][p.c] === -1) placeCurrentShip(p.r, p.c);
});

ui.playerBoard.addEventListener("pointerover", (event) => {
    if (state.phase !== "setup" || state.drag) return;
    const p = cellFromEvent(event);
    if (p && (state.hover?.r !== p.r || state.hover?.c !== p.c)) {
        state.hover = p;
        render();
    }
});

// Botão direito do mouse gira o navio durante o posicionamento.
ui.playerBoard.addEventListener("contextmenu", (event) => {
    if (state.phase !== "setup") return;
    event.preventDefault();
    rotate();
});

ui.playerBoard.addEventListener("pointerleave", () => {
    state.hover = null;
    if (state.phase === "setup") render();
});

ui.enemyBoard.addEventListener("click", (event) => {
    const p = cellFromEvent(event);
    if (p) playerFire(p.r, p.c);
});

const rotate = () => {
    state.horizontal = !state.horizontal;
    render();
};

$("btn-rotate").addEventListener("click", rotate);
$("btn-random").addEventListener("click", randomizePlayer);
$("btn-clear").addEventListener("click", () => {
    state.player = createBoard();
    state.placingIndex = 0;
    setStatus("Posicione sua frota.");
    render();
});
$("btn-start").addEventListener("click", startBattle);
$("btn-new").addEventListener("click", newGame);
$("btn-again").addEventListener("click", newGame);

// Aparência dos navios (desenho ou blocos) e cenário da batalha (nuvens / ondas; o radar fica sempre).
const applyScene = () => {
    const scene = ui.scene.value;
    ui.game.classList.toggle("scene-waves", scene === "waves" || scene === "all");
    ui.game.classList.toggle("scene-clouds", scene === "clouds" || scene === "all");
};
const restoreSelect = (select, key) => {
    const saved = storage.get(key);
    if (saved && [...select.options].some((o) => o.value === saved)) select.value = saved;
};
restoreSelect(ui.shipStyle, STYLE_KEY);
restoreSelect(ui.scene, SCENE_KEY);
ui.shipStyle.addEventListener("change", () => {
    storage.set(STYLE_KEY, ui.shipStyle.value);
    render();
});
ui.scene.addEventListener("change", () => {
    storage.set(SCENE_KEY, ui.scene.value);
    applyScene();
});
applyScene();

// Tema: noturno (padrão) ou céu azul.
const themeSelect = $("theme");
const themeColor = document.querySelector('meta[name="theme-color"]');
const applyTheme = () => {
    const sky = themeSelect.value === "sky";
    document.body.classList.toggle("theme-sky", sky);
    themeColor?.setAttribute("content", sky ? "#3cb4e6" : "#04121f");
};
restoreSelect(themeSelect, THEME_KEY);
themeSelect.addEventListener("change", () => {
    storage.set(THEME_KEY, themeSelect.value);
    applyTheme();
});
applyTheme();

const updateSoundButton = () => {
    $("btn-sound").textContent = audio.enabled ? "🔊" : "🔇";
};
const toggleSound = () => {
    audio.enabled = !audio.enabled;
    storage.set(SOUND_KEY, audio.enabled ? "1" : "0");
    updateSoundButton();
};
$("btn-sound").addEventListener("click", toggleSound);

ui.difficulty.value = storage.get(DIFF_KEY) || "normal";
ui.difficulty.addEventListener("change", () => storage.set(DIFF_KEY, ui.difficulty.value));

window.addEventListener("keydown", (event) => {
    if (event.target.tagName === "SELECT") return;
    const key = event.code;
    if (key === "KeyR" && state.phase === "setup") rotate();
    else if (key === "KeyM") toggleSound();
    else if (key === "KeyN") newGame();
    else if (state.phase === "battle") {
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[key]) {
            event.preventDefault();
            const [dr, dc] = moves[key];
            state.cursor = {
                r: (state.cursor.r + dr + SIZE) % SIZE,
                c: (state.cursor.c + dc + SIZE) % SIZE,
            };
            render();
            enemyCells[state.cursor.r][state.cursor.c].focus({ preventScroll: true });
        } else if (key === "Enter" || key === "Space" || key === "NumpadEnter") {
            event.preventDefault();
            playerFire(state.cursor.r, state.cursor.c);
        }
    } else if (state.phase === "setup" && key === "Enter" && state.placingIndex >= FLEET.length) {
        startBattle();
    } else if (state.phase === "over" && key === "Enter") {
        newGame();
    }
});

// Libera o áudio no primeiro gesto do usuário
window.addEventListener("pointerdown", () => audio.ensure(), { once: true });
window.addEventListener("keydown", () => audio.ensure(), { once: true });

buildBoard(ui.playerBoard, playerCells, false);
buildBoard(ui.enemyBoard, enemyCells, true);
updateSoundButton();
newGame();
