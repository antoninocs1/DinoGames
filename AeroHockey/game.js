/* =====================================================================
   AeroHockey — mesa de ar (versão JavaScript do projeto em Java/libGDX)
   ---------------------------------------------------------------------
   A física e as medidas são as do original (AeroHockeyGame.java):
     mundo 1280 × 720, quadra com margem de 60, gol de 200 no meio de cada
     lateral, disco de raio 16, rebatedores de raio 40, rebatedor a 720/s,
     disco até 1500/s, atrito 0,55 por segundo, choque elástico (1,0),
     velocidade mínima de saída 90 e "bater forte" × 1,9.
   Novidades desta versão: contra o computador (3 níveis), mouse e dedo
   (o rebatedor segue a mão; em 2 jogadores cada dedo na sua metade),
   mesa na vertical com o celular em pé, partida até N gols, pausa, sons
   e recordes de vitórias contra o computador.
   ===================================================================== */
(() => {
    "use strict";
    const $ = (id) => document.getElementById(id);

    // ---------- Mundo (igual ao original) ----------
    const WORLD_W = 1280, WORLD_H = 720;
    const FIELD_LEFT = 60, FIELD_RIGHT = WORLD_W - 60, FIELD_TOP = 60, FIELD_BOTTOM = WORLD_H - 60; // y para baixo
    const GOAL_HALF = 100, GOAL_TOP = WORLD_H / 2 - GOAL_HALF, GOAL_BOTTOM = WORLD_H / 2 + GOAL_HALF;
    const PUCK_RADIUS = 16, PADDLE_RADIUS = 40;
    const PADDLE_SPEED = 720, PUCK_MAX_SPEED = 1500, PUCK_FRICTION = 0.55, RESTITUTION = 1.0;
    const MIN_EXIT_SPEED = 90, BOOST_FACTOR = 1.9;
    const HAND_SPEED = 2600;   // mouse/dedo: o rebatedor persegue a mão até esta velocidade (não atravessa o disco)
    const SUBSTEPS = 4;        // passos de física por quadro (disco rápido não atravessa o rebatedor)
    const LEVELS = {           // computador: velocidade, tempo de reação (s) e mira
        facil: { speed: 380, react: 0.32, spread: 150, boost: false, title: "Fácil" },
        normal: { speed: 560, react: 0.16, spread: 90, boost: false, title: "Normal" },
        dificil: { speed: 760, react: 0.06, spread: 45, boost: true, title: "Difícil" },
    };

    const storage = {
        get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponível */ } },
    };
    const PREFS_KEY = "dinogames-aerohockey-prefs", REC_KEY = "dinogames-aerohockey-records", SOUND_KEY = "dinogames-aerohockey-sound";
    const prefs = Object.assign({ players: "cpu", level: "normal", goal: "7", speed: "1" }, storage.get(PREFS_KEY) || {});
    const records = Object.assign({}, storage.get(REC_KEY) || {}); // { facil: { win, lose }, … }

    const ui = {
        canvas: $("board"), frame: $("frame"), area: $("area"), overlay: $("overlay"),
        ovIcon: $("ov-icon"), ovTitle: $("ov-title"), ovText: $("ov-text"), ovPlay: $("ov-play"),
        status: $("status"), play: $("btn-play"), pause: $("btn-pause"), sound: $("btn-sound"), records: $("records"),
        players: $("opt-players"), level: $("opt-level"), fieldLevel: $("field-level"), goal: $("opt-goal"), speed: $("opt-speed"),
        score: [$("score0"), $("score1")], name1: $("name1"), keys0: $("keys0"), keys1: $("keys1"), avatar1: $("avatar1"),
    };
    const ctx = ui.canvas.getContext("2d");

    // ---------- Som (Web Audio, suave) ----------
    const sound = {
        ctx: null, on: storage.get(SOUND_KEY) !== false,
        ensure() {
            if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
            if (this.ctx?.state === "suspended") this.ctx.resume();
            return this.ctx;
        },
        tone(freq, dur, { type = "sine", gain = 0.12, delay = 0, slide = 0 } = {}) {
            const c = this.ensure();
            if (!c || !this.on) return;
            const t = c.currentTime + 0.01 + delay;
            const o = c.createOscillator(), g = c.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, t);
            if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(c.destination);
            o.start(t);
            o.stop(t + dur + 0.02);
        },
        hit(power) { this.tone(420 + Math.min(1, power) * 420, 0.09, { type: "triangle", gain: 0.1 + Math.min(1, power) * 0.08, slide: 0.7 }); },
        wall() { this.tone(260, 0.06, { type: "sine", gain: 0.06, slide: 0.8 }); },
        goal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, { type: "triangle", gain: 0.09, delay: i * 0.09 })); },
        lose() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.18, { type: "sine", gain: 0.08, delay: i * 0.11 })); },
        win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, { type: "triangle", gain: 0.09, delay: i * 0.1 })); },
        start() { [392, 523].forEach((f, i) => this.tone(f, 0.12, { type: "sine", gain: 0.07, delay: i * 0.1 })); },
    };

    // ---------- Estado ----------
    const v2 = (x = 0, y = 0) => ({ x, y });
    const puck = { p: v2(), v: v2(), trail: [] };
    const pads = [
        { p: v2(), v: v2(), boost: false, color: "#ff6b6b", dark: "#8f2b2b", left: true, hand: null, think: 0, target: v2() },
        { p: v2(), v: v2(), boost: false, color: "#5aa9ff", dark: "#1f4f8f", left: false, hand: null, think: 0, target: v2() },
    ];
    const score = [0, 0];
    let phase = "menu";      // menu | play | goal | pause | over
    let goalTimer = 0, goalBy = -1, flash = 0;
    let lastHitSound = 0;
    const keys = new Set();

    const vsCpu = () => prefs.players === "cpu";
    const target = () => Number(prefs.goal) || 0;
    const speedK = () => Number(prefs.speed) || 1;

    /** Disco no centro (ou, depois de um gol, no lado de quem sofreu); rebatedores na frente do gol. */
    const resetAll = (serveTo = -1) => {
        puck.p.x = serveTo === 0 ? WORLD_W / 2 - 160 : serveTo === 1 ? WORLD_W / 2 + 160 : WORLD_W / 2;
        puck.p.y = WORLD_H / 2;
        puck.v.x = puck.v.y = 0;
        puck.trail.length = 0;
        pads[0].p.x = FIELD_LEFT + PADDLE_RADIUS + 80; pads[0].p.y = WORLD_H / 2;
        pads[1].p.x = FIELD_RIGHT - PADDLE_RADIUS - 80; pads[1].p.y = WORLD_H / 2;
        pads.forEach((pd) => { pd.v.x = pd.v.y = 0; pd.target.x = pd.p.x; pd.target.y = pd.p.y; });
    };

    // ---------- Tela: tamanho e mesa na vertical (celular em pé) ----------
    let vertical = false, scale = 1, dpr = 1;
    const fit = () => {
        vertical = window.innerHeight > window.innerWidth * 1.15 && window.innerWidth < 760;
        document.body.classList.toggle("vertical", vertical);
        ui.area.style.setProperty("--aspect", vertical ? String(WORLD_H / WORLD_W) : String(WORLD_W / WORLD_H));
        // Em pé: a mesa inteira cabe na altura da tela (abaixo do placar); a página rola até ela ao jogar.
        if (vertical) {
            const free = window.innerHeight - 74 - 24; // placar + bordas
            ui.area.style.setProperty("--bw", `${Math.max(200, Math.min(ui.area.parentElement.clientWidth, free * (WORLD_H / WORLD_W) + 16))}px`);
        } else ui.area.style.removeProperty("--bw");
        const cssW = ui.canvas.clientWidth || 640;
        const cssH = cssW * (vertical ? WORLD_W / WORLD_H : WORLD_H / WORLD_W);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        ui.canvas.width = Math.round(cssW * dpr);
        ui.canvas.height = Math.round(cssH * dpr);
        ui.canvas.style.height = `${cssH}px`;
        scale = ui.canvas.width / (vertical ? WORLD_H : WORLD_W);
        draw();
    };
    /** Ponto da tela (clientX/Y) → coordenadas da mesa. */
    const toWorld = (cx, cy) => {
        const r = ui.canvas.getBoundingClientRect();
        const sx = ((cx - r.left) / r.width) * ui.canvas.width / scale;
        const sy = ((cy - r.top) / r.height) * ui.canvas.height / scale;
        return vertical ? { x: WORLD_W - sy, y: sx } : { x: sx, y: sy }; // em pé: o Jogador 1 (esquerda) fica embaixo
    };

    // ---------- Entrada: teclado (como no original), mouse e dedo ----------
    window.addEventListener("keydown", (e) => {
        if (e.target.closest?.("select, input, textarea")) return;
        const k = e.key;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
        if (k === "p" || k === "P" || k === "Escape") { togglePause(); return; }
        if (k === "m" || k === "M") { toggleSound(); return; }
        if (k === "Enter") { if (phase === "menu" || phase === "over") startMatch(); else if (phase === "pause") togglePause(); return; }
        keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));
    window.addEventListener("blur", () => { keys.clear(); if (phase === "play" || phase === "goal") togglePause(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && (phase === "play" || phase === "goal")) togglePause(); });

    /** Qual rebatedor a mão (mouse ou dedo) controla: contra o computador, sempre o 1; em 2 jogadores, o da metade tocada. */
    const padForHand = (w) => (vsCpu() ? 0 : w.x < WORLD_W / 2 ? 0 : 1);
    const hands = new Map(); // pointerId → índice do rebatedor
    ui.canvas.addEventListener("pointerdown", (e) => {
        sound.ensure();
        if (phase === "menu" || phase === "over") return;
        const w = toWorld(e.clientX, e.clientY);
        const i = padForHand(w);
        if (pads[i].hand != null && e.pointerType === "touch") return; // já tem um dedo
        hands.set(e.pointerId, i);
        pads[i].hand = w;
        try { ui.canvas.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        e.preventDefault();
    });
    ui.canvas.addEventListener("pointermove", (e) => {
        const w = toWorld(e.clientX, e.clientY);
        if (hands.has(e.pointerId)) { pads[hands.get(e.pointerId)].hand = w; return; }
        // Mouse sem apertar também move o rebatedor do Jogador 1 (contra o computador).
        if (e.pointerType === "mouse" && vsCpu() && phase === "play") pads[0].hand = w;
    });
    const release = (e) => {
        if (!hands.has(e.pointerId)) return;
        const i = hands.get(e.pointerId);
        hands.delete(e.pointerId);
        if (e.pointerType !== "mouse") pads[i].hand = null;
    };
    ui.canvas.addEventListener("pointerup", release);
    ui.canvas.addEventListener("pointercancel", release);
    ui.canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !hands.has(e.pointerId)) pads[0].hand = null; });

    // ---------- Movimento dos rebatedores ----------
    const clampPad = (pd) => {
        const minX = pd.left ? FIELD_LEFT + PADDLE_RADIUS : WORLD_W / 2 + PADDLE_RADIUS;
        const maxX = pd.left ? WORLD_W / 2 - PADDLE_RADIUS : FIELD_RIGHT - PADDLE_RADIUS;
        pd.p.x = Math.min(maxX, Math.max(minX, pd.p.x));
        pd.p.y = Math.min(FIELD_BOTTOM - PADDLE_RADIUS, Math.max(FIELD_TOP + PADDLE_RADIUS, pd.p.y));
    };
    /** Vai até o alvo com velocidade máxima maxSpeed; guarda a velocidade (usada no choque). */
    const chase = (pd, tx, ty, maxSpeed, dt) => {
        const dx = tx - pd.p.x, dy = ty - pd.p.y, d = Math.hypot(dx, dy);
        const step = Math.min(d, maxSpeed * dt);
        const ox = pd.p.x, oy = pd.p.y;
        if (d > 0.01) { pd.p.x += (dx / d) * step; pd.p.y += (dy / d) * step; }
        clampPad(pd);
        pd.v.x = (pd.p.x - ox) / dt; pd.v.y = (pd.p.y - oy) / dt;
    };
    /** Teclado (igual ao original): direção normalizada × PADDLE_SPEED. */
    const keyMove = (pd, dx, dy, dt) => {
        if (dx || dy) {
            const n = Math.hypot(dx, dy);
            pd.v.x = (dx / n) * PADDLE_SPEED; pd.v.y = (dy / n) * PADDLE_SPEED;
            pd.p.x += pd.v.x * dt; pd.p.y += pd.v.y * dt;
            const ox = pd.p.x, oy = pd.p.y;
            clampPad(pd);
            if (pd.p.x !== ox) pd.v.x = 0;
            if (pd.p.y !== oy) pd.v.y = 0;
            return true;
        }
        return false;
    };

    /** Computador: defende o gol e ataca quando o disco está do seu lado, mirando no gol do Jogador 1. */
    const cpuMove = (pd, dt) => {
        const L = LEVELS[prefs.level] || LEVELS.normal;
        if (pd.striking > 0) pd.striking -= dt; // tempo da batida (depois volta a se posicionar)
        pd.think -= dt;
        if (pd.think <= 0) {
            pd.think = L.react;
            const homeX = FIELD_RIGHT - PADDLE_RADIUS - 70;
            const homeY = Math.min(GOAL_BOTTOM - 10, Math.max(GOAL_TOP + 10, WORLD_H / 2 + (puck.p.y - WORLD_H / 2) * 0.6));
            const mine = puck.p.x > WORLD_W / 2 - 30;
            if (!mine) {
                pd.target.x = homeX; pd.target.y = homeY; // espera na frente do gol, acompanhando o disco
            } else if (puck.p.x > pd.p.x - 8) {
                // Disco entre o rebatedor e o próprio gol: contorna por trás sem empurrar para o gol.
                pd.target.x = Math.min(FIELD_RIGHT - PADDLE_RADIUS, puck.p.x + PADDLE_RADIUS + PUCK_RADIUS + 20);
                pd.target.y = puck.p.y + (puck.p.y < WORLD_H / 2 ? 70 : -70);
            } else {
                // Ataque em dois tempos, mirando no gol do Jogador 1 (com uma variação na mira):
                // 1) vai para trás do disco, na linha da mira; 2) bate atravessando o disco nessa direção.
                if (!pd.aim || pd.aimFor !== Math.round(puck.p.x / 200)) {
                    pd.aim = WORLD_H / 2 + (Math.random() * 2 - 1) * L.spread;
                    pd.aimFor = Math.round(puck.p.x / 200);
                }
                const ax = puck.p.x - FIELD_LEFT, ay = puck.p.y - pd.aim, n = Math.hypot(ax, ay) || 1;
                const ux = ax / n, uy = ay / n; // da mira para o disco (aponta para "trás" do disco)
                const bx = puck.p.x + ux * (PADDLE_RADIUS + PUCK_RADIUS + 14), by = puck.p.y + uy * (PADDLE_RADIUS + PUCK_RADIUS + 14);
                const lined = Math.hypot(pd.p.x - bx, pd.p.y - by) < 26 || pd.striking > 0;
                if (lined) {
                    pd.striking = pd.striking > 0 ? pd.striking : 0.35;
                    pd.target.x = puck.p.x - ux * 60; pd.target.y = puck.p.y - uy * 60; // atravessa o disco
                } else {
                    pd.target.x = bx; pd.target.y = by;
                }
            }
            if (!mine) pd.striking = 0;
            pd.boost = L.boost && mine && Math.hypot(puck.p.x - pd.p.x, puck.p.y - pd.p.y) < 130;
        }
        chase(pd, pd.target.x, pd.target.y, L.speed, dt);
    };

    const updateInput = (dt) => {
        // Jogador 1 (esquerda): setas + Espaço (forte); contra o computador vale também W A S D.
        let dx1 = 0, dy1 = 0;
        if (keys.has("ArrowLeft")) dx1 -= 1;
        if (keys.has("ArrowRight")) dx1 += 1;
        if (keys.has("ArrowUp")) dy1 -= 1;
        if (keys.has("ArrowDown")) dy1 += 1;
        if (vsCpu()) {
            if (keys.has("KeyA")) dx1 -= 1;
            if (keys.has("KeyD")) dx1 += 1;
            if (keys.has("KeyW")) dy1 -= 1;
            if (keys.has("KeyS") || keys.has("KeyZ")) dy1 += 1;
        }
        pads[0].boost = keys.has("Space") || (vsCpu() && (keys.has("ShiftLeft") || keys.has("ShiftRight")));
        if (!keyMove(pads[0], dx1, dy1, dt)) {
            if (pads[0].hand) chase(pads[0], pads[0].hand.x, pads[0].hand.y, HAND_SPEED, dt);
            else { pads[0].v.x = pads[0].v.y = 0; }
        } else pads[0].hand = null;

        if (vsCpu()) { cpuMove(pads[1], dt); return; }
        // Jogador 2 (direita): A S W Z (esquerda, direita, cima, baixo) + Shift (forte), como no original.
        let dx2 = 0, dy2 = 0;
        if (keys.has("KeyA")) dx2 -= 1;
        if (keys.has("KeyS")) dx2 += 1;
        if (keys.has("KeyW")) dy2 -= 1;
        if (keys.has("KeyZ")) dy2 += 1;
        pads[1].boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        if (!keyMove(pads[1], dx2, dy2, dt)) {
            if (pads[1].hand) chase(pads[1], pads[1].hand.x, pads[1].hand.y, HAND_SPEED, dt);
            else { pads[1].v.x = pads[1].v.y = 0; }
        } else pads[1].hand = null;
    };

    // ---------- Física (igual ao original, em passos menores) ----------
    const collidePaddle = (pd) => {
        let nx = puck.p.x - pd.p.x, ny = puck.p.y - pd.p.y;
        let dist = Math.hypot(nx, ny);
        const minDist = PADDLE_RADIUS + PUCK_RADIUS;
        if (dist >= minDist) return;
        if (dist < 0.0001) { nx = 1; ny = 0; dist = 1; }
        nx /= dist; ny /= dist;                     // normal do rebatedor para o disco
        puck.p.x = pd.p.x + nx * minDist;           // separa (sem "afundar")
        puck.p.y = pd.p.y + ny * minDist;
        const vn = (puck.v.x - pd.v.x) * nx + (puck.v.y - pd.v.y) * ny;
        if (vn < 0) {                                // disco se aproximando
            let impulse = -(1 + RESTITUTION) * vn;
            if (pd.boost) impulse *= BOOST_FACTOR;
            puck.v.x += nx * impulse; puck.v.y += ny * impulse;
            const exit = puck.v.x * nx + puck.v.y * ny;
            if (exit < MIN_EXIT_SPEED) { puck.v.x += nx * (MIN_EXIT_SPEED - exit); puck.v.y += ny * (MIN_EXIT_SPEED - exit); }
            const now = performance.now();
            if (now - lastHitSound > 60) { sound.hit(impulse / 1200); lastHitSound = now; }
        }
        const maxV = PUCK_MAX_SPEED * speedK(), sp = Math.hypot(puck.v.x, puck.v.y);
        if (sp > maxV) { puck.v.x *= maxV / sp; puck.v.y *= maxV / sp; }
    };

    /** Paredes (sempre rebatem) e gols (só na abertura do meio da lateral). Devolve o jogador que marcou ou −1. */
    const wallsAndGoals = () => {
        let bounced = false;
        if (puck.p.y - PUCK_RADIUS < FIELD_TOP) { puck.p.y = FIELD_TOP + PUCK_RADIUS; puck.v.y = -puck.v.y * RESTITUTION; bounced = true; }
        if (puck.p.y + PUCK_RADIUS > FIELD_BOTTOM) { puck.p.y = FIELD_BOTTOM - PUCK_RADIUS; puck.v.y = -puck.v.y * RESTITUTION; bounced = true; }
        const inGoalBand = puck.p.y > GOAL_TOP && puck.p.y < GOAL_BOTTOM;
        if (inGoalBand) {
            if (puck.p.x < FIELD_LEFT) return 1;   // gol do Jogador 2
            if (puck.p.x > FIELD_RIGHT) return 0;  // gol do Jogador 1
        } else {
            if (puck.p.x - PUCK_RADIUS < FIELD_LEFT) { puck.p.x = FIELD_LEFT + PUCK_RADIUS; puck.v.x = -puck.v.x * RESTITUTION; bounced = true; }
            if (puck.p.x + PUCK_RADIUS > FIELD_RIGHT) { puck.p.x = FIELD_RIGHT - PUCK_RADIUS; puck.v.x = -puck.v.x * RESTITUTION; bounced = true; }
        }
        if (bounced && Math.hypot(puck.v.x, puck.v.y) > 120) {
            const now = performance.now();
            if (now - lastHitSound > 60) { sound.wall(); lastHitSound = now; }
        }
        return -1;
    };

    const updatePhysics = (dt) => {
        const h = dt / SUBSTEPS;
        for (let s = 0; s < SUBSTEPS; s++) {
            puck.p.x += puck.v.x * h; puck.p.y += puck.v.y * h;
            // Atrito (decaimento suave, como no original)
            const sp = Math.hypot(puck.v.x, puck.v.y);
            if (sp > 0) {
                const ns = Math.max(0, sp - PUCK_FRICTION * sp * h);
                if (ns > 0) { puck.v.x *= ns / sp; puck.v.y *= ns / sp; } else { puck.v.x = puck.v.y = 0; }
            }
            collidePaddle(pads[0]);
            collidePaddle(pads[1]);
            const scorer = wallsAndGoals();
            if (scorer >= 0) { scored(scorer); return; }
        }
        puck.trail.push({ x: puck.p.x, y: puck.p.y });
        if (puck.trail.length > 8) puck.trail.shift();
    };

    // ---------- Partida ----------
    const setStatus = (text, kind = "") => { ui.status.textContent = text; ui.status.className = `status ${kind}`.trim(); };
    const name = (i) => (i === 0 ? "Jogador 1" : vsCpu() ? "Computador" : "Jogador 2");
    const renderScore = () => {
        ui.score.forEach((el, i) => { if (el.textContent !== String(score[i])) { el.textContent = String(score[i]); el.classList.remove("pulo"); void el.offsetWidth; el.classList.add("pulo"); } });
        ui.name1.textContent = name(1);
        ui.avatar1.textContent = vsCpu() ? "🤖" : "2";
        ui.keys1.textContent = vsCpu() ? (LEVELS[prefs.level] || LEVELS.normal).title : "A S W Z · Shift";
        ui.keys0.textContent = vsCpu() ? "Mouse/dedo · setas · Espaço" : "Setas · Espaço";
        ui.fieldLevel.hidden = !vsCpu();
    };
    const renderRecords = () => {
        ui.records.innerHTML = Object.entries(LEVELS).map(([id, L]) => {
            const r = records[id] || { win: 0, lose: 0 };
            return `<span class="${id === prefs.level ? "atual" : ""}">${L.title}</span><b>${r.win} × ${r.lose}</b>`;
        }).join("") + `<span>Vitórias × derrotas</span><b></b>`;
    };
    const showOverlay = (icon, title, text, button = "Jogar") => {
        ui.ovIcon.textContent = icon; ui.ovTitle.textContent = title; ui.ovText.innerHTML = text; ui.ovPlay.textContent = button;
        ui.overlay.hidden = false;
        ui.canvas.classList.add("paused-cursor");
    };
    const hideOverlay = () => { ui.overlay.hidden = true; ui.canvas.classList.remove("paused-cursor"); };
    const updateButtons = () => {
        ui.pause.disabled = !(phase === "play" || phase === "goal" || phase === "pause");
        ui.pause.textContent = phase === "pause" ? "▶ Continuar" : "⏸ Pausar";
        ui.play.textContent = phase === "menu" ? "Jogar" : "Recomeçar";
    };

    const startMatch = () => {
        sound.ensure();
        score[0] = score[1] = 0;
        resetAll(Math.random() < 0.5 ? 0 : 1);
        phase = "play";
        hideOverlay();
        renderScore();
        updateButtons();
        sound.start();
        if (vertical) ui.area.scrollIntoView({ block: "start", behavior: "smooth" }); // celular em pé: mostra a mesa inteira
        const t = target();
        setStatus(`${t ? `Quem fizer ${t} gols vence. ` : "Partida sem fim. "}${vsCpu() ? "Mova o rebatedor vermelho com o mouse, o dedo ou as setas." : "Jogador 1 à esquerda, Jogador 2 à direita."}`, "bom");
        ui.canvas.focus({ preventScroll: true });
    };

    const scored = (i) => {
        score[i]++;
        goalBy = i;
        flash = 1;
        renderScore();
        const t = target();
        if (t && score[i] >= t) { endMatch(i); return; }
        if (vsCpu() && i === 1) sound.lose(); else sound.goal();
        phase = "goal";
        goalTimer = 1.1;
        setStatus(`Gol do ${name(i)}! ${score[0]} × ${score[1]}`, i === 0 || !vsCpu() ? "bom" : "ruim");
    };

    const endMatch = (winner) => {
        phase = "over";
        updateButtons();
        if (vsCpu()) {
            const r = records[prefs.level] || (records[prefs.level] = { win: 0, lose: 0 });
            if (winner === 0) r.win++; else r.lose++;
            storage.set(REC_KEY, records);
            renderRecords();
        }
        if (vsCpu() && winner === 1) {
            sound.lose();
            showOverlay("💪", "Quase!", `O computador venceu por <b>${score[1]} × ${score[0]}</b>. Vamos de novo?`, "Jogar de novo");
            setStatus("O computador venceu. Tente o nível Fácil ou bata com mais força (Espaço).", "ruim");
        } else {
            sound.win();
            showOverlay("🏆", `${name(winner)} venceu!`, `Placar final: <b>${score[0]} × ${score[1]}</b>`, "Jogar de novo");
            setStatus(`${name(winner)} venceu por ${Math.max(...score)} × ${Math.min(...score)}! 🎉`, "bom");
        }
    };

    const togglePause = () => {
        if (phase === "play" || phase === "goal") {
            pausedFrom = phase;
            phase = "pause";
            showOverlay("⏸", "Pausa", "Toque em Continuar (ou aperte P) para voltar ao jogo.", "Continuar");
            setStatus("Jogo pausado.");
        } else if (phase === "pause") {
            phase = pausedFrom || "play";
            hideOverlay();
            setStatus(`${score[0]} × ${score[1]}`);
        }
        updateButtons();
    };
    let pausedFrom = "play";

    const toggleSound = () => {
        sound.on = !sound.on;
        storage.set(SOUND_KEY, sound.on);
        ui.sound.textContent = sound.on ? "🔊" : "🔇";
    };

    // ---------- Desenho ----------
    const roundRect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
    const draw = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
        // Mundo → tela (em pé: girado 90°, o lado esquerdo da mesa fica embaixo).
        if (vertical) ctx.setTransform(0, -scale, scale, 0, 0, WORLD_W * scale);
        else ctx.setTransform(scale, 0, 0, scale, 0, 0);

        // Borda da mesa
        const fw = FIELD_RIGHT - FIELD_LEFT, fh = FIELD_BOTTOM - FIELD_TOP;
        roundRect(FIELD_LEFT - 26, FIELD_TOP - 26, fw + 52, fh + 52, 34);
        const rim = ctx.createLinearGradient(0, FIELD_TOP - 26, 0, FIELD_BOTTOM + 26);
        rim.addColorStop(0, "#3a4a66"); rim.addColorStop(1, "#141c2b");
        ctx.fillStyle = rim; ctx.fill();
        // Quadra (cor do original: 0.16, 0.21, 0.30)
        roundRect(FIELD_LEFT, FIELD_TOP, fw, fh, 18);
        const ice = ctx.createLinearGradient(0, FIELD_TOP, 0, FIELD_BOTTOM);
        ice.addColorStop(0, "#2d3b55"); ice.addColorStop(1, "#243148");
        ctx.fillStyle = ice; ctx.fill();
        // Furinhos de ar
        ctx.fillStyle = "#ffffff12";
        for (let x = FIELD_LEFT + 30; x < FIELD_RIGHT - 10; x += 40) for (let y = FIELD_TOP + 30; y < FIELD_BOTTOM - 10; y += 40) {
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        // Linha e círculo do centro
        ctx.fillStyle = "#ffffff40"; ctx.fillRect(WORLD_W / 2 - 2, FIELD_TOP, 4, fh);
        ctx.strokeStyle = "#ffffff2a"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(WORLD_W / 2, WORLD_H / 2, 90, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#ffffffd9"; ctx.beginPath(); ctx.arc(WORLD_W / 2, WORLD_H / 2, 8, 0, Math.PI * 2); ctx.fill();
        // Área do gol (meia-lua) e abertura colorida de cada lado
        [[FIELD_LEFT, "#ff6b6b", 0, 1], [FIELD_RIGHT, "#5aa9ff", Math.PI, 0]].forEach(([gx, col, a0, side]) => {
            ctx.strokeStyle = col + "66"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(gx, WORLD_H / 2, 130, side ? -Math.PI / 2 : Math.PI / 2, side ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
            ctx.fillStyle = col + "8c";
            ctx.fillRect(side ? gx - 18 : gx, GOAL_TOP, 18, GOAL_BOTTOM - GOAL_TOP);
            ctx.fillStyle = "#05080f";
            ctx.fillRect(side ? gx - 30 : gx + 18, GOAL_TOP + 6, 12, GOAL_BOTTOM - GOAL_TOP - 12);
        });

        // Rastro do disco rápido
        const sp = Math.hypot(puck.v.x, puck.v.y);
        if (sp > 500) puck.trail.forEach((t, i) => {
            ctx.fillStyle = `rgba(200,225,255,${(i / puck.trail.length) * 0.18})`;
            ctx.beginPath(); ctx.arc(t.x, t.y, PUCK_RADIUS * (0.5 + i / puck.trail.length / 2), 0, Math.PI * 2); ctx.fill();
        });

        // Rebatedores (como no original: sombra, anel escuro, centro colorido e pino branco)
        pads.forEach((pd) => {
            ctx.fillStyle = "#00000059"; ctx.beginPath(); ctx.arc(pd.p.x + 3, pd.p.y + 6, PADDLE_RADIUS + 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pd.dark; ctx.beginPath(); ctx.arc(pd.p.x, pd.p.y, PADDLE_RADIUS, 0, Math.PI * 2); ctx.fill();
            const g = ctx.createRadialGradient(pd.p.x - 10, pd.p.y - 12, 4, pd.p.x, pd.p.y, PADDLE_RADIUS * 0.8);
            g.addColorStop(0, "#ffffff"); g.addColorStop(0.18, pd.color); g.addColorStop(1, pd.dark);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pd.p.x, pd.p.y, PADDLE_RADIUS * 0.78, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pd.boost ? "#fff7b0" : "#ffffffd9";
            ctx.beginPath(); ctx.arc(pd.p.x, pd.p.y, PADDLE_RADIUS * 0.25, 0, Math.PI * 2); ctx.fill();
            if (pd.boost) { ctx.strokeStyle = "#fff7b0aa"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pd.p.x, pd.p.y, PADDLE_RADIUS + 7, 0, Math.PI * 2); ctx.stroke(); }
        });

        // Disco
        ctx.fillStyle = "#00000066"; ctx.beginPath(); ctx.arc(puck.p.x + 2, puck.p.y + 4, PUCK_RADIUS + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#333842"; ctx.beginPath(); ctx.arc(puck.p.x, puck.p.y, PUCK_RADIUS + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f2f2ff"; ctx.beginPath(); ctx.arc(puck.p.x, puck.p.y, PUCK_RADIUS, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#b3bfd9"; ctx.beginPath(); ctx.arc(puck.p.x, puck.p.y, PUCK_RADIUS * 0.5, 0, Math.PI * 2); ctx.fill();

        // "GOL!" na tela (sem girar)
        if (phase === "goal" || flash > 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const col = goalBy === 0 ? "255,107,107" : "90,169,255";
            ctx.fillStyle = `rgba(${col},${0.18 * flash})`;
            ctx.fillRect(0, 0, ui.canvas.width, ui.canvas.height);
            if (phase === "goal") {
                ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.font = `800 ${Math.round(ui.canvas.width * (vertical ? 0.14 : 0.08))}px "Segoe UI", system-ui, sans-serif`;
                ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 24 * dpr;
                ctx.fillText("GOL!", ui.canvas.width / 2, ui.canvas.height / 2);
                ctx.shadowBlur = 0;
            }
        }
    };

    // ---------- Laço do jogo ----------
    let last = performance.now();
    const loop = (now) => {
        const dt = Math.min((now - last) / 1000, 1 / 30); // como o original: no máximo 1/30 s por quadro
        last = now;
        if (phase === "play") {
            updateInput(dt);
            updatePhysics(dt * speedK());
        } else if (phase === "goal") {
            goalTimer -= dt;
            if (goalTimer <= 0) { resetAll(goalBy === 0 ? 1 : 0); phase = "play"; setStatus(`${score[0]} × ${score[1]}`); }
        }
        if (flash > 0) flash = Math.max(0, flash - dt * 1.4);
        draw();
        requestAnimationFrame(loop);
    };

    // ---------- Opções ----------
    const bind = (el, key, after) => {
        el.value = prefs[key];
        if (el.value !== prefs[key]) prefs[key] = el.value;
        el.addEventListener("change", () => { prefs[key] = el.value; storage.set(PREFS_KEY, prefs); after?.(); });
    };
    const optionChanged = () => {
        renderScore();
        renderRecords();
        if (phase !== "menu") {
            phase = "menu";
            resetAll();
            score[0] = score[1] = 0;
            renderScore();
            showOverlay("🏒", "AeroHockey", "Opção alterada. Toque em Jogar para começar.");
            setStatus("Opção alterada. Toque em Jogar para começar.");
            updateButtons();
        }
    };
    bind(ui.players, "players", optionChanged);
    bind(ui.level, "level", optionChanged);
    bind(ui.goal, "goal", optionChanged);
    bind(ui.speed, "speed", optionChanged);

    ui.ovPlay.addEventListener("click", () => (phase === "pause" ? togglePause() : startMatch()));
    ui.play.addEventListener("click", startMatch);
    ui.pause.addEventListener("click", togglePause);
    ui.sound.addEventListener("click", toggleSound);
    ui.sound.textContent = sound.on ? "🔊" : "🔇";
    window.addEventListener("resize", fit);

    // Leitura do estado (só leitura; usada nos testes automáticos).
    window.__aero = () => ({ phase, score: [...score], puck: { ...puck.p }, vel: { ...puck.v }, pads: pads.map((pd) => ({ ...pd.p })), vertical });

    resetAll();
    renderScore();
    renderRecords();
    updateButtons();
    fit();
    requestAnimationFrame(loop);
})();
