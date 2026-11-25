// Sons do Dino Come-Come, todos sintetizados com Web Audio (sem arquivos).
window.DinoSound = (() => {
    let ctx = null;
    let master = null;
    let noiseBuf = null;
    let enabled = true;
    try { enabled = localStorage.getItem("dino-come-come-som") !== "0"; } catch { /* sem storage */ }

    const init = () => {
        if (ctx) {
            if (ctx.state === "suspended") ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    };

    const tone = (freq, dur, { type = "square", vol = 0.12, at = 0, to = null, attack = 0.005 } = {}) => {
        if (!enabled || !ctx) return;
        const t = ctx.currentTime + at;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    };

    const noise = (dur, { vol = 0.2, at = 0, from = 1800, to = 200, q = 1 } = {}) => {
        if (!enabled || !ctx) return;
        const t = ctx.currentTime + at;
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.Q.value = q;
        f.frequency.setValueAtTime(from, t);
        f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(master);
        src.start(t);
        src.stop(t + dur + 0.02);
    };

    const notes = (list, step, opts) => list.forEach((f, i) => f && tone(f, step * 1.6, { ...opts, at: i * step }));

    let seedFlip = false;

    return {
        init,
        get enabled() { return enabled; },
        toggle() {
            enabled = !enabled;
            try { localStorage.setItem("dino-come-come-som", enabled ? "1" : "0"); } catch { /* sem storage */ }
            if (enabled) init();
            return enabled;
        },
        seed() {
            seedFlip = !seedFlip;
            tone(seedFlip ? 740 : 588, 0.045, { type: "triangle", vol: 0.1 });
        },
        star() {
            notes([392, 523, 659, 784, 1047], 0.05, { type: "square", vol: 0.07 });
        },
        frightPulse(fast) {
            tone(fast ? 330 : 220, 0.12, { type: "triangle", vol: 0.06, to: fast ? 260 : 180 });
        },
        eatRaptor(n) {
            tone(260 * (1 + n * 0.25), 0.22, { type: "square", vol: 0.08, to: 1400 * (1 + n * 0.15) });
        },
        bones() {
            tone(900, 0.05, { type: "triangle", vol: 0.04 });
        },
        fruit() {
            notes([1047, 1319, 1568, 2093], 0.06, { type: "sine", vol: 0.12 });
        },
        roar() {
            noise(0.7, { vol: 0.35, from: 2600, to: 120, q: 4 });
            tone(140, 0.6, { type: "sawtooth", vol: 0.12, to: 55 });
            tone(210, 0.45, { type: "sawtooth", vol: 0.06, to: 80, at: 0.04 });
        },
        roarReady() {
            notes([523, 784], 0.08, { type: "triangle", vol: 0.09 });
        },
        die() {
            for (let i = 0; i < 10; i++) tone(620 - i * 50, 0.13, { type: "square", vol: 0.07, at: i * 0.11, to: 560 - i * 50 });
            noise(0.4, { vol: 0.15, at: 1.15, from: 1200, to: 100 });
        },
        extraLife() {
            notes([1319, 0, 1319, 0, 1760], 0.07, { type: "square", vol: 0.06 });
        },
        clear() {
            notes([523, 659, 784, 1047, 0, 784, 1047, 1319], 0.09, { type: "triangle", vol: 0.12 });
        },
        start() {
            // Melodia própria do Dino Come-Come (dó maior, 8 compassos curtos).
            const mel = [523, 659, 784, 659, 698, 880, 784, 0, 659, 784, 1047, 988, 880, 784, 1047, 0];
            const bass = [131, 0, 196, 0, 175, 0, 196, 0, 165, 0, 196, 0, 175, 0, 131, 0];
            notes(mel, 0.12, { type: "square", vol: 0.06 });
            notes(bass, 0.12, { type: "triangle", vol: 0.12 });
        },
        gameOver() {
            notes([392, 370, 349, 330, 0, 262], 0.16, { type: "triangle", vol: 0.12 });
        },
        click() {
            tone(660, 0.04, { type: "triangle", vol: 0.06 });
        },
    };
})();
