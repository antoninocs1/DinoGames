// Dino Come-Come — jogo de labirinto: o Dino come sementes e foge dos raptores.
// Posições em unidades de casa: o centro da casa (coluna c, linha r) fica em x = c, y = r.
"use strict";
(() => {
    const MAZES = window.DINO_MAZES;
    const Sound = window.DinoSound;
    const COLS = 21;
    const MID = 10;
    const STEP = 1 / 120;
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // cima, direita, baixo, esquerda
    const OPP = (d) => (d < 0 ? -1 : (d + 2) % 4);
    const TIE_ORDER = [0, 3, 2, 1];

    const $ = (id) => document.getElementById(id);
    const store = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
    };

    const DIFFS = {
        facil: { name: "Fácil", lives: 5, ghost: 0.82, fright: 9, frightMin: 3, release: 1.5 },
        normal: { name: "Normal", lives: 3, ghost: 1, fright: 7, frightMin: 1.5, release: 1 },
        dificil: { name: "Difícil", lives: 3, ghost: 1.06, fright: 5.5, frightMin: 1, release: 0.65 },
    };

    const RAPTORS = [
        { name: "Brasa", color: "#ef4444", dark: "#8f1d1d", crest: "#ffb347" },
        { name: "Flor", color: "#c05cf5", dark: "#6b2196", crest: "#ffd1f5" },
        { name: "Gelo", color: "#22b8f0", dark: "#0d5f82", crest: "#e4f8ff" },
        { name: "Lama", color: "#f59e0b", dark: "#8a5306", crest: "#6b3d0c" },
    ];

    // Visual "Fliperama": fundo preto e paredes de neon (uma cor por labirinto).
    const NEON = ["#b04dff", "#00e5ff", "#ff4fa3", "#3dff8c"];
    const arcadeTheme = (i) => ({
        bg: "#000000", wall: "#000000", wallEdge: NEON[i % NEON.length], wallCore: "#000000",
        seed: "#ffd9b0", star: "#fff3a0", door: "#ff9de2", text: "#ffffff", arcade: true,
    });

    // Velocidade geral do jogo (Dino e raptores).
    const SPEED_MULT = { bemdevagar: 0.62, devagar: 0.78, normal: 0.9, rapida: 1.04 };

    const FRUITS = [["🍓", 100], ["🍊", 300], ["🍇", 500], ["🍉", 700], ["🍍", 1000], ["🥥", 2000], ["🌽", 3000], ["🥚", 5000]];
    const SEEDS_FOR_ROAR = 60;
    const ROAR_RADIUS = 6.5;
    const ROAR_STUN = 2.8;

    // ---------- Elementos ----------
    const canvas = $("game");
    const cx = canvas.getContext("2d");
    const ui = {
        menu: $("menu"), pause: $("pause"), over: $("over"),
        diff: $("opt-diff"), maze: $("opt-maze"), touchMode: $("opt-touch"),
        sound: $("btn-sound"), play: $("btn-play"), menuRecord: $("menu-record"),
        resume: $("btn-resume"), quit: $("btn-quit"),
        again: $("btn-again"), toMenu: $("btn-menu"),
        overTitle: $("over-title"), overScore: $("over-score"), overRecord: $("over-record"),
        touch: $("touch"), tPause: $("t-pause"), tRoar: $("t-roar"), dpad: $("dpad"),
    };

    MAZES.forEach((m, i) => ui.maze.add(new Option(`Só ${m.name}`, String(i))));
    ui.diff.value = store.get("dino-come-come-diff") || "normal";
    ui.maze.value = store.get("dino-come-come-maze") || "seq";
    if (!ui.maze.value) ui.maze.value = "seq";
    ui.touchMode.value = store.get("dino-come-come-touch") || "swipe";
    ui.speed = $("opt-speed");
    ui.look = $("opt-look");
    ui.speed.value = store.get("dino-come-come-velocidade") || "devagar";
    ui.look.value = store.get("dino-come-come-visual") || "natureza";
    const theme = () => (ui.look.value === "fliperama" ? arcadeTheme(MAZES.indexOf(G.maze)) : (G.maze || MAZES[0]).theme);
    const speedMult = () => SPEED_MULT[ui.speed.value] || 0.9;
    const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

    // ---------- Estado ----------
    const G = {
        state: "menu", paused: false,
        diffKey: "normal", diff: DIFFS.normal, mazeMode: "seq",
        score: 0, record: 0, lives: 3, level: 1, extraNext: 10000,
        stateT: 0, clock: 0,
        maze: null, grid: null, rows: 0, doorRow: 0, houseY: 0, seedsLeft: 0, seedsTotal: 0,
        player: null, ghosts: [],
        modeIdx: 0, modeT: 0, schedule: [],
        frightT: 0, frightTotal: 0, combo: 0, pulseT: 0,
        freezeT: 0, fruit: null, fruitsEaten: [], seedsEaten: 0, seedsSinceLife: 0, idleT: 0, releaseCd: 0,
        roar: 0, wave: null,
        popups: [], particles: [], banner: null,
    };

    // ---------- Labirinto ----------
    const buildGrid = (def) => def.left.map((l) => (l + [...l.slice(0, MID)].reverse().join("")).split(""));

    const tileAt = (c, r) => {
        if (r < 0 || r >= G.rows) return "#";
        if (c < 0 || c >= COLS) {
            if (G.grid[r][0] !== "t") return "#";
            c = ((c % COLS) + COLS) % COLS;
        }
        return G.grid[r][c];
    };
    const open = (c, r) => {
        const t = tileAt(c, r);
        return t !== "#" && t !== "-" && t !== "n";
    };
    const isWall = (c, r) => r >= 0 && r < G.rows && c >= 0 && c < COLS && G.grid[r][c] === "#";

    const mazeIndexFor = (level) => (G.mazeMode === "seq" ? (level - 1) % MAZES.length : Number(G.mazeMode));

    const loadMaze = () => {
        const def = MAZES[mazeIndexFor(G.level)];
        G.maze = def;
        G.grid = buildGrid(def);
        G.rows = G.grid.length;
        G.doorRow = G.grid.findIndex((row) => row[MID] === "-");
        G.houseY = G.doorRow + 1.5;
        G.seedsLeft = 0;
        for (const row of G.grid) for (const ch of row) if (ch === "." || ch === "o") G.seedsLeft++;
        G.seedsTotal = G.seedsLeft;
        G.seedsEaten = 0;
        G.fruit = null;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme().bg);
        layout();
    };

    // ---------- Velocidades e tempos ----------
    const playerSpeed = () => speedMult() * 8 * (1 + 0.02 * Math.min(G.level - 1, 5)) * (G.frightT > 0 ? 1.06 : 1);
    const ghostBase = () => speedMult() * 7 * (1 + 0.035 * Math.min(G.level - 1, 8)) * G.diff.ghost;
    const frightDuration = () => Math.max(G.diff.frightMin, G.diff.fright - 0.7 * (G.level - 1));
    const elroy = () => (G.seedsLeft <= 10 ? 2 : G.seedsLeft <= 22 ? 1 : 0);

    const makeSchedule = () => {
        if (G.level === 1) return [7, 20, 7, 20, 5, 20, 5, Infinity];
        if (G.level < 5) return [7, 20, 7, 20, 5, 40, 2, Infinity];
        return [5, 20, 5, 20, 5, 50, 1, Infinity];
    };
    const isChase = () => G.modeIdx % 2 === 1;

    const releaseThreshold = (i) => {
        const base = G.level === 1 ? [0, 0, 14, 38] : G.level === 2 ? [0, 0, 4, 22] : [0, 0, 0, 0];
        return Math.round(base[i] * G.diff.release);
    };

    // ---------- Personagens ----------
    const resetActors = () => {
        G.player = { x: MID, y: G.maze.start, dir: -1, want: -1, face: 3, mouth: 0, moving: false, deathT: 0 };
        const hx = [MID, MID, MID - 1.5, MID + 1.5];
        G.ghosts = RAPTORS.map((info, i) => ({
            i, info,
            x: hx[i], y: i === 0 ? G.doorRow - 1 : G.houseY,
            dir: i === 0 ? 3 : -1, face: i % 2 ? 1 : 3,
            state: i === 0 ? "active" : "house",
            fright: false, stunT: 0, anim: Math.random() * 6,
        }));
        G.modeIdx = 0;
        G.schedule = makeSchedule();
        G.modeT = G.schedule[0];
        G.frightT = 0;
        G.combo = 0;
        G.freezeT = 0;
        G.idleT = 0;
        G.releaseCd = 0;
        G.seedsSinceLife = 0;
        G.wave = null;
        G.popups = [];
    };

    // Move uma entidade pela grade; onCenter é chamado em cada centro de casa para decidir a direção.
    const advance = (e, dist, onCenter) => {
        for (let guard = 0; dist > 1e-7 && guard < 10; guard++) {
            const atCenter = Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6;
            if (atCenter) {
                e.x = Math.round(e.x);
                e.y = Math.round(e.y);
                onCenter(e);
            }
            if (e.dir < 0) return;
            const [dx, dy] = DIRS[e.dir];
            if (dx) {
                const target = dx > 0 ? Math.floor(e.x + 1e-6) + 1 : Math.ceil(e.x - 1e-6) - 1;
                const d = Math.abs(target - e.x);
                if (dist >= d) { e.x = target; dist -= d; } else { e.x += dx * dist; dist = 0; }
                if (e.x < -0.5) e.x += COLS;
                else if (e.x > COLS - 0.5) e.x -= COLS;
            } else {
                const target = dy > 0 ? Math.floor(e.y + 1e-6) + 1 : Math.ceil(e.y - 1e-6) - 1;
                const d = Math.abs(target - e.y);
                if (dist >= d) { e.y = target; dist -= d; } else { e.y += dy * dist; dist = 0; }
            }
        }
    };

    const playerOnCenter = (p) => {
        if (p.want >= 0 && open(p.x + DIRS[p.want][0], p.y + DIRS[p.want][1])) p.dir = p.want;
        else if (p.dir >= 0 && !open(p.x + DIRS[p.dir][0], p.y + DIRS[p.dir][1])) p.dir = -1;
    };

    const ghostTarget = (g) => {
        const p = G.player;
        const pc = Math.round(p.x), pr = Math.round(p.y);
        const pf = p.dir >= 0 ? p.dir : p.face;
        const [fx, fy] = DIRS[pf];
        if (g.i === 0 && elroy() > 0) return [pc, pr];
        if (!isChase()) {
            return [[COLS - 2, -3], [1, -3], [COLS - 1, G.rows + 1], [0, G.rows + 1]][g.i];
        }
        switch (g.i) {
            case 0: return [pc, pr];
            case 1: return [pc + fx * 4, pr + fy * 4];
            case 2: {
                const b = G.ghosts[0];
                const ax = pc + fx * 2, ay = pr + fy * 2;
                return [ax * 2 - Math.round(b.x), ay * 2 - Math.round(b.y)];
            }
            default: {
                const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
                return d2 > 64 ? [pc, pr] : [0, G.rows + 1];
            }
        }
    };

    const ghostOnCenter = (g) => {
        if (g.state === "eaten" && g.x === MID && g.y === G.doorRow - 1) {
            g.state = "entering";
            g.dir = -1;
            return;
        }
        const opts = [];
        for (const d of TIE_ORDER) {
            if (d === OPP(g.dir)) continue;
            if (open(g.x + DIRS[d][0], g.y + DIRS[d][1])) opts.push(d);
        }
        if (!opts.length) { g.dir = OPP(g.dir); return; }
        if (g.fright) { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
        const [tx, ty] = g.state === "eaten" ? [MID, G.doorRow - 1] : ghostTarget(g);
        let best = opts[0], bestD = Infinity;
        for (const d of opts) {
            const nx = g.x + DIRS[d][0], ny = g.y + DIRS[d][1];
            const dd = (nx - tx) ** 2 + (ny - ty) ** 2;
            if (dd < bestD) { bestD = dd; best = d; }
        }
        g.dir = best;
    };

    const ghostSpeed = (g) => {
        if (g.state === "eaten") return 15 * speedMult();
        if (g.state === "entering") return 9 * speedMult();
        if (g.state === "house" || g.state === "leaving") return 3.5 * speedMult();
        const t = tileAt(Math.round(g.x), Math.round(g.y));
        const base = ghostBase();
        if (t === "t" || g.x < 0 || g.x > COLS - 1) return base * 0.5;
        if (g.fright) return base * 0.58;
        if (g.i === 0) return base * (1 + 0.06 * elroy());
        return base;
    };

    // Movimento em linha reta (dentro do ninho); devolve true ao chegar.
    const slide = (g, tx, ty, dist) => {
        if (g.x !== tx) {
            const d = tx - g.x;
            if (Math.abs(d) <= dist) { dist -= Math.abs(d); g.x = tx; } else { g.x += Math.sign(d) * dist; g.face = d > 0 ? 1 : 3; return false; }
        }
        const d = ty - g.y;
        if (Math.abs(d) <= dist) { g.y = ty; return true; }
        g.y += Math.sign(d) * dist;
        return false;
    };

    const updateGhost = (g, dt) => {
        g.anim += dt * (g.fright ? 9 : 7);
        if (g.stunT > 0) { g.stunT -= dt; return; }
        const dist = ghostSpeed(g) * dt;
        switch (g.state) {
            case "house":
                g.y = G.houseY + Math.sin(G.clock * 5 + g.i * 1.7) * 0.2;
                break;
            case "leaving":
                if (g.x !== MID) slide(g, MID, G.houseY, dist);
                else if (slide(g, MID, G.doorRow - 1, dist)) {
                    g.state = "active";
                    g.x = MID;
                    g.y = G.doorRow - 1;
                    g.dir = Math.random() < 0.5 ? 3 : 1;
                    g.face = g.dir;
                }
                break;
            case "entering":
                if (slide(g, MID, G.houseY, dist)) {
                    g.state = "leaving";
                    g.fright = false;
                }
                break;
            default:
                advance(g, dist, ghostOnCenter);
                if (g.dir === 1 || g.dir === 3) g.face = g.dir;
        }
    };

    const releaseGhosts = (dt) => {
        G.releaseCd -= dt;
        G.idleT += dt;
        if (G.releaseCd > 0) return;
        const g = G.ghosts.find((x) => x.state === "house");
        if (!g) return;
        if (G.seedsSinceLife >= releaseThreshold(g.i) || G.idleT >= 4 * G.diff.release) {
            g.state = "leaving";
            G.idleT = 0;
            G.releaseCd = 0.7;
        }
    };

    // ---------- Regras ----------
    const addScore = (pts) => {
        G.score += pts;
        if (G.score >= G.extraNext) {
            G.extraNext += G.extraNext === 10000 ? 15000 : 25000;
            G.lives++;
            Sound.extraLife();
            popup(G.player.x, G.player.y - 1, "+1 VIDA", "#7ee08f", 1.6);
        }
        if (G.score > G.record) G.record = G.score;
    };

    const popup = (x, y, text, color = "#fff", life = 1.1) => G.popups.push({ x, y, text, color, t: 0, life });

    const burst = (x, y, color, n = 14, speed = 4) => {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.4 + Math.random());
            G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.45 + Math.random() * 0.4, color });
        }
    };

    const startFright = () => {
        const t = frightDuration();
        G.combo = 0;
        G.frightT = t;
        G.frightTotal = t;
        G.pulseT = 0;
        for (const g of G.ghosts) {
            if (g.state === "eaten" || g.state === "entering") continue;
            if (g.state === "active" && g.dir >= 0) g.dir = OPP(g.dir);
            g.fright = true;
        }
    };

    const eatAt = () => {
        const p = G.player;
        const c = ((Math.round(p.x) % COLS) + COLS) % COLS, r = Math.round(p.y);
        const ch = G.grid[r]?.[c];
        if (ch !== "." && ch !== "o") return;
        G.grid[r][c] = " ";
        G.seedsLeft--;
        G.seedsEaten++;
        G.seedsSinceLife++;
        G.idleT = 0;
        const wasFull = G.roar >= 1;
        if (ch === ".") {
            addScore(10);
            G.roar = Math.min(1, G.roar + 1 / SEEDS_FOR_ROAR);
            Sound.seed();
        } else {
            addScore(50);
            G.roar = Math.min(1, G.roar + 0.12);
            Sound.star();
            burst(c, r, theme().star, 16, 5);
            startFright();
        }
        if (!wasFull && G.roar >= 1) {
            Sound.roarReady();
            popup(p.x, p.y - 1, "RUGIDO PRONTO!", "#ffd94d", 1.4);
        }
        if (G.seedsEaten === 70 || G.seedsEaten === 170) {
            const [emoji, pts] = FRUITS[Math.min(G.level - 1, FRUITS.length - 1)];
            G.fruit = { x: MID, y: G.doorRow + 4, emoji, pts, t: 9.5 };
        }
        if (G.seedsLeft === 0) {
            setState("clear");
            Sound.clear();
        }
    };

    const roar = () => {
        if (G.state !== "play" || G.roar < 1 || G.freezeT > 0) return;
        G.roar = 0;
        G.wave = { x: G.player.x, y: G.player.y, t: 0 };
        Sound.roar();
        navigator.vibrate?.(60);
        let hit = 0;
        for (const g of G.ghosts) {
            if (g.state !== "active" && g.state !== "leaving") continue;
            if ((g.x - G.player.x) ** 2 + (g.y - G.player.y) ** 2 <= ROAR_RADIUS ** 2) {
                g.stunT = ROAR_STUN;
                hit++;
            }
        }
        popup(G.player.x, G.player.y - 1.2, hit ? `ROAAAR! ×${hit}` : "ROAAAR!", "#ffd94d", 1.2);
    };

    const eatGhost = (g) => {
        G.combo++;
        const pts = 200 * 2 ** (G.combo - 1);
        addScore(pts);
        popup(g.x, g.y, String(pts), "#7cf2ff");
        burst(g.x, g.y, g.info.color, 18, 5);
        g.state = "eaten";
        g.fright = false;
        g.stunT = 0;
        G.freezeT = 0.5;
        Sound.eatRaptor(G.combo);
        if (G.combo === 4) {
            addScore(1200);
            G.banner = { text: "SUPER COMBO! +1200", t: 0, life: 1.8 };
        }
    };

    const die = () => {
        setState("dying");
        G.player.deathT = 0;
        Sound.die();
        navigator.vibrate?.([80, 60, 120]);
    };

    const checkCollisions = () => {
        const p = G.player;
        for (const g of G.ghosts) {
            if (g.state === "eaten" || g.state === "entering" || g.state === "house") continue;
            let dx = Math.abs(g.x - p.x);
            if (dx > COLS / 2) dx = COLS - dx;
            const dy = g.y - p.y;
            if (dx * dx + dy * dy > 0.42) continue;
            if (g.fright) eatGhost(g);
            else if (g.stunT <= 0) { die(); return; }
        }
        const f = G.fruit;
        if (f && Math.abs(f.x - p.x) < 0.6 && Math.abs(f.y - p.y) < 0.6) {
            addScore(f.pts);
            popup(f.x, f.y, String(f.pts), "#ffd94d", 1.4);
            G.fruitsEaten.push(f.emoji);
            if (G.fruitsEaten.length > 7) G.fruitsEaten.shift();
            G.fruit = null;
            Sound.fruit();
        }
    };

    const setState = (s) => {
        G.state = s;
        G.stateT = 0;
    };

    // ---------- Partida ----------
    const newGame = () => {
        Sound.init();
        G.diffKey = ui.diff.value;
        G.diff = DIFFS[G.diffKey];
        G.mazeMode = ui.maze.value;
        G.score = 0;
        G.lives = G.diff.lives;
        G.level = 1;
        G.extraNext = 10000;
        G.roar = 0;
        G.fruitsEaten = [];
        G.record = Number(store.get(recordKey())) || 0;
        G.particles = [];
        loadMaze();
        resetActors();
        G.banner = null;
        setState("ready");
        G.readyTime = 2.6;
        Sound.start();
        showPanel(null);
        canvas.focus();
    };

    const nextLevel = () => {
        G.level++;
        loadMaze();
        resetActors();
        G.banner = { text: `FASE ${G.level} · ${G.maze.name.toUpperCase()}`, t: 0, life: 2 };
        setState("ready");
        G.readyTime = 1.8;
    };

    const recordKey = () => `dino-come-come-recorde-${G.diffKey}`;

    const saveRecord = () => {
        const old = Number(store.get(recordKey())) || 0;
        const isNew = G.score > old;
        if (isNew) {
            store.set(recordKey(), String(G.score));
            store.set(`${recordKey()}-fase`, String(G.level));
        }
        return isNew;
    };

    const gameOver = () => {
        setState("over");
        Sound.gameOver();
        const isNew = saveRecord();
        ui.overTitle.textContent = isNew && G.score > 0 ? "Novo recorde! 🏆" : "Fim de jogo";
        ui.overScore.innerHTML = `<b>${G.score.toLocaleString("pt-BR")}</b><br>pontos · chegou à fase ${G.level}`;
        ui.overRecord.textContent = `Recorde no ${G.diff.name}: ${Math.max(G.score, Number(store.get(recordKey())) || 0).toLocaleString("pt-BR")}`;
        setTimeout(() => { if (G.state === "over") { showPanel(ui.over); ui.again.focus(); } }, 1400);
    };

    // ---------- Atualização ----------
    const update = (dt) => {
        G.clock += dt;
        G.stateT += dt;
        for (const pp of G.popups) pp.t += dt;
        G.popups = G.popups.filter((pp) => pp.t < pp.life);
        for (const pa of G.particles) { pa.t += dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vx *= 0.94; pa.vy *= 0.94; }
        G.particles = G.particles.filter((pa) => pa.t < pa.life);
        if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
        if (G.wave) { G.wave.t += dt; if (G.wave.t > 0.6) G.wave = null; }

        switch (G.state) {
            case "ready":
                for (const g of G.ghosts) if (g.state === "house") g.y = G.houseY + Math.sin(G.clock * 5 + g.i * 1.7) * 0.2;
                if (G.stateT >= G.readyTime) setState("play");
                return;
            case "dying":
                G.player.deathT += dt;
                if (G.stateT >= 2) {
                    G.lives--;
                    if (G.lives <= 0) { gameOver(); return; }
                    resetActors();
                    setState("ready");
                    G.readyTime = 1.6;
                }
                return;
            case "clear":
                if (G.stateT >= 2.6) nextLevel();
                return;
            case "play":
                break;
            default:
                return;
        }

        if (G.freezeT > 0) {
            G.freezeT -= dt;
            // Durante a pausa curta depois de comer um raptor, os ossinhos continuam voltando.
            for (const g of G.ghosts) if (g.state === "eaten" || g.state === "entering") updateGhost(g, dt);
            return;
        }

        // Modos espalhar/perseguir (o relógio para enquanto os raptores têm medo).
        if (G.frightT > 0) {
            G.frightT -= dt;
            G.pulseT -= dt;
            if (G.pulseT <= 0) {
                Sound.frightPulse(G.frightT < 2);
                G.pulseT = G.frightT < 2 ? 0.18 : 0.3;
            }
            if (G.frightT <= 0) for (const g of G.ghosts) g.fright = false;
        } else {
            G.modeT -= dt;
            if (G.modeT <= 0 && G.modeIdx < G.schedule.length - 1) {
                G.modeIdx++;
                G.modeT = G.schedule[G.modeIdx];
                for (const g of G.ghosts) if (g.state === "active" && g.dir >= 0 && g.stunT <= 0) g.dir = OPP(g.dir);
            }
        }

        // Dino
        const p = G.player;
        if (p.want >= 0 && p.dir >= 0 && p.want === OPP(p.dir)) p.dir = p.want;
        const bx = p.x, by = p.y;
        advance(p, playerSpeed() * dt, playerOnCenter);
        p.moving = p.x !== bx || p.y !== by;
        if (p.dir >= 0) p.face = p.dir;
        if (p.moving) p.mouth += dt * 14;
        eatAt();
        if (G.state !== "play") return;

        releaseGhosts(dt);
        for (const g of G.ghosts) updateGhost(g, dt);
        checkCollisions();

        if (G.fruit) {
            G.fruit.t -= dt;
            if (G.fruit.t <= 0) G.fruit = null;
        }
    };

    // ---------- Desenho ----------
    const L = { ts: 24, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, bottomReserve: 0 };
    let wallCache = null;

    const touchPad = () => isTouch && ui.touchMode.value === "pad";

    function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        L.dpr = dpr;
        L.w = w;
        L.h = h;
        const portrait = h > w * 1.1;
        L.bottomReserve = isTouch && portrait ? (touchPad() ? 196 : 96) : 0;
        const rows = G.rows || 22;
        const availH = h - L.bottomReserve - 6;
        // Em paisagem com toque, deixa espaço dos lados para os botões.
        const sideReserve = isTouch && !portrait ? (touchPad() ? 380 : 190) : 0;
        L.ts = Math.max(8, Math.min((w - 8 - sideReserve) / COLS, availH / (rows + 3.4)));
        L.ox = Math.round((w - COLS * L.ts) / 2);
        L.oy = Math.round(Math.max(4, (availH - (rows + 3.4) * L.ts) / 2) + 1.7 * L.ts);
        wallCache = null;
    }

    const px = (x) => L.ox + (x + 0.5) * L.ts;
    const py = (y) => L.oy + (y + 0.5) * L.ts;

    // Paredes como "canos" arredondados ligando o centro das casas de parede vizinhas.
    const buildWalls = () => {
        const ts = L.ts, th = theme();
        const c = document.createElement("canvas");
        c.width = Math.ceil(COLS * ts * L.dpr);
        c.height = Math.ceil(G.rows * ts * L.dpr);
        const g = c.getContext("2d");
        g.scale(L.dpr, L.dpr);
        // casa de parede cercada de parede por todos os lados (miolo de um bloco grande)
        const inner = (c0, r0) => {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWall(c0 + dx, r0 + dy)) return false;
            return true;
        };
        const pass = (width, color, blur = 0, blocks = true) => {
            g.save();
            g.strokeStyle = color;
            g.fillStyle = color;
            g.lineWidth = width;
            g.lineCap = "round";
            if (blur) { g.shadowColor = color; g.shadowBlur = blur; }
            g.lineJoin = "round";
            // Linhas entre centros de paredes vizinhas: com ponta e junção arredondadas
            // formam paredes lisas, com os cantos arredondados.
            g.beginPath();
            const dots = [];
            for (let r = 0; r < G.rows; r++) {
                for (let col = 0; col < COLS; col++) {
                    if (!isWall(col, r) || (!blocks && inner(col, r))) continue;
                    const x = (col + 0.5) * ts, y = (r + 0.5) * ts;
                    const right = isWall(col + 1, r) && (blocks || !inner(col + 1, r));
                    const down = isWall(col, r + 1) && (blocks || !inner(col, r + 1));
                    if (right) { g.moveTo(x, y); g.lineTo(x + ts, y); }
                    if (down) { g.moveTo(x, y); g.lineTo(x, y + ts); }
                    if (!right && !down && !isWall(col - 1, r) && !isWall(col, r - 1)) dots.push([x, y]);
                }
            }
            g.stroke();
            g.beginPath();
            for (const [x, y] of dots) { g.moveTo(x + width / 2, y); g.arc(x, y, width / 2, 0, Math.PI * 2); }
            g.fill();
            for (let r = 0; blocks && r < G.rows - 1; r++) {
                for (let col = 0; col < COLS - 1; col++) {
                    if (isWall(col, r) && isWall(col + 1, r) && isWall(col, r + 1) && isWall(col + 1, r + 1)) {
                        g.fillRect((col + 0.5) * ts, (r + 0.5) * ts, ts, ts);
                    }
                }
            }
            g.restore();
        };
        if (th.arcade) {
            // contorno de neon com o miolo preto
            pass(ts * 0.6, th.wallEdge, ts * 0.35);
            pass(ts * 0.6 - Math.max(2, ts * 0.1), th.wall);
        } else {
            pass(ts * 0.6, th.wallEdge, ts * 0.3);
            pass(ts * 0.48, th.wall);
        }
        // Porta do ninho
        g.fillStyle = th.door;
        g.fillRect((MID - 0.5) * ts, (G.doorRow + 0.38) * ts, ts * 2, ts * 0.22);
        g.fillRect((MID - 1.5) * ts + 0, (G.doorRow + 0.38) * ts, ts, ts * 0.22);
        wallCache = c;
    };

    const drawBackground = () => {
        const th = G.maze ? theme() : MAZES[0].theme;
        cx.fillStyle = th.bg;
        cx.fillRect(0, 0, L.w, L.h);
        const grd = cx.createRadialGradient(L.w / 2, L.h / 2, 10, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.7);
        grd.addColorStop(0, "rgba(255,255,255,0.05)");
        grd.addColorStop(1, "rgba(0,0,0,0.45)");
        cx.fillStyle = grd;
        cx.fillRect(0, 0, L.w, L.h);
    };

    const drawSeeds = (t) => {
        const ts = L.ts, th = theme();
        cx.fillStyle = th.seed;
        cx.beginPath();
        for (let r = 0; r < G.rows; r++) {
            for (let c = 0; c < COLS; c++) {
                if (G.grid[r][c] !== ".") continue;
                const x = px(c), y = py(r);
                cx.moveTo(x + ts * 0.11, y);
                if (th.arcade) cx.arc(x, y, ts * 0.1, 0, Math.PI * 2);
                else cx.ellipse(x, y, ts * 0.11, ts * 0.085, 0.5, 0, Math.PI * 2);
            }
        }
        cx.fill();
        for (let r = 0; r < G.rows; r++) {
            for (let c = 0; c < COLS; c++) {
                if (G.grid[r][c] === "o" && th.arcade) {
                    if (Math.floor(t * 4) % 2) continue; // pisca
                    cx.fillStyle = th.star;
                    cx.beginPath();
                    cx.arc(px(c), py(r), ts * 0.32, 0, Math.PI * 2);
                    cx.fill();
                } else if (G.grid[r][c] === "o") drawStar(px(c), py(r), ts * (0.36 + Math.sin(t * 6) * 0.05), th.star, t);
            }
        }
    };

    const drawStar = (x, y, rad, color, t) => {
        cx.save();
        cx.translate(x, y);
        cx.rotate(Math.sin(t * 2) * 0.3);
        cx.shadowColor = color;
        cx.shadowBlur = rad * 1.2;
        cx.fillStyle = color;
        cx.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 ? rad * 0.45 : rad;
            cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        cx.closePath();
        cx.fill();
        cx.shadowBlur = 0;
        cx.fillStyle = "rgba(255,255,255,0.7)";
        cx.beginPath();
        cx.arc(-rad * 0.12, -rad * 0.15, rad * 0.16, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
    };

    const roundRect = (x, y, w, h, r) => {
        cx.beginPath();
        cx.moveTo(x + r, y);
        cx.arcTo(x + w, y, x + w, y + h, r);
        cx.arcTo(x + w, y + h, x, y + h, r);
        cx.arcTo(x, y + h, x, y, r);
        cx.arcTo(x, y, x + w, y, r);
        cx.closePath();
    };

    // Dino filhote: redondinho, olhos grandes e bochecha rosada; abre e fecha a boca para comer.
    // Desenho base virado para a direita.
    const drawDino = (x, y, size, dir, mouth, opts = {}) => {
        cx.save();
        cx.translate(x, y);
        if (opts.spin) cx.rotate(opts.spin);
        if (dir === 3) cx.scale(-1, 1);
        else if (dir === 0) cx.rotate(-Math.PI / 2);
        else if (dir === 2) cx.rotate(Math.PI / 2);
        const s = size * (opts.scale ?? 1);
        cx.scale(s, s);
        cx.lineWidth = 0.09;
        cx.strokeStyle = "#0e5a43";
        cx.lineJoin = "round";
        const green = opts.glow ? "#6ff5cf" : "#3fd6a8";
        // rabinho
        cx.fillStyle = green;
        cx.beginPath();
        cx.moveTo(-0.7, 0.2);
        cx.quadraticCurveTo(-1.2, 0.35, -1.18, 0.62);
        cx.quadraticCurveTo(-0.9, 0.6, -0.6, 0.55);
        cx.closePath();
        cx.fill();
        cx.stroke();
        // espinhos arredondados nas costas
        cx.fillStyle = "#ffb52e";
        for (const a of [-2.0, -2.55, -1.5]) {
            cx.save();
            cx.rotate(a);
            cx.translate(0.9, 0);
            cx.beginPath();
            cx.moveTo(0, -0.2);
            cx.quadraticCurveTo(0.42, 0, 0, 0.2);
            cx.closePath();
            cx.fill();
            cx.stroke();
            cx.restore();
        }
        // corpo redondo com a boca (fatia) abrindo e fechando
        const open = opts.dizzy ? 0.15 : 0.06 + Math.abs(Math.sin(mouth)) * 0.62;
        const ax = 0.12, ay = 0.16;
        cx.fillStyle = green;
        cx.beginPath();
        cx.moveTo(ax, ay);
        cx.arc(0, 0, 0.95, open, Math.PI * 2 - open * 0.55);
        cx.closePath();
        cx.fill();
        cx.stroke();
        // barriga clarinha
        cx.save();
        cx.clip();
        cx.fillStyle = "#b9f7e0";
        cx.beginPath();
        cx.ellipse(-0.2, 0.75, 0.62, 0.5, 0, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
        // dentinho
        const tipX = Math.cos(-open * 0.55) * 0.82, tipY = Math.sin(-open * 0.55) * 0.82;
        cx.fillStyle = "#fff";
        cx.beginPath();
        cx.moveTo(tipX - 0.2, tipY + 0.02);
        cx.lineTo(tipX - 0.1, tipY + 0.2);
        cx.lineTo(tipX, tipY + 0.04);
        cx.closePath();
        cx.fill();
        // bochecha
        cx.fillStyle = "rgba(255,120,150,0.55)";
        cx.beginPath();
        cx.ellipse(-0.08, -0.08, 0.16, 0.11, 0, 0, Math.PI * 2);
        cx.fill();
        // olho grande
        cx.fillStyle = "#fff";
        cx.beginPath();
        cx.arc(0.12, -0.46, 0.3, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();
        if (opts.dizzy) {
            cx.strokeStyle = "#1b1b3a";
            cx.lineWidth = 0.08;
            cx.beginPath();
            cx.arc(0.12, -0.46, 0.14, 0, Math.PI * 1.6);
            cx.stroke();
        } else {
            cx.fillStyle = "#1b1b3a";
            cx.beginPath();
            cx.arc(0.2, -0.44, 0.18, 0, Math.PI * 2);
            cx.fill();
            cx.fillStyle = "#fff";
            cx.beginPath();
            cx.arc(0.25, -0.52, 0.065, 0, Math.PI * 2);
            cx.arc(0.14, -0.38, 0.035, 0, Math.PI * 2);
            cx.fill();
        }
        cx.restore();
    };

    const drawRaptor = (g, t) => {
        const ts = L.ts;
        const x = px(g.x), y = py(g.y);
        const s = ts * 0.44;
        cx.save();
        cx.translate(x, y);
        if (g.state === "eaten" || g.state === "entering") {
            // ossinho com olhinhos voltando para o ninho
            cx.rotate(Math.sin(t * 10) * 0.25);
            cx.fillStyle = "#f4efe2";
            cx.strokeStyle = "#7a6a4f";
            cx.lineWidth = 1.2;
            const bw = s * 0.75;
            roundRect(-bw, -s * 0.13, bw * 2, s * 0.26, s * 0.1);
            cx.fill();
            for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
                cx.beginPath();
                cx.arc(sx * bw, sy * s * 0.16, s * 0.2, 0, Math.PI * 2);
                cx.fill();
            }
            cx.fillStyle = "#fff";
            for (const ex of [-0.3, 0.3]) {
                cx.beginPath();
                cx.arc(ex * s, -s * 0.55, s * 0.22, 0, Math.PI * 2);
                cx.fill();
            }
            const [dx, dy] = g.dir >= 0 ? DIRS[g.dir] : [0, 0];
            cx.fillStyle = "#1a1a40";
            for (const ex of [-0.3, 0.3]) {
                cx.beginPath();
                cx.arc(ex * s + dx * s * 0.08, -s * 0.55 + dy * s * 0.08, s * 0.11, 0, Math.PI * 2);
                cx.fill();
            }
            cx.restore();
            return;
        }

        const flashing = g.fright && G.frightT < 2 && Math.floor(G.frightT * 6) % 2 === 0;
        let body = g.info.color, dark = g.info.dark, crest = g.info.crest;
        if (g.fright) {
            body = flashing ? "#f0f0ff" : "#5b4fe0";
            dark = flashing ? "#b0b0d0" : "#2d2580";
            crest = flashing ? "#ffffff" : "#9d95ff";
        }
        if (g.fright) cx.translate(Math.sin(t * 40 + g.i) * ts * 0.03, 0);
        const flip = g.face === 3 ? -1 : 1;
        cx.scale(flip, 1);
        const step = Math.sin(g.anim * 2);
        cx.lineWidth = 1.3;
        cx.strokeStyle = dark;
        // cauda
        cx.fillStyle = body;
        cx.beginPath();
        cx.moveTo(-s * 0.5, -s * 0.05);
        cx.quadraticCurveTo(-s * 1.05, -s * 0.15 + step * s * 0.08, -s * 1.12, -s * 0.55);
        cx.quadraticCurveTo(-s * 0.85, s * 0.05, -s * 0.4, s * 0.3);
        cx.closePath();
        cx.fill();
        cx.stroke();
        // pernas
        cx.strokeStyle = dark;
        cx.lineWidth = s * 0.16;
        cx.lineCap = "round";
        cx.beginPath();
        cx.moveTo(-s * 0.2, s * 0.45); cx.lineTo(-s * 0.2 + step * s * 0.22, s * 0.92);
        cx.moveTo(s * 0.2, s * 0.45); cx.lineTo(s * 0.2 - step * s * 0.22, s * 0.92);
        cx.stroke();
        cx.lineWidth = 1.3;
        // penacho
        cx.fillStyle = crest;
        for (const [fx, fh] of [[-0.35, 0.42], [-0.05, 0.55], [0.25, 0.42]]) {
            cx.beginPath();
            cx.moveTo(fx * s - s * 0.13, -s * 0.62);
            cx.lineTo(fx * s - s * 0.05, -s * (0.62 + fh));
            cx.lineTo(fx * s + s * 0.13, -s * 0.62);
            cx.closePath();
            cx.fill();
        }
        // corpo
        cx.fillStyle = body;
        cx.strokeStyle = dark;
        cx.beginPath();
        cx.ellipse(0, 0, s * 0.68, s * 0.7, 0, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();
        // focinho
        cx.beginPath();
        cx.ellipse(s * 0.62, s * 0.08, s * 0.42, s * 0.26, 0.1, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();
        cx.fillStyle = dark;
        cx.beginPath();
        cx.arc(s * 0.92, -s * 0.02, s * 0.05, 0, Math.PI * 2);
        cx.fill();
        // boca
        cx.strokeStyle = g.fright ? "#fff" : dark;
        cx.lineWidth = 1.4;
        cx.beginPath();
        if (g.fright) {
            for (let i = 0; i <= 4; i++) cx.lineTo(s * (0.3 + i * 0.15), s * (0.22 + (i % 2 ? -0.06 : 0.04)));
        } else {
            cx.moveTo(s * 0.32, s * 0.2);
            cx.quadraticCurveTo(s * 0.7, s * 0.3, s * 1.0, s * 0.14);
        }
        cx.stroke();
        if (!g.fright) {
            cx.fillStyle = "#fff";
            for (const tx of [0.55, 0.78]) {
                cx.beginPath();
                cx.moveTo(s * tx, s * 0.24);
                cx.lineTo(s * (tx + 0.05), s * 0.36);
                cx.lineTo(s * (tx + 0.1), s * 0.22);
                cx.fill();
            }
        }
        // olhos
        const [dx, dy] = g.dir >= 0 ? DIRS[g.dir] : [0, 0];
        const lookX = dx * flip, lookY = dy;
        for (const ex of [0.0, 0.34]) {
            cx.fillStyle = "#fff";
            cx.beginPath();
            cx.arc(s * ex, -s * 0.22, s * (g.fright ? 0.15 : 0.2), 0, Math.PI * 2);
            cx.fill();
            if (g.stunT > 0) {
                cx.strokeStyle = "#1a1a40";
                cx.lineWidth = 1.5;
                cx.beginPath();
                cx.moveTo(s * (ex - 0.1), -s * 0.32); cx.lineTo(s * (ex + 0.1), -s * 0.12);
                cx.moveTo(s * (ex + 0.1), -s * 0.32); cx.lineTo(s * (ex - 0.1), -s * 0.12);
                cx.stroke();
            } else if (!g.fright) {
                cx.fillStyle = "#1a1a40";
                cx.beginPath();
                cx.arc(s * (ex + lookX * 0.07 + 0.03), -s * 0.22 + lookY * s * 0.07, s * 0.1, 0, Math.PI * 2);
                cx.fill();
            } else {
                cx.fillStyle = flashing ? "#d03030" : "#fff";
                cx.beginPath();
                cx.arc(s * ex, -s * 0.22, s * 0.06, 0, Math.PI * 2);
                cx.fill();
            }
        }
        cx.restore();
        // estrelinhas de tontura
        if (g.stunT > 0) {
            cx.save();
            cx.translate(x, y - ts * 0.55);
            for (let i = 0; i < 3; i++) {
                const a = t * 6 + (i * Math.PI * 2) / 3;
                drawStar(Math.cos(a) * ts * 0.32, Math.sin(a) * ts * 0.1, ts * 0.1, "#ffd94d", t);
            }
            cx.restore();
        }
    };

    const drawHUD = () => {
        const ts = L.ts, th = theme();
        const top = L.oy - 1.5 * ts;
        const fs = Math.max(11, ts * 0.62);
        cx.textBaseline = "top";
        cx.font = `700 ${fs * 0.72}px system-ui, sans-serif`;
        cx.fillStyle = "rgba(255,255,255,0.6)";
        cx.textAlign = "left";
        cx.fillText("PONTOS", L.ox + ts * 0.3, top);
        cx.textAlign = "center";
        cx.fillText("RECORDE", L.ox + COLS * ts / 2, top);
        cx.textAlign = "right";
        cx.fillText(`FASE ${G.level}`, L.ox + COLS * ts - ts * 0.3, top);
        cx.font = `800 ${fs}px system-ui, sans-serif`;
        cx.fillStyle = th.text;
        cx.textAlign = "left";
        cx.fillText(G.score.toLocaleString("pt-BR"), L.ox + ts * 0.3, top + fs * 0.8);
        cx.textAlign = "center";
        cx.fillStyle = "#ffd94d";
        cx.fillText(Math.max(G.record, G.score).toLocaleString("pt-BR"), L.ox + COLS * ts / 2, top + fs * 0.8);
        cx.textAlign = "right";
        cx.fillStyle = th.text;
        cx.fillText(G.maze.name, L.ox + COLS * ts - ts * 0.3, top + fs * 0.8);

        // rodapé: vidas, rugido, frutas
        const by = L.oy + G.rows * ts + ts * 0.15;
        const lives = Math.max(0, G.lives - (G.state === "play" || G.state === "dying" ? 1 : 0));
        for (let i = 0; i < Math.min(lives, 6); i++) drawDino(L.ox + ts * (0.8 + i * 1.25), by + ts * 0.6, ts * 0.36, 1, 0.3);
        if (lives > 6) {
            cx.font = `700 ${fs * 0.7}px system-ui`;
            cx.textAlign = "left";
            cx.fillStyle = th.text;
            cx.fillText(`+${lives - 6}`, L.ox + ts * 8.1, by + ts * 0.3);
        }
        const mw = ts * 5.2, mx = L.ox + COLS * ts / 2 - mw / 2, my = by + ts * 0.38, mh = ts * 0.42;
        cx.fillStyle = "rgba(255,255,255,0.12)";
        roundRect(mx, my, mw, mh, mh / 2);
        cx.fill();
        const full = G.roar >= 1;
        cx.fillStyle = full ? `hsl(${45 + Math.sin(G.clock * 8) * 10},100%,60%)` : "#34cca3";
        if (G.roar > 0.02) {
            roundRect(mx, my, Math.max(mh, mw * G.roar), mh, mh / 2);
            cx.fill();
        }
        cx.font = `800 ${mh * 0.78}px system-ui`;
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillStyle = full ? "#2a1a00" : "#fff";
        cx.fillText(full ? (isTouch ? "RUGIDO! 🦖" : "RUGIDO! (ESPAÇO)") : "RUGIDO", mx + mw / 2, my + mh / 2 + 1);
        cx.font = `${ts * 0.62}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        cx.textAlign = "right";
        G.fruitsEaten.forEach((f, i) => cx.fillText(f, L.ox + COLS * ts - ts * (0.3 + i * 0.85), by + ts * 0.6));
        cx.textBaseline = "alphabetic";
    };

    const textCenter = (text, y, color, size) => {
        cx.font = `900 ${size}px system-ui, sans-serif`;
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.lineWidth = Math.max(3, size * 0.18);
        cx.strokeStyle = "rgba(0,0,0,0.85)";
        cx.strokeText(text, L.ox + COLS * L.ts / 2, y);
        cx.fillStyle = color;
        cx.fillText(text, L.ox + COLS * L.ts / 2, y);
        cx.textBaseline = "alphabetic";
    };

    const render = (t) => {
        cx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
        drawBackground();
        if (!G.maze) return;
        const ts = L.ts;
        if (!wallCache) buildWalls();

        // labirinto
        const clearFlash = G.state === "clear" && G.stateT > 0.6 && Math.floor(G.stateT * 5) % 2 === 0;
        cx.save();
        if (clearFlash) cx.filter = "brightness(2.2) saturate(0.3)";
        cx.drawImage(wallCache, L.ox, L.oy, COLS * ts, G.rows * ts);
        cx.restore();

        // túneis: esmaece as bordas
        for (let r = 0; r < G.rows; r++) {
            if (G.grid[r][0] !== "t") continue;
            for (const side of [0, 1]) {
                const x0 = side ? L.ox + (COLS - 1.5) * ts : L.ox;
                const grd = cx.createLinearGradient(x0, 0, x0 + ts * 1.5, 0);
                const bg = theme().bg;
                grd.addColorStop(side ? 1 : 0, bg);
                grd.addColorStop(side ? 0 : 1, bg + "00");
                cx.fillStyle = grd;
                cx.fillRect(x0, L.oy + (r - 0.1) * ts, ts * 1.5, ts * 1.2);
            }
        }

        drawSeeds(t);

        if (G.fruit) {
            const f = G.fruit;
            if (f.t > 2 || Math.floor(f.t * 6) % 2) {
                cx.font = `${ts * 0.95}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
                cx.textAlign = "center";
                cx.textBaseline = "middle";
                cx.fillText(f.emoji, px(f.x), py(f.y) + Math.sin(t * 4) * ts * 0.06);
                cx.textBaseline = "alphabetic";
            }
        }

        // recorta para as entidades não aparecerem fora do labirinto nos túneis
        cx.save();
        cx.beginPath();
        cx.rect(L.ox, L.oy - ts, COLS * ts, (G.rows + 2) * ts);
        cx.clip();

        if (G.state !== "clear" && !(G.state === "dying" && G.stateT > 0.5)) {
            for (const g of G.ghosts) drawRaptor(g, t);
        }
        if (G.state !== "over") {
            const p = G.player;
            const draw = (dxOff) => {
                if (G.state === "dying") {
                    const k = Math.min(1, p.deathT / 1.6);
                    if (k < 1) drawDino(px(p.x + dxOff), py(p.y), ts * 0.46, p.face, 1.5, { spin: k * Math.PI * 5, scale: 1 - k * 0.9, dizzy: true });
                } else {
                    drawDino(px(p.x + dxOff), py(p.y), ts * 0.46, p.face, p.mouth, { glow: G.frightT > 0 });
                }
            };
            draw(0);
            if (p.x < 0.6) draw(COLS);
            if (p.x > COLS - 1.6) draw(-COLS);
        }
        cx.restore();

        // onda do rugido
        if (G.wave) {
            const k = G.wave.t / 0.6;
            cx.strokeStyle = `rgba(255,217,77,${1 - k})`;
            cx.lineWidth = ts * 0.25 * (1 - k) + 1;
            cx.beginPath();
            cx.arc(px(G.wave.x), py(G.wave.y), ROAR_RADIUS * ts * k, 0, Math.PI * 2);
            cx.stroke();
        }

        for (const pa of G.particles) {
            cx.globalAlpha = 1 - pa.t / pa.life;
            cx.fillStyle = pa.color;
            cx.beginPath();
            cx.arc(px(pa.x), py(pa.y), ts * 0.09, 0, Math.PI * 2);
            cx.fill();
        }
        cx.globalAlpha = 1;

        for (const pp of G.popups) {
            const k = pp.t / pp.life;
            cx.globalAlpha = Math.min(1, (1 - k) * 2);
            cx.font = `900 ${ts * 0.62}px system-ui, sans-serif`;
            cx.textAlign = "center";
            cx.lineWidth = 3;
            cx.strokeStyle = "rgba(0,0,0,0.8)";
            const yy = py(pp.y) - k * ts;
            cx.strokeText(pp.text, px(pp.x), yy);
            cx.fillStyle = pp.color;
            cx.fillText(pp.text, px(pp.x), yy);
        }
        cx.globalAlpha = 1;

        const msgY = py(G.doorRow + 4);
        if (G.state === "ready") textCenter("PREPARE-SE!", msgY, "#ffd94d", ts * 0.95);
        if (G.state === "over") textCenter("FIM DE JOGO", msgY, "#ef4444", ts * 1.05);
        if (G.state === "clear" && G.stateT > 0.4) textCenter("FASE COMPLETA!", msgY, "#7ee08f", ts * 0.95);
        if (G.banner) {
            const b = G.banner;
            cx.globalAlpha = Math.min(1, (b.life - b.t) * 3, b.t * 6);
            textCenter(b.text, py(G.doorRow - 2.6), "#ffd94d", ts * 0.8);
            cx.globalAlpha = 1;
        }
        if (G.paused) {
            cx.fillStyle = "rgba(0,0,0,0.35)";
            cx.fillRect(0, 0, L.w, L.h);
        }

        drawHUD();
        ui.tRoar.classList.toggle("ready", G.roar >= 1 && G.state === "play");
    };

    // Tela de fundo do menu: um labirinto de demonstração com os personagens andando.
    const demo = () => {
        G.mazeMode = "seq";
        G.level = 1 + Math.floor(Math.random() * MAZES.length);
        G.diff = DIFFS.normal;
        loadMaze();
        resetActors();
        G.level = 1;
        for (const g of G.ghosts) g.state = "active", g.x = MID, g.y = G.doorRow - 1, g.dir = g.i % 2 ? 1 : 3;
        G.player.dir = 3;
        G.state = "demo";
    };

    const updateDemo = (dt) => {
        G.clock += dt;
        const p = G.player;
        advance(p, 6 * dt, (e) => {
            const opts = [0, 1, 2, 3].filter((d) => d !== OPP(e.dir) && open(e.x + DIRS[d][0], e.y + DIRS[d][1]));
            e.dir = opts.length ? opts[Math.floor(Math.random() * opts.length)] : OPP(e.dir);
        });
        if (p.dir >= 0) p.face = p.dir;
        p.mouth += dt * 12;
        const c = ((Math.round(p.x) % COLS) + COLS) % COLS, r = Math.round(p.y);
        if (G.grid[r][c] === "." || G.grid[r][c] === "o") G.grid[r][c] = " ";
        for (const g of G.ghosts) {
            g.anim += dt * 7;
            advance(g, 5 * dt, (e) => {
                const opts = [0, 1, 2, 3].filter((d) => d !== OPP(e.dir) && open(e.x + DIRS[d][0], e.y + DIRS[d][1]));
                e.dir = opts.length ? opts[Math.floor(Math.random() * opts.length)] : OPP(e.dir);
            });
            if (g.dir === 1 || g.dir === 3) g.face = g.dir;
        }
    };

    // ---------- Laço principal ----------
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        pollGamepad();
        if (G.state === "demo") {
            updateDemo(dt);
        } else if (!G.paused) {
            acc += dt;
            while (acc >= STEP) { update(STEP); acc -= STEP; }
        }
        render(now / 1000);
        requestAnimationFrame(frame);
    };

    // ---------- Painéis ----------
    const showPanel = (panel) => {
        for (const p of [ui.menu, ui.pause, ui.over]) p.hidden = p !== panel;
        ui.touch.classList.toggle("show", isTouch && !panel && G.state !== "demo");
    };

    const updateMenuRecord = () => {
        const key = `dino-come-come-recorde-${ui.diff.value}`;
        const rec = Number(store.get(key)) || 0;
        const lvl = store.get(`${key}-fase`);
        ui.menuRecord.textContent = rec ? `Recorde no ${DIFFS[ui.diff.value].name}: ${rec.toLocaleString("pt-BR")}${lvl ? ` (fase ${lvl})` : ""}` : "";
    };

    const toMenu = () => {
        G.paused = false;
        demo();
        updateMenuRecord();
        showPanel(ui.menu);
        ui.play.focus({ preventScroll: true });
    };

    const setPaused = (on) => {
        if (G.state === "demo" || G.state === "over" || G.state === "menu") return;
        G.paused = on;
        showPanel(on ? ui.pause : null);
        if (on) ui.resume.focus({ preventScroll: true });
        else { canvas.focus(); last = performance.now(); }
    };

    const updateSoundBtn = () => {
        ui.sound.textContent = Sound.enabled ? "🔊" : "🔇";
    };

    // ---------- Entrada ----------
    const KEYS = {
        ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
    };

    const steer = (d) => {
        if (G.state === "demo" || !G.player) return;
        G.player.want = d;
    };

    window.addEventListener("keydown", (e) => {
        const inMenu = !ui.menu.hidden;
        if (e.code === "KeyM") {
            Sound.toggle();
            updateSoundBtn();
            return;
        }
        if (inMenu) {
            if (e.code === "Enter" && document.activeElement?.tagName !== "SELECT" && document.activeElement?.tagName !== "BUTTON") {
                e.preventDefault();
                newGame();
            }
            return;
        }
        if (!ui.over.hidden) {
            if (e.code === "Escape") { e.preventDefault(); toMenu(); }
            return;
        }
        if (e.code in KEYS) {
            e.preventDefault();
            if (!G.paused) steer(KEYS[e.code]);
            return;
        }
        if (e.code === "Space") {
            e.preventDefault();
            if (!G.paused) roar();
            return;
        }
        if (e.code === "KeyP" || e.code === "Escape") {
            e.preventDefault();
            setPaused(!G.paused);
        }
    });

    // Deslizar o dedo em qualquer lugar da tela
    let swipe = null;
    ui.touch.parentElement.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" || e.target.closest("button, .panel")) return;
        swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    window.addEventListener("pointermove", (e) => {
        if (!swipe || e.pointerId !== swipe.id) return;
        const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.hypot(dx, dy) < 16) return;
        steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
        swipe.x = e.clientX;
        swipe.y = e.clientY;
    });
    const endSwipe = (e) => { if (swipe && e.pointerId === swipe.id) swipe = null; };
    window.addEventListener("pointerup", endSwipe);
    window.addEventListener("pointercancel", endSwipe);

    ui.dpad.querySelectorAll("button").forEach((b) => {
        const d = Number(b.dataset.dir);
        b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            steer(d);
            b.classList.add("active");
        });
        const off = () => b.classList.remove("active");
        b.addEventListener("pointerup", off);
        b.addEventListener("pointerleave", off);
        b.addEventListener("pointercancel", off);
    });
    ui.tRoar.addEventListener("pointerdown", (e) => { e.preventDefault(); roar(); });
    ui.tPause.addEventListener("click", () => setPaused(true));

    // Controle (gamepad)
    let padPrev = {};
    function pollGamepad() {
        const pads = navigator.getGamepads?.() || [];
        const gp = [...pads].find(Boolean);
        if (!gp) return;
        const b = (i) => !!gp.buttons[i]?.pressed;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let d = -1;
        if (b(12) || ay < -0.5) d = 0;
        else if (b(13) || ay > 0.5) d = 2;
        else if (b(14) || ax < -0.5) d = 3;
        else if (b(15) || ax > 0.5) d = 1;
        if (d >= 0 && !G.paused) steer(d);
        const now = { a: b(0), start: b(9) };
        if (now.a && !padPrev.a) {
            if (!ui.menu.hidden || !ui.over.hidden) newGame();
            else if (G.paused) setPaused(false);
            else roar();
        }
        if (now.start && !padPrev.start) {
            if (!ui.menu.hidden) newGame();
            else setPaused(!G.paused);
        }
        padPrev = now;
    }

    ui.play.addEventListener("click", newGame);
    ui.again.addEventListener("click", newGame);
    ui.toMenu.addEventListener("click", toMenu);
    ui.quit.addEventListener("click", () => {
        if (G.score > 0) saveRecord();
        toMenu();
    });
    ui.resume.addEventListener("click", () => setPaused(false));
    ui.sound.addEventListener("click", () => {
        Sound.toggle();
        updateSoundBtn();
        Sound.click();
    });
    ui.diff.addEventListener("change", () => { store.set("dino-come-come-diff", ui.diff.value); updateMenuRecord(); });
    ui.maze.addEventListener("change", () => store.set("dino-come-come-maze", ui.maze.value));
    ui.speed.addEventListener("change", () => store.set("dino-come-come-velocidade", ui.speed.value));
    ui.look.addEventListener("change", () => {
        store.set("dino-come-come-visual", ui.look.value);
        wallCache = null;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme().bg);
    });
    ui.touchMode.addEventListener("change", () => {
        store.set("dino-come-come-touch", ui.touchMode.value);
        ui.touch.classList.toggle("pad", ui.touchMode.value === "pad");
        layout();
    });
    ui.touch.classList.toggle("pad", ui.touchMode.value === "pad");

    window.addEventListener("resize", layout);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && (G.state === "play" || G.state === "ready")) setPaused(true);
    });
    window.addEventListener("blur", () => {
        if (G.state === "play") setPaused(true);
    });

    // Para testes automáticos (console): window.__dinoComeCome
    window.__dinoComeCome = { G, update, newGame };

    updateSoundBtn();
    toMenu();
    requestAnimationFrame(frame);
})();
