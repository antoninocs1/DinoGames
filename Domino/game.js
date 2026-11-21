/* =====================================================================
   Dominó — interface, turnos e animações
   ===================================================================== */
(() => {
    "use strict";
    const E = window.DominoEngine;
    const $ = (id) => document.getElementById(id);

    const PREFS_KEY = "dinogames-domino-prefs";
    const STATS_KEY = "dinogames-domino-stats";
    const SOUND_KEY = "dinogames-domino-sound";

    const storage = {
        get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* indisponível */ } },
    };

    // =================================================================
    // Som (Web Audio, sem arquivos)
    // =================================================================
    const sound = {
        ctx: null,
        enabled: storage.get(SOUND_KEY) !== false,
        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
            }
            if (this.ctx.state === "suspended") this.ctx.resume();
            return this.ctx;
        },
        tone(freq, duration, { type = "sine", gain = 0.1, slide = 0, delay = 0 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + duration);
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + duration + 0.02);
        },
        noise(duration, { freq = 1800, q = 3, gain = 0.3, delay = 0 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = freq;
            filter.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = gain;
            src.connect(filter).connect(g).connect(ctx.destination);
            src.start(t);
        },
        place() { this.noise(0.07, { freq: 2300, q: 4, gain: 0.5 }); this.tone(170, 0.07, { type: "triangle", gain: 0.12, slide: -50 }); },
        select() { this.tone(880, 0.05, { gain: 0.04 }); },
        draw() { this.noise(0.12, { freq: 900, q: 1, gain: 0.25 }); },
        pass() { this.tone(300, 0.12, { type: "triangle", gain: 0.06 }); this.tone(220, 0.16, { type: "triangle", gain: 0.06, delay: 0.1 }); },
        illegal() { this.tone(150, 0.16, { type: "square", gain: 0.03, slide: -40 }); },
        hint() { this.tone(1046, 0.18, { gain: 0.05 }); this.tone(1568, 0.25, { gain: 0.04, delay: 0.1 }); },
        start() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, { type: "triangle", gain: 0.06, delay: i * 0.07 })); },
        round() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.22, { type: "triangle", gain: 0.08, delay: i * 0.09 })); },
        win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: "triangle", gain: 0.1, delay: i * 0.11 })); },
        lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.38, { type: "sawtooth", gain: 0.035, delay: i * 0.17 })); },
    };

    // =================================================================
    // Desenho das peças (SVG)
    // =================================================================
    const NS = "http://www.w3.org/2000/svg";
    const PIPS = {
        0: [],
        1: [[0.5, 0.5]],
        2: [[0.27, 0.27], [0.73, 0.73]],
        3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
        4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
        5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
        6: [[0.27, 0.22], [0.27, 0.5], [0.27, 0.78], [0.73, 0.22], [0.73, 0.5], [0.73, 0.78]],
    };

    // Gradiente compartilhado por todas as peças (um só <defs> na página).
    const defs = document.createElementNS(NS, "svg");
    defs.setAttribute("width", "0");
    defs.setAttribute("height", "0");
    defs.style.position = "absolute";
    defs.innerHTML = `<defs><linearGradient id="tileGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--tile)"/><stop offset="1" style="stop-color: var(--tile-2)"/></linearGradient></defs>`;
    document.body.prepend(defs);

    const pipsSvg = (value, x, y, horizontal) =>
        PIPS[value].map(([px, py]) => {
            const cx = x + (horizontal ? py : px);
            const cy = y + (horizontal ? px : py);
            return `<circle class="pip" cx="${cx}" cy="${cy}" r="0.085"/>`;
        }).join("");

    /** Peça em x,y com w×h unidades (2×1 deitada ou 1×2 em pé); a = esquerda/cima, b = direita/baixo. */
    const tileSvg = ({ x, y, w, h, a, b }, cls = "piece", attrs = "") => {
        const horizontal = w > h;
        const line = horizontal
            ? `<line class="tile-line" x1="${x + 1}" y1="${y + 0.16}" x2="${x + 1}" y2="${y + 0.84}"/>`
            : `<line class="tile-line" x1="${x + 0.16}" y1="${y + 1}" x2="${x + 0.84}" y2="${y + 1}"/>`;
        const bx = horizontal ? x + 1 : x;
        const by = horizontal ? y : y + 1;
        return `<g class="${cls}" ${attrs}>
            <rect class="tile-shadow" x="${x + 0.07}" y="${y + 0.09}" width="${w - 0.06}" height="${h - 0.06}" rx="0.14"/>
            <rect class="tile-body" x="${x + 0.03}" y="${y + 0.03}" width="${w - 0.06}" height="${h - 0.06}" rx="0.14"/>
            ${line}${pipsSvg(a, x, y, horizontal)}${pipsSvg(b, bx, by, horizontal)}
        </g>`;
    };

    const handTileSvg = (t) =>
        `<svg viewBox="-0.02 -0.02 1.12 2.14" aria-hidden="true">${tileSvg({ x: 0, y: 0, w: 1, h: 2, a: t[0], b: t[1] })}</svg>`;

    // =================================================================
    // Estado
    // =================================================================
    const ui = {
        mode: $("mode"), level: $("level"), target: $("target"), mesa: $("mesa"), opening: $("opening"),
        felt: $("felt"), board: $("board"), hand: $("hand"), me: $("me"), meInfo: $("me-info"),
        status: $("status"), moves: $("moves"), score: $("score"), scoreTarget: $("score-target"), record: $("record"),
        stock: $("stock"), stockCount: $("stock-count"), toast: $("toast"),
        btnNew: $("btn-new"), btnDraw: $("btn-draw"), btnPass: $("btn-pass"), btnHint: $("btn-hint"), btnSound: $("btn-sound"),
        overlay: $("overlay"), overlayIcon: $("overlay-icon"), overlayTitle: $("overlay-title"), overlayText: $("overlay-text"),
        overlayHands: $("overlay-hands"), overlayNext: $("overlay-next"), overlayClose: $("overlay-close"),
        seats: { top: $("seat-top"), left: $("seat-left"), right: $("seat-right") },
    };

    const SEATS = { 2: [null, "top"], 3: [null, "right", "top"], 4: [null, "right", "top", "left"] };
    const NAMES = { 2: ["Você", "Cat"], 3: ["Você", "Cat", "Dino"], 4: ["Você", "Cat", "Dino", "Dog"] };

    const prefs = Object.assign({ mode: "4", level: "medio", target: "6", mesa: "feltro", opening: "1" }, storage.get(PREFS_KEY) || {});
    const stats = Object.assign({ wins: 0, losses: 0 }, storage.get(STATS_KEY) || {});

    let n = 4;
    let names = NAMES[4];
    let round = null;
    let scores = [];
    let roundNo = 0;
    let target = 6;
    let gen = 0; // muda a cada nova partida/rodada para cancelar jogadas pendentes
    let selected = null; // peça escolhida pelo jogador
    let hintMove = null;
    let lastPlaced = null;
    let newTile = null;
    let lastAction = []; // última ação de cada jogador ("pass")
    let matchOver = false;
    let viewOnly = false;

    const teamName = (team) => (n === 4 ? (team === 0 ? "Você + Dino" : "Cat + Dog") : names[team]);
    const teamCount = () => (n === 4 ? 2 : n);
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const humanTurn = () => round && !round.over && round.turn === 0;
    const sideName = (side) => (side === "left" ? "à esquerda" : side === "right" ? "à direita" : "para abrir a mesa");

    // =================================================================
    // Mesa
    // =================================================================
    let halfW = 6;

    const computeHalfW = () => {
        const r = ui.felt.getBoundingClientRect();
        const aspect = r.width / Math.max(1, r.height);
        return Math.max(3.5, Math.min(7.5, Math.round((1 + 3 * aspect) * 2) / 2));
    };

    const ghostMoves = () => {
        if (!humanTurn() || !selected) return [];
        return E.legalMoves(round, 0).filter((m) => E.same(m.tile, selected));
    };

    function renderBoard() {
        halfW = computeHalfW();
        const rect = ui.felt.getBoundingClientRect();
        const aspect = rect.width / Math.max(1, rect.height);
        const { pieces } = E.layout(round, halfW);
        const ghosts = ghostMoves().map((m) => ({ move: m, piece: E.layout(round, halfW, m).ghost }));

        let minX = -halfW - 1, maxX = halfW + 1, minY = -2.5, maxY = 2.5;
        [...pieces, ...ghosts.map((g) => g.piece)].forEach((p) => {
            minX = Math.min(minX, p.x - 0.6); maxX = Math.max(maxX, p.x + p.w + 0.6);
            minY = Math.min(minY, p.y - 0.6); maxY = Math.max(maxY, p.y + p.h + 0.6);
        });
        let w = maxX - minX, h = maxY - minY;
        if (w / h < aspect) { const nw = h * aspect; minX -= (nw - w) / 2; w = nw; }
        else { const nh = w / aspect; minY -= (nh - h) / 2; h = nh; }
        ui.board.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);

        let html = "";
        if (!pieces.length && !ghosts.length) {
            html = `<text class="empty-text" x="0" y="0.2">${humanTurn() ? "Sua vez de abrir a mesa" : "Aguardando a primeira peça…"}</text>`;
        }
        pieces.forEach((p) => {
            const isNew = lastPlaced && E.same(p.tile, lastPlaced);
            html += tileSvg(p, `piece${isNew ? " novo" : ""}${p.end && humanTurn() && !selected ? " ponta" : ""}`);
        });
        ghosts.forEach((g, i) => {
            const dica = hintMove && hintMove.side === g.move.side ? " dica" : "";
            html += tileSvg(g.piece, `ghost${dica}`, `data-ghost="${i}" role="button" aria-label="Jogar ${sideName(g.move.side)}"`);
        });
        ui.board.innerHTML = html;
        ui.board.querySelectorAll("[data-ghost]").forEach((el) => {
            el.addEventListener("click", () => humanPlay(ghosts[Number(el.dataset.ghost)].move));
        });
        lastPlaced = null;
    }

    // =================================================================
    // Jogadores
    // =================================================================
    function renderSeats() {
        Object.values(ui.seats).forEach((el) => { el.innerHTML = ""; el.classList.remove("ativo", "pensando"); });
        for (let p = 1; p < n; p++) {
            const el = ui.seats[SEATS[n][p]];
            const count = round.hands[p].length;
            const tag = n === 4 ? (p === 2 ? "Parceiro" : "Adversário") : "Computador";
            const backs = Array.from({ length: count }, () => '<span class="back"></span>').join("");
            el.innerHTML = `
                <div class="who"><span class="tag">${tag}</span><strong>${names[p]}</strong>
                    <small>${count} ${count === 1 ? "peça" : "peças"}</small>
                    ${lastAction[p] === "pass" ? '<span class="passou">passou</span>' : ""}
                    <span class="dots"><i></i><i></i><i></i></span></div>
                <div class="backs">${backs}</div>`;
            el.classList.toggle("ativo", !round.over && round.turn === p);
        }
    }

    function renderHand() {
        const moves = humanTurn() ? E.legalMoves(round, 0) : [];
        const hand = round.hands[0];
        ui.hand.classList.toggle("vez", humanTurn() && !viewOnly);
        ui.me.classList.toggle("ativo", humanTurn());
        if (!hand.length) {
            ui.hand.innerHTML = '<span class="hand-empty">Sem peças — bateu!</span>';
        } else {
            ui.hand.innerHTML = hand.map((t, i) => {
                const can = moves.some((m) => E.same(m.tile, t));
                const cls = ["hand-tile", can && "pode", selected && E.same(selected, t) && "sel",
                    hintMove && E.same(hintMove.tile, t) && "dica", newTile && E.same(newTile, t) && "nova"].filter(Boolean).join(" ");
                return `<button type="button" class="${cls}" data-i="${i}" role="option" aria-label="Peça ${E.label(t)}${can ? ", pode jogar" : ""}">
                    ${i < 9 ? `<span class="num">${i + 1}</span>` : ""}${handTileSvg(t)}</button>`;
            }).join("");
        }
        newTile = null;
        const pts = E.handPips(hand);
        ui.meInfo.textContent = `${hand.length} ${hand.length === 1 ? "peça" : "peças"} · ${pts} pontos na mão${n === 4 ? " · parceiro: Dino (em frente)" : ""}`;
    }

    function renderStatus() {
        let text = "", tone = "";
        if (!round) text = "Embaralhando…";
        else if (round.over) { text = matchOver ? "Fim da partida" : "Fim da rodada"; tone = "fim"; }
        else if (round.turn === 0) {
            tone = "vez";
            const moves = E.legalMoves(round, 0);
            if (!round.center && round.mustPlay) text = `Sua vez: abra a mesa com o ${E.label(round.mustPlay)}`;
            else if (!round.center) text = "Sua vez: escolha a peça para abrir a mesa";
            else if (moves.length) text = selected && ghostMoves().length > 1 ? "Toque na ponta marcada na mesa" : `Sua vez · pontas ${round.ends[0]} e ${round.ends[1]}`;
            else if (round.stock.length) text = "Nenhuma peça encaixa: compre do monte";
            else text = "Nenhuma peça encaixa: passe a vez";
        } else { text = `Vez de ${names[round.turn]}…`; tone = "pensando"; }
        ui.status.textContent = text;
        ui.status.dataset.tone = tone;

        const mine = humanTurn() && !viewOnly;
        const playable = mine && E.canPlay(round, 0);
        ui.btnDraw.disabled = !(mine && !playable && round.stock.length);
        ui.btnPass.disabled = !(mine && !playable && !round.stock.length);
        ui.btnHint.disabled = !playable;
        ui.btnDraw.classList.toggle("chamar", !ui.btnDraw.disabled);
        ui.btnPass.classList.toggle("chamar", !ui.btnPass.disabled);
        ui.btnDraw.hidden = n === 4;

        ui.stock.hidden = !round || n === 4;
        if (round) ui.stockCount.textContent = round.stock.length;
        ui.stock.classList.toggle("chamar", !ui.btnDraw.disabled);
    }

    function renderScore() {
        ui.scoreTarget.textContent = `· até ${target}`;
        ui.score.innerHTML = Array.from({ length: teamCount() }, (_, t) =>
            `<div class="${t === 0 ? "minha" : ""}"><strong>${scores[t] ?? 0}</strong><span>${teamName(t)}</span></div>`).join("");
        ui.record.textContent = `Partidas: ${stats.wins} ${stats.wins === 1 ? "vitória" : "vitórias"} · ${stats.losses} ${stats.losses === 1 ? "derrota" : "derrotas"}`;
    }

    const logLines = [];
    function addLog(html, cls = "") {
        logLines.push(`<li class="${cls}">${html}</li>`);
        ui.moves.innerHTML = logLines.join("");
        ui.moves.scrollTop = ui.moves.scrollHeight;
    }

    function render() {
        if (!round) return;
        renderBoard();
        renderSeats();
        renderHand();
        renderStatus();
        renderScore();
    }

    let toastTimer = 0;
    function toast(text) {
        ui.toast.textContent = text;
        ui.toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1600);
    }

    // =================================================================
    // Fluxo da partida
    // =================================================================
    function newMatch() {
        n = Number(ui.mode.value);
        names = NAMES[n];
        target = Number(ui.target.value);
        scores = Array(teamCount()).fill(0);
        roundNo = 0;
        matchOver = false;
        logLines.length = 0;
        sound.start();
        startRound(null);
    }

    function startRound(starter) {
        gen++;
        roundNo++;
        round = E.newRound(n, starter, Number(ui.opening.value));
        selected = null;
        hintMove = null;
        viewOnly = false;
        lastAction = [];
        ui.overlay.hidden = true;
        addLog(`Rodada ${roundNo} — começa ${names[round.turn] === "Você" ? "você" : names[round.turn]}`, "rodada");
        render();
        nextTurn();
    }

    function nextTurn() {
        render();
        if (round.over) { endRound(); return; }
        const p = round.turn;
        if (p === 0) {
            if (!E.canPlay(round, 0) && !round.stock.length) {
                const g = gen;
                setTimeout(() => {
                    if (g !== gen || !humanTurn() || E.canPlay(round, 0)) return;
                    toast("Você não tem peça que encaixe: passou a vez");
                    doPass(0);
                }, 1100);
            }
            return;
        }
        cpuTurn(p);
    }

    async function cpuTurn(p) {
        const g = gen;
        ui.seats[SEATS[n][p]].classList.add("pensando");
        await wait(650 + Math.random() * 450);
        if (g !== gen) return;
        while (!E.canPlay(round, p) && round.stock.length) {
            E.draw(round, p);
            sound.draw();
            addLog(`${names[p]} comprou do monte`);
            renderSeats();
            renderStatus();
            ui.seats[SEATS[n][p]].classList.add("pensando");
            await wait(380);
            if (g !== gen) return;
        }
        if (!E.canPlay(round, p)) {
            toast(`${names[p]} passou`);
            doPass(p);
            return;
        }
        const move = E.chooseMove(round, p, ui.level.value);
        doPlay(p, move);
    }

    function doPlay(p, move) {
        const tile = E.play(round, p, move);
        lastPlaced = tile;
        lastAction[p] = "play";
        sound.place();
        addLog(`${p === 0 ? "Você jogou" : `${names[p]} jogou`} <b>${E.label(tile)}</b> ${sideName(move.side)}`);
        nextTurn();
    }

    function doPass(p) {
        E.pass(round, p);
        lastAction[p] = "pass";
        sound.pass();
        addLog(`${p === 0 ? "Você passou" : `${names[p]} passou`}`);
        nextTurn();
    }

    function humanPlay(move) {
        if (!humanTurn() || viewOnly) return;
        selected = null;
        hintMove = null;
        doPlay(0, move);
    }

    function humanSelect(tile) {
        if (!humanTurn() || viewOnly) return;
        const moves = E.legalMoves(round, 0).filter((m) => E.same(m.tile, tile));
        if (!moves.length) {
            sound.illegal();
            toast(!round.center && round.mustPlay ? `Abra a mesa com o ${E.label(round.mustPlay)}` : `A peça ${E.label(tile)} não encaixa nas pontas`);
            return;
        }
        if (moves.length === 1) { humanPlay(moves[0]); return; }
        if (selected && E.same(selected, tile)) { selected = null; hintMove = null; }
        else { selected = tile; if (!hintMove || !E.same(hintMove.tile, tile)) hintMove = null; sound.select(); }
        render();
    }

    function humanDraw() {
        if (!humanTurn() || viewOnly || E.canPlay(round, 0) || !round.stock.length) return;
        newTile = E.draw(round, 0);
        sound.draw();
        addLog("Você comprou do monte");
        if (E.canPlay(round, 0)) toast(`Comprou ${E.label(newTile)} — agora dá para jogar`);
        nextTurn();
    }

    function humanPass() {
        if (!humanTurn() || viewOnly || E.canPlay(round, 0) || round.stock.length) return;
        doPass(0);
    }

    function hint() {
        if (!humanTurn() || viewOnly || !E.canPlay(round, 0)) return;
        hintMove = E.chooseMove(round, 0, "dificil");
        selected = hintMove.tile;
        sound.hint();
        toast(`Dica: ${E.label(hintMove.tile)} ${sideName(hintMove.side)}`);
        render();
    }

    function endRound() {
        const o = round.over;
        let icon = "🁫", title = o.name, text = "";
        if (o.points > 0) {
            scores[o.team] += o.points;
            const who = o.winner === 0 ? "Você" : names[o.winner];
            const forTeam = n === 4 ? ` (${teamName(o.team)})` : "";
            text = o.type === "batida"
                ? `${who} bateu com ${E.label(o.tile)}${forTeam}: +${o.points} ${o.points === 1 ? "ponto" : "pontos"}.`
                : `Ninguém pode jogar. ${who} tem menos pontos na mão${forTeam}: +1 ponto.`;
            icon = o.kind === "cruzada" ? "✖️" : o.kind === "laelo" ? "↔️" : o.kind === "carroca" ? "🛒" : o.type === "fechado" ? "🔒" : "🎯";
        } else {
            icon = "🤝";
            text = "Ninguém pode jogar e os adversários empataram nos pontos da mão: ninguém pontua.";
        }
        addLog(`${o.name}: ${o.points > 0 ? `+${o.points} para ${teamName(o.team)}` : "ninguém pontua"}`, "rodada");

        const winnerTeam = scores.findIndex((s) => s >= target);
        matchOver = winnerTeam >= 0;
        const mineWon = o.points > 0 && o.team === 0;
        if (matchOver) {
            if (winnerTeam === 0) { stats.wins++; title = "Vitória!"; icon = "🏆"; sound.win(); confetti(); }
            else { stats.losses++; title = "Derrota"; icon = "🦖"; sound.lose(); }
            storage.set(STATS_KEY, stats);
            text += ` ${teamName(winnerTeam)} ${n === 4 ? "venceram" : "venceu"} a partida por ${scores[winnerTeam]} a ${Math.max(...scores.filter((_, i) => i !== winnerTeam))}.`;
        } else {
            mineWon ? sound.round() : sound.pass();
        }

        ui.overlayIcon.textContent = icon;
        ui.overlayTitle.textContent = title;
        ui.overlayText.textContent = text.trim();
        const totals = round.hands.map(E.handPips);
        ui.overlayHands.innerHTML = round.hands.map((hand, p) => `
            <div><b>${names[p]}</b><span class="mini-tiles">${hand.map(handTileSvg).join("") || "bateu"}</span><em>${totals[p]}</em></div>`).join("");
        ui.overlayNext.textContent = matchOver ? "Nova partida" : "Próxima rodada";
        ui.overlay.hidden = false;
        nextStarter = o.winner ?? o.next ?? round.starter;
        render();
    }
    let nextStarter = null;

    // =================================================================
    // Eventos
    // =================================================================
    ui.hand.addEventListener("click", (event) => {
        const btn = event.target.closest(".hand-tile");
        if (!btn) return;
        sound.ensure();
        humanSelect(round.hands[0][Number(btn.dataset.i)]);
    });
    ui.btnNew.addEventListener("click", () => {
        if (round && !matchOver && E.onTable(round) > 0 && !confirm("Começar uma nova partida? O placar atual será zerado.")) return;
        newMatch();
    });
    ui.btnDraw.addEventListener("click", humanDraw);
    ui.stock.addEventListener("click", humanDraw);
    ui.btnPass.addEventListener("click", humanPass);
    ui.btnHint.addEventListener("click", hint);
    ui.overlayNext.addEventListener("click", () => (matchOver ? newMatch() : startRound(nextStarter)));
    ui.overlayClose.addEventListener("click", () => {
        ui.overlay.hidden = true;
        viewOnly = true;
        ui.status.textContent = matchOver ? "Fim da partida · toque em Nova partida" : "Fim da rodada · toque aqui para continuar";
    });
    ui.status.addEventListener("click", () => {
        if (round?.over && ui.overlay.hidden) ui.overlay.hidden = false;
    });

    const updateSoundBtn = () => {
        ui.btnSound.textContent = sound.enabled ? "🔊" : "🔇";
        ui.btnSound.setAttribute("aria-pressed", String(sound.enabled));
    };
    const toggleSound = () => {
        sound.enabled = !sound.enabled;
        storage.set(SOUND_KEY, sound.enabled);
        updateSoundBtn();
        if (sound.enabled) sound.select();
    };
    ui.btnSound.addEventListener("click", toggleSound);

    const savePrefs = () => {
        Object.assign(prefs, { mode: ui.mode.value, level: ui.level.value, target: ui.target.value, mesa: ui.mesa.value, opening: ui.opening.value });
        storage.set(PREFS_KEY, prefs);
    };
    ui.mode.addEventListener("change", () => { savePrefs(); newMatch(); });
    ui.target.addEventListener("change", () => {
        savePrefs();
        target = Number(ui.target.value);
        if (!matchOver && scores.some((s) => s >= target)) newMatch(); else renderScore();
    });
    ui.level.addEventListener("change", savePrefs);
    // Vale a partir da próxima partida se a atual já começou; antes da 1ª jogada, recomeça já.
    ui.opening.addEventListener("change", () => {
        savePrefs();
        if (roundNo === 1 && round && E.onTable(round) === 0) newMatch();
        else toast(`A próxima partida começa com ${ui.opening.value === "6" ? "a sena (6|6)" : "o ás (1|1)"}`);
    });
    ui.mesa.addEventListener("change", () => { document.body.dataset.mesa = ui.mesa.value; savePrefs(); });

    window.addEventListener("keydown", (event) => {
        if (event.target.closest("select") || event.ctrlKey || event.metaKey || event.altKey) return;
        sound.ensure();
        const k = event.key.toLowerCase();
        if (/^[1-9]$/.test(k)) {
            const tile = round?.hands[0][Number(k) - 1];
            if (tile) humanSelect(tile);
        } else if ((k === "arrowleft" || k === "arrowright" || k === "q" || k === "e") && selected) {
            const side = k === "arrowleft" || k === "q" ? "left" : "right";
            const move = ghostMoves().find((m) => m.side === side);
            if (move) { event.preventDefault(); humanPlay(move); }
        } else if (k === "enter" && selected) {
            const moves = ghostMoves();
            if (moves.length) humanPlay(hintMove && E.same(hintMove.tile, selected) ? hintMove : moves[0]);
        } else if (k === "enter" && round?.over) {
            ui.overlayNext.click();
        } else if (k === "escape") {
            selected = null; hintMove = null; render();
        } else if (k === "c") humanDraw();
        else if (k === "p") humanPass();
        else if (k === "h") hint();
        else if (k === "n") ui.btnNew.click();
        else if (k === "m") toggleSound();
    });

    let resizeRaf = 0;
    new ResizeObserver(() => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => round && renderBoard());
    }).observe(ui.felt);

    // =================================================================
    // Confete
    // =================================================================
    function confetti() {
        const box = $("confetti");
        const colors = ["#f6d896", "#8fe08a", "#5294fa", "#ff7a9c", "#fff"];
        box.innerHTML = Array.from({ length: 90 }, () => {
            const left = Math.random() * 100;
            const dur = 2.2 + Math.random() * 1.8;
            return `<span style="left:${left}%;background:${colors[Math.floor(Math.random() * colors.length)]};
                --drift:${(Math.random() - 0.5) * 200}px;--spin:${Math.random() * 900}deg;
                animation-duration:${dur}s;animation-delay:${Math.random() * 0.6}s"></span>`;
        }).join("");
        setTimeout(() => (box.innerHTML = ""), 4800);
    }

    // =================================================================
    // Início
    // =================================================================
    ui.mode.value = prefs.mode;
    ui.level.value = prefs.level;
    ui.target.value = prefs.target;
    ui.opening.value = prefs.opening;
    ui.mesa.value = prefs.mesa;
    document.body.dataset.mesa = ui.mesa.value;
    updateSoundBtn();
    newMatch();
})();
