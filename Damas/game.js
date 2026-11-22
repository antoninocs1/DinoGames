/* =====================================================================
   Damas — interface do jogo (tabuleiro, jogadas, computador, sons)
   As regras e a IA ficam em engine.js.
   ===================================================================== */
(() => {
    "use strict";

    const E = window.DamasEngine;
    const { WHITE, BLACK } = E;
    const $ = (id) => document.getElementById(id);
    const VERSION = (document.currentScript?.src.match(/[?&]v=([\w.]+)/) || [])[1] || "";

    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
    };
    const KEYS = {
        mode: "damas-mode", level: "damas-level", color: "damas-color",
        theme: "damas-board", sound: "damas-sound", score: "damas-score",
    };
    const LEVEL_NAMES = { facil: "Fácil", medio: "Médio", dificil: "Difícil", mestre: "Mestre" };
    const COLOR_NAME = { [WHITE]: "brancas", [BLACK]: "pretas" };
    const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16l1.6-9.5-5 3.8L12 4.5l-4.6 6.8-5-3.8z"/><rect x="4" y="18.4" width="16" height="2.2" rx="1.1"/></svg>';
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // =================================================================
    // Sons (Web Audio, sintetizados — não precisam de arquivos)
    // =================================================================
    const audio = {
        ctx: null,
        enabled: storage.get(KEYS.sound) !== "0",

        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
            }
            if (this.ctx.state === "suspended") this.ctx.resume();
            return this.ctx;
        },
        tone(freq, duration, { type = "sine", gain = 0.12, slide = 0, delay = 0 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + duration + 0.05);
        },
        noise(duration, { freq = 1200, q = 1, gain = 0.3, type = "bandpass", decay = 8, delay = 0 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
            const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * decay);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = type;
            filter.frequency.value = freq;
            filter.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = gain;
            src.connect(filter).connect(g).connect(ctx.destination);
            src.start(ctx.currentTime + delay);
        },
        // Batida de peça de madeira no tabuleiro.
        place(delay = 0) {
            this.noise(0.07, { freq: 2100, q: 4, gain: 0.55, decay: 10, delay });
            this.tone(190, 0.08, { type: "triangle", gain: 0.13, slide: -70, delay });
        },
        select() { this.tone(880, 0.05, { gain: 0.045 }); this.tone(1320, 0.05, { gain: 0.025, delay: 0.03 }); },
        jump(delay = 0) {
            this.noise(0.06, { freq: 2600, q: 5, gain: 0.45, decay: 9, delay });
            this.tone(330, 0.09, { type: "triangle", gain: 0.08, slide: 120, delay });
        },
        remove(n) {
            for (let i = 0; i < n; i++) {
                this.noise(0.18, { freq: 700, q: 0.8, gain: 0.35, decay: 6, delay: i * 0.07 });
                this.tone(240 - i * 18, 0.12, { type: "sine", gain: 0.08, slide: -120, delay: i * 0.07 });
            }
        },
        promote() {
            [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, { type: "triangle", gain: 0.1, delay: i * 0.08 }));
            this.tone(2093, 0.6, { gain: 0.03, delay: 0.32 });
        },
        illegal() { this.tone(150, 0.16, { type: "square", gain: 0.035, slide: -40 }); },
        hint() { this.tone(1046, 0.18, { gain: 0.06 }); this.tone(1568, 0.25, { gain: 0.05, delay: 0.1 }); },
        start() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, { type: "triangle", gain: 0.07, delay: i * 0.07 })); },
        win() {
            [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: "triangle", gain: 0.11, delay: i * 0.11 }));
        },
        lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.38, { type: "sawtooth", gain: 0.04, delay: i * 0.17 })); },
        draw() { [440, 440, 392].forEach((f, i) => this.tone(f, 0.25, { type: "triangle", gain: 0.07, delay: i * 0.16 })); },
    };

    // =================================================================
    // Estado
    // =================================================================
    const ui = {
        board: $("board"), status: $("status"), moves: $("moves"), score: $("score"),
        drawInfo: $("draw-info"), stripTop: $("strip-top"), stripBottom: $("strip-bottom"),
        overlay: $("overlay"), mode: $("mode"), level: $("level"), color: $("color"), theme: $("board-theme"),
    };

    let mode = storage.get(KEYS.mode) || "cpu";
    let level = storage.get(KEYS.level) || "medio";
    let colorPref = storage.get(KEYS.color) || "1";
    let humanColor = WHITE;
    let flipped = false;

    let board, turn, ids, nextId, kingPlies, endPlies, posHistory, log, lastMove, lost, over, snapshots;
    let legal = [];
    let selected = null;   // casa da peça escolhida
    let prefix = [];       // casas já percorridas numa captura em cadeia
    let busy = false;      // animação do computador ou captura automática
    let thinking = false;
    let hint = null;
    let cursor = null;     // casa do cursor do teclado
    let flash = null;      // mensagem temporária
    let flashTimer = 0;
    let aiToken = 0;

    // =================================================================
    // Computador (Web Worker quando possível, para não travar a tela)
    // =================================================================
    let worker = null;
    const pending = new Map();
    let requestId = 0;
    try {
        worker = new Worker(`engine.js${VERSION ? `?v=${VERSION}` : ""}`);
        worker.onmessage = (event) => {
            const done = pending.get(event.data.id);
            pending.delete(event.data.id);
            done?.(event.data.move);
        };
        worker.onerror = (event) => {
            event.preventDefault?.();
            worker = null;
            // Sem worker (ex.: arquivo aberto direto): calcula aqui mesmo.
            const waiting = [...pending.values()];
            pending.clear();
            waiting.forEach((job) => job.fallback());
        };
    } catch { worker = null; }

    function think(lvl, color) {
        const snapshot = Int8Array.from(board);
        return new Promise((resolve) => {
            const fallback = () => setTimeout(() => resolve(E.bestMove(snapshot, color, lvl)), 20);
            if (!worker) return fallback();
            const id = ++requestId;
            const done = (move) => resolve(move);
            done.fallback = fallback;
            pending.set(id, done);
            worker.postMessage({ id, board: Array.from(snapshot), color, level: lvl });
        });
    }

    // Converte o lance vindo do worker no objeto da lista de lances legais.
    const matchLegal = (m) => m && legal.find((x) => x.from === m.from && x.path.join() === m.path.join());

    // =================================================================
    // Partida
    // =================================================================
    function newGame() {
        aiToken++;
        humanColor = colorPref === "0" ? (Math.random() < 0.5 ? WHITE : BLACK) : Number(colorPref);
        flipped = mode === "cpu" && humanColor === BLACK;
        board = E.initialBoard();
        ids = new Int32Array(64);
        nextId = 1;
        for (let sq = 0; sq < 64; sq++) if (board[sq]) ids[sq] = nextId++;
        turn = WHITE;
        kingPlies = 0;
        endPlies = 0;
        posHistory = [positionKey()];
        log = [];
        lastMove = null;
        lost = { [WHITE]: 0, [BLACK]: 0 };
        over = null;
        snapshots = [];
        selected = null; prefix = []; hint = null; busy = false; thinking = false;
        ui.overlay.hidden = true;
        ui.board.querySelectorAll(".piece").forEach((el) => el.remove());
        legal = E.generateMoves(board, turn);
        buildBoard();
        if (mode === "cpu") setFlash(humanColor === WHITE ? "Você joga com as brancas e começa." : "Você joga com as pretas. O computador começa.");
        audio.start();
        render();
        maybeComputer();
    }

    const positionKey = () => `${turn}:${board.join("")}`;

    function snapshot() {
        snapshots.push({
            board: Int8Array.from(board), ids: Int32Array.from(ids), turn, kingPlies, endPlies,
            pos: posHistory.length, log: log.length, lastMove, lost: { ...lost },
        });
    }

    function restore(s) {
        board = s.board; ids = s.ids; turn = s.turn; kingPlies = s.kingPlies; endPlies = s.endPlies;
        posHistory.length = s.pos; log.length = s.log; lastMove = s.lastMove; lost = s.lost;
    }

    function undo() {
        if (!snapshots.length || (busy && !thinking)) return;
        aiToken++;
        thinking = false; busy = false;
        selected = null; prefix = []; hint = null;
        over = null;
        ui.overlay.hidden = true;
        do restore(snapshots.pop());
        while (mode === "cpu" && turn !== humanColor && snapshots.length);
        legal = E.generateMoves(board, turn);
        audio.select();
        render();
        maybeComputer();
    }

    // Regras de empate dos finais (art. 99 e 100 das regras da CBD).
    function endgameRule() {
        const n = E.count(board);
        const w = { k: n.wk, m: n.wm }, b = { k: n.bk, m: n.bm };
        const is = (x, k, m) => x.k === k && x.m === m;
        const art99 = (x, y) => (is(x, 2, 0) && (is(y, 2, 0) || is(y, 1, 0) || is(y, 1, 1))) ||
            (is(x, 1, 0) && (is(y, 1, 0) || is(y, 1, 1)));
        if (art99(w, b) || art99(b, w)) return "art99";
        const loneOnDiagonal = (color) => {
            for (let sq = 0; sq < 64; sq++) if (board[sq] === color * 2) return E.onLongDiagonal(sq);
            return false;
        };
        if (is(b, 1, 0) && w.k >= 1 && w.k + w.m === 3 && loneOnDiagonal(BLACK)) return "art100";
        if (is(w, 1, 0) && b.k >= 1 && b.k + b.m === 3 && loneOnDiagonal(WHITE)) return "art100";
        return null;
    }

    function commit(m) {
        snapshot();
        const mover = turn;
        const movingId = ids[m.from];
        const wasKing = E.isKing(m.piece);
        const promoted = E.promotes(m);
        E.makeMove(board, m);
        ids[m.from] = 0;
        for (const sq of m.captures) ids[sq] = 0;
        ids[m.to] = movingId;
        lost[-mover] += m.captures.length;
        log.push(E.notation(m) + (promoted ? "D" : ""));
        lastMove = m;
        kingPlies = wasKing && !m.captures.length ? kingPlies + 1 : 0;
        turn = -turn;
        posHistory.push(positionKey());
        endPlies = endgameRule() ? endPlies + 1 : 0;
        selected = null; prefix = []; hint = null;
        legal = E.generateMoves(board, turn);

        if (m.captures.length) audio.remove(m.captures.length);
        else audio.place();
        if (promoted) {
            setTimeout(() => audio.promote(), 120);
            setTimeout(() => {
                const el = pieceEl(movingId);
                el?.classList.add("promovida");
                setTimeout(() => el?.classList.remove("promovida"), 900);
            }, 30);
        }

        checkEnd();
        render();
        maybeComputer();
    }

    function checkEnd() {
        if (!legal.length) {
            const n = E.count(board);
            const left = turn === WHITE ? n.wm + n.wk : n.bm + n.bk;
            return finish(-turn, left ? `As ${COLOR_NAME[turn]} ficaram imobilizadas.` : `Todas as ${COLOR_NAME[turn]} foram capturadas.`);
        }
        if (kingPlies >= 40) {
            return finish(0, "20 lances seguidos só com damas de cada jogador, sem captura nem movimento de pedra.");
        }
        const key = posHistory[posHistory.length - 1];
        if (posHistory.filter((k) => k === key).length >= 3) {
            return finish(0, "A mesma posição apareceu pela 3ª vez com o mesmo jogador na vez.");
        }
        if (endPlies >= 10) {
            return finish(0, endgameRule() === "art100"
                ? "Três peças contra uma dama na grande diagonal: empate após 5 lances de cada jogador."
                : "Final de damas: empate após 5 lances de cada jogador.");
        }
    }

    function finish(winner, reason) {
        over = { winner, reason };
        aiToken++;
        thinking = false;
        const scores = loadScores();
        const key = scoreKey();
        scores[key] = scores[key] || [0, 0, 0];
        let title, icon, sound;
        if (winner === 0) {
            scores[key][1]++;
            title = "Empate"; icon = "🤝"; sound = "draw";
        } else if (mode === "cpu") {
            const human = winner === humanColor;
            scores[key][human ? 0 : 2]++;
            title = human ? "Você venceu!" : "O computador venceu";
            icon = human ? "🏆" : "🤖";
            sound = human ? "win" : "lose";
        } else {
            scores[key][winner === WHITE ? 0 : 2]++;
            title = `Vitória das ${COLOR_NAME[winner]}!`;
            icon = "🏆"; sound = "win";
        }
        storage.set(KEYS.score, JSON.stringify(scores));
        setTimeout(() => {
            if (over?.reason !== reason) return;
            audio[sound]();
            $("overlay-icon").textContent = icon;
            $("overlay-title").textContent = title;
            $("overlay-text").textContent = reason;
            ui.overlay.hidden = false;
            if (sound === "win") confetti();
        }, 650);
    }

    // =================================================================
    // Jogadas do humano
    // =================================================================
    const humanTurn = () => !over && !busy && !thinking && (mode === "two" || turn === humanColor);
    const mustCapture = () => legal.length > 0 && legal[0].captures.length > 0;
    const movable = () => new Set(legal.map((m) => m.from));
    const candidates = () => legal.filter((m) => m.from === selected && prefix.every((sq, i) => m.path[i] === sq));
    const nextTargets = () => [...new Set(candidates().map((m) => m.path[prefix.length]))];

    function onSquare(sq) {
        audio.ensure();
        if (!humanTurn()) {
            if (thinking) setFlash("Aguarde: o computador está pensando…");
            return;
        }
        const piece = board[sq];
        if (prefix.length) {
            if (nextTargets().includes(sq)) return step(sq);
            if (sq === selected) return cancel();
            audio.illegal();
            return setFlash("Continue a captura: escolha uma das casas marcadas (Esc cancela).");
        }
        if (piece && E.side(piece) === turn) {
            if (!movable().has(sq)) {
                audio.illegal();
                if (mustCapture()) {
                    const n = legal[0].captures.length;
                    setFlash(`Captura obrigatória! Jogue com uma peça destacada (${n > 1 ? `Lei da Maioria: ${n} peças` : "1 peça"}).`);
                    ui.board.classList.remove("avisar");
                    void ui.board.offsetWidth;
                    ui.board.classList.add("avisar");
                } else {
                    setFlash("Essa peça não tem movimentos.");
                }
                return;
            }
            selected = selected === sq ? null : sq;
            hint = null;
            audio.select();
            return render();
        }
        if (selected !== null && nextTargets().includes(sq)) return step(sq);
        if (selected !== null) {
            if (!piece) audio.illegal();
            selected = null;
            render();
        }
    }

    function step(sq) {
        prefix.push(sq);
        const cands = candidates();
        const done = cands.find((m) => m.path.length === prefix.length);
        if (done) return commit(done);
        audio.jump();
        render();
        const next = nextTargets();
        // Caminho único: completa a captura sozinho.
        if (next.length === 1) {
            busy = true;
            const token = aiToken;
            setTimeout(() => {
                if (token !== aiToken) return;
                busy = false;
                step(next[0]);
            }, 320);
        }
    }

    function cancel() {
        if (busy) return;
        selected = null;
        prefix = [];
        render();
    }

    async function showHint() {
        if (!humanTurn()) return;
        const token = aiToken;
        busy = true;
        setFlash("Procurando um bom lance…", 5000);
        render();
        const move = matchLegal(await think("dica", turn));
        busy = false;
        if (token !== aiToken || !move) return render();
        hint = move;
        selected = null; prefix = [];
        audio.hint();
        setFlash(`Dica: ${E.notation(move)}`);
        render();
    }

    // =================================================================
    // Jogadas do computador
    // =================================================================
    async function maybeComputer() {
        if (over || mode !== "cpu" || turn === humanColor) return;
        const token = ++aiToken;
        thinking = true;
        render();
        const started = Date.now();
        const move = matchLegal(await think(level, turn)) || legal[0];
        await sleep(Math.max(0, 450 - (Date.now() - started)));
        if (token !== aiToken) return;
        thinking = false;
        busy = true;
        selected = move.from;
        prefix = [];
        render();
        await sleep(260);
        for (let i = 0; i < move.path.length - 1; i++) {
            if (token !== aiToken) return;
            prefix.push(move.path[i]);
            audio.jump();
            render();
            await sleep(340);
        }
        if (token !== aiToken) return;
        busy = false;
        commit(move);
    }

    // =================================================================
    // Desenho
    // =================================================================
    const view = (sq) => (flipped ? 63 - sq : sq);

    function buildBoard() {
        const cells = [];
        for (let v = 0; v < 64; v++) {
            const sq = flipped ? 63 - v : v;
            const r = E.rowOf(sq), c = E.colOf(sq);
            const cell = document.createElement("div");
            cell.className = `cell ${E.isDark(r, c) ? "dark" : "light"}`;
            cell.dataset.sq = sq;
            cell.setAttribute("role", "gridcell");
            cell.setAttribute("aria-label", E.sqName(sq));
            const vr = (v / 8) | 0, vc = v % 8;
            if (vc === 0) cell.insertAdjacentHTML("beforeend", `<span class="coord rank">${8 - r}</span>`);
            if (vr === 7) cell.insertAdjacentHTML("beforeend", `<span class="coord file">${"abcdefgh"[c]}</span>`);
            cells.push(cell);
        }
        let layer = ui.board.querySelector(".pieces");
        if (!layer) {
            layer = document.createElement("div");
            layer.className = "pieces";
        }
        ui.board.replaceChildren(...cells, layer);
    }

    const cellEl = (sq) => ui.board.querySelector(`.cell[data-sq="${sq}"]`);
    const pieceEl = (id) => ui.board.querySelector(`.piece[data-id="${id}"]`);

    function placeEl(el, sq) {
        const v = view(sq);
        el.style.transform = `translate(${(v % 8) * 100}%, ${((v / 8) | 0) * 100}%)`;
    }

    function renderPieces() {
        const layer = ui.board.querySelector(".pieces");
        const present = new Set();
        const marked = new Set(prefix.length ? candidates()[0]?.captures.slice(0, prefix.length) : []);
        for (let sq = 0; sq < 64; sq++) {
            const p = board[sq];
            if (!p) continue;
            const id = ids[sq];
            present.add(String(id));
            let el = pieceEl(id);
            if (!el) {
                el = document.createElement("div");
                el.dataset.id = id;
                el.innerHTML = `<span class="disc"><span class="crown">${CROWN}</span></span>`;
                placeEl(el, sq);
                layer.appendChild(el);
            }
            const extra = ["promovida", "chega"].filter((c) => el.classList.contains(c));
            el.className = ["piece", p > 0 ? "white" : "black", E.isKing(p) ? "king" : "", marked.has(sq) ? "marcada" : "", ...extra].join(" ").trim();
            const at = sq === selected && prefix.length ? prefix[prefix.length - 1] : sq;
            el.classList.toggle("andando", sq === selected);
            placeEl(el, at);
        }
        layer.querySelectorAll(".piece").forEach((el) => {
            if (present.has(el.dataset.id) || el.classList.contains("saindo")) return;
            el.classList.add("saindo");
            el.dataset.id = "";
            setTimeout(() => el.remove(), 450);
        });
    }

    function renderCells() {
        const classes = ["sel", "alvo", "cap", "ultimo", "obrigatoria", "pode", "dica", "trilha", "cursor"];
        ui.board.querySelectorAll(".cell").forEach((c) => c.classList.remove(...classes));
        const add = (sq, cls) => cellEl(sq)?.classList.add(cls);
        if (lastMove && selected === null) {
            add(lastMove.from, "ultimo");
            lastMove.path.forEach((sq) => add(sq, "ultimo"));
        }
        if (selected !== null) {
            add(selected, "sel");
            prefix.forEach((sq) => add(sq, "trilha"));
            const capture = candidates()[0]?.captures.length > 0;
            if (!busy || prefix.length) nextTargets().forEach((sq) => { add(sq, "alvo"); if (capture) add(sq, "cap"); });
        }
        if (humanTurn() && selected === null) {
            movable().forEach((sq) => add(sq, mustCapture() ? "obrigatoria" : "pode"));
        }
        if (hint) { add(hint.from, "dica"); add(hint.to, "dica"); }
        if (cursor !== null) add(cursor, "cursor");
    }

    function stripHtml(color, el) {
        const n = E.count(board);
        const men = color === WHITE ? n.wm : n.bm;
        const kings = color === WHITE ? n.wk : n.bk;
        const name = mode === "cpu" ? (color === humanColor ? "Você" : `Computador · ${LEVEL_NAMES[level]}`) : (color === WHITE ? "Brancas" : "Pretas");
        const active = !over && turn === color;
        const capturedCls = color === WHITE ? "black" : "white";
        const taken = lost[-color];
        el.classList.toggle("ativo", active);
        el.classList.toggle("pensando", active && thinking);
        el.innerHTML = `
            <span class="mini ${color === WHITE ? "white" : "black"}"></span>
            <span class="who"><strong>${name}</strong><small>${men} pedra${men === 1 ? "" : "s"}${kings ? ` · ${kings} dama${kings === 1 ? "" : "s"}` : ""}</small></span>
            <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="trophies" title="Peças capturadas">${Array.from({ length: taken }, () => `<span class="mini ${capturedCls}"></span>`).join("")}</span>`;
    }

    function statusText() {
        if (flash) return flash;
        if (over) {
            if (over.winner === 0) return `Empate. ${over.reason}`;
            if (mode === "cpu") return over.winner === humanColor ? "Você venceu! 🏆" : "O computador venceu.";
            return `Vitória das ${COLOR_NAME[over.winner]}!`;
        }
        if (thinking) return "Computador pensando…";
        if (prefix.length && !busy) return "Continue capturando com a mesma peça.";
        const who = mode === "cpu" ? (turn === humanColor ? "Sua vez" : "Vez do computador") : `Vez das ${COLOR_NAME[turn]}`;
        if (mustCapture()) {
            const n = legal[0].captures.length;
            return `${who} — captura obrigatória${n > 1 ? ` de ${n} peças` : ""}`;
        }
        return who;
    }

    function setFlash(text, ms = 2600) {
        flash = text;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => { flash = null; renderStatus(); }, ms);
        renderStatus();
    }

    function renderStatus() {
        ui.status.textContent = statusText();
        ui.status.dataset.tone = over ? "fim" : thinking ? "pensando" : mustCapture() && humanTurn() ? "captura" : "";
    }

    function renderMoves() {
        const rows = [];
        for (let i = 0; i < log.length; i += 2) {
            const cls = (j) => (j === log.length - 1 ? ' class="atual"' : "");
            rows.push(`<li><span class="num">${i / 2 + 1}.</span><span${cls(i)}>${log[i]}</span><span${cls(i + 1)}>${log[i + 1] || ""}</span></li>`);
        }
        ui.moves.innerHTML = rows.join("") || '<li class="vazio">Nenhum lance ainda.</li>';
        ui.moves.scrollTop = ui.moves.scrollHeight;
    }

    function renderDrawInfo() {
        const items = [];
        if (kingPlies > 0) items.push(`Lances só de damas: <strong>${Math.ceil(kingPlies / 2)}/20</strong>`);
        if (endPlies > 0) items.push(`Contagem do final: <strong>${Math.ceil(endPlies / 2)}/5</strong>`);
        ui.drawInfo.hidden = !items.length || !!over;
        ui.drawInfo.innerHTML = `<h2>Contagem para empate</h2>${items.map((t) => `<p>${t}</p>`).join("")}`;
    }

    const scoreKey = () => (mode === "cpu" ? `cpu-${level}` : "two");
    function loadScores() {
        try { return JSON.parse(storage.get(KEYS.score)) || {}; } catch { return {}; }
    }
    function renderScore() {
        const [a, d, b] = loadScores()[scoreKey()] || [0, 0, 0];
        const [la, lb] = mode === "cpu" ? ["Você", `CPU (${LEVEL_NAMES[level]})`] : ["Brancas", "Pretas"];
        ui.score.innerHTML = `
            <div><strong>${a}</strong><span>${la}</span></div>
            <div><strong>${d}</strong><span>Empates</span></div>
            <div><strong>${b}</strong><span>${lb}</span></div>`;
    }

    function render() {
        renderPieces();
        renderCells();
        const bottom = flipped ? BLACK : WHITE;
        stripHtml(-bottom, ui.stripTop);
        stripHtml(bottom, ui.stripBottom);
        renderStatus();
        renderMoves();
        renderDrawInfo();
        renderScore();
        $("btn-undo").disabled = !snapshots.length || (busy && !thinking);
        $("btn-hint").disabled = !humanTurn();
        $("btn-sound").textContent = audio.enabled ? "🔊" : "🔇";
        document.body.classList.toggle("modo-dois", mode === "two");
    }

    function confetti() {
        const box = $("confetti");
        const colors = ["#f5b021", "#34cca3", "#ff6b6b", "#5294fa", "#f6f1e9", "#c89a5c"];
        box.replaceChildren(...Array.from({ length: 90 }, () => {
            const s = document.createElement("span");
            s.style.left = `${Math.random() * 100}%`;
            s.style.background = colors[(Math.random() * colors.length) | 0];
            s.style.animationDelay = `${Math.random() * 0.6}s`;
            s.style.animationDuration = `${2 + Math.random() * 1.6}s`;
            s.style.setProperty("--spin", `${(Math.random() * 2 - 1) * 720}deg`);
            s.style.setProperty("--drift", `${(Math.random() * 2 - 1) * 120}px`);
            return s;
        }));
        setTimeout(() => box.replaceChildren(), 4500);
    }

    // =================================================================
    // Eventos
    // =================================================================
    ui.board.addEventListener("click", (event) => {
        if (performance.now() < ignoreClickUntil) return; // já tratado pelo arrastar
        const cell = event.target.closest(".cell");
        if (!cell) return;
        cursor = null;
        onSquare(Number(cell.dataset.sq));
    });

    // -----------------------------------------------------------------
    // Arrastar a peça (dedo ou botão esquerdo do mouse pressionado).
    // Convive com o tocar/clicar: um toque sem arrastar faz o mesmo de
    // sempre; arrastando, a peça segue o dedo e é jogada onde for solta
    // (se a casa for válida); senão, volta para o lugar.
    // -----------------------------------------------------------------
    let drag = null;
    let ignoreClickUntil = 0;
    const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".cell");

    ui.board.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || drag) return;
        const cell = event.target.closest(".cell");
        if (!cell || !humanTurn()) return;
        const sq = Number(cell.dataset.sq);
        // Peça que pode andar agora: a escolhida no meio de uma captura, ou uma peça própria com jogada.
        const at = prefix.length ? prefix[prefix.length - 1] : null;
        const canDrag = prefix.length ? sq === at : board[sq] && E.side(board[sq]) === turn && movable().has(sq);
        if (!canDrag) return;
        audio.ensure();
        cursor = null;
        const wasSelected = selected === sq;
        if (!prefix.length && !wasSelected) onSquare(sq); // seleciona e mostra os destinos
        const from = prefix.length ? selected : sq;
        drag = { sq, wasSelected, x0: event.clientX, y0: event.clientY, moved: false, el: pieceEl(ids[from]), over: null };
        try { ui.board.setPointerCapture(event.pointerId); } catch { /* segue sem captura */ }
        event.preventDefault();
    });

    ui.board.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const dist = Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0);
        if (!drag.moved && dist < 6) return;
        drag.moved = true;
        if (!drag.el) return;
        const rect = ui.board.getBoundingClientRect();
        const size = rect.width / 8;
        drag.el.classList.add("arrastando");
        drag.el.style.transform = `translate(${event.clientX - rect.left - size / 2}px, ${event.clientY - rect.top - size / 2}px)`;
        // Destaca a casa de destino sob o dedo.
        const over = cellAt(event.clientX, event.clientY);
        if (over !== drag.over) {
            drag.over?.classList.remove("sobre");
            drag.over = over;
            if (over?.classList.contains("alvo")) over.classList.add("sobre");
        }
    });

    const endDrag = (event, dropped) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        ignoreClickUntil = performance.now() + 400;
        d.over?.classList.remove("sobre");
        d.el?.classList.remove("arrastando");
        if (!d.moved) {
            // Foi só um toque: mantém o comportamento de sempre (tocar de novo desmarca/cancela).
            if (d.wasSelected || prefix.length) onSquare(d.sq);
            return;
        }
        const target = dropped && cellAt(event.clientX, event.clientY);
        const sq = target ? Number(target.dataset.sq) : -1;
        if (selected !== null && nextTargets().includes(sq)) onSquare(sq);
        else render(); // solto fora de uma casa válida: a peça volta para o lugar
    };
    ui.board.addEventListener("pointerup", (event) => endDrag(event, true));
    ui.board.addEventListener("pointercancel", (event) => endDrag(event, false));

    $("btn-new").addEventListener("click", newGame);
    $("overlay-new").addEventListener("click", newGame);
    $("overlay-close").addEventListener("click", () => { ui.overlay.hidden = true; });
    $("btn-undo").addEventListener("click", undo);
    $("btn-hint").addEventListener("click", showHint);
    $("btn-flip").addEventListener("click", flip);
    $("btn-sound").addEventListener("click", toggleSound);

    function flip() {
        flipped = !flipped;
        buildBoard();
        ui.board.querySelectorAll(".piece").forEach((el) => el.remove());
        render();
    }

    function toggleSound() {
        audio.enabled = !audio.enabled;
        storage.set(KEYS.sound, audio.enabled ? "1" : "0");
        if (audio.enabled) audio.select();
        render();
    }

    ui.mode.value = mode;
    ui.level.value = level;
    ui.color.value = colorPref;
    ui.theme.value = storage.get(KEYS.theme) || "madeira";
    document.body.dataset.board = ui.theme.value;

    ui.mode.addEventListener("change", () => { mode = ui.mode.value; storage.set(KEYS.mode, mode); newGame(); });
    ui.color.addEventListener("change", () => { colorPref = ui.color.value; storage.set(KEYS.color, colorPref); newGame(); });
    ui.level.addEventListener("change", () => {
        level = ui.level.value;
        storage.set(KEYS.level, level);
        setFlash(`Nível do computador: ${LEVEL_NAMES[level]}.`);
        render();
    });
    ui.theme.addEventListener("change", () => {
        document.body.dataset.board = ui.theme.value;
        storage.set(KEYS.theme, ui.theme.value);
    });

    document.addEventListener("keydown", (event) => {
        if (event.target.matches("select, input, textarea")) return;
        const key = event.key;
        if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") { event.preventDefault(); return undo(); }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (arrows[key]) {
            event.preventDefault();
            if (cursor === null) cursor = selected ?? (flipped ? 6 : 57);
            const v = view(cursor);
            const r = Math.min(7, Math.max(0, ((v / 8) | 0) + arrows[key][0]));
            const c = Math.min(7, Math.max(0, (v % 8) + arrows[key][1]));
            cursor = view(r * 8 + c);
            return renderCells();
        }
        if (key === "Enter" || key === " ") {
            if (event.target.matches("button")) return;
            event.preventDefault();
            if (cursor !== null) onSquare(cursor);
            return;
        }
        switch (key.toLowerCase()) {
            case "escape": cancel(); break;
            case "n": newGame(); break;
            case "u": case "backspace": undo(); break;
            case "h": showHint(); break;
            case "f": flip(); break;
            case "m": toggleSound(); break;
        }
    });

    newGame();
})();
