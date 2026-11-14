"use strict";

// =====================================================================
// Efeitos visuais e sonoros do Tetris.
// Adaptado do jogo em Java/libGDX (Effects, GlassTextures, GlassSound e
// GameSounds) para Canvas 2D e Web Audio.
// =====================================================================

const TetrisFX = (() => {
    const rand = (min, max) => min + Math.random() * (max - min);
    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    const hexToRgb = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
    };

    const css = ({ r, g, b }, a = 1) =>
        `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

    // Mistura usada nos brilhos do jogo original: base clara + parte da cor da peça.
    const mix = (c, base, amount) => ({ r: base + c.r * amount, g: base + c.g * amount, b: base + c.b * amount });

    const makeCanvas = (w, h) => {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(h));
        return c;
    };

    // =================================================================
    // Texturas geradas em código
    // =================================================================

    const cache = new Map();
    const cached = (key, build) => {
        if (!cache.has(key)) cache.set(key, build());
        return cache.get(key);
    };

    // Bloco de vidro 3D: contorno escuro, bisel claro/escuro, filete brilhante,
    // centro semitransparente com gradiente e reflexo branco (corpo + brilho num só canvas).
    const glassBlock = (hex, sizePx) =>
        cached(`block:${hex}:${sizePx}`, () => {
            const size = Math.max(4, sizePx);
            const canvas = makeCanvas(size, size);
            const c = canvas.getContext("2d");
            const img = c.createImageData(size, size);
            const { r, g, b } = hexToRgb(hex);
            const bevel = size * 0.14;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dl = x, dr = size - 1 - x, dt = y, db = size - 1 - y;
                    const edge = Math.min(dl, dr, dt, db);
                    let bright;
                    let alpha;
                    if (edge < 1.5) {
                        bright = 0.35; alpha = 1;
                    } else if (edge < bevel) {
                        if (edge === dt) bright = 1.0;
                        else if (edge === dl) bright = 0.9;
                        else if (edge === dr) bright = 0.58;
                        else bright = 0.45;
                        alpha = 0.95;
                    } else if (edge < bevel + 1.5) {
                        bright = 1; alpha = 0.9;
                    } else {
                        const t = y / size;
                        bright = 0.98 - 0.3 * t;
                        alpha = 0.55 + 0.2 * t;
                    }

                    // Reflexo (gloss) somado por cima do corpo tingido
                    const u = x / size, v = y / size;
                    let gloss = 0;
                    const ex = (u - 0.32) / 0.42, ey = (v - 0.25) / 0.22;
                    const e = ex * ex + ey * ey;
                    if (e < 1) gloss += 0.38 * (1 - e);
                    const d = Math.abs(u + v - 0.95);
                    if (d < 0.07) gloss += 0.22 * (1 - d / 0.07);
                    if (y >= size * 0.04 && y < size * 0.08 && x > bevel && x < size - bevel) gloss += 0.55;
                    const sx = u - 0.2, sy = v - 0.2;
                    const s = (sx * sx + sy * sy) / 0.004;
                    if (s < 1) gloss += 0.6 * (1 - s);
                    gloss = Math.min(gloss, 0.85);

                    const baseA = 0.88 * alpha;
                    const outA = gloss + baseA * (1 - gloss);
                    const blend = (ch) => (outA > 0 ? (1 * gloss + ch * bright * baseA * (1 - gloss)) / outA : 0);
                    const i = (y * size + x) * 4;
                    img.data[i] = Math.round(clamp01(blend(r)) * 255);
                    img.data[i + 1] = Math.round(clamp01(blend(g)) * 255);
                    img.data[i + 2] = Math.round(clamp01(blend(b)) * 255);
                    img.data[i + 3] = Math.round(clamp01(outA) * 255);
                }
            }
            c.putImageData(img, 0, 0);
            return canvas;
        });

    // Bloco de pedra: rocha manchada marrom-acinzentada, bisel irregular e rachaduras escuras.
    const stoneBlock = (sizePx) =>
        cached(`stone:${sizePx}`, () => {
            const size = Math.max(4, sizePx);
            const canvas = makeCanvas(size, size);
            const c = canvas.getContext("2d");
            const img = c.createImageData(size, size);
            const cells = 6;
            const blotches = Array.from({ length: cells + 1 }, () => Array.from({ length: cells + 1 }, Math.random));
            const bevel = size * 0.14;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const gx = (x * cells) / size, gy = (y * cells) / size;
                    const ix = Math.floor(gx), iy = Math.floor(gy);
                    const fx = gx - ix, fy = gy - iy;
                    const blotch = (blotches[iy][ix] * (1 - fx) + blotches[iy][ix + 1] * fx) * (1 - fy) +
                        (blotches[iy + 1][ix] * (1 - fx) + blotches[iy + 1][ix + 1] * fx) * fy;
                    let light = 0.72 + 0.42 * blotch + (Math.random() - 0.5) * 0.14;
                    const dl = x, dr = size - 1 - x, dt = y, db = size - 1 - y;
                    const edge = Math.min(dl, dr, dt, db);
                    if (edge < 1.5) light = 0.25;
                    else if (edge < bevel) light *= edge === dt || edge === dl ? 1.3 : 0.6;
                    const i = (y * size + x) * 4;
                    img.data[i] = Math.round(clamp01(0.56 * light) * 255);
                    img.data[i + 1] = Math.round(clamp01(0.46 * light) * 255);
                    img.data[i + 2] = Math.round(clamp01(0.36 * light) * 255);
                    img.data[i + 3] = 255;
                }
            }
            c.putImageData(img, 0, 0);

            // Rachaduras em zigue-zague partindo do centro
            c.strokeStyle = "rgb(33, 26, 20)";
            c.lineWidth = Math.max(1, size / 30);
            for (let sIdx = 0; sIdx < 4; sIdx++) {
                let ang = (Math.PI / 2) * sIdx + Math.random();
                let px = size / 2, py = size / 2;
                c.beginPath();
                c.moveTo(px, py);
                for (let seg = 0; seg < 4; seg++) {
                    ang += (Math.random() - 0.5) * 1.2;
                    px += Math.cos(ang) * size * 0.11;
                    py += Math.sin(ang) * size * 0.11;
                    c.lineTo(px, py);
                }
                c.stroke();
            }
            return canvas;
        });

    // Brilho radial suave tingido (rastro, faíscas, flashes e orbes do fundo).
    const glow = (color) => {
        const q = (v) => Math.round(clamp01(v) * 20) / 20;
        const key = `glow:${q(color.r)},${q(color.g)},${q(color.b)}`;
        return cached(key, () => {
            const size = 64;
            const canvas = makeCanvas(size, size);
            const c = canvas.getContext("2d");
            const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            const col = { r: q(color.r), g: q(color.g), b: q(color.b) };
            // a = (1 - d)²
            [[0, 1], [0.25, 0.5625], [0.5, 0.25], [0.75, 0.0625], [1, 0]].forEach(([stop, a]) =>
                grad.addColorStop(stop, css(col, a))
            );
            c.fillStyle = grad;
            c.fillRect(0, 0, size, size);
            return canvas;
        });
    };

    // Anel de onda de choque: borda externa nítida e interna suave.
    const ring = (color) => {
        const q = (v) => Math.round(clamp01(v) * 20) / 20;
        const col = { r: q(color.r), g: q(color.g), b: q(color.b) };
        return cached(`ring:${col.r},${col.g},${col.b}`, () => {
            const size = 256;
            const canvas = makeCanvas(size, size);
            const c = canvas.getContext("2d");
            const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            [[0, 0], [0.55, 0], [0.7, 0.18], [0.8, 0.51], [0.9, 1], [0.95, 0.25], [1, 0]].forEach(([stop, a]) =>
                grad.addColorStop(stop, css(col, a))
            );
            c.fillStyle = grad;
            c.fillRect(0, 0, size, size);
            return canvas;
        });
    };

    // Rachaduras em teia (vidro temperado) exibidas antes de estilhaçar.
    const cracks = (sizePx) =>
        cached(`cracks:${sizePx}`, () =>
            Array.from({ length: 4 }, () => {
                const size = Math.max(4, sizePx);
                const canvas = makeCanvas(size, size);
                const c = canvas.getContext("2d");
                c.lineWidth = Math.max(1, size / 40);
                c.lineCap = "round";
                const cx = size / 3 + Math.random() * (size / 3);
                const cy = size / 3 + Math.random() * (size / 3);
                const spokes = 7 + Math.floor(Math.random() * 4);
                const ends = [];
                c.strokeStyle = "rgba(255, 255, 255, 0.95)";
                c.beginPath();
                for (let s = 0; s < spokes; s++) {
                    const ang = (Math.PI * 2 * s) / spokes + Math.random() * 0.4;
                    const len = size * (0.6 + Math.random() * 0.4);
                    const ex = cx + Math.cos(ang) * len;
                    const ey = cy + Math.sin(ang) * len;
                    ends.push([ex, ey]);
                    c.moveTo(cx, cy);
                    c.lineTo(ex, ey);
                }
                c.stroke();
                c.strokeStyle = "rgba(255, 255, 255, 0.6)";
                c.beginPath();
                for (let k = 0.3; k < 0.9; k += 0.28) {
                    ends.forEach(([ex, ey], s) => {
                        const [nx, ny] = ends[(s + 1) % spokes];
                        c.moveTo(cx + (ex - cx) * k, cy + (ey - cy) * k);
                        c.lineTo(cx + (nx - cx) * k, cy + (ny - cy) * k);
                    });
                }
                c.stroke();
                return canvas;
            })
        );

    // Fragmentos de vidro: polígonos irregulares (coordenadas de -0.5 a 0.5).
    const SHARD_SHAPES = Array.from({ length: 8 }, () => {
        const vertices = 3 + Math.floor(Math.random() * 2);
        return Array.from({ length: vertices }, (_, v) => {
            const ang = (Math.PI * 2 * v) / vertices + Math.random() * 0.9;
            const rad = 0.5 * (0.55 + Math.random() * 0.42);
            return [Math.cos(ang) * rad, Math.sin(ang) * rad];
        });
    });

    // Plano de fundo futurista: gradiente, nebulosas, estrelas, horizonte brilhante e grade em perspectiva.
    const background = (w, h, scale) => {
        const W = Math.round(w * scale);
        const H = Math.round(h * scale);
        const canvas = makeCanvas(W, H);
        const c = canvas.getContext("2d");

        const base = c.createLinearGradient(0, 0, 0, H);
        base.addColorStop(0, "rgb(4, 5, 18)");
        base.addColorStop(1, "rgb(17, 10, 36)");
        c.fillStyle = base;
        c.fillRect(0, 0, W, H);

        c.globalCompositeOperation = "lighter";
        const nebulas = [
            [0.15, 0.2, 0.45, [0.1, 0.35, 0.6]],
            [0.85, 0.35, 0.5, [0.45, 0.1, 0.55]],
            [0.5, 0.65, 0.4, [0.05, 0.4, 0.5]],
        ];
        nebulas.forEach(([nx, ny, nr, col]) => {
            const radius = nr * Math.max(W, H);
            const grad = c.createRadialGradient(nx * W, ny * H, 0, nx * W, ny * H, radius);
            const color = { r: col[0], g: col[1], b: col[2] };
            grad.addColorStop(0, css(color, 0.22));
            grad.addColorStop(0.5, css(color, 0.08));
            grad.addColorStop(1, css(color, 0));
            c.fillStyle = grad;
            c.fillRect(0, 0, W, H);
        });

        const horizon = 0.7;
        const hz = c.createLinearGradient(0, H * (horizon - 0.06), 0, H * (horizon + 0.06));
        hz.addColorStop(0, "rgba(204, 51, 230, 0)");
        hz.addColorStop(0.5, "rgba(204, 51, 230, 0.35)");
        hz.addColorStop(1, "rgba(204, 51, 230, 0)");
        c.fillStyle = hz;
        c.fillRect(0, H * (horizon - 0.06), W, H * 0.12);
        c.globalCompositeOperation = "source-over";

        // Estrelas na parte de cima
        for (let i = 0; i < 260; i++) {
            const sx = Math.random() * W;
            const sy = Math.random() * H * horizon;
            c.fillStyle = `rgba(204, 230, 255, ${0.25 + Math.random() * 0.6})`;
            if (Math.random() < 0.12) {
                c.beginPath();
                c.arc(sx, sy, 1.6 * scale, 0, Math.PI * 2);
                c.fill();
            } else {
                c.fillRect(sx, sy, Math.max(1, scale * 0.8), Math.max(1, scale * 0.8));
            }
        }

        // Grade em perspectiva abaixo do horizonte
        const hy = H * horizon;
        const depth = H - hy;
        c.lineWidth = Math.max(1, scale);
        for (let i = 1; i <= 14; i++) {
            const t = i / 14;
            const ly = hy + depth * t * t;
            c.strokeStyle = `rgba(64, 191, 255, ${0.08 + 0.22 * t})`;
            c.beginPath();
            c.moveTo(0, ly);
            c.lineTo(W, ly);
            c.stroke();
        }
        c.strokeStyle = "rgba(64, 191, 255, 0.16)";
        const vanishX = W / 2;
        for (let i = -16; i <= 16; i++) {
            c.beginPath();
            c.moveTo(vanishX + i * 6 * scale, hy);
            c.lineTo(vanishX + i * (W / 7), H);
            c.stroke();
        }
        return canvas;
    };

    // =================================================================
    // Partículas
    // =================================================================

    const SPARK = 0, FLASH = 1, TRAIL = 2, RING = 3, STREAK = 4;

    const createParticles = (unit) => {
        // "unit" converte as medidas do jogo em Java (blocos de 60 px) para o tamanho do bloco aqui.
        const k = unit;
        const GRAVITY = 1800 * k;
        const RING_MAX_SIZE = 2800 * k;
        let shards = [];
        let glows = [];

        const addGlow = (p) => glows.push(Object.assign({ vx: 0, vy: 0, kind: SPARK }, p));

        return {
            shatterBlock(x, y, size, hex, centerX) {
                const color = hexToRgb(hex);
                const pieces = 4;
                const sub = size / pieces;
                for (let i = 0; i < pieces; i++) {
                    for (let j = 0; j < pieces; j++) {
                        const px = x + (i + 0.5) * sub;
                        const py = y + (j + 0.5) * sub;
                        const life = rand(0.9, 1.6);
                        shards.push({
                            x: px,
                            y: py,
                            vx: (px - centerX) * rand(0.8, 2.2) + rand(-220, 220) * k,
                            vy: -rand(150, 750) * k,
                            rotation: rand(0, 360),
                            spin: rand(-900, 900),
                            size: rand(sub * 0.7, sub * 1.5),
                            life,
                            maxLife: life,
                            color,
                            shape: Math.floor(Math.random() * SHARD_SHAPES.length),
                        });
                    }
                }
                for (let s = 0; s < 4; s++) {
                    const life = rand(0.25, 0.5);
                    const sz = rand(10, 22) * k;
                    addGlow({
                        x: x + rand(0, size), y: y + rand(0, size),
                        vx: rand(-500, 500) * k, vy: rand(-600, 200) * k,
                        w: sz, h: sz, life, maxLife: life,
                        color: { r: 1, g: 1, b: 1 }, a: 0.9, kind: SPARK,
                    });
                }
            },

            lineFlash(x, y, width, height) {
                addGlow({
                    x: x + width / 2, y: y + height / 2,
                    w: width * 1.15, h: height * 2.2, life: 0.35, maxLife: 0.35,
                    color: { r: 0.85, g: 0.95, b: 1 }, a: 0.9, kind: FLASH,
                });
            },

            shockwave(x, y, tint) {
                for (let i = 0; i < 2; i++) {
                    const maxLife = 0.75 + 0.2 * i;
                    addGlow({
                        x, y, w: 0, h: 0, maxLife,
                        life: maxLife + 0.12 * i, // vida extra = atraso do segundo anel
                        color: mix(tint, 0.6, 0.4), a: i === 0 ? 0.85 : 0.5, kind: RING,
                    });
                }
            },

            dropStreak(x, yTop, yBottom, cell, hex) {
                addGlow({
                    x, y: (yTop + yBottom) / 2,
                    w: cell * 0.9, h: (yBottom - yTop) * 1.1, life: 0.32, maxLife: 0.32,
                    color: mix(hexToRgb(hex), 0.6, 0.4), a: 0.55, kind: STREAK,
                });
            },

            impact(x, y, width, hex) {
                const color = hexToRgb(hex);
                for (let i = 0; i < 6; i++) {
                    const side = i % 2 === 0 ? -1 : 1;
                    const life = rand(0.2, 0.45);
                    const sz = rand(8, 18) * k;
                    addGlow({
                        x: x + side * rand(0, width * 0.5), y: y - rand(0, 6 * k),
                        vx: side * rand(180, 520) * k, vy: -rand(80, 380) * k,
                        w: sz, h: sz, life, maxLife: life,
                        color: mix(color, 0.7, 0.3), a: 0.9, kind: SPARK,
                    });
                }
                addGlow({
                    x, y, w: width * 1.6, h: width * 0.7, life: 0.25, maxLife: 0.25,
                    color: mix(color, 0.6, 0.4), a: 0.7, kind: FLASH,
                });
            },

            trail(x, y, cell, hex) {
                const color = mix(hexToRgb(hex), 0.55, 0.45);
                for (let i = 0; i < 3; i++) {
                    const life = rand(0.35, 0.65);
                    const w = rand(cell * 0.45, cell * 0.7);
                    addGlow({
                        x: x + rand(-cell * 0.08, cell * 0.08), y: y + rand(0, cell),
                        vx: rand(-8, 8) * k, vy: -rand(10, 35) * k,
                        w, h: w * 1.8, life, maxLife: life,
                        color, a: 0.22, kind: TRAIL,
                    });
                }
            },

            update(dt) {
                shards = shards.filter((p) => {
                    p.life -= dt;
                    if (p.life <= 0) return false;
                    p.vy += GRAVITY * dt;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.rotation += p.spin * dt;
                    return true;
                });
                glows = glows.filter((p) => {
                    p.life -= dt;
                    if (p.life <= 0) return false;
                    if (p.kind === SPARK) p.vy += GRAVITY * 0.4 * dt;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.kind === FLASH) p.h *= 1 - dt * 3;
                    else if (p.kind === TRAIL) p.w *= 1 + dt * 0.6;
                    else if (p.kind === STREAK) p.w *= 1 - dt * 4;
                    else if (p.kind === RING) {
                        const t = clamp01(1 - p.life / p.maxLife);
                        p.w = p.h = RING_MAX_SIZE * (1 - (1 - t) * (1 - t));
                    }
                    return true;
                });
            },

            drawGlow(ctx, p) {
                const t = Math.min(1, p.life / p.maxLife);
                if (p.kind === RING) {
                    if (p.life > p.maxLife) return; // ainda no atraso
                    ctx.globalAlpha = p.a * t * t;
                    ctx.drawImage(ring(p.color), p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
                    return;
                }
                ctx.globalAlpha = p.a * t;
                ctx.drawImage(glow(p.color), p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
            },

            // Rastro e faixas da queda rápida (atrás da peça).
            drawTrail(ctx) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                glows.forEach((p) => {
                    if (p.kind === TRAIL || p.kind === STREAK) this.drawGlow(ctx, p);
                });
                ctx.restore();
            },

            // Estilhaços, faíscas, flashes e anéis (na frente das peças).
            drawFront(ctx) {
                ctx.save();
                shards.forEach((p) => {
                    const t = p.life / p.maxLife;
                    const alpha = (t < 0.5 ? t / 0.5 : 1) * 0.85;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.beginPath();
                    SHARD_SHAPES[p.shape].forEach(([vx, vy], i) => {
                        if (i === 0) ctx.moveTo(vx * p.size, vy * p.size);
                        else ctx.lineTo(vx * p.size, vy * p.size);
                    });
                    ctx.closePath();
                    ctx.fillStyle = css(p.color, 0.75 * alpha);
                    ctx.fill();
                    ctx.lineWidth = 0.8;
                    ctx.strokeStyle = css(mix(p.color, 0.6, 0.4), alpha);
                    ctx.stroke();

                    // Reflexo cintilante do vidro conforme o pedaço gira
                    const glint = Math.pow(Math.abs(Math.sin((p.rotation * Math.PI) / 180)), 6);
                    if (glint > 0.05) {
                        ctx.globalCompositeOperation = "lighter";
                        ctx.fillStyle = `rgba(255, 255, 255, ${glint * 0.7 * Math.min(1, t * 2)})`;
                        ctx.fill();
                    }
                    ctx.restore();
                });

                ctx.globalCompositeOperation = "lighter";
                glows.forEach((p) => {
                    if (p.kind !== TRAIL && p.kind !== STREAK) this.drawGlow(ctx, p);
                });
                ctx.restore();
            },

            clear() {
                shards = [];
                glows = [];
            },
        };
    };

    // =================================================================
    // Sons sintetizados (sem arquivos de áudio)
    // =================================================================

    const SAMPLE_RATE = 44100;

    // Normaliza e aplica fade-out no fim.
    const finish = (out, fade) => {
        let peak = 0;
        for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
        const gain = peak > 0 ? 0.9 / peak : 1;
        for (let i = 0; i < out.length; i++) {
            let v = out[i] * gain;
            if (i > out.length - fade) v *= (out.length - i) / fade;
            out[i] = Math.max(-1, Math.min(1, v));
        }
        return out;
    };

    const SYNTHS = {
        // Vidro temperado estilhaçando: estalo + chiado, baque grave e tilintar dos cacos.
        shatter() {
            const length = Math.floor(SAMPLE_RATE * 1.3);
            const out = new Float32Array(length);
            let prev = 0;
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                const noise = Math.random() * 2 - 1;
                const high = noise - prev;
                prev = noise;
                const env = 0.9 * Math.exp(-t * 90) + 0.25 * Math.exp(-t * 7);
                out[i] += high * env * 0.5;
                out[i] += Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 28) * 0.35;
            }
            for (let p = 0; p < 140; p++) {
                const start = 0.01 + -Math.log(1 - Math.random() * 0.98) * 0.22;
                if (start > 1.1) continue;
                const freq = 2200 + Math.random() * 7000;
                const decay = 30 + Math.random() * 50;
                const amp = (0.08 + Math.random() * 0.22) * (1.2 - start);
                const s0 = Math.floor(start * SAMPLE_RATE);
                const dur = Math.floor(SAMPLE_RATE * 0.12);
                for (let k = 0; k < dur && s0 + k < length; k++) {
                    const t = k / SAMPLE_RATE;
                    const ph = 2 * Math.PI * freq * t;
                    out[s0 + k] += amp * Math.exp(-t * decay) * (Math.sin(ph) + 0.5 * Math.sin(ph * 2.76));
                }
            }
            return finish(out, SAMPLE_RATE / 10);
        },

        // Aceleração de jato: ruído com filtro abrindo e ronco grave subindo.
        jet() {
            const length = Math.floor(SAMPLE_RATE * 0.6);
            const out = new Float32Array(length);
            let lowPass = 0;
            let phase = 0;
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                const p = i / length;
                const cutoff = 400 + 7000 * p * p;
                const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
                lowPass += alpha * (Math.random() * 2 - 1 - lowPass);
                phase += (2 * Math.PI * (60 + 180 * p)) / SAMPLE_RATE;
                const rumble = Math.sin(phase) + 0.5 * Math.sin(phase * 2);
                const env = Math.min(1, t / 0.03) * Math.sin(Math.PI * Math.pow(p, 0.6));
                out[i] = (lowPass * 1.2 + rumble * 0.3) * env;
            }
            return finish(out, SAMPLE_RATE / 50);
        },

        // Estalo curto do movimento lateral.
        move() {
            const length = Math.floor(SAMPLE_RATE * 0.04);
            const out = new Float32Array(length);
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                out[i] = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 140);
            }
            return finish(out, SAMPLE_RATE / 500);
        },

        // Varredura ascendente rápida da rotação.
        rotate() {
            const length = Math.floor(SAMPLE_RATE * 0.09);
            const out = new Float32Array(length);
            let phase = 0;
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                const p = i / length;
                phase += (2 * Math.PI * (500 + 800 * p)) / SAMPLE_RATE;
                out[i] = (Math.sin(phase) + 0.3 * Math.sin(phase * 2)) * Math.exp(-t * 28);
            }
            return finish(out, SAMPLE_RATE / 200);
        },

        // Pedra quebrando: baque grave, estalo seco e cascalho caindo.
        stone() {
            const length = Math.floor(SAMPLE_RATE * 0.8);
            const out = new Float32Array(length);
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                const thud = Math.sin(2 * Math.PI * (45 + 40 * Math.exp(-t * 30)) * t) * Math.exp(-t * 12);
                const crack = (Math.random() * 2 - 1) * Math.exp(-t * 55);
                out[i] = thud * 0.9 + crack * 0.7;
            }
            for (let g = 0; g < 70; g++) {
                const start = 0.02 + -Math.log(1 - Math.random() * 0.98) * 0.14;
                const s0 = Math.floor(start * SAMPLE_RATE);
                const dur = Math.floor(SAMPLE_RATE * (0.012 + Math.random() * 0.03));
                const amp = (0.15 + Math.random() * 0.35) * Math.max(0.1, 1 - start);
                const alpha = 0.08 + Math.random() * 0.3;
                let lowPass = 0;
                for (let k = 0; k < dur && s0 + k < length; k++) {
                    lowPass += alpha * (Math.random() * 2 - 1 - lowPass);
                    out[s0 + k] += lowPass * amp * 2 * (1 - k / dur);
                }
            }
            return finish(out, SAMPLE_RATE / 10);
        },

        // Bipe eletrônico da peça transparente.
        beep() {
            const length = Math.floor(SAMPLE_RATE * 0.11);
            const out = new Float32Array(length);
            for (let i = 0; i < length; i++) {
                const t = i / SAMPLE_RATE;
                const ph = 2 * Math.PI * 1800 * t;
                out[i] = (Math.sin(ph) + 0.25 * Math.sin(ph * 3)) * Math.min(1, t / 0.003);
            }
            return finish(out, SAMPLE_RATE / 100);
        },

        start: () => jingle([60, 64, 67, 72], 0.09, 0.35),
        levelUp: () => jingle([67, 72, 76, 79, 84], 0.07, 0.45),
        gameOver: () => jingle([69, 65, 62, 57, 52], 0.22, 0.7),
    };

    // Sequência de notas (MIDI) em timbre de fliperama.
    function jingle(notes, noteSeconds, tail) {
        const length = Math.floor(SAMPLE_RATE * (noteSeconds * (notes.length - 1) + tail));
        const out = new Float32Array(length);
        notes.forEach((note, n) => {
            const freq = 440 * Math.pow(2, (note - 69) / 12);
            const start = Math.floor(SAMPLE_RATE * noteSeconds * n);
            const seconds = n === notes.length - 1 ? tail : noteSeconds * 2.5;
            const duration = Math.floor(SAMPLE_RATE * seconds);
            for (let k = 0; k < duration && start + k < length; k++) {
                const t = k / SAMPLE_RATE;
                const ph = 2 * Math.PI * freq * t;
                const env = Math.min(1, t / 0.004) * Math.exp((-t * 3.5) / seconds);
                out[start + k] += (Math.sin(ph) + Math.sin(ph * 3) / 3 + Math.sin(ph * 5) / 5) * env;
            }
        });
        return finish(out, SAMPLE_RATE / 50);
    }

    const createSounds = (enabledInitially) => {
        let audio = null;
        let master = null;
        const buffers = {};
        let enabled = enabledInitially;

        const ensure = () => {
            if (audio) {
                if (audio.state === "suspended") audio.resume();
                return true;
            }
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return false;
            audio = new AudioCtx();
            master = audio.createGain();
            master.gain.value = 0.5;
            master.connect(audio.destination);
            return true;
        };

        const getBuffer = (name) => {
            if (!buffers[name]) {
                const data = SYNTHS[name]();
                const buffer = audio.createBuffer(1, data.length, SAMPLE_RATE);
                buffer.copyToChannel(data, 0);
                buffers[name] = buffer;
            }
            return buffers[name];
        };

        return {
            // Precisa ser chamado num gesto do usuário (tecla/toque) para liberar o áudio.
            unlock() {
                ensure();
            },
            play(name, volume = 1, pitch = 1) {
                if (!enabled || !ensure()) return;
                const source = audio.createBufferSource();
                source.buffer = getBuffer(name);
                source.playbackRate.value = pitch;
                const gain = audio.createGain();
                gain.gain.value = volume;
                source.connect(gain);
                gain.connect(master);
                source.start();
            },
            toggle() {
                enabled = !enabled;
                return enabled;
            },
            get enabled() {
                return enabled;
            },
        };
    };

    return { hexToRgb, css, glassBlock, stoneBlock, glow, cracks, background, createParticles, createSounds };
})();
