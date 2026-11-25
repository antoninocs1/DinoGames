// Gera os arquivos de som do Siga o Dino (SigaDino/sounds/*.wav).
//
//   node scripts/gen-sigadino-sounds.js
//
// Os sons são sintetizados aqui mesmo (nenhuma gravação de terceiros),
// então são livres de direitos. Cada arquivo é UMA nota; o jogo muda a
// altura de cada botão ajustando a velocidade de reprodução
// (playbackRate = frequência do botão / frequência base do arquivo).
// A frequência base de cada arquivo está em SigaDino/sounds.js.
"use strict";

const fs = require("fs");
const path = require("path");

const RATE = 22050;
const OUT = path.join(__dirname, "..", "SigaDino", "sounds");

/** Grava amostras (-1..1) como WAV mono de 16 bits, normalizando o pico. */
const writeWav = (name, samples, peak = 0.8) => {
    let max = 0;
    for (const s of samples) max = Math.max(max, Math.abs(s));
    const k = max ? peak / max : 1;
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * k)) * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);          // PCM
    header.writeUInt16LE(1, 22);          // mono
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(OUT, name), Buffer.concat([header, data]));
    console.log(`${name}: ${(samples.length / RATE).toFixed(2)} s, ${((44 + data.length) / 1024).toFixed(0)} KB`);
};

const seconds = (s) => Math.round(s * RATE);
// Gerador pseudoaleatório fixo: o arquivo sai igual a cada execução.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

/** Fade curto no começo e no fim para não estalar. */
const edges = (buf, fadeIn = 0.005, fadeOut = 0.03) => {
    const a = seconds(fadeIn), b = seconds(fadeOut);
    for (let i = 0; i < a; i++) buf[i] *= i / a;
    for (let i = 0; i < b; i++) buf[buf.length - 1 - i] *= i / b;
    return buf;
};

// ---------------------------------------------------------------------
// Eletrônico: tom quase puro e constante, como os MP3 do projeto de
// referência (seno com um tiquinho de 3º harmônico). Longo, porque o jogo
// corta o som quando a luz apaga.
// ---------------------------------------------------------------------
const eletronico = (f0) => {
    const buf = new Float32Array(seconds(1.6));
    for (let i = 0; i < buf.length; i++) {
        const t = i / RATE;
        buf[i] = Math.sin(2 * Math.PI * f0 * t) + 0.04 * Math.sin(2 * Math.PI * 3 * f0 * t);
    }
    return edges(buf, 0.012, 0.05);
};

// ---------------------------------------------------------------------
// Harpa: corda dedilhada (algoritmo Karplus-Strong) — natural e macia.
// ---------------------------------------------------------------------
const harpa = (f0) => {
    const len = seconds(2.2);
    const period = RATE / f0;
    const n = Math.floor(period);
    const frac = period - n;
    const line = new Float32Array(n + 2);
    // "Dedilhado" suave: ruído já filtrado (menos agudo = som mais redondo).
    let prev = 0;
    for (let i = 0; i < line.length; i++) { prev = prev * 0.6 + rand() * 0.4; line[i] = prev; }
    const buf = new Float32Array(len);
    let idx = 0, last = 0;
    for (let i = 0; i < len; i++) {
        const a = line[idx % line.length];
        const b = line[(idx + 1) % line.length];
        const out = a + (b - a) * frac;
        const next = 0.996 * (0.5 * out + 0.5 * last);
        last = out;
        line[idx % line.length] = next;
        buf[i] = out;
        idx++;
    }
    return edges(buf, 0.002, 0.2);
};

// ---------------------------------------------------------------------
// Xilofone: plaquinha batida — fundamental + parcial próximo de 4x,
// decaimento rápido e um "toc" bem leve da baqueta.
// ---------------------------------------------------------------------
const xilofone = (f0) => {
    const buf = new Float32Array(seconds(1.1));
    const parts = [[1, 1, 3.2], [3.98, 0.32, 9], [9.1, 0.08, 18]]; // [múltiplo, volume, velocidade de decaimento]
    let click = 0;
    for (let i = 0; i < buf.length; i++) {
        const t = i / RATE;
        let s = 0;
        for (const [m, v, d] of parts) s += v * Math.exp(-d * t) * Math.sin(2 * Math.PI * f0 * m * t);
        if (t < 0.012) { click = click * 0.5 + rand() * 0.5; s += click * 0.25 * (1 - t / 0.012); }
        buf[i] = s;
    }
    return edges(buf, 0.001, 0.1);
};

// ---------------------------------------------------------------------
// Caixinha de música: lâmina de metal — nota limpa que vai sumindo,
// com um brilho agudo que some antes.
// ---------------------------------------------------------------------
const caixinha = (f0) => {
    const buf = new Float32Array(seconds(2));
    const parts = [[1, 1, 2.2], [2, 0.18, 4], [5.4, 0.12, 9], [8.9, 0.04, 16]];
    for (let i = 0; i < buf.length; i++) {
        const t = i / RATE;
        let s = 0;
        for (const [m, v, d] of parts) s += v * Math.exp(-d * t) * Math.sin(2 * Math.PI * f0 * m * t);
        buf[i] = s;
    }
    return edges(buf, 0.002, 0.15);
};

// ---------------------------------------------------------------------
// Corda dedilhada genérica (Karplus-Strong) usada pelos instrumentos chineses.
//   bright   0..1: quanto o "dedilhado" tem de agudo (unha/plectro = brilhante)
//   damp     perda por volta da corda (mais perto de 1 = soa mais tempo)
//   tone     0..1: mistura da média (0,5 = padrão; maior = mais escuro)
// ---------------------------------------------------------------------
const pluck = (f0, dur, { bright = 0.5, damp = 0.996, tone = 0.5 } = {}) => {
    const len = seconds(dur);
    const period = RATE / f0 - tone; // a média atrasa ~tone amostra por volta: desconta para afinar
    const n = Math.floor(period);
    const frac = period - n;
    const line = new Float32Array(n + 2);
    let prev = 0;
    for (let i = 0; i < line.length; i++) { prev = prev * (1 - bright) + rand() * bright; line[i] = prev; }
    const buf = new Float32Array(len);
    let idx = 0, last = 0;
    for (let i = 0; i < len; i++) {
        const a = line[idx % line.length];
        const b = line[(idx + 1) % line.length];
        const out = a + (b - a) * frac;
        line[idx % line.length] = damp * ((1 - tone) * out + tone * last);
        last = out;
        buf[i] = out;
        idx++;
    }
    return buf;
};

/**
 * Relê o som com a velocidade variando no tempo (rate(t) = 1 é o original):
 * dá o vibrato e os deslizes de altura que a mão esquerda faz na corda.
 */
const warp = (src, rate) => {
    const out = new Float32Array(src.length);
    let pos = 0;
    for (let i = 0; i < out.length; i++) {
        const k = Math.floor(pos);
        if (k + 1 >= src.length) break;
        out[i] = src[k] + (src[k + 1] - src[k]) * (pos - k);
        pos += rate(i / RATE);
    }
    return out;
};
const semis = (s) => Math.pow(2, s / 12);

// ---------------------------------------------------------------------
// Guzheng: cítara chinesa de cordas de aço tocadas com unha — ataque
// brilhante e, depois de um instante, o vibrato largo da mão esquerda
// apertando a corda do outro lado da ponte (róu xián).
// ---------------------------------------------------------------------
const guzheng = (f0) => {
    const dry = pluck(f0, 2.6, { bright: 0.85, damp: 0.9975, tone: 0.42 });
    const buf = warp(dry, (t) => {
        const amount = Math.min(1, Math.max(0, (t - 0.35) / 0.4)); // o vibrato entra devagar
        return semis(0.32 * amount * Math.sin(2 * Math.PI * 5.2 * t));
    });
    // Um "tlin" metálico bem curto da unha na corda.
    for (let i = 0; i < seconds(0.02); i++) buf[i] += rand() * 0.18 * (1 - i / seconds(0.02));
    return edges(buf, 0.001, 0.25);
};

// ---------------------------------------------------------------------
// Guqin: cítara de 7 cordas de seda, tocada com a ponta do dedo — som
// grave, escuro e longo, com um leve deslize subindo até a nota no
// começo e um vibrato lento e discreto (yín).
// ---------------------------------------------------------------------
const guqin = (f0) => {
    const dry = pluck(f0, 3.4, { bright: 0.3, damp: 0.9985, tone: 0.62 });
    const buf = warp(dry, (t) => {
        const slide = -0.45 * Math.exp(-t / 0.06);                  // chega na nota deslizando
        const amount = Math.min(1, Math.max(0, (t - 0.6) / 0.8));
        return semis(slide + 0.18 * amount * Math.sin(2 * Math.PI * 3.4 * t));
    });
    // Corpo de madeira: realça um pouco o grave (média com o passado).
    let low = 0;
    for (let i = 0; i < buf.length; i++) { low = low * 0.92 + buf[i] * 0.08; buf[i] = buf[i] * 0.7 + low * 2.2; }
    return edges(buf, 0.004, 0.3);
};

// ---------------------------------------------------------------------
// Flauta de bambu (dizi): tom soprado — fundamental forte, poucos
// harmônicos, sopro de ar (ruído) e o zumbido leve da membrana; entrada
// com um "chiff" curto e vibrato que aparece depois de um instante.
// Longa (o jogo corta quando a luz apaga).
// ---------------------------------------------------------------------
const flauta = (f0) => {
    const buf = new Float32Array(seconds(3.4));
    const parts = [[1, 1], [2, 0.32], [3, 0.16], [4, 0.05], [5, 0.035]];
    let phase = 0, noise = 0, band = 0;
    for (let i = 0; i < buf.length; i++) {
        const t = i / RATE;
        const vib = Math.min(1, Math.max(0, (t - 0.3) / 0.5)) * 0.006 * Math.sin(2 * Math.PI * 5 * t);
        phase += 2 * Math.PI * f0 * (1 + vib) / RATE;
        let s = 0;
        for (const [m, v] of parts) s += v * Math.sin(m * phase);
        // Sopro: ruído suavizado, mais forte na entrada.
        noise = noise * 0.75 + rand() * 0.25;
        band = band * 0.6 + noise * 0.4;
        const air = band * (0.12 + 0.5 * Math.exp(-t / 0.05));
        const env = Math.min(1, t / 0.06) * (1 + 0.04 * Math.sin(2 * Math.PI * 0.7 * t));
        buf[i] = env * s + air;
    }
    return edges(buf, 0.002, 0.08);
};

fs.mkdirSync(OUT, { recursive: true });
// As frequências base precisam bater com SigaDino/sounds.js.
writeWav("eletronico.wav", eletronico(220));
writeWav("harpa.wav", harpa(261.63));
writeWav("xilofone.wav", xilofone(523.25));
writeWav("caixinha.wav", caixinha(523.25));
writeWav("guzheng.wav", guzheng(392));
writeWav("guqin.wav", guqin(196));
writeWav("flauta.wav", flauta(440));
