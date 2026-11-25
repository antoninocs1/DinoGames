// Cobrinha — jogo da cobrinha do DinoGames.
// Baseado nas ideias do snake-js (modos, itens, fila de direção, movimento suave),
// reescrito para a tela do DinoGames: opções em combobox na mesma tela, sem servidor.
"use strict";
(() => {
    const $ = (id) => document.getElementById(id);
    const store = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
    };

    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // cima, direita, baixo, esquerda
    const OPP = (d) => (d + 2) % 4;
    const MAX_BUFFER = 3;
    const TIME_LIMIT = 60;
    const FOODS_PER_LEVEL = 5;
    const POWER_CHANCE = 0.3;
    const POWER_BOARD = 8;
    const SLOW_FACTOR = 1.85;

    const SIZES = { p: [17, 11], m: [25, 15], g: [33, 19] };
    const SPEEDS = {
        facil: { ms: 140, accel: 1.5, min: 85 },
        normal: { ms: 110, accel: 2, min: 62 },
        dificil: { ms: 82, accel: 2.2, min: 48 },
        turbo: { ms: 60, accel: 1.2, min: 40 },
    };
    const MODES = {
        classico: "Clássico", tempo: "Contra o tempo", zen: "Zen", obstaculos: "Obstáculos", diario: "Desafio do dia",
    };
    const SKINS = {
        verdao: { name: "Verdão", body: "#3ddc84", dark: "#1f8f52", head: "#7fffaa" },
        coral: { name: "Coral", body: "#ff8c42", dark: "#b8551b", head: "#ffb074", band: "#1c1c1c" },
        jararaca: { name: "Jararaca", body: "#b85cff", dark: "#7330b8", head: "#d088ff" },
        piton: { name: "Píton", body: "#4ad9d9", dark: "#218c8c", head: "#80e8e8" },
        naja: { name: "Naja", body: "#d8d8d8", dark: "#8a8a8a", head: "#ffffff", unlock: 250 },
        brasa: { name: "Brasa", body: "#ffd24a", dark: "#c27c00", head: "#fff0a8", unlock: 500 },
    };
    const P2_SKIN = { name: "Rosa", body: "#ff5ea8", dark: "#b0306c", head: "#ffb3d4" };
    const DINO_SKIN = { name: "Dino", body: "#34cca3", dark: "#1a7a5f", head: "#7ff0cf", band: "#f5b021" };
    const POWERS = {
        dobro: { icon: "⭐", label: "Pontos em dobro", time: 8, color: "#ffd24a" },
        lento: { icon: "🐢", label: "Câmera lenta", time: 7, color: "#7cd4ff" },
        fantasma: { icon: "👻", label: "Fantasma", time: 7, color: "#e4e4ff" },
        tesoura: { icon: "✂️", label: "Encolher", time: 0, color: "#ff8c8c" },
    };

    const ui = {
        mode: $("opt-mode"), players: $("opt-players"), diff: $("opt-diff"), walls: $("opt-walls"),
        size: $("opt-size"), skin: $("opt-skin"), touch: $("opt-touch"), vibrate: $("opt-vibrate"),
        board: $("board"), frame: $("frame"), area: document.querySelector(".board-area"),
        overlay: $("overlay"), ovIcon: $("ov-icon"), ovTitle: $("ov-title"), ovText: $("ov-text"),
        ovPlay: $("ov-play"), ovMenu: $("ov-menu"),
        status: $("status"), play: $("btn-play"), pause: $("btn-pause"), sound: $("btn-sound"),
        playersBox: $("players"), score: $("score"), effects: $("effects"), records: $("records"),
        dpad: $("dpad"),
    };
    const cx = ui.board.getContext("2d");
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    // ---------- Sons (Web Audio) ----------
    const Sound = (() => {
        let ctx = null;
        let on = store.get("cobrinha-som") !== "0";
        const init = () => {
            if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) ctx = new AC();
        };
        const tone = (f, dur, { type = "square", vol = 0.08, at = 0, to = null } = {}) => {
            if (!on || !ctx) return;
            const t = ctx.currentTime + at;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(f, t);
            if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(ctx.destination);
            o.start(t);
            o.stop(t + dur + 0.02);
        };
        return {
            init,
            get on() { return on; },
            toggle() { on = !on; store.set("cobrinha-som", on ? "1" : "0"); if (on) init(); return on; },
            eat(n) { tone(520 + (n % 5) * 60, 0.08, { type: "triangle", vol: 0.12, to: 900 + (n % 5) * 80 }); },
            power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, { type: "square", vol: 0.05, at: i * 0.06 })); },
            die() { tone(400, 0.5, { type: "sawtooth", vol: 0.08, to: 60 }); },
            start() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: "triangle", vol: 0.1, at: i * 0.08 })); },
            level() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, { type: "triangle", vol: 0.1, at: i * 0.07 })); },
            hurt() { tone(220, 0.25, { type: "square", vol: 0.06, to: 110 }); },
            win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, { type: "triangle", vol: 0.1, at: i * 0.1 })); },
            tick() { tone(1200, 0.03, { type: "sine", vol: 0.04 }); },
        };
    })();

    // ---------- Aleatório com semente (desafio do dia) ----------
    const hashString = (str) => {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    };
    const mulberry32 = (seed) => {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    const todayKey = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    // ---------- Mapas de obstáculos (adaptados a qualquer tamanho de campo) ----------
    const block = (x, y, w, h) => { const c = []; for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) c.push([x + ix, y + iy]); return c; };
    const row = (y, x0, x1) => { const c = []; for (let x = x0; x <= x1; x++) c.push([x, y]); return c; };
    const col = (x, y0, y1) => { const c = []; for (let y = y0; y <= y1; y++) c.push([x, y]); return c; };
    const LEVELS = [
        { name: "Campo aberto", cells: () => [] },
        { name: "Cantos", cells: (W, H) => [...block(0, 0, 3, 2), ...block(W - 3, 0, 3, 2), ...block(0, H - 2, 3, 2), ...block(W - 3, H - 2, 3, 2)] },
        { name: "Pilares", cells: (W, H) => {
            const xs = [Math.floor(W * 0.18), Math.floor(W / 2) - 1, Math.ceil(W * 0.82) - 2];
            const ys = [Math.floor(H * 0.18), Math.ceil(H * 0.82) - 2];
            return xs.flatMap((x) => ys.flatMap((y) => block(x, y, 2, 2)));
        } },
        { name: "Corredores", cells: (W, H) => {
            const m = Math.floor(W / 2), a = Math.floor(H / 4), b = H - 1 - a;
            return [...row(a, 2, m - 3), ...row(a, m + 3, W - 3), ...row(b, 2, m - 3), ...row(b, m + 3, W - 3)];
        } },
        { name: "Cruz", cells: (W, H) => {
            const a = Math.floor(H / 4), b = H - 1 - a, x1 = Math.floor(W / 3), x2 = W - 1 - x1;
            return [...row(a, 4, W - 5), ...row(b, 4, W - 5), ...col(x1, 1, a + 1), ...col(x1, b - 1, H - 2), ...col(x2, 1, a + 1), ...col(x2, b - 1, H - 2)];
        } },
        { name: "Portões", cells: (W, H) => {
            const x1 = Math.floor(W / 4), x2 = W - 1 - x1, m = Math.floor(H / 2), mx = Math.floor(W / 2);
            return [...col(x1, 0, m - 2), ...col(x1, m + 2, H - 1), ...col(x2, 0, m - 2), ...col(x2, m + 2, H - 1), ...row(m - 1, mx - 1, mx + 1), ...row(m + 1, mx - 1, mx + 1)];
        } },
        { name: "Arena", cells: (W, H) => {
            const c = [], mx = Math.floor(W / 2), my = Math.floor(H / 2);
            for (let x = 0; x < W; x++) if (Math.abs(x - mx) > 1) c.push([x, 0], [x, H - 1]);
            for (let y = 1; y < H - 1; y++) if (Math.abs(y - my) > 1) c.push([0, y], [W - 1, y]);
            return c;
        } },
    ];

    // ---------- Estado ----------
    const S = {
        phase: "idle", // idle | running | paused | over
        W: 25, H: 15, mode: "classico", playersMode: "1", speed: SPEEDS.normal, walls: false,
        players: [], food: [], power: null, obstacles: new Set(), level: 1, levelName: "",
        eatenTotal: 0, elapsed: 0, timeLeft: TIME_LIMIT, slowUntil: 0,
        rng: Math.random, acc: 0, interval: 110, particles: [], popups: [], lastTick: 0,
    };
    const key = (x, y) => y * S.W + x;

    const settingsFromUI = () => {
        S.mode = ui.mode.value;
        S.playersMode = ui.players.value;
        S.speed = SPEEDS[ui.diff.value];
        S.walls = ui.walls.value === "1" && S.mode !== "zen";
        [S.W, S.H] = SIZES[ui.size.value];
        // Celular em pé: o campo fica em pé também.
        if (window.innerWidth < 700 && window.innerHeight > window.innerWidth * 1.2) [S.W, S.H] = [S.H, S.W];
    };

    const bestOverall = () => Number(store.get("cobrinha-melhor")) || 0;

    const fillSkins = () => {
        const best = bestOverall();
        const cur = store.get("cobrinha-visual") || "verdao";
        ui.skin.innerHTML = "";
        for (const [id, s] of Object.entries(SKINS)) {
            const locked = s.unlock && best < s.unlock;
            const opt = new Option(locked ? `${s.name} 🔒 ${s.unlock} pts` : s.name, id);
            opt.disabled = !!locked;
            ui.skin.add(opt);
        }
        ui.skin.value = SKINS[cur] && !(SKINS[cur].unlock && best < SKINS[cur].unlock) ? cur : "verdao";
    };

    // ---------- Montagem da partida ----------
    const makePlayer = (id, x, y, dir, skin, name, cpu = false) => {
        const cells = [];
        for (let i = 0; i < 3; i++) cells.push({ x: x - DIRS[dir][0] * i, y: y - DIRS[dir][1] * i });
        return { id, name, skin, cpu, cells, prev: cells.map((c) => ({ ...c })), dir, buf: [], grow: 0, score: 0, eaten: 0, alive: true, double: 0, ghost: 0, spawn: { x, y, dir }, flash: 0 };
    };

    const spawnPoints = () => {
        const { W, H } = S;
        if (S.players.length < 2 && S.playersMode === "1") return [[Math.floor(W / 4) + 1, Math.floor(H / 2), 1]];
        return [[Math.floor(W / 4) + 1, Math.floor(H / 3), 1], [W - 2 - Math.floor(W / 4), H - 1 - Math.floor(H / 3), 3]];
    };

    const placeObstacles = (pairs) => {
        S.obstacles = new Set();
        const sp = spawnPoints();
        for (const [x, y] of pairs) {
            if (x < 0 || y < 0 || x >= S.W || y >= S.H) continue;
            const nearSpawn = sp.some(([sx, sy, d]) => {
                const ahead = d === 1 ? x - sx : sx - x;
                return (y === sy && ahead >= -3 && ahead <= 6) || (Math.abs(y - sy) === 1 && Math.abs(x - sx) <= 2);
            });
            if (nearSpawn) continue;
            if (S.players.some((p) => p.cells.some((c, i) => (c.x === x && c.y === y) || (i === 0 && Math.abs(c.x - x) + Math.abs(c.y - y) <= 2)))) continue;
            S.obstacles.add(key(x, y));
        }
        // Comida ou item em cima de obstáculo novo vai para outro lugar.
        S.food = S.food.map((f) => (S.obstacles.has(key(f.x, f.y)) ? freeCell() : f)).filter(Boolean);
        if (S.power && S.obstacles.has(key(S.power.x, S.power.y))) S.power = null;
    };

    const loadLevel = (level) => {
        const map = LEVELS[(level - 1) % LEVELS.length];
        S.levelName = map.name;
        placeObstacles(map.cells(S.W, S.H));
    };

    const dailyObstacles = () => {
        const r = S.rng;
        const base = LEVELS[1 + Math.floor(r() * (LEVELS.length - 1))];
        const cells = base.cells(S.W, S.H);
        const n = 4 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
            const horiz = r() < 0.5;
            cells.push(...block(1 + Math.floor(r() * (S.W - 3)), 1 + Math.floor(r() * (S.H - 3)), horiz ? 2 : 1, horiz ? 1 : 2));
        }
        S.levelName = `Dia ${todayKey().split("-").reverse().slice(0, 2).join("/")}`;
        placeObstacles(cells);
    };

    const occupied = () => {
        const set = new Set(S.obstacles);
        for (const p of S.players) for (const c of p.cells) set.add(key(c.x, c.y));
        for (const f of S.food) set.add(key(f.x, f.y));
        if (S.power) set.add(key(S.power.x, S.power.y));
        return set;
    };

    function freeCell() {
        const occ = occupied();
        const free = [];
        for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (!occ.has(key(x, y))) free.push({ x, y });
        if (!free.length) return null;
        return free[Math.floor(S.rng() * free.length)];
    }

    const foodCount = () => (S.mode === "tempo" ? 2 : 1);

    const refillFood = () => {
        while (S.food.length < foodCount()) {
            const c = freeCell();
            if (!c) break;
            S.food.push({ ...c, born: S.elapsed });
        }
    };

    const newBoard = () => {
        settingsFromUI();
        S.rng = S.mode === "diario" ? mulberry32(hashString(`cobrinha-dia-${todayKey()}-${S.W}x${S.H}`)) : Math.random;
        S.players = [];
        S.food = [];
        S.power = null;
        S.particles = [];
        S.popups = [];
        S.level = 1;
        S.eatenTotal = 0;
        S.elapsed = 0;
        S.timeLeft = TIME_LIMIT;
        S.slowUntil = 0;
        S.acc = 0;
        const sp = spawnPoints();
        const p1Name = S.playersMode === "2" ? "Jogador 1" : "Você";
        S.players.push(makePlayer(0, sp[0][0], sp[0][1], sp[0][2], SKINS[ui.skin.value] || SKINS.verdao, p1Name));
        if (S.playersMode === "2") S.players.push(makePlayer(1, sp[1][0], sp[1][1], sp[1][2], P2_SKIN, "Jogador 2"));
        if (S.playersMode === "cpu") S.players.push(makePlayer(1, sp[1][0], sp[1][1], sp[1][2], DINO_SKIN, "Dino", true));
        S.obstacles = new Set();
        S.levelName = "";
        if (S.mode === "obstaculos") loadLevel(1);
        if (S.mode === "diario") dailyObstacles();
        refillFood();
        updateInterval();
        resize();
        renderPlayers();
        renderPanel();
    };

    const updateInterval = () => {
        let ms = Math.max(S.speed.min, S.speed.ms - S.speed.accel * S.eatenTotal);
        if (S.elapsed < S.slowUntil) ms *= SLOW_FACTOR;
        S.interval = ms;
    };

    // ---------- Direção ----------
    const pushDir = (p, d) => {
        if (!p || !p.alive || p.cpu) return;
        const last = p.buf.length ? p.buf[p.buf.length - 1] : p.dir;
        if (d === last || d === OPP(last)) return;
        if (p.buf.length < MAX_BUFFER) p.buf.push(d);
    };

    const nextDir = (p) => {
        while (p.buf.length) {
            const d = p.buf.shift();
            if (d !== OPP(p.dir) && d !== p.dir) return d;
        }
        return p.dir;
    };

    const wrapCell = (x, y) => {
        if (S.walls) return { x, y, out: x < 0 || y < 0 || x >= S.W || y >= S.H };
        return { x: (x + S.W) % S.W, y: (y + S.H) % S.H, out: false };
    };

    // ---------- Computador (Dino) ----------
    // Procura o caminho mais curto até a fruta (busca em largura) e confere se depois
    // ainda sobra espaço para não se encurralar; senão vai para onde houver mais espaço.
    const cpuDir = (p) => {
        const blocked = new Set(S.obstacles);
        for (const q of S.players) {
            const len = q.cells.length - (q.grow > 0 ? 0 : 1);
            for (let i = 0; i < len; i++) blocked.add(key(q.cells[i].x, q.cells[i].y));
            if (q !== p && q.alive) {
                for (const [dx, dy] of DIRS) {
                    const n = wrapCell(q.cells[0].x + dx, q.cells[0].y + dy);
                    if (!n.out) blocked.add(key(n.x, n.y));
                }
            }
        }
        const head = p.cells[0];
        const neighbors = (x, y) => DIRS.map(([dx, dy], d) => ({ d, ...wrapCell(x + dx, y + dy) })).filter((n) => !n.out && !blocked.has(key(n.x, n.y)));
        const area = (sx, sy, limit) => {
            const seen = new Set([key(sx, sy)]);
            const st = [[sx, sy]];
            while (st.length && seen.size < limit) {
                const [x, y] = st.pop();
                for (const n of neighbors(x, y)) {
                    const k = key(n.x, n.y);
                    if (!seen.has(k)) { seen.add(k); st.push([n.x, n.y]); }
                }
            }
            return seen.size;
        };
        const options = neighbors(head.x, head.y).filter((n) => n.d !== OPP(p.dir));
        if (!options.length) return p.dir;
        const need = p.cells.length + 2;
        const mistakes = { facil: 0.12, normal: 0.04, dificil: 0, turbo: 0 }[ui.diff.value];
        if (S.rng() < mistakes) return options[Math.floor(Math.random() * options.length)].d;

        // busca em largura até a fruta mais próxima
        const targets = new Set(S.food.map((f) => key(f.x, f.y)));
        if (S.power && S.power.type !== "tesoura") targets.add(key(S.power.x, S.power.y));
        const first = new Map();
        const queue = [];
        for (const o of options) { const k = key(o.x, o.y); first.set(k, o.d); queue.push([o.x, o.y]); }
        let chosen = -1;
        for (let qi = 0; qi < queue.length; qi++) {
            const [x, y] = queue[qi];
            const k = key(x, y);
            if (targets.has(k)) {
                const d = first.get(k);
                const o = options.find((op) => op.d === d);
                if (area(o.x, o.y, need) >= need) chosen = d;
                break;
            }
            for (const n of neighbors(x, y)) {
                const nk = key(n.x, n.y);
                if (!first.has(nk)) { first.set(nk, first.get(k)); queue.push([n.x, n.y]); }
            }
        }
        if (chosen >= 0) return chosen;
        let best = options[0], bestA = -1;
        for (const o of options) {
            const a = area(o.x, o.y, 400);
            if (a > bestA) { bestA = a; best = o; }
        }
        return best.d;
    };

    // ---------- Passo do jogo ----------
    const tick = () => {
        const zen = S.mode === "zen";
        const plans = [];
        for (const p of S.players) {
            if (!p.alive) continue;
            p.dir = p.cpu ? cpuDir(p) : nextDir(p);
            const h = p.cells[0];
            const n = wrapCell(h.x + DIRS[p.dir][0], h.y + DIRS[p.dir][1]);
            plans.push({ p, head: n });
        }
        for (const pl of plans) {
            pl.food = pl.head.out ? -1 : S.food.findIndex((f) => f.x === pl.head.x && f.y === pl.head.y);
            pl.power = !pl.head.out && S.power && S.power.x === pl.head.x && S.power.y === pl.head.y;
        }
        // Se os dois chegam na mesma fruta, só o primeiro come.
        if (plans.length === 2 && plans[0].food >= 0 && plans[0].food === plans[1].food) plans[1].food = -1;
        if (plans.length === 2 && plans[0].power && plans[1].power) plans[1].power = false;

        for (const pl of plans) {
            const grow = pl.p.grow > 0 || pl.food >= 0;
            pl.cells = [pl.head, ...(grow ? pl.p.cells : pl.p.cells.slice(0, -1))];
            let dead = false;
            if (!zen) {
                if (pl.head.out) dead = true;
                else if (S.obstacles.has(key(pl.head.x, pl.head.y))) dead = true;
                else if (S.elapsed >= pl.p.ghost && pl.cells.slice(1).some((c) => c.x === pl.head.x && c.y === pl.head.y)) dead = true;
            }
            pl.dead = dead;
        }
        if (!zen && plans.length === 2) {
            const [a, b] = plans;
            if (!a.head.out && !b.head.out && a.head.x === b.head.x && a.head.y === b.head.y) {
                a.dead = b.dead = true;
            } else {
                if (!a.dead && !a.head.out && b.cells.some((c) => c.x === a.head.x && c.y === a.head.y)) a.dead = true;
                if (!b.dead && !b.head.out && a.cells.some((c) => c.x === b.head.x && c.y === b.head.y)) b.dead = true;
            }
        }

        let ateAny = false;
        for (const pl of plans) {
            const p = pl.p;
            p.prev = p.cells.map((c) => ({ ...c }));
            if (pl.dead) {
                if (S.mode === "tempo") { hurt(p); continue; }
                p.alive = false;
                p.flash = 1;
                deathFx(p);
                continue;
            }
            p.cells = pl.cells.map((c) => ({ x: c.x, y: c.y }));
            if (pl.food >= 0) {
                const f = S.food[pl.food];
                const pts = 10 * (S.elapsed < p.double ? 2 : 1);
                p.score += pts;
                p.eaten++;
                p.grow += 1;
                S.eatenTotal++;
                S.food[pl.food] = null;
                ateAny = true;
                popup(f.x, f.y, `+${pts}`, p.skin.head);
                burst(f.x, f.y, "#ff4d4d", 10);
                Sound.eat(p.eaten);
                if (!p.cpu && ui.vibrate.value === "1") navigator.vibrate?.(18);
                bump(p.id);
            }
            if (p.grow > 0 && pl.food < 0) p.grow--;
            else if (pl.food >= 0) p.grow--;
            if (pl.power) activatePower(S.power.type, p);
        }
        if (ateAny) {
            S.food = S.food.filter(Boolean);
            refillFood();
            maybeSpawnPower();
            if (S.mode === "obstaculos") {
                const lvl = Math.floor(S.eatenTotal / FOODS_PER_LEVEL) + 1;
                if (lvl !== S.level) {
                    S.level = lvl;
                    loadLevel(lvl);
                    Sound.level();
                    setStatus(`Fase ${lvl}: ${S.levelName}!`, "bom");
                }
            }
            updateInterval();
            renderPanel();
        }
        renderPlayers();
        checkEnd();
    };

    const hurt = (p) => {
        S.timeLeft = Math.max(0, S.timeLeft - 5);
        const len = Math.max(3, Math.ceil(p.cells.length / 2));
        p.cells = p.cells.slice(0, len);
        // volta a cobrinha para o ponto de partida, virada para o lado livre
        const s = p.spawn;
        p.cells = [];
        for (let i = 0; i < len; i++) {
            const c = wrapCell(s.x - DIRS[s.dir][0] * i, s.y - DIRS[s.dir][1] * i);
            p.cells.push({ x: c.x, y: c.y });
        }
        p.prev = p.cells.map((c) => ({ ...c }));
        p.dir = s.dir;
        p.buf = [];
        p.grow = 0;
        p.flash = 1;
        Sound.hurt();
        shake();
        popup(s.x, s.y, "−5 s", "#ff8c8c");
    };

    const activatePower = (type, p) => {
        const info = POWERS[type];
        if (type === "dobro") p.double = S.elapsed + info.time;
        else if (type === "fantasma") p.ghost = S.elapsed + info.time;
        else if (type === "lento") S.slowUntil = S.elapsed + info.time;
        else if (type === "tesoura") {
            const cut = Math.min(3, p.cells.length - 2);
            if (cut > 0) {
                const gone = p.cells.splice(p.cells.length - cut, cut);
                gone.forEach((c) => burst(c.x, c.y, p.skin.body, 4));
            }
            p.prev = p.prev.slice(0, p.cells.length);
        }
        popup(S.power.x, S.power.y, info.label, info.color);
        burst(S.power.x, S.power.y, info.color, 14);
        S.power = null;
        Sound.power();
        updateInterval();
        renderPanel();
    };

    const maybeSpawnPower = () => {
        if (S.power || S.rng() >= POWER_CHANCE) return;
        const types = Object.keys(POWERS);
        const type = types[Math.floor(S.rng() * types.length)];
        const c = freeCell();
        if (c) S.power = { ...c, type, until: S.elapsed + POWER_BOARD };
    };

    const checkEnd = () => {
        const alive = S.players.filter((p) => p.alive);
        if (S.players.length === 1 ? alive.length === 0 : alive.length < S.players.length) finish();
    };

    // ---------- Fim de partida e recordes ----------
    const recKey = (mode) => (mode === "diario" ? `cobrinha-rec-diario-${todayKey()}` : `cobrinha-rec-${mode}`);

    const finish = (timeUp = false) => {
        S.phase = "over";
        const [a, b] = S.players;
        let icon = "🐍", title = "Fim de jogo", text;
        const solo = S.players.length === 1;
        if (solo) {
            const old = Number(store.get(recKey(S.mode))) || 0;
            const isNew = a.score > old && a.score > 0;
            if (isNew) store.set(recKey(S.mode), String(a.score));
            if (a.score > bestOverall()) {
                const before = bestOverall();
                store.set("cobrinha-melhor", String(a.score));
                const unlocked = Object.values(SKINS).filter((s) => s.unlock && before < s.unlock && a.score >= s.unlock);
                if (unlocked.length) setTimeout(() => setStatus(`Novo visual liberado: ${unlocked.map((s) => s.name).join(" e ")}!`, "bom"), 50);
                fillSkins();
            }
            if (timeUp) { icon = "⏱️"; title = "Tempo esgotado!"; }
            if (isNew) { icon = "🏆"; title = "Novo recorde!"; Sound.win(); } else if (!timeUp) Sound.die();
            text = `<b>${a.score}</b><br>${a.eaten} frutas · tamanho ${a.cells.length}${S.mode === "obstaculos" ? ` · fase ${S.level}` : ""}`;
        } else {
            let winner = null;
            if (timeUp) winner = a.score === b.score ? null : a.score > b.score ? a : b;
            else if (a.alive !== b.alive) winner = a.alive ? a : b;
            else winner = a.score === b.score ? null : a.score > b.score ? a : b;
            if (!winner) { icon = "🤝"; title = "Empate!"; }
            else if (winner.cpu) { icon = "🦖"; title = "O Dino venceu!"; }
            else { icon = "🏆"; title = S.playersMode === "cpu" ? "Você venceu o Dino!" : `${winner.name} venceu!`; }
            if (winner && !winner.cpu) Sound.win(); else Sound.die();
            text = `${a.name}: <b>${a.score}</b> &nbsp;·&nbsp; ${b.name}: <b>${b.score}</b>`;
        }
        showOverlay(icon, title, text, "Jogar de novo", true);
        setStatus(solo ? `Fim de jogo: ${a.score} pontos.` : title, "ruim");
        renderPanel();
        updateButtons();
    };

    // ---------- Efeitos ----------
    const popup = (x, y, text, color) => S.popups.push({ x, y, text, color, t: 0 });
    const burst = (x, y, color, n) => {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
            S.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.4 + Math.random() * 0.4, color });
        }
    };
    const shake = () => {
        ui.frame.classList.remove("shake");
        void ui.frame.offsetWidth;
        ui.frame.classList.add("shake");
    };
    const deathFx = (p) => {
        p.cells.forEach((c, i) => { if (i % 2 === 0) burst(c.x, c.y, p.skin.body, 3); });
        shake();
        if (!p.cpu && ui.vibrate.value === "1") navigator.vibrate?.([60, 40, 90]);
    };

    // ---------- Desenho ----------
    let cell = 24, dpr = 1;
    const resize = () => {
        ui.area.style.setProperty("--aspect", (S.W / S.H).toFixed(3));
        const w = ui.board.clientWidth || 600;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cell = (w * dpr) / S.W;
        ui.board.width = Math.round(S.W * cell);
        ui.board.height = Math.round(S.H * cell);
        ui.board.style.aspectRatio = `${S.W} / ${S.H}`;
    };

    const rr = (x, y, w, h, r) => {
        cx.beginPath();
        cx.moveTo(x + r, y);
        cx.arcTo(x + w, y, x + w, y + h, r);
        cx.arcTo(x + w, y + h, x, y + h, r);
        cx.arcTo(x, y + h, x, y, r);
        cx.arcTo(x, y, x + w, y, r);
        cx.closePath();
    };

    const drawBoard = () => {
        cx.fillStyle = "#10201a";
        cx.fillRect(0, 0, ui.board.width, ui.board.height);
        cx.fillStyle = "#132620";
        for (let y = 0; y < S.H; y++) for (let x = (y % 2); x < S.W; x += 2) cx.fillRect(x * cell, y * cell, cell, cell);
        if (S.walls) {
            cx.strokeStyle = "#ff6b6b88";
            cx.lineWidth = Math.max(2, cell * 0.08);
            cx.strokeRect(cx.lineWidth / 2, cx.lineWidth / 2, ui.board.width - cx.lineWidth, ui.board.height - cx.lineWidth);
        }
        // obstáculos: pedras
        for (const k of S.obstacles) {
            const x = (k % S.W) * cell, y = Math.floor(k / S.W) * cell;
            const g = cx.createLinearGradient(x, y, x, y + cell);
            g.addColorStop(0, "#8d8f99");
            g.addColorStop(1, "#4b4d57");
            cx.fillStyle = g;
            rr(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.22);
            cx.fill();
            cx.fillStyle = "#ffffff22";
            rr(x + cell * 0.18, y + cell * 0.14, cell * 0.4, cell * 0.18, cell * 0.09);
            cx.fill();
        }
    };

    const drawApple = (f, t) => {
        const bob = Math.sin(t * 4 + f.x) * cell * 0.04;
        const age = Math.min(1, (S.elapsed - (f.born || 0)) * 4);
        const x = (f.x + 0.5) * cell, y = (f.y + 0.55) * cell + bob, r = cell * 0.34 * (0.4 + age * 0.6);
        cx.save();
        cx.shadowColor = "#ff4d4d";
        cx.shadowBlur = cell * 0.4;
        cx.fillStyle = "#e8333a";
        cx.beginPath();
        cx.arc(x - r * 0.35, y, r * 0.8, 0, Math.PI * 2);
        cx.arc(x + r * 0.35, y, r * 0.8, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
        cx.fillStyle = "#ffffff55";
        cx.beginPath();
        cx.arc(x - r * 0.4, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
        cx.fill();
        cx.strokeStyle = "#6b3a1a";
        cx.lineWidth = Math.max(1.5, cell * 0.06);
        cx.beginPath();
        cx.moveTo(x, y - r * 0.6);
        cx.lineTo(x + r * 0.1, y - r * 1.1);
        cx.stroke();
        cx.fillStyle = "#3ddc84";
        cx.beginPath();
        cx.ellipse(x + r * 0.4, y - r * 1.0, r * 0.35, r * 0.16, -0.5, 0, Math.PI * 2);
        cx.fill();
    };

    const drawPower = (pw, t) => {
        const info = POWERS[pw.type];
        const x = (pw.x + 0.5) * cell, y = (pw.y + 0.5) * cell;
        const left = Math.max(0, (pw.until - S.elapsed) / POWER_BOARD);
        cx.strokeStyle = info.color;
        cx.lineWidth = Math.max(2, cell * 0.08);
        cx.beginPath();
        cx.arc(x, y, cell * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        cx.stroke();
        if (left < 0.25 && Math.floor(t * 8) % 2) return;
        cx.font = `${cell * 0.62}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(info.icon, x, y + cell * 0.04 + Math.sin(t * 5) * cell * 0.04);
    };

    const segPos = (p, i, k) => {
        const cur = p.cells[i];
        const from = p.prev[i] || p.prev[p.prev.length - 1] || cur;
        const dx = cur.x - from.x, dy = cur.y - from.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return { x: cur.x, y: cur.y, jump: true };
        return { x: from.x + dx * k, y: from.y + dy * k };
    };

    const drawSnake = (p, k, t) => {
        const pts = p.cells.map((_, i) => segPos(p, i, p.alive ? k : 1));
        const n = pts.length;
        const ghost = S.elapsed < p.ghost;
        const dbl = S.elapsed < p.double;
        cx.save();
        if (ghost) cx.globalAlpha = 0.55 + Math.sin(t * 10) * 0.1;
        if (!p.alive && Math.floor(t * 6) % 2) cx.globalAlpha = 0.35;
        if (dbl) { cx.shadowColor = "#ffd24a"; cx.shadowBlur = cell * 0.5; }
        cx.lineCap = "round";
        cx.lineJoin = "round";
        const width = (i) => cell * (0.78 - Math.max(0, i - (n - 5)) * 0.07);
        // corpo: contorno escuro e depois a cor
        for (const pass of [0, 1]) {
            for (let i = n - 1; i > 0; i--) {
                const a = pts[i], b = pts[i - 1];
                if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) continue; // atravessou a borda
                cx.strokeStyle = pass ? (p.skin.band && i % 3 === 0 ? p.skin.band : p.skin.body) : p.skin.dark;
                cx.lineWidth = width(i) - (pass ? cell * 0.14 : 0);
                cx.beginPath();
                cx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell);
                cx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell);
                cx.stroke();
            }
        }
        cx.shadowBlur = 0;
        // escamas
        cx.fillStyle = "#ffffff26";
        for (let i = 1; i < n; i += 2) {
            cx.beginPath();
            cx.arc((pts[i].x + 0.5) * cell, (pts[i].y + 0.5) * cell, width(i) * 0.16, 0, Math.PI * 2);
            cx.fill();
        }
        // cabeça
        const h = pts[0];
        const hx = (h.x + 0.5) * cell, hy = (h.y + 0.5) * cell;
        const [dx, dy] = DIRS[p.dir];
        if (p.alive && Math.floor(t * 1.6 + p.id) % 3 === 0 && (t * 1.6) % 1 < 0.35) {
            cx.strokeStyle = "#ff3b5c";
            cx.lineWidth = Math.max(1.5, cell * 0.06);
            const tx = hx + dx * cell * 0.55, ty = hy + dy * cell * 0.55;
            cx.beginPath();
            cx.moveTo(hx + dx * cell * 0.35, hy + dy * cell * 0.35);
            cx.lineTo(tx, ty);
            cx.lineTo(tx + (dx - dy * 0.6) * cell * 0.12, ty + (dy + dx * 0.6) * cell * 0.12);
            cx.moveTo(tx, ty);
            cx.lineTo(tx + (dx + dy * 0.6) * cell * 0.12, ty + (dy - dx * 0.6) * cell * 0.12);
            cx.stroke();
        }
        cx.fillStyle = p.skin.dark;
        cx.beginPath();
        cx.arc(hx, hy, cell * 0.46, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = p.skin.head;
        cx.beginPath();
        cx.arc(hx, hy, cell * 0.39, 0, Math.PI * 2);
        cx.fill();
        // olhos que olham para a fruta mais perto
        let lx = dx, ly = dy;
        const f = S.food.reduce((best, fd) => {
            const d = Math.hypot(fd.x - h.x, fd.y - h.y);
            return !best || d < best.d ? { fd, d } : best;
        }, null);
        if (f && f.d > 0.1) { lx = (f.fd.x - h.x) / f.d; ly = (f.fd.y - h.y) / f.d; }
        for (const side of [-1, 1]) {
            const ex = hx + dx * cell * 0.12 + -dy * side * cell * 0.2;
            const ey = hy + dy * cell * 0.12 + dx * side * cell * 0.2;
            cx.fillStyle = "#fff";
            cx.beginPath();
            cx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
            cx.fill();
            cx.fillStyle = "#0d0d10";
            if (!p.alive) {
                cx.strokeStyle = "#0d0d10";
                cx.lineWidth = Math.max(1.2, cell * 0.04);
                cx.beginPath();
                cx.moveTo(ex - cell * 0.07, ey - cell * 0.07); cx.lineTo(ex + cell * 0.07, ey + cell * 0.07);
                cx.moveTo(ex + cell * 0.07, ey - cell * 0.07); cx.lineTo(ex - cell * 0.07, ey + cell * 0.07);
                cx.stroke();
            } else {
                cx.beginPath();
                cx.arc(ex + lx * cell * 0.05, ey + ly * cell * 0.05, cell * 0.065, 0, Math.PI * 2);
                cx.fill();
            }
        }
        if (p.cpu) {
            // espinhos do Dino na cabeça
            cx.fillStyle = "#f5b021";
            for (const s of [-0.18, 0.05]) {
                const bx = hx - dx * cell * (0.2 - s), by = hy - dy * cell * (0.2 - s);
                cx.beginPath();
                cx.moveTo(bx - dy * cell * 0.08 - dx * cell * 0.08, by + dx * cell * 0.08 - dy * cell * 0.08);
                cx.lineTo(bx, by);
                cx.lineTo(bx + dx * cell * 0.08 - dy * cell * 0.08, by + dy * cell * 0.08 + dx * cell * 0.08);
                cx.fill();
            }
        }
        if (p.flash > 0) {
            cx.globalAlpha = p.flash * 0.6;
            cx.fillStyle = "#fff";
            cx.beginPath();
            cx.arc(hx, hy, cell * 0.5, 0, Math.PI * 2);
            cx.fill();
        }
        cx.restore();
    };

    const render = (t) => {
        drawBoard();
        for (const f of S.food) drawApple(f, t);
        if (S.power) drawPower(S.power, t);
        const k = S.phase === "running" ? Math.min(1, S.acc / S.interval) : 1;
        for (const p of S.players) drawSnake(p, k, t);
        for (const pa of S.particles) {
            cx.globalAlpha = 1 - pa.t / pa.life;
            cx.fillStyle = pa.color;
            cx.beginPath();
            cx.arc((pa.x + 0.5) * cell, (pa.y + 0.5) * cell, cell * 0.08, 0, Math.PI * 2);
            cx.fill();
        }
        cx.globalAlpha = 1;
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        for (const pp of S.popups) {
            const a = 1 - pp.t / 0.9;
            cx.globalAlpha = Math.max(0, a);
            cx.font = `800 ${cell * 0.5}px system-ui, sans-serif`;
            cx.lineWidth = 3;
            cx.strokeStyle = "#000a";
            const y = (pp.y + 0.3 - pp.t * 1.2) * cell;
            cx.strokeText(pp.text, (pp.x + 0.5) * cell, y);
            cx.fillStyle = pp.color;
            cx.fillText(pp.text, (pp.x + 0.5) * cell, y);
        }
        cx.globalAlpha = 1;
        if (S.mode === "tempo" && S.phase === "running" && S.timeLeft <= 10) {
            cx.font = `900 ${cell * 3}px system-ui, sans-serif`;
            cx.fillStyle = "#ffffff18";
            cx.fillText(String(Math.ceil(S.timeLeft)), ui.board.width / 2, ui.board.height / 2);
        }
    };

    // ---------- Painel ----------
    const setStatus = (text, kind = "") => {
        ui.status.textContent = text;
        ui.status.className = `status ${kind}`;
    };

    const bump = (id) => {
        const el = ui.playersBox.querySelector(`.p${id} .pts`);
        if (!el) return;
        el.classList.remove("pulo");
        void el.offsetWidth;
        el.classList.add("pulo");
    };

    const renderPlayers = () => {
        const html = S.players.map((p) => `
            <div class="player p${p.id}${p.alive ? "" : " morto"}" style="--pc:${p.skin.body}">
                <span class="avatar">${p.cpu ? "🦖" : p.id ? "2" : S.players.length > 1 ? "1" : "🐍"}</span>
                <span class="who"><strong>${p.name}</strong><small>tamanho ${p.cells.length}${p.alive ? "" : " · bateu"}</small></span>
                <span class="pts">${p.score}</span>
            </div>`).join("");
        if (ui.playersBox.dataset.html !== html) {
            ui.playersBox.innerHTML = html;
            ui.playersBox.dataset.html = html;
        }
        ui.playersBox.classList.toggle("solo", S.players.length === 1);
    };

    const renderPanel = () => {
        const p = S.players[0];
        const third = S.mode === "tempo" ? ["Tempo", `${Math.ceil(S.timeLeft)} s`]
            : S.mode === "obstaculos" ? ["Fase", String(S.level)]
                : ["Recorde", String(Number(store.get(recKey(S.mode))) || 0)];
        const html = `<div><strong>${p ? p.score : 0}</strong><span>Pontos</span></div>
            <div><strong>${p ? p.eaten : 0}</strong><span>Frutas</span></div>
            <div><strong>${third[1]}</strong><span>${third[0]}</span></div>`;
        if (ui.score.innerHTML !== html) ui.score.innerHTML = html;
        const eff = [];
        for (const pl of S.players) {
            const tag = S.players.length > 1 ? ` (${pl.name})` : "";
            if (S.elapsed < pl.double) eff.push(`⭐ Dobro ${Math.ceil(pl.double - S.elapsed)} s${tag}`);
            if (S.elapsed < pl.ghost) eff.push(`👻 Fantasma ${Math.ceil(pl.ghost - S.elapsed)} s${tag}`);
        }
        if (S.elapsed < S.slowUntil) eff.push(`🐢 Lento ${Math.ceil(S.slowUntil - S.elapsed)} s`);
        if (S.levelName) eff.push(`🗺️ ${S.levelName}`);
        const effHtml = eff.map((e) => `<span>${e}</span>`).join("");
        if (ui.effects.innerHTML !== effHtml) ui.effects.innerHTML = effHtml;
        const rec = Object.entries(MODES).map(([m, name]) => `<span class="${m === ui.mode.value ? "atual" : ""}">${name}${m === "diario" ? " (hoje)" : ""}</span><b>${Number(store.get(recKey(m))) || 0}</b>`).join("");
        if (ui.records.innerHTML !== rec) ui.records.innerHTML = rec;
    };

    const showOverlay = (icon, title, text, btn, closable = false) => {
        ui.ovIcon.textContent = icon;
        ui.ovTitle.textContent = title;
        ui.ovText.innerHTML = text;
        ui.ovPlay.textContent = btn;
        ui.ovMenu.hidden = !closable;
        ui.overlay.hidden = false;
    };

    const updateButtons = () => {
        ui.play.textContent = S.phase === "running" || S.phase === "paused" ? "Recomeçar" : "Jogar";
        ui.pause.disabled = !(S.phase === "running" || S.phase === "paused");
        ui.pause.textContent = S.phase === "paused" ? "▶ Continuar" : "⏸ Pausar";
        ui.sound.textContent = Sound.on ? "🔊" : "🔇";
        ui.dpad.hidden = !(isTouch && ui.touch.value === "pad");
    };

    const idleText = () => {
        const tips = {
            classico: "Coma as frutas para crescer sem bater em você mesma.",
            tempo: "Você tem 60 segundos para comer o máximo de frutas. Bater custa 5 segundos.",
            zen: "Sem paredes e sem morrer: só relaxe e coma.",
            obstaculos: "A cada 5 frutas o campo ganha novos obstáculos.",
            diario: "O mesmo campo para todos hoje. Faça o melhor do dia!",
        };
        let t = tips[ui.mode.value];
        if (ui.players.value === "cpu") t += " O Dino também quer as frutas: quem bater perde.";
        if (ui.players.value === "2") t += " Jogador 1: WASD · Jogador 2: setas.";
        return t;
    };

    // ---------- Controle da partida ----------
    const start = () => {
        Sound.init();
        newBoard();
        S.phase = "running";
        S.acc = 0;
        S.lastTick = performance.now();
        ui.overlay.hidden = true;
        Sound.start();
        setStatus(S.players.length > 1 ? "Valendo! Quem bater primeiro perde." : `${MODES[S.mode]}: valendo!`);
        updateButtons();
        ui.board.focus({ preventScroll: true });
        // No celular, rola a página até o campo ficar inteiro na tela.
        if (window.innerWidth <= 860) ui.area.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const setPaused = (on) => {
        if (on && S.phase === "running") {
            S.phase = "paused";
            showOverlay("⏸", "Pausado", "Aperte P ou Espaço para continuar.", "Continuar");
        } else if (!on && S.phase === "paused") {
            S.phase = "running";
            ui.overlay.hidden = true;
            ui.board.focus({ preventScroll: true });
        }
        updateButtons();
    };

    const toIdle = () => {
        S.phase = "idle";
        newBoard();
        showOverlay("🐍", "Cobrinha", idleText(), "Jogar");
        setStatus("Escolha as opções acima e aperte Jogar.");
        updateButtons();
    };

    // ---------- Laço ----------
    let last = performance.now();
    let lastSecond = -1;
    const frame = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (S.phase === "running") {
            S.elapsed += dt;
            S.acc += dt * 1000;
            let guard = 0;
            while (S.acc >= S.interval && S.phase === "running" && guard++ < 5) {
                S.acc -= S.interval;
                tick();
            }
            if (S.power && S.elapsed > S.power.until) S.power = null;
            const prevSlow = S.interval;
            updateInterval();
            if (prevSlow !== S.interval) renderPanel();
            if (S.mode === "tempo" && S.phase === "running") {
                S.timeLeft -= dt;
                const sec = Math.ceil(S.timeLeft);
                if (sec !== lastSecond) {
                    lastSecond = sec;
                    if (sec <= 5 && sec > 0) Sound.tick();
                }
                if (S.timeLeft <= 0) { S.timeLeft = 0; finish(true); }
            }
            if (Math.floor(S.elapsed * 4) !== Math.floor((S.elapsed - dt) * 4)) renderPanel();
        }
        for (const p of S.players) if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 2.5);
        for (const pa of S.particles) { pa.t += dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.vx *= 0.93; pa.vy *= 0.93; }
        S.particles = S.particles.filter((pa) => pa.t < pa.life);
        for (const pp of S.popups) pp.t += dt;
        S.popups = S.popups.filter((pp) => pp.t < 0.9);
        render(now / 1000);
        requestAnimationFrame(frame);
    };

    // ---------- Entrada ----------
    const KEYS_P1 = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
    const KEYS_ARROWS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

    window.addEventListener("keydown", (e) => {
        if (e.target instanceof HTMLSelectElement) return;
        if (e.code === "KeyM") { Sound.toggle(); updateButtons(); return; }
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyP" || e.code === "Escape") {
            if (e.target instanceof HTMLButtonElement && (e.code === "Space" || e.code === "Enter")) return;
            e.preventDefault();
            if (S.phase === "running") setPaused(true);
            else if (S.phase === "paused") setPaused(false);
            else if (e.code !== "KeyP" && e.code !== "Escape") start();
            return;
        }
        const two = S.players.length === 2 && !S.players[1].cpu;
        if (e.code in KEYS_P1) {
            e.preventDefault();
            if (S.phase === "running") pushDir(S.players[0], KEYS_P1[e.code]);
        } else if (e.code in KEYS_ARROWS) {
            e.preventDefault();
            if (S.phase === "running") pushDir(two ? S.players[1] : S.players[0], KEYS_ARROWS[e.code]);
        }
    });

    // deslizar o dedo no campo
    let swipe = null;
    ui.frame.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" || e.target.closest("button")) return;
        swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    window.addEventListener("pointermove", (e) => {
        if (!swipe || e.pointerId !== swipe.id || S.phase !== "running") return;
        const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.hypot(dx, dy) < 18) return;
        pushDir(S.players[0], Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
        swipe.x = e.clientX;
        swipe.y = e.clientY;
    });
    const endSwipe = (e) => { if (swipe && e.pointerId === swipe.id) swipe = null; };
    window.addEventListener("pointerup", endSwipe);
    window.addEventListener("pointercancel", endSwipe);
    ui.frame.addEventListener("touchmove", (e) => { if (S.phase === "running") e.preventDefault(); }, { passive: false });

    ui.dpad.querySelectorAll("button").forEach((b) => {
        b.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (S.phase === "running") pushDir(S.players[0], Number(b.dataset.dir));
            b.classList.add("active");
        });
        const off = () => b.classList.remove("active");
        b.addEventListener("pointerup", off);
        b.addEventListener("pointerleave", off);
        b.addEventListener("pointercancel", off);
    });

    ui.play.addEventListener("click", start);
    ui.ovPlay.addEventListener("click", () => (S.phase === "paused" ? setPaused(false) : start()));
    ui.ovMenu.addEventListener("click", () => { ui.overlay.hidden = true; });
    ui.pause.addEventListener("click", () => setPaused(S.phase === "running"));
    ui.sound.addEventListener("click", () => { Sound.toggle(); updateButtons(); });

    // Opções: valem na hora se não houver partida; durante a partida, valem na próxima.
    const SAVE = { mode: "cobrinha-modo", players: "cobrinha-jogadores", diff: "cobrinha-velocidade", walls: "cobrinha-bordas", size: "cobrinha-campo", skin: "cobrinha-visual", touch: "cobrinha-toque", vibrate: "cobrinha-vibrar" };
    for (const [name, k] of Object.entries(SAVE)) {
        const sel = ui[name];
        const saved = store.get(k);
        if (saved !== null && [...sel.options].some((o) => o.value === saved && !o.disabled)) sel.value = saved;
        sel.addEventListener("change", () => {
            store.set(k, sel.value);
            if (name === "touch" || name === "vibrate") { updateButtons(); return; }
            ui.walls.disabled = ui.mode.value === "zen";
            if (S.phase === "running" || S.phase === "paused") {
                if (name === "skin") {
                    S.players[0].skin = SKINS[sel.value];
                    renderPlayers();
                } else {
                    setStatus("A mudança vale na próxima partida.", "");
                }
                return;
            }
            toIdle();
            renderPanel();
        });
    }

    window.addEventListener("resize", () => {
        if (S.phase === "idle" || S.phase === "over") {
            const [w, h] = [S.W, S.H];
            settingsFromUI();
            if (w !== S.W || h !== S.H) { [S.W, S.H] = [w, h]; if (S.phase === "idle") toIdle(); }
        }
        resize();
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

    window.__cobrinha = { S, tick, start };

    fillSkins();
    ui.walls.disabled = ui.mode.value === "zen";
    toIdle();
    requestAnimationFrame(frame);
})();
