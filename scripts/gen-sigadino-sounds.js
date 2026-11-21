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

fs.mkdirSync(OUT, { recursive: true });
// As frequências base precisam bater com SigaDino/sounds.js.
writeWav("eletronico.wav", eletronico(220));
writeWav("harpa.wav", harpa(261.63));
writeWav("xilofone.wav", xilofone(523.25));
writeWav("caixinha.wav", caixinha(523.25));
