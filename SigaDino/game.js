/* =====================================================================
   Siga o Dino — aparelho, som e andamento da partida
   ---------------------------------------------------------------------
   Organização:
     sound     toca os botões (sons gerados ou arquivos, ver sounds.js)
               e os efeitos (início, erro, vitória)
     LOOKS     desenho do aparelho ("anel"); recebe a lista de botões e
               devolve as formas — funciona para qualquer quantidade de
               botões (4 cores, 7 notas, 12 notas…)
     partida   playback da sequência, toques do jogador e resultado
   Para um novo modelo de aparelho, acrescente uma função em LOOKS (e um
   seletor para escolhê-lo); para novos botões, veja modes.js; para
   novos sons, veja sounds.js.
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
    /** Opções do seletor "Som" (sons gerados e arquivos), definidas em sounds.js. */
    const SOUNDS = window.SIGA_DINO_SOUNDS;

    const sound = {
        ctx: null,
        out: null,
        timbre: "suave",
        buffers: {},   // arquivo -> AudioBuffer já decodificado (ou a Promise do carregamento)
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
        /**
         * Eco de igreja: um "convolver" com uma resposta gerada (ruído que vai
         * sumindo, ~2,8 s). Criado só quando algum som pede reverb.
         */
        reverbIn() {
            if (this.verb) return this.verb;
            const ctx = this.ctx;
            const len = Math.round(ctx.sampleRate * 2.8);
            const ir = ctx.createBuffer(2, len, ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = ir.getChannelData(ch);
                for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
            }
            const conv = ctx.createConvolver();
            conv.buffer = ir;
            conv.connect(this.out);
            this.verb = conv;
            return conv;
        },
        /**
         * Uma nota com envelope macio (sem estalos).
         * ring    com decay: segundos até sumir (piano soa mais que um sininho)
         * release sem decay: segundos para apagar depois que a luz apaga
         * reverb  quanto do som vai para o eco (0 a 1)
         */
        tone(freq, seconds, { wave = "sine", gain = 0.12, delay = 0, attack = 0.03, decay = false, raw = false, ring = 0, release = 0.06, reverb = 0 } = {}) {
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
            let stopAt;
            if (decay) {
                stopAt = ring ? t + ring : end + 0.25;
                g.gain.exponentialRampToValueAtTime(0.0001, stopAt);
            } else {
                g.gain.setValueAtTime(gain, Math.max(t + attack, end - 0.08));
                g.gain.exponentialRampToValueAtTime(0.0001, end + release);
                stopAt = end + release;
            }
            if (reverb && !raw) {
                const send = ctx.createGain();
                send.gain.value = reverb;
                g.connect(send).connect(this.reverbIn());
            }
            osc.connect(g).connect(raw ? ctx.destination : this.out);
            osc.start(t);
            osc.stop(stopAt + 0.3);
        },
        /** Baixa e decodifica o arquivo de uma opção de som (uma vez só). */
        load(name) {
            const opt = SOUNDS[name];
            const ctx = this.ensure();
            if (!ctx || opt?.type !== "sample" || this.buffers[opt.file]) return;
            this.buffers[opt.file] = fetch(opt.file)
                .then((r) => r.arrayBuffer())
                .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
                .then((buffer) => (this.buffers[opt.file] = buffer))
                .catch(() => delete this.buffers[opt.file]); // tenta de novo na próxima vez
        },
        /** Toca um arquivo na frequência pedida (muda a velocidade de reprodução). */
        sample(opt, freq, seconds) {
            const ctx = this.ensure();
            const buffer = this.buffers[opt.file];
            if (!ctx || !this.enabled || !(buffer instanceof AudioBuffer)) return false;
            const t = ctx.currentTime;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = freq / opt.base;
            const g = ctx.createGain();
            g.gain.value = 0.55;
            src.connect(g).connect(this.out);
            src.start(t);
            if (!opt.ring) {
                // Tom contínuo: corta suavemente quando a luz apaga.
                const end = t + Math.max(0.12, seconds);
                g.gain.setValueAtTime(0.55, end - 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
                src.stop(end + 0.06);
            }
            return true;
        },
        /** Som de um botão na opção escolhida. */
        pad(freq, seconds) {
            const opt = SOUNDS[this.timbre] || SOUNDS.suave;
            if (opt.type === "sample") {
                if (this.sample(opt, freq, seconds)) return;
                this.load(this.timbre);
                return this.synth(SOUNDS.suave, freq, seconds); // enquanto o arquivo carrega
            }
            this.synth(opt, freq, seconds);
        },
        synth(tb, freq, seconds) {
            tb.partials.forEach(([mult, vol, wave = tb.wave]) =>
                this.tone(freq * mult, seconds, {
                    wave, gain: 0.13 * vol * (tb.gain ?? 1), attack: tb.attack, decay: tb.decay, raw: tb.raw,
                    // Harmônicos agudos somem antes (como numa corda de piano).
                    ring: tb.ring ? tb.ring / Math.sqrt(mult) : 0,
                    release: tb.release, reverb: tb.reverb,
                }));
        },
        /** Notas em sequência no som escolhido (o mesmo dos botões). */
        melody(freqs, stepMs, noteSeconds) {
            freqs.forEach((freq, i) => setTimeout(() => this.pad(freq, noteSeconds), i * stepMs));
        },
        /** Errou: duas notas subindo, no som dos botões — "vamos de novo!", sem susto. */
        error() { this.melody([392, 523.25], 150, 0.16); },
        timeout() { this.error(); },
        /** Fim de partida: arpejo alegre subindo, como quem diz "boa tentativa!". */
        gameOver() { this.melody([261.63, 329.63, 392, 523.25], 140, 0.18); },
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

    /** Nome mostrado do botão: nome (Dó) ou letra (C), com bemol (Ré♭/D♭) ou sustenido (Dó♯/C♯), conforme a escolha. */
    const noteName = (pad) => {
        const flat = prefs.accidental === "bemol";
        if (prefs.names === "letra" && pad.letter) return (flat && pad.flatLetter) || pad.letter;
        return (flat && pad.flat) || pad.short || pad.name;
    };

    const label = (pad, x, y, size) => {
        const ink = pad.sharp ? "#fff" : inkFor(pad.color); // tecla preta: letra branca
        return `<text class="pad-label" x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${ink}">${noteName(pad)}</text>`;
    };

    /**
     * Retângulo com cantos de cima (rTop) e de baixo (rBottom) arredondados
     * separadamente — formato das teclas.
     */
    const keyPath = (x, y, w, h, rTop, rBottom) => [
        `M${f(x + rTop)} ${f(y)}`,
        `H${f(x + w - rTop)}`, `Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + rTop)}`,
        `V${f(y + h - rBottom)}`, `Q${f(x + w)} ${f(y + h)} ${f(x + w - rBottom)} ${f(y + h)}`,
        `H${f(x + rBottom)}`, `Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - rBottom)}`,
        `V${f(y + rTop)}`, `Q${f(x)} ${f(y)} ${f(x + rTop)} ${f(y)}`, "Z",
    ].join("");

    // =================================================================
    // Modelos do aparelho (o modo escolhe pelo campo "look" de modes.js).
    // Cada um devolve:
    //   viewBox  área do desenho
    //   body     SVG do corpo (por baixo dos botões)
    //   over     SVG decorativo por cima dos botões (opcional, sem clique)
    //   hub      { x, y, r } do cubo com o visor e o JOGAR
    //   pads[i]  { shape, label }: shape é o elemento SVG sem fechar (ex.:
    //            'path d="…"'), usado tanto para a cor quanto para o vidro.
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
            const R = 97;
            return {
                viewBox: "-100 -100 200 200",
                body: `<circle class="body" r="${R}"/><circle class="body-well" r="${R - 6}"/>`,
                hub: { x: 0, y: 0, r: hubR },
                pads,
            };
        },

        // Teclado colorido: uma tecla por nota, pontas arredondadas e relevo
        // como os botões do disco. Notas "sharp" viram teclas pretas que tocam
        // (e acendem na cor da mistura das vizinhas). Sem elas, as teclas
        // pretas são só enfeite (o toque passa para a tecla colorida de baixo).
        teclado(mode) {
            const whites = mode.pads.filter((p) => !p.sharp).length;
            const hasSharps = whites < mode.pads.length;
            // Até 7 brancas: teclas de 27; com 2 oitavas (14 brancas) ficam mais finas e o corpo alarga.
            const keyW = whites > 7 ? 23 : 27, gap = keyW * 0.096, bw = keyW * 0.56, bh = 47;
            const keysW = whites * keyW;
            const W = Math.max(210, keysW + 32);
            const k = keyW / 27; // escala dos rótulos
            const x0 = -keysW / 2;
            const top = -20, keyH = 80;
            let white = 0;
            const pads = mode.pads.map((pad) => {
                if (pad.sharp) {
                    const cx = x0 + white * keyW; // entre a tecla anterior e a próxima
                    const shape = `path d="${keyPath(cx - bw / 2, top - 1, bw, bh, 1.5, 4)}"`;
                    return { shape, label: mode.labels ? label(pad, cx, top + bh - 7, (noteName(pad).length > 3 ? 4.6 : 5.4) * k) : "" };
                }
                const x = x0 + white++ * keyW + gap / 2;
                const w = keyW - gap;
                const shape = `path d="${keyPath(x, top, w, keyH, 2.5, 8)}"`;
                return { shape, label: mode.labels ? label(pad, x + w / 2, top + keyH - 11, 8.5 * k) : "" };
            });
            // Teclas pretas de enfeite entre dó-ré, ré-mi, fá-sol, sol-lá e lá-si (como no piano).
            const blacks = hasSharps ? "" : [0, 1, 3, 4, 5].filter((i) => i < whites - 1).map((i) => {
                const cx = x0 + (i + 1) * keyW;
                return `<path class="black-key" d="${keyPath(cx - bw / 2, top - 1, bw, bh, 1.5, 4)}"/>` +
                    `<path class="black-key-shine" d="${keyPath(cx - bw / 2 + 2.4, top + 1, bw - 4.8, bh - 9, 1, 3)}"/>`;
            }).join("");
            const bodyTop = -64, bodyH = 132;
            // Furinhos de alto-falante dos dois lados do visor.
            const grill = (cx) => [0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) =>
                `<circle class="grill" cx="${cx - 12 + c * 6}" cy="${-49 + r * 6}" r="1.4"/>`).join("")).join("");
            return {
                viewBox: `${-W / 2 - 4} ${bodyTop - 4} ${W + 8} ${bodyH + 8}`,
                body: `<rect class="body" x="${-W / 2}" y="${bodyTop}" width="${W}" height="${bodyH}" rx="16"/>` +
                    `<rect class="body-well" x="${x0 - 4}" y="${top - 4}" width="${keysW + 8}" height="${keyH + 8}" rx="9"/>` +
                    grill(-W / 2 + 43) + grill(W / 2 - 43),
                over: blacks,
                hub: { x: 0, y: -45, r: 18 },
                pads,
            };
        },
    };

    /** Gradientes do aparelho: corpo preto brilhante, botões de vidro colorido. */
    const defsSvg = () => {
        const padGrads = mode.pads.map((pad, i) => pad.sharp ? `
            <linearGradient id="pb${i}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#34343d"/>
                <stop offset=".8" stop-color="#16161c"/>
                <stop offset="1" stop-color="#060608"/>
            </linearGradient>
            <radialGradient id="pl${i}" cx=".5" cy=".55" r=".8">
                <stop offset="0" stop-color="${shade(pad.color, 0.7)}"/>
                <stop offset=".5" stop-color="${shade(pad.color, 0.2)}"/>
                <stop offset="1" stop-color="${shade(pad.color, -0.25)}"/>
            </radialGradient>` : `
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
            <!-- Relevo dos botões: claro em cima, sombra embaixo (luz vindo de cima). -->
            <linearGradient id="g-shade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
                <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
                <stop offset=".7" stop-color="#000" stop-opacity="0"/>
                <stop offset="1" stop-color="#000" stop-opacity=".38"/>
            </linearGradient>
            <!-- Borda chanfrada: aresta clara em cima, escura embaixo. -->
            <linearGradient id="g-bevel" x1="0" y1="0" x2=".25" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity=".85"/>
                <stop offset=".4" stop-color="#fff" stop-opacity=".18"/>
                <stop offset=".6" stop-color="#000" stop-opacity=".08"/>
                <stop offset="1" stop-color="#000" stop-opacity=".55"/>
            </linearGradient>
            <linearGradient id="g-black" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2b2b33"/>
                <stop offset=".85" stop-color="#121217"/>
                <stop offset="1" stop-color="#050507"/>
            </linearGradient>
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
        mode: $("mode"), fieldMode: $("field-mode"), play: $("play"), accidental: $("accidental"), fieldAccidental: $("field-accidental"), names: $("names"), fieldNames: $("field-names"), legend: $("legend"), legendRows: $("legend-rows"), timbre: $("timbre"), level: $("level"), strict: $("strict"), goal: $("goal"),
        device: $("device"), status: $("status"), progress: $("progress"),
        btnStart: $("btn-start"), btnReplay: $("btn-replay"), btnPause: $("btn-pause"), btnSound: $("btn-sound"),
        scoreNow: $("score-now"), scoreBest: $("score-best"), recordInfo: $("record-info"),
        keys: $("keys"), confetti: $("confetti"),
        staffOpt: $("staff-opt"), fieldStaff: $("field-staff"), staffBox: $("staff-box"), staffFigure: $("staff-figure"), btnStaffClear: $("btn-staff-clear"),
    };
    const staff = window.SigaDinoStaff.createStaff($("staff"));

    const enabledModes = Object.entries(MODES).filter(([, m]) => m.enabled);
    ui.mode.innerHTML = enabledModes.map(([id, m]) => `<option value="${id}">${m.title}</option>`).join("");
    ui.fieldMode.hidden = enabledModes.length < 2; // só aparece quando houver mais de um conjunto

    const DEFAULTS = { v: 2, mode: "cores4", play: "memoria", accidental: "sustenido", timbre: "suave", level: "normal", strict: "0", goal: "20", staff: "1", names: "nome", legend: true };
    const saved = storage.get(PREFS_KEY) || {};
    // Versão 2: "Ouvir de novo" passou a ser o padrão (ajuda as crianças) e o modelo flor saiu.
    if (saved.v !== 2) delete saved.strict;
    delete saved.look; // o desenho agora vem do modo (campo "look" em modes.js)
    const prefs = Object.assign({}, DEFAULTS, saved, { v: 2 });
    if (!MODES[prefs.mode]?.enabled) prefs.mode = enabledModes[0][0];
    const records = storage.get(RECORDS_KEY) || {};

    /** Modo desenhado: no "Tocar livre" o teclado de 7 notas ganha as teclas pretas (freeMode). */
    const pickMode = () => {
        const chosen = MODES[prefs.mode];
        if (prefs.play === "musica") return MODES.teclado24; // a música precisa das 2 oitavas e das pretas
        return (prefs.play === "livre" && MODES[chosen.freeMode]) || chosen;
    };
    let mode = pickMode();
    let padEls = [];       // <g> de cada botão
    let hub = null;        // elementos do cubo central
    let game = null;       // partida (engine)
    let phase = "idle";    // idle | show | input | wait | paused | over | free (tocar livre)
    let run = 0;           // muda a cada nova partida/parada para cancelar o playback em andamento
    let answerTimer = 0;
    let lastFreeAt = 0;    // hora do último toque no tocar livre (define a figura da nota)
    let lastChordAt = 0;   // hora do início do último acorde (ou nota sozinha)
    let chordStart = 0;
    let freeFigure = "semibreve";
    const CHORD_MS = 40;   // só toques quase no mesmo instante contam como simultâneos
    const held = new Set(); // dedos/teclas apertados agora ("p" + pointerId, "k" + tecla)
    let lastSource = "";    // quem fez o último toque no tocar livre

    /** "Tocar livre": sem sequência nem placar, só tocar. */
    const isFree = () => prefs.play !== "memoria";
    /** "Executar música (notas)": toca o código de notas do editor (é um tocar livre com partitura). */
    const isMusic = () => prefs.play === "musica";
    const recordKey = () => `${prefs.mode}:${prefs.level}`;
    const levelName = () => ui.level.options[ui.level.selectedIndex]?.text || "";

    // ---------- Desenho ----------
    const build = () => {
        const lookName = LOOKS[mode.look] ? mode.look : "anel";
        const look = LOOKS[lookName](mode);
        const pads = look.pads.map(({ shape, label: text }, i) => {
            const pad = mode.pads[i];
            const style = `--base:url(#pb${i});--lit:url(#pl${i});--glow:${pad.color}`;
            return `<g class="pad${pad.sharp ? " sharp" : ""}" data-i="${i}" style="${style}" role="button" tabindex="-1" aria-label="${noteName(pad)}">
                <clipPath id="cp${i}"><${shape}/></clipPath>
                <${shape} class="face"/>
                <${shape} class="shade"/>
                <${shape} class="bevel" clip-path="url(#cp${i})"/>
                <${shape} class="gloss"/>${text}</g>`;
        });
        // Teclas pretas (sharp) por último, para ficarem por cima das coloridas.
        const drawn = [...pads.filter((_, i) => !mode.pads[i].sharp), ...pads.filter((_, i) => mode.pads[i].sharp)].join("");
        const r = look.hub.r;
        ui.device.dataset.look = lookName;
        ui.device.setAttribute("viewBox", look.viewBox);
        const [, , vw, vh] = look.viewBox.split(" ").map(Number);
        document.body.style.setProperty("--ar", String(vw / vh)); // proporção do aparelho (o CSS usa para caber na tela)
        ui.device.innerHTML = `
            ${defsSvg()}
            ${look.body}
            <g class="pads">${drawn}</g>
            ${look.over ? `<g class="over" aria-hidden="true">${look.over}</g>` : ""}
            <g class="hub" id="hub" role="button" tabindex="0" aria-label="Jogar" transform="translate(${look.hub.x} ${look.hub.y})">
                <circle class="hub-disc" r="${r}"/>
                <ellipse class="hub-shine" cy="${-r * 0.74}" rx="${r * 0.42}" ry="${r * 0.13}"/>
                <rect class="hub-screen" x="${-r * 0.62}" y="${-r * 0.5}" width="${r * 1.24}" height="${r * 0.62}" rx="4"/>
                <text class="hub-count" id="hub-count" y="${-r * 0.19 + 0.5}" font-size="${r * 0.48}">--</text>
                <text class="hub-text" id="hub-text" y="${r * 0.52}" font-size="${r * 0.24}">JOGAR</text>
            </g>`;
        padEls = [];
        ui.device.querySelectorAll(".pad").forEach((el) => { padEls[Number(el.dataset.i)] = el; });
        hub = { el: $("hub"), count: $("hub-count"), text: $("hub-text"), size: r * 0.48 };
        ui.fieldAccidental.hidden = !mode.pads.some((p) => p.flat);
        ui.fieldNames.hidden = !mode.pads.some((p) => p.letter);
        ui.legend.hidden = mode.look !== "teclado";
        setupStaff();
        hub.el.addEventListener("click", hubAction);
        hub.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hubAction(); } });
        if (phase === "paused") setHubText("PAUSA");
        if (game) setCount(game.won ? "★★" : phase === "over" ? two(game.score) : two(game.length));
        renderKeys();
        renderScore();
        setInputEnabled(phase === "input" || phase === "free");
        if (phase === "free") { setCount("♪"); setHubText(isMusic() ? "MÚSICA" : "LIVRE"); }
    };

    // ---------- Pentagrama (só nos modelos de teclado) ----------
    const staffOn = () => mode.look === "teclado" && prefs.staff !== "0"; // "1" cor com nome, "3" só cor, "2" só preto
    const STAFF_LOOKS = { 1: "nome", 2: "preto", 3: "cor" };

    const setFigure = (name) => {
        const fig = window.SigaDinoStaff.FIGURES[name];
        if (isMusic()) { ui.staffFigure.textContent = `Figura: ${fig.title}`; return; }
        ui.staffFigure.textContent = isFree()
            ? `Figura: ${fig.title} — toque mais rápido para mudar`
            : `Figura: ${fig.title}${name === "semibreve" ? " (devagar)" : name === "seminima" ? " (rápido)" : ""}`;
    };

    /** Prepara o pentagrama e redesenha a sequência atual (troca de ♯/♭ no meio da partida). */
    const setupStaff = () => {
        const on = staffOn();
        ui.fieldStaff.hidden = mode.look !== "teclado";
        ui.staffBox.hidden = !on;
        document.body.classList.toggle("with-staff", on);
        staff.setMode(mode, noteName, prefs.accidental === "bemol", STAFF_LOOKS[prefs.staff] || "nome",
            { lead: isMusic(), deep: isMusic() });
        if (isMusic()) { setFigure("seminima"); renderSong(); return; }
        const fig = staff.figureFor(E.timing(prefs.level, game?.length || 1).on);
        setFigure(isFree() ? "semibreve" : fig);
        if (!game || phase === "show" || phase === "wait") return;
        game.sequence.forEach((p) => staff.push(p, fig));
        if (game.won) staff.allDone();
        else if (phase === "input") for (let k = 0; k < game.step; k++) staff.done(k);
    };

    const renderKeys = () => {
        const list = mode.pads.map((p) => `${p.keys[0].toUpperCase()} ${noteName(p)}`).join(" · ");
        ui.keys.textContent = isFree()
            ? `Toque à vontade ou use o teclado: ${list} · M som`
            : `Toque nos botões ou use o teclado: ${list} · Enter joga · P pausa · R repete · Esc para · M som`;
    };

    const setInputEnabled = (on) => {
        ui.device.classList.toggle("can-play", on);
        ui.btnReplay.disabled = !on;
        updatePauseButton();
    };

    /** Pode pausar enquanto a partida está em andamento (mostrando, esperando ou na vez do jogador). */
    const canPause = () => ["show", "input", "wait"].includes(phase);

    const updatePauseButton = () => {
        const paused = phase === "paused";
        ui.btnPause.disabled = !paused && !canPause();
        ui.btnPause.textContent = paused ? "▶" : "⏸";
        ui.btnPause.title = paused ? "Continuar (P)" : "Pausar (P)";
        ui.btnPause.setAttribute("aria-label", paused ? "Continuar" : "Pausar");
        ui.btnPause.classList.toggle("is-play", paused);
        document.body.classList.toggle("paused", paused);
    };

    /** Texto do visor; scale < 1 diminui a letra (nomes de 4 letras, como SOL♯). */
    const setCount = (text, scale = 1) => {
        if (!hub) return;
        hub.count.textContent = text;
        hub.count.setAttribute("font-size", f(hub.size * scale));
    };
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
    /** Frequência do botão i: a do modo, ou a própria da opção de som (tones4). */
    const padFreq = (i) => {
        const tones = SOUNDS[prefs.timbre]?.tones4;
        return tones && mode.pads.length === 4 ? tones[i] : mode.pads[i].freq;
    };

    const light = (i, ms, freq = padFreq(i)) => {
        const el = padEls[i];
        if (!el) return;
        el.classList.add("lit");
        sound.pad(freq, ms / 1000);
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
        if (isFree()) return;
        sound.ensure();
        sound.load(prefs.timbre);
        stop();
        const id = run;
        game = E.createGame({ padCount: mode.pads.length, goal: Number(prefs.goal), strict: prefs.strict === "1" });
        ui.btnStart.textContent = "Recomeçar";
        hub.el.setAttribute("aria-label", "Recomeçar");
        setStatus("Preste atenção…");
        sound.start();
        nextRound(id, 650);
    };

    /** Pausa: cancela a sequência e o tempo de resposta; ao continuar, a sequência toca de novo. */
    const pause = () => {
        if (!canPause()) return;
        run++;
        clearAnswerTimer();
        phase = "paused";
        padEls.forEach((el) => el.classList.remove("lit"));
        setInputEnabled(false);
        setHubText("PAUSA");
        hub?.el.setAttribute("aria-label", "Continuar");
        setStatus("Jogo pausado. Toque em ▶ (ou no centro do aparelho) para continuar.", "soft");
    };

    const resume = async () => {
        if (phase !== "paused") return;
        sound.ensure();
        const id = run;
        phase = "wait";
        setHubText("PASSO");
        hub?.el.setAttribute("aria-label", "Recomeçar");
        setInputEnabled(false);
        setStatus("Continuando… preste atenção!");
        await sleep(600);
        if (id !== run) return;
        playback(id);
    };

    const togglePause = () => (phase === "paused" ? resume() : pause());

    /** Centro do aparelho: continua se estiver pausado; senão, joga/recomeça. */
    const hubAction = () => (phase === "paused" ? resume() : startGame());

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
        updatePauseButton();
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
        const figure = staff.figureFor(on);
        staff.clear();
        setFigure(figure);
        for (const i of game.sequence) {
            if (id !== run) return;
            light(i, on);
            staff.push(i, figure, on);
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

    const press = (i, source = "") => {
        sound.ensure();
        if (phase === "free") { playFree(i, source); return; }
        if (phase !== "input") return;
        const { on } = E.timing(prefs.level, game.length);
        const expected = game.expected();
        const at = game.step;
        const result = game.press(i);
        if (result === "retry" || result === "over") { miss(false, i, expected, at); return; }

        light(i, Math.min(on, 260));
        staff.light(at, Math.min(on, 260));
        staff.done(at);
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
    const miss = async (timedOut, pressed = -1, expected = game.expected(), at = game.step) => {
        const id = run;
        clearAnswerTimer();
        setInputEnabled(false);
        phase = "wait";
        if (timedOut) {
            game.press(-1); // registra o erro na partida
            if (game.strict) sound.gameOver(); else sound.timeout();
        } else {
            if (game.strict) sound.gameOver(); else sound.error();
            if (padEls[pressed]) padEls[pressed].classList.add("wrong");
            setTimeout(() => padEls[pressed]?.classList.remove("wrong"), 600);
        }
        if (!game.strict) {
            setStatus(timedOut
                ? "Sem pressa! Vamos ouvir de novo. 🎵"
                : pick(["Quase! Vamos ouvir de novo. 🎵", "Foi por pouco! Ouça mais uma vez.", "Tudo bem, acontece! Ouça de novo."]), "soft");
            await sleep(1100);
            if (id !== run) return;
            playback(id);
            return;
        }

        // Fim de jogo: mostra qual era o botão certo.
        phase = "over";
        updatePauseButton();
        const score = game.score;
        const best = saveRecord(score);
        const name = mode.pads[expected] ? noteName(mode.pads[expected]) : "";
        const opening = timedOut ? "O tempo acabou — boa tentativa!" : "Boa tentativa!";
        const result = score
            ? ` Você acertou ${score} ${score === 1 ? "passo" : "passos"}${best ? " — novo recorde! 🏆" : "."}`
            : "";
        setCount(two(score));
        setStatus(`${opening}${result} O próximo era ${name}. Vamos jogar de novo? 💪`, "soft");
        setHubText("JOGAR");
        hub.el.setAttribute("aria-label", "Jogar de novo");
        ui.btnStart.textContent = "Jogar de novo";
        renderScore();
        await sleep(700);
        for (let t = 0; t < 3 && id === run; t++) {
            padEls[expected]?.classList.add("lit");
            staff.light(at, 260);
            await sleep(260);
            padEls[expected]?.classList.remove("lit");
            await sleep(200);
        }
    };

    const win = async () => {
        const id = run;
        phase = "over";
        updatePauseButton();
        game.won = true;
        const best = saveRecord(game.length);
        setCount("★★");
        setHubText("VENCEU");
        setStatus(`Você venceu! Repetiu os ${game.length} passos${best ? " — novo recorde! 🏆" : "!"}`, "good");
        ui.btnStart.textContent = "Jogar de novo";
        hub.el.setAttribute("aria-label", "Jogar de novo");
        renderScore();
        renderProgress();
        staff.allDone();
        sound.win(mode.pads.map((p, i) => padFreq(i)));
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

    /** Tocar livre: acende e toca; no visor aparece a nota (se o nome for curto). */
    const playFree = (i, source = "") => {
        light(i, 420);
        if (staffOn() && !songPlaying()) {
            // A figura segue o ritmo de quem toca: devagar = semibreve, rápido = semínima.
            // Acorde só quando outra tecla/dedo bate quase junto com a anterior, que ainda está
            // apertada. Escala rápida ou glissando (o mesmo dedo arrastando) seguem nota a nota.
            const now = performance.now();
            const gapMs = lastFreeAt ? now - lastFreeAt : 2000;
            const chord = gapMs < CHORD_MS && now - chordStart < 120
                && source && lastSource && source !== lastSource && held.has(lastSource);
            lastSource = source;
            if (!chord) {
                chordStart = now;
                // A figura sai do intervalo entre um toque (ou acorde) e o próximo.
                const sinceChord = lastChordAt ? now - lastChordAt : 2000;
                freeFigure = sinceChord > 900 ? "semibreve" : sinceChord > 450 ? "minima" : "seminima";
                lastChordAt = now;
                setFigure(freeFigure);
            }
            lastFreeAt = now;
            staff.done(staff.push(i, freeFigure, 420, chord));
        }
        const pad = mode.pads[i];
        const text = noteName(pad);
        setCount(text.length <= 4 ? text.toUpperCase() : "♪", text.length > 3 ? 0.78 : 1);
    };

    // =================================================================
    // Executar música (notas): editor + leitura do código + tocar
    // =================================================================
    const MUSIC = window.SigaDinoMusic;
    const SONG_KEY = "dinogames-sigadino-song";
    const mu = {
        text: $("song-text"), name: $("song-name"), tempo: $("song-tempo"), example: $("song-example"),
        open: $("btn-song-open"), save: $("btn-song-save"), saveAs: $("btn-song-saveas"),
        play: $("btn-song-play"), clear: $("btn-song-clear"), file: $("song-file"), info: $("song-info"),
    };
    const savedSong = storage.get(SONG_KEY);
    const song = {
        name: savedSong?.name || MUSIC.EXAMPLES[0].file,
        handle: null,          // arquivo aberto (quando o navegador deixa salvar por cima)
        dirty: false,          // mudou desde que abriu/salvou
        textTempo: 0,          // andamento escrito no texto (para saber se o usuário mudou)
    };
    let songEvents = [];       // eventos lidos (para redesenhar o pentagrama)
    let songRun = 0;           // muda para cancelar a música tocando
    let songAt = -1;           // evento tocando agora (-1 = parada)
    const songPlaying = () => songAt >= 0;

    /** Semitons a partir do Dó central de cada tecla (pela frequência). */
    const semiOf = (pad) => Math.round(12 * Math.log2(pad.freq / 261.63));
    /** Tecla que toca a nota; fora do teclado, a mesma nota na oitava mais perto. */
    const padForSemi = (semi) => {
        let best = -1, dist = Infinity;
        mode.pads.forEach((p, i) => {
            const s = semiOf(p);
            if (s === semi) { best = i; dist = -1; }
            else if (dist >= 0 && (((s - semi) % 12) + 12) % 12 === 0 && Math.abs(s - semi) < dist) { best = i; dist = Math.abs(s - semi); }
        });
        return best;
    };
    const freqOfSemi = (semi) => +(261.63 * Math.pow(2, semi / 12)).toFixed(2);
    const countText = (n) => `${n} ${n === 1 ? "nota/pausa lida" : "notas/pausas lidas"}.`;

    /** Desenha a música inteira na pauta (as já tocadas ficam fortes). */
    const renderSong = () => {
        if (!isMusic()) return;
        staff.clear();
        songEvents.forEach((ev, k) => {
            if (ev.kind === "rest") staff.pushRest(ev.figure, { scroll: false, dotted: ev.dotted });
            else ev.notes.forEach((n, j) => {
                const index = padForSemi(n.semi);
                if (index >= 0) staff.push({ index, step: n.step, acc: n.acc }, ev.figure, 0, j > 0, { scroll: false, dotted: ev.dotted });
            });
            if (k < songAt) staff.done(k);
        });
    };

    const updatePlayButton = () => {
        mu.play.textContent = songPlaying() ? "⏹ Parar" : "▶ Tocar";
        mu.play.classList.toggle("primary", !songPlaying());
        mu.play.title = songPlaying() ? "Parar a música" : "Tocar a música do editor";
    };

    const stopSong = () => {
        songRun++;
        if (songAt >= 0) padEls.forEach((el) => el.classList.remove("lit"));
        songAt = -1;
        updatePlayButton();
    };

    const describe = (ev) => {
        const fig = window.SigaDinoStaff.FIGURES[ev.figure]?.title.toLowerCase() || "";
        if (ev.kind === "rest") return `pausa de ${fig}`;
        return `${ev.notes.map((n) => n.label).join(" + ")} (${fig}${ev.dotted ? " pontuada" : ""})`;
    };

    /** Lê o editor, desenha a pauta e toca nota por nota (teclas e pentagrama acendem). */
    const playSong = async () => {
        stopSong();
        sound.ensure();
        sound.load(prefs.timbre);
        const { events, tempo, warnings } = MUSIC.parse(mu.text.value);
        if (tempo && tempo !== song.textTempo) { mu.tempo.value = tempo; song.textTempo = tempo; }
        songEvents = events;
        if (!events.length) {
            renderSong();
            setStatus("Não achei notas no editor. Exemplo: E[n1/4]; F[n1/4]; G[n1/2]; — veja a Ajuda.", "soft");
            return;
        }
        const id = songRun;
        songAt = 0;
        updatePlayButton();
        renderSong();
        const bpm = Math.min(240, Math.max(30, Number(mu.tempo.value) || 80));
        const quarter = 60000 / bpm;
        const outside = events.some((ev) => ev.kind === "note" && ev.notes.some((n) => {
            const p = mode.pads[padForSemi(n.semi)];
            return p && semiOf(p) !== n.semi;
        }));
        mu.info.textContent = [
            countText(events.length),
            warnings.length ? `Aviso: ${warnings.slice(0, 3).join("; ")}${warnings.length > 3 ? "…" : ""}.` : "",
            outside ? "Notas fora do teclado acendem a mesma nota em outra oitava." : "",
        ].filter(Boolean).join(" ");
        await sleep(250);
        for (let k = 0; k < events.length; k++) {
            if (id !== songRun) return;
            songAt = k;
            const ev = events[k];
            const ms = ev.frac * 4 * quarter;          // semibreve = 4 semínimas
            const on = Math.max(60, ms * 0.9);          // um respiro entre as notas
            if (ev.kind === "note") ev.notes.forEach((n) => {
                const i = padForSemi(n.semi);
                if (i >= 0) light(i, on, freqOfSemi(n.semi));
            });
            staff.light(k, on);
            staff.done(k);
            setFigure(ev.figure);
            setStatus(`🎵 Tocando ${k + 1} de ${events.length}: ${describe(ev)}`, "turn");
            const label = ev.kind === "rest" ? "--" : ev.notes[0].label;
            setCount(label.length <= 4 ? label : "♪", label.length > 3 ? 0.78 : 1);
            await sleep(ms);
        }
        if (id !== songRun) return;
        songAt = -1;
        updatePlayButton();
        setCount("♪");
        setStatus("Fim da música! 🎉 Toque em ▶ Tocar para ouvir de novo.", "good");
    };

    // ---------- Arquivo: abrir, salvar, salvar como ----------
    const rememberSong = () => storage.set(SONG_KEY, { text: mu.text.value, name: song.name });
    const showName = () => { mu.name.textContent = `${song.name}${song.dirty ? " •" : ""}`; };
    const setSongText = (text, name, handle = null) => {
        stopSong();
        mu.text.value = text;
        song.name = name;
        song.handle = handle;
        song.dirty = false;
        const { events, tempo } = MUSIC.parse(text);
        if (tempo) { mu.tempo.value = tempo; song.textTempo = tempo; }
        songEvents = events;
        renderSong();
        mu.info.textContent = countText(events.length);
        showName();
        rememberSong();
    };
    /** Confirma antes de trocar um texto que mudou e não foi salvo. */
    const okToReplace = () => !song.dirty || window.confirm("O texto foi alterado e não foi salvo. Continuar mesmo assim?");

    const TXT = { description: "Texto com notas", accept: { "text/plain": [".txt"] } };
    const openSong = async () => {
        if (!okToReplace()) return;
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({ types: [TXT] });
                const file = await handle.getFile();
                setSongText(await file.text(), file.name, handle);
                setStatus(`Arquivo “${file.name}” aberto. Toque em ▶ Tocar. 🎼`, "turn");
            } catch { /* cancelado */ }
            return;
        }
        mu.file.value = "";
        mu.file.click();
    };
    mu.file.addEventListener("change", async () => {
        const file = mu.file.files[0];
        if (!file) return;
        setSongText(await file.text(), file.name);
        setStatus(`Arquivo “${file.name}” aberto. Toque em ▶ Tocar. 🎼`, "turn");
    });

    const writeTo = async (handle) => {
        const w = await handle.createWritable();
        await w.write(mu.text.value);
        await w.close();
    };
    const savedOk = () => {
        song.dirty = false;
        showName();
        rememberSong();
        setStatus(`Música salva em “${song.name}”. 💾`, "good");
    };
    const saveSongAs = async () => {
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName: song.name, types: [TXT] });
                await writeTo(handle);
                song.handle = handle;
                song.name = handle.name;
                savedOk();
            } catch { /* cancelado */ }
            return;
        }
        // Sem acesso a arquivos (celular): baixa o .txt com o nome escolhido.
        let name = window.prompt("Nome do arquivo:", song.name);
        if (!name) return;
        if (!/\.txt$/i.test(name)) name += ".txt";
        const url = URL.createObjectURL(new Blob([mu.text.value], { type: "text/plain;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        song.name = name;
        savedOk();
    };
    const saveSong = async () => {
        if (!song.handle?.createWritable) return saveSongAs();
        try { await writeTo(song.handle); savedOk(); }
        catch { saveSongAs(); }
    };

    mu.example.innerHTML = `<option value="">Exemplos…</option>` +
        MUSIC.EXAMPLES.map((e) => `<option value="${e.id}">${e.title}</option>`).join("");
    mu.example.addEventListener("change", () => {
        const ex = MUSIC.EXAMPLES.find((e) => e.id === mu.example.value);
        mu.example.value = "";
        if (ex && okToReplace()) {
            setSongText(ex.text, ex.file);
            setStatus(`Exemplo “${ex.title}” carregado. Toque em ▶ Tocar. 🎼`, "turn");
        }
    });

    let typing = 0;
    mu.text.addEventListener("input", () => {
        song.dirty = true;
        showName();
        clearTimeout(typing);
        // Enquanto escreve, a pauta acompanha (sem tocar).
        typing = setTimeout(() => {
            rememberSong();
            if (songPlaying()) return;
            const { events } = MUSIC.parse(mu.text.value);
            songEvents = events;
            renderSong();
            mu.info.textContent = countText(events.length);
        }, 400);
    });
    mu.open.addEventListener("click", openSong);
    mu.save.addEventListener("click", saveSong);
    mu.saveAs.addEventListener("click", saveSongAs);
    mu.play.addEventListener("click", () => {
        if (!songPlaying()) { playSong(); return; }
        stopSong();
        setStatus("Música parada. Toque em ▶ Tocar para começar de novo.", "soft");
    });
    mu.clear.addEventListener("click", () => {
        if (mu.text.value.trim() && !window.confirm("Apagar todo o texto do editor?")) return;
        setSongText("", "nova-musica.txt");
        setStatus("Editor limpo. Escreva as notas, por exemplo: C[n1/4]; D[n1/4]; E[n1/2];", "turn");
    });
    // Ctrl+S salva; Ctrl+Shift+S salva como.
    mu.text.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (e.shiftKey) saveSongAs(); else saveSong();
        }
    });

    // Texto inicial: o último que estava no editor, ou a Ode à Alegria.
    mu.text.value = savedSong?.text ?? MUSIC.EXAMPLES[0].text;
    {
        const { events, tempo } = MUSIC.parse(mu.text.value);
        songEvents = events;
        if (tempo) { mu.tempo.value = tempo; song.textTempo = tempo; }
        mu.info.textContent = countText(events.length);
    }
    showName();
    updatePlayButton();

    const resetIdle = (message) => {
        stop();
        stopSong();
        document.body.classList.toggle("music-play", isMusic());
        game = null;
        lastFreeAt = 0;
        lastChordAt = 0;
        setupStaff();
        document.body.classList.toggle("free-play", isFree());
        renderKeys();
        if (isFree()) {
            phase = "free";
            setInputEnabled(true);
            setCount("♪");
            setHubText(isMusic() ? "MÚSICA" : "LIVRE");
            renderProgress();
            const what = mode.look === "teclado" ? "as teclas" : "os botões";
            if (isMusic()) setStatus(message || "Executar música: escreva as notas (ou abra um arquivo) e toque em ▶ Tocar. 🎼", "turn");
            else setStatus(`Tocar livre: toque ${what} e invente a sua música! 🎶`, "turn");
            return;
        }
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
    // Arrastar o dedo (ou o mouse apertado) sobre as teclas toca cada uma por onde passa,
    // como uma escala (glissando). Guarda a última tecla de cada dedo.
    const sliding = new Map(); // pointerId → índice da última tecla
    const padAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(".pad");
    ui.device.addEventListener("pointerdown", (event) => {
        const el = event.target.closest(".pad");
        if (!el) return;
        event.preventDefault();
        // No toque o navegador prende o dedo na 1ª tecla; solta para saber onde ele passa.
        if (ui.device.hasPointerCapture?.(event.pointerId)) ui.device.releasePointerCapture(event.pointerId);
        event.target.releasePointerCapture?.(event.pointerId);
        const i = Number(el.dataset.i);
        if (mode.look === "teclado") sliding.set(event.pointerId, i); // glissando só no teclado
        held.add("p" + event.pointerId);
        press(i, "p" + event.pointerId);
    });
    window.addEventListener("pointermove", (event) => {
        if (!sliding.has(event.pointerId)) return;
        const el = padAt(event.clientX, event.clientY);
        if (!el || !ui.device.contains(el)) { sliding.set(event.pointerId, -1); return; }
        const i = Number(el.dataset.i);
        if (i === sliding.get(event.pointerId)) return;
        sliding.set(event.pointerId, i);
        press(i, "g" + event.pointerId); // glissando: nunca forma acorde
    });
    ["pointerup", "pointercancel"].forEach((type) =>
        window.addEventListener(type, (event) => {
            sliding.delete(event.pointerId);
            held.delete("p" + event.pointerId);
        }));
    window.addEventListener("keyup", (event) => held.delete("k" + event.key.toLowerCase()));
    window.addEventListener("blur", () => held.clear());

    ui.btnStart.addEventListener("click", startGame);
    ui.btnStaffClear.addEventListener("click", () => {
        stopSong();
        songEvents = [];
        staff.clear();
        lastFreeAt = 0;
        lastChordAt = 0;
    });
    ui.btnPause.addEventListener("click", togglePause);

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
    bindSelect(ui.mode, "mode", () => { mode = pickMode(); resetIdle(); build(); });
    bindSelect(ui.play, "play", () => { mode = pickMode(); resetIdle(); build(); });
    bindSelect(ui.accidental, "accidental", () => build()); // só troca os nomes
    bindSelect(ui.staffOpt, "staff", () => build());
    bindSelect(ui.names, "names", () => build()); // nome (Dó) ou letra (C)

    // Legenda: Nota - Letra - Cor (aberta ou fechada fica salva).
    ui.legendRows.innerHTML = (window.SIGA_DINO_LEGEND || []).map((p) =>
        `<tr><td>${p.name}</td><td>${p.letter}</td><td><span class="swatch" style="--c:${p.color}"></span>${p.colorName}</td></tr>`).join("");
    ui.legend.open = prefs.legend !== false;
    ui.legend.addEventListener("toggle", () => { prefs.legend = ui.legend.open; storage.set(PREFS_KEY, prefs); });
    ui.timbre.innerHTML = Object.entries(SOUNDS).map(([id, o]) => `<option value="${id}">${o.title}</option>`).join("");
    bindSelect(ui.timbre, "timbre", async () => {
        sound.timbre = prefs.timbre;
        sound.load(prefs.timbre);
        await sound.buffers[SOUNDS[prefs.timbre].file]; // espera o arquivo para tocar a amostra já certa
        sound.pad(padFreq(0), 0.35); // amostra do som escolhido
    });
    sound.timbre = prefs.timbre;
    // Arquivos de som só carregam depois do primeiro toque (regra dos navegadores para áudio).
    window.addEventListener("pointerdown", () => sound.load(prefs.timbre), { once: true });
    window.addEventListener("keydown", () => sound.load(prefs.timbre), { once: true });
    ui.btnReplay.addEventListener("click", replay);
    bindSelect(ui.level, "level", () => restartIfPlaying("Velocidade alterada. Toque em Jogar para começar."));
    bindSelect(ui.strict, "strict", () => restartIfPlaying("Opção alterada. Toque em Jogar para começar."));
    bindSelect(ui.goal, "goal", () => restartIfPlaying("Objetivo alterado. Toque em Jogar para começar."));

    // Teclado: as teclas de cada botão vêm de modes.js.
    window.addEventListener("keydown", (event) => {
        if (event.target.closest?.("select, textarea, input") || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
        const k = event.key.toLowerCase();
        const padIndex = mode.pads.findIndex((p) => p.keys.includes(k));
        if (padIndex >= 0) {
            event.preventDefault();
            held.add("k" + k);
            press(padIndex, "k" + k);
            return;
        }
        if (k === "enter" || k === "n") {
            if (event.target.closest?.("button, [role=button]")) return; // o próprio botão já trata
            event.preventDefault();
            if (phase === "paused") resume(); else startGame();
        } else if (k === "escape") {
            if (game) resetIdle("Partida interrompida. Toque em Jogar para começar.");
        } else if (k === "r") replay();
        else if (k === "m") toggleSound();
        else if (k === "p") togglePause();
    });

    // Ao trocar de aba ou minimizar, a partida pausa (evita perder por tempo).
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pause();
    });

    updateSoundButton();
    build();
    if (isFree()) resetIdle();
})();
