"use strict";

// =====================================================================
// Labirinto do Ratinho — DinoGames
// Desenho, menu, modos locais, modo online e sons.
// Port de MazeRenderer, MatchSounds, MenuScreen, LocalGameScreen e OnlineGameScreen.
// =====================================================================

const { Match, CAT, PHASE, C, NONE, UP, RIGHT, DOWN, LEFT, catInRound } = window.MazeCore;

const CELL = 36;
const WALL_T = 4;
// Tamanho do mundo: muda com o labirinto (deitado 25x15 ou em pé 15x25 no celular na vertical).
let NARROW = false;
let HUD_H = 60;
let MAZE_W = CELL * C.COLS;
let MAZE_H = CELL * C.ROWS;
let WORLD_W = MAZE_W;
let WORLD_H = MAZE_H + HUD_H;
const setLayout = (cols, rows) => {
    NARROW = cols * CELL < 700; // labirinto em pé: HUD em 3 linhas
    HUD_H = NARROW ? 78 : 60;
    MAZE_W = cols * CELL;
    MAZE_H = rows * CELL;
    WORLD_W = MAZE_W;
    WORLD_H = MAZE_H + HUD_H;
    fitCanvas();
};
const ensureLayout = (m) => {
    if (m.maze.cols * CELL !== MAZE_W || m.maze.rows * CELL !== MAZE_H) setLayout(m.maze.cols, m.maze.rows);
};
const isPortrait = () => window.innerHeight > window.innerWidth * 1.15;
const PAD_SPACE = 200; // espaço reservado para o D-pad no celular

const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
};
const KEY = (k) => `dinogames-maze-${k}`;

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// ---------------- cores
const COL = {
    check: "#26262e", pink: "#ff9eb3", nose: "#d94d6b", whisker: "#d9d9d9",
    cheese: "#facc33", cheeseDark: "#9e6b0f", cheeseHole: "#db9e1a",
    dim: "#bfc7d9", gold: "#ffd94d", danger: "#ff4040",
    catFur: "#f29433", catStripe: "#b85c14", catEye: "#8cff59",
    wood: "#cc9452", woodDark: "#80572a", metal: "#d1d6e0",
    cookie: "#f2b84d", chip: "#66381a", power: "#ffeb4d",
};
const MOUSE_COLORS = ["#ccccd6", "#bd804d", "#73bfff", "#f2cc59"];
const HOLE_COLORS = ["#bf73ff", "#40f2cc"];
const OVERLAP_OFFSETS = [[-1, 1], [1, -1], [1, 1], [-1, -1]];

// Temas do labirinto (chão, parede, destaque das mudanças, partida, fundo do HUD)
const THEMES = [
    { name: "Clássico", floor: "#1a1c29", wall: "#5294fa", flash: "#ff8c26", start: "#296b38", hud: "#0d0d14" },
    { name: "Jardim", floor: "#2e4a1f", wall: "#1f7a2e", flash: "#ffe14d", start: "#8a6a3a", hud: "#142010" },
    { name: "Masmorra", floor: "#2a2420", wall: "#8c8579", flash: "#ff5a36", start: "#4a3b2a", hud: "#120f0d" },
    { name: "Gelo", floor: "#16304a", wall: "#bfefff", flash: "#ff6fb0", start: "#2e6e8e", hud: "#0a1724" },
    { name: "Doces", floor: "#3a1e35", wall: "#ff8fc8", flash: "#7dffb0", start: "#7a3a6a", hud: "#1c0e1a" },
    { name: "Lava", floor: "#1e0e0a", wall: "#ff6a1f", flash: "#6fe3ff", start: "#5a2a10", hud: "#0f0705" },
    { name: "Neon", floor: "#0b0b12", wall: "#c64bff", flash: "#3dffd8", start: "#2b2050", hud: "#050508" },
];
const THEME_AUTO = -1;
const themeForRound = (choice, round) => (choice >= 0 && choice < THEMES.length ? THEMES[choice] : THEMES[Math.max(0, round - 1) % THEMES.length]);

const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// =====================================================================
// Sons (arquivos .wav do jogo original)
// =====================================================================

const sfx = {
    enabled: storage.get(KEY("sound")) !== "0",
    volumes: {
        menu_move: 0.6, menu_select: 0.7, countdown: 0.7, go: 0.8, wall_change: 0.6, step: 0.25, finish: 0.7,
        win: 0.8, lose: 0.8, gameover: 0.8, meow: 0.8, caught: 0.8, plop: 0.7, snap: 0.8, eat: 0.7, hiss: 0.8,
        join: 0.8, leave: 0.8, error: 0.7,
    },
    cache: {},

    play(id, pitch = 1) {
        if (!this.enabled) return;
        let base = this.cache[id];
        if (!base) {
            base = new Audio(`sounds/${id}.wav`);
            base.preload = "auto";
            this.cache[id] = base;
        }
        const a = base.cloneNode();
        a.volume = this.volumes[id] ?? 0.7;
        a.preservesPitch = false;
        a.playbackRate = pitch;
        a.play().catch(() => { /* bloqueado até o primeiro gesto */ });
    },

    toggle() {
        this.enabled = !this.enabled;
        storage.set(KEY("sound"), this.enabled ? "1" : "0");
        $("btn-sound").textContent = this.enabled ? "🔊" : "🔇";
    },
};

// =====================================================================
// Entrada: vale a última direção apertada (fica natural fazer curvas)
// =====================================================================

const held = new Set();
const pressOrder = [];
const keyDir = (code, scheme) => {
    const wasd = { KeyW: UP, KeyD: RIGHT, KeyS: DOWN, KeyA: LEFT };
    const arrows = { ArrowUp: UP, ArrowRight: RIGHT, ArrowDown: DOWN, ArrowLeft: LEFT };
    if (scheme === "wasd") return wasd[code] ?? NONE;
    if (scheme === "arrows") return arrows[code] ?? NONE;
    return wasd[code] ?? arrows[code] ?? NONE;
};
// Direção atual de um esquema de teclas: a tecla segurada mais recente.
const pollDir = (scheme) => {
    for (let i = pressOrder.length - 1; i >= 0; i--) {
        const d = keyDir(pressOrder[i], scheme);
        if (d !== NONE && held.has(pressOrder[i])) return d;
    }
    return NONE;
};
const touchDir = { d: NONE };

// =====================================================================
// Desenho
// =====================================================================

const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
const fitCanvas = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    // Com o D-pad na tela, o labirinto fica acima dele (em pé) ou à esquerda dele (deitado)
    const pad = $("touch").classList.contains("show");
    const tall = ch > cw;
    const availW = pad && !tall ? Math.max(cw * 0.6, cw - PAD_SPACE) : cw;
    const availH = pad && tall ? Math.max(ch * 0.6, ch - PAD_SPACE) : ch;
    const scale = Math.min(availW / WORLD_W, availH / WORLD_H);
    Object.assign(view, { scale, dpr, ox: (availW - WORLD_W * scale) / 2, oy: (availH - WORLD_H * scale) / 2 });
};

const font = (size, weight = "bold") => `${weight} ${size}px ui-monospace, Consolas, "Segoe UI", monospace`;
const text = (str, x, y, size, color = "#fff", align = "left", baseline = "top", weight = "bold") => {
    ctx.font = font(size, weight);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
};
const circle = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
};
const seg = (x1, y1, x2, y2, w, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
};
const tri = (x1, y1, x2, y2, x3, y3, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
};
const ellipse = (cx, cy, rx, ry, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
};

const facingAngle = (f) => (f === UP ? -Math.PI / 2 : f === DOWN ? Math.PI / 2 : f === LEFT ? Math.PI : 0);
const cellX = (x) => x * CELL;
const cellY = (y) => HUD_H + y * CELL;
const centerX = (rx) => (rx + 0.5) * CELL;
const centerY = (ry) => HUD_H + (ry + 0.5) * CELL;

// Ratinho visto de cima apontando para `facing` (coordenadas locais: x para frente).
const drawMouse = (x, y, facing, body, scale) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facingAngle(facing));
    ctx.scale(scale, scale);
    seg(-9, 0, -14, 3.5, 1.8, COL.pink); // rabo
    seg(-14, 3.5, -19, 1, 1.6, COL.pink);
    seg(-19, 1, -22, -2.5, 1.3, COL.pink);
    circle(3.5, 6.5, 4.2, body); // orelhas
    circle(3.5, -6.5, 4.2, body);
    circle(3.8, 6.7, 2.4, COL.pink);
    circle(3.8, -6.7, 2.4, COL.pink);
    ellipse(-2, 0, 11, 7.5, body); // corpo
    circle(7, 0, 6, body); // cabeça e focinho
    circle(11.5, 0, 3.6, body);
    seg(12.5, 1.2, 17, 4.5, 0.6, COL.whisker);
    seg(12.5, -1.2, 17, -4.5, 0.6, COL.whisker);
    circle(8.8, 2.7, 1.3, "#000");
    circle(8.8, -2.7, 1.3, "#000");
    circle(14.8, 0, 1.8, COL.nose);
    ctx.restore();
};

// Gato visto de cima.
const drawCatShape = (x, y, facing, scale, time) => {
    const wag = Math.sin(time * 9) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facingAngle(facing));
    ctx.scale(scale, scale);
    seg(-10, 0, -16, 2 + wag * 0.5, 3.4, COL.catFur); // rabo listrado
    seg(-16, 2 + wag * 0.5, -21, wag, 3, COL.catFur);
    circle(-14, 1.3 + wag * 0.4, 1.5, COL.catStripe);
    circle(-19, 1 + wag * 0.8, 1.4, COL.catStripe);
    ellipse(-2, 0, 11, 7.5, COL.catFur); // corpo
    seg(-6, -6, -6, 6, 1.6, COL.catStripe);
    seg(-1, -6.5, -1, 6.5, 1.6, COL.catStripe);
    tri(7, 3, 3, 9, 11, 8, COL.catFur); // orelhas
    tri(7, -3, 3, -9, 11, -8, COL.catFur);
    circle(8, 0, 7, COL.catFur); // cabeça
    seg(12, 2, 18, 5.5, 0.6, COL.whisker);
    seg(12, -2, 18, -5.5, 0.6, COL.whisker);
    seg(12, 1, 18.5, 1.5, 0.6, COL.whisker);
    seg(12, -1, 18.5, -1.5, 0.6, COL.whisker);
    circle(10.5, 3, 1.8, COL.catEye);
    circle(10.5, -3, 1.8, COL.catEye);
    circle(10.9, 3, 0.8, "#000");
    circle(10.9, -3, 0.8, "#000");
    circle(14.5, 0, 1.4, COL.nose);
    ctx.restore();
};

const drawCheese = (cx, cy, k) => {
    tri(cx - 13 * k, cy + 9 * k, cx + 13 * k, cy + 9 * k, cx + 13 * k, cy - 9 * k, COL.cheeseDark);
    tri(cx - 10 * k, cy + 7.5 * k, cx + 11.5 * k, cy + 7.5 * k, cx + 11.5 * k, cy - 6.5 * k, COL.cheese);
    circle(cx + 6 * k, cy + 3.5 * k, 2.2 * k, COL.cheeseHole);
    circle(cx + 1 * k, cy + 5 * k, 1.4 * k, COL.cheeseHole);
    circle(cx + 8.5 * k, cy - 2 * k, 1.4 * k, COL.cheeseHole);
};

const drawHeart = (x, y, alpha) => {
    const c = hexA(COL.danger, alpha);
    circle(x - 3.6, y - 2.5, 4.4, c);
    circle(x + 3.6, y - 2.5, 4.4, c);
    tri(x - 7.9, y - 1.2, x + 7.9, y - 1.2, x, y + 8, c);
};

const renderer = {
    flashes: [], // { x, y, d, closed, t }
    prevWalls: null,
    prevRound: -1,
    theme: THEMES[0],
    lastTheme: null,
    lastChoice: null,
    themeNotice: 0,
    time: 0,

    // Paredes que mudaram desde o quadro anterior ficam destacadas por um instante.
    trackChanges(m, dt) {
        const walls = m.maze.walls;
        if (!this.prevWalls || this.prevWalls.length !== walls.length || m.round !== this.prevRound) {
            this.flashes = [];
            this.prevWalls = walls.slice();
            this.prevRound = m.round;
        } else {
            const mz = m.maze;
            for (let i = 0; i < walls.length; i++) {
                if (this.prevWalls[i] === walls[i]) continue;
                const x = i % mz.cols, y = Math.floor(i / mz.cols);
                [RIGHT, DOWN].forEach((d) => {
                    if (!mz.inside(x + (d === RIGHT ? 1 : 0), y + (d === DOWN ? 1 : 0))) return;
                    const before = (this.prevWalls[i] & (1 << d)) !== 0;
                    const now = (walls[i] & (1 << d)) !== 0;
                    if (before !== now) this.flashes.push({ x, y, d, closed: now, t: 1 });
                });
            }
            this.prevWalls.set(walls);
        }
        this.flashes.forEach((f) => (f.t -= dt / 1.2));
        this.flashes = this.flashes.filter((f) => f.t > 0);
    },

    updateTheme(m, dt) {
        this.theme = themeForRound(settings.theme, m.round);
        if (this.lastTheme && (this.theme !== this.lastTheme || settings.theme !== this.lastChoice)) this.themeNotice = 2.5;
        this.lastTheme = this.theme;
        this.lastChoice = settings.theme;
        if (this.themeNotice > 0) this.themeNotice -= dt;
    },

    render(m, localId, dt, modeLabel) {
        this.trackChanges(m, dt);
        this.updateTheme(m, dt);
        this.time += dt;
        this.drawMaze(m.maze);
        this.drawHoles(m);
        this.drawTraps(m);
        this.drawFood(m);
        this.drawFlashes();
        this.drawMice(m, localId);
        this.drawCat(m);
        this.drawHud(m, localId, modeLabel);
        this.drawStatusText(m);
        if (this.themeNotice > 0) {
            const hint = settings.theme === THEME_AUTO ? "  (automático)" : "";
            this.notice(`Tema: ${this.theme.name}${hint}   |   T: trocar tema`, Math.min(1, this.themeNotice / 0.5), 15);
        }
    },

    hWall(x, y, t) { ctx.fillRect(x - t / 2, y - t / 2, CELL + t, t); },
    vWall(x, y, t) { ctx.fillRect(x - t / 2, y - t / 2, t, CELL + t); },

    drawMaze(mz) {
        const th = this.theme;
        ctx.fillStyle = th.floor;
        ctx.fillRect(0, HUD_H, mz.cols * CELL, mz.rows * CELL);
        ctx.fillStyle = th.start; // casa de partida (refúgio)
        ctx.fillRect(cellX(0), cellY(0), CELL, CELL);

        // Linha de chegada quadriculada + queijo
        const bx = cellX(mz.cols - 1), by = cellY(mz.rows - 1), q = CELL / 4;
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                ctx.fillStyle = (i + j) & 1 ? COL.check : "#fff";
                ctx.fillRect(bx + i * q, by + j * q, q, q);
            }
        }
        drawCheese(bx + CELL / 2, by + CELL / 2, CELL / 36);

        ctx.fillStyle = th.wall;
        for (let y = 0; y < mz.rows; y++) {
            for (let x = 0; x < mz.cols; x++) {
                const px = cellX(x), py = cellY(y);
                if (mz.hasWall(x, y, UP)) this.hWall(px, py, WALL_T);
                if (mz.hasWall(x, y, LEFT)) this.vWall(px, py, WALL_T);
                if (x === mz.cols - 1 && mz.hasWall(x, y, RIGHT)) this.vWall(px + CELL, py, WALL_T);
                if (y === mz.rows - 1 && mz.hasWall(x, y, DOWN)) this.hWall(px, py + CELL, WALL_T);
            }
        }
    },

    drawFlashes() {
        this.flashes.forEach((f) => {
            ctx.fillStyle = hexA(this.theme.flash, f.closed ? f.t : f.t * 0.6);
            const t = f.closed ? WALL_T + 3 : WALL_T;
            if (f.d === RIGHT) this.vWall(cellX(f.x) + CELL, cellY(f.y), t);
            else this.hWall(cellX(f.x), cellY(f.y) + CELL, t);
        });
    },

    drawHoles(m) {
        if (!m.hazards) return;
        m.holes.forEach((h, i) => {
            const c = HOLE_COLORS[Math.floor(i / 2) % HOLE_COLORS.length];
            const x = centerX(h.x), y = centerY(h.y);
            const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + i);
            circle(x, y, CELL * (0.42 + 0.05 * pulse), hexA(c, 0.25 + 0.25 * pulse));
            circle(x, y, CELL * 0.34, c);
            circle(x, y, CELL * 0.26, "#050508");
            for (let k = 0; k < 3; k++) { // redemoinho girando
                const a = this.time * 3 + (k * Math.PI * 2) / 3;
                circle(x + Math.cos(a) * CELL * 0.14, y + Math.sin(a) * CELL * 0.14, CELL * 0.045, hexA(c, 0.8));
            }
        });
    },

    drawTraps(m) {
        if (!m.hazards) return;
        m.traps.forEach((t) => {
            const x = centerX(t.x), y = centerY(t.y);
            const armed = t.rearm <= 0;
            ctx.globalAlpha = armed ? 1 : 0.45; // desarmada fica apagadinha
            ctx.fillStyle = COL.woodDark;
            ctx.fillRect(x - 13, y - 9, 26, 18);
            ctx.fillStyle = COL.wood;
            ctx.fillRect(x - 12, y - 8, 24, 16);
            circle(x - 3, y, 2.4, COL.metal);
            if (armed) {
                tri(x + 3, y + 3, x + 9, y + 3, x + 9, y - 3, COL.cheese);
                seg(x - 11, y - 7, x - 11, y + 7, 1.6, COL.metal);
                seg(x - 11, y - 7, x - 3, y - 7, 1.6, COL.metal);
                seg(x - 11, y + 7, x - 3, y + 7, 1.6, COL.metal);
            } else {
                seg(x + 6, y - 7, x + 6, y + 7, 1.8, COL.metal);
                seg(x - 3, y - 7, x + 6, y - 7, 1.6, COL.metal);
                seg(x - 3, y + 7, x + 6, y + 7, 1.6, COL.metal);
            }
            ctx.globalAlpha = 1;
        });
    },

    drawFood(m) {
        if (!m.hazards || !m.foodActive) return;
        const x = centerX(m.foodX), y = centerY(m.foodY) - Math.sin(this.time * 5) * 1.5;
        const glow = 0.5 + 0.5 * Math.sin(this.time * 6);
        circle(x, y, CELL * 0.45, hexA(COL.power, 0.18 + 0.22 * glow));
        circle(x, y + 1, 9.5, COL.chip);
        circle(x, y, 9, COL.cookie);
        circle(x - 3.5, y - 2.5, 1.6, COL.chip);
        circle(x + 3, y - 3.5, 1.4, COL.chip);
        circle(x + 1, y + 3, 1.7, COL.chip);
        circle(x - 4, y + 3.5, 1.2, COL.chip);
        circle(x + 8, y - 8, 1.6, `rgba(255,255,255,${glow})`);
    },

    drawCat(m) {
        if (!m.hazards || m.phase !== PHASE.RUNNING) return;
        const cat = m.cat;
        const x = centerX(cat.renderX), y = centerY(cat.renderY);
        if (cat.state === CAT.WARNING) { // aviso piscando onde o gato vai aparecer
            const blink = 0.5 + 0.5 * Math.sin(this.time * 14);
            circle(x, y, CELL * 0.5, hexA(COL.danger, 0.35 + 0.4 * blink));
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillRect(x - 2.5, y - 11, 5, 14);
            circle(x, y + 8, 2.8, "rgba(255,255,255,0.9)");
        } else if (cat.state === CAT.ACTIVE) {
            circle(x, y, CELL * 0.6, hexA(COL.danger, 0.18));
            drawCatShape(x, y, cat.facing, (CELL / 36) * 1.15, this.time);
        }
    },

    drawMice(m, localId) {
        const visible = m.mice.filter((mo) => mo.participating || m.phase === PHASE.WAITING);
        visible.forEach((mo) => {
            let x = centerX(mo.renderX), y = centerY(mo.renderY);
            // Outro ratinho no mesmo lugar: afasta um pouco para os dois aparecerem
            if (visible.some((o) => o !== mo && Math.abs(o.renderX - mo.renderX) < 0.4 && Math.abs(o.renderY - mo.renderY) < 0.4)) {
                const off = OVERLAP_OFFSETS[mo.color % OVERLAP_OFFSETS.length];
                x += off[0] * CELL * 0.17;
                y -= off[1] * CELL * 0.17;
            }
            const c = MOUSE_COLORS[mo.color % MOUSE_COLORS.length];
            if (mo.id === localId) circle(x, y, CELL * 0.48, hexA(c, 0.28));
            const strong = mo.power > 0 && m.phase === PHASE.RUNNING;
            if (strong) { // brilho dourado (pisca rápido no fim)
                const glow = 0.5 + 0.5 * Math.sin(this.time * (mo.power < 1.5 ? 20 : 7));
                circle(x, y, CELL * (0.55 + 0.06 * glow), hexA(COL.power, 0.25 + 0.35 * glow));
            }
            drawMouse(x, y, mo.facing, c, (CELL / 36) * (strong ? 1.2 : 1));
            if (mo.stun > 0 && m.phase === PHASE.RUNNING) { // preso na ratoeira
                seg(x - 12, y + 2, x + 12, y - 2, 3, COL.metal);
                ctx.fillStyle = hexA(COL.woodDark, 0.9);
                ctx.fillRect(x - 14, y + 8, 28, 4);
            }
        });
    },

    drawStatusText(m) {
        if (!m.hazards || m.phase !== PHASE.RUNNING) return;
        m.mice.forEach((mo) => {
            if (!mo.participating || mo.finished) return;
            const x = centerX(mo.renderX), y = centerY(mo.renderY) - CELL * 0.95;
            if (mo.stun > 0) text(String(Math.ceil(mo.stun)), x, y, 17, COL.danger, "center");
            else if (mo.power > 0) text("FORTE!", x, y + 4, 12, COL.power, "center");
        });
    },

    drawHud(m, localId, modeLabel) {
        ctx.fillStyle = this.theme.hud;
        ctx.fillRect(0, 0, WORLD_W, HUD_H);
        if (NARROW) {
            this.drawHudNarrow(m, localId, modeLabel);
            return;
        }
        text(`${modeLabel}  -  Rodada ${Math.max(1, m.round)}`, 12, 8, 14);
        const t = m.phase === PHASE.RUNNING || m.phase === PHASE.FINISHED ? m.elapsed : 0;
        text(`Tempo: ${t.toFixed(1)} s`, WORLD_W / 2, 8, 15, COL.gold, "center");
        if (m.phase === PHASE.RUNNING) {
            text(`O labirinto muda em ${Math.ceil(m.mutationTimer)} s`, WORLD_W - 12, 8, 14, this.theme.flash, "right");
        }
        if (m.bestTime > 0) text(`Melhor tempo: ${m.bestTime.toFixed(1)} s`, WORLD_W - 12, 36, 12, COL.dim, "right");

        m.mice.forEach((mo, i) => {
            circle(16 + i * 200 + 6, 42, 6, MOUSE_COLORS[mo.color % MOUSE_COLORS.length]);
            const label = `${mo.name}${mo.id === localId ? " (você)" : ""}  ${mo.wins} ${mo.wins === 1 ? "vitória" : "vitórias"}`;
            text(label, 16 + i * 200 + 18, 35, 12, mo.id === localId ? "#fff" : COL.dim);
        });
        if (m.maxLives > 0 && m.mice.length) {
            const mo = m.mice[0];
            for (let k = 0; k < m.maxLives; k++) drawHeart(WORLD_W / 2 - 22 + k * 22, 44, k < mo.lives ? 1 : 0.18);
        }
    },

    // HUD compacto (labirinto em pé): 3 linhas.
    drawHudNarrow(m, localId, modeLabel) {
        text(`${modeLabel} · Rodada ${Math.max(1, m.round)}`, 10, 8, 13);
        const t = m.phase === PHASE.RUNNING || m.phase === PHASE.FINISHED ? m.elapsed : 0;
        text(`${t.toFixed(1)} s`, WORLD_W - 10, 6, 16, COL.gold, "right");
        m.mice.forEach((mo, i) => {
            const x = 10 + i * 132;
            circle(x + 6, 37, 6, MOUSE_COLORS[mo.color % MOUSE_COLORS.length]);
            text(`${mo.name} ${mo.wins}`, x + 16, 31, 12, mo.id === localId ? "#fff" : COL.dim);
        });
        if (m.phase === PHASE.RUNNING) text(`Muda em ${Math.ceil(m.mutationTimer)} s`, 10, 56, 12, this.theme.flash);
        if (m.bestTime > 0) text(`Melhor: ${m.bestTime.toFixed(1)} s`, WORLD_W - 10, 56, 12, COL.dim, "right");
        if (m.maxLives > 0 && m.mice.length) {
            for (let k = 0; k < m.maxLives; k++) drawHeart(WORLD_W / 2 - 22 + k * 22, 64, k < m.mice[0].lives ? 1 : 0.18);
        }
    },

    // Painel escuro com título grande e linhas menores no centro do labirinto.
    overlay(title, ...lines) {
        lines = lines.filter((l) => l !== undefined);
        const cx = MAZE_W / 2, cy = HUD_H + MAZE_H / 2;
        const size = NARROW ? 13.5 : 16;
        const lh = NARROW ? 23 : 26;
        const w = Math.min(640, WORLD_W - 12), h = 80 + lines.length * lh;
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
        let y = cy - h / 2 + 14;
        text(title, cx, y, NARROW ? 30 : 34, COL.gold, "center");
        y += 58;
        lines.forEach((line) => {
            text(line, cx, y, size, "#fff", "center", "top", "600");
            y += lh;
        });
    },

    // Aviso curto numa faixa no rodapé do labirinto (slot 0 = mais embaixo).
    notice(str, alpha, slot) {
        const y = WORLD_H - 12 - 26 - slot * 30;
        ctx.font = font(NARROW ? 12 : 14, "600");
        const w = Math.min(WORLD_W - 8, ctx.measureText(str).width + 30);
        ctx.fillStyle = `rgba(13, 26, 51, ${0.85 * alpha})`;
        ctx.fillRect(MAZE_W / 2 - w / 2, y, w, 26);
        text(str, MAZE_W / 2, y + 13, NARROW ? 12 : 14, `rgba(255,255,255,${alpha})`, "center", "middle", "600");
    },

    phaseOverlay(m, localId, waitingInfo = []) {
        switch (m.phase) {
            case PHASE.WAITING:
                this.overlay("Aguardando jogadores...", ...waitingInfo);
                break;
            case PHASE.COUNTDOWN: {
                let tip;
                const lives = m.mice.length ? m.mice[0].lives : 0;
                if (!m.hazards) tip = "";
                else if (!catInRound(m.round)) tip = "Buracos coloridos são túneis. Desvie das ratoeiras!";
                else if (m.round === 2 && m.maxLives > 0) tip = `Cuidado com o GATO! Ele tira uma vida. Você tem ${lives}.`;
                else if (m.round === 2) tip = "Cuidado com o GATO! Coma o biscoito dourado para espantá-lo.";
                else tip = "O gato está mais rápido e há mais ratoeiras. A casa verde é um refúgio!";
                this.overlay(String(Math.ceil(m.timer)), "Prepare-se! Leve o ratinho até o queijo",
                    "no canto inferior direito. O labirinto vai mudar!", tip);
                break;
            }
            case PHASE.RUNNING:
                if (m.elapsed < 0.8) this.overlay("JÁ!");
                break;
            case PHASE.FINISHED: {
                const w = m.getMouse(m.winnerId);
                const next = `Novo labirinto em ${Math.ceil(m.timer)} s   |   Esc: voltar ao menu`;
                const best = m.bestTime > 0 ? `Melhor tempo: ${m.bestTime.toFixed(1)} s` : "";
                if (!w) {
                    this.overlay("Fim da rodada", next);
                } else {
                    let title;
                    if (m.mice.length === 1) title = "Você chegou!";
                    else if (w.id === localId) title = "Você venceu!";
                    else title = `${w.name} venceu!`;
                    this.overlay(title, `Tempo: ${w.finishTime.toFixed(1)} s`, best, next);
                }
                break;
            }
            default:
                break;
        }
    },
};

// =====================================================================
// Sons da partida: compara o estado atual com o anterior (local e online)
// =====================================================================

class MatchSounds {
    constructor() {
        this.prevPhase = null;
        this.prevRound = -1;
        this.prevCount = -1;
        this.prevWalls = null;
        this.prev = new Map(); // id -> { cell, caught, teleports, trapped, ate, scares }
        this.prevCatState = CAT.HIDDEN;
    }

    update(m, localId) {
        const phase = m.phase;
        if (phase === PHASE.COUNTDOWN) {
            const count = Math.ceil(m.timer);
            if (count !== this.prevCount && count > 0) sfx.play("countdown");
            this.prevCount = count;
        } else {
            this.prevCount = -1;
        }

        if (this.prevPhase && phase !== this.prevPhase) {
            if (phase === PHASE.RUNNING) sfx.play("go");
            else if (phase === PHASE.FINISHED) this.playResult(m, localId);
            else if (phase === PHASE.GAME_OVER) sfx.play("gameover");
        }

        const walls = m.maze.walls;
        if (this.prevWalls && this.prevWalls.length === walls.length && m.round === this.prevRound &&
            phase === PHASE.RUNNING && walls.some((w, i) => w !== this.prevWalls[i])) {
            sfx.play("wall_change");
        }
        this.prevWalls = walls.slice();

        if (m.cat.state === CAT.WARNING && this.prevCatState !== CAT.WARNING) sfx.play("meow");
        this.prevCatState = m.cat.state;

        m.mice.forEach((mo) => {
            const before = this.prev.get(mo.id);
            const cell = { x: Math.round(mo.renderX), y: Math.round(mo.renderY) };
            if (before) {
                if (mo.caught > before.caught) sfx.play("caught", mo.id === localId || localId < 0 ? 1 : 1.15);
                if (mo.teleports > before.teleports) sfx.play("plop", 0.9 + (mo.id % 4) * 0.1);
                if (mo.trapped > before.trapped) sfx.play("snap");
                if (mo.ate > before.ate) sfx.play("eat");
                if (mo.scares > before.scares) sfx.play("hiss");
                // Passinhos dos ratinhos controlados neste aparelho
                const mine = !mo.ai && (localId < 0 || mo.id === localId);
                const moved = before.cell.x !== cell.x || before.cell.y !== cell.y;
                const jumped = Math.abs(before.cell.x - cell.x) + Math.abs(before.cell.y - cell.y) > 1;
                if (mine && moved && !jumped && phase === PHASE.RUNNING && mo.participating) sfx.play("step", 0.9 + (mo.id % 4) * 0.1);
            }
            this.prev.set(mo.id, { cell, caught: mo.caught, teleports: mo.teleports, trapped: mo.trapped, ate: mo.ate, scares: mo.scares });
        });

        this.prevPhase = phase;
        this.prevRound = m.round;
    }

    playResult(m, localId) {
        const winner = m.getMouse(m.winnerId);
        if (!winner) return;
        const me = localId >= 0 ? m.getMouse(localId) : null;
        if (localId < 0 || m.mice.length === 1 || winner.id === localId) sfx.play("win");
        else if (me && me.participating) sfx.play("lose");
        else sfx.play("finish");
    }
}

// =====================================================================
// Configurações e menu
// =====================================================================

const settings = {
    aiLevel: Number(storage.get(KEY("ai-level")) ?? 1) || 0,
    hazards: storage.get(KEY("hazards")) !== "0",
    theme: Number(storage.get(KEY("theme")) ?? THEME_AUTO),
};
if (!(settings.theme >= THEME_AUTO && settings.theme < THEMES.length)) settings.theme = THEME_AUTO;

const ui = {
    menu: $("menu"),
    help: $("help"),
    ai: $("ai-level"),
    hazards: $("hazards"),
    theme: $("theme"),
    code: $("room-code"),
    touch: $("touch"),
};

ui.theme.innerHTML = `<option value="${THEME_AUTO}">Automático (muda a cada rodada)</option>` +
    THEMES.map((t, i) => `<option value="${i}">${t.name}</option>`).join("");
ui.theme.value = String(settings.theme);
ui.ai.value = String(Math.min(2, Math.max(0, settings.aiLevel)));
ui.hazards.value = settings.hazards ? "1" : "0";
ui.code.value = storage.get(KEY("room")) || "";
$("btn-sound").textContent = sfx.enabled ? "🔊" : "🔇";

ui.ai.addEventListener("change", () => {
    settings.aiLevel = Number(ui.ai.value);
    storage.set(KEY("ai-level"), ui.ai.value);
    sfx.play("menu_move");
});
ui.hazards.addEventListener("change", () => {
    settings.hazards = ui.hazards.value === "1";
    storage.set(KEY("hazards"), ui.hazards.value);
    sfx.play(settings.hazards ? "meow" : "menu_select");
});
const setTheme = (value) => {
    settings.theme = value;
    ui.theme.value = String(value);
    storage.set(KEY("theme"), String(value));
};
ui.theme.addEventListener("change", () => setTheme(Number(ui.theme.value)));
$("btn-sound").addEventListener("click", () => sfx.toggle());
ui.code.addEventListener("input", () => {
    ui.code.value = ui.code.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

const modeButtons = [...document.querySelectorAll(".mode")];
const defaultHelp = ui.help.textContent;
modeButtons.forEach((btn) => {
    const show = () => (ui.help.textContent = btn.dataset.help || defaultHelp);
    btn.addEventListener("mouseenter", show);
    btn.addEventListener("focus", show);
    btn.addEventListener("click", () => startMode(btn.dataset.mode));
});
ui.code.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startMode("join");
});

// =====================================================================
// Telas (menu, partida local, partida online)
// =====================================================================

let screen = null;

const showMenu = () => {
    if (screen?.dispose) screen.dispose();
    screen = menuScreen;
    ui.menu.hidden = false;
    ui.touch.classList.remove("show");
    setLayout(C.COLS, C.ROWS);
    modeButtons[0].focus({ preventScroll: true });
};

const startMode = (mode) => {
    if (mode === "join" && !ui.code.value.trim()) {
        sfx.play("error");
        ui.help.textContent = "Digite o código da partida (4 letras) e escolha Online: entrar.";
        ui.code.focus();
        return;
    }
    sfx.play("menu_select");
    ui.menu.hidden = true;
    if (isTouch) ui.touch.classList.add("show");
    fitCanvas();
    if (mode === "host" || mode === "join") {
        storage.set(KEY("room"), ui.code.value.trim());
        screen = new OnlineScreen(mode === "host", ui.code.value.trim());
    } else {
        screen = new LocalScreen(mode);
    }
    canvas.focus();
};

// Fundo do menu: ratinho correndo atrás do queijo (com o gato, se ligado).
const menuScreen = {
    time: 0,
    frame(dt) {
        this.time += dt;
        ctx.fillStyle = "#12141f";
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        const runX = ((this.time * 140) % (WORLD_W + 120)) - 60;
        const y = WORLD_H - 70;
        drawCheese(runX + 60, y, 1.2);
        drawMouse(runX, y, RIGHT, MOUSE_COLORS[0], 1.6);
        if (settings.hazards) drawCatShape(runX - 90, y, RIGHT, 1.6, this.time);
        drawMouse(WORLD_W / 2 - 300, 60, RIGHT, MOUSE_COLORS[1], 1.8);
        drawCheese(WORLD_W / 2 + 300, 60, 1.8);
    },
};

class LocalScreen {
    constructor(mode) {
        this.mode = mode;
        // Celular em pé: labirinto em pé (15 colunas x 25 linhas) para ocupar a tela
        this.match = isPortrait() ? new Match(1, C.ROWS, C.COLS) : new Match(1);
        this.sounds = new MatchSounds();
        this.paused = false;
        this.match.hazards = settings.hazards;
        const m = this.match;
        if (mode === "solo") {
            m.addMouse(0, "Você");
            this.localId = 0;
            this.label = "Sozinho";
            this.savedBest = Number(storage.get(KEY("best-solo"))) || -1;
            m.bestTime = this.savedBest;
            if (m.hazards) { // 3 vidas para o jogo inteiro
                m.maxLives = 3;
                m.getMouse(0).lives = 3;
            }
        } else if (mode === "cpu") {
            m.addMouse(0, "Você");
            m.addMouse(1, "Computador", true, settings.aiLevel);
            this.localId = 0;
            this.label = `Contra o computador (${C.AI_LEVEL_NAMES[settings.aiLevel]})`;
        } else {
            m.addMouse(0, "Jogador 1");
            m.addMouse(1, "Jogador 2");
            this.localId = -1;
            this.label = "2 jogadores";
        }
    }

    frame(dt) {
        const m = this.match;
        ensureLayout(m);
        if (this.mode === "two") {
            m.setInput(0, touchDir.d !== NONE ? touchDir.d : pollDir("wasd"));
            m.setInput(1, pollDir("arrows"));
        } else {
            m.setInput(0, touchDir.d !== NONE ? touchDir.d : pollDir("both"));
        }
        if (!this.paused) m.update(Math.min(dt, 0.05));

        if (this.mode === "solo" && m.bestTime > 0 && m.bestTime !== this.savedBest) {
            this.savedBest = m.bestTime;
            storage.set(KEY("best-solo"), String(m.bestTime));
        }

        if (m.phase === PHASE.GAME_OVER) {
            this.gameOver(dt);
            return;
        }
        this.sounds.update(m, this.localId);
        renderer.render(m, this.localId, this.paused ? 0 : dt, this.label);
        if (this.paused) renderer.overlay("Pausa", "P: continuar    Esc: voltar ao menu");
        else renderer.phaseOverlay(m, this.localId);
    }

    // Sem vidas: mostra até onde chegou e guarda o recorde.
    gameOver(dt) {
        const m = this.match;
        if (!this.recordSaved) {
            this.recordSaved = true;
            this.bestRound = Number(storage.get(KEY("best-round"))) || 0;
            if (m.round > this.bestRound) {
                this.newRecord = true;
                this.bestRound = m.round;
                storage.set(KEY("best-round"), String(m.round));
            }
            this.sounds.update(m, this.localId);
        }
        renderer.render(m, this.localId, dt, this.label);
        renderer.overlay("Fim de jogo!", "O gato pegou você 3 vezes.", `Você chegou até a rodada ${m.round}.`,
            this.newRecord ? "NOVO RECORDE!" : `Recorde: rodada ${this.bestRound}`, "",
            isTouch ? "Toque para jogar de novo    ☰: menu" : "Enter: jogar de novo    Esc: voltar ao menu");
    }

    confirm() {
        if (this.match.phase === PHASE.GAME_OVER) {
            sfx.play("menu_select");
            screen = new LocalScreen(this.mode);
        }
    }

    togglePause() {
        if (this.match.phase === PHASE.GAME_OVER) return;
        this.paused = !this.paused;
    }
}

// Cliente online: o servidor (server.js) roda a partida; aqui só desenhamos o snapshot.
class OnlineScreen {
    constructor(host, code) {
        this.host = host;
        this.code = code.toUpperCase();
        this.status = "Conectando ao servidor...";
        this.failed = false;
        this.match = null;
        this.playerId = -1;
        this.sounds = new MatchSounds();
        this.notices = [];
        this.known = null; // jogadores do snapshot anterior (para avisar entrada/saída)
        this.lastDir = null;
        this.smooth = new Map(); // posições suavizadas para desenho
        this.showPlayers = false;
        this.connect();
    }

    connect() {
        if (location.protocol === "file:") {
            this.fail("O modo online precisa do servidor do DinoGames.", "Rode \"npm start\" e abra http://localhost:8080");
            return;
        }
        let ws;
        try {
            ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${location.pathname.replace(/[^/]*$/, "")}maze-ws`);
        } catch {
            this.fail("Não foi possível conectar.");
            return;
        }
        this.ws = ws;
        ws.onopen = () => {
            this.status = this.host ? "Criando a partida..." : `Entrando na partida ${this.code}...`;
            ws.send(JSON.stringify(this.host
                ? { type: "create", hazards: settings.hazards, portrait: isPortrait() }
                : { type: "join", code: this.code }));
        };
        ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            if (msg.type === "welcome") this.welcome(msg);
            else if (msg.type === "error") this.fail(msg.message);
            else if (msg.type === "state") this.receive(msg.s);
        };
        ws.onerror = () => {
            if (!this.match) this.fail("Não foi possível conectar ao servidor online.", "O modo online funciona quando o DinoGames roda com \"npm start\".");
        };
        ws.onclose = () => {
            if (!this.failed && screen === this) this.fail(this.match ? "A conexão com a partida caiu." : "Não foi possível conectar ao servidor online.");
        };
    }

    welcome(msg) {
        this.playerId = msg.id;
        this.code = msg.code;
        this.ips = msg.ips || [];
        this.port = msg.port;
        sfx.play("join");
        if (msg.host) {
            const where = this.ips.length ? `  ·  amigos abrem http://${this.ips[0]}:${this.port}` : "";
            this.notice(`Partida criada! Código: ${msg.code}${where}`);
        } else {
            this.notice(`Você entrou na partida ${msg.code}`);
        }
    }

    fail(message, extra = "") {
        if (this.failed) return;
        this.failed = true;
        this.status = message;
        this.extra = extra;
        sfx.play("error");
        try { this.ws?.close(); } catch { /* já fechado */ }
    }

    notice(str) {
        this.notices.push({ str, t: 5 });
        while (this.notices.length > 3) this.notices.shift();
    }

    receive(s) {
        const m = Match.fromSnapshot(s);
        // Avisos de quem entrou ou saiu
        const now = new Map(m.mice.map((mo) => [mo.id, mo]));
        if (this.known) {
            now.forEach((mo, id) => {
                if (!this.known.has(id) && id !== this.playerId) {
                    this.notice(`${mo.name} entrou na partida  -  IP ${mo.address}`);
                    sfx.play("join");
                }
            });
            this.known.forEach((mo, id) => {
                if (!now.has(id)) {
                    this.notice(`${mo.name} saiu da partida  -  IP ${mo.address}`);
                    sfx.play("leave");
                }
            });
        }
        this.known = now;
        this.match = m;
    }

    // Suaviza o movimento entre snapshots (30 por segundo) para o desenho a 60 fps.
    smoothed(dt) {
        const m = this.match;
        const ease = 1 - Math.exp(-dt * 25);
        const apply = (key, obj) => {
            const p = this.smooth.get(key);
            if (!p || Math.abs(p.x - obj.renderX) + Math.abs(p.y - obj.renderY) > 1.5) {
                this.smooth.set(key, { x: obj.renderX, y: obj.renderY });
            } else {
                p.x += (obj.renderX - p.x) * ease;
                p.y += (obj.renderY - p.y) * ease;
                obj.renderX = p.x;
                obj.renderY = p.y;
            }
        };
        m.mice.forEach((mo) => apply(mo.id, mo));
        if (m.cat.state === CAT.ACTIVE) apply("cat", m.cat);
        else this.smooth.delete("cat");
        return m;
    }

    frame(dt) {
        // Envia a direção quando ela muda
        const dir = touchDir.d !== NONE ? touchDir.d : pollDir("both");
        if (this.ws?.readyState === 1 && this.playerId >= 0 && dir !== this.lastDir) {
            this.ws.send(JSON.stringify({ type: "dir", d: dir }));
            this.lastDir = dir;
        }

        if (!this.match || this.failed) {
            ctx.fillStyle = "#12141f";
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            renderer.overlay(this.failed ? "Ops!" : "Conectando...", this.status, this.extra || "",
                this.failed ? (isTouch ? "☰: voltar ao menu" : "Esc: voltar ao menu") : "");
            return;
        }

        const m = this.smoothed(dt);
        ensureLayout(m);
        this.sounds.update(m, this.playerId);
        renderer.render(m, this.playerId, dt, `Online ${this.code}`);

        const me = m.getMouse(this.playerId);
        if (this.showPlayers) {
            renderer.overlay("Jogadores", ...m.mice.map((mo) => `${mo.name}${mo.id === this.playerId ? " (você)" : ""}:  IP ${mo.address}`));
        } else if (me && !me.participating && m.phase === PHASE.RUNNING) {
            renderer.overlay("Você entrou no meio da corrida", "Aguarde a próxima rodada...");
        } else {
            renderer.phaseOverlay(m, this.playerId, this.waitingInfo(m));
        }

        this.notices.forEach((n) => (n.t -= dt));
        this.notices = this.notices.filter((n) => n.t > 0);
        this.notices.forEach((n, i) => renderer.notice(n.str, Math.min(1, n.t / 0.6), this.notices.length - 1 - i));
    }

    waitingInfo(m) {
        const lines = [`Código da partida: ${this.code}`];
        if (this.ips?.length) lines.push(`Na mesma rede, os amigos abrem http://${this.ips[0]}:${this.port}`);
        lines.push("e escolhem Labirinto > Online: entrar com o código.");
        lines.push(`Jogadores conectados: ${m.mice.length} (mínimo 2, máximo ${C.MAX_MICE})`);
        return lines;
    }

    dispose() {
        this.failed = true;
        try { this.ws?.close(); } catch { /* já fechado */ }
    }
}

// =====================================================================
// Teclado e toque
// =====================================================================

const inGame = () => screen && screen !== menuScreen;

window.addEventListener("keydown", (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    if (!inGame()) {
        if (typing) return;
        if (e.code === "KeyM") sfx.toggle();
        else if (e.code === "KeyT") {
            setTheme(settings.theme + 1 >= THEMES.length ? THEME_AUTO : settings.theme + 1);
            sfx.play("menu_move");
        } else if (e.code === "ArrowDown" || e.code === "ArrowUp") { // navega entre os modos
            e.preventDefault();
            const i = modeButtons.indexOf(document.activeElement);
            const next = (i + (e.code === "ArrowDown" ? 1 : -1) + modeButtons.length) % modeButtons.length;
            modeButtons[i < 0 ? 0 : next].focus();
            sfx.play("menu_move");
        }
        return;
    }
    if (e.code === "Escape") {
        showMenu();
        return;
    }
    if (e.code === "Tab") {
        e.preventDefault();
        if (screen instanceof OnlineScreen) screen.showPlayers = true;
        return;
    }
    if (e.code === "KeyM") sfx.toggle();
    else if (e.code === "KeyT") setTheme(settings.theme + 1 >= THEMES.length ? THEME_AUTO : settings.theme + 1);
    else if (e.code === "KeyP" && screen.togglePause) screen.togglePause();
    else if ((e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") && screen.confirm) screen.confirm();
    if (keyDir(e.code, "both") !== NONE) {
        e.preventDefault();
        held.add(e.code);
        const i = pressOrder.indexOf(e.code);
        if (i >= 0) pressOrder.splice(i, 1);
        pressOrder.push(e.code);
    }
});

window.addEventListener("keyup", (e) => {
    held.delete(e.code);
    if (e.code === "Tab" && screen instanceof OnlineScreen) screen.showPlayers = false;
});
window.addEventListener("blur", () => {
    held.clear();
    touchDir.d = NONE;
});

// D-pad: segurar o botão = andar naquela direção
document.querySelectorAll(".dpad button").forEach((btn) => {
    const d = Number(btn.dataset.dir);
    const down = (e) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add("active");
        touchDir.d = d;
        if (screen?.confirm) screen.confirm();
    };
    const up = () => {
        btn.classList.remove("active");
        if (touchDir.d === d) touchDir.d = NONE;
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
});
document.querySelector("[data-touch='menu']").addEventListener("click", showMenu);

// Deslizar o dedo no labirinto também dirige (enquanto o dedo estiver na tela)
let swipe = null;
canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    if (!inGame()) return;
    if (screen.confirm) screen.confirm();
    if (e.pointerType === "mouse") return;
    swipe = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < 18) return;
    touchDir.d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP);
    swipe = { x: e.clientX, y: e.clientY }; // permite trocar de direção sem soltar o dedo
});
const endSwipe = () => {
    if (!swipe) return;
    swipe = null;
    touchDir.d = NONE;
};
canvas.addEventListener("pointerup", endSwipe);
canvas.addEventListener("pointercancel", endSwipe);

window.addEventListener("resize", fitCanvas);

// =====================================================================
// Laço principal
// =====================================================================

let last = performance.now();
const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = view.dpr * view.scale;
    ctx.setTransform(k, 0, 0, k, view.dpr * view.ox, view.dpr * view.oy);
    screen.frame(dt);
    requestAnimationFrame(loop);
};

fitCanvas();
showMenu();
requestAnimationFrame(loop);
