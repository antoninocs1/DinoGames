/* =====================================================================
   Pontos e Quadrados — tela, toques, computador e sons
   As regras e a jogada do computador ficam em engine.js.
   ===================================================================== */
(() => {
    "use strict";

    const E = window.PontosEngine;
    const $ = (id) => document.getElementById(id);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const SVG_NS = "http://www.w3.org/2000/svg";

    const storage = {
        get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* indisponível */ } },
    };
    const PREFS_KEY = "pontos-prefs";
    const SCORE_KEY = "pontos-score";
    const CPU_NAME = "Dino";
    const LEVEL_NAMES = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };

    // =================================================================
    // Sons (Web Audio, sintetizados e suaves)
    // =================================================================
    const audio = {
        ctx: null,
        enabled: true,
        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
            }
            if (this.ctx.state === "suspended") this.ctx.resume();
            return this.ctx;
        },
        tone(freq, seconds, { gain = 0.08, delay = 0, wave = "sine", attack = 0.01 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + attack);
            g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + seconds + 0.05);
        },
        /** Traço: "tic" de lápis, um pouco diferente para cada jogador. */
        line(player) { this.tone(player ? 392 : 523.25, 0.09, { gain: 0.05, wave: "triangle" }); },
        /** Quadrado fechado: "plim" que sobe a cada quadrado seguido. */
        box(combo) {
            const f = 523.25 * Math.pow(2, Math.min(combo, 12) * 2 / 12);
            this.tone(f, 0.22, { gain: 0.07 });
            this.tone(f * 1.5, 0.28, { gain: 0.04, delay: 0.07 });
        },
        win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.28, { gain: 0.07, delay: i * 0.12 })); },
        /** Fim sem vitória: arpejo calmo e alegre, sem som de "derrota". */
        end() { [392, 493.88, 587.33, 783.99].forEach((f, i) => this.tone(f, 0.3, { gain: 0.06, delay: i * 0.13 })); },
        nope() { this.tone(330, 0.12, { gain: 0.04, wave: "triangle" }); },
    };

    // =================================================================
    // Preferências, nomes e placar guardados
    // =================================================================
    const DEFAULTS = { mode: "cpu", level: "medio", size: "5", first: "alternar", theme: "papel", names: {}, sound: true };
    const prefs = Object.assign({}, DEFAULTS, storage.get(PREFS_KEY) || {});
    if (!prefs.names || typeof prefs.names !== "object" || Array.isArray(prefs.names)) prefs.names = {};
    audio.enabled = prefs.sound !== false;
    const savePrefs = () => storage.set(PREFS_KEY, prefs);
    const scores = storage.get(SCORE_KEY) || {};

    const ui = {
        mode: $("mode"), level: $("level"), size: $("size"), first: $("first"), theme: $("theme"),
        board: $("board"), players: $("players"), status: $("status"), overlay: $("overlay"),
        overlayIcon: $("overlay-icon"), overlayTitle: $("overlay-title"), overlayText: $("overlay-text"),
        btnUndo: $("btn-undo"), btnHint: $("btn-hint"), btnSound: $("btn-sound"),
        score: $("score"), scoreInfo: $("score-info"), name0: $("name0"), name1: $("name1"), confetti: $("confetti"),
    };

    const vsCpu = () => prefs.mode === "cpu";
    const CPU = 1; // contra o Dino, o computador é sempre o jogador 2 (cor 2)
    const isCpuTurn = () => vsCpu() && state && state.turn === CPU && !E.isOver(state);

    /** Nome de cada jogador (o 2º é o Dino contra o computador). */
    // Cada modo guarda os seus nomes: contra o Dino ("Você") e entre duas pessoas.
    const nameKey = (p) => (vsCpu() ? `cpu${p}` : `two${p}`);
    const defaultName = (p) => (vsCpu() ? "Você" : `Jogador ${p + 1}`);
    const nameOf = (p) => {
        if (p === 1 && vsCpu()) return CPU_NAME;
        return (prefs.names[nameKey(p)] || "").trim() || defaultName(p);
    };
    /** Letras que vão nos quadrados: a inicial; se forem iguais, as duas primeiras; se ainda iguais, 1 e 2. */
    const initials = () => {
        const a = nameOf(0).toUpperCase(), b = nameOf(1).toUpperCase();
        if (a[0] !== b[0]) return [a[0], b[0]];
        if (a.slice(0, 2) !== b.slice(0, 2) && a.length > 1 && b.length > 1) return [a.slice(0, 2), b.slice(0, 2)];
        return ["1", "2"];
    };
    /** Contra o Dino, o jogador 1 é a pessoa: as mensagens falam com "você". */
    const isYou = (p) => vsCpu() && p === 0;

    // =================================================================
    // Estado da partida
    // =================================================================
    let geo = null;
    let state = null;
    let lastEdge = -1;
    let edgeOwner = null;     // quem fez cada traço (para a cor)
    let history = [];         // fotos para desfazer
    let combo = 0;            // quadrados seguidos na mesma vez (som)
    let token = 0;            // muda a cada nova partida/desfazer, cancela o computador
    let thinking = false;
    let lastFirst = 1;        // para alternar quem começa
    let cursor = -1;          // traço escolhido pelo teclado
    let hintEdge = -1;
    let hintTimer = 0;

    const els = { edges: [], boxes: [] };

    const newGame = () => {
        token++;
        thinking = false;
        clearHint();
        const n = Number(prefs.size);
        geo = E.makeGeometry(n, n);
        let first;
        if (prefs.first === "alternar") first = lastFirst = 1 - lastFirst;
        else first = Number(prefs.first);
        state = E.createState(geo, first);
        edgeOwner = new Int8Array(geo.edgeCount).fill(-1);
        lastEdge = -1;
        history = [];
        combo = 0;
        cursor = -1;
        ui.overlay.hidden = true;
        build();
        render();
        afterMove();
    };

    // =================================================================
    // Desenho (SVG: 1 unidade = distância entre dois pontos)
    // =================================================================
    const make = (tag, attrs) => {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    };

    const build = () => {
        const { rows, cols } = geo;
        const pad = 0.42;
        ui.board.setAttribute("viewBox", `${-pad} ${-pad} ${cols + pad * 2} ${rows + pad * 2}`);
        ui.board.replaceChildren();
        const gBoxes = make("g", { class: "boxes" });
        const gEdges = make("g", { class: "edges" });
        const gDots = make("g", { class: "dots" });
        els.boxes = [];
        els.edges = [];
        const letters = initials();
        const fontSize = (l) => (l.length > 1 ? 0.36 : 0.5);
        for (let b = 0; b < geo.boxCount; b++) {
            const r = Math.floor(b / cols), c = b % cols;
            const g = make("g", { class: "box" });
            g.append(make("rect", { x: c + 0.09, y: r + 0.09, width: 0.82, height: 0.82, rx: 0.07 }));
            const t = make("text", { x: c + 0.5, y: r + 0.53 });
            g.append(t);
            gBoxes.append(g);
            els.boxes.push({ g, t });
        }
        for (let e = 0; e < geo.edgeCount; e++) {
            const [[x1, y1], [x2, y2]] = geo.ends(e);
            // Encolhe um tiquinho para não cobrir os pontos.
            const k = 0.13;
            const dx = Math.sign(x2 - x1) * k, dy = Math.sign(y2 - y1) * k;
            const line = make("line", { class: "edge", x1: x1 + dx, y1: y1 + dy, x2: x2 - dx, y2: y2 - dy, pathLength: 1 });
            gEdges.append(line);
            els.edges.push(line);
        }
        const r = cols > 6 ? 0.1 : 0.115;
        for (let y = 0; y <= rows; y++) {
            for (let x = 0; x <= cols; x++) {
                gDots.append(make("circle", { class: "dot", cx: x, cy: y, r }));
                gDots.append(make("circle", { class: "dot-shine", cx: x - r * 0.3, cy: y - r * 0.35, r: r * 0.32 }));
            }
        }
        ui.board.append(gBoxes, gEdges, gDots);
        els.letters = letters;
        els.fontSize = fontSize;
    };

    /** Atualiza traços e quadrados conforme o estado (sem refazer o SVG). */
    const render = () => {
        const letters = initials();
        for (let e = 0; e < geo.edgeCount; e++) {
            const el = els.edges[e];
            const on = !!state.edges[e];
            el.classList.toggle("on", on);
            el.classList.toggle("p0", on && edgeOwner[e] === 0);
            el.classList.toggle("p1", on && edgeOwner[e] === 1);
            el.classList.toggle("ultimo", on && e === lastEdge);
            el.classList.toggle("dica", !on && e === hintEdge);
            el.classList.toggle("cursor", !on && e === cursor);
            if (on) el.classList.remove("preview");
        }
        for (let b = 0; b < geo.boxCount; b++) {
            const { g, t } = els.boxes[b];
            const o = state.owner[b];
            g.classList.toggle("on", o >= 0);
            g.classList.toggle("p0", o === 0);
            g.classList.toggle("p1", o === 1);
            if (o >= 0) {
                t.textContent = letters[o];
                t.setAttribute("font-size", els.fontSize(letters[o]));
            }
        }
        ui.board.style.setProperty("--pc", `var(--p${state.turn})`);
        renderPlayers();
        renderStatus();
        renderButtons();
    };

    const renderPlayers = () => {
        const letters = initials();
        const over = E.isOver(state);
        const html = [0, 1].map((p) => {
            const active = !over && state.turn === p;
            const think = active && thinking ? " pensando" : "";
            const sub = p === 1 && vsCpu() ? `Computador · ${LEVEL_NAMES[prefs.level]}` : active ? "Sua vez" : "";
            return `<div class="player p${p}${active ? " ativo" : ""}${think}">
                <span class="avatar">${letters[p]}</span>
                <span class="who"><strong>${escapeHtml(nameOf(p))}</strong><small>${sub} <span class="dots-think"><i></i><i></i><i></i></span></small></span>
                <span class="pts" data-p="${p}">${state.score[p]}</span>
            </div>`;
        }).join("");
        ui.players.innerHTML = html;
    };

    const escapeHtml = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

    let flash = "";
    let flashKind = "";
    let flashTimer = 0;
    const setFlash = (text, kind = "", ms = 1800) => {
        flash = text;
        flashKind = kind;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = ""; renderStatus(); }, ms);
        renderStatus();
    };

    const renderStatus = () => {
        ui.status.style.setProperty("--pc", `var(--p${state.turn})`);
        if (E.isOver(state)) {
            ui.status.className = "status bom";
            ui.status.textContent = resultText().short;
            return;
        }
        if (flash) {
            ui.status.className = `status ${flashKind || "vez"}`;
            ui.status.textContent = flash;
            return;
        }
        ui.status.className = "status vez";
        const p = state.turn;
        if (isCpuTurn()) ui.status.textContent = `${CPU_NAME} está pensando…`;
        else if (isYou(p)) {
            const who = nameOf(0) === "Você" ? "" : `, ${nameOf(0)}`;
            ui.status.textContent = state.moves === 0 ? `Você começa${who}! Ligue dois pontos vizinhos.` : `Sua vez${who}! Ligue dois pontos vizinhos.`;
        }
        else ui.status.textContent = `Vez de ${nameOf(p)}.`;
    };

    const renderButtons = () => {
        ui.btnUndo.disabled = !history.length;
        ui.btnHint.disabled = E.isOver(state) || isCpuTurn();
        ui.btnSound.textContent = audio.enabled ? "🔊" : "🔇";
        ui.btnSound.setAttribute("aria-pressed", String(!audio.enabled));
    };

    // =================================================================
    // Jogadas
    // =================================================================
    /** Faz o traço e anima. Devolve os quadrados fechados. */
    const doMove = (e) => {
        const player = state.turn;
        const closed = E.play(state, e);
        if (closed === null) return null;
        edgeOwner[e] = player;
        lastEdge = e;
        cursor = -1;
        clearHint();
        if (closed.length) {
            combo += closed.length;
            audio.box(combo);
            const who = isYou(player) ? "Você fechou" : `${nameOf(player)} fechou`;
            const n = closed.length;
            if (!E.isOver(state)) setFlash(`${who} ${n === 2 ? "2 quadrados" : "um quadrado"}! ${isYou(player) ? "Jogue" : "Joga"} de novo.`, "bom", 1500);
        } else {
            combo = 0;
            audio.line(player);
        }
        render();
        if (closed.length) {
            const pts = ui.players.querySelector(`.pts[data-p="${player}"]`);
            pts?.classList.add("pulo");
        }
        return closed;
    };

    /** Jogada de uma pessoa (toque, arraste ou teclado). */
    const humanMove = (e) => {
        audio.ensure();
        if (E.isOver(state) || isCpuTurn() || thinking) return;
        if (e < 0 || state.edges[e]) { audio.nope(); return; }
        history.push({ state: E.clone(state), edgeOwner: edgeOwner.slice(), lastEdge });
        doMove(e);
        afterMove();
    };

    const afterMove = () => {
        if (E.isOver(state)) { finish(); return; }
        if (isCpuTurn()) cpuPlay();
    };

    /** O Dino joga (e continua enquanto fechar quadrados). */
    const cpuPlay = async () => {
        const my = ++token;
        thinking = true;
        render();
        await sleep(state.moves < 2 ? 500 : 650);
        while (my === token && isCpuTurn()) {
            const e = E.chooseMove(state, prefs.level);
            if (e < 0) break;
            thinking = false;
            const closed = doMove(e);
            if (E.isOver(state) || !closed?.length) break;
            thinking = true;
            renderPlayers();
            await sleep(420);
        }
        if (my !== token) return;
        thinking = false;
        render();
        if (E.isOver(state)) finish();
    };

    const undo = () => {
        if (!history.length) return;
        token++;
        thinking = false;
        const snap = history.pop();
        state = snap.state;
        edgeOwner = snap.edgeOwner;
        lastEdge = snap.lastEdge;
        combo = 0;
        ui.overlay.hidden = true;
        clearHint();
        flash = "";
        render();
    };

    const clearHint = () => {
        clearTimeout(hintTimer);
        if (hintEdge >= 0) els.edges[hintEdge]?.classList.remove("dica");
        hintEdge = -1;
    };
    const showHint = () => {
        if (E.isOver(state) || isCpuTurn()) return;
        clearHint();
        hintEdge = E.chooseMove(state, "dificil");
        if (hintEdge < 0) return;
        const gives = E.closes(state, hintEdge) > 0;
        setFlash(gives ? "💡 Dica: feche o quadrado marcado em verde!" : "💡 Dica: o traço verde é uma boa jogada.", "", 2600);
        render();
        hintTimer = setTimeout(() => { clearHint(); render(); }, 3500);
    };

    // =================================================================
    // Fim de jogo
    // =================================================================
    const resultText = () => {
        const [a, b] = state.score;
        const hi = Math.max(a, b), lo = Math.min(a, b);
        if (a === b) return { kind: "empate", short: `Empate! ${a} a ${b}.`, title: "Empate!", icon: "🤝", text: `Cada um fechou ${a} quadrados. Que partida equilibrada!` };
        const w = a > b ? 0 : 1;
        if (vsCpu() && w === 1) {
            return { kind: "dino", short: `Boa partida! O ${CPU_NAME} fez ${hi} a ${lo}. Vamos de novo? 💪`, title: "Boa partida!", icon: "🦖",
                text: `O ${CPU_NAME} ganhou por ${hi} a ${lo}. Você jogou bem — que tal a revanche?` };
        }
        const name = isYou(w) ? "Você" : nameOf(w);
        return { kind: "vitoria", short: `${name} venceu por ${hi} a ${lo}! 🎉`, title: isYou(w) ? "Você venceu!" : `${name} venceu!`, icon: "🏆",
            text: `Placar final: ${hi} a ${lo}. Parabéns!` };
    };

    const finish = () => {
        thinking = false;
        const r = resultText();
        // Placar guardado: por nível contra o Dino, ou geral entre duas pessoas.
        const key = vsCpu() ? `cpu-${prefs.level}` : "two";
        const sc = scores[key] || { 0: 0, d: 0, 1: 0 };
        if (r.kind === "empate") sc.d++;
        else sc[state.score[0] > state.score[1] ? 0 : 1]++;
        scores[key] = sc;
        storage.set(SCORE_KEY, scores);
        render();
        renderScore();
        if (r.kind === "vitoria") { audio.win(); confetti(); } else audio.end();
        ui.overlayIcon.textContent = r.icon;
        ui.overlayTitle.textContent = r.title;
        ui.overlayText.textContent = r.text;
        setTimeout(() => { if (E.isOver(state)) ui.overlay.hidden = false; }, 900);
    };

    const renderScore = () => {
        const key = vsCpu() ? `cpu-${prefs.level}` : "two";
        const sc = scores[key] || { 0: 0, d: 0, 1: 0 };
        const labels = vsCpu() ? [nameOf(0) === "Você" ? "Você" : nameOf(0), "Empates", CPU_NAME] : [nameOf(0), "Empates", nameOf(1)];
        ui.score.innerHTML = [
            `<div><strong class="p0">${sc[0]}</strong><span>${escapeHtml(labels[0])}</span></div>`,
            `<div><strong>${sc.d}</strong><span>${labels[1]}</span></div>`,
            `<div><strong class="p1">${sc[1]}</strong><span>${escapeHtml(labels[2])}</span></div>`,
        ].join("");
        ui.scoreInfo.textContent = vsCpu() ? `Contra o ${CPU_NAME} · nível ${LEVEL_NAMES[prefs.level]}` : "2 jogadores";
    };

    const confetti = () => {
        const colors = ["#4f8cff", "#f2545b", "#facc15", "#22c55e", "#a855f7"];
        for (let i = 0; i < 70; i++) {
            const s = document.createElement("span");
            s.style.left = `${Math.random() * 100}%`;
            s.style.background = colors[i % colors.length];
            s.style.setProperty("--drift", `${(Math.random() - 0.5) * 200}px`);
            s.style.setProperty("--spin", `${Math.random() * 900}deg`);
            s.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
            s.style.animationDelay = `${Math.random() * 0.4}s`;
            ui.confetti.append(s);
            setTimeout(() => s.remove(), 4200);
        }
    };

    // =================================================================
    // Toque, clique e arraste
    // =================================================================
    /** Ponto da tela -> coordenadas do tabuleiro (1 = distância entre pontos). */
    const toBoard = (event) => {
        const m = ui.board.getScreenCTM();
        if (!m) return null;
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
    };

    /** Traço mais perto do ponto (ou -1 se estiver longe de todos). */
    const nearestEdge = ({ x, y }) => {
        const { rows, cols } = geo;
        let best = -1, bestDist = 0.45;
        // Horizontal: linha r inteira mais próxima, entre as colunas c e c+1.
        const r = Math.round(y), c = Math.floor(x);
        if (r >= 0 && r <= rows && c >= 0 && c < cols) {
            const d = Math.abs(y - r) + Math.max(0, Math.abs(x - (c + 0.5)) - 0.38);
            if (d < bestDist) { bestDist = d; best = geo.hId(r, c); }
        }
        const vc = Math.round(x), vr = Math.floor(y);
        if (vc >= 0 && vc <= cols && vr >= 0 && vr < rows) {
            const d = Math.abs(x - vc) + Math.max(0, Math.abs(y - (vr + 0.5)) - 0.38);
            if (d < bestDist) { bestDist = d; best = geo.vId(vr, vc); }
        }
        return best;
    };

    /** Arraste de um ponto ao vizinho: devolve o traço entre eles (ou -1). */
    const edgeBetween = (a, b) => {
        const pa = { x: Math.round(a.x), y: Math.round(a.y) };
        const pb = { x: Math.round(b.x), y: Math.round(b.y) };
        const nearDot = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.4;
        if (!nearDot(a, pa) || !nearDot(b, pb)) return -1;
        const { rows, cols } = geo;
        const inside = (p) => p.x >= 0 && p.x <= cols && p.y >= 0 && p.y <= rows;
        if (!inside(pa) || !inside(pb)) return -1;
        if (pa.y === pb.y && Math.abs(pa.x - pb.x) === 1) return geo.hId(pa.y, Math.min(pa.x, pb.x));
        if (pa.x === pb.x && Math.abs(pa.y - pb.y) === 1) return geo.vId(Math.min(pa.y, pb.y), pa.x);
        return -1;
    };

    let preview = -1;
    const setPreview = (e) => {
        if (e === preview) return;
        if (preview >= 0) els.edges[preview]?.classList.remove("preview");
        preview = e >= 0 && !state.edges[e] ? e : -1;
        if (preview >= 0) els.edges[preview].classList.add("preview");
    };

    let press = null; // { start, moved }
    /** Traço pretendido: arraste ponto→ponto, senão o traço mais perto de onde o dedo está. */
    const intended = (p) => {
        if (press && Math.hypot(p.x - press.start.x, p.y - press.start.y) > 0.55) {
            const e = edgeBetween(press.start, p);
            if (e >= 0) return e;
        }
        return nearestEdge(p);
    };
    const canPlay = () => !E.isOver(state) && !isCpuTurn() && !thinking;

    ui.board.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        audio.ensure();
        const p = toBoard(event);
        if (!p) return;
        press = { start: p };
        try { ui.board.setPointerCapture(event.pointerId); } catch { /* segue sem captura */ }
        if (canPlay()) setPreview(nearestEdge(p));
        event.preventDefault();
    });
    ui.board.addEventListener("pointermove", (event) => {
        const p = toBoard(event);
        if (!p || !canPlay()) { setPreview(-1); return; }
        if (press) setPreview(intended(p));
        else if (event.pointerType === "mouse") setPreview(nearestEdge(p)); // passar o mouse mostra o traço
    });
    ui.board.addEventListener("pointerup", (event) => {
        if (!press) return;
        const p = toBoard(event);
        const e = p ? intended(p) : -1;
        press = null;
        setPreview(-1);
        if (!canPlay()) {
            if (thinking || isCpuTurn()) setFlash(`Espere: é a vez do ${CPU_NAME}.`, "", 1500);
            return;
        }
        if (e >= 0) humanMove(e);
    });
    ui.board.addEventListener("pointercancel", () => { press = null; setPreview(-1); });
    ui.board.addEventListener("pointerleave", (event) => { if (!press && event.pointerType === "mouse") setPreview(-1); });

    // =================================================================
    // Teclado: setas movem um cursor entre os traços livres; Enter faz o traço
    // =================================================================
    const midpoint = (e) => {
        const [[x1, y1], [x2, y2]] = geo.ends(e);
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    };
    const moveCursor = (dx, dy) => {
        const free = E.freeEdges(state);
        if (!free.length) return;
        if (cursor < 0 || state.edges[cursor]) {
            cursor = free[Math.floor(free.length / 2)];
            return render();
        }
        const m = midpoint(cursor);
        let best = -1, bestScore = Infinity;
        for (const e of free) {
            if (e === cursor) continue;
            const q = midpoint(e);
            const along = (q.x - m.x) * dx + (q.y - m.y) * dy;
            if (along <= 0.01) continue;
            const across = Math.abs((q.x - m.x) * dy) + Math.abs((q.y - m.y) * dx);
            const score = along + across * 2;
            if (score < bestScore) { bestScore = score; best = e; }
        }
        if (best >= 0) { cursor = best; render(); }
    };

    document.addEventListener("keydown", (event) => {
        if (event.target.closest?.("input, select") || event.altKey || event.metaKey) return;
        const k = event.key;
        if ((event.ctrlKey && k.toLowerCase() === "z") || (!event.ctrlKey && k.toLowerCase() === "u")) { event.preventDefault(); undo(); return; }
        if (event.ctrlKey) return;
        const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (dirs[k]) { event.preventDefault(); moveCursor(...dirs[k]); return; }
        if ((k === "Enter" || k === " ") && cursor >= 0 && !event.target.closest?.("button")) { event.preventDefault(); humanMove(cursor); return; }
        switch (k.toLowerCase()) {
            case "n": newGame(); break;
            case "h": showHint(); break;
            case "m": toggleSound(); break;
            case "escape": cursor = -1; ui.overlay.hidden = true; render(); break;
            default: return;
        }
    });

    // =================================================================
    // Botões e opções
    // =================================================================
    const toggleSound = () => {
        audio.enabled = !audio.enabled;
        prefs.sound = audio.enabled;
        savePrefs();
        renderButtons();
    };
    $("btn-new").addEventListener("click", newGame);
    $("overlay-new").addEventListener("click", newGame);
    $("overlay-close").addEventListener("click", () => { ui.overlay.hidden = true; });
    ui.btnUndo.addEventListener("click", undo);
    ui.btnHint.addEventListener("click", showHint);
    ui.btnSound.addEventListener("click", toggleSound);

    /** Opções de "Quem começa" com os nomes atuais. */
    const fillFirst = () => {
        const options = [["alternar", "Alternar"], ["0", nameOf(0)], ["1", nameOf(1)]];
        ui.first.innerHTML = options.map(([v, t]) => `<option value="${v}">${escapeHtml(t)}</option>`).join("");
        ui.first.value = prefs.first;
        if (ui.first.value !== prefs.first) { prefs.first = "alternar"; ui.first.value = "alternar"; }
    };

    const applyMode = () => {
        document.body.classList.toggle("modo-dois", !vsCpu());
        ui.name0.value = nameOf(0);
        ui.name1.value = nameOf(1);
        ui.name1.disabled = vsCpu(); // o Dino é sempre o Dino
        fillFirst();
        renderScore();
    };

    const bind = (el, key, onChange) => {
        el.value = prefs[key];
        if (el.value !== String(prefs[key])) prefs[key] = el.value;
        el.addEventListener("change", () => {
            prefs[key] = el.value;
            savePrefs();
            onChange();
        });
    };
    bind(ui.mode, "mode", () => { applyMode(); newGame(); });
    bind(ui.level, "level", () => { renderScore(); newGame(); });
    bind(ui.size, "size", newGame);
    bind(ui.theme, "theme", () => { document.body.dataset.theme = prefs.theme; });
    ui.first.addEventListener("change", () => {
        prefs.first = ui.first.value;
        savePrefs();
        if (state.moves === 0) newGame(); // ainda não começou: aplica já
    });
    document.body.dataset.theme = prefs.theme;

    // Nomes: atualizam na hora (iniciais nos quadrados, placar e "Quem começa").
    [ui.name0, ui.name1].forEach((input, p) => {
        input.addEventListener("input", () => {
            prefs.names[nameKey(p)] = input.value.trim();
            savePrefs();
            const firstValue = ui.first.value;
            fillFirst();
            ui.first.value = firstValue;
            renderScore();
            render();
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
    });

    applyMode();
    newGame();
})();
