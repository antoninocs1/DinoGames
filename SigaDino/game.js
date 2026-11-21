/* =====================================================================
   Siga o Dino — aparelho, som e andamento da partida
   ---------------------------------------------------------------------
   Organização:
     sound     sons sintetizados (Web Audio, sem arquivos)
     LOOKS     desenho do aparelho ("anel"); recebe a lista de botões e
               devolve as formas — funciona para qualquer quantidade de
               botões (4 cores, 7 notas, 12 notas…)
     partida   playback da sequência, toques do jogador e resultado
   Para um novo modelo de aparelho, acrescente uma função em LOOKS (e um
   seletor para escolhê-lo); para novos botões, veja modes.js.
   Pensado para crianças: sons sempre suaves, sem distorção.
   ===================================================================== */
(() => {
    "use strict";
    const E = window.SigaDinoEngine;
    const MODES = window.SIGA_DINO_MODES;
    const $ = (id) => document.getElementById(id);

    const PREFS_KEY = "dinogames-sigadino-prefs";
    const RECORDS_KEY = "dinogames-sigadino-records";
    const SOUND_KEY = "dinogames-sigadino-sound";

    const storage = {
        get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* indisponível */ } },
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // =================================================================
    // Som (Web Audio)
    // =================================================================
    /**
     * Timbres dos botões. Todos suaves: ataque macio, sem ondas ásperas
     * (quadrada/serra) e passando por um filtro que corta os agudos.
     *   partials  [múltiplo da frequência, volume relativo, onda opcional]
     *   attack    segundos até o volume máximo
     *   decay     true = o som vai sumindo (sino); false = sustenta enquanto acende
     *   raw       true = sai direto, sem o filtro (o som da 1ª versão do jogo)
     */
    const TIMBRES = {
        suave:    { wave: "sine",     partials: [[1, 1], [2, 0.12]],             attack: 0.03,  decay: false },
        sininho:  { wave: "sine",     partials: [[1, 1], [3, 0.1], [4.2, 0.04]], attack: 0.006, decay: true },
        classico: { wave: "triangle", partials: [[1, 1]],                        attack: 0.02,  decay: false },
        inicial:  { wave: "triangle", partials: [[1, 1.3], [2, 0.23, "sine"]],    attack: 0.012, decay: false, raw: true },
    };

    const sound = {
        ctx: null,
        out: null,
        timbre: "suave",
        enabled: storage.get(SOUND_KEY) !== false,
        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
                // Saída comum: filtro que arredonda os agudos + compressor que evita picos.
                const soften = this.ctx.createBiquadFilter();
                soften.type = "lowpass";
                soften.frequency.value = 2600;
                const comp = this.ctx.createDynamicsCompressor();
                comp.threshold.value = -18;
                comp.ratio.value = 4;
                soften.connect(comp).connect(this.ctx.destination);
                this.out = soften;
            }
            if (this.ctx.state === "suspended") this.ctx.resume();
            return this.ctx;
        },
        /** Uma nota com envelope macio (sem estalos). */
        tone(freq, seconds, { wave = "sine", gain = 0.12, delay = 0, attack = 0.03, decay = false, raw = false } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const end = t + Math.max(0.12, seconds);
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + attack);
            if (decay) {
                g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
            } else {
                g.gain.setValueAtTime(gain, Math.max(t + attack, end - 0.08));
                g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
            }
            osc.connect(g).connect(raw ? ctx.destination : this.out);
            osc.start(t);
            osc.stop(end + 0.3);
        },
        /** Som de um botão no timbre escolhido. */
        pad(freq, seconds) {
            const tb = TIMBRES[this.timbre] || TIMBRES.suave;
            tb.partials.forEach(([mult, vol, wave = tb.wave]) =>
                this.tone(freq * mult, seconds, { wave, gain: 0.13 * vol, attack: tb.attack, decay: tb.decay, raw: tb.raw }));
        },
        /** "Ô-ôu": duas notas descendo, bem baixinho — avisa sem assustar. */
        error() {
            this.tone(440, 0.2, { gain: 0.08, attack: 0.04 });
            this.tone(349.23, 0.38, { gain: 0.08, attack: 0.04, delay: 0.24 });
        },
        timeout() { this.error(); },
        start() { [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.14, { gain: 0.06, delay: i * 0.09, attack: 0.02 })); },
        win(freqs) {
            const seq = [...freqs, ...freqs.slice().reverse(), freqs[0] * 2];
            seq.forEach((f, i) => this.tone(f, 0.2, { gain: 0.07, delay: i * 0.11, attack: 0.01, decay: true }));
        },
    };

    // =================================================================
    // Cores e geometria
    // =================================================================
    const hexToRgb = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    /** Mistura a cor com preto (amount < 0) ou branco (amount > 0). */
    const shade = (hex, amount) => {
        const target = amount < 0 ? 0 : 255;
        const k = Math.abs(amount);
        const rgb = hexToRgb(hex).map((c) => Math.round(c + (target - c) * k));
        return `rgb(${rgb.join(",")})`;
    };
    /** Texto escuro sobre cores claras (amarelo), claro sobre as demais. */
    const inkFor = (hex) => {
        const [r, g, b] = hexToRgb(hex);
        return (r * 299 + g * 587 + b * 114) / 1000 > 165 ? "#1b1820" : "#fff";
    };

    const rad = (deg) => (deg * Math.PI) / 180;
    const polar = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
    const f = (n) => +n.toFixed(2);

    /**
     * Setor de anel com cantos arredondados (estilo "gota"), de a0 a a1 graus
     * entre os raios r1 e r2, com uma fresta de largura constante (gap) entre
     * os botões. rOut = arredondamento dos cantos de fora; rIn = dos cantos
     * de dentro (perto do cubo).
     */
    const roundedSectorPath = (r1, r2, a0, a1, gap, rOut, rIn) => {
        const deg = 180 / Math.PI;
        const half = gap / 2;
        const o0 = a0 + (half / r2) * deg, o1 = a1 - (half / r2) * deg;
        const i0 = a0 + (half / r1) * deg, i1 = a1 - (half / r1) * deg;
        // Não deixa o arredondamento passar da metade de cada lado.
        rOut = Math.min(rOut, (r2 - r1) * 0.45, (rad(o1 - o0) * r2) * 0.45);
        rIn = Math.min(rIn, (r2 - r1) * 0.45, (rad(i1 - i0) * r1) * 0.45);
        const P = (r, d) => polar(r, d);
        const toward = ([x0, y0], [x1, y1], dist) => {
            const len = Math.hypot(x1 - x0, y1 - y0);
            return [x0 + ((x1 - x0) * dist) / len, y0 + ((y1 - y0) * dist) / len];
        };
        const O0 = P(r2, o0), O1 = P(r2, o1), I1 = P(r1, i1), I0 = P(r1, i0);
        const pt = ([x, y]) => `${f(x)} ${f(y)}`;
        const largeOut = o1 - o0 - 2 * (rOut / r2) * deg > 180 ? 1 : 0;
        const largeIn = i1 - i0 - 2 * (rIn / r1) * deg > 180 ? 1 : 0;
        return [
            `M${pt(toward(O0, I0, rOut))}`,
            `Q${pt(O0)} ${pt(P(r2, o0 + (rOut / r2) * deg))}`,
            `A${r2} ${r2} 0 ${largeOut} 1 ${pt(P(r2, o1 - (rOut / r2) * deg))}`,
            `Q${pt(O1)} ${pt(toward(O1, I1, rOut))}`,
            `L${pt(toward(I1, O1, rIn))}`,
            `Q${pt(I1)} ${pt(P(r1, i1 - (rIn / r1) * deg))}`,
            `A${r1} ${r1} 0 ${largeIn} 0 ${pt(P(r1, i0 + (rIn / r1) * deg))}`,
            `Q${pt(I0)} ${pt(toward(I0, O0, rIn))}`,
            "Z",
        ].join("");
    };

    /** Ângulo (graus) do centro de cada botão, em sentido horário. */
    const padAngles = (mode) => {
        const n = mode.pads.length;
        const span = 360 / n;
        const first = mode.rotate ?? -90 - span / 2;
        return mode.pads.map((_, i) => first + i * span);
    };

    const label = (pad, x, y, size) => {
        const text = pad.short || pad.name;
        return `<text class="pad-label" x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${inkFor(pad.color)}">${text}</text>`;
    };

    // =================================================================
    // Modelos do aparelho. Cada um devolve { pads[], hubR, bodyR }, onde
    // pads[i] = { shape, label }: shape é o elemento SVG sem fechar (ex.:
    // 'path d="…"'), usado tanto para a cor quanto para o brilho de vidro.
    // =================================================================
    const LOOKS = {
        // Disco preto com botões em forma de gota (fatias de cantos redondos) e cubo central.
        anel(mode) {
            const n = mode.pads.length;
            const span = 360 / n;
            const hubR = n > 7 ? 30 : 27;
            const r1 = hubR + 5;
            const gap = n > 7 ? 4 : 8;
            const pads = padAngles(mode).map((mid, i) => {
                const pad = mode.pads[i];
                const r2 = pad.sharp ? 72 : 88;
                const round = n > 7 ? [7, 4] : [20, 9]; // cantos de fora / de dentro
                const shape = `path d="${roundedSectorPath(r1, r2, mid - span / 2, mid + span / 2, gap, ...round)}"`;
                const [lx, ly] = polar((r1 + r2) / 2 + 2, mid);
                return { shape, label: mode.labels ? label(pad, lx, ly, n > 7 ? 7.5 : 10) : "" };
            });
            return { pads, hubR, bodyR: 97 };
        },
    };

    /** Gradientes do aparelho: corpo preto brilhante, botões de vidro colorido. */
    const defsSvg = () => {
        const padGrads = mode.pads.map((pad, i) => `
            <radialGradient id="pb${i}" cx=".5" cy=".42" r=".75">
                <stop offset="0" stop-color="${shade(pad.color, 0.1)}"/>
                <stop offset=".7" stop-color="${shade(pad.color, -0.08)}"/>
                <stop offset="1" stop-color="${shade(pad.color, -0.42)}"/>
            </radialGradient>
            <radialGradient id="pl${i}" cx=".5" cy=".45" r=".75">
                <stop offset="0" stop-color="${shade(pad.color, 0.8)}"/>
                <stop offset=".45" stop-color="${shade(pad.color, 0.35)}"/>
                <stop offset="1" stop-color="${shade(pad.color, -0.05)}"/>
            </radialGradient>`).join("");
        return `<defs>
            <radialGradient id="g-body" cx=".4" cy=".3" r=".85">
                <stop offset="0" stop-color="#4b4b58"/>
                <stop offset=".45" stop-color="#1d1d26"/>
                <stop offset="1" stop-color="#050508"/>
            </radialGradient>
            <linearGradient id="g-rim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#b9bccc"/>
                <stop offset=".35" stop-color="#3d3f4c"/>
                <stop offset="1" stop-color="#0a0a0f"/>
            </linearGradient>
            <radialGradient id="g-well" cx=".5" cy=".5" r=".5">
                <stop offset=".8" stop-color="#050507"/>
                <stop offset="1" stop-color="#16161d"/>
            </radialGradient>
            <radialGradient id="g-gloss" cx=".38" cy=".22" r=".62">
                <stop offset="0" stop-color="#fff" stop-opacity=".62"/>
                <stop offset=".5" stop-color="#fff" stop-opacity=".14"/>
                <stop offset="1" stop-color="#fff" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="g-screen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2a0f12"/>
                <stop offset="1" stop-color="#0c0405"/>
            </linearGradient>
            ${padGrads}
        </defs>`;
    };

    // =================================================================
    // Estado e interface
    // =================================================================
    const ui = {
        mode: $("mode"), fieldMode: $("field-mode"), timbre: $("timbre"), level: $("level"), strict: $("strict"), goal: $("goal"),
        device: $("device"), status: $("status"), progress: $("progress"),
        btnStart: $("btn-start"), btnReplay: $("btn-replay"), btnSound: $("btn-sound"),
        scoreNow: $("score-now"), scoreBest: $("score-best"), recordInfo: $("record-info"),
        keys: $("keys"), confetti: $("confetti"),
    };

    const enabledModes = Object.entries(MODES).filter(([, m]) => m.enabled);
    ui.mode.innerHTML = enabledModes.map(([id, m]) => `<option value="${id}">${m.title}</option>`).join("");
    ui.fieldMode.hidden = enabledModes.length < 2; // só aparece quando houver mais de um conjunto

    const DEFAULTS = { v: 2, mode: "cores4", look: "anel", timbre: "suave", level: "normal", strict: "0", goal: "20" };
    const saved = storage.get(PREFS_KEY) || {};
    // Versão 2: "Ouvir de novo" passou a ser o padrão (ajuda as crianças) e o modelo flor saiu.
    if (saved.v !== 2) { delete saved.strict; delete saved.look; }
    const prefs = Object.assign({}, DEFAULTS, saved, { v: 2 });
    if (!LOOKS[prefs.look]) prefs.look = "anel";
    if (!MODES[prefs.mode]?.enabled) prefs.mode = enabledModes[0][0];
    const records = storage.get(RECORDS_KEY) || {};

    let mode = MODES[prefs.mode];
    let padEls = [];       // <g> de cada botão
    let hub = null;        // elementos do cubo central
    let game = null;       // partida (engine)
    let phase = "idle";    // idle | show | input | wait | over
    let run = 0;           // muda a cada nova partida/parada para cancelar o playback em andamento
    let answerTimer = 0;

    const recordKey = () => `${prefs.mode}:${prefs.level}`;
    const levelName = () => ui.level.options[ui.level.selectedIndex]?.text || "";

    // ---------- Desenho ----------
    const build = () => {
        const look = (LOOKS[prefs.look] || LOOKS.anel)(mode);
        const pads = look.pads.map(({ shape, label: text }, i) => {
            const pad = mode.pads[i];
            const style = `--base:url(#pb${i});--lit:url(#pl${i});--glow:${pad.color}`;
            return `<g class="pad${pad.sharp ? " sharp" : ""}" data-i="${i}" style="${style}" role="button" tabindex="-1" aria-label="${pad.name}">
                <${shape} class="face"/><${shape} class="gloss"/>${text}</g>`;
        }).join("");
        const r = look.hubR;
        const R = look.bodyR;
        ui.device.dataset.look = prefs.look;
        ui.device.innerHTML = `
            ${defsSvg()}
            <circle class="body" r="${R}"/>
            <circle class="body-well" r="${R - 6}"/>
            <g class="pads">${pads}</g>
            <g class="hub" id="hub" role="button" tabindex="0" aria-label="Jogar">
                <circle class="hub-disc" r="${r}"/>
                <ellipse class="hub-shine" cy="${-r * 0.74}" rx="${r * 0.42}" ry="${r * 0.13}"/>
                <rect class="hub-screen" x="${-r * 0.62}" y="${-r * 0.5}" width="${r * 1.24}" height="${r * 0.62}" rx="4"/>
                <text class="hub-count" id="hub-count" y="${-r * 0.19 + 0.5}" font-size="${r * 0.48}">--</text>
                <text class="hub-text" id="hub-text" y="${r * 0.52}" font-size="${r * 0.24}">JOGAR</text>
            </g>`;
        padEls = [...ui.device.querySelectorAll(".pad")];
        hub = { el: $("hub"), count: $("hub-count"), text: $("hub-text") };
        hub.el.addEventListener("click", startGame);
        hub.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startGame(); } });
        if (game) setCount(phase === "over" && !game.won ? "!!" : game.won ? "★★" : two(game.length));
        renderKeys();
        renderScore();
        setInputEnabled(phase === "input");
    };

    const renderKeys = () => {
        const list = mode.pads.map((p) => `${p.keys[0].toUpperCase()} ${p.short || p.name}`).join(" · ");
        ui.keys.textContent = `Toque nos botões ou use o teclado: ${list} · Enter joga · R repete · Esc para · M som`;
    };

    const setInputEnabled = (on) => {
        ui.device.classList.toggle("can-play", on);
        ui.btnReplay.disabled = !on;
    };

    const setCount = (text) => { if (hub) hub.count.textContent = text; };
    const setHubText = (text) => { if (hub) hub.text.textContent = text; };
    const two = (n) => String(n).padStart(2, "0");

    const setStatus = (text, kind = "") => {
        ui.status.textContent = text;
        ui.status.className = `status ${kind}`.trim();
    };

    const renderProgress = () => {
        if (!game || !game.length) { ui.progress.innerHTML = ""; return; }
        const seq = game.sequence;
        ui.progress.innerHTML = seq.map((p, i) => {
            const done = game.won || (phase === "input" && i < game.step);
            return `<span class="${done ? "done" : ""}" style="--c:${mode.pads[p].color}"></span>`;
        }).join("");
    };

    const renderScore = () => {
        const best = records[recordKey()] || 0;
        ui.scoreNow.textContent = game ? String(currentScore()) : "0";
        ui.scoreBest.textContent = String(best);
        ui.recordInfo.textContent = `${mode.title} · ${levelName()}`;
    };

    /** Passos completados: a sequência atual ainda não conta, a não ser na vitória. */
    const currentScore = () => (game.won ? game.length : game.score);

    // ---------- Acender botões ----------
    const light = (i, ms) => {
        const el = padEls[i];
        if (!el) return;
        el.classList.add("lit");
        sound.pad(mode.pads[i].freq, ms / 1000);
        clearTimeout(el._off);
        el._off = setTimeout(() => el.classList.remove("lit"), ms);
    };

    const flashAll = async (times, ms, id) => {
        for (let t = 0; t < times; t++) {
            if (id !== run) return;
            padEls.forEach((el) => el.classList.add("lit"));
            await sleep(ms);
            padEls.forEach((el) => el.classList.remove("lit"));
            await sleep(ms * 0.8);
        }
    };

    // ---------- Partida ----------
    const clearAnswerTimer = () => clearTimeout(answerTimer);

    const armAnswerTimer = () => {
        clearAnswerTimer();
        const { wait } = E.timing(prefs.level, game.length);
        const id = run;
        answerTimer = setTimeout(() => { if (id === run && phase === "input") miss(true); }, wait);
    };

    const startGame = () => {
        sound.ensure();
        stop();
        const id = run;
        game = E.createGame({ padCount: mode.pads.length, goal: Number(prefs.goal), strict: prefs.strict === "1" });
        ui.btnStart.textContent = "Recomeçar";
        hub.el.setAttribute("aria-label", "Recomeçar");
        setStatus("Preste atenção…");
        sound.start();
        nextRound(id, 650);
    };

    /** Interrompe tudo (troca de opção, Esc ou nova partida). */
    const stop = () => {
        run++;
        clearAnswerTimer();
        phase = "idle";
        padEls.forEach((el) => el.classList.remove("lit"));
        setInputEnabled(false);
    };

    const nextRound = async (id, delay) => {
        game.addStep();
        phase = "wait";
        setCount(two(game.length));
        setHubText("PASSO");
        renderScore();
        renderProgress();
        await sleep(delay);
        if (id !== run) return;
        playback(id);
    };

    const playback = async (id) => {
        phase = "show";
        setInputEnabled(false);
        game.resetStep();
        renderProgress();
        setStatus(game.length === 1 ? "Observe o botão que acender." : `Observe a sequência de ${game.length} passos.`);
        const { on, gap } = E.timing(prefs.level, game.length);
        for (const i of game.sequence) {
            if (id !== run) return;
            light(i, on);
            await sleep(on + gap);
        }
        if (id !== run) return;
        phase = "input";
        setInputEnabled(true);
        setStatus("Sua vez! Repita a sequência.", "turn");
        renderProgress();
        armAnswerTimer();
    };

    /** Botão "Ouvir de novo": repete a sequência (ajuda, sem perder nada). */
    const replay = () => {
        if (phase !== "input") return;
        clearAnswerTimer();
        playback(run);
    };

    const press = (i) => {
        sound.ensure();
        if (phase !== "input") return;
        const { on } = E.timing(prefs.level, game.length);
        const expected = game.expected();
        const result = game.press(i);
        if (result === "retry" || result === "over") { miss(false, i, expected); return; }

        light(i, Math.min(on, 260));
        renderProgress();
        if (result === "ok") { armAnswerTimer(); return; }

        clearAnswerTimer();
        setInputEnabled(false);
        if (result === "win") { win(); return; }
        setStatus(pick(["Isso!", "Boa!", "Mandou bem!", "Certinho!"]), "good");
        nextRound(run, 800);
    };

    const pick = (list) => list[Math.floor(Math.random() * list.length)];

    /** Erro ou tempo esgotado. */
    const miss = async (timedOut, pressed = -1, expected = game.expected()) => {
        const id = run;
        clearAnswerTimer();
        setInputEnabled(false);
        phase = "wait";
        if (timedOut) {
            game.press(-1); // registra o erro na partida
            sound.timeout();
        } else {
            sound.error();
            if (padEls[pressed]) padEls[pressed].classList.add("wrong");
            setTimeout(() => padEls[pressed]?.classList.remove("wrong"), 600);
        }
        setCount("!!");

        if (!game.strict) {
            setStatus(timedOut ? "Tempo esgotado! Ouça de novo." : "Errou! Ouça de novo.", "bad");
            await sleep(1100);
            if (id !== run) return;
            setCount(two(game.length));
            playback(id);
            return;
        }

        // Fim de jogo: mostra qual era o botão certo.
        phase = "over";
        const score = game.score;
        const best = saveRecord(score);
        const name = mode.pads[expected]?.name;
        const why = timedOut ? "Tempo esgotado" : "Errou";
        setStatus(`${why}! O certo era ${name}. Você acertou ${score} ${score === 1 ? "passo" : "passos"}${best ? " — novo recorde! 🏆" : "."}`, "bad");
        setHubText("JOGAR");
        hub.el.setAttribute("aria-label", "Jogar de novo");
        ui.btnStart.textContent = "Jogar de novo";
        renderScore();
        await sleep(700);
        for (let t = 0; t < 3 && id === run; t++) {
            padEls[expected]?.classList.add("lit");
            await sleep(260);
            padEls[expected]?.classList.remove("lit");
            await sleep(200);
        }
    };

    const win = async () => {
        const id = run;
        phase = "over";
        game.won = true;
        const best = saveRecord(game.length);
        setCount("★★");
        setHubText("VENCEU");
        setStatus(`Você venceu! Repetiu os ${game.length} passos${best ? " — novo recorde! 🏆" : "!"}`, "good");
        ui.btnStart.textContent = "Jogar de novo";
        hub.el.setAttribute("aria-label", "Jogar de novo");
        renderScore();
        renderProgress();
        sound.win(mode.pads.map((p) => p.freq));
        confetti();
        await sleep(400);
        await flashAll(3, 180, id);
    };

    /** Guarda o recorde do modo + velocidade. Devolve true se for novo recorde. */
    const saveRecord = (score) => {
        const key = recordKey();
        if (score <= (records[key] || 0)) return false;
        records[key] = score;
        storage.set(RECORDS_KEY, records);
        return true;
    };

    const confetti = () => {
        const colors = mode.pads.map((p) => p.color);
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

    const resetIdle = (message) => {
        stop();
        game = null;
        setCount("--");
        setHubText("JOGAR");
        ui.btnStart.textContent = "Jogar";
        renderProgress();
        renderScore();
        setStatus(message || "Toque em Jogar (ou no centro do aparelho) para começar.");
    };

    // =================================================================
    // Eventos
    // =================================================================
    ui.device.addEventListener("pointerdown", (event) => {
        const el = event.target.closest(".pad");
        if (!el) return;
        event.preventDefault();
        press(Number(el.dataset.i));
    });

    ui.btnStart.addEventListener("click", startGame);

    const updateSoundButton = () => {
        ui.btnSound.textContent = sound.enabled ? "🔊" : "🔇";
        ui.btnSound.setAttribute("aria-pressed", String(!sound.enabled));
    };
    const toggleSound = () => {
        sound.enabled = !sound.enabled;
        storage.set(SOUND_KEY, sound.enabled);
        updateSoundButton();
    };
    ui.btnSound.addEventListener("click", toggleSound);

    // Opções: valores salvos e mudanças.
    const bindSelect = (el, key, onChange) => {
        el.value = prefs[key];
        if (el.value !== prefs[key]) prefs[key] = el.value; // valor salvo que não existe mais
        el.addEventListener("change", () => {
            prefs[key] = el.value;
            storage.set(PREFS_KEY, prefs);
            onChange();
        });
    };
    const restartIfPlaying = (message) => {
        if (game) resetIdle(message);
        else renderScore();
    };
    bindSelect(ui.mode, "mode", () => { mode = MODES[prefs.mode]; resetIdle(); build(); });
    bindSelect(ui.timbre, "timbre", () => {
        sound.timbre = prefs.timbre;
        sound.ensure();
        sound.pad(mode.pads[0].freq, 0.35); // amostra do som escolhido
    });
    sound.timbre = prefs.timbre;
    ui.btnReplay.addEventListener("click", replay);
    bindSelect(ui.level, "level", () => restartIfPlaying("Velocidade alterada. Toque em Jogar para começar."));
    bindSelect(ui.strict, "strict", () => restartIfPlaying("Opção alterada. Toque em Jogar para começar."));
    bindSelect(ui.goal, "goal", () => restartIfPlaying("Objetivo alterado. Toque em Jogar para começar."));

    // Teclado: as teclas de cada botão vêm de modes.js.
    window.addEventListener("keydown", (event) => {
        if (event.target.closest?.("select") || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        const k = event.key.toLowerCase();
        const padIndex = mode.pads.findIndex((p) => p.keys.includes(k));
        if (padIndex >= 0) { event.preventDefault(); press(padIndex); return; }
        if (k === "enter" || k === "n") {
            if (event.target.closest?.("button, [role=button]")) return; // o próprio botão já trata
            event.preventDefault();
            startGame();
        } else if (k === "escape") {
            if (game) resetIdle("Partida interrompida. Toque em Jogar para começar.");
        } else if (k === "r") replay();
        else if (k === "m") toggleSound();
    });

    // Ao trocar de aba ou minimizar, a partida para (evita perder por tempo).
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && game && phase !== "over") resetIdle("Partida interrompida. Toque em Jogar para começar.");
    });

    updateSoundButton();
    build();
})();
