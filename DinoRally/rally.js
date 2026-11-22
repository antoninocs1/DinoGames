"use strict";

// =====================================================================
// Dino Rally — corrida de resistência em pseudo-3D (DinoGames)
// Resistência: ultrapasse a meta de carros de cada dia, por 7 dias.
// Corrida: largada no farol, chegada com bandeira quadriculada.
// =====================================================================

// ---------- Mundo / estrada ----------
const SEG_LEN = 200; // comprimento de cada segmento da pista
const ROAD_W = 2000; // meia largura da pista
const CAM_H = 1000; // altura da câmera
const CAM_DEPTH = 1 / Math.tan((100 / 2) * (Math.PI / 180)); // campo de visão de 100°
const DRAW_DIST = 220; // segmentos desenhados
const TRACK_SEGS = 3200;
const TRACK_LEN = TRACK_SEGS * SEG_LEN;
const RUMBLE_LEN = 3; // segmentos por faixa de zebra
const PLAYER_Z = CAM_H * CAM_DEPTH; // distância do carro do jogador à câmera

// ---------- Física ----------
const MAX_SPEED = SEG_LEN * 60; // um segmento por quadro a 60 FPS
const ACCEL = MAX_SPEED / 5;
const BRAKE = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFFROAD_DECEL = -MAX_SPEED / 2;
const OFFROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.3;
const KMH_AT_MAX = 240;

// ---------- Carros ----------
const CAR_W = 520; // largura do carro no mundo
const CAR_HALF = CAR_W / 2 / ROAD_W; // meia largura em unidades da pista
const LANES = [-0.66, 0, 0.66];
const N_CARS = 70;

// ---------- Dia ----------
const PHASE_LEN = 22; // segundos por fase do dia
const BLEND = 4; // segundos de transição entre fases
const BASE_QUOTA = 40;
const QUOTA_STEP = 10;
const MAX_DAYS = 7; // completar o 7º dia vence o modo resistência

// ---------- Corrida ----------
const KM_PER_UNIT = 0.0055 / 1000; // unidades da pista -> km (mesma conta do odômetro)
const N_RIVALS = 11;
const COUNTDOWN = 3; // segundos no vermelho antes do verde
const GRID_ROW_GAP = 3; // segmentos entre as filas do grid
const raceKmFor = (level) => 3 + level; // corrida 1 = 4 km, corrida 2 = 5 km...
// Fase do dia em que cada corrida começa (corrida 2 cai no meio-dia com neve)
const RACE_START_PHASE = [1, 2, 3, 4, 5, 6, 7, 0];

const BEST_KEY = "dinogames-rally-best";
const SOUND_KEY = "dinogames-rally-sound";
const MODE_KEY = "dinogames-rally-mode";
const NUMBERS_KEY = "dinogames-rally-numbers";
const LAPS_KEY = "dinogames-rally-laps";
const CAR_KEY = "dinogames-rally-car";
const MINIMAP_KEY = "dinogames-rally-minimap";

// ---------- Nitro ----------
const NITRO_MAX_SPEED = MAX_SPEED * 1.3; // com nitro passa da velocidade máxima
const NITRO_DURATION = 3; // segundos com a barra cheia
const NITRO_MIN = 0.25; // carga mínima para acionar
const NITRO_PASS = { endurance: 0.08, race: 0.15 }; // carga por ultrapassagem
const NITRO_IDLE = 0.015; // carga por segundo, devagar

// ---------- Carro do jogador (cor e número escolhidos no menu) ----------
const PLAYER_CARS = [
    { id: "verde", name: "Verde-água", rgb: [47, 191, 149], number: 1 },
    { id: "vermelho", name: "Vermelho", rgb: [214, 48, 49], number: 7 },
    { id: "azul", name: "Azul", rgb: [40, 110, 225], number: 3 },
    { id: "amarelo", name: "Amarelo", rgb: [245, 200, 40], number: 5 },
    { id: "laranja", name: "Laranja", rgb: [245, 130, 30], number: 9 },
    { id: "roxo", name: "Roxo", rgb: [135, 75, 205], number: 8 },
    { id: "branco", name: "Branco", rgb: [236, 236, 240], number: 10 },
    { id: "preto", name: "Preto", rgb: [42, 42, 50], number: 13 },
];

// Medalhas por posição de chegada
const MEDALS = { 1: { icon: "🥇", name: "ouro" }, 2: { icon: "🥈", name: "prata" }, 3: { icon: "🥉", name: "bronze" } };

// Fases do dia: cores do céu, chão, estrada, neblina e luz.
const PHASES = [
    { name: "Amanhecer", skyTop: "#2a2f6b", skyBot: "#f2a65a", grass1: "#3d6b35", grass2: "#386331", road1: "#4a4a52", road2: "#47474f", rumble1: "#d8d8d8", rumble2: "#c0392b", lane: "#e8e8e8", fog: "#e9a877", fogDensity: 1.2, light: 0.75, mountFar: "#6b4f7a", mountNear: "#3f3552", sun: 0.15 },
    { name: "Manhã", skyTop: "#2f86e0", skyBot: "#bfe6ff", grass1: "#4caf50", grass2: "#43a047", road1: "#6b6b70", road2: "#66666b", rumble1: "#ffffff", rumble2: "#c0392b", lane: "#ffffff", fog: "#cfeaff", fogDensity: 0.7, light: 1, mountFar: "#7aa5c9", mountNear: "#4f7f6a", sun: 0.45 },
    { name: "Meio-dia", skyTop: "#1f74d6", skyBot: "#9fd4ff", grass1: "#5cb85c", grass2: "#52a852", road1: "#707075", road2: "#6a6a70", rumble1: "#ffffff", rumble2: "#c0392b", lane: "#ffffff", fog: "#bfe0ff", fogDensity: 0.6, light: 1, mountFar: "#86b0d4", mountNear: "#5a8a6c", sun: 0.8 },
    { name: "Tarde", skyTop: "#2f7dd6", skyBot: "#ffd59e", grass1: "#6a9f3a", grass2: "#5f8f33", road1: "#66656b", road2: "#616066", rumble1: "#ffffff", rumble2: "#c0392b", lane: "#ffffff", fog: "#f5d6a8", fogDensity: 0.8, light: 0.95, mountFar: "#9a8fb0", mountNear: "#5d6f45", sun: 0.6 },
    { name: "Pôr do sol", skyTop: "#3b1d5c", skyBot: "#ff7a45", grass1: "#3e5a26", grass2: "#36501f", road1: "#4b4550", road2: "#47414c", rumble1: "#e0d0c8", rumble2: "#9b2c2c", lane: "#f3e3d3", fog: "#ff8f5a", fogDensity: 1.1, light: 0.6, mountFar: "#7a3f6a", mountNear: "#3b2440", sun: 0.05 },
    { name: "Noite", skyTop: "#03040f", skyBot: "#131a3d", grass1: "#0b1a0e", grass2: "#09150b", road1: "#18181d", road2: "#16161b", rumble1: "#4a4a50", rumble2: "#3a1515", lane: "#5a5a60", fog: "#0d1230", fogDensity: 1.6, light: 0.15, mountFar: "#141838", mountNear: "#0b0e22", sun: -1 },
    { name: "Neblina", skyTop: "#3a3f4a", skyBot: "#7d8590", grass1: "#2c3a2c", grass2: "#283528", road1: "#3a3a40", road2: "#37373d", rumble1: "#8a8a90", rumble2: "#5a2a2a", lane: "#9a9aa0", fog: "#7d8590", fogDensity: 5.5, light: 0.35, mountFar: "#6a707b", mountNear: "#555b66", sun: -1 },
    { name: "Madrugada", skyTop: "#0b0d26", skyBot: "#3a2a5a", grass1: "#14241a", grass2: "#112016", road1: "#232329", road2: "#212127", rumble1: "#5a5a60", rumble2: "#4a1c1c", lane: "#6a6a70", fog: "#2a2148", fogDensity: 1.5, light: 0.25, mountFar: "#241c46", mountNear: "#16122e", sun: -1 },
];

// Nos dias pares, o meio-dia vira neve (pista escorregadia).
const SNOW_PHASE = { name: "Neve", skyTop: "#8fa6bd", skyBot: "#e8f0f7", grass1: "#f2f6fa", grass2: "#e3eaf1", road1: "#8a8f96", road2: "#858a91", rumble1: "#ffffff", rumble2: "#c0392b", lane: "#ffffff", fog: "#e8f0f7", fogDensity: 2.2, light: 0.9, mountFar: "#c6d3e0", mountNear: "#9fb0c2", sun: -1, snow: true };

const DAY_LEN = PHASES.length * PHASE_LEN;

// =====================================================================
// Utilitários
// =====================================================================

const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
};

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (a, b, t) => a + (b - a) * t * t;
const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hslToRgb = (h, s, l) => {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
};
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const wrapZ = (z) => ((z % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
// Distância relativa na pista circular, no intervalo (-L/2, L/2]
const relZ = (z) => {
    let d = wrapZ(z);
    if (d > TRACK_LEN / 2) d -= TRACK_LEN;
    return d;
};

// Paleta convertida para RGB (para interpolar entre fases)
const toPalette = (p) => {
    const out = { ...p };
    ["skyTop", "skyBot", "grass1", "grass2", "road1", "road2", "rumble1", "rumble2", "lane", "fog", "mountFar", "mountNear"]
        .forEach((k) => (out[k] = hexToRgb(p[k])));
    return out;
};
const PALETTES = PHASES.map(toPalette);
const SNOW_PALETTE = toPalette(SNOW_PHASE);

const blendPalette = (a, b, t) => {
    const out = {};
    Object.keys(a).forEach((k) => {
        if (Array.isArray(a[k])) out[k] = mixRgb(a[k], b[k], t);
        else if (typeof a[k] === "number") out[k] = lerp(a[k], b[k], t);
        else out[k] = t < 0.5 ? a[k] : b[k];
    });
    out.snowAmount = (a.snow ? 1 - t : 0) + (b.snow ? t : 0);
    return out;
};

// =====================================================================
// Pista procedural (retas e curvas suaves)
// =====================================================================

const segments = [];

const buildTrack = () => {
    segments.length = 0;
    const add = (curve) => segments.push({ index: segments.length, curve });
    const addRoad = (enter, hold, leave, curve) => {
        for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter));
        for (let i = 0; i < hold; i++) add(curve);
        for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave));
    };
    addRoad(0, 120, 0, 0); // largada reta
    while (segments.length < TRACK_SEGS - 150) {
        const r = Math.random();
        if (r < 0.3) addRoad(0, Math.floor(rand(60, 160)), 0, 0);
        else {
            const curve = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 5.5);
            const len = Math.floor(rand(40, 110));
            addRoad(len, Math.floor(rand(40, 140)), len, curve);
        }
    }
    while (segments.length < TRACK_SEGS) add(0);
    segments.length = TRACK_SEGS; // a última curva pode passar do tamanho da pista

    // Objetos à beira da pista
    segments.forEach((seg, i) => {
        seg.sprites = [];
        if (i < 10) return;
        if (i % 6 === 0) {
            seg.sprites.push({ type: "post", offset: -1.25 });
            seg.sprites.push({ type: "post", offset: 1.25 });
        }
        if (i % 11 === 0) seg.sprites.push({ type: "tree", offset: -rand(1.6, 3.4), scale: rand(0.8, 1.3) });
        if (i % 13 === 0) seg.sprites.push({ type: "tree", offset: rand(1.6, 3.4), scale: rand(0.8, 1.3) });
        if (i % 97 === 0) seg.sprites.push({ type: "sign", offset: Math.random() < 0.5 ? -1.6 : 1.6, dir: Math.sign(segments[Math.min(i + 30, segments.length - 1)].curve) });
    });
};

// =====================================================================
// Montanhas e estrelas (geradas uma vez)
// =====================================================================

const makeRidge = (points, minH, maxH) => {
    const ridge = [];
    for (let i = 0; i <= points; i++) ridge.push(rand(minH, maxH));
    ridge[points] = ridge[0]; // emenda sem costura ao repetir
    return ridge;
};
const RIDGE_FAR = makeRidge(24, 0.25, 1);
const RIDGE_NEAR = makeRidge(16, 0.15, 0.7);
const STARS = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.9, r: rand(0.4, 1.4), tw: rand(0, 6) }));

// Nuvens: de vez em quando uma nuvem surge, fica um tempo andando com o vento e some suavemente.
// age < 0 é o tempo de espera (céu sem aquela nuvem); depois de "life" segundos ela some e volta a esperar.
const CLOUD_FADE = 6; // segundos para aparecer e para sumir
const makeCloud = (first = false) => {
    const puffs = [];
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        puffs.push({
            dx: (t - 0.5) * 2.6 + rand(-0.15, 0.15),
            dy: -Math.sin(t * Math.PI) * rand(0.16, 0.36),
            r: rand(0.38, 0.6) * (0.78 + Math.sin(t * Math.PI) * 0.38),
        });
    }
    return {
        x: Math.random(),
        y: rand(0.15, 0.62),
        size: rand(0.7, 1.35),
        drift: rand(0.004, 0.012) * (Math.random() < 0.5 ? -1 : 1),
        life: rand(22, 45),
        age: first ? rand(-25, 30) : -rand(8, 35),
        puffs,
    };
};
const CLOUDS = Array.from({ length: 6 }, () => makeCloud(true));

const updateClouds = (dt) => {
    CLOUDS.forEach((c, i) => {
        c.age += dt;
        c.x += c.drift * dt * 0.1;
        if (c.age > c.life) CLOUDS[i] = makeCloud();
    });
};

// =====================================================================
// Som (motor grave e suave, sem o "zumbido" estridente)
// =====================================================================

const sound = {
    ctx: null,
    master: null,
    engine: null,
    enabled: storage.get(SOUND_KEY) !== "0",

    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.enabled ? 0.5 : 0;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
    },

    // Motor: dois osciladores graves (dente de serra + triângulo uma oitava abaixo) passando por um
    // filtro passa-baixa que abre com a rotação, mais um ronco de ruído filtrado. Volume baixo.
    startEngine() {
        const ctx = this.ensure();
        if (!ctx || this.engine) return;
        const saw = ctx.createOscillator();
        saw.type = "sawtooth";
        const sub = ctx.createOscillator();
        sub.type = "triangle";
        const lfo = ctx.createOscillator(); // leve vibração do motor
        lfo.frequency.value = 9;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 1.2;
        lfo.connect(lfoGain);
        lfoGain.connect(saw.frequency);
        lfoGain.connect(sub.frequency);

        const sawGain = ctx.createGain();
        sawGain.gain.value = 0.35;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.8;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.Q.value = 0.6;
        filter.frequency.value = 200;

        // Ronco: ruído filtrado bem grave
        const noiseLen = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.value = 140;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.05;

        const out = ctx.createGain();
        out.gain.value = 0;

        saw.connect(sawGain).connect(filter);
        sub.connect(subGain).connect(filter);
        noise.connect(noiseFilter).connect(noiseGain).connect(filter);
        filter.connect(out).connect(this.master);

        [saw, sub, lfo, noise].forEach((n) => n.start());
        this.engine = { saw, sub, filter, out, noiseGain, nodes: [saw, sub, lfo, noise] };
    },

    updateEngine(speedRatio, offroad, running) {
        if (!this.engine) return;
        const t = this.ctx.currentTime;
        // Rotação simulada com 5 marchas
        const gears = 5;
        const g = Math.min(gears - 1, Math.floor(speedRatio * gears));
        const inGear = speedRatio * gears - g;
        const rpm = 0.3 + 0.7 * clamp(inGear, 0, 1);
        const freq = 34 + rpm * 48 + g * 5;
        this.engine.saw.frequency.setTargetAtTime(freq, t, 0.06);
        this.engine.sub.frequency.setTargetAtTime(freq / 2, t, 0.06);
        this.engine.filter.frequency.setTargetAtTime(170 + rpm * 520 + speedRatio * 200, t, 0.08);
        this.engine.noiseGain.gain.setTargetAtTime(offroad ? 0.35 : 0.05 + speedRatio * 0.05, t, 0.1);
        this.engine.out.gain.setTargetAtTime(running ? 0.16 + speedRatio * 0.08 : 0, t, 0.15);
    },

    noise(duration, freq, gain, decay = 5, type = "lowpass") {
        const ctx = this.ensure();
        if (!ctx) return;
        const len = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / len) * decay);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(f).connect(g).connect(this.master);
        src.start();
    },

    tone(freq, duration, gain = 0.1, delay = 0, type = "triangle") {
        const ctx = this.ensure();
        if (!ctx) return;
        const t = ctx.currentTime + delay;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + duration + 0.05);
    },

    crash() {
        this.noise(0.6, 900, 0.9, 6);
        this.tone(60, 0.35, 0.4, 0, "sine");
    },
    pass() {
        this.noise(0.25, 1800, 0.12, 5, "bandpass");
    },
    goal() {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 0.12, i * 0.1));
    },
    newDay() {
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.35, 0.1, i * 0.14));
    },
    nitro() {
        this.noise(0.9, 700, 0.35, 2.5, "bandpass");
        this.tone(160, 0.5, 0.08, 0, "sawtooth");
    },
    beep(go) {
        this.tone(go ? 880 : 440, go ? 0.5 : 0.22, 0.14, 0, "square");
    },
    gameOver() {
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, 0.12, i * 0.2));
    },

    toggle() {
        this.enabled = !this.enabled;
        storage.set(SOUND_KEY, this.enabled ? "1" : "0");
        if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0;
    },
};

// =====================================================================
// Estado
// =====================================================================

const best = (() => {
    const empty = { km: 0, day: 0, race: 0, medals: {} }; // medals: { corrida: melhor posição }
    try {
        const saved = { ...empty, ...JSON.parse(storage.get(BEST_KEY)) };
        saved.medals = saved.medals || {};
        return saved;
    } catch { return empty; }
})();

const state = {
    phase: "start", // start | countdown | playing | paused | dayDone | over | victory | finished
    resumePhase: "playing", // fase para onde a pausa volta
    mode: "endurance", // endurance | race
    position: 0,
    dist: 0, // distância total da câmera (sem dar a volta na pista)
    playerX: 0,
    speed: 0,
    day: 1,
    dayTime: 0,
    passed: 0,
    quota: BASE_QUOTA,
    goalReached: false,
    km: 0,
    dayResult: null, // resumo do dia que acabou de terminar
    // Corrida
    level: 1,
    startZ: 0, // linha de largada (z do mundo, sem dar a volta)
    finishZ: 0, // linha de chegada
    raceUnits: 0,
    raceKm: 0,
    countdown: 0,
    raceTime: 0,
    finishPos: 0,
    lapsTotal: 0, // 0 = corrida por distância
    lap: 1,
    lines: [], // linhas da corrida: largada, voltas e chegada
    newMedal: false,
    nitro: 0, // carga do nitro (0 a 1)
    nitroOn: false,
    needle: 0, // ponteiro do velocímetro analógico (km/h, suavizado)
    bgOffset: 0,
    shake: 0,
    crashTimer: 0,
    time: 0,
    steer: 0,
    cars: [],
    particles: [],
    popups: [],
    palette: PALETTES[0],
};

const input = { left: false, right: false, gas: false, brake: false };
// Mouse/dedo: x = posição desejada na pista (null = sem controle pelo ponteiro);
// botão esquerdo acelera e o direito freia.
const pointer = { x: null, gas: false, brake: false };
const braking = () => input.brake || pointer.brake;

// Número do i-ésimo carro adversário (1, 2, 3... pulando o número do jogador)
const rivalNumber = (i) => {
    const n = i + 1;
    return n >= playerCar().number ? n + 1 : n;
};

const createCars = () => {
    state.cars = [];
    for (let i = 0; i < N_CARS; i++) {
        const z = PLAYER_Z + 3000 + (i / N_CARS) * (TRACK_LEN - 6000) + rand(-400, 400);
        const hue = rand(0, 360);
        state.cars.push({
            rgb: hslToRgb(hue, rand(0.55, 0.85), rand(0.42, 0.58)),
            number: rivalNumber(i),
            z: wrapZ(z),
            dist: z,
            accel: 0.15,
            offset: LANES[Math.floor(Math.random() * 3)] + rand(-0.08, 0.08),
            speed: 0,
            cruise: MAX_SPEED * rand(0.22, 0.5), // velocidade que o carro gosta de andar
            target: 0, // faixa de destino (offset)
            bump: 0, // segundos balançando depois de uma batida
            lastRel: 0,
        });
    }
    state.cars.forEach((car) => {
        car.speed = car.cruise;
        car.target = car.offset;
    });
};

// Corrida: rivais no grid atrás da linha de largada, todos parados. O jogador larga na última fila.
const createRivals = (level) => {
    state.cars = [];
    const rows = Math.ceil((N_RIVALS + 1) / 3);
    state.startZ = PLAYER_Z + SEG_LEN * (1 + GRID_ROW_GAP * (rows - 1));
    const base = Math.min(0.9, 0.6 + 0.035 * (level - 1));
    let slot = 0;
    for (let i = 0; i < N_RIVALS; i++) {
        // a última fila tem o jogador no meio
        if (Math.floor(slot / 3) === rows - 1 && slot % 3 === 1) slot++;
        const row = Math.floor(slot / 3);
        const lane = LANES[slot % 3];
        slot++;
        const z = state.startZ - SEG_LEN * (1 + GRID_ROW_GAP * row);
        const hue = (i * 360) / N_RIVALS + rand(-10, 10);
        state.cars.push({
            rgb: hslToRgb(hue, rand(0.6, 0.85), rand(0.42, 0.56)),
            number: rivalNumber(i),
            z: wrapZ(z),
            dist: z,
            offset: lane,
            target: lane,
            speed: 0,
            cruise: MAX_SPEED * Math.min(0.98, base + rand(0, 0.22)),
            accel: 0.2,
            bump: 0,
            lastRel: 0,
        });
    }
};

const quotaFor = (day) => BASE_QUOTA + QUOTA_STEP * (day - 1);

const resetCommon = () => {
    Object.assign(state, {
        position: 0,
        dist: 0,
        playerX: 0,
        speed: 0,
        dayTime: 0,
        km: 0,
        shake: 0,
        crashTimer: 0,
        steer: 0,
        particles: [],
        popups: [],
        dayResult: null,
        nitro: 0,
        nitroOn: false,
    });
};

const startRace = (level) => {
    resetCommon();
    const laps = settings.laps; // 0 = por distância
    const raceUnits = laps ? laps * TRACK_LEN : raceKmFor(level) / KM_PER_UNIT;
    Object.assign(state, {
        mode: "race",
        phase: "countdown",
        level,
        day: level, // nas corridas pares o meio-dia tem neve
        dayTime: RACE_START_PHASE[(level - 1) % RACE_START_PHASE.length] * PHASE_LEN,
        raceKm: Math.round(raceUnits * KM_PER_UNIT * 10) / 10,
        raceUnits,
        lapsTotal: laps,
        lap: 1,
        newMedal: false,
        countdown: COUNTDOWN,
        raceTime: 0,
        finishPos: 0,
        passed: 0,
        goalReached: false,
    });
    createRivals(level);
    state.finishZ = state.startZ + state.raceUnits;
    // Linhas pintadas na pista: largada, uma por volta e chegada (todas no mesmo ponto no modo voltas)
    state.lines = [{ z: state.startZ, kind: "start" }];
    for (let k = 1; k < laps; k++) {
        state.lines.push({ z: state.startZ + k * TRACK_LEN, kind: "lap", label: k + 1 === laps ? "ÚLTIMA VOLTA" : `VOLTA ${k + 1}` });
    }
    state.lines.push({ z: state.finishZ, kind: "finish" });
    state.cars.forEach((car) => (car.lastRel = relZ(car.z - (state.position + PLAYER_Z))));
    sound.startEngine();
    sound.beep(false);
};

const resetGame = () => {
    resetCommon();
    Object.assign(state, {
        mode: "endurance",
        phase: "playing",
        position: 0,
        playerX: 0,
        speed: 0,
        day: 1,
        dayTime: 0,
        passed: 0,
        quota: quotaFor(1),
        goalReached: false,
        km: 0,
        shake: 0,
        crashTimer: 0,
        particles: [],
        popups: [],
    });
    createCars();
    state.cars.forEach((car) => (car.lastRel = relZ(car.z - (state.position + PLAYER_Z))));
    popup("DIA 1", "#ffd36b");
    sound.startEngine();
    sound.newDay();
};

const popup = (text, color = "#ffffff") => state.popups.push({ text, color, t: 0 });

// =====================================================================
// Atualização
// =====================================================================

const currentPalette = () => {
    const time = state.dayTime % DAY_LEN; // no resumo do fim do dia o relógio fica parado no fim
    const phaseIdx = Math.floor(time / PHASE_LEN) % PHASES.length;
    const within = time - phaseIdx * PHASE_LEN;
    const isSnowDay = state.day % 2 === 0;
    const pal = (i) => (i === 2 && isSnowDay ? SNOW_PALETTE : PALETTES[i]);
    const a = pal(phaseIdx);
    const b = pal((phaseIdx + 1) % PHASES.length);
    const t = within > PHASE_LEN - BLEND ? (within - (PHASE_LEN - BLEND)) / BLEND : 0;
    return blendPalette(a, b, t);
};

const findSegment = (z) => segments[Math.floor(wrapZ(z) / SEG_LEN) % TRACK_SEGS];

const addParticle = (p) => state.particles.push(p);

const update = (dt) => {
    state.time += dt;
    if (state.phase !== "paused") updateClouds(dt);
    state.popups.forEach((p) => (p.t += dt));
    state.popups = state.popups.filter((p) => p.t < 2);
    updateParticles(dt);
    state.palette = currentPalette();

    // Ponteiro do velocímetro: segue a velocidade com um pouco de atraso
    const kmhNow = (state.speed / MAX_SPEED) * KMH_AT_MAX;
    state.needle = lerp(state.needle, kmhNow, Math.min(1, dt * 8));

    const running = state.phase === "playing";
    const countdown = state.phase === "countdown";
    sound.updateEngine(state.speed / MAX_SPEED, Math.abs(state.playerX) > 1, running || countdown);
    if (countdown) {
        // Farol vermelho: ninguém sai do lugar. Um bipe por segundo; no zero, verde.
        const before = Math.ceil(state.countdown);
        state.countdown -= dt;
        if (state.countdown <= 0) {
            state.countdown = 0;
            state.phase = "playing";
            popup("VAI!", "#5dff8a");
            sound.beep(true);
        } else if (Math.ceil(state.countdown) !== before) {
            sound.beep(false);
        }
        return;
    }
    if (!running) return;

    const pal = state.palette;
    const playerSeg = findSegment(state.position + PLAYER_Z);
    const speedRatio = state.speed / MAX_SPEED;
    const dx = dt * 2 * speedRatio;
    const grip = 1 - 0.45 * pal.snowAmount; // neve: menos aderência
    const crashed = state.crashTimer > 0;
    state.crashTimer = Math.max(0, state.crashTimer - dt);

    // Direção (com leve inércia, mais forte na neve)
    const keySteer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const pointerSteer = pointer.x === null ? 0 : clamp((pointer.x - state.playerX) * 3, -1, 1);
    const target = crashed ? 0 : keySteer || pointerSteer;
    state.steer = lerp(state.steer, target, Math.min(1, dt * (6 * grip + 2)));
    state.playerX += state.steer * dx * (0.6 + 0.4 * grip);
    state.playerX -= dx * speedRatio * playerSeg.curve * CENTRIFUGAL;

    // Aceleração
    const prevSpeed = state.speed;
    if (crashed) state.nitroOn = false;
    if (state.nitroOn) {
        state.nitro = Math.max(0, state.nitro - dt / NITRO_DURATION);
        if (state.nitro <= 0) state.nitroOn = false;
    } else {
        state.nitro = Math.min(1, state.nitro + NITRO_IDLE * dt);
    }

    if (crashed) state.speed += DECEL * dt;
    else if (state.nitroOn) state.speed += ACCEL * 1.8 * dt; // o nitro empurra mesmo sem acelerar
    else if (input.gas || pointer.gas) state.speed += ACCEL * dt;
    else if (braking()) state.speed += BRAKE * dt;
    else state.speed += DECEL * dt;

    const offroad = Math.abs(state.playerX) > 1;
    if (offroad && state.speed > OFFROAD_LIMIT) state.speed += OFFROAD_DECEL * dt;
    // Acabando o nitro, a velocidade volta ao normal aos poucos
    const cap = state.nitroOn ? NITRO_MAX_SPEED : Math.max(MAX_SPEED, prevSpeed - MAX_SPEED * 0.4 * dt);
    state.speed = clamp(state.speed, 0, cap);
    state.playerX = clamp(state.playerX, -2.4, 2.4);

    // Fundo acompanha as curvas
    state.bgOffset += playerSeg.curve * speedRatio * dt * 0.05;

    state.position = wrapZ(state.position + state.speed * dt);
    state.dist += state.speed * dt;
    state.km += state.speed * dt * KM_PER_UNIT;

    // Partículas do carro
    const carScreen = playerScreen();
    if (offroad && state.speed > 500) {
        for (let i = 0; i < 2; i++) {
            addParticle({
                kind: "dust", x: carScreen.x + rand(-carScreen.w * 0.45, carScreen.w * 0.45), y: carScreen.y - 4,
                vx: rand(-60, 60), vy: rand(-90, -30), life: rand(0.4, 0.8), size: rand(5, 11),
                color: pal.snowAmount > 0.5 ? [240, 245, 250] : [150, 120, 80],
            });
        }
        state.shake = Math.max(state.shake, 3 * speedRatio);
    }
    if (state.nitroOn) {
        for (let i = 0; i < 3; i++) {
            addParticle({
                kind: "spark", x: carScreen.x + carScreen.w * (Math.random() < 0.5 ? -0.28 : 0.28) + rand(-3, 3),
                y: carScreen.y - carScreen.h * 0.12, vx: rand(-40, 40), vy: rand(40, 140), life: rand(0.12, 0.3),
                size: rand(2, 5), color: Math.random() < 0.5 ? [120, 190, 255] : [255, 170, 60],
            });
        }
    }
    if (state.speed > 300 && Math.random() < 0.5) {
        addParticle({
            kind: "smoke", x: carScreen.x + carScreen.w * (Math.random() < 0.5 ? -0.28 : 0.28), y: carScreen.y - carScreen.h * 0.15,
            vx: rand(-15, 15), vy: rand(10, 40), life: rand(0.3, 0.6), size: rand(3, 6), color: [200, 200, 210],
        });
    }

    updateCars(dt);
    state.shake = Math.max(0, state.shake - dt * 30);

    if (state.mode === "race") {
        // Na corrida o dia passa devagar (só para mudar o cenário)
        state.dayTime = (state.dayTime + dt * 0.35) % DAY_LEN;
        state.raceTime += dt;
        if (state.lapsTotal) {
            const lap = Math.min(state.lapsTotal, Math.floor(Math.max(0, raceProgress()) / TRACK_LEN) + 1);
            if (lap > state.lap) {
                state.lap = lap;
                popup(lap === state.lapsTotal ? "ÚLTIMA VOLTA!" : `VOLTA ${lap}`, "#8fe3ff");
                sound.newDay();
            }
        }
        if (raceProgress() >= state.raceUnits) finishRace();
        return;
    }

    // Relógio do dia
    state.dayTime += dt;
    if (!state.goalReached && state.passed >= state.quota) {
        state.goalReached = true;
        popup("META ATINGIDA!", "#7dffb0");
        sound.goal();
    }
    if (state.dayTime >= DAY_LEN) {
        if (!state.goalReached) endGame();
        else if (state.day >= MAX_DAYS) winEndurance();
        else {
            // Dia completo: pausa com o resumo e o que vem no próximo dia
            state.dayResult = { day: state.day, passed: state.passed, quota: state.quota };
            state.phase = "dayDone";
            Object.keys(input).forEach((k) => (input[k] = false));
            pointer.gas = pointer.brake = false;
            sound.goal();
        }
    }
};

const activateNitro = () => {
    if (state.phase !== "playing" || state.nitroOn || state.nitro < NITRO_MIN || state.crashTimer > 0) return;
    state.nitroOn = true;
    state.shake = Math.max(state.shake, 5);
    sound.nitro();
};

const nextDay = () => {
    state.day++;
    state.dayTime = 0;
    state.passed = 0;
    state.quota = quotaFor(state.day);
    state.goalReached = false;
    state.dayResult = null;
    state.cars.forEach((car) => (car.cruise = Math.min(MAX_SPEED * 0.7, car.cruise * 1.06)));
    state.phase = "playing";
    popup(`DIA ${state.day}`, "#ffd36b");
    sound.newDay();
};

// ---------- Corrida ----------
const playerWorldZ = () => state.dist + PLAYER_Z;
const raceProgress = () => playerWorldZ() - state.startZ;
const racePosition = () => 1 + state.cars.filter((car) => car.dist > playerWorldZ()).length;

const saveBest = () => storage.set(BEST_KEY, JSON.stringify(best));

const finishRace = () => {
    state.finishPos = racePosition();
    state.phase = "finished";
    Object.keys(input).forEach((k) => (input[k] = false));
    pointer.gas = pointer.brake = false;
    if (state.level > best.race) best.race = state.level;
    const prev = best.medals[state.level] || 99;
    state.newMedal = state.finishPos <= 3 && state.finishPos < prev;
    if (state.finishPos < prev) best.medals[state.level] = state.finishPos;
    saveBest();
    sound.goal();
};

const winEndurance = () => {
    state.phase = "victory";
    best.day = MAX_DAYS;
    best.km = Math.max(best.km, state.km);
    saveBest();
    sound.goal();
};

// ---------- Tráfego: os carros não se atravessam ----------
const CAR_LEN = SEG_LEN * 0.8; // comprimento do carro na pista
const LOOK_AHEAD = SEG_LEN * 10; // até onde o motorista enxerga
const SIDE_GAP = CAR_HALF * 2.1; // abaixo disso, dois carros dividem a faixa

// Algo ocupando a faixa `offset` entre `from` e `to` (relativo ao carro)?
const laneBlocked = (car, offset, from, to, playerZ) => {
    const busy = (z, off) => {
        const d = relZ(z - car.z);
        return d > from && d < to && Math.abs(off - offset) < SIDE_GAP;
    };
    if (busy(playerZ, state.playerX)) return true;
    return state.cars.some((o) => o !== car && (busy(o.z, o.offset) || busy(o.z, o.target)));
};

const bumpSound = (rel) => {
    // Só se ouve a batida quando ela acontece perto do jogador
    if (Math.abs(rel) < SEG_LEN * 30) sound.crash();
};

const updateTraffic = (dt, playerZ) => {
    state.cars.forEach((car) => {
        car.bump = Math.max(0, car.bump - dt);
        // Obstáculo mais próximo à frente na mesma faixa (outro carro ou o jogador)
        let ahead = null;
        let gap = Infinity;
        const consider = (z, offset, speed, isPlayer) => {
            const d = relZ(z - car.z);
            if (d > 0 && d < LOOK_AHEAD && d < gap && Math.abs(offset - car.offset) < SIDE_GAP) {
                gap = d;
                ahead = { speed, isPlayer, offset };
            }
        };
        if (state.phase === "playing") consider(playerZ, state.playerX, state.speed, true);
        state.cars.forEach((o) => o !== car && consider(o.z, o.offset, o.speed, false));

        let want = car.cruise;
        if (ahead && ahead.speed < car.cruise) {
            // Tenta ultrapassar pela faixa vizinha livre; senão, segue atrás
            const changing = Math.abs(car.target - car.offset) > 0.02;
            if (!changing) {
                const lane = LANES.reduce((best, l) => (Math.abs(l - car.offset) < Math.abs(best - car.offset) ? l : best), LANES[0]);
                const options = LANES.filter((l) => l !== lane && Math.abs(l - lane) < 0.7)
                    .sort(() => Math.random() - 0.5);
                const free = options.find((l) => !laneBlocked(car, l, -CAR_LEN * 2, CAR_LEN * 6, playerZ));
                if (free !== undefined) car.target = free + rand(-0.06, 0.06);
            }
            if (gap < CAR_LEN * 5) want = Math.min(want, ahead.speed * (gap < CAR_LEN * 2 ? 0.9 : 1));
        }
        const rate = want < car.speed ? MAX_SPEED * 0.9 : MAX_SPEED * car.accel; // freia forte, acelera devagar
        car.speed += clamp(want - car.speed, -rate * dt, rate * dt);
        car.offset += clamp(car.target - car.offset, -0.7 * dt, 0.7 * dt);

        // Encostou mesmo assim: batida
        if (ahead && gap < CAR_LEN && car.speed > ahead.speed) {
            const rel = relZ(car.z - playerZ);
            car.speed = ahead.speed * 0.8;
            car.bump = 0.6;
            car.target = clamp(car.offset + (car.offset <= ahead.offset ? -0.25 : 0.25), -0.9, 0.9);
            if (ahead.isPlayer) {
                // Bateram na sua traseira: tranco e um empurrãozinho
                state.shake = Math.max(state.shake, 8);
                state.speed = Math.min(MAX_SPEED, state.speed + MAX_SPEED * 0.05);
            } else {
                const other = state.cars.find((o) => o !== car && relZ(o.z - car.z) === gap);
                if (other) {
                    other.bump = 0.6;
                    other.speed = Math.min(other.speed + MAX_SPEED * 0.03, other.cruise);
                }
            }
            bumpSound(rel);
        }
    });
};

const updateCars = (dt) => {
    const playerZ = state.position + PLAYER_Z;
    updateTraffic(dt, playerZ);
    state.cars.forEach((car) => {
        car.dist += car.speed * dt;
        car.z = wrapZ(car.dist);
        const rel = relZ(car.z - playerZ);

        // Ultrapassagens: o carro passou de "à frente" para "atrás" (ou o contrário)
        if (Math.abs(rel - car.lastRel) < TRACK_LEN / 4) {
            if (car.lastRel > 0 && rel <= 0) {
                if (state.mode === "endurance") state.passed++;
                state.nitro = Math.min(1, state.nitro + NITRO_PASS[state.mode]);
                sound.pass();
            } else if (car.lastRel <= 0 && rel > 0 && state.mode === "endurance" && !state.goalReached) {
                // Fui ultrapassado: a conta de carros que faltam volta a subir.
                // Depois que a meta do dia foi batida ela fica garantida e o contador não diminui mais.
                state.passed = Math.max(0, state.passed - 1);
            }
        }
        car.lastRel = rel;

        // Colisão
        if (state.crashTimer <= 0 && rel > -SEG_LEN * 0.6 && rel < SEG_LEN * 0.9 &&
            Math.abs(car.offset - state.playerX) < CAR_HALF * 1.8 && state.speed > car.speed) {
            crash(car);
        }
    });
};

const crash = (car) => {
    state.speed = car.speed * 0.55;
    state.crashTimer = 0.8;
    state.shake = 14;
    state.nitroOn = false;
    state.playerX += state.playerX < car.offset ? -0.18 : 0.18;
    // recua para trás do carro atingido (sem contar ultrapassagem)
    const before = state.position;
    state.position = wrapZ(car.z - PLAYER_Z - SEG_LEN);
    state.dist += relZ(state.position - before);
    car.lastRel = relZ(car.z - (state.position + PLAYER_Z));
    sound.crash();
    const p = playerScreen();
    for (let i = 0; i < 26; i++) {
        addParticle({
            kind: "spark", x: p.x + rand(-p.w * 0.3, p.w * 0.3), y: p.y - p.h * 0.7,
            vx: rand(-260, 260), vy: rand(-320, -60), life: rand(0.3, 0.7), size: rand(2, 4), color: [255, rand(160, 230), 80],
        });
    }
};

const endGame = () => {
    state.phase = "over";
    sound.gameOver();
    if (state.km > best.km || state.day > best.day) {
        best.km = Math.max(best.km, state.km);
        best.day = Math.max(best.day, state.day);
        saveBest();
    }
};

const updateParticles = (dt) => {
    state.particles = state.particles.filter((p) => {
        p.life -= dt;
        if (p.life <= 0) return false;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "spark") p.vy += 700 * dt;
        if (p.kind === "dust" || p.kind === "smoke") p.size += dt * 14;
        return true;
    });

    // Neve caindo
    const snow = state.palette.snowAmount || 0;
    if (snow > 0.05) {
        const count = Math.floor(snow * 4);
        for (let i = 0; i < count; i++) {
            addParticle({
                kind: "snow", x: rand(-50, view.w + 50), y: -10, vx: rand(-30, 30) - state.steer * 60,
                vy: rand(80, 200) + (state.speed / MAX_SPEED) * 160, life: 4, size: rand(1, 3), color: [255, 255, 255],
            });
        }
    }
};

// =====================================================================
// Desenho
// =====================================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const view = { w: 960, h: 540, scale: 1, horizon: 540 * 0.42 };

const fitCanvas = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    // Mantém pelo menos 300 de largura lógica; em telas em pé a altura lógica cresce.
    view.w = Math.max(300, (cw / ch) * 540);
    view.h = (view.w * ch) / cw;
    view.horizon = view.h * 0.42;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    view.scale = canvas.width / view.w;
};

// Posição/tamanho do carro do jogador na tela
const playerScreen = () => {
    const w = (CAR_W / CAM_H) * (view.w / 2) * 1.05;
    const h = w * 0.55;
    const bounce = state.speed > 0 ? Math.sin(state.time * 30) * (state.speed / MAX_SPEED) * 1.2 : 0;
    // Com controles de toque, o carro sobe um pouco para não ficar atrás dos botões
    const lift = isTouch ? Math.min(view.h * 0.1, 70) : 0;
    return { x: view.w / 2, y: view.horizon + view.h / 2 - 6 - lift + bounce, w, h };
};

const poly = (x1, y1, x2, y2, x3, y3, x4, y4, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
};

const drawSky = (pal) => {
    const grad = ctx.createLinearGradient(0, 0, 0, view.horizon);
    grad.addColorStop(0, rgb(pal.skyTop));
    grad.addColorStop(1, rgb(pal.skyBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.horizon + 2);

    // Estrelas quando escurece
    const night = clamp((0.5 - pal.light) / 0.4, 0, 1);
    if (night > 0) {
        STARS.forEach((s) => {
            const tw = 0.6 + 0.4 * Math.sin(state.time * 2 + s.tw);
            ctx.fillStyle = `rgba(255, 255, 255, ${night * tw * 0.9})`;
            const x = ((s.x * view.w - state.bgOffset * 40) % view.w + view.w) % view.w;
            ctx.fillRect(x, s.y * view.horizon, s.r, s.r);
        });
    }

    // Sol (dia) ou lua (noite)
    const sunPos = pal.sun;
    if (sunPos > -0.5) {
        const sx = view.w * 0.72 - state.bgOffset * 60 % view.w;
        const sy = view.horizon * (0.95 - 0.75 * clamp(sunPos, 0, 1));
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 90);
        glow.addColorStop(0, "rgba(255, 245, 200, 0.95)");
        glow.addColorStop(0.15, "rgba(255, 220, 140, 0.8)");
        glow.addColorStop(1, "rgba(255, 180, 100, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - 90, sy - 90, 180, 180);
    } else if (night > 0.3) {
        const mx = view.w * 0.25 - state.bgOffset * 30;
        const wx = ((mx % view.w) + view.w) % view.w;
        ctx.fillStyle = `rgba(235, 240, 255, ${night})`;
        ctx.beginPath();
        ctx.arc(wx, view.horizon * 0.25, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgb(pal.skyTop);
        ctx.beginPath();
        ctx.arc(wx + 7, view.horizon * 0.25 - 4, 14, 0, Math.PI * 2);
        ctx.fill();
    }

    drawClouds(pal);
};

const drawClouds = (pal) => {
    // Cor acompanha a luz do dia: brancas de dia, alaranjadas no pôr do sol, cinzentas e apagadas à noite
    const light = clamp(pal.light, 0, 1);
    const body = mixRgb(pal.skyBot, [255, 255, 255], 0.3 + 0.6 * light);
    const shade = mixRgb(body, pal.skyTop, 0.35);
    const strength = 0.3 + 0.6 * light;
    const wrapW = view.w * 1.6;
    CLOUDS.forEach((c) => {
        if (c.age <= 0) return;
        const fade = clamp(Math.min(c.age, c.life - c.age) / CLOUD_FADE, 0, 1);
        const alpha = fade * fade * (3 - 2 * fade) * strength; // entrada e saída suaves
        if (alpha < 0.01) return;
        const unit = view.w * 0.045 * c.size;
        const cx = ((((c.x * wrapW - state.bgOffset * wrapW * 0.15) % wrapW) + wrapW) % wrapW) - view.w * 0.3;
        const cy = view.horizon * c.y;
        if (cx < -unit * 3 || cx > view.w + unit * 3) return;
        const puffs = (dy) => {
            ctx.beginPath();
            c.puffs.forEach((p) => {
                // bolinhas um pouco achatadas
                ctx.moveTo(cx + p.dx * unit + p.r * unit * 1.2, cy + p.dy * unit + dy);
                ctx.ellipse(cx + p.dx * unit, cy + p.dy * unit + dy, p.r * unit * 1.2, p.r * unit * 0.82, 0, 0, Math.PI * 2);
            });
            ctx.fill();
        };
        // Degradê: topo quase branco, base puxando para a cor do céu
        const top = cy + Math.min(...c.puffs.map((p) => p.dy - p.r * 0.82)) * unit;
        const bottom = cy + Math.max(...c.puffs.map((p) => p.dy + p.r * 0.82)) * unit;
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, rgb(mixRgb(body, [255, 255, 255], 0.6)));
        grad.addColorStop(0.55, rgb(body));
        grad.addColorStop(1, rgb(mixRgb(body, shade, 0.7)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = rgb(mixRgb(shade, pal.skyTop, 0.2));
        puffs(unit * 0.1); // sombra embaixo
        ctx.fillStyle = grad;
        puffs(0);
        ctx.restore();
    });
};

const drawRidge = (ridge, color, height, parallax, snowCaps) => {
    const width = view.w * 1.5;
    const offset = ((state.bgOffset * parallax * width) % width + width) % width;
    const n = ridge.length - 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, view.horizon + 1);
    for (let rep = -1; rep <= 1; rep++) {
        for (let i = 0; i <= n; i++) {
            const x = rep * width + (i / n) * width - offset;
            if (x < -width / n || x > view.w + width / n) continue;
            ctx.lineTo(x, view.horizon - ridge[i] * height);
        }
    }
    ctx.lineTo(view.w, view.horizon + 1);
    ctx.closePath();
    ctx.fill();

    if (snowCaps > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * snowCaps})`;
        for (let rep = -1; rep <= 1; rep++) {
            for (let i = 0; i < n; i++) {
                const h = ridge[i] * height;
                if (h < height * 0.55) continue;
                const x = rep * width + (i / n) * width - offset;
                if (x < -50 || x > view.w + 50) continue;
                ctx.beginPath();
                ctx.moveTo(x, view.horizon - h);
                ctx.lineTo(x - 14, view.horizon - h + 16);
                ctx.lineTo(x + 14, view.horizon - h + 16);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
};

// Projeção 3D → tela
const project = (camX, camZ) => {
    const scale = CAM_DEPTH / camZ;
    return {
        x: view.w / 2 + scale * camX * (view.w / 2),
        y: view.horizon + scale * CAM_H * (view.h / 2),
        w: scale * ROAD_W * (view.w / 2),
        scale,
    };
};

let frameId = 0;

const drawRoad = (pal) => {
    frameId++;
    const baseIdx = Math.floor(state.position / SEG_LEN) % TRACK_SEGS;
    const basePercent = (state.position % SEG_LEN) / SEG_LEN;
    const baseSeg = segments[baseIdx];
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);
    let maxY = view.h;
    const playerWorldX = state.playerX * ROAD_W;
    const visible = [];

    // Chão ao longe (cor da neblina): cobre a faixa entre o horizonte e o último segmento desenhado
    ctx.fillStyle = rgb(mixRgb(pal.fog, pal.grass1, 0.15));
    ctx.fillRect(0, view.horizon, view.w, view.h - view.horizon);

    for (let n = 0; n < DRAW_DIST; n++) {
        const seg = segments[(baseIdx + n) % TRACK_SEGS];
        const looped = seg.index < baseIdx;
        const z1 = seg.index * SEG_LEN - (state.position - (looped ? TRACK_LEN : 0));
        const z2 = z1 + SEG_LEN;
        const p1 = project(x - playerWorldX, z1);
        const p2 = project(x + dx - playerWorldX, z2);
        x += dx;
        dx += seg.curve;

        seg.view = { frame: frameId, p1, p2, clip: maxY, n, fog: Math.exp(-Math.pow(n / DRAW_DIST, 2) * pal.fogDensity) };
        visible.push(seg);

        if (z1 <= CAM_DEPTH || p2.y >= p1.y || p2.y >= maxY) continue;

        const fog = seg.view.fog;
        const alt = Math.floor(seg.index / RUMBLE_LEN) % 2;
        const f = (c) => rgb(mixRgb(pal.fog, c, fog));

        ctx.fillStyle = f(alt ? pal.grass1 : pal.grass2);
        ctx.fillRect(0, p2.y, view.w, p1.y - p2.y + 1);

        const r1 = p1.w / 6, r2 = p2.w / 6;
        poly(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, f(alt ? pal.rumble1 : pal.rumble2));
        poly(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, f(alt ? pal.rumble1 : pal.rumble2));
        poly(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, f(alt ? pal.road1 : pal.road2));

        if (alt) {
            const l1 = p1.w / 32, l2 = p2.w / 32;
            const laneColor = f(pal.lane);
            [-1 / 3, 1 / 3].forEach((lane) => {
                const lx1 = p1.x + p1.w * 2 * lane;
                const lx2 = p2.x + p2.w * 2 * lane;
                poly(lx1 - l1 / 2, p1.y, lx1 + l1 / 2, p1.y, lx2 + l2 / 2, p2.y, lx2 - l2 / 2, p2.y, laneColor);
            });
        }
        // Corrida: faixas quadriculadas de largada e chegada pintadas na pista
        if (state.mode === "race") {
            const abs = state.dist + z1; // z do mundo do começo deste segmento
            const inSeg = (lineZ) => lineZ >= abs && lineZ < abs + SEG_LEN;
            if (state.lines.some((line) => inSeg(line.z))) drawChecker(p1, p2, f);
        }
        maxY = p2.y;
    }
    return visible;
};

const CHECK_LIGHT = [245, 245, 245];
const CHECK_DARK = [22, 22, 26];

const drawChecker = (p1, p2, f) => {
    const rows = 2, cols = 14;
    for (let r = 0; r < rows; r++) {
        const t1 = r / rows, t2 = (r + 1) / rows;
        const ax = lerp(p1.x, p2.x, t1), aw = lerp(p1.w, p2.w, t1), ay = lerp(p1.y, p2.y, t1);
        const bx = lerp(p1.x, p2.x, t2), bw = lerp(p1.w, p2.w, t2), by = lerp(p1.y, p2.y, t2);
        for (let c = 0; c < cols; c++) {
            const u1 = -1 + (2 * c) / cols, u2 = -1 + (2 * (c + 1)) / cols;
            poly(ax + aw * u1, ay, ax + aw * u2, ay, bx + bw * u2, by, bx + bw * u1, by,
                f((r + c) % 2 ? CHECK_DARK : CHECK_LIGHT));
        }
    }
};

// ---------- Objetos (vetoriais) ----------

const darken = (light) => 0.25 + 0.75 * light;

const drawTree = (x, y, w, pal, alpha) => {
    const h = w * 1.9;
    const shade = darken(pal.light);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${90 * shade}, ${60 * shade}, ${35 * shade})`;
    ctx.fillRect(x - w * 0.06, y - h * 0.22, w * 0.12, h * 0.22);
    const green = pal.snowAmount > 0.5 ? [70, 110, 95] : [40, 120, 60];
    for (let i = 0; i < 3; i++) {
        const ty = y - h * 0.18 - i * h * 0.24;
        const tw = w * (0.55 - i * 0.12);
        ctx.fillStyle = rgb(green.map((c) => c * shade * (0.85 + i * 0.1)));
        ctx.beginPath();
        ctx.moveTo(x, ty - h * 0.36);
        ctx.lineTo(x - tw, ty);
        ctx.lineTo(x + tw, ty);
        ctx.closePath();
        ctx.fill();
        if (pal.snowAmount > 0.05) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * pal.snowAmount})`;
            ctx.beginPath();
            ctx.moveTo(x, ty - h * 0.36);
            ctx.lineTo(x - tw * 0.45, ty - h * 0.2);
            ctx.lineTo(x + tw * 0.45, ty - h * 0.2);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
};

const drawPost = (x, y, w, pal, alpha) => {
    const h = w * 2.6;
    ctx.globalAlpha = alpha;
    if (pal.light > 0.35) {
        ctx.fillStyle = "#e8e8e8";
        ctx.fillRect(x - w * 0.12, y - h, w * 0.24, h);
    }
    // refletor (brilha à noite com os faróis)
    ctx.fillStyle = pal.light > 0.35 ? "#ff5a3c" : "#ffb347";
    ctx.fillRect(x - w * 0.12, y - h, w * 0.24, h * 0.18);
    ctx.globalAlpha = 1;
};

const drawSign = (x, y, w, dir, pal, alpha) => {
    const h = w * 1.6;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#555";
    ctx.fillRect(x - w * 0.05, y - h, w * 0.1, h);
    ctx.fillStyle = pal.light > 0.35 ? "#ffcc00" : "#c79a00";
    ctx.fillRect(x - w * 0.5, y - h - w * 0.5, w, w * 0.6);
    ctx.fillStyle = "#222";
    ctx.beginPath();
    const ax = x + (dir || 1) * w * 0.25;
    ctx.moveTo(ax, y - h - w * 0.2);
    ctx.lineTo(ax - (dir || 1) * w * 0.3, y - h - w * 0.38);
    ctx.lineTo(ax - (dir || 1) * w * 0.3, y - h - w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
};

// Carro visto de trás. Na noite só as lanternas aparecem com força.
const drawCar = (x, y, w, color, pal, { alpha = 1, player = false, tilt = 0, braking = false, number = 0 } = {}) => {
    const h = w * 0.55;
    const light = player ? Math.max(pal.light, 0.55) : pal.light;
    const shade = darken(light);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.transform(1, 0, tilt, 1, 0, 0);

    // sombra
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.02, w * 0.55, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // pneus
    ctx.fillStyle = "#111";
    ctx.fillRect(-w * 0.48, -h * 0.28, w * 0.16, h * 0.28);
    ctx.fillRect(w * 0.32, -h * 0.28, w * 0.16, h * 0.28);

    // carroceria (cor escurecida conforme a luz do ambiente)
    ctx.fillStyle = rgb(color.map((c) => c * shade));
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w * 0.5, -h * 0.72, w, h * 0.55, h * 0.14);
    else ctx.rect(-w * 0.5, -h * 0.72, w, h * 0.55);
    ctx.fill();
    // cabine
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.7);
    ctx.lineTo(-w * 0.27, -h);
    ctx.lineTo(w * 0.27, -h);
    ctx.lineTo(w * 0.36, -h * 0.7);
    ctx.closePath();
    ctx.fill();

    // vidro traseiro
    ctx.fillStyle = `rgba(20, 30, 50, ${0.85})`;
    ctx.beginPath();
    ctx.moveTo(-w * 0.31, -h * 0.72);
    ctx.lineTo(-w * 0.24, -h * 0.95);
    ctx.lineTo(w * 0.24, -h * 0.95);
    ctx.lineTo(w * 0.31, -h * 0.72);
    ctx.closePath();
    ctx.fill();

    // motorista dinossauro no carro do jogador
    if (player) {
        ctx.fillStyle = "#34cca3";
        ctx.beginPath();
        ctx.ellipse(-w * 0.08, -h * 0.8, w * 0.07, h * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5b021";
        ctx.beginPath();
        ctx.moveTo(-w * 0.13, -h * 0.88);
        ctx.lineTo(-w * 0.11, -h * 0.95);
        ctx.lineTo(-w * 0.08, -h * 0.89);
        ctx.fill();
    }

    // brilho na carroceria
    ctx.fillStyle = `rgba(255, 255, 255, ${0.18 * light})`;
    ctx.fillRect(-w * 0.45, -h * 0.68, w * 0.9, h * 0.06);

    // placa
    ctx.fillStyle = `rgba(230, 230, 230, ${0.4 + 0.5 * light})`;
    ctx.fillRect(-w * 0.1, -h * 0.36, w * 0.2, h * 0.1);

    // número do carro na traseira (opção do menu)
    if (number && w > 24) {
        const bw = w * 0.24, bh = h * 0.21, by = -h * 0.62;
        ctx.fillStyle = `rgba(248, 248, 248, ${0.5 + 0.5 * light})`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-bw / 2, by, bw, bh, bh * 0.25);
        else ctx.rect(-bw / 2, by, bw, bh);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.font = `900 ${bh * 0.86}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(number), 0, by + bh * 0.54, bw * 0.92);
    }

    // lanternas (acendem mais à noite e na frenagem)
    const lampOn = light < 0.5 || braking;
    ctx.fillStyle = lampOn ? "#ff3b30" : "#a3241d";
    ctx.fillRect(-w * 0.46, -h * 0.56, w * 0.16, h * 0.1);
    ctx.fillRect(w * 0.3, -h * 0.56, w * 0.16, h * 0.1);
    if (lampOn) {
        ctx.globalCompositeOperation = "lighter";
        [-0.38, 0.38].forEach((lx) => {
            const g = ctx.createRadialGradient(lx * w, -h * 0.51, 0, lx * w, -h * 0.51, w * 0.3);
            g.addColorStop(0, `rgba(255, 60, 40, ${braking ? 0.7 : 0.5})`);
            g.addColorStop(1, "rgba(255, 60, 40, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(lx * w - w * 0.3, -h * 0.51 - w * 0.3, w * 0.6, w * 0.6);
        });
    }
    ctx.restore();
};

// Bandeira quadriculada tremulando presa no topo de um poste
const drawFlag = (px, py, dir, u) => {
    const cols = 5, rows = 4;
    const fw = 380 * u, fh = 260 * u;
    const cw = fw / cols, ch = fh / rows;
    for (let c = 0; c < cols; c++) {
        const wave = Math.sin(state.time * 7 + c * 0.9) * 26 * u * (c / cols);
        for (let r = 0; r < rows; r++) {
            ctx.fillStyle = (r + c) % 2 ? "#16161a" : "#f5f5f5";
            const x = dir > 0 ? px + c * cw : px - (c + 1) * cw;
            ctx.fillRect(x, py + r * ch + wave, cw + 0.5, ch + 0.5);
        }
    }
};

// Pórtico sobre a pista: LARGADA (com o farol) ou CHEGADA (quadriculado com bandeiras)
const drawGantry = (x, y, scale, line, pal, alpha) => {
    const kind = line.kind;
    const u = scale * (view.w / 2);
    const half = ROAD_W * 1.14 * u;
    const poleW = Math.max(1, 70 * u);
    const top = y - 2300 * u;
    const bannerH = 420 * u;
    const shade = darken(Math.max(pal.light, 0.45));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgb([200 * shade, 205 * shade, 214 * shade]);
    ctx.fillRect(x - half - poleW / 2, top, poleW, y - top);
    ctx.fillRect(x + half - poleW / 2, top, poleW, y - top);

    if (kind === "finish") {
        const cols = 20, rows = 2;
        const cw = (half * 2) / cols, ch = bannerH / rows;
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                ctx.fillStyle = (r + c) % 2 ? "#16161a" : "#f5f5f5";
                ctx.fillRect(x - half + c * cw, top + r * ch, cw + 0.5, ch + 0.5);
            }
        }
        drawFlag(x - half, top - 300 * u, -1, u);
        drawFlag(x + half, top - 300 * u, 1, u);
    } else {
        ctx.fillStyle = "#1b2133";
        ctx.fillRect(x - half, top, half * 2, bannerH);
        ctx.fillStyle = "#34cca3";
        ctx.fillRect(x - half, top + bannerH - 40 * u, half * 2, 40 * u);
    }

    const size = bannerH * 0.6;
    if (size >= 5) {
        const label = kind === "finish" ? "CHEGADA" : kind === "lap" ? line.label : "LARGADA";
        ctx.font = `900 ${size}px ui-monospace, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (kind === "finish") {
            const tw = ctx.measureText(label).width + size * 0.6;
            ctx.fillStyle = "#c0392b";
            ctx.fillRect(x - tw / 2, top + bannerH * 0.12, tw, bannerH * 0.76);
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, x - (kind === "start" ? half * 0.35 : 0), top + bannerH / 2);
    }

    // Farol da largada (vermelho na contagem, verde depois)
    if (kind === "start") {
        const lr = 70 * u;
        const bw = lr * 7, bh = lr * 2.6;
        const bx = x + half * 0.35 - bw / 2, by = top + (bannerH - bh) / 2;
        ctx.fillStyle = "#07090f";
        ctx.fillRect(bx, by, bw, bh);
        const green = state.phase !== "countdown" && !(state.phase === "paused" && state.resumePhase === "countdown");
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = green ? "#38ff6a" : "#ff2d2d";
            ctx.beginPath();
            ctx.arc(bx + lr * 1.3 + i * lr * 2.2, by + bh / 2, lr * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
};

const drawSprites = (visible, pal) => {
    // Lista de tudo que aparece na pista, desenhado de trás para frente
    const items = [];
    visible.forEach((seg) => {
        if (!seg.view || seg.view.frame !== frameId || seg.view.p1.scale <= 0) return;
        seg.sprites.forEach((s) => items.push({ seg, offset: s.offset, sprite: s, percent: 0 }));
    });

    const baseIdx = Math.floor(state.position / SEG_LEN) % TRACK_SEGS;
    state.cars.forEach((car) => {
        const segIdx = Math.floor(car.z / SEG_LEN) % TRACK_SEGS;
        const n = (segIdx - baseIdx + TRACK_SEGS) % TRACK_SEGS;
        if (n >= DRAW_DIST - 1) return;
        const seg = segments[segIdx];
        if (!seg.view || seg.view.frame !== frameId) return;
        items.push({ seg, offset: car.offset, car, percent: (car.z % SEG_LEN) / SEG_LEN });
    });

    // Pórticos de largada e chegada (só quando estão logo à frente)
    if (state.mode === "race") {
        state.lines.forEach((line) => {
            const ahead = line.z - state.dist;
            if (ahead <= 0 || ahead >= (DRAW_DIST - 2) * SEG_LEN) return;
            const seg = segments[Math.floor(wrapZ(line.z) / SEG_LEN) % TRACK_SEGS];
            if (!seg.view || seg.view.frame !== frameId) return;
            items.push({ seg, offset: 0, gantry: line, percent: 0 });
        });
    }

    // De trás para frente: segmento mais distante primeiro e, dentro do mesmo segmento, o mais longe antes.
    // (Antes o mais longe era pintado por cima do mais perto e o carro parecia trocar de cor.)
    items.sort((a, b) => b.seg.view.n - a.seg.view.n || b.percent - a.percent);

    items.forEach((item) => {
        const { p1, p2, clip, fog, n } = item.seg.view;
        if (n < 1) return;
        const t = item.percent;
        const scale = lerp(p1.scale, p2.scale, t);
        const roadX = lerp(p1.x, p2.x, t);
        const y = lerp(p1.y, p2.y, t);
        const x = roadX + scale * item.offset * ROAD_W * (view.w / 2);
        if (y > clip + 2 && !item.car) return; // escondido atrás de uma curva
        const alpha = clamp(fog * 1.15, 0, 1);

        // Pista plana: objetos nunca ficam atrás de morros, então não é preciso recortar.
        if (item.car) {
            const w = CAR_W * scale * (view.w / 2);
            const tilt = item.car.bump > 0 ? Math.sin(state.time * 40) * 0.1 * (item.car.bump / 0.6) : 0;
            drawCar(x, y, w, item.car.rgb, pal, { alpha, tilt, number: settings.numbers ? item.car.number : 0 });
        } else if (item.gantry) {
            drawGantry(roadX, y, scale, item.gantry, pal, alpha);
        } else {
            const s = item.sprite;
            if (s.type === "tree") drawTree(x, y, 700 * (s.scale || 1) * scale * (view.w / 2), pal, alpha);
            else if (s.type === "post") drawPost(x, y, 90 * scale * (view.w / 2), pal, alpha);
            else if (s.type === "sign") drawSign(x, y, 260 * scale * (view.w / 2), s.dir, pal, alpha);
        }
    });
};

// Faróis do jogador iluminando a pista à noite/neblina
const drawHeadlights = (pal) => {
    const dark = clamp((0.6 - pal.light) / 0.5, 0, 1);
    if (dark <= 0) return;
    const p = playerScreen();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const top = view.horizon + view.h * 0.06;
    const grad = ctx.createLinearGradient(0, p.y - p.h, 0, top);
    grad.addColorStop(0, `rgba(255, 236, 180, ${0.32 * dark})`);
    grad.addColorStop(1, "rgba(255, 236, 180, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x - p.w * 0.38, p.y - p.h * 0.6);
    ctx.lineTo(p.x + p.w * 0.38, p.y - p.h * 0.6);
    ctx.lineTo(p.x + view.w * 0.32 - state.steer * 40, top);
    ctx.lineTo(p.x - view.w * 0.32 - state.steer * 40, top);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

// Chamas azuis e laranja saindo do escapamento durante o nitro
const drawNitroFlames = (p) => {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    [-0.28, 0.28].forEach((side) => {
        const fx = p.x + p.w * side;
        const fy = p.y - p.h * 0.12;
        const len = p.h * (0.35 + Math.random() * 0.25);
        const g = ctx.createLinearGradient(fx, fy, fx, fy + len);
        g.addColorStop(0, "rgba(160, 220, 255, 0.95)");
        g.addColorStop(0.4, "rgba(80, 140, 255, 0.8)");
        g.addColorStop(1, "rgba(255, 140, 40, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fx - p.w * 0.05, fy);
        ctx.lineTo(fx + p.w * 0.05, fy);
        ctx.lineTo(fx + rand(-3, 3), fy + len);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
};

const drawParticles = () => {
    state.particles.forEach((p) => {
        const a = clamp(p.life * 2, 0, 1);
        if (p.kind === "spark") {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = rgb(p.color, a);
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.restore();
        } else {
            ctx.fillStyle = rgb(p.color, p.kind === "snow" ? 0.85 : a * 0.45);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
};

// Linhas de velocidade nas bordas da tela
const drawSpeedLines = () => {
    const ratio = state.speed / MAX_SPEED;
    if (ratio < 0.65 || state.phase !== "playing") return;
    const k = Math.min(1.8, (ratio - 0.65) / 0.35 + (state.nitroOn ? 0.6 : 0));
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * k})`;
    ctx.lineWidth = 1.5;
    const cx = view.w / 2, cy = view.horizon;
    for (let i = 0; i < 14; i++) {
        const ang = rand(0, Math.PI * 2);
        const r1 = rand(view.w * 0.38, view.w * 0.55);
        const r2 = r1 + rand(30, 90) * k;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.7);
        ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.7);
        ctx.stroke();
    }
    ctx.restore();
};

// ---------- HUD ----------

const panel = (x, y, w, h) => {
    ctx.fillStyle = "rgba(6, 10, 24, 0.6)";
    ctx.strokeStyle = "rgba(120, 220, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
};

const text = (value, x, y, size, color = "#fff", align = "left", weight = "bold") => {
    ctx.font = `${weight} ${size}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
};

// Velocímetro de ponteiro (0 a 240 km/h, faixa vermelha a partir de 200)
const drawGauge = (cx, cy, r) => {
    const start = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const ang = (v) => start + (clamp(v, 0, KMH_AT_MAX) / KMH_AT_MAX) * sweep;
    ctx.save();
    ctx.fillStyle = "rgba(6, 10, 24, 0.72)";
    ctx.strokeStyle = "rgba(120, 220, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 70, 50, 0.85)";
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, ang(200), ang(KMH_AT_MAX));
    ctx.stroke();

    ctx.lineCap = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.max(6, r * 0.2)}px ui-monospace, Consolas, monospace`;
    for (let v = 0; v <= KMH_AT_MAX; v += 10) {
        const major = v % 40 === 0;
        const a = ang(v);
        const r1 = r * (major ? 0.7 : v % 20 === 0 ? 0.77 : 0.82);
        ctx.strokeStyle = v >= 200 ? "#ff8a7a" : "#cfe6ff";
        ctx.lineWidth = major ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
        ctx.stroke();
        if (major) {
            ctx.fillStyle = v >= 200 ? "#ff8a7a" : "#d6e6f5";
            ctx.fillText(String(v), cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52);
        }
    }
    ctx.fillStyle = "#8fb3cc";
    ctx.font = `normal ${Math.max(6, r * 0.18)}px ui-monospace, Consolas, monospace`;
    ctx.fillText("km/h", cx, cy + r * 0.62);

    // ponteiro (treme um pouco perto da velocidade máxima)
    const jitter = state.speed > MAX_SPEED * 0.92 ? Math.sin(state.time * 45) * 0.8 : 0;
    const a = ang(state.needle + jitter);
    ctx.strokeStyle = "#ff4d3a";
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * r * 0.14, cy - Math.sin(a) * r * 0.14);
    ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
    ctx.stroke();
    ctx.fillStyle = "#e8eef5";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

// Barra das fases do dia (resistência)
const drawDayBar = (bx, by, barW, pal) => {
    panel(bx - 8, by, barW + 16, 34);
    PHASES.forEach((_, i) => {
        const pal2 = i === 2 && state.day % 2 === 0 ? SNOW_PALETTE : PALETTES[i];
        ctx.fillStyle = rgb(mixRgb(pal2.skyTop, pal2.skyBot, 0.5));
        ctx.fillRect(bx + (i / PHASES.length) * barW, by + 8, barW / PHASES.length - 1, 8);
    });
    const mark = bx + Math.min(1, state.dayTime / DAY_LEN) * barW;
    ctx.fillStyle = "#fff";
    ctx.fillRect(mark - 1, by + 5, 3, 14);
    text(pal.name || "", bx + barW / 2, by + 19, 10, "#cfe6ff", "center", "normal");
};

// Barra de progresso da corrida: largada -> chegada, rivais como pontinhos
const drawRaceBar = (bx, by, barW) => {
    panel(bx - 8, by, barW + 16, state.lapsTotal ? 50 : 36);
    if (state.lapsTotal) text(`Volta ${state.lap} de ${state.lapsTotal}`, bx + barW / 2, by + 36, 11, "#ffd36b", "center");
    const t = clamp(raceProgress() / state.raceUnits, 0, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(bx, by + 9, barW, 6);
    ctx.fillStyle = "#34cca3";
    ctx.fillRect(bx, by + 9, barW * t, 6);
    // bandeirinha quadriculada no fim
    for (let c = 0; c < 2; c++) {
        for (let r = 0; r < 3; r++) {
            ctx.fillStyle = (c + r) % 2 ? "#16161a" : "#f5f5f5";
            ctx.fillRect(bx + barW - 6 + c * 3, by + 6 + r * 4, 3, 4);
        }
    }
    state.cars.forEach((car) => {
        const ct = clamp((car.dist - state.startZ) / state.raceUnits, 0, 1);
        ctx.fillStyle = rgb(car.rgb);
        ctx.fillRect(bx + barW * ct - 1.5, by + 10, 3, 4);
    });
    ctx.fillStyle = "#ffd36b";
    ctx.beginPath();
    ctx.moveTo(bx + barW * t, by + 16);
    ctx.lineTo(bx + barW * t - 5, by + 22);
    ctx.lineTo(bx + barW * t + 5, by + 22);
    ctx.closePath();
    ctx.fill();
    const done = clamp(raceProgress(), 0, state.raceUnits) * KM_PER_UNIT;
    const left = Math.max(0, state.raceKm - done);
    text(`${done.toFixed(1)} km · faltam ${left.toFixed(1)} km`, bx + barW / 2, by + 23, 10, "#cfe6ff", "center", "normal");
};

// Farol grande da largada no centro da tela
const drawStartLight = () => {
    const counting = state.phase === "countdown" || (state.phase === "paused" && state.resumePhase === "countdown");
    if (!counting && !(state.mode === "race" && state.phase === "playing" && state.raceTime < 1.2)) return;
    const lr = Math.min(22, view.w / 22);
    const bw = lr * 7.4, bh = lr * 2.8;
    const bx = view.w / 2 - bw / 2, by = view.h * 0.2;
    ctx.fillStyle = "rgba(7, 9, 15, 0.9)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, lr * 0.6);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
        const lx = bx + lr * 1.5 + i * lr * 2.2, ly = by + bh / 2;
        ctx.fillStyle = counting ? "#ff2d2d" : "#38ff6a";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(lx, ly, lr * 0.85, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (counting) {
        const n = String(Math.max(1, Math.ceil(state.countdown)));
        ctx.font = `900 ${lr * 2.4}px ui-monospace, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.strokeText(n, view.w / 2, by + bh + 8);
        ctx.fillStyle = "#ff6b5a";
        ctx.fillText(n, view.w / 2, by + bh + 8);
    }
};

// Minimapa: o trecho da pista que vem pela frente, sempre com o carro apontando para cima
const MAP_K = 0.0025; // quanto cada unidade de curva gira o desenho
const MAP_AHEAD = 640; // segmentos à frente (~0,7 km)
const MAP_BEHIND = 40;
const drawMinimap = (x0, y0, size) => {
    panel(x0, y0, size, size);
    const playerZ = state.position + PLAYER_Z;
    const bi = Math.floor(playerZ / SEG_LEN);
    const ahead = [{ x: 0, y: 0 }];
    let h = 0, x = 0, y = 0;
    for (let i = 1; i <= MAP_AHEAD; i++) {
        h += segments[(bi + i) % TRACK_SEGS].curve * MAP_K;
        x += Math.sin(h);
        y -= Math.cos(h);
        ahead.push({ x, y });
    }
    const behind = [{ x: 0, y: 0 }];
    h = 0; x = 0; y = 0;
    for (let i = 1; i <= MAP_BEHIND; i++) {
        x -= Math.sin(h);
        y += Math.cos(h);
        h -= segments[(((bi - i) % TRACK_SEGS) + TRACK_SEGS) % TRACK_SEGS].curve * MAP_K;
        behind.push({ x, y });
    }
    const sc = (size * 0.7) / MAP_AHEAD;
    const ox = x0 + size / 2, oy = y0 + size * 0.84;
    const at = (pt) => [ox + pt.x * sc, oy + pt.y * sc];
    const pointAt = (segs) => (segs >= 0 ? ahead[Math.min(MAP_AHEAD, Math.round(segs))] : behind[Math.min(MAP_BEHIND, Math.round(-segs))]);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 2, y0 + 2, size - 4, size - 4);
    ctx.clip();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = MAP_BEHIND; i >= 0; i--) ctx.lineTo(...at(behind[i]));
    for (let i = 1; i <= MAP_AHEAD; i += 2) ctx.lineTo(...at(ahead[i]));
    ctx.strokeStyle = "rgba(20, 30, 50, 0.9)";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(200, 215, 235, 0.9)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // linhas da corrida (largada, voltas, chegada)
    if (state.mode === "race") {
        state.lines.forEach((line) => {
            const segs = (line.z - (state.dist + PLAYER_Z)) / SEG_LEN;
            if (segs < -MAP_BEHIND || segs > MAP_AHEAD) return;
            const [lx, ly] = at(pointAt(segs));
            for (let c = 0; c < 3; c++) {
                for (let r = 0; r < 2; r++) {
                    ctx.fillStyle = (c + r) % 2 ? "#16161a" : "#f5f5f5";
                    ctx.fillRect(lx - 4.5 + c * 3, ly - 3 + r * 3, 3, 3);
                }
            }
        });
    }
    // outros carros
    state.cars.forEach((car) => {
        const segs = relZ(car.z - playerZ) / SEG_LEN;
        if (segs < -MAP_BEHIND || segs > MAP_AHEAD) return;
        const [cx, cy] = at(pointAt(segs));
        ctx.fillStyle = rgb(car.rgb);
        ctx.beginPath();
        ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
        ctx.fill();
    });
    // jogador
    ctx.fillStyle = rgb(playerCar().rgb);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 6);
    ctx.lineTo(ox - 4.5, oy + 4);
    ctx.lineTo(ox + 4.5, oy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
};

// Barra do nitro (no painel do velocímetro digital)
const drawNitroBar = (x, y, w) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(x, y, w, 7);
    const ready = state.nitro >= NITRO_MIN;
    const flash = state.nitroOn && Math.sin(state.time * 30) > 0;
    ctx.fillStyle = state.nitroOn ? (flash ? "#8fe3ff" : "#4aa8ff") : ready ? "#ff9a2e" : "#8a5a2a";
    ctx.fillRect(x, y, w * state.nitro, 7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillRect(x + w * NITRO_MIN, y - 1, 1, 9);
    const label = isTouch ? "NITRO" : "NITRO (N)";
    text(label, x, y + 10, 9, ready || state.nitroOn ? "#ffc27a" : "#8fb3cc", "left", "normal");
};

const drawHud = (pal) => {
    const narrow = view.w < 560;
    const race = state.mode === "race";
    const kmh = Math.round((state.speed / MAX_SPEED) * KMH_AT_MAX);
    const pw = narrow ? Math.min(170, (view.w - 30) / 2) : 170;
    const wide = view.w >= 760;
    const big = narrow ? 15 : 18;
    const small = narrow ? 13 : 15;

    // Painel esquerdo: dia e carros que faltam (resistência) ou corrida e posição
    panel(10, 10, pw, 64);
    if (race) {
        text(`CORRIDA ${state.level}`, 22, 18, big, "#ffd36b");
        const pos = state.phase === "finished" ? state.finishPos : racePosition();
        text(`🏆 ${pos}º de ${N_RIVALS + 1}`, 22, 44, small, "#ffffff");
    } else {
        text(`DIA ${state.day}/${MAX_DAYS}`, 22, 18, big, "#ffd36b");
        if (state.goalReached) {
            const extra = state.passed - state.quota;
            text(extra > 0 ? `🏁 META OK +${extra}` : "🏁 META OK", 22, 44, small, "#7dffb0");
        } else {
            text(`🚗 ${Math.max(0, state.quota - state.passed)} carros`, 22, 44, small, "#ffffff");
        }
    }

    // Painel direito: velocímetro digital e odômetro
    const rw = pw;
    panel(view.w - rw - 10, 10, rw, 64);
    text(`${kmh}`, view.w - 22, 14, narrow ? 24 : 28, state.nitroOn ? "#8fe3ff" : "#ffffff", "right");
    text("km/h", view.w - 22, 46, 11, "#8fb3cc", "right", "normal");
    text(`${state.km.toFixed(1)} km`, view.w - rw + 2, 48, 13, "#8fe3ff", "left");
    drawNitroBar(view.w - rw + 2, 17, Math.max(30, rw - 92));

    // Velocímetro de ponteiro: ao lado do digital (tela larga) ou logo abaixo dele (tela estreita)
    const gr = wide ? 34 : 32;
    const gx = wide ? view.w - rw - 10 - 8 - gr : view.w - 10 - gr;
    const gy = wide ? 10 + 32 : 10 + 64 + 8 + gr;
    drawGauge(gx, gy, gr);

    // Barra central (fases do dia ou progresso da corrida)
    let bx, by, barW;
    if (wide) {
        const side = 10 + rw + 8 + gr * 2 + 12;
        barW = Math.min(340, view.w - side * 2 - 16);
        bx = view.w / 2 - barW / 2;
        by = 10;
    } else {
        bx = 18;
        by = 10 + 64 + 8;
        barW = gx - gr - 10 - 8 - bx;
    }
    if (race) drawRaceBar(bx, by, barW);
    else drawDayBar(bx, by, barW, pal);

    // Minimapa (opção do menu): abaixo do painel esquerdo
    if (settings.minimap && !MENU_PHASES.has(state.phase)) {
        if (wide) drawMinimap(10, 84, 120);
        else drawMinimap(10, 154, 96);
    }

    drawStartLight();
};

const drawPopups = () => {
    state.popups.forEach((p, i) => {
        const a = p.t < 1.4 ? 1 : 1 - (p.t - 1.4) / 0.6;
        ctx.globalAlpha = clamp(a, 0, 1);
        const size = Math.min(44, view.w / 12);
        ctx.font = `900 ${size}px ui-monospace, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        const y = view.h * 0.3 + i * (size + 10) - p.t * 10;
        ctx.strokeText(p.text, view.w / 2, y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, view.w / 2, y);
        ctx.globalAlpha = 1;
    });
};

const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

let overlayBottom = 0; // onde o texto da tela termina (para o menu ficar logo abaixo)
const drawOverlay = (title, lines, color, top = 0.36) => {
    const compact = MENU_PHASES.has(state.phase); // com o menu aberto o texto fica menor
    ctx.fillStyle = "rgba(4, 6, 16, 0.62)";
    ctx.fillRect(0, 0, view.w, view.h);
    const size = Math.min(compact ? 48 : 64, view.w / 8, (view.w - 24) / (title.length * 0.62));
    ctx.font = `900 ${size}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    // O título fica abaixo do HUD (que em tela estreita tem duas fileiras)
    const hudBottom = view.w >= 760 ? 74 : 146;
    const ty = Math.max(view.h * top, hudBottom + size * 0.6);
    ctx.fillText(title, view.w / 2, ty);
    ctx.shadowBlur = 0;
    // Linhas compridas quebram em várias para caber em telas estreitas
    const fs = view.w < 560 || compact ? 14 : 16;
    const lineH = compact ? 1.45 : 1.55;
    ctx.font = `normal ${fs}px ui-monospace, Consolas, monospace`;
    const maxW = view.w - 24;
    const wrapped = [];
    lines.forEach((line) => {
        let cur = "";
        line.split(" ").forEach((word) => {
            const next = cur ? `${cur} ${word}` : word;
            if (cur && ctx.measureText(next).width > maxW) {
                wrapped.push(cur);
                cur = word === "·" ? "" : word;
            } else cur = next;
        });
        if (cur) wrapped.push(cur);
    });
    wrapped.forEach((line, i) => text(line.replace(/ ·$/, ""), view.w / 2, ty + size * 0.75 + i * fs * lineH, fs, "#d6e6f5", "center", "normal"));
    overlayBottom = ty + size * 0.75 + wrapped.length * fs * lineH;
};

const fmtTime = (t) => {
    const m = Math.floor(t / 60);
    const sec = t - m * 60;
    return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
};

const render = () => {
    const pal = state.palette;
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.save();
    if (state.shake > 0) ctx.translate(rand(-1, 1) * state.shake, rand(-1, 1) * state.shake);

    drawSky(pal);
    drawRidge(RIDGE_FAR, rgb(pal.mountFar), view.h * 0.16, 0.3, pal.snowAmount + 0.15);
    drawRidge(RIDGE_NEAR, rgb(pal.mountNear), view.h * 0.09, 0.6, pal.snowAmount);
    const visible = drawRoad(pal);
    drawHeadlights(pal);
    drawSprites(visible, pal);

    // Carro do jogador
    const p = playerScreen();
    const tilt = -state.steer * 0.08 * (state.speed / MAX_SPEED);
    const wobble = state.crashTimer > 0 ? Math.sin(state.time * 50) * 0.12 : 0;
    const me = playerCar();
    drawCar(p.x, p.y, p.w, me.rgb, pal, {
        player: true, tilt: tilt + wobble, braking: braking() && state.speed > 0, number: settings.numbers ? me.number : 0,
    });
    if (state.nitroOn) drawNitroFlames(p);

    drawParticles();
    drawSpeedLines();
    ctx.restore();

    // Neblina leve sobre a cena + vinheta
    if (pal.fogDensity > 3) {
        ctx.fillStyle = rgb(pal.fog, clamp((pal.fogDensity - 3) / 8, 0, 0.3));
        ctx.fillRect(0, 0, view.w, view.h);
    }
    const vr = Math.min(view.w, view.h);
    const vignette = ctx.createRadialGradient(view.w / 2, view.h * 0.55, vr * 0.35, view.w / 2, view.h * 0.55, Math.max(view.w, view.h) * 0.8);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.w, view.h);

    drawHud(pal);
    if (state.phase === "playing" || state.phase === "countdown") drawPopups();

    const oy = MENU_PHASES.has(state.phase) ? 0.2 : 0.36;
    const cont = isTouch ? "Toque para continuar" : "Enter para continuar";
    if (state.phase === "start") {
        const race = settings.mode === "race";
        drawOverlay("DINO RALLY", [
            race ? "Corrida: largue no verde e cruze a chegada em 1º lugar."
                : `Resistência: bata a meta de carros de cada dia, por ${MAX_DAYS} dias.`,
            isTouch ? "Arraste o dedo sobre o carro para dirigir · 🔥 nitro · ⇄ troca o lado dos botões" : "←→ dirigir · ↑ acelerar · ↓ frear · N nitro · P pausa · M som",
            isTouch ? "" : "Mouse: mova para dirigir · botão esquerdo acelera · direito freia",
            race ? (best.race > 0 ? `Recorde: corrida ${best.race} concluída` : "")
                : (best.km > 0 ? `Recorde: ${best.km.toFixed(1)} km · dia ${best.day}` : ""),
        ].filter(Boolean), "#34cca3", oy);
    } else if (state.phase === "paused") {
        drawOverlay("PAUSA", [isTouch ? "Toque para continuar" : "P ou Enter para continuar", "M liga/desliga o som"], "#8fe3ff", oy);
    } else if (state.phase === "dayDone") {
        const r = state.dayResult;
        const next = r.day + 1;
        drawOverlay(`DIA ${r.day} COMPLETO!`, [
            `Você ultrapassou ${r.passed} carros (meta: ${r.quota}).`,
            `Próximo: dia ${next} de ${MAX_DAYS} · meta de ${quotaFor(next)} carros.`,
            next % 2 === 0 ? "Atenção: neve no meio-dia, a pista fica escorregadia."
                : "Os outros carros ficam um pouco mais rápidos.",
            next === MAX_DAYS ? "É o último dia: complete e vença o Dino Rally!" : `Faltam ${MAX_DAYS - r.day} dias para terminar.`,
            cont,
        ], "#7dffb0", oy);
    } else if (state.phase === "victory") {
        drawOverlay("CAMPEÃO!", [
            `Você completou os ${MAX_DAYS} dias e percorreu ${state.km.toFixed(1)} km.`,
            `Recorde: ${best.km.toFixed(1)} km`,
        ], "#ffd36b", oy);
    } else if (state.phase === "over") {
        drawOverlay("FIM DA CORRIDA", [
            `Faltaram ${Math.max(0, state.quota - state.passed)} carros no dia ${state.day} de ${MAX_DAYS}.`,
            `Você percorreu ${state.km.toFixed(1)} km.`,
            `Recorde: ${best.km.toFixed(1)} km · dia ${best.day}`,
        ], "#ff6b5a", oy);
    } else if (state.phase === "finished") {
        const pos = state.finishPos;
        const medal = MEDALS[pos];
        const laps = state.lapsTotal;
        drawOverlay(pos === 1 ? "VITÓRIA! 1º LUGAR" : `${pos}º LUGAR`, [
            `Corrida ${state.level}: ${laps ? `${laps} ${laps > 1 ? "voltas" : "volta"} · ` : ""}${state.raceKm} km em ${fmtTime(state.raceTime)}.`,
            medal ? `${medal.icon} Medalha de ${medal.name}!${state.newMedal ? " (nova)" : ""}` : "Sem medalha: chegue entre os 3 primeiros.",
            `Próxima: corrida ${state.level + 1} · ${laps ? `${laps} ${laps > 1 ? "voltas" : "volta"}` : `${raceKmFor(state.level + 1)} km`} · rivais mais rápidos.`,
        ], pos <= 3 ? "#ffd36b" : "#8fe3ff", oy);
    }
};

// =====================================================================
// Entrada
// =====================================================================

const KEYS = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "gas", KeyW: "gas", Space: "gas",
    ArrowDown: "brake", KeyS: "brake",
};

// ---------- Menu (modo e numeração dos carros) ----------
const MENU_PHASES = new Set(["start", "over", "victory", "finished"]);
const menu = document.getElementById("menu");
const modeSel = document.getElementById("mode");
const numbersSel = document.getElementById("numbers");
const lapsSel = document.getElementById("laps");
const carSel = document.getElementById("car");
const minimapSel = document.getElementById("minimap");
const btnStart = document.getElementById("btn-start");
const btnRetry = document.getElementById("btn-retry");
const settings = {
    mode: storage.get(MODE_KEY) === "race" ? "race" : "endurance",
    numbers: storage.get(NUMBERS_KEY) !== "0",
    laps: clamp(Number(storage.get(LAPS_KEY)) || 0, 0, 3),
    car: PLAYER_CARS.some((c) => c.id === storage.get(CAR_KEY)) ? storage.get(CAR_KEY) : PLAYER_CARS[0].id,
    minimap: storage.get(MINIMAP_KEY) !== "0",
};
function playerCar() {
    return PLAYER_CARS.find((c) => c.id === settings.car) || PLAYER_CARS[0];
}
PLAYER_CARS.forEach((c) => carSel.add(new Option(`${c.name} · nº ${c.number}`, c.id)));
modeSel.value = settings.mode;
numbersSel.value = settings.numbers ? "1" : "0";
lapsSel.value = String(settings.laps);
carSel.value = settings.car;
minimapSel.value = settings.minimap ? "1" : "0";
lapsSel.addEventListener("change", () => {
    settings.laps = clamp(Number(lapsSel.value) || 0, 0, 3);
    storage.set(LAPS_KEY, String(settings.laps));
});
carSel.addEventListener("change", () => {
    settings.car = carSel.value;
    storage.set(CAR_KEY, settings.car);
    // renumera os outros carros para nenhum ficar com o mesmo número do jogador
    state.cars.forEach((car, i) => (car.number = rivalNumber(i)));
});
minimapSel.addEventListener("change", () => {
    settings.minimap = minimapSel.value !== "0";
    storage.set(MINIMAP_KEY, settings.minimap ? "1" : "0");
});

// (medalhas aparecem só na tela de chegada)
modeSel.addEventListener("change", () => {
    settings.mode = modeSel.value === "race" ? "race" : "endurance";
    storage.set(MODE_KEY, settings.mode);
});
numbersSel.addEventListener("change", () => {
    settings.numbers = numbersSel.value !== "0";
    storage.set(NUMBERS_KEY, settings.numbers ? "1" : "0");
});

// Depois de terminar uma corrida, o botão principal leva para a próxima (mais difícil)
const nextIsHarder = () => state.phase === "finished" && settings.mode === "race";
const primaryAction = () => {
    if (settings.mode === "race") startRace(nextIsHarder() ? state.level + 1 : 1);
    else resetGame();
    canvas.focus();
};
btnStart.addEventListener("click", () => {
    sound.ensure();
    primaryAction();
});
btnRetry.addEventListener("click", () => {
    sound.ensure();
    startRace(state.level);
    canvas.focus();
});

let menuKey = "";
const syncMenu = () => {
    const key = `${state.phase}|${settings.mode}|${state.level}`;
    if (key === menuKey) return;
    menuKey = key;
    const open = MENU_PHASES.has(state.phase);
    menu.hidden = !open;
    const race = settings.mode === "race";
    lapsSel.closest(".field").hidden = !race;
    touch.classList.toggle("menu-open", open);
    btnStart.textContent = nextIsHarder() ? `Próxima corrida (${state.level + 1}) ▶`
        : state.phase === "start" ? "Correr ▶" : "Correr de novo ▶";
    btnRetry.hidden = !nextIsHarder();
};

// No PC o menu sobe para ficar entre o texto e o carro; no celular fica embaixo (CSS)
const desktopMenu = window.matchMedia("(pointer: fine)");
let menuTop = "";
const positionMenu = () => {
    let top = "";
    if (!menu.hidden && desktopMenu.matches && canvas.clientWidth >= 760) {
        const k = canvas.clientHeight / view.h; // unidades do jogo -> pixels da página
        const p = playerScreen();
        const carTop = (p.y - p.h * 1.12) * k;
        const textBottom = overlayBottom * k + 8;
        // pouco espaço: menu compacto (menos respiro nos campos e no botão)
        if (!menu.classList.contains("tight") && carTop - menu.offsetHeight - 14 < textBottom) menu.classList.add("tight");
        const wanted = carTop - menu.offsetHeight - 14;
        top = `${Math.round(Math.max(textBottom, wanted))}px`;
    } else {
        menu.classList.remove("tight");
    }
    if (top === menuTop) return;
    menuTop = top;
    menu.style.top = top;
    menu.style.bottom = top ? "auto" : "";
};

const confirm = () => {
    sound.ensure();
    if (MENU_PHASES.has(state.phase)) primaryAction();
    else if (state.phase === "paused") state.phase = state.resumePhase;
    else if (state.phase === "dayDone") nextDay();
};

const pause = () => {
    state.resumePhase = state.phase;
    state.phase = "paused";
};
const togglePause = () => {
    if (state.phase === "playing" || state.phase === "countdown") pause();
    else if (state.phase === "paused") state.phase = state.resumePhase;
};

window.addEventListener("keydown", (event) => {
    sound.ensure();
    // No menu, as teclas ficam com o seletor/botão que está em foco
    if (menu.contains(event.target)) return;
    const action = KEYS[event.code];
    if (action) {
        event.preventDefault();
        input[action] = true;
        if (action === "left" || action === "right") releasePointerSteer();
        return;
    }
    if (event.code === "Enter" || event.code === "NumpadEnter") confirm();
    else if (event.code === "KeyP" || event.code === "Escape") togglePause();
    else if (event.code === "KeyM") sound.toggle();
    else if (event.code === "KeyN" || event.code === "ShiftLeft" || event.code === "ShiftRight") activateNitro();
});

window.addEventListener("keyup", (event) => {
    const action = KEYS[event.code];
    if (action) input[action] = false;
});

const autoPause = () => {
    Object.keys(input).forEach((k) => (input[k] = false));
    pointer.gas = pointer.brake = false;
    if (state.phase === "playing" || state.phase === "countdown") pause();
};
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => document.hidden && autoPause());

const capture = (el, event) => {
    try { el.setPointerCapture?.(event.pointerId); } catch { /* ponteiro já liberado */ }
};

// ---------- Mouse / dedo ----------
// Mouse: a posição horizontal do ponteiro vira a posição desejada do carro na pista.
// Dedo: arrastar para a direita/esquerda (de preferência em cima do carro) leva o carro junto,
// a partir de onde ele está (movimento relativo, como se o dedo empurrasse o carro).
const DRAG_GAIN = 3; // arrastar a largura inteira da tela = 3 unidades de pista (a pista vai de -1 a 1)
let drag = null; // { id, startX, startCar } enquanto um dedo dirige

const aimPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * 1.25;
    canvas.classList.add("pointer-steer");
};
const dragTo = (event) => {
    const rect = canvas.getBoundingClientRect();
    const dx = (event.clientX - drag.startX) / rect.width;
    pointer.x = clamp(drag.startCar + dx * DRAG_GAIN, -1.25, 1.25);
};
const releasePointerSteer = () => {
    pointer.x = null;
    drag = null;
    canvas.classList.remove("pointer-steer");
};
const readButtons = (event) => {
    if (event.pointerType !== "mouse") return;
    pointer.gas = (event.buttons & 1) !== 0;
    pointer.brake = (event.buttons & 2) !== 0;
};

canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    sound.ensure();
    if (MENU_PHASES.has(state.phase)) return; // no menu, usa os botões
    if (state.phase !== "playing" && state.phase !== "countdown") {
        confirm();
        return;
    }
    capture(canvas, event);
    if (event.pointerType === "mouse") {
        aimPointer(event);
        readButtons(event);
    } else if (!drag) {
        drag = { id: event.pointerId, startX: event.clientX, startCar: state.playerX };
        pointer.x = state.playerX;
    }
});
canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
        aimPointer(event);
        readButtons(event);
    } else if (drag && event.pointerId === drag.id) {
        dragTo(event);
    }
});
const endDrag = (event) => {
    if (event.pointerType === "mouse") readButtons(event);
    else if (drag && event.pointerId === drag.id) releasePointerSteer();
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", (event) => {
    pointer.gas = pointer.brake = false;
    endDrag(event);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

// ---------- Botões de toque ----------
// Por padrão os botões ficam invertidos: acelerar/frear à esquerda e direção à direita.
// O botão ⇄ troca os lados e a escolha fica salva.
const SWAP_KEY = "dinogames-rally-swap";
const touch = document.querySelector(".touch");
const swapBtn = touch.querySelector(".touch-swap");
const applySwap = (swapped) => {
    touch.classList.toggle("swapped", swapped);
    swapBtn.setAttribute("aria-pressed", String(swapped));
    swapBtn.title = swapped
        ? "Botões invertidos: acelerar/frear à esquerda (toque para trocar)"
        : "Botões normais: direção à esquerda (toque para trocar)";
};
applySwap(storage.get(SWAP_KEY) !== "0");
swapBtn.addEventListener("click", () => {
    const swapped = !touch.classList.contains("swapped");
    storage.set(SWAP_KEY, swapped ? "1" : "0");
    applySwap(swapped);
});

if (isTouch) touch.classList.add("show");
touch.querySelectorAll("button[data-key]").forEach((btn) => {
    const key = btn.dataset.key;
    const down = (event) => {
        event.preventDefault();
        sound.ensure();
        capture(btn, event);
        btn.classList.add("active");
        if (key === "pause") {
            if (state.phase === "playing" || state.phase === "countdown") togglePause();
            else confirm();
        } else if (key === "nitro") {
            activateNitro();
        } else {
            if (state.phase !== "playing") confirm();
            input[key] = true;
            if (key === "left" || key === "right") releasePointerSteer();
        }
    };
    const up = () => {
        btn.classList.remove("active");
        if (key !== "pause" && key !== "nitro") input[key] = false;
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
});

// O botão de pausa mostra ▶ (continuar) quando pausado e ❚❚ (pausar) durante o jogo.
const pauseBtn = touch.querySelector(".touch-pause");
let pauseBtnPhase = "";
const syncPauseButton = () => {
    if (pauseBtnPhase === state.phase) return;
    pauseBtnPhase = state.phase;
    const playing = state.phase === "playing" || state.phase === "countdown";
    pauseBtn.textContent = playing ? "❚❚" : "▶";
    pauseBtn.setAttribute("aria-label", playing ? "Pausar" : "Continuar");
    pauseBtn.classList.toggle("is-play", !playing);
};

// O botão 🔥 mostra a carga do nitro e acende quando dá para usar
const nitroBtn = touch.querySelector(".touch-nitro");
let nitroShown = "";
const syncNitroButton = () => {
    const pct = Math.round(state.nitro * 20) * 5;
    const key = `${pct}|${state.nitroOn}|${state.nitro >= NITRO_MIN}`;
    if (key === nitroShown) return;
    nitroShown = key;
    nitroBtn.style.setProperty("--fill", `${pct}%`);
    nitroBtn.classList.toggle("ready", state.nitro >= NITRO_MIN && !state.nitroOn);
    nitroBtn.classList.toggle("on", state.nitroOn);
};

window.addEventListener("resize", fitCanvas);

// =====================================================================
// Laço principal
// =====================================================================

let last = performance.now();
const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    syncPauseButton();
    syncNitroButton();
    syncMenu();
    positionMenu();
    requestAnimationFrame(loop);
};

buildTrack();
createCars();
fitCanvas();
canvas.focus();
requestAnimationFrame(loop);
