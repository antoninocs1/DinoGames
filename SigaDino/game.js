/* =====================================================================
   Siga o Dino — aparelho, som e andamento da partida
   ---------------------------------------------------------------------
   Organização:
     sound     sons sintetizados (Web Audio, sem arquivos)
     LOOKS     desenhos do aparelho ("anel" e "flor"); cada um recebe a
               lista de botões e devolve o SVG — funcionam para qualquer
               quantidade de botões (4 cores, 7 notas, 12 notas…)
     partida   playback da sequência, toques do jogador e resultado
   Para um novo modelo de aparelho, acrescente uma função em LOOKS e uma
   <option> no seletor "Modelo"; para novos botões, veja modes.js.
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
        /** Nota com ataque e soltura suaves (sem estalos). */
        tone(freq, seconds, { type = "triangle", gain = 0.16, delay = 0 } = {}) {
            const ctx = this.ensure();
            if (!ctx || !this.enabled) return;
            const t = ctx.currentTime + delay;
            const end = t + Math.max(0.06, seconds);
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
            g.gain.setValueAtTime(gain, end - 0.05);
            g.gain.exponentialRampToValueAtTime(0.0001, end);
            osc.connect(g).connect(ctx.destination);
            osc.start(t);
            osc.stop(end + 0.02);
        },
        /** Som do botão: triângulo + um pouco da oitava para ficar mais "cheio". */
        pad(freq, seconds) {
            this.tone(freq, seconds, { gain: 0.17 });
            this.tone(freq * 2, seconds, { type: "sine", gain: 0.03 });
        },
        error() {
            this.tone(98, 0.7, { type: "sawtooth", gain: 0.06 });
            this.tone(104, 0.7, { type: "sawtooth", gain: 0.06 });
        },
        timeout() { this.tone(330, 0.12, { type: "square", gain: 0.03 }); this.error(); },
        start() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { gain: 0.07, delay: i * 0.07 })); },
        win(freqs) {
            const seq = [...freqs, ...freqs.slice().reverse(), freqs[0] * 2];
            seq.forEach((f, i) => this.tone(f, 0.16, { gain: 0.1, delay: i * 0.09 }));
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
     * Setor de anel entre os raios r1 e r2, de a0 a a1 graus, com uma fresta
     * de largura constante (gap) dos dois lados — como as divisórias retas
     * do modelo de anel.
     */
    const sectorPath = (r1, r2, a0, a1, gap) => {
        const half = gap / 2;
        const o0 = a0 + (half / r2) * (180 / Math.PI);
        const o1 = a1 - (half / r2) * (180 / Math.PI);
        const i0 = a0 + (half / r1) * (180 / Math.PI);
        const i1 = a1 - (half / r1) * (180 / Math.PI);
        const large = o1 - o0 > 180 ? 1 : 0;
        const [x0, y0] = polar(r2, o0);
        const [x1, y1] = polar(r2, o1);
        const [x2, y2] = polar(r1, i1);
        const [x3, y3] = polar(r1, i0);
        return `M${f(x0)} ${f(y0)} A${r2} ${r2} 0 ${large} 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${r1} ${r1} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
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
    // Modelos do aparelho. Cada um devolve { body, pads[], hubR }.
    // pads[i] é o SVG da "face" do botão i (sem o <g> externo).
    // =================================================================
    const LOOKS = {
        // Modelo 1: disco dividido em fatias, com borda e cubo central.
        anel(mode) {
            const n = mode.pads.length;
            const span = 360 / n;
            const hubR = n > 7 ? 30 : 27;
            const r1 = hubR + 5;
            const gap = n > 7 ? 3 : 5;
            const pads = padAngles(mode).map((mid, i) => {
                const pad = mode.pads[i];
                const r2 = pad.sharp ? 74 : 90;
                const face = `<path class="face" d="${sectorPath(r1, r2, mid - span / 2, mid + span / 2, gap)}"/>`;
                if (!mode.labels) return face;
                const [lx, ly] = polar((r1 + r2) / 2 + 2, mid);
                return face + label(pad, lx, ly, n > 7 ? 7.5 : 10);
            });
            const body = `<circle class="body" r="98"/><circle class="body-groove" r="92"/>`;
            return { body, pads, hubR };
        },

        // Modelo 2: botões redondos em volta de um cubo central, sobre base oval.
        flor(mode) {
            const n = mode.pads.length;
            const ring = n <= 4 ? 44 : 62;
            const size = Math.min(37, ring * Math.sin(Math.PI / n) * (n <= 4 ? 1.2 : 1.05));
            const hubR = n <= 4 ? 33 : 30;
            const pads = padAngles(mode).map((mid, i) => {
                const pad = mode.pads[i];
                const r = pad.sharp ? size * 0.78 : size;
                const [cx, cy] = polar(pad.sharp ? ring + 4 : ring, mid);
                const face = `<circle class="face" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
                if (!mode.labels) return face;
                const [lx, ly] = polar((pad.sharp ? ring + 4 : ring) + r * 0.25, mid);
                return face + label(pad, lx, ly, n > 7 ? 7 : 10);
            });
            const body = `<ellipse class="body" rx="98" ry="95"/>`;
            return { body, pads, hubR };
        },
    };

    // =================================================================
    // Estado e interface
    // =================================================================
    const ui = {
        mode: $("mode"), fieldMode: $("field-mode"), look: $("look"), level: $("level"), strict: $("strict"), goal: $("goal"),
        device: $("device"), status: $("status"), progress: $("progress"),
        btnStart: $("btn-start"), btnSound: $("btn-sound"),
        scoreNow: $("score-now"), scoreBest: $("score-best"), recordInfo: $("record-info"),
        keys: $("keys"), confetti: $("confetti"),
    };

    const enabledModes = Object.entries(MODES).filter(([, m]) => m.enabled);
    ui.mode.innerHTML = enabledModes.map(([id, m]) => `<option value="${id}">${m.title}</option>`).join("");
    ui.fieldMode.hidden = enabledModes.length < 2; // só aparece quando houver mais de um conjunto

    const prefs = Object.assign({ mode: "cores4", look: "anel", level: "normal", strict: "1", goal: "20" }, storage.get(PREFS_KEY) || {});
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
        const pads = look.pads.map((face, i) => {
            const pad = mode.pads[i];
            const style = `--c:${shade(pad.color, -0.22)};--lit:${shade(pad.color, 0.38)};--glow:${pad.color}`;
            return `<g class="pad${pad.sharp ? " sharp" : ""}" data-i="${i}" style="${style}" role="button" tabindex="-1" aria-label="${pad.name}">${face}</g>`;
        }).join("");
        const r = look.hubR;
        ui.device.dataset.look = prefs.look;
        ui.device.innerHTML = `
            ${look.body}
            <g class="pads">${pads}</g>
            <g class="hub" id="hub" role="button" tabindex="0" aria-label="Jogar">
                <circle class="hub-disc" r="${r}"/>
                <rect class="hub-screen" x="${-r * 0.62}" y="${-r * 0.5}" width="${r * 1.24}" height="${r * 0.62}" rx="3"/>
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
        ui.keys.textContent = `Toque nos botões ou use o teclado: ${list} · Enter joga · Esc para · M som`;
    };

    const setInputEnabled = (on) => ui.device.classList.toggle("can-play", on);

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
    bindSelect(ui.look, "look", () => build());
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
        } else if (k === "m") toggleSound();
    });

    // Ao trocar de aba ou minimizar, a partida para (evita perder por tempo).
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && game && phase !== "over") resetIdle("Partida interrompida. Toque em Jogar para começar.");
    });

    updateSoundButton();
    build();
})();
