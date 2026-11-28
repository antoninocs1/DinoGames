/* =====================================================================
   Siga o Dino — pentagrama (clave de sol) para os modelos de teclado
   ---------------------------------------------------------------------
   Desenha as notas da sequência na pauta, com a cor da tecla e o nome
   dentro da cabeça da nota, só com a cor (sem nome) ou só em preto, sem
   nome, como numa partitura de verdade — modo desafio. A cabeça é um pouco inclinada, como na
   escrita musical. A nota acende quando toca.
   A figura acompanha a velocidade:
     semibreve (lenta) → mínima → semínima (rápida)
   Não sabe nada da partida: o jogo chama begin/push/light/done.
   Pauta dupla (piano): setGrand(true) acrescenta a pauta da clave de Fá embaixo;
   push/pushRest com hand: "me" desenham nela. Com at (instante da música), as
   notas do mesmo instante ficam na mesma vertical (coluna) nas duas pautas.
   ===================================================================== */
(() => {
    "use strict";

    const SP = 12;               // distância entre as linhas da pauta
    const BOTTOM = 48;           // y da 1ª linha (Mi)
    const X0 = 62, DX = 32;      // x da 1ª nota e espaço entre notas
    const W_NORMAL = 420;        // largura do desenho (7 e 12 notas)
    const W_WIDE = 640;          // 2 oitavas: teclado mais largo, pauta mais comprida
    const STEM = 34;
    const BAR_GAP = 12;          // folga a mais quando há barra de compasso antes da nota
    const MAX_NOTES = 120;       // guarda só as últimas (as mais antigas já saíram de vista)
    const METER_W = 18;          // espaço a mais depois da clave quando há fórmula de compasso (4/4)
    // Pauta dupla: a pauta da clave de Fá começa BASS_TOP abaixo da 5ª linha da clave de Sol.
    const BASS_TOP = BOTTOM + 60;
    const BASS_BOTTOM = BASS_TOP + 4 * SP;
    const slotsFor = (w, x0 = X0) => Math.floor((w - x0 - 8) / DX) + 1; // notas que cabem sem rolar

    const FIGURES = {
        // Cabeça com o nome dentro: pequena o bastante para ver se está na linha ou no espaço.
        // flags = bandeirolas na haste (colcheia 1, semicolcheia 2 …); whole = cabeça de semibreve.
        breve:        { title: "Breve",        rx: 10.2, ry: 7.4, hollow: true, stem: false, whole: true, breve: true },
        semibreve:    { title: "Semibreve",    rx: 10.2, ry: 7.4, hollow: true, stem: false, whole: true },
        minima:       { title: "Mínima",       rx: 9.4, ry: 7, hollow: true, stem: true },
        seminima:     { title: "Semínima",     rx: 9.4, ry: 7, hollow: false, stem: true },
        colcheia:     { title: "Colcheia",     rx: 9.4, ry: 7, hollow: false, stem: true, flags: 1 },
        semicolcheia: { title: "Semicolcheia", rx: 9.4, ry: 7, hollow: false, stem: true, flags: 2 },
        fusa:         { title: "Fusa",         rx: 9.4, ry: 7, hollow: false, stem: true, flags: 3 },
        semifusa:     { title: "Semifusa",     rx: 9.4, ry: 7, hollow: false, stem: true, flags: 4 },
        quartifusa:   { title: "Quartifusa",   rx: 9.4, ry: 7, hollow: false, stem: true, flags: 5 },
    };

    /** Figura pela duração da nota acesa (ms): quanto mais rápido, menor a figura. */
    const TILT = -20;            // inclinação da cabeça (graus, sobe para a direita)
    // Sem nome (só preto ou só cor): cabeças menores e mais alongadas, como numa partitura.
    const MONO = {
        semibreve: { rx: 8.6, ry: 6.2, tilt: 0 },
        minima:    { rx: 7.6, ry: 5.4, tilt: TILT },
        seminima:  { rx: 7.6, ry: 5.4, tilt: TILT },
    };
    const monoOf = (name) => MONO[name] || (FIGURES[name]?.whole ? MONO.semibreve : MONO.seminima);
    const INK = "#1d1b22";

    /** Meia largura da elipse inclinada e a altura do ponto mais à direita (onde a haste encosta). */
    const edgeOf = (rx, ry, deg) => {
        const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
        const half = Math.sqrt(rx * rx * c * c + ry * ry * s * s);
        return { half, dy: (rx * rx - ry * ry) * s * c / half };
    };

    /** Elipse inclinada como trecho de path (duas meias-voltas), para furar a cabeça com evenodd. */
    const ellipsePath = (cx, cy, rx, ry, deg) => {
        const t = deg * Math.PI / 180, ax = rx * Math.cos(t), ay = rx * Math.sin(t);
        return `M${f(cx + ax)} ${f(cy + ay)}A${rx} ${ry} ${deg} 1 0 ${f(cx - ax)} ${f(cy - ay)}A${rx} ${ry} ${deg} 1 0 ${f(cx + ax)} ${f(cy + ay)}Z`;
    };

    /**
     * Sustenido e bemol desenhados (não com letra de fonte), com o centro exatamente na
     * altura da nota: em cima da linha quando a nota é de linha, no meio do espaço quando é de espaço.
     */
    const ACC_SCALE = 0.78; // tamanho do ♯/♭ em relação ao desenho original
    const sharpSvg = (x, y) => {
        const bar = (cy) => `M-5 ${cy + 1.4}L5 ${cy - 1.4}L5 ${cy + 1.4}L-5 ${cy + 4.2}Z`;
        return `<g class="acc" transform="translate(${f(x)} ${f(y)}) scale(${ACC_SCALE})">
            <path d="M-2.3 -10.5V13M2.3 -13V10.5" fill="none" stroke="${INK}" stroke-width="1.3"/>
            <path d="${bar(-6.2)}${bar(3.4)}" fill="${INK}"/>
        </g>`;
    };
    const flatSvg = (x, y) => `<g class="acc" transform="translate(${f(x)} ${f(y)}) scale(${ACC_SCALE})">
            <path d="M-4 -19V5.2" fill="none" stroke="${INK}" stroke-width="1.3"/>
            <path d="M-4.6 5.4C1 2.6 4.6 -0.4 4.2 -3.4C3.8 -6.4 -0.4 -6.6 -4 -3.2V-1.2C-1 -4.2 1.9 -4.4 2 -2.6C2.1 -0.6 -0.6 1.8 -4 3.6Z" fill="${INK}"/>
        </g>`;

    /** Bequadro (♮): duas hastes desencontradas e duas barras inclinadas. */
    const naturalSvg = (x, y) => `<g class="acc" transform="translate(${f(x)} ${f(y)}) scale(${ACC_SCALE})">
            <path d="M-3 -12V5M3 -5V12" fill="none" stroke="${INK}" stroke-width="1.3"/>
            <path d="M-3 -3.2L3 -5.8V-3L-3 -0.4ZM-3 4.4L3 1.8V4.6L-3 7.2Z" fill="${INK}"/>
        </g>`;

    /** Bandeirolas na ponta da haste (sx, tip): para baixo se a haste sobe, para cima se desce. */
    const flagsSvg = (sx, tip, n, up) => {
        const d = up ? 1 : -1;
        let p = "";
        for (let k = 0; k < n; k++) {
            const y = tip + d * k * 6.5;
            p += `M${f(sx)} ${f(y)}C${f(sx + 1)} ${f(y + d * 6)} ${f(sx + 9.5)} ${f(y + d * 8)} ${f(sx + 7.5)} ${f(y + d * 17)}` +
                `C${f(sx + 7.6)} ${f(y + d * 11)} ${f(sx + 4)} ${f(y + d * 8.6)} ${f(sx)} ${f(y + d * 7.4)}Z`;
        }
        return `<path class="flag" d="${p}" fill="${INK}"/>`;
    };

    /** Pausa da figura (sem nota), centrada em x. Linhas: y 0 (5ª) … 48 (1ª). */
    const restSvg = (x, figureName) => {
        const fig = FIGURES[figureName] || FIGURES.seminima;
        const rect = (y, h, w = 12) => `<rect x="${f(x - w / 2)}" y="${y}" width="${w}" height="${h}" fill="${INK}"/>`;
        if (figureName === "breve") return rect(12, 12, 6);
        if (figureName === "semibreve") return rect(12, 6);          // pendurada na 4ª linha
        if (figureName === "minima") return rect(18, 6);             // sentada na 3ª linha
        if (figureName === "seminima") {
            return `<path d="M${f(x - 3)} 9L${f(x + 3.5)} 17L${f(x - 1.5)} 23.5L${f(x + 4)} 31.5C${f(x - 2)} 28.5 ${f(x - 5)} 32 ${f(x - 0.5)} 38.5"
                fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
        }
        // Colcheia e menores: um gancho (bolinha + curva) para cada bandeirola, numa haste inclinada.
        const n = fig.flags || 1;
        const top = 18 - (n - 1) * 6, bottom = 36 + (n > 2 ? 6 : 0);
        const lean = 0.28; // a haste inclina para a esquerda descendo
        const sxAt = (y) => x + 3 - (y - top) * lean;
        let p = `<line x1="${f(sxAt(top))}" y1="${top}" x2="${f(sxAt(bottom))}" y2="${bottom}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
        for (let k = 0; k < n; k++) {
            const y = top + k * 6, sx = sxAt(y);
            p += `<circle cx="${f(sx - 6)}" cy="${f(y + 1.6)}" r="2.3" fill="${INK}"/>` +
                `<path d="M${f(sx - 7.5)} ${f(y + 2.6)}Q${f(sx - 3)} ${f(y + 4.4)} ${f(sx)} ${f(y)}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
        }
        return p;
    };

    const figureFor = (ms) => (ms >= 500 ? "semibreve" : ms >= 340 ? "minima" : "seminima");

    const f = (n) => +n.toFixed(2);
    /** y da nota pela posição na escala: 0 = Dó (linha suplementar), 1 = Ré, 2 = Mi (1ª linha)… */
    const yOf = (step) => BOTTOM - (step - 2) * (SP / 2);
    /**
     * Geometria de cada clave: y da nota (step 0 = Dó central), 1ª e 5ª linhas, linha do
     * meio (decide a haste) e o y da 5ª linha (base, para pausas e números).
     * Clave de Fá: 1ª linha = Sol de baixo (step -10), 5ª = Lá (step -2), Dó central acima dela.
     */
    const CLEFS = {
        sol: { y: yOf, bottom: 2, top: 10, mid: 6, base: 0 },
        fa: { y: (step) => BASS_BOTTOM - (step + 10) * (SP / 2), bottom: -10, top: -2, mid: -6, base: BASS_TOP },
    };

    const lum = (hex) => {
        const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.substr(k, 2), 16) / 255);
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const tint = (hex, k) => "#" + [1, 3, 5].map((i) => {
        const c = parseInt(hex.substr(i, 2), 16);
        return Math.round(c + (255 - c) * k).toString(16).padStart(2, "0");
    }).join("");

    // Clave de sol desenhada com traço (a espiral abraça a 2ª linha, a do Sol).
    const CLEF = `<g class="clef" transform="translate(4 0)">
        <path d="M22 38 C17.5 38 16.6 32.4 21.2 31.6 C26.4 30.8 29.6 36 27.4 40.6 C24.6 46.4 12.6 46 10.8 38.4
                 C9.2 31 15 24.6 21.4 18.4 C27.6 12.4 30.4 3.4 28.2 -6.4 C26.9 -12.6 21.6 -12.4 20.6 -5.6
                 C19.4 3 21.4 31 24.4 52.6 C25.6 61.4 20.2 64.6 15.6 61.6"/>
        <circle cx="16.8" cy="58.4" r="3.6"/>
    </g>`;

    // Clave de Fá: a bolinha na 4ª linha (a do Fá), a curva e os dois pontos em volta dela.
    const BASS_CLEF = `<g class="clef bass-clef" transform="translate(5 ${BASS_TOP}) scale(.88)">
        <path d="M9.6 12.4C8.4 5.2 13 1 18.6 1C25.6 1 29.4 6.4 29.4 13.4C29.4 25.4 20 34.6 6 41.6"/>
        <circle cx="9.8" cy="12" r="3.8"/><circle cx="35" cy="6.6" r="1.9"/><circle cx="35" cy="17.4" r="1.9"/>
    </g>`;

    /**
     * Cria o pentagrama dentro de um <svg>.
     * @param {SVGSVGElement} svg
     */
    // Posição de cada acidente da armadura na clave de Sol (step); na de Fá, 2 oitavas abaixo.
    const SHARP_STEPS = [10, 7, 11, 8, 5, 9, 6], FLAT_STEPS = [6, 9, 5, 8, 4, 7, 3];
    const KEY_DX = 7;
    /** Os ♯/♭ da armadura (count > 0 sustenidos, < 0 bemóis) a partir de x, numa clave. */
    const keySigSvg = (count, x, cl, shift) => (count > 0 ? SHARP_STEPS : FLAT_STEPS).slice(0, Math.abs(count)).map((st, i) =>
        (count > 0 ? sharpSvg : flatSvg)(x + 3 + i * KEY_DX, cl.y(st - shift))).join("");

    const createStaff = (svg) => {
        let mode = null;
        let nameOf = (pad) => pad.name;
        let flats = false;
        let look = "nome";       // "nome" (cor + nome), "cor" (só cor) ou "preto" (desafio)
        let notes = [];          // { el, pad }
        let shift = 0;           // quanto (px) a pauta já rolou para a esquerda
        let first = 0;           // posição da 1ª nota ainda guardada (as anteriores já foram apagadas)
        let lead = false;
        let endBar = null;       // barra dupla do fim da música
        let x0 = X0;             // x da 1ª nota (mais à direita com a fórmula de compasso)
        let meter = "";          // fórmula de compasso desenhada depois da clave ("4/4")
        let keyCount = 0;        // armadura: sustenidos (+) ou bemóis (−) depois da clave
        let grand = false;       // pauta dupla (clave de Sol + clave de Fá)
        let deep = false;        // espaço para notas abaixo do Dó central (só a clave de Sol)
        let col = null;          // coluna atual: { at, x, right, extraRight, count, barEl }
        let prevCol = null;      // coluna anterior (a barra de compasso fica entre as duas)
        let afterKey = false;    // acabou de trocar a armadura (a próxima coluna não ganha barra)
        let keyNow = 0;          // armadura valendo para a próxima nota (muda com keyChange)
        let keyShown = 0;        // armadura desenhada depois da clave (a da 1ª nota à vista)

        let W = W_NORMAL, SLOTS = slotsFor(W);
        let baseW = W_NORMAL;    // largura mínima do desenho; W cresce além dela para encher a caixa
        svg.innerHTML = `
            <defs><clipPath id="staff-clip"><rect x="0" y="-400" width="${W_WIDE}" height="1000"/></clipPath></defs>
            <g class="staff-lines">${[0, 1, 2, 3, 4].map((i) =>
                `<line x1="2" x2="${W_NORMAL - 2}" y1="${BOTTOM - i * SP}" y2="${BOTTOM - i * SP}"/>`).join("")}</g>
            ${CLEF}
            <g class="bass-staff" style="display:none">
                <g class="staff-lines">${[0, 1, 2, 3, 4].map((i) =>
                    `<line x1="2" x2="${W_NORMAL - 2}" y1="${BASS_BOTTOM - i * SP}" y2="${BASS_BOTTOM - i * SP}"/>`).join("")}</g>
                <line class="system" x1="2" x2="2" y1="0" y2="${BASS_BOTTOM}"/>
                ${BASS_CLEF}
            </g>
            <g class="keysig"></g>
            <g class="meter"></g>
            <text class="staff-title" text-anchor="middle"></text>
            <g clip-path="url(#staff-clip)"><g class="staff-notes"></g></g>`;
        const layer = svg.querySelector(".staff-notes");
        const titleEl = svg.querySelector(".staff-title");
        const meterEl = svg.querySelector(".meter");
        const keyEl = svg.querySelector(".keysig");
        const bassEl = svg.querySelector(".bass-staff");
        const clipRect = svg.querySelector("#staff-clip rect");
        /**
         * Recorte das notas: começa logo depois da clave, da armadura e da fórmula de compasso,
         * para o que rola para a esquerda (barras de colcheia, ligaduras) não passar por cima delas.
         */
        const clipToHeader = () => {
            const left = Math.max(0, x0 - 16);
            clipRect.setAttribute("x", left);
            clipRect.setAttribute("width", Math.max(0, W - left));
        };
        let view = { top: -20, bottom: 76 }; // área do desenho sem o título
        let range = null;        // { lo, hi } steps das notas (teclado ou música) para caber tudo
        let title = "";
        /** Ajusta a área do desenho: com título, ganha uma faixa em cima para o nome da música. */
        const applyView = () => {
            const top = view.top - (title ? 18 : 0);
            const height = view.bottom - top;
            // Mais notas à vista: quando a altura bate no limite do CSS (max-height), o desenho
            // fica mais largo (W cresce) e enche a caixa, em vez de encolher no meio dela.
            const boxW = svg.clientWidth || 0;
            const maxH = parseFloat(getComputedStyle(svg).maxHeight);
            let w = baseW;
            if (boxW && maxH > 0 && (boxW * height) / baseW > maxH) w = Math.min(baseW * 5, (height * boxW) / maxH);
            w = Math.round(w);
            if (w !== W) {
                W = w;
                SLOTS = slotsFor(W, x0);
                svg.querySelectorAll(".staff-lines line").forEach((l) => l.setAttribute("x2", W - 2));
                clipToHeader();
            }
            svg.setAttribute("viewBox", `0 ${top} ${W} ${height}`);
            svg.style.aspectRatio = `${W} / ${height}`;
            // O CSS limita a altura do pentagrama (max-height); a conta do layout usa o mesmo teto.
            document.body.style.setProperty("--sh", String(Math.min(height / baseW, 0.42)));
            titleEl.textContent = title;
            titleEl.setAttribute("x", W / 2);
            titleEl.setAttribute("y", top + 13);
        };

        /**
         * Posição (linha/espaço) e acidente de uma nota: índice do botão do teclado ou
         * { index, step, acc } quando a música já diz onde ela fica (Si♭, Sol de baixo…).
         */
        const placeOf = (entry) => {
            if (entry.step != null) return { step: entry.step, acc: entry.acc || "" };
            const index = entry.index;
            const pads = mode.pads;
            // O teclado começa no Dó da oitava da 1ª tecla (piano: −2 = Dó2, step −14).
            const base = (pads[0].octave || 0) * 7;
            const naturalBefore = base + pads.slice(0, index + 1).filter((p) => !p.sharp).length - 1;
            const pad = pads[index];
            if (!pad.sharp) return { step: naturalBefore, acc: "" };
            return flats && pad.flat
                ? { step: naturalBefore + 1, acc: "♭" }   // Ré♭ fica na posição do Ré
                : { step: naturalBefore, acc: "♯" };      // Dó♯ fica na posição do Dó
        };

        /** Cabeça de uma nota (sem haste nem acidente) com o centro em (x, y). */
        const headSvg = (pad, step, acc, x, y, figureName, size, spelled = false) => {
            const fig = FIGURES[figureName] || FIGURES.semibreve;
            const { rx, ry, tilt, plain } = size;
            const breve = fig.breve ? `<path d="M${f(x - rx - 2.4)} ${y - 7}v14M${f(x - rx - 4.8)} ${y - 7}v14M${f(x + rx + 2.4)} ${y - 7}v14M${f(x + rx + 4.8)} ${y - 7}v14"
                stroke="${INK}" stroke-width="1.3"/>` : "";
            const color = look === "preto" ? INK : pad.color;
            if (plain) {
                // Cabeça cheia (semínima) ou vazada (mínima/semibreve), sem nome: é preciso ler a pauta.
                // O furo da semibreve/mínima é vazado de verdade: a linha da pauta aparece por dentro.
                const whole = fig.whole;
                const hole = !fig.hollow ? ""
                    : whole ? ellipsePath(x, y, f(rx * 0.52), f(ry * 0.56), -50)
                    : ellipsePath(x, y, f(rx * 0.8), f(ry * 0.42), tilt - 12);
                // Na versão colorida, um contorno fino deixa as cores claras (amarelo) visíveis no papel.
                const edgeLine = look === "cor" ? ` stroke="#1d1b22" stroke-opacity=".55" stroke-width=".8"` : "";
                const head = `<path d="${ellipsePath(x, y, rx, ry, tilt)}${hole}" fill="${color}" fill-rule="evenodd"${edgeLine}/>`;
                return `<g class="head" style="--c:${look === "preto" ? "#3b82f6" : color}">${head}${breve}</g>`;
            }
            // ♯/♭ já aparece fora da figura: dentro vai só o nome da nota natural (Dó♯ → Dó).
            const naturals = mode.pads.filter((p) => !p.sharp);
            const natIdx = ((step % 7) + 7) % 7;
            let name;
            if (acc) name = nameOf(naturals[natIdx] || pad);
            else if (spelled) {
                // Música (a nota sabe a linha/espaço): nome como está escrito — com a armadura de
                // Ré♭ maior, a tecla preta Sol♯/Lá♭ no lugar do Lá vira "Lá♭" (não "Sol♯").
                const semi = ((Math.round(12 * Math.log2(pad.freq / 261.63)) % 12) + 12) % 12;
                let d = semi - [0, 2, 4, 5, 7, 9, 11][natIdx];
                if (d > 6) d -= 12;
                if (d < -6) d += 12;
                name = nameOf(naturals[natIdx] || pad) + (d > 0 ? "♯".repeat(d) : "♭".repeat(-d));
            } else name = nameOf(pad);
            const rot = tilt ? ` transform="rotate(${tilt} ${x} ${y})"` : "";
            const fill = fig.hollow ? tint(color, 0.72) : color;
            const ink = fig.hollow ? "#1d1b22" : lum(color) > 0.6 ? "#1d1b22" : "#fff";
            const fs = name.length > 2 ? 6 : name.length > 1 ? 6.6 : 7.4;
            return `<g class="head" style="--c:${color}">
                <ellipse rx="${rx}" ry="${ry}" cx="${f(x)}" cy="${y}"${rot} fill="${fill}" stroke="${fig.hollow ? color : "#00000066"}" stroke-width="${fig.hollow ? 2.4 : 1}"/>
                <text x="${f(x)}" y="${f(y + 0.3)}" font-size="${fs}" fill="${ink}">${name}</text>${breve}
            </g>`;
        };

        /**
         * Uma nota ou um acorde (várias notas tocadas juntas) na mesma posição da pauta.
         * As cabeças ficam empilhadas na mesma vertical, também numa segunda (notas vizinhas,
         * como Dó e Ré); os acidentes se escalonam para a esquerda.
         */
        const chordSvg = (entries, x, figureName, dotted = 0, clefName = "sol", stemDir = "") => {
            const cl = CLEFS[clefName] || CLEFS.sol;
            const fig = FIGURES[figureName] || FIGURES.semibreve;
            const plain = look !== "nome"; // cabeça de partitura, sem nome dentro
            const m = plain ? monoOf(figureName) : null;
            const size = { rx: m ? m.rx : fig.rx, ry: m ? m.ry : fig.ry, tilt: m ? m.tilt : TILT, plain };
            const edge = edgeOf(size.rx, size.ry, size.tilt);
            const seen = new Set();
            const items = entries
                .map((e) => ({ ...e, pad: mode.pads[e.index], ...placeOf(e), spelled: e.step != null }))
                .filter((it) => it.pad && !seen.has(`${it.step}${it.acc}`) && seen.add(`${it.step}${it.acc}`))
                .sort((a, b) => a.step - b.step || (a.acc ? 1 : 0) - (b.acc ? 1 : 0));
            if (!items.length) return { html: "<g class=\"note\"></g>", extraLeft: 0, extraRight: 0 };
            const low = items[0].step, high = items[items.length - 1].step;
            // Haste: manda a nota mais longe da 3ª linha (Si na clave de Sol, Ré na de Fá).
            // Duas vozes na mesma pauta: a voz 1 com a haste para cima, a voz 2 para baixo.
            const up = stemDir === "up" ? true : stemDir === "down" ? false : (cl.mid - low) >= (high - cl.mid);
            // Todas na mesma vertical (side 0), até as vizinhas (Dó e Ré).
            const shiftX = 2 * edge.half - 1.6;
            for (const it of items) it.side = 0;
            const wing = fig.breve ? 6 : 0; // as barrinhas da breve
            const minX = x - edge.half - wing + Math.min(0, ...items.map((it) => it.side * shiftX));
            let maxX = x + edge.half + wing + Math.max(0, ...items.map((it) => it.side * shiftX));
            const parts = [];
            let stemInfo = null;
            // Linhas suplementares: Dó de baixo (0), Lá de baixo (-2)… e Lá/Si/… de cima (12, 14).
            const ledger = (l) => parts.push(`<line class="ledger" x1="${f(minX - 7 + wing)}" x2="${f(maxX + 7 - wing)}" y1="${cl.y(l)}" y2="${cl.y(l)}"/>`);
            for (let l = cl.bottom - 2; l >= low; l -= 2) ledger(l);
            for (let l = cl.top + 2; l <= high; l += 2) ledger(l);
            if (fig.stem) {
                // A haste encosta na ponta da cabeça inclinada (direita em cima, esquerda embaixo)
                // e atravessa o acorde todo. Com 3 ou mais bandeirolas ela fica mais comprida.
                const flags = fig.flags || 0;
                const len = STEM + Math.max(0, flags - 2) * 6.5;
                const sx = up ? x + edge.half - 0.8 : x - edge.half + 0.8;
                const y1 = up ? cl.y(low) + edge.dy : cl.y(high) - edge.dy;
                const y2 = up ? cl.y(high) - len : cl.y(low) + len;
                parts.push(`<line class="stem" x1="${f(sx)}" x2="${f(sx)}" y1="${f(y1)}" y2="${f(y2)}"/>`);
                // Para a barra de colcheia: os dois lados possíveis da haste e as cabeças das pontas.
                stemInfo = {
                    xUp: x + edge.half - 0.8, xDown: x - edge.half + 0.8, yLow: cl.y(low), yHigh: cl.y(high),
                    dy: edge.dy, flags, up, forced: stemDir === "up" || stemDir === "down", mid: cl.mid, low, high,
                };
                if (flags) {
                    parts.push(flagsSvg(sx - 0.4, y2, flags, up));
                    if (up) maxX = Math.max(maxX, sx + 10);
                }
            }
            items.forEach((it) => parts.push(headSvg(it.pad, it.step, it.acc, x + it.side * shiftX, cl.y(it.step), figureName, size, it.spelled)));
            // Ponto de aumento (1 ou 2): à direita, no espaço (nota de linha sobe meio espaço).
            const dots = Number(dotted) || 0;
            if (dots) {
                const dx = maxX + 4;
                for (let d = 0; d < dots; d++) items.forEach((it) => {
                    const dy = it.step % 2 === 0 ? -SP / 2 : 0;
                    parts.push(`<circle class="dot" cx="${f(dx + d * 5)}" cy="${f(cl.y(it.step) + dy)}" r="2" fill="${INK}"/>`);
                });
                maxX = dx + (dots - 1) * 5 + 2;
            }
            // Acidentes: de cima para baixo, cada um na 1ª coluna (da direita) onde não esbarra em outro.
            const cols = [];
            let left = minX;
            [...items].reverse().filter((it) => it.acc).forEach((it) => {
                let c = 0;
                while ((cols[c] || []).some((s) => Math.abs(s - it.step) < 5)) c++;
                (cols[c] = cols[c] || []).push(it.step);
                let ax = minX - 3 - c * 8;
                // ♯♯ / ♭♭: dois sinais lado a lado.
                [...it.acc].forEach((sign) => {
                    const w = (sign === "♯" ? 10 : 8) * ACC_SCALE;
                    ax -= w / 2;
                    const draw = sign === "♯" ? sharpSvg : sign === "♮" ? naturalSvg : flatSvg;
                    parts.push(draw(ax, cl.y(it.step)));
                    left = Math.min(left, ax - w / 2);
                    ax -= w / 2 + 1;
                });
            });
            const mono = plain ? " mono" : "";
            // Ponto mais alto do desenho (cabeça de cima ou ponta da haste para cima).
            const stemTop = fig.stem && up ? cl.y(high) - (STEM + Math.max(0, (fig.flags || 0) - 2) * 6.5) : Infinity;
            const top = Math.min(cl.y(high) - size.ry - 2, stemTop);
            return {
                top,
                stemInfo,
                html: `<g class="note${mono}" data-figure="${figureName}">${parts.join("")}</g>`,
                // Quanto o acorde passa de uma nota comum (com um ♯) para cada lado: vira espaço extra.
                extraLeft: Math.max(0, x - left - (edge.half + 11)),
                extraRight: Math.max(0, maxX - x - edge.half - 4),
                leftEdge: left,
                rightEdge: maxX,
            };
        };

        /** Pausa numa posição da pauta. */
        const restHtml = (x, figureName, dotted, clefName = "sol") => {
            const base = (CLEFS[clefName] || CLEFS.sol).base;
            const dots = Number(dotted) || 0;
            let dot = "";
            for (let d = 0; d < dots; d++) dot += `<circle class="dot" cx="${f(x + 9 + d * 5)}" cy="18" r="2" fill="${INK}"/>`;
            const shiftY = base ? ` transform="translate(0 ${base})"` : "";
            return {
                html: `<g class="note rest" data-figure="${figureName}"><g class="head" style="--c:#3b82f6"><g${shiftY}>${restSvg(x, figureName)}${dot}</g></g></g>`,
                top: base + 6,
                extraLeft: 0,
                extraRight: dots ? 4 + (dots - 1) * 5 : 0,
                leftEdge: x - 7,
                rightEdge: x + (dots ? 11 + (dots - 1) * 5 : 7),
            };
        };

        /** Armadura depois da clave (nas duas pautas da pauta dupla). */
        const drawKey = (count) => {
            keyShown = count;
            keyEl.innerHTML = count ? keySigSvg(count, 40, CLEFS.sol, 0) + (grand ? keySigSvg(count, 40, CLEFS.fa, 14) : "") : "";
        };
        /** Rola as notas para a nota "focus" (índice) ficar à vista. */
        const scrollTo = (focus) => {
            const n = notes[focus - first];
            if (!n) return;
            // Normal: a última nota fica perto do fim. Música: a da vez fica no começo (lê as próximas).
            const end = x0 + (SLOTS - 2) * DX;
            let want = Math.max(0, n.x - (lead ? x0 + DX : end));
            // Na música, não passa do ponto em que a última nota chega ao fim da pauta.
            if (lead) want = Math.min(want, Math.max(0, notes[notes.length - 1].x - end));
            applyShift(want);
        };
        let goneN = 0;           // as goneN primeiras notas já passaram da clave (escondidas)
        // Só as notas perto da parte à vista são desenhadas: as de índice va até vb−1. As outras
        // ficam com display: none (a música inteira tem mais de mil notas; o celular agradece).
        let va = 0, vb = 0;
        const setFar = (m, far) => {
            m.el.classList.toggle("far", far);
            m.barEl?.classList.toggle("far", far);
            m.extras?.forEach((x) => x.classList.toggle("far", far));
        };
        /** Primeira nota com x ≥ px (as notas estão em ordem de x). */
        const firstAt = (px) => { let lo = 0, hi = notes.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (notes[mid].x < px) lo = mid + 1; else hi = mid; } return lo; };
        const updateRange = () => {
            const na = firstAt(shift + x0 - 300), nb = firstAt(shift + W + 150);
            if (vb > notes.length) vb = notes.length;
            for (let i = va; i < vb; i++) if (i < na || i >= nb) setFar(notes[i], true);
            for (let i = na; i < nb; i++) if (i < va || i >= vb) setFar(notes[i], false);
            va = na; vb = nb;
        };
        const setGone = (m, gone) => {
            m.el.classList.toggle("gone", gone);
            m.barEl?.classList.toggle("gone", gone);
            m.extras?.forEach((x) => x.classList.toggle("gone", gone));
        };
        /** Maior rolagem: a última nota (e a barra do fim) chega ao fim da pauta. */
        const maxShift = () => {
            const last = notes[notes.length - 1];
            if (!last) return 0;
            const right = Math.max(last.rightEdge ?? last.x + 12, col ? col.right : 0) + (endBar ? 26 : 12);
            return Math.max(0, Math.ceil(right - W));
        };
        let onScroll = null;     // avisa o jogo (barra de rolagem da partitura)
        const emitScroll = () => onScroll?.(shift, maxShift());
        /** Rola as notas: a clave, a armadura e a fórmula de compasso ficam paradas. */
        const applyShift = (want) => {
            if (want === shift) { emitScroll(); return; }
            shift = want;
            layer.style.transform = `translateX(${f(-shift)}px)`;
            // A nota que passa da 1ª posição some inteira (com o ♯/♭), antes de encostar na clave.
            // As notas estão em ordem (x crescente): só as que cruzam a clave mudam (leve no celular).
            updateRange();
            const limit = shift + x0 - 6;
            if (goneN > notes.length) goneN = notes.length;
            while (goneN < notes.length && notes[goneN].x < limit) setGone(notes[goneN++], true);
            while (goneN > 0 && notes[goneN - 1].x >= limit) setGone(notes[--goneN], false);
            // Depois de uma troca de tom, a armadura do começo da pauta passa a ser a nova.
            const seen = notes[goneN];
            const k = seen ? seen.key ?? keyCount : keyCount;
            if (k !== keyShown) drawKey(k);
            emitScroll();
        };
        // Rolagem pela barra ou arrastando: um desenho por quadro de tela (requestAnimationFrame).
        let pending = null, frame = 0;
        const queueShift = (px) => {
            pending = Math.max(0, Math.min(maxShift(), px));
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                layer.style.transition = "none";
                applyShift(pending);
            });
        };
        let manual = false;      // barra de rolagem / arrastar ligados (opção Rolagem)
        // Arrastar a pauta para os lados (dedo ou mouse) rola a partitura.
        let drag = null;
        svg.addEventListener("pointerdown", (e) => {
            if (!manual || e.button > 0 || maxShift() < 1) return;
            drag = { id: e.pointerId, x: e.clientX, shift, moved: false };
        });
        svg.addEventListener("pointermove", (e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const dx = ((e.clientX - drag.x) * W) / (svg.clientWidth || W);
            if (!drag.moved && Math.abs(dx) < 4) return;
            if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch { /* sem captura */ } }
            queueShift(drag.shift - dx);
        });
        const endDrag = (e) => { if (drag && e.pointerId === drag.id) { drag = null; layer.style.transition = ""; } };
        svg.addEventListener("pointerup", endDrag);
        svg.addEventListener("pointercancel", endDrag);

        return {
            figureFor,
            FIGURES,
            /** Troca o modo (botões), como o nome aparece (♯ ou ♭) e o estilo: "nome", "cor" ou "preto". */
            setMode(newMode, nameFn, useFlats, headLook = "nome", opts = {}) {
                lead = !!opts.lead;
                mode = newMode;
                nameOf = nameFn;
                flats = useFlats;
                look = headLook;
                svg.classList.toggle("mono", look === "preto");
                // Altura do desenho: com 2 oitavas sobe para caber as notas agudas.
                const wide = mode.pads.some((p) => p.octave);
                W = baseW = wide ? W_WIDE : W_NORMAL;
                SLOTS = slotsFor(W, x0);
                svg.querySelectorAll(".staff-lines line").forEach((l) => l.setAttribute("x2", W - 2));
                // deep: espaço para notas abaixo do Dó central; grand: pauta dupla (clave de Fá embaixo).
                deep = !!opts.deep;
                grand = !!opts.grand;
                bassEl.style.display = grand ? "" : "none";
                // Faixa de notas do teclado: do Dó da 1ª oitava ao Si da última.
                const whites = mode.pads.filter((p) => !p.sharp).length;
                const lo = (mode.pads[0].octave || 0) * 7;
                range = { lo, hi: lo + whites - 1 };
                view = this._fit({ top: wide ? -34 : -20, bottom: grand ? BASS_BOTTOM + 30 : deep ? 92 : 76 });
                title = "";
                applyView();
                meter = "";
                keyCount = 0;
                this._header();
            },
            /** Recalcula a largura do desenho (a caixa mudou de tamanho: janela, celular girou). */
            refit() { applyView(); emitScroll(); },
            /** Barra de rolagem da partitura: fn(posição, máximo) a cada rolagem. */
            onScroll(fn) { onScroll = fn; },
            /** Rola até a posição px (0 = começo), sem passar do fim. */
            setShift(px) { queueShift(Number(px) || 0); },
            /** Liga a rolagem manual (arrastar a pauta); desligada, a pauta só acompanha a música. */
            setManual(on) { manual = !!on; svg.classList.toggle("drag-scroll", manual); },
            /**
             * Número do compasso no pé da pauta, embaixo da 1ª nota do compasso (posição i): numa
             * faixa abaixo de todas as notas, para não esbarrar nas notas graves.
             */
            measureNumber(i, n) {
                const m = notes[i - first];
                if (!m) return;
                const x = m.x - 9 - (m.bar ? 4 : 0);
                layer.insertAdjacentHTML("beforeend", `<text class="measure-num" x="${f(x)}" y="${f(view.bottom - 5)}">${n}</text>`);
                m.extras.push(layer.lastElementChild);
                if (m.el.classList.contains("far")) layer.lastElementChild.classList.add("far");
            },
            /** Texto em cima da nota da posição i (mudança de andamento: "♩. = 60"). */
            annotate(i, text) {
                const n = notes[i - first];
                if (!n) return;
                const y = Math.min(n.top ?? 0, 0) - 10;
                layer.insertAdjacentHTML("beforeend", `<text class="tempo-mark" x="${f(n.x - 8)}" y="${f(y)}">${text}</text>`);
                n.extras.push(layer.lastElementChild);
            },
            /** Avisa a posição atual (depois de desenhar a música inteira). */
            syncScroll() { updateRange(); emitScroll(); },
            /** Liga ou desliga a pauta dupla (clave de Sol em cima e clave de Fá embaixo). */
            setGrand(on) {
                if (!!on === grand) return;
                grand = !!on;
                bassEl.style.display = grand ? "" : "none";
                view = this._fit({ top: view.top, bottom: grand ? BASS_BOTTOM + 30 : deep ? 92 : 76 });
                applyView();
                this._header(); // armadura e fórmula também na pauta de baixo
            },
            get grand() { return grand; },
            /**
             * Faixa das notas (step: 0 = Dó central) que precisa caber no desenho: as notas
             * com muitas linhas suplementares (piano, mão esquerda grave) aparecem inteiras.
             */
            setRange(lo, hi) {
                if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
                range = { lo, hi };
                const next = this._fit({ top: view.top, bottom: view.bottom }, true);
                if (next.top === view.top && next.bottom === view.bottom) return;
                view = next;
                applyView();
            },
            /** Aumenta a área (em cima e embaixo) até caber a faixa de notas com as hastes. */
            _fit(v, fromRange = false) {
                const base = { top: Math.min(v.top, -20), bottom: grand ? BASS_BOTTOM + 30 : deep ? 92 : 76 };
                if (!fromRange) Object.assign(base, v);
                if (!range) return base;
                const MARGIN = 26; // haste e bandeirolas
                // Agudas: na clave de Sol. Graves: na de Fá (pauta dupla) ou na de Sol.
                const top = Math.min(base.top, CLEFS.sol.y(range.hi) - MARGIN);
                const low = grand ? CLEFS.fa.y(Math.min(range.lo, -10)) : CLEFS.sol.y(range.lo);
                const bottom = Math.max(base.bottom, low + MARGIN);
                return { top: Math.floor(top), bottom: Math.ceil(bottom) };
            },
            /** Fórmula de compasso ("4/4", "3/4"…, "C" = 4/4 ou "¢" = 2/2) logo depois da clave; "" tira. */
            setMeter(text = "") {
                const t = String(text).trim();
                const mt = t.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
                const next = mt ? `${mt[1]}/${mt[2]}` : /^(C|¢)$/.test(t) ? t : "";
                if (next === meter) return;
                meter = next;
                this._header();
            },
            /** Armadura depois da clave: n > 0 sustenidos, n < 0 bemóis (ex.: −5 = Ré♭ maior). */
            setKey(n = 0) {
                const next = Math.max(-7, Math.min(7, Math.round(Number(n) || 0)));
                if (next === keyCount) return;
                keyCount = next;
                this._header();
            },
            /** Desenha armadura e fórmula (nas duas pautas da pauta dupla) e acerta onde a 1ª nota começa. */
            _header() {
                const KEY_X = 40;
                const n = Math.abs(keyCount);
                const keyW = n ? n * KEY_DX + 4 : 0;
                drawKey(keyCount);
                const cx = 50 + keyW;
                const mt = meter.match(/^(\d{1,2})\/(\d{1,2})$/);
                const sym = /^(C|¢)$/.test(meter) ? meter : "";
                // C (tempo comum) e ¢ (tempo cortado): um "C" desenhado no meio da pauta; o ¢ ganha o traço vertical.
                const cSym = `<path class="meter-c" d="M${cx + 6.5} 16.5C${cx + 5} 12.6 ${cx + 1.4} 11.6 ${cx - 1.2} 12C${cx - 6.6} 12.8 ${cx - 8.6} 18.4 ${cx - 8.6} 24
                    C${cx - 8.6} 30.4 ${cx - 5.4} 36 ${cx} 36C${cx + 3.6} 36 ${cx + 6.2} 33.6 ${cx + 7.4} 30.4C${cx + 4.6} 33 ${cx + 2.6} 33.6 ${cx + 0.8} 33.4
                    C${cx - 2.6} 33 ${cx - 4} 29.4 ${cx - 4} 24C${cx - 4} 18.8 ${cx - 2.8} 14.4 ${cx} 14.2C${cx + 1.8} 14.1 ${cx + 2.2} 15.4 ${cx + 1.4} 16.4
                    C${cx + 0.4} 17.8 ${cx + 1.6} 20 ${cx + 3.6} 19.8C${cx + 5.6} 19.6 ${cx + 7} 18.4 ${cx + 6.5} 16.5Z" fill="${INK}"/>`;
                const cut = `<line x1="${cx + 0.6}" x2="${cx + 0.6}" y1="6" y2="42" stroke="${INK}" stroke-width="1.6"/>`;
                /** Fórmula numa pauta cuja 5ª linha fica em y = base. Número de cima na metade de cima. */
                const meterAt = (base) => {
                    const g = (inner) => (base ? `<g transform="translate(0 ${base})">${inner}</g>` : inner);
                    if (mt) return g(`<text x="${cx}" y="${BOTTOM - 3 * SP}">${mt[1]}</text><text x="${cx}" y="${BOTTOM - SP}">${mt[2]}</text>`);
                    return g(sym === "C" ? cSym : sym === "¢" ? cSym + cut : "");
                };
                meterEl.innerHTML = meter ? meterAt(0) + (grand ? meterAt(BASS_TOP) : "") : "";
                x0 = X0 + keyW + (meter ? METER_W : 0);
                clipToHeader();
                SLOTS = slotsFor(W, x0);
                this.clear();
            },
            /** Nome da música, centralizado em cima do pentagrama ("" tira). */
            setTitle(text = "") {
                const t = String(text).trim();
                if (t === title) return;
                title = t;
                applyView();
            },
            clear() {
                endBar = null;
                col = prevCol = null;
                afterKey = false;
                keyNow = keyCount;
                if (keyShown !== keyCount) drawKey(keyCount);
                notes = [];
                first = 0;
                shift = 0;
                layer.style.transition = "none";
                layer.style.transform = "";
                layer.innerHTML = "";
                goneN = 0;
                va = vb = 0;
                void layer.getBoundingClientRect();
                layer.style.transition = "";
                emitScroll();
            },
            /**
             * Acrescenta uma nota (índice do botão) e acende por ms. Devolve a posição dela.
             * A pauta só anda para a esquerda; as notas que já saíram de vista são
             * apagadas de verdade (sem redesenhar as outras), então rolar é sempre suave.
             * Com chord = true a nota entra no acorde da última posição (tocadas juntas).
             */
            push(entry, figureName, ms = 0, chord = false, opts = {}) {
                if (!mode) return -1;
                const e = typeof entry === "number" ? { index: entry } : entry;
                const last = notes[notes.length - 1];
                // Acorde cresce só na mesma clave; a nota da outra pauta vai na mesma coluna (at).
                const grow = chord && last && !last.rest && last.clef === this._clefOf(opts.hand) && (last.stem || "") === (opts.stem || "");
                const pads = grow ? [...last.pads, e] : [e];
                const figure = grow ? last.figure : figureName;
                const dotted = grow ? last.dotted : Number(opts.dotted) || 0; // 0, 1 ou 2 pontos
                const bar = (grow ? !!last.bar : !!opts.bar) && !this._noBar(opts.at);
                const over = grow ? !!last.over : !!opts.over;
                const clef = grow ? last.clef : this._clefOf(opts.hand);
                const stem = grow ? last.stem : opts.stem || "";
                const probe = chordSvg(pads, 0, figure, dotted, clef, stem);
                const x = this._columnX(probe.extraLeft, bar, opts.at, grow);
                const drawn = chordSvg(pads, x, figure, dotted, clef, stem);
                return this._place(drawn, x, { pads, figure, dotted, bar, over, clef, stem, stemInfo: drawn.stemInfo }, grow, ms, opts.scroll !== false);
            },
            /** Clave da mão: na pauta dupla a mão esquerda ("me") vai para a clave de Fá. */
            _clefOf(hand) { return grand && String(hand || "").startsWith("me") ? "fa" : "sol"; },
            /**
             * x da nota. Mesmo instante (at) da coluna atual = mesma vertical; senão, uma
             * coluna nova logo depois da anterior, com folga se uma das duas for larga
             * (cabeça do outro lado da haste, acidentes escalonados) e na barra de compasso.
             */
            _columnX(extraLeft, bar, at, grow) {
                if (grow && col) {
                    if (col.count > 1) return col.x; // a outra mão já está nesta coluna
                    const base = prevCol;
                    col.x = base ? base.x + DX + base.extraRight + extraLeft + (bar ? BAR_GAP : 0) : x0 + extraLeft;
                    return col.x;
                }
                if (col && at != null && at === col.at) { col.count++; return col.x; }
                const x = col ? col.x + DX + col.extraRight + extraLeft + (bar ? BAR_GAP : 0) : x0 + extraLeft;
                prevCol = col;
                col = { at, x, right: -Infinity, extraRight: 0, count: 1, barEl: null, noBar: afterKey };
                afterKey = false;
                return x;
            },
            /** A coluna logo depois de uma troca de armadura já tem a barra dupla: sem outra barra. */
            _noBar(at) { return afterKey || (!!col && col.noBar && at != null && at === col.at); },
            /**
             * Troca de armadura no meio da música: barra dupla e os novos ♯/♭ nas duas pautas,
             * ocupando um lugar na pauta (rola e some como uma nota).
             */
            keyChange(count) {
                if (!mode) return -1;
                const n = Math.abs(count);
                const left = (col ? Math.max(col.right, col.x + 8) : x0 - 14) + 9;
                const yEnd = grand ? BASS_BOTTOM : BOTTOM;
                const start = left + 6;
                const end = start + Math.max(1, n) * KEY_DX + 2;
                const html = `<g class="note keychange"><line class="bar" x1="${f(left)}" x2="${f(left)}" y1="0" y2="${yEnd}"/>` +
                    `<line class="bar" x1="${f(left + 3)}" x2="${f(left + 3)}" y1="0" y2="${yEnd}"/>` +
                    keySigSvg(count, start, CLEFS.sol, 0) + (grand ? keySigSvg(count, start, CLEFS.fa, 14) : "") + `</g>`;
                layer.insertAdjacentHTML("beforeend", html);
                const el = layer.lastElementChild;
                el.classList.add("done");
                const slot = first + notes.length;
                notes.push({ el, x: left, pads: [], rest: true, figure: "", extras: [], extraRight: 0, rightEdge: end, top: 0, clef: "sol", key: count });
                if (notes.length - 1 === vb) vb++; else setFar(notes[notes.length - 1], true);
                keyNow = count;
                prevCol = col;
                col = { at: {}, x: end + 10 - DX, right: end, extraRight: 0, count: 1, barEl: null };
                afterKey = true;
                return slot;
            },
            /** Pausa (sem som): ocupa uma posição da pauta como uma nota. */
            pushRest(figureName, opts = {}) {
                if (!mode) return -1;
                const bar = !!opts.bar && !this._noBar(opts.at);
                const clef = this._clefOf(opts.hand);
                const x = this._columnX(0, bar, opts.at, false);
                const drawn = restHtml(x, figureName, Number(opts.dotted) || 0, clef);
                return this._place(drawn, x, { pads: [], figure: figureName, rest: true, bar, over: !!opts.over, clef }, false, 0, opts.scroll !== false);
            },
            _place(drawn, x, data, grow, ms, scroll) {
                const last = notes[notes.length - 1];
                // Barra de compasso: no meio entre a coluna anterior e esta (com o ♯/♭ dela).
                // Na pauta dupla ela atravessa as duas pautas, uma vez por coluna.
                let barX = prevCol && data.bar ? f((prevCol.right + drawn.leftEdge) / 2) : null;
                if (barX != null && col.barEl && !grow) {
                    barX = Math.min(barX, Number(col.barEl.getAttribute("x1")));
                    col.barEl.setAttribute("x1", barX); col.barEl.setAttribute("x2", barX);
                    barX = null;
                }
                const barLine = `<line class="bar" x1="${barX}" x2="${barX}" y1="0" y2="${grand ? BASS_BOTTOM : BOTTOM}"/>`;
                let slot;
                if (grow) {
                    slot = first + notes.length - 1;
                    const keep = [...last.el.classList].filter((c) => c !== "pop");
                    last.el.insertAdjacentHTML("afterend", drawn.html);
                    const el = last.el.nextElementSibling;
                    last.el.remove();
                    el.classList.add(...keep);
                    Object.assign(last, data, { el, x, extraRight: drawn.extraRight, rightEdge: drawn.rightEdge, top: drawn.top });
                    if (last.barEl && barX != null) { last.barEl.setAttribute("x1", barX); last.barEl.setAttribute("x2", barX); }
                    col.right = Math.max(col.right, drawn.rightEdge);
                    col.extraRight = Math.max(col.extraRight, drawn.extraRight);
                } else {
                    slot = first + notes.length;
                    let barEl = null;
                    if (barX != null) {
                        layer.insertAdjacentHTML("beforeend", barLine);
                        barEl = layer.lastElementChild;
                    }
                    layer.insertAdjacentHTML("beforeend", drawn.html);
                    const el = layer.lastElementChild;
                    if (scroll) el.classList.add("pop");
                    // Nota que não cabe no compasso (fórmula de compasso): fica marcada em vermelho.
                    if (data.over) el.classList.add("over");
                    notes.push({ ...data, el, barEl, x, extraRight: drawn.extraRight, rightEdge: drawn.rightEdge, top: drawn.top, extras: [], key: keyNow });
                    // Nota nova: desenhada se encosta no trecho desenhado; senão fica escondida até chegar a vez dela.
                    if (notes.length - 1 === vb) vb++; else setFar(notes[notes.length - 1], true);
                    if (barEl) col.barEl = barEl;
                    col.right = Math.max(col.right, drawn.rightEdge);
                    col.extraRight = Math.max(col.extraRight, drawn.extraRight);
                }
                if (!scroll) return slot;
                scrollTo(slot);
                // Guarda no máximo MAX_NOTES; só apaga as que já estão fora da pauta.
                while (notes.length > MAX_NOTES && notes[0].x - shift < x0 - 3 * DX) {
                    const old = notes.shift();
                    clearTimeout(old.off);
                    old.el.remove();
                    old.barEl?.remove();
                    old.extras?.forEach((x) => x.remove());
                    first++;
                    goneN = Math.max(0, goneN - 1);
                    va = Math.max(0, va - 1);
                    vb = Math.max(0, vb - 1);
                }
                if (ms) this.light(slot, ms);
                return slot;
            },
            /**
             * Ligadura (arco) entre a nota da posição a e a da posição b, na altura step.
             * O arco fica do lado oposto à haste: embaixo das notas graves, em cima das agudas.
             * up = true/false força o lado (no acorde, a nota de cima liga por cima).
             */
            tie(a, b, step, up = null) {
                const from = notes[a - first], to = notes[b - first];
                if (!from || !to) return;
                const cl = CLEFS[to.clef] || CLEFS.sol;
                const below = up == null ? step < cl.mid : !up;
                const d = below ? 1 : -1;
                const y = cl.y(step) + d * 6;
                const x1 = from.x + 6, x2 = to.x - 6;
                const mid = (x1 + x2) / 2;
                const h = Math.min(9, 4 + (x2 - x1) / 12); // arco mais alto quando é mais comprido
                layer.insertAdjacentHTML("beforeend", `<path class="tie" d="M${f(x1)} ${f(y)}Q${f(mid)} ${f(y + d * h * 1.25)} ${f(x2)} ${f(y)}` +
                    `Q${f(mid)} ${f(y + d * h)} ${f(x1)} ${f(y)}Z" fill="${INK}" stroke="${INK}" stroke-width=".6" stroke-linejoin="round"/>`);
                to.extras.push(layer.lastElementChild);
            },
            /**
             * Barra de colcheia: liga as hastes das notas das posições da lista (colcheias e
             * menores do mesmo tempo e da mesma voz). As bandeirolas somem, todas as hastes vão
             * para o mesmo lado e terminam na barra; semicolcheia ganha a 2ª barra (ou um toco).
             */
            beam(list) {
                const items = list.map((i) => notes[i - first]).filter((n) => n?.stemInfo?.flags);
                if (items.length < 2 || items.some((n) => n.clef !== items[0].clef)) return;
                const infos = items.map((n) => n.stemInfo);
                // Lado das hastes: o da voz (1ª para cima, 2ª para baixo) ou pela nota mais longe da linha do meio.
                const forced = infos.find((it) => it.forced);
                const mid = infos[0].mid;
                const low = Math.min(...infos.map((it) => it.low)), high = Math.max(...infos.map((it) => it.high));
                const up = forced ? forced.up : (mid - low) >= (high - mid);
                const levels = Math.max(...infos.map((it) => it.flags));
                const xs = infos.map((it) => (up ? it.xUp : it.xDown));
                const tip = (it) => (up ? it.yHigh - STEM : it.yLow + STEM);
                const x1 = xs[0], xn = xs[xs.length - 1];
                let slope = xn > x1 ? (tip(infos[infos.length - 1]) - tip(infos[0])) / (xn - x1) : 0;
                slope = Math.max(-0.16, Math.min(0.16, slope));
                let y0 = tip(infos[0]);
                // Haste mínima (mais comprida com 2 ou mais barras): a barra sobe (ou desce) se preciso.
                const minStem = 25 + (levels - 1) * 7;
                infos.forEach((it, k) => {
                    const yAt = y0 + slope * (xs[k] - x1);
                    if (up && yAt > it.yHigh - minStem) y0 -= yAt - (it.yHigh - minStem);
                    if (!up && yAt < it.yLow + minStem) y0 += it.yLow + minStem - yAt;
                });
                const lineY = (x) => y0 + slope * (x - x1);
                items.forEach((n, k) => {
                    const it = infos[k];
                    const stem = n.el.querySelector(".stem");
                    if (stem) {
                        const yStart = up ? it.yLow + it.dy : it.yHigh - it.dy;
                        stem.setAttribute("x1", f(xs[k])); stem.setAttribute("x2", f(xs[k]));
                        stem.setAttribute("y1", f(yStart)); stem.setAttribute("y2", f(lineY(xs[k])));
                    }
                    n.el.querySelector(".flag")?.remove();
                    n.top = Math.min(n.top, lineY(xs[k]) - 2);
                });
                const T = 4.6, GAP = 7;
                const bar = (xa, xb, level) => {
                    const off = (level - 1) * GAP * (up ? 1 : -1);
                    const ya = lineY(xa) + off, yb = lineY(xb) + off, t = up ? T : -T;
                    return `M${f(xa)} ${f(ya)}L${f(xb)} ${f(yb)}L${f(xb)} ${f(yb + t)}L${f(xa)} ${f(ya + t)}Z`;
                };
                let d = bar(x1 - 0.6, xn + 0.6, 1);
                for (let level = 2; level <= levels; level++) {
                    infos.forEach((it, k) => {
                        if (it.flags < level) return;
                        const next = infos[k + 1], prev = infos[k - 1];
                        if (next && next.flags >= level) d += bar(xs[k] - 0.6, xs[k + 1] + 0.6, level);
                        else if (!(prev && prev.flags >= level)) {
                            // Sozinha neste nível: um toco para o lado da vizinha.
                            d += k === 0 ? bar(xs[k] - 0.6, xs[k] + 8, level) : bar(xs[k] - 8, xs[k] + 0.6, level);
                        }
                    });
                }
                layer.insertAdjacentHTML("beforeend", `<path class="beam" d="${d}" fill="${INK}"/>`);
                items[items.length - 1].extras.push(layer.lastElementChild);
            },
            /** Quiáltera: colchete com o número n em cima das notas das posições a até b. */
            tuplet(a, b, n) {
                const from = notes[a - first], to = notes[b - first];
                if (!from || !to) return;
                const group = notes.slice(a - first, b - first + 1);
                const base = (CLEFS[to.clef] || CLEFS.sol).base;
                const y = Math.min(base - 6, ...group.filter((m) => m.clef === to.clef).map((m) => m.top)) - 6;
                const x1 = from.x - 7, x2 = to.x + 9, mid = (x1 + x2) / 2;
                layer.insertAdjacentHTML("beforeend", `<g class="tuplet"><path d="M${f(x1)} ${f(y + 4)}V${f(y)}H${f(mid - 5)}M${f(mid + 5)} ${f(y)}H${f(x2)}V${f(y + 4)}"` +
                    ` fill="none" stroke="${INK}" stroke-width="1"/><text x="${f(mid)}" y="${f(y)}">${n}</text></g>`);
                to.extras.push(layer.lastElementChild);
            },
            /** Barra dupla de fim (fina + grossa) depois da última nota. */
            finish() {
                endBar?.remove();
                const last = notes[notes.length - 1];
                if (!last) return;
                const bx = f((col ? col.right : last.rightEdge) + 12);
                const yEnd = grand ? BASS_BOTTOM : BOTTOM;
                layer.insertAdjacentHTML("beforeend", `<g class="end-bar"><line class="bar" x1="${bx}" x2="${bx}" y1="0" y2="${yEnd}"/>` +
                    `<rect x="${f(bx + 3)}" y="0" width="3.6" height="${yEnd}" fill="${INK}"/></g>`);
                endBar = layer.lastElementChild;
            },
            /** Acende a nota na posição i por ms. */
            light(i, ms) {
                const n = notes[i - first];
                if (!n) return;
                scrollTo(i);
                n.el.classList.add("lit");
                clearTimeout(n.off);
                n.off = setTimeout(() => n.el.classList.remove("lit"), ms);
            },
            /** Praticar: marca (ou desmarca) a nota i como a próxima a tocar e rola até ela. */
            mark(i, on = true) {
                const n = notes[i - first];
                if (!n) return;
                if (on) scrollTo(i);
                n.el.classList.toggle("next", on);
            },
            unmarkAll() { notes.forEach((n) => n.el.classList.remove("next")); },
            /** Marca a nota i como acertada (fica forte). */
            done(i) { notes[i - first]?.el.classList.add("done"); },
            allDone() { notes.forEach((n) => n.el.classList.add("done")); },
            get length() { return first + notes.length; },
        };
    };

    window.SigaDinoStaff = { createStaff, figureFor, FIGURES };
})();
