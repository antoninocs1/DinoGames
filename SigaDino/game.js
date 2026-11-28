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
        // Folga (s) ao agendar cada nota: agendar exatamente em "agora" pode cair no passado
        // e cortar o começo da nota (principalmente a 1ª, com o áudio acabando de ligar).
        LEAD: 0.03,
        /**
         * Espera o áudio estar pronto antes de uma música: liga o AudioContext (resume é
         * assíncrono), espera o arquivo do som gravado carregar e, na 1ª vez, deixa a
         * saída de som "acordar" (alguns aparelhos perdem os primeiros milissegundos).
         */
        async ready() {
            const ctx = this.ensure();
            if (!ctx) return;
            const waking = ctx.state !== "running" || !this.warm;
            if (ctx.state !== "running") { try { await ctx.resume(); } catch { /* sem som */ } }
            const opt = SOUNDS[this.timbre];
            if (opt?.type === "sample") {
                this.load(this.timbre);
                try { await this.buffers[opt.file]; } catch { /* usa o som suave */ }
            }
            if (waking) {
                this.warm = true;
                this.tone(440, 0.05, { gain: 0.00001 }); // nota muda: liga a saída de som
                await new Promise((r) => setTimeout(r, 150));
            }
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
            const t = ctx.currentTime + delay + this.LEAD;
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
            const t = ctx.currentTime + this.LEAD;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = freq * Math.pow(2, opt.octave || 0) / opt.base;
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

    /**
     * Cores das teclas (opção "Teclas"): coloridas, ou preto e branco como um piano de
     * verdade (para quem já avançou). No preto e branco a tecla acende num azul claro.
     */
    const pianoKeys = () => mode.look === "teclado" && prefs.keys !== "cor";
    const keyColor = (pad) => (!pianoKeys() ? pad.color : pad.sharp ? "#202027" : "#f4f1e8");
    const litColor = (pad) => (!pianoKeys() ? pad.color : "#4aa8ff");
    /** Nome escrito na tecla: some no "preto e branco sem nomes". */
    const labelsOn = (m) => m.labels && !(m.look === "teclado" && prefs.keys === "pbsem");

    const label = (pad, x, y, size) => {
        const ink = pad.sharp ? "#fff" : inkFor(keyColor(pad)); // tecla preta: letra branca
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
                return { shape, label: labelsOn(mode) ? label(pad, lx, ly, n > 7 ? 7.5 : 10) : "" };
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
            // Piano (3 oitavas ou mais): teclas ainda mais finas.
            const keyW = whites > 28 ? 18 : whites > 14 ? 20 : whites > 7 ? 23 : 27, gap = keyW * 0.096, bw = keyW * 0.56, bh = 47;
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
                    return { shape, label: labelsOn(mode) ? label(pad, cx, top + bh - 7, (noteName(pad).length > 3 ? 4.6 : 5.4) * k) : "" };
                }
                const x = x0 + white++ * keyW + gap / 2;
                const w = keyW - gap;
                const shape = `path d="${keyPath(x, top, w, keyH, 2.5, 8)}"`;
                // Dó central: uma bolinha no pé da tecla, para achar o meio do piano.
                const mark = pad.center ? `<circle class="center-mark" cx="${f(x + w / 2)}" cy="${top + keyH - 4.5}" r="${f(1.8 * k)}"/>` : "";
                return { shape, label: (labelsOn(mode) ? label(pad, x + w / 2, top + keyH - 11, 8.5 * k) : "") + mark };
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
                <stop offset="0" stop-color="${shade(litColor(pad), 0.7)}"/>
                <stop offset=".5" stop-color="${shade(litColor(pad), 0.2)}"/>
                <stop offset="1" stop-color="${shade(litColor(pad), -0.25)}"/>
            </radialGradient>` : `
            <radialGradient id="pb${i}" cx=".5" cy=".42" r=".75">
                <stop offset="0" stop-color="${shade(keyColor(pad), 0.1)}"/>
                <stop offset=".7" stop-color="${shade(keyColor(pad), -0.08)}"/>
                <stop offset="1" stop-color="${shade(keyColor(pad), pianoKeys() ? -0.2 : -0.42)}"/>
            </radialGradient>
            <radialGradient id="pl${i}" cx=".5" cy=".45" r=".75">
                <stop offset="0" stop-color="${shade(litColor(pad), 0.8)}"/>
                <stop offset=".45" stop-color="${shade(litColor(pad), 0.35)}"/>
                <stop offset="1" stop-color="${shade(litColor(pad), -0.05)}"/>
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
        staffOpt: $("staff-opt"), fieldStaff: $("field-staff"), keysOpt: $("keys-opt"), fieldKeys: $("field-keys"), meterOpt: $("meter-opt"), fieldMeter: $("field-meter"), pautaOpt: $("pauta-opt"), fieldPauta: $("field-pauta"), tecladoOpt: $("teclado-opt"), fieldTeclado: $("field-teclado"), staffBox: $("staff-box"), staffFigure: $("staff-figure"), btnStaffClear: $("btn-staff-clear"),
    };
    const staff = window.SigaDinoStaff.createStaff($("staff"));
    const kb = { scroll: $("kb-scroll"), nav: $("kb-nav"), range: $("kb-range"), left: $("kb-left"), right: $("kb-right"), keyPx: 0 };

    const enabledModes = Object.entries(MODES).filter(([, m]) => m.enabled);
    ui.fieldMode.hidden = enabledModes.length < 2; // só aparece quando houver mais de um conjunto

    const DEFAULTS = { v: 2, mode: "cores4", play: "memoria", accidental: "sustenido", timbre: "suave", level: "normal", strict: "0", goal: "20", staff: "1", pauta: "auto", teclado: "auto", names: "nome", legend: true, keys: "cor", meter: "", practiceHand: "ambas", practiceHint: "1", speed: "1" };
    const saved = storage.get(PREFS_KEY) || {};
    // Versão 2: "Ouvir de novo" passou a ser o padrão (ajuda as crianças) e o modelo flor saiu.
    if (saved.v !== 2) delete saved.strict;
    delete saved.look; // o desenho agora vem do modo (campo "look" em modes.js)
    const prefs = Object.assign({}, DEFAULTS, saved, { v: 2 });
    if (!MODES[prefs.mode]?.enabled) prefs.mode = enabledModes[0][0];
    /**
     * Modelo valendo agora: o piano (freeOnly) só existe no Tocar livre e no Executar
     * música; no jogo de memória vira o teclado de 24 notas (a escolha fica guardada).
     */
    const modeId = () => (MODES[prefs.mode].freeOnly && prefs.play === "memoria" ? "teclado24" : prefs.mode);
    /** Lista do Modelo conforme o jogo (o piano some no "Siga a sequência"). */
    const renderModeOptions = () => {
        const list = enabledModes.filter(([, m]) => !m.freeOnly || prefs.play !== "memoria");
        ui.mode.innerHTML = list.map(([id, m]) => `<option value="${id}">${m.title}</option>`).join("");
        ui.mode.value = modeId();
    };
    renderModeOptions();
    const records = storage.get(RECORDS_KEY) || {};

    // Oitavas que a música do editor usa (0 = a do Dó central, 1 = a de cima, −1 = a de baixo…).
    let songOctaves = [0, 1];
    /**
     * Teclado do Executar música: 2 oitavas, piano de 5 oitavas ou (automático) as 2
     * oitavas do meio aumentadas para baixo e para cima até caber a música (de −3 a 3).
     */
    const musicMode = () => {
        if (prefs.teclado === "24") return MODES.teclado24;
        if (prefs.teclado === "60") return MODES.piano60;
        if (prefs.teclado === "36") return MODES.piano36;
        // Automático: parte do Modelo (2 oitavas, ou 5 com o Piano) e cresce até caber a música.
        const [lo0, hi0] = MODES[prefs.mode].freeOnly ? MODES[prefs.mode].octaves : [0, 1];
        const lo = Math.max(-3, Math.min(lo0, songOctaves[0])), hi = Math.min(3, Math.max(hi0, songOctaves[1]));
        if (lo === -2 && hi === 2) return MODES.piano60;
        if (lo === -1 && hi === 1) return MODES.piano36;
        return lo === 0 && hi === 1 ? MODES.teclado24 : window.SIGA_DINO_PIANO(lo, hi);
    };
    /** Modo desenhado: no "Tocar livre" o teclado de 7 notas ganha as teclas pretas (freeMode). */
    const pickMode = () => {
        const chosen = MODES[modeId()];
        if (prefs.play === "musica") return musicMode(); // a música precisa das oitavas dela e das pretas
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
    const recordKey = () => `${modeId()}:${prefs.level}`;
    const levelName = () => ui.level.options[ui.level.selectedIndex]?.text || "";

    // ---------- Desenho ----------
    const build = () => {
        const lookName = LOOKS[mode.look] ? mode.look : "anel";
        const look = LOOKS[lookName](mode);
        const pads = look.pads.map(({ shape, label: text }, i) => {
            const pad = mode.pads[i];
            const style = `--base:url(#pb${i});--lit:url(#pl${i});--glow:${litColor(pad)}`;
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
        ui.device.classList.toggle("piano-keys", pianoKeys());
        setupStaff();
        hub.el.addEventListener("click", hubAction);
        hub.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hubAction(); } });
        if (phase === "paused") setHubText("PAUSA");
        if (game) setCount(game.won ? "★★" : phase === "over" ? two(game.score) : two(game.length));
        renderKeys();
        renderScore();
        setInputEnabled(phase === "input" || phase === "free");
        if (phase === "free") { setCount("♪"); setHubText(isMusic() ? "MÚSICA" : "LIVRE"); }
        fitKeyboard(true);
        staff.refit(); // a pauta enche a caixa (mais notas à vista)
        renderOptsSummary();
    };

    // ---------- Celular: teclado com teclas largas, rolando para os lados ----------
    const MIN_KEY = 34; // largura mínima (px) da tecla branca no celular: cabe o dedo
    const phoneScreen = window.matchMedia("(max-width: 860px), (pointer: coarse)");
    // Celular deitado: falta altura, não largura — o piano inteiro continua cabendo na largura.
    const shortLandscape = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
    /** Liga a rolagem quando as teclas ficariam finas demais para o dedo (piano grande no celular). */
    const fitKeyboard = (center = false) => {
        const was = document.body.classList.contains("kb-wide");
        let wide = false, need = 0;
        if (mode.look === "teclado" && phoneScreen.matches && !shortLandscape.matches) {
            const whites = mode.pads.filter((p) => !p.sharp).length;
            const keyW = whites > 28 ? 18 : whites > 14 ? 20 : whites > 7 ? 23 : 27; // o mesmo de LOOKS.teclado
            const vw = Number(ui.device.getAttribute("viewBox").split(" ")[2]);
            const avail = kb.scroll.clientWidth;
            need = Math.ceil((vw * MIN_KEY) / keyW);
            wide = avail > 0 && need > avail + 2;
            kb.keyPx = wide ? MIN_KEY : (avail * keyW) / vw;
        }
        document.body.classList.toggle("kb-wide", wide);
        kb.nav.hidden = !wide;
        if (!wide) return;
        document.body.style.setProperty("--kbw", `${need}px`);
        syncKbRange();
        if (center || !was) {
            // Começa mostrando o Dó central (a bolinha) no meio.
            const i = Math.max(0, mode.pads.findIndex((p) => p.center || (!p.octave && p.letter === "C")));
            keepKeyVisible(i, true);
        }
    };
    const syncKbRange = () => {
        const max = Math.max(0, kb.scroll.scrollWidth - kb.scroll.clientWidth);
        kb.range.max = String(max);
        kb.range.value = String(kb.scroll.scrollLeft);
    };
    /** Rola o teclado para a tecla i ficar à vista (center: no meio). */
    const keepKeyVisible = (i, center = false) => {
        if (!document.body.classList.contains("kb-wide") || !padEls[i]) return;
        const r = padEls[i].getBoundingClientRect(), s = kb.scroll.getBoundingClientRect();
        const margin = 40;
        if (!center && r.left >= s.left + margin && r.right <= s.right - margin) return;
        const left = kb.scroll.scrollLeft + (r.left + r.width / 2) - (s.left + s.width / 2);
        kb.scroll.scrollTo({ left, behavior: center ? "auto" : "smooth" });
    };
    kb.scroll.addEventListener("scroll", () => { kb.range.value = String(kb.scroll.scrollLeft); }, { passive: true });
    kb.range.addEventListener("input", () => { kb.scroll.scrollLeft = Number(kb.range.value); });
    const octavePx = () => kb.keyPx * 7 || 200;
    kb.left.addEventListener("click", () => kb.scroll.scrollBy({ left: -octavePx(), behavior: "smooth" }));
    kb.right.addEventListener("click", () => kb.scroll.scrollBy({ left: octavePx(), behavior: "smooth" }));
    let fitTimer = 0;
    window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { fitKeyboard(false); staff.refit(); }, 150); });

    // ---------- Celular em pé: opções recolhidas em "⚙ Opções" ----------
    const optsBtn = $("btn-opts");
    const renderOptsSummary = () => {
        const sel = (el) => (el && !el.closest("[hidden]") ? el.options[el.selectedIndex]?.text : "");
        $("opts-sum").textContent = [sel(ui.play), sel(ui.mode)].filter(Boolean).join(" · ");
    };
    optsBtn.addEventListener("click", () => {
        const open = !document.body.classList.contains("opts-open");
        document.body.classList.toggle("opts-open", open);
        optsBtn.setAttribute("aria-expanded", String(open));
        if (!open) setTimeout(() => fitKeyboard(false), 50);
    });

    // ---------- Pentagrama (só nos modelos de teclado) ----------
    const staffOn = () => mode.look === "teclado" && prefs.staff !== "0"; // "1" cor com nome, "3" só cor, "2" só preto
    const STAFF_LOOKS = { 1: "nome", 2: "preto", 3: "cor" };

    const setFigure = (name, dots = 0) => {
        const fig = window.SigaDinoStaff.FIGURES[name];
        const title = `${fig.title}${dots === 2 ? " com ponto duplo" : dots ? " pontuada" : ""}`;
        if (isMusic()) { ui.staffFigure.textContent = `Figura: ${title}`; return; }
        ui.staffFigure.textContent = isFree()
            ? `Figura: ${title} — ${prefs.meter ? `cabe no compasso ${prefs.meter}` : "toque mais rápido para mudar"}`
            : `Figura: ${fig.title}${name === "semibreve" ? " (devagar)" : name === "seminima" ? " (rápido)" : ""}`;
    };

    /** Prepara o pentagrama e redesenha a sequência atual (troca de ♯/♭ no meio da partida). */
    const setupStaff = () => {
        const on = staffOn();
        ui.fieldStaff.hidden = mode.look !== "teclado";
        ui.fieldPauta.hidden = !on || !isFree(); // pauta dupla: no Tocar livre e no Executar música
        ui.fieldTeclado.hidden = !isMusic();
        ui.fieldKeys.hidden = mode.look !== "teclado";
        // Compasso do Tocar livre: as figuras das notas tocadas se ajustam ao que cabe no compasso.
        ui.fieldMeter.hidden = !(isFree() && !isMusic() && mode.pads.some((p) => p.letter));
        ui.staffBox.hidden = !on;
        document.body.classList.toggle("with-staff", on);
        document.body.classList.toggle("free-keys", isFree() && !isMusic() && mode.pads.some((p) => p.letter));
        staff.setMode(mode, noteName, prefs.accidental === "bemol", STAFF_LOOKS[prefs.staff] || "nome",
            { lead: isMusic(), deep: isMusic(), grand: isMusic() ? wantGrand(MUSIC.parse(mu.text.value)) : freeGrand() });
        if (isMusic()) { setFigure("seminima"); renderSong(); return; }
        freeFill = 0;
        freeBar = false;
        if (isFree()) staff.setMeter(prefs.meter); // "3/4" depois da clave
        const fig = staff.figureFor(E.timing(prefs.level, game?.length || 1).on);
        setFigure(isFree() ? "semibreve" : fig);
        if (!game || phase === "show" || phase === "wait") return;
        game.sequence.forEach((p) => staff.push(p, fig));
        if (game.won) staff.allDone();
        else if (phase === "input") for (let k = 0; k < game.step; k++) staff.done(k);
    };

    const renderKeys = () => {
        const list = mode.pads.filter((p) => p.keys.length).map((p) => `${p.keys[0].toUpperCase()} ${noteName(p)}`).join(" · ");
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
        if (songPlaying()) keepKeyVisible(i);
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

    let freeAt = 0;        // coluna do pentagrama no Tocar livre (acorde = mesma coluna)
    let freeFill = 0;      // com compasso: quanto do compasso (em semínimas) as notas já ocupam
    let freeBar = false;   // o compasso encheu: a próxima nota começa outro (barra antes dela)
    let freeFit = { figure: "semibreve", dots: 0, q: 4 }; // figura da última nota (o acorde usa a mesma)
    let songMeterText = ""; // fórmula de compasso da música do editor ("9/8")
    /** Semínimas que cabem no compasso ("3/4" = 3, "6/8" = 3, "C" = 4); 0 = sem compasso. */
    const meterQuarters = (text) => {
        const t = text === "C" ? "4/4" : text === "¢" ? "2/2" : String(text || "");
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
        return m ? (Number(m[1]) * 4) / Number(m[2]) : 0;
    };
    /** Compasso valendo para as teclas tocadas: o do Tocar livre ou o da música do editor. */
    const freeMeterText = () => (isMusic() ? songMeterText : isFree() ? prefs.meter : "");
    // Figuras possíveis (nome, pontos, semínimas), da maior para a menor.
    const FIT_FIGS = [["breve", 0, 8], ["semibreve", 1, 6], ["semibreve", 0, 4], ["minima", 1, 3], ["minima", 0, 2],
        ["seminima", 1, 1.5], ["seminima", 0, 1], ["colcheia", 1, 0.75], ["colcheia", 0, 0.5], ["semicolcheia", 0, 0.25]];
    const QUARTERS = { breve: 8, semibreve: 4, minima: 2, seminima: 1 };
    /**
     * Com compasso, a figura pedida pelo ritmo tem que caber no que sobra do compasso:
     * no 3/4 a semibreve (4 tempos) vira mínima pontuada; no fim do compasso, a maior que couber.
     */
    const fitFigure = (name, cap) => {
        const q = QUARTERS[name] || 1;
        if (!cap) return { figure: name, dots: 0, q };
        const want = Math.min(q, cap - freeFill);
        const [figure, dots, v] = FIT_FIGS.find(([, , val]) => val <= want + 1e-9) || FIT_FIGS[FIT_FIGS.length - 1];
        return { figure, dots, q: v };
    };
    /** Pauta dupla no Tocar livre: só quando escolhida na opção Pauta ("Sol e Fá"). */
    const freeGrand = () => isFree() && !isMusic() && prefs.pauta === "dupla";
    /** Tocar livre: acende e toca; no visor aparece a nota (se o nome for curto). */
    const playFree = (i, source = "") => {
        if (practice) { practicePress(i); return; } // praticando: a tecla é a resposta
        light(i, 420);
        if (songPlaying()) return; // a música do editor está tocando: só acende e toca
        // A figura segue o ritmo de quem toca: devagar = semibreve, rápido = semínima.
        // Acorde só quando outra tecla/dedo bate quase junto com a anterior, que ainda está
        // apertada. Escala rápida ou glissando (o mesmo dedo arrastando) seguem nota a nota.
        const now = performance.now();
        const gapMs = lastFreeAt ? now - lastFreeAt : 2000;
        const chord = gapMs < CHORD_MS && now - chordStart < 120
            && source && lastSource && source !== lastSource && held.has(lastSource);
        lastSource = source;
        const sinceChord = lastChordAt ? now - lastChordAt : 99999;
        let newBar = false;
        if (!chord) {
            chordStart = now;
            // A figura sai do intervalo entre um toque (ou acorde) e o próximo.
            freeFigure = sinceChord > 900 ? "semibreve" : sinceChord > 450 ? "minima" : "seminima";
            // Com compasso: a figura se ajusta ao que sobra e o compasso cheio ganha a barra.
            const cap = meterQuarters(freeMeterText());
            freeFit = fitFigure(freeFigure, cap);
            newBar = freeBar;
            freeBar = false;
            if (cap) {
                freeFill += freeFit.q;
                if (freeFill >= cap - 1e-9) { freeFill = 0; freeBar = true; }
            } else freeFill = 0;
            lastChordAt = now;
            if (staffOn()) setFigure(freeFit.figure, freeFit.dots);
        }
        lastFreeAt = now;
        if (!chord) freeAt++;
        // Piano no Tocar livre (pauta dupla): abaixo do Dó central vai para a clave de Fá;
        // o acorde com notas dos dois lados fica na mesma vertical (mesma coluna, freeAt).
        const hand = staff.grand && mode.pads[i].octave < 0 ? "me" : "md";
        if (staffOn()) staff.done(staff.push(i, freeFit.figure, 420, chord, { hand, at: freeAt, dotted: freeFit.dots, bar: newBar }));
        if (!isMusic()) transcribe(i, freeFit, chord, sinceChord, newBar);
        const pad = mode.pads[i];
        const text = noteName(pad);
        setCount(text.length <= 4 ? text.toUpperCase() : "♪", text.length > 3 ? 0.78 : 1);
    };

    // =================================================================
    // Executar música (notas): editor + leitura do código + tocar
    // =================================================================
    const MUSIC = window.SigaDinoMusic;

    /**
     * Troca todo o texto de uma caixa como se fosse digitado: assim o Ctrl+Z desfaz
     * (abrir arquivo, carregar exemplo, limpar…). Se o navegador não deixar, troca direto.
     */
    const replaceText = (area, text) => {
        if (area.value === text) return;
        const visible = area.offsetParent !== null;
        if (visible) {
            const before = document.activeElement;
            area.focus({ preventScroll: true });
            area.select();
            const ok = text ? document.execCommand("insertText", false, text) : document.execCommand("delete");
            const done = ok && area.value === text;
            if (done) { area.setSelectionRange(0, 0); area.scrollTop = 0; }
            // Devolve o foco (senão as teclas do computador escreveriam no texto em vez de tocar).
            if (before !== area) { area.blur(); before?.focus?.({ preventScroll: true }); }
            if (done) return;
        }
        area.value = text;
    };
    /** Ctrl+P também cola (além do Ctrl+V), nas caixas de texto das músicas. */
    const pasteShortcut = (area) => area.addEventListener("keydown", async (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "p") return;
        e.preventDefault(); // não abre a impressão
        try {
            const text = await navigator.clipboard.readText();
            if (text && !document.execCommand("insertText", false, text)) area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
            area.dispatchEvent(new Event("input"));
        } catch {
            setStatus("O navegador não deixou colar com Ctrl+P. Use Ctrl+V.", "soft");
        }
    });
    const SONG_KEY = "dinogames-sigadino-song";
    const mu = {
        text: $("song-text"), name: $("song-name"), tempo: $("song-tempo"), example: $("song-example"),
        open: $("btn-song-open"), save: $("btn-song-save"), saveAs: $("btn-song-saveas"),
        play: $("btn-song-play"), playHere: $("btn-song-here"), practice: $("btn-song-practice"),
        practiceHand: $("practice-hand"), practiceHint: $("practice-hint"), speed: $("song-speed"), clear: $("btn-song-clear"), file: $("song-file"), info: $("song-info"),
    };
    const savedSong = storage.get(SONG_KEY);
    // Texto guardado na numeração antiga das oitavas (Dó central = C/1C): passa para 4C uma vez.
    if (savedSong?.text && savedSong.oct !== 4) { savedSong.text = MUSIC.migrateOctaves(savedSong.text); savedSong.oct = 4; storage.set(SONG_KEY, savedSong); }
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
    /** Contagem + avisos da leitura (nota que não cabe no compasso, código não entendido…). */
    const infoText = ({ events, warnings }) => [
        countText(events.length),
        warnings.length ? `Aviso: ${warnings.slice(0, 3).join("; ")}${warnings.length > 3 ? ` (e mais ${warnings.length - 3})` : ""}.` : "",
    ].filter(Boolean).join(" ");

    /**
     * Guarda as oitavas da música e, no teclado automático, troca o teclado quando
     * a música passa a precisar de mais (ou de menos) oitavas. Devolve true se redesenhou.
     */
    const syncKeyboard = (info) => {
        const semis = info.events.flatMap((ev) => (ev.kind === "note" ? ev.notes.map((n) => n.semi) : []));
        songOctaves = semis.length ? [Math.floor(Math.min(...semis) / 12), Math.floor(Math.max(...semis) / 12)] : [0, 1];
        if (!isMusic()) return false;
        const next = pickMode();
        if (next === mode) return false;
        mode = next;
        build();
        return true;
    };

    /** Pauta dupla (clave de Sol + Fá): escolhida, ou automática quando o texto tem a mão esquerda. */
    const wantGrand = (info) => prefs.pauta === "dupla" || (prefs.pauta !== "sol" && (info.hands === 2 || lowStep(info) <= GRAND_STEP));
    /** Nota mais grave da música (step: 0 = Dó central, −1 = Si de baixo…). */
    const lowStep = (info) => Math.min(Infinity, ...info.events.flatMap((ev) => (ev.kind === "note" ? ev.notes.map((n) => n.step) : [])));
    // Abaixo do Fá de baixo (Mi, step −5: 3 linhas suplementares na clave de Sol) vale a pauta dupla.
    const GRAND_STEP = -5;
    let songSlots = [];        // posições no pentagrama de cada evento (uma por pauta)
    const FIGS = window.SigaDinoStaff.FIGURES;
    /**
     * Tempo do compasso (fração da semibreve) para agrupar as colcheias: composto (6/8, 9/8,
     * 12/8) = 3 colcheias; 2/2 e ¢ = mínima; os outros (e sem fórmula) = semínima.
     */
    const beatOf = (meter) => {
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(meter === "C" ? "4/4" : meter === "¢" ? "2/2" : String(meter || ""));
        if (!m) return 1 / 4;
        const beats = Number(m[1]), unit = Number(m[2]);
        if (unit >= 8 && beats % 3 === 0) return 3 / unit; // 3/8, 6/8, 9/8, 12/8
        if (unit >= 8) return 2 / unit;                    // 5/8, 7/8…: de 2 em 2
        return unit <= 2 ? 1 / 2 : 1 / 4;
    };

    /** Desenha a música inteira na pauta (as já tocadas ficam fortes). */
    const renderSong = () => {
        if (!isMusic()) return;
        const info = MUSIC.parse(mu.text.value);
        staff.setGrand(wantGrand(info)); // ME: no texto → clave de Fá embaixo (na opção Automática)
        staff.setTitle(info.title); // linha "Música: …" do texto
        staff.setKey(info.key);     // "Tom: Ré♭ maior" → armadura depois da clave
        // Notas da música com linhas suplementares: o desenho cresce para caberem inteiras.
        const steps = info.events.flatMap((ev) => (ev.kind === "note" ? ev.notes.map((n) => n.step) : []));
        if (steps.length) staff.setRange(Math.min(...steps), Math.max(...steps));
        staff.setMeter(info.meter); // "Compasso: 4/4" → fórmula de compasso depois da clave
        staff.clear();
        const slots = [];          // posição no pentagrama de cada nota/pausa do texto
        const prevOf = {};         // último evento desenhado de cada mão: { k, slot }
        const groups = {};         // quiáltera aberta de cada mão: { id, n, a, b }
        const tuplets = [];        // colchetes das quiálteras (desenhados depois das barras de colcheia)
        const closeGroup = (hand) => {
            const g = groups[hand];
            if (g && g.a >= 0) tuplets.push([g.a, g.b, g.n]);
            groups[hand] = null;
        };
        // Barras de colcheia: colcheias (e menores) seguidas da mesma voz, no mesmo tempo do
        // compasso (3 colcheias no 6/8 e no 9/8, uma semínima no 4/4) ou na mesma quiáltera.
        const beatU = Math.round(beatOf(info.meter) * MUSIC.UNIT);
        const runs = {};           // grupo aberto de cada voz: { key, slots }
        const beams = [];
        const flush = (hand) => {
            if (runs[hand]?.slots.length > 1) beams.push(runs[hand].slots);
            runs[hand] = null;
        };
        let curKey = info.key;     // armadura valendo (troca com uma linha "Tom:" no meio do texto)
        const grand = staff.grand;
        songEvents.forEach((ev, k) => {
            if (ev.key != null && ev.key !== curKey) { staff.keyChange(ev.key); curKey = ev.key; }
            // Pauta de cada nota: com MD:/ME: vale a mão; numa mão só (pauta dupla pela
            // altura), abaixo do Dó central vai para a clave de Fá, como no piano.
            const voice2 = (ev.hand || "").endsWith("2") ? "2" : "";
            const handOf = (n) => (info.hands === 2 ? ev.hand || "md" : (grand && n.step < 0 ? "me" : "md") + voice2);
            // Duas vozes na mesma pauta: a 1ª com a haste para cima, a 2ª para baixo.
            const stemOf = (hand) => (hand.endsWith("2") ? "down" : info.voices.includes(`${hand}2`) ? "up" : "");
            // at: notas do mesmo instante (das duas pautas) ficam na mesma vertical.
            const base = { scroll: false, dotted: ev.dots, bar: ev.bar, over: ev.over, at: ev.at };
            const parts = {};
            if (ev.kind === "rest") { if (!ev.hidden) parts[ev.hand || "md"] = null; } // [s…]: espera sem desenho
            else ev.notes.forEach((n) => (parts[handOf(n)] = parts[handOf(n)] || []).push(n));
            const got = [];
            for (const [hand, list] of Object.entries(parts)) {
                const opts = { ...base, hand, stem: stemOf(hand) };
                let slot = -1;
                if (!list) slot = staff.pushRest(ev.figure, opts);
                else list.forEach((n) => {
                    const index = padForSemi(n.semi);
                    // A nota ligada não repete o ♯/♭ (vale o da nota onde a ligadura começa).
                    if (index >= 0) slot = staff.push({ index, step: n.step, acc: n.tied ? "" : n.acc }, ev.figure, 0, slot >= 0, opts);
                });
                if (slot < 0) continue;
                got.push(slot);
                if (k < songAt) staff.done(slot);
                // Ligadura: arco da nota anterior da mesma pauta até esta, para cada nota ligada.
                const prev = prevOf[hand];
                if (list && prev) {
                    const tied = list.filter((n) => n.tied);
                    const top = Math.max(...tied.map((n) => n.step));
                    // Uma nota: o lado pela altura. Acorde: a de cima por cima, as outras por baixo.
                    tied.forEach((n) => staff.tie(prev.slot, slot, n.step, tied.length > 1 ? n.step === top : null));
                }
                prevOf[hand] = { k, slot };
                const len = Math.round(ev.frac * MUSIC.UNIT);
                const beat = ev.tuplet ? `t${ev.tuplet.id}` : `b${Math.floor(ev.at / beatU)}`;
                const lastBeat = ev.tuplet ? beat : `b${Math.floor((ev.at + len - 1) / beatU)}`;
                if (list && FIGS[ev.figure]?.flags && beat === lastBeat) {
                    if (runs[hand]?.key === beat) runs[hand].slots.push(slot);
                    else { flush(hand); runs[hand] = { key: beat, slots: [slot] }; }
                } else flush(hand);
                // Quiáltera: colchete com o número em cima das notas do mesmo grupo { … }.
                if (groups[hand] && ev.tuplet?.id !== groups[hand].id) closeGroup(hand);
                if (ev.tuplet) {
                    if (!groups[hand]) groups[hand] = { id: ev.tuplet.id, n: ev.tuplet.n, a: slot, b: slot };
                    groups[hand].b = slot;
                }
            }
            slots[k] = got;
        });
        Object.keys(groups).forEach(closeGroup);
        Object.keys(runs).forEach(flush);
        beams.forEach((list) => staff.beam(list));
        tuplets.forEach(([a, b, n]) => staff.tuplet(a, b, n));
        songSlots = slots;
        if (songEvents.length && info.end) staff.finish(); // "Fim" no texto → barra dupla do fim
        // Teclas tocadas depois da música seguem o compasso dela, a partir de onde ela terminou.
        songMeterText = info.meter;
        const cap = meterQuarters(info.meter);
        const voice = songEvents[0]?.hand || "md";
        const end = Math.max(0, ...songEvents.filter((ev) => ev.hand === voice).map((ev) => ev.at + Math.round(ev.frac * MUSIC.UNIT)));
        freeFill = cap ? Math.round((((end / MUSIC.UNIT) * 4) % cap) * 8) / 8 : 0;
        freeBar = false;
    };

    const updatePlayButton = () => {
        mu.play.textContent = songPlaying() && !practice ? "⏹ Parar" : "▶ Tocar";
        mu.playHere.disabled = songPlaying();
        mu.play.classList.toggle("primary", !songPlaying());
        mu.play.title = songPlaying() ? "Parar a música" : "Tocar a música do editor";
        mu.practice.textContent = practice ? "⏹ Parar a prática" : "🎹 Praticar";
        mu.practice.classList.toggle("primary", !!practice);
    };

    const stopSong = () => {
        songRun++;
        if (songAt >= 0) padEls.forEach((el) => el.classList.remove("lit"));
        songAt = -1;
        if (practice) {
            const done = practice.resolve;
            practice = null;
            done?.(false);
            clearHints();
            staff.unmarkAll();
        }
        updatePlayButton();
    };

    const describe = (ev) => {
        const fig = window.SigaDinoStaff.FIGURES[ev.figure]?.title.toLowerCase() || "";
        const dot = ev.dots === 2 ? " com ponto duplo" : ev.dots ? " pontuada" : "";
        const where = ev.measure ? `, compasso ${ev.measure}` : "";
        const who = { md2: "MD2 ", me: "ME ", me2: "ME2 " }[ev.hand] || "";
        if (ev.kind === "rest") return `${who}pausa de ${fig}${dot}${where}`;
        return `${who}${ev.notes.map((n) => n.label).join(" + ")} (${fig}${dot}${where})`;
    };

    /** Lê o editor, desenha a pauta e toca nota por nota (teclas e pentagrama acendem). */
    /**
     * Toca a música do editor. fromCursor: só o trecho marcado ou, sem marcação, do cursor
     * até o fim (as notas antes ficam fortes no pentagrama, como já tocadas).
     */
    const playSong = async (fromCursor = false) => {
        stopSong();
        sound.ensure();
        sound.load(prefs.timbre);
        const parsed = MUSIC.parse(mu.text.value);
        const { events, tempo } = parsed;
        if (tempo && tempo !== song.textTempo) { mu.tempo.value = tempo; song.textTempo = tempo; }
        songEvents = events;
        syncKeyboard(parsed); // teclado automático: as oitavas que a música usa
        if (!events.length) {
            renderSong();
            setStatus("Não achei notas no editor. Exemplo: E[n1/4]; F[n1/4]; G[n1/2]; — veja a Ajuda.", "soft");
            return;
        }
        const range = songRange(events, fromCursor);
        if (range.error) { renderSong(); setStatus(range.error, "soft"); return; }
        const { k0, k1, part } = range;
        const U = MUSIC.UNIT;
        const endOf = (ev) => ev.at + Math.round(ev.frac * U);
        const id = songRun;
        songAt = k0;
        updatePlayButton();
        renderSong();
        const quarter = quarterMs();
        const outside = events.some((ev) => ev.kind === "note" && ev.notes.some((n) => {
            const p = mode.pads[padForSemi(n.semi)];
            return p && semiOf(p) !== n.semi;
        }));
        mu.info.textContent = [
            infoText(parsed),
            outside ? "Notas fora do teclado acendem a mesma nota em outra oitava (escolha Teclado: Automático ou Piano)." : "",
        ].filter(Boolean).join(" ");
        // Espera o som ficar pronto (áudio ligado, arquivo carregado): sem isso a 1ª nota
        // às vezes saía muda.
        sound.timbre = prefs.timbre;
        await sound.ready();
        if (id !== songRun) return;
        await sleep(120);
        const startAt = events[k0].at;
        // Instantes: todos os eventos que começam juntos (as duas mãos) tocam de uma vez;
        // espera até o próximo instante.
        for (let k = k0; k < k1;) {
            if (id !== songRun) return;
            songAt = k;
            const at = events[k].at;
            let kEnd = k;
            while (kEnd < k1 && events[kEnd].at === at) kEnd++;
            const nextAt = kEnd < k1 ? events[kEnd].at : Math.max(...events.slice(k, kEnd).map(endOf));
            const wait = (nextAt - at) / U * 4 * quarter; // semibreve = 4 semínimas
            const moment = events.slice(k, kEnd);
            const struck = new Set(); // a mesma tecla em duas vozes no mesmo instante toca uma vez só
            moment.forEach((ev) => {
                const ms = ev.frac * 4 * quarter;
                const on = Math.max(60, ms * 0.9);      // um respiro entre as notas
                if (ev.kind === "note") ev.notes.forEach((n) => {
                    const i = padForSemi(n.semi);
                    // Nota ligada à anterior: não toca de novo (continua soando). Começando
                    // por ela (do cursor), toca o que sobra da ligadura.
                    if (i < 0 || (n.tied && at > startAt) || struck.has(i)) return;
                    struck.add(i);
                    const holdMs = (n.hold || ev.frac) * 4 * quarter;
                    light(i, Math.max(60, holdMs - (ms - on)), freqOfSemi(n.semi));
                });
                (songSlots[events.indexOf(ev)] || []).forEach((slot) => { staff.light(slot, on); staff.done(slot); });
            });
            const main = moment.find((ev) => ev.hand !== "me") || moment[0];
            setFigure(main.figure);
            setStatus(`🎵 Tocando ${k + 1} de ${events.length}${part ? ` (${part})` : ""}: ${moment.map(describe).join(" · ")}`, "turn");
            const label = main.kind === "rest" ? "--" : main.notes[0].label;
            setCount(label.length <= 4 ? label : "♪", label.length > 3 ? 0.78 : 1);
            k = kEnd;
            await sleep(wait);
        }
        if (id !== songRun) return;
        songAt = -1;
        updatePlayButton();
        setCount("♪");
        setStatus(part === "trecho marcado"
            ? "Fim do trecho marcado. 🎵 Toque em ⏯ Do cursor para ouvir de novo."
            : "Fim da música! 🎉 Toque em ▶ Tocar para ouvir de novo.", "good");
    };

    /**
     * Trecho a tocar: com fromCursor, as notas da seleção ou, sem seleção, da 1ª nota que
     * termina depois do cursor até o fim. Com as duas mãos, o trecho vale pelo tempo: começa
     * no instante da 1ª nota escolhida e vai até o fim da última (a outra mão toca junto).
     * Devolve { k0, k1, part, marked } ou { error }.
     */
    const songRange = (events, fromCursor) => {
        if (!fromCursor) return { k0: 0, k1: events.length, part: "", marked: false };
        const a = mu.text.selectionStart, b = mu.text.selectionEnd;
        const endOf = (ev) => ev.at + Math.round(ev.frac * MUSIC.UNIT);
        const picked = events.filter((ev) => ev.to > a && (b > a ? ev.from < b : true));
        const first = picked.reduce((m, ev) => (!m || ev.from < m.from ? ev : m), null);
        let k0 = -1, k1 = events.length;
        if (first) {
            k0 = events.findIndex((ev) => ev.at >= first.at);
            if (b > a) {
                const stop = Math.max(...picked.map(endOf));
                k1 = events.findIndex((ev) => ev.at >= stop);
                if (k1 < 0) k1 = events.length;
            }
        }
        if (k0 < 0 || k0 >= k1) {
            return { error: b > a ? "Não há notas no trecho marcado." : "Não há notas depois do cursor. Coloque o cursor antes de uma nota." };
        }
        return { k0, k1, part: b > a ? "trecho marcado" : "do cursor em diante", marked: b > a };
    };
    /** Duração da semínima (ms): o ♩ = do editor e a Velocidade (100%, 75%, 50%…). */
    const quarterMs = () => {
        const bpm = Math.min(240, Math.max(30, Number(mu.tempo.value) || 160));
        return 60000 / bpm / (Number(prefs.speed) || 1);
    };

    // =================================================================
    // Praticar: a música espera você tocar a tecla certa antes de seguir
    // =================================================================
    // practice = { need, got, hold, resolve, hits, misses, wrongHere } enquanto pratica.
    let practice = null;
    const HAND_WORD = { ambas: "as duas mãos", md: "a mão direita", me: "a mão esquerda" };
    /** Nome da nota como está escrita na música (Lá♭, não Sol♯, com a armadura de Ré♭). */
    const spelledName = (n) => {
        const li = ((n.step % 7) + 7) % 7;
        const nat = mode.pads.filter((p) => !p.sharp)[li];
        const d = n.semi - (Math.floor(n.step / 7) * 12 + [0, 2, 4, 5, 7, 9, 11][li]);
        return (nat ? noteName(nat) : "") + (d > 0 ? "♯".repeat(d) : "♭".repeat(-d));
    };
    const clearHints = () => padEls.forEach((el) => el?.classList.remove("hint"));
    const showHints = (list) => {
        list.forEach((i) => padEls[i]?.classList.add("hint"));
        if (list.length) keepKeyVisible(list[0]);
    };
    /** Espera as teclas do momento (acorde: todas, em qualquer ordem). false = parou. */
    const waitKeys = (need, hold) => new Promise((resolve) => Object.assign(practice, { need, hold, got: new Set(), resolve, wrongHere: 0 }));

    /** Tecla apertada durante a prática: certa (some a dica), repetida ou errada. */
    const practicePress = (i) => {
        const p = practice;
        if (!p.need) { light(i, 300); return; } // a outra mão está tocando: só soa
        if (!p.need.has(i) || p.got.has(i)) {
            light(i, 300);
            if (p.got.has(i)) return;
            p.misses++;
            p.wrongHere++;
            padEls[i]?.classList.add("wrong");
            setTimeout(() => padEls[i]?.classList.remove("wrong"), 600);
            const left = [...p.need].filter((k) => !p.got.has(k));
            // Sem dica: depois de 2 erros na mesma nota, a tecla certa acende para ajudar.
            if (prefs.practiceHint === "0" && p.wrongHere >= 2) showHints(left);
            setStatus(`Ops! Essa é ${noteName(mode.pads[i])}. ${prefs.practiceHint !== "0" || p.wrongHere >= 2
                ? `Toque ${left.map((k) => p.names?.get(k) || noteName(mode.pads[k])).join(" + ")} (a tecla que pisca).`
                : "Olhe a nota marcada no pentagrama e tente de novo."} · ✔ ${p.hits} · ✖ ${p.misses}`, "soft");
            return;
        }
        p.got.add(i);
        light(i, p.hold.get(i) || 420);
        padEls[i]?.classList.remove("hint");
        if (p.got.size < p.need.size) return; // acorde: faltam teclas
        const done = p.resolve;
        p.need = null;
        p.resolve = null;
        done(true);
    };

    /**
     * Praticar: toca a música esperando você. Em cada instante, as teclas da mão escolhida
     * acendem (dica) e a nota fica marcada no pentagrama; a música só segue quando você toca
     * todas. A outra mão (e as pausas) tocam sozinhas, no ritmo da Velocidade escolhida.
     * Com um trecho marcado no texto, ele se repete até você parar.
     */
    const practiceSong = async () => {
        stopSong();
        sound.ensure();
        sound.load(prefs.timbre);
        const parsed = MUSIC.parse(mu.text.value);
        const { events, tempo } = parsed;
        if (tempo && tempo !== song.textTempo) { mu.tempo.value = tempo; song.textTempo = tempo; }
        songEvents = events;
        syncKeyboard(parsed);
        if (!events.length) {
            renderSong();
            setStatus("Não achei notas no editor para praticar. Escolha uma música em 🎼 Músicas… ou escreva as notas.", "soft");
            return;
        }
        // Trecho marcado: repete. Sem marcação: do cursor (ou do começo, se o cursor está depois da última nota).
        let range = songRange(events, true);
        if (range.error && !(mu.text.selectionEnd > mu.text.selectionStart)) range = songRange(events, false);
        if (range.error) { renderSong(); setStatus(range.error, "soft"); return; }
        const { k0, k1, marked } = range;
        let hand = prefs.practiceHand;
        let note = "";
        if (hand === "me" && parsed.hands < 2) { hand = "ambas"; note = " (esta música não tem mão esquerda)"; }
        const mine = (ev) => hand === "ambas" || (ev.hand || "md").startsWith(hand);
        const id = songRun;
        practice = { need: null, got: new Set(), hold: new Map(), resolve: null, hits: 0, misses: 0, wrongHere: 0 };
        songAt = k0;
        updatePlayButton();
        renderSong();
        mu.info.textContent = infoText(parsed);
        sound.timbre = prefs.timbre;
        await sound.ready();
        if (id !== songRun) return;
        const U = MUSIC.UNIT;
        const quarter = quarterMs();
        const startAt = events[k0].at;
        const slotsOf = (list) => list.flatMap((ev) => songSlots[events.indexOf(ev)] || []);
        setStatus(`🎹 Praticando ${HAND_WORD[hand]}${note}${marked ? " no trecho marcado (ele se repete)" : ""}: toque as teclas que piscam. A música espera você.`, "turn");
        for (let round = 0; ; round++) {
            let prevAt = null;
            for (let k = k0; k < k1;) {
                if (id !== songRun) return;
                songAt = k;
                const at = events[k].at;
                let kEnd = k;
                while (kEnd < k1 && events[kEnd].at === at) kEnd++;
                const moment = events.slice(k, kEnd);
                // Teclas do momento: as da mão praticada esperam você; as outras tocam sozinhas.
                const need = new Set(), hold = new Map(), others = new Map(), names = new Map();
                moment.forEach((ev) => {
                    if (ev.kind !== "note") return;
                    ev.notes.forEach((n) => {
                        const i = padForSemi(n.semi);
                        if (i < 0 || (n.tied && at > startAt)) return; // ligada: continua soando
                        const ms = Math.max(60, (n.hold || ev.frac) * 4 * quarter * 0.95);
                        if (mine(ev)) { need.add(i); hold.set(i, Math.max(hold.get(i) || 0, ms)); names.set(i, spelledName(n)); }
                        else others.set(i, { ms, freq: freqOfSemi(n.semi) });
                    });
                });
                if (need.size) {
                    const marks = slotsOf(moment.filter(mine));
                    marks.forEach((slot) => staff.mark(slot, true));
                    if (prefs.practiceHint !== "0") showHints([...need]);
                    const list = [...need].map((i) => names.get(i));
                    practice.names = names;
                    setCount(list.length === 1 && list[0].length <= 4 ? list[0].toUpperCase() : "♪", list[0]?.length > 3 ? 0.78 : 1);
                    if (round || k > k0 || practice.hits) {
                        setStatus(`${prefs.practiceHint !== "0" ? `Toque ${list.join(" + ")}` : "Toque a nota marcada no pentagrama"} · compasso ${moment[0].measure || "—"} · ✔ ${practice.hits} · ✖ ${practice.misses}`, "turn");
                    }
                    const ok = await waitKeys(need, hold);
                    if (!ok || id !== songRun) return;
                    clearHints();
                    marks.forEach((slot) => staff.mark(slot, false));
                    practice.hits++;
                } else if (prevAt != null) {
                    // Só a outra mão (ou pausa): espera o ritmo desde o último instante.
                    await sleep(((at - prevAt) / U) * 4 * quarter);
                    if (id !== songRun) return;
                }
                others.forEach(({ ms, freq }, i) => { if (!need.has(i)) light(i, ms, freq); });
                slotsOf(moment).forEach((slot) => { staff.light(slot, 260); staff.done(slot); });
                prevAt = at;
                k = kEnd;
            }
            if (!marked || id !== songRun) break;
            setStatus(`🔁 Muito bem! De novo, desde o começo do trecho… · ✔ ${practice.hits} · ✖ ${practice.misses}`, "good");
            await sleep(1400);
            if (id !== songRun) return;
            songAt = k0;
            renderSong();
        }
        if (id !== songRun) return;
        const { hits, misses } = practice;
        stopSong();
        setCount("♪");
        const stars = misses === 0 ? "⭐⭐⭐" : misses <= Math.max(1, hits * 0.1) ? "⭐⭐" : "⭐";
        setStatus(`Fim da prática! ${hits} ${hits === 1 ? "acerto" : "acertos"} e ${misses} ${misses === 1 ? "erro" : "erros"} ${stars} ` +
            "Marque um trecho no texto para repetir só ele, ou diminua a Velocidade.", "good");
    };

    // ---------- Arquivo: abrir, salvar, salvar como ----------
    const rememberSong = () => storage.set(SONG_KEY, { text: mu.text.value, name: song.name, oct: 4 });
    const showName = () => { mu.name.textContent = `${song.name}${song.dirty ? " •" : ""}`; };
    const setSongText = (text, name, handle = null) => {
        stopSong();
        replaceText(mu.text, text);
        song.name = name;
        song.handle = handle;
        song.dirty = false;
        const parsed = MUSIC.parse(text);
        if (parsed.tempo) { mu.tempo.value = parsed.tempo; song.textTempo = parsed.tempo; }
        songEvents = parsed.events;
        if (!syncKeyboard(parsed)) renderSong();
        mu.info.textContent = infoText(parsed);
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
    /**
     * Salva um texto num arquivo .txt escolhido pelo usuário. Devolve { name, handle }
     * (handle só quando o navegador deixa gravar de novo no mesmo arquivo) ou null se cancelou.
     */
    const saveTextFile = async (text, suggestedName) => {
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({ suggestedName, types: [TXT] });
                const w = await handle.createWritable();
                await w.write(text);
                await w.close();
                return { name: handle.name, handle };
            } catch { return null; } // cancelado
        }
        // Sem acesso a arquivos (celular): baixa o .txt com o nome escolhido.
        let name = window.prompt("Nome do arquivo:", suggestedName);
        if (!name) return null;
        if (!/\.txt$/i.test(name)) name += ".txt";
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { name, handle: null };
    };
    const saveSongAs = async () => {
        const saved = await saveTextFile(mu.text.value, song.name);
        if (!saved) return;
        song.name = saved.name;
        song.handle = saved.handle;
        savedOk();
    };
    const saveSong = async () => {
        if (!song.handle?.createWritable) return saveSongAs();
        try { await writeTo(song.handle); savedOk(); }
        catch { saveSongAs(); }
    };

    // Lista das músicas guardadas no jogo (music.js): escolher carrega no editor.
    mu.example.innerHTML = `<select id="song-pick" aria-label="Músicas do jogo" title="Carregar uma música guardada no jogo">
        <option value="">🎼 Músicas…</option>
        ${MUSIC.EXAMPLES.map((e) => `<option value="${e.id}">${e.title}</option>`).join("")}
    </select>`;
    const songPick = $("song-pick");
    songPick.addEventListener("change", () => {
        const ex = MUSIC.EXAMPLES.find((e) => e.id === songPick.value);
        songPick.value = "";
        if (ex && okToReplace()) {
            setSongText(ex.text, ex.file);
            setStatus(`Música “${ex.title}” carregada. Toque em ▶ Tocar. 🎼`, "turn");
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
            const parsed = MUSIC.parse(mu.text.value);
            songEvents = parsed.events;
            if (!syncKeyboard(parsed)) renderSong();
            mu.info.textContent = infoText(parsed);
        }, 400);
    });
    pasteShortcut(mu.text);
    mu.open.addEventListener("click", openSong);
    mu.save.addEventListener("click", saveSong);
    mu.saveAs.addEventListener("click", saveSongAs);
    // O botão não tira a marcação do texto (o editor guarda a seleção mesmo sem foco).
    mu.playHere.addEventListener("mousedown", (e) => e.preventDefault());
    mu.playHere.addEventListener("click", () => playSong(true));
    mu.play.addEventListener("click", () => {
        if (!songPlaying()) { playSong(); return; }
        stopSong();
        setStatus("Música parada. Toque em ▶ Tocar para começar de novo.", "soft");
    });
    mu.practice.addEventListener("mousedown", (e) => e.preventDefault()); // não tira a marcação do texto
    mu.practice.addEventListener("click", () => {
        if (!practice) { practiceSong(); return; }
        const { hits, misses } = practice;
        stopSong();
        setCount("♪");
        setStatus(`Prática parada (✔ ${hits} · ✖ ${misses}). Toque em 🎹 Praticar para começar de novo.`, "soft");
    });
    mu.clear.addEventListener("click", () => {
        if (mu.text.value.trim() && !window.confirm("Apagar todo o texto do editor?")) return;
        setSongText("", "nova-musica.txt");
        setStatus("Editor limpo. Escreva as notas, por exemplo: C[n1/4]; D[n1/4]; E[n1/2];", "turn");
    });
    // Ctrl+S salva; Ctrl+Shift+S salva como; Ctrl+Enter toca do cursor (ou o trecho marcado).
    mu.text.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (songPlaying()) stopSong(); else playSong(true);
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (e.shiftKey) saveSongAs(); else saveSong();
        }
    });

    // =================================================================
    // Tocar livre: as notas tocadas viram código (o mesmo do Executar música)
    // =================================================================
    const tr = {
        box: $("free-notes"), text: $("free-text"), save: $("btn-free-save"),
        clear: $("btn-free-clear"), send: $("btn-free-send"),
    };
    const FREE_KEY = "dinogames-sigadino-free-notes";
    const FRAC_CODE = { breve: "2", semibreve: "1", minima: "1/2", seminima: "1/4", colcheia: "1/8", semicolcheia: "1/16" };
    /** Cabeçalho do texto levado ao Executar música (com a fórmula de compasso escolhida). */
    const freeHeader = () => `Música: Minha música\nAndamento: semínima = 160\n${prefs.meter ? `Compasso: ${prefs.meter}\n` : ""}\n`;
    // A caixinha é texto comum (dá para editar, desfazer, copiar e colar); as notas tocadas
    // entram no fim. Versão antiga guardava a lista de notas: vira texto uma vez.
    const freeSaved = storage.get(FREE_KEY) || {};
    if (freeSaved.text && freeSaved.oct !== 4) freeSaved.text = MUSIC.migrateOctaves(freeSaved.text); // numeração antiga → 4C
    const oldEvents = freeSaved.events || [];
    tr.text.value = freeSaved.text ?? oldEvents.map((ev, k) =>
        `${k && ev.br ? "\n" : k ? " " : ""}${ev.notes.map((n) => `${n}[n${FRAC_CODE[ev.fig] || "1/4"}]`).join(", ")};`).join("");

    /** Código da tecla: letra com # ou b (conforme ♯/♭ escolhido) e o número da oitava (2 = a de cima). */
    const codeOf = (pad) => {
        if (!pad.letter) return "";
        const flat = prefs.accidental === "bemol" && pad.flatLetter;
        const letter = (flat ? pad.flatLetter : pad.letter).replace("♯", "#").replace("♭", "b");
        return `${(pad.octave || 0) + 4}${letter}`; // como no piano: Dó central = "4C", o de cima = "5C"…
    };
    const renderFree = () => {
        const empty = !tr.text.value.trim();
        tr.save.disabled = tr.clear.disabled = tr.send.disabled = empty;
        storage.set(FREE_KEY, { text: tr.text.value, oct: 4 });
    };
    tr.text.addEventListener("input", renderFree);
    /**
     * Acrescenta a nota tocada (ou junta no acorde). Com compasso, cada compasso numa linha;
     * sem compasso, pausa longa ou 8 notas na linha = linha nova.
     */
    function transcribe(i, fit, chord, sinceMs, newBar = false) {
        const code = codeOf(mode.pads[i]);
        if (!code) return;
        const token = `${code}[n${FRAC_CODE[fit.figure] || "1/4"}${".".repeat(fit.dots || 0)}]`;
        const text = tr.text.value.replace(/\s+$/, "");
        let next;
        if (chord && text.endsWith(";")) {
            next = `${text.slice(0, -1)}, ${token};`; // vírgula = acorde
        } else {
            const line = text.slice(text.lastIndexOf("\n") + 1);
            const onLine = (line.match(/;/g) || []).length;
            const breakLine = prefs.meter ? newBar : sinceMs > 2500 || onLine >= 8;
            next = `${text}${!text ? "" : breakLine ? "\n" : " "}${token};`;
        }
        tr.text.value = next;
        tr.text.scrollTop = tr.text.scrollHeight;
        renderFree();
    }
    tr.clear.addEventListener("click", () => {
        replaceText(tr.text, "");
        renderFree();
        setStatus("Caixinha de notas limpa. Toque as teclas para escrever de novo. 🎶", "turn");
    });
    tr.save.addEventListener("click", async () => {
        const text = `${freeHeader()}${tr.text.value}\n`;
        const saved = await saveTextFile(text, "minha-musica.txt");
        if (saved) setStatus(`Notas salvas em “${saved.name}”. 💾 Abra no Executar música para tocar.`, "good");
    });
    tr.send.addEventListener("click", () => {
        if (!okToReplace()) return;
        const text = `${freeHeader()}${tr.text.value}\n`;
        prefs.play = "musica";
        ui.play.value = "musica";
        storage.set(PREFS_KEY, prefs);
        mode = pickMode();
        resetIdle();
        build();
        setSongText(text, "minha-musica.txt");
        song.dirty = true;
        showName();
        setStatus("As notas foram para o editor. Toque em ▶ Tocar para ouvir (e edite à vontade).", "turn");
    });
    pasteShortcut(tr.text);
    renderFree();

    // Texto inicial: o último que estava no editor, ou a Ode à Alegria.
    mu.text.value = savedSong?.text ?? MUSIC.EXAMPLES[0].text;
    {
        const parsed = MUSIC.parse(mu.text.value);
        songEvents = parsed.events;
        if (parsed.tempo) { mu.tempo.value = parsed.tempo; song.textTempo = parsed.tempo; }
        mu.info.textContent = infoText(parsed);
        const semis = parsed.events.flatMap((ev) => (ev.kind === "note" ? ev.notes.map((n) => n.semi) : []));
        if (semis.length) songOctaves = [Math.floor(Math.min(...semis) / 12), Math.floor(Math.max(...semis) / 12)];
        mode = pickMode(); // o desenho (build) vem no fim do arquivo
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
        freeFill = 0;
        freeBar = false;
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
    // Modelo: a lista muda com o jogo, então não usa bindSelect (que trocaria o piano
    // guardado pelo 1º da lista no jogo de memória).
    ui.mode.addEventListener("change", () => {
        prefs.mode = ui.mode.value;
        storage.set(PREFS_KEY, prefs);
        mode = pickMode(); resetIdle(); build();
    });
    bindSelect(ui.play, "play", () => { renderModeOptions(); mode = pickMode(); resetIdle(); build(); });
    bindSelect(ui.accidental, "accidental", () => build()); // só troca os nomes
    bindSelect(ui.staffOpt, "staff", () => build());
    bindSelect(ui.pautaOpt, "pauta", () => (isMusic() ? renderSong() : build())); // clave de Sol, pauta dupla ou automática
    bindSelect(ui.tecladoOpt, "teclado", () => { stopSong(); mode = pickMode(); build(); }); // oitavas do teclado
    bindSelect(ui.names, "names", () => build()); // nome (Dó) ou letra (C)
    bindSelect(ui.keysOpt, "keys", () => build()); // teclas coloridas ou preto e branco
    // Praticar (Executar música): mão, dica e velocidade
    bindSelect(mu.practiceHand, "practiceHand", () => { if (practice) practiceSong(); });
    bindSelect(mu.practiceHint, "practiceHint", () => { if (practice) practiceSong(); });
    bindSelect(mu.speed, "speed", () => { if (songPlaying()) setStatus("A nova Velocidade vale na próxima vez que tocar ou praticar.", "soft"); });
    bindSelect(ui.meterOpt, "meter", () => { // compasso do Tocar livre
        build();
        setStatus(prefs.meter
            ? `Compasso ${prefs.meter}: as figuras das notas se ajustam ao que cabe em cada compasso. 🎼`
            : "Sem compasso: a figura segue só o ritmo de quem toca.", "turn");
    });

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
