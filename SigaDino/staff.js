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
   ===================================================================== */
(() => {
    "use strict";

    const SP = 12;               // distância entre as linhas da pauta
    const BOTTOM = 48;           // y da 1ª linha (Mi)
    const X0 = 62, DX = 32;      // x da 1ª nota e espaço entre notas
    const W_NORMAL = 420;        // largura do desenho (7 e 12 notas)
    const W_WIDE = 640;          // 2 oitavas: teclado mais largo, pauta mais comprida
    const STEM = 34;
    const MAX_NOTES = 120;       // guarda só as últimas (as mais antigas já saíram de vista)
    const slotsFor = (w) => Math.floor((w - X0 - 8) / DX) + 1; // notas que cabem sem rolar

    const FIGURES = {
        // Cabeça com o nome dentro: pequena o bastante para ver se está na linha ou no espaço.
        semibreve: { title: "Semibreve", rx: 10.2, ry: 7.4, hollow: true, stem: false },
        minima:    { title: "Mínima",    rx: 9.4, ry: 7, hollow: true, stem: true },
        seminima:  { title: "Semínima",  rx: 9.4, ry: 7, hollow: false, stem: true },
    };

    /** Figura pela duração da nota acesa (ms): quanto mais rápido, menor a figura. */
    const TILT = -20;            // inclinação da cabeça (graus, sobe para a direita)
    // Sem nome (só preto ou só cor): cabeças menores e mais alongadas, como numa partitura.
    const MONO = {
        semibreve: { rx: 8.6, ry: 6.2, tilt: 0 },
        minima:    { rx: 7.6, ry: 5.4, tilt: TILT },
        seminima:  { rx: 7.6, ry: 5.4, tilt: TILT },
    };
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
    const sharpSvg = (x, y) => {
        const bar = (cy) => `M-5 ${cy + 1.4}L5 ${cy - 1.4}L5 ${cy + 1.4}L-5 ${cy + 4.2}Z`;
        return `<g class="acc" transform="translate(${f(x)} ${f(y)})">
            <path d="M-2.3 -10.5V13M2.3 -13V10.5" fill="none" stroke="${INK}" stroke-width="1.3"/>
            <path d="${bar(-6.2)}${bar(3.4)}" fill="${INK}"/>
        </g>`;
    };
    const flatSvg = (x, y) => `<g class="acc" transform="translate(${f(x)} ${f(y)})">
            <path d="M-4 -19V5.2" fill="none" stroke="${INK}" stroke-width="1.3"/>
            <path d="M-4.6 5.4C1 2.6 4.6 -0.4 4.2 -3.4C3.8 -6.4 -0.4 -6.6 -4 -3.2V-1.2C-1 -4.2 1.9 -4.4 2 -2.6C2.1 -0.6 -0.6 1.8 -4 3.6Z" fill="${INK}"/>
        </g>`;

    const figureFor = (ms) => (ms >= 500 ? "semibreve" : ms >= 340 ? "minima" : "seminima");

    const f = (n) => +n.toFixed(2);
    /** y da nota pela posição na escala: 0 = Dó (linha suplementar), 1 = Ré, 2 = Mi (1ª linha)… */
    const yOf = (step) => BOTTOM - (step - 2) * (SP / 2);

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

    /**
     * Cria o pentagrama dentro de um <svg>.
     * @param {SVGSVGElement} svg
     */
    const createStaff = (svg) => {
        let mode = null;
        let nameOf = (pad) => pad.name;
        let flats = false;
        let look = "nome";       // "nome" (cor + nome), "cor" (só cor) ou "preto" (desafio)
        let notes = [];          // { el, pad }
        let shift = 0;           // quanto (px) a pauta já rolou para a esquerda
        let first = 0;           // posição da 1ª nota ainda guardada (as anteriores já foram apagadas)

        let W = W_NORMAL, SLOTS = slotsFor(W);
        svg.innerHTML = `
            <defs><clipPath id="staff-clip"><rect x="${X0 - 28}" y="-60" width="${W_WIDE}" height="160"/></clipPath></defs>
            <g class="staff-lines">${[0, 1, 2, 3, 4].map((i) =>
                `<line x1="2" x2="${W_NORMAL - 2}" y1="${BOTTOM - i * SP}" y2="${BOTTOM - i * SP}"/>`).join("")}</g>
            ${CLEF}
            <g clip-path="url(#staff-clip)"><g class="staff-notes"></g></g>`;
        const layer = svg.querySelector(".staff-notes");

        /** Posição (linha/espaço) e acidente de um botão do teclado. */
        const placeOf = (index) => {
            const pads = mode.pads;
            const naturalBefore = pads.slice(0, index + 1).filter((p) => !p.sharp).length - 1;
            const pad = pads[index];
            if (!pad.sharp) return { step: naturalBefore, acc: "" };
            return flats && pad.flat
                ? { step: naturalBefore + 1, acc: "♭" }   // Ré♭ fica na posição do Ré
                : { step: naturalBefore, acc: "♯" };      // Dó♯ fica na posição do Dó
        };

        /** Cabeça de uma nota (sem haste nem acidente) com o centro em (x, y). */
        const headSvg = (pad, step, acc, x, y, figureName, size) => {
            const fig = FIGURES[figureName] || FIGURES.semibreve;
            const { rx, ry, tilt, plain } = size;
            const color = look === "preto" ? INK : pad.color;
            if (plain) {
                // Cabeça cheia (semínima) ou vazada (mínima/semibreve), sem nome: é preciso ler a pauta.
                // O furo da semibreve/mínima é vazado de verdade: a linha da pauta aparece por dentro.
                const whole = figureName === "semibreve";
                const hole = !fig.hollow ? ""
                    : whole ? ellipsePath(x, y, f(rx * 0.52), f(ry * 0.56), -50)
                    : ellipsePath(x, y, f(rx * 0.8), f(ry * 0.42), tilt - 12);
                // Na versão colorida, um contorno fino deixa as cores claras (amarelo) visíveis no papel.
                const edgeLine = look === "cor" ? ` stroke="#1d1b22" stroke-opacity=".55" stroke-width=".8"` : "";
                const head = `<path d="${ellipsePath(x, y, rx, ry, tilt)}${hole}" fill="${color}" fill-rule="evenodd"${edgeLine}/>`;
                return `<g class="head" style="--c:${look === "preto" ? "#3b82f6" : color}">${head}</g>`;
            }
            // ♯/♭ já aparece fora da figura: dentro vai só o nome da nota natural (Dó♯ → Dó).
            const naturals = mode.pads.filter((p) => !p.sharp);
            const name = acc ? nameOf(naturals[step] || pad) : nameOf(pad);
            const rot = tilt ? ` transform="rotate(${tilt} ${x} ${y})"` : "";
            const fill = fig.hollow ? tint(color, 0.72) : color;
            const ink = fig.hollow ? "#1d1b22" : lum(color) > 0.6 ? "#1d1b22" : "#fff";
            const fs = name.length > 2 ? 6 : name.length > 1 ? 6.6 : 7.4;
            return `<g class="head" style="--c:${color}">
                <ellipse rx="${rx}" ry="${ry}" cx="${f(x)}" cy="${y}"${rot} fill="${fill}" stroke="${fig.hollow ? color : "#00000066"}" stroke-width="${fig.hollow ? 2.4 : 1}"/>
                <text x="${f(x)}" y="${f(y + 0.3)}" font-size="${fs}" fill="${ink}">${name}</text>
            </g>`;
        };

        /**
         * Uma nota ou um acorde (várias notas tocadas juntas) na mesma posição da pauta.
         * As cabeças ficam empilhadas na mesma vertical; numa segunda (notas vizinhas) uma
         * delas passa para o outro lado da haste, e os acidentes se escalonam para a esquerda.
         */
        const chordSvg = (indices, x, figureName) => {
            const fig = FIGURES[figureName] || FIGURES.semibreve;
            const plain = look !== "nome"; // cabeça de partitura, sem nome dentro
            const m = plain ? MONO[figureName] || MONO.semibreve : null;
            const size = { rx: m ? m.rx : fig.rx, ry: m ? m.ry : fig.ry, tilt: m ? m.tilt : TILT, plain };
            const edge = edgeOf(size.rx, size.ry, size.tilt);
            const items = [...new Set(indices)]
                .map((index) => ({ index, pad: mode.pads[index], ...placeOf(index) }))
                .sort((a, b) => a.step - b.step || (a.acc ? 1 : 0) - (b.acc ? 1 : 0));
            const low = items[0].step, high = items[items.length - 1].step;
            // Haste: manda a nota mais longe da 3ª linha (Si). Abaixo dela, haste para cima.
            const up = (6 - low) >= (high - 6);
            // Numa segunda (ou mesma linha, Dó e Dó♯), a nota vizinha vai para o outro lado da haste.
            const shiftX = 2 * edge.half - 1.6;
            const order = up ? items : [...items].reverse();
            let prev = null;
            for (const it of order) {
                it.side = prev && !prev.side && Math.abs(it.step - prev.step) <= 1 ? (up ? 1 : -1) : 0;
                prev = it;
            }
            const minX = x - edge.half + Math.min(0, ...items.map((it) => it.side * shiftX));
            const maxX = x + edge.half + Math.max(0, ...items.map((it) => it.side * shiftX));
            const parts = [];
            // Linhas suplementares: Dó de baixo (0) e Lá/Si/… de cima (12, 14).
            const ledger = (l) => parts.push(`<line class="ledger" x1="${f(minX - 7)}" x2="${f(maxX + 7)}" y1="${yOf(l)}" y2="${yOf(l)}"/>`);
            for (let l = 0; l >= low; l -= 2) ledger(l);
            for (let l = 12; l <= high; l += 2) ledger(l);
            if (fig.stem) {
                // A haste encosta na ponta da cabeça inclinada (direita em cima, esquerda embaixo)
                // e atravessa o acorde todo.
                const sx = up ? x + edge.half - 0.8 : x - edge.half + 0.8;
                const y1 = up ? yOf(low) + edge.dy : yOf(high) - edge.dy;
                const y2 = up ? yOf(high) - STEM : yOf(low) + STEM;
                parts.push(`<line class="stem" x1="${f(sx)}" x2="${f(sx)}" y1="${f(y1)}" y2="${f(y2)}"/>`);
            }
            items.forEach((it) => parts.push(headSvg(it.pad, it.step, it.acc, x + it.side * shiftX, yOf(it.step), figureName, size)));
            // Acidentes: de cima para baixo, cada um na 1ª coluna (da direita) onde não esbarra em outro.
            const cols = [];
            let left = minX;
            [...items].reverse().filter((it) => it.acc).forEach((it) => {
                let c = 0;
                while ((cols[c] || []).some((s) => Math.abs(s - it.step) < 5)) c++;
                (cols[c] = cols[c] || []).push(it.step);
                const w = it.acc === "♯" ? 10 : 8;
                const ax = minX - 3 - w / 2 - c * 10;
                left = Math.min(left, ax - w / 2);
                parts.push(it.acc === "♯" ? sharpSvg(ax, yOf(it.step)) : flatSvg(ax, yOf(it.step)));
            });
            const mono = plain ? " mono" : "";
            return {
                html: `<g class="note${mono}" data-figure="${figureName}">${parts.join("")}</g>`,
                // Quanto o acorde passa de uma nota comum (com um ♯) para cada lado: vira espaço extra.
                extraLeft: Math.max(0, x - left - (edge.half + 14)),
                extraRight: Math.max(0, maxX - x - edge.half),
            };
        };

        /** Rola as notas para a nota "focus" (índice) ficar à vista. */
        const scrollTo = (focus) => {
            const n = notes[focus - first];
            if (!n) return;
            const want = Math.max(0, n.x - (X0 + (SLOTS - 2) * DX));
            if (want === shift) return;
            shift = want;
            layer.style.transform = `translateX(${f(-shift)}px)`;
        };

        return {
            figureFor,
            FIGURES,
            /** Troca o modo (botões), como o nome aparece (♯ ou ♭) e o estilo: "nome", "cor" ou "preto". */
            setMode(newMode, nameFn, useFlats, headLook = "nome") {
                mode = newMode;
                nameOf = nameFn;
                flats = useFlats;
                look = headLook;
                svg.classList.toggle("mono", look === "preto");
                // Altura do desenho: com 2 oitavas sobe para caber as notas agudas.
                const wide = mode.pads.some((p) => p.octave);
                W = wide ? W_WIDE : W_NORMAL;
                SLOTS = slotsFor(W);
                svg.querySelectorAll(".staff-lines line").forEach((l) => l.setAttribute("x2", W - 2));
                const top = wide ? -34 : -20;
                const height = 76 - top;
                svg.setAttribute("viewBox", `0 ${top} ${W} ${height}`);
                svg.style.aspectRatio = `${W} / ${height}`;
                document.body.style.setProperty("--sh", String(height / W));
                this.clear();
            },
            clear() {
                notes = [];
                first = 0;
                shift = 0;
                layer.style.transition = "none";
                layer.style.transform = "";
                layer.innerHTML = "";
                void layer.getBoundingClientRect();
                layer.style.transition = "";
            },
            /**
             * Acrescenta uma nota (índice do botão) e acende por ms. Devolve a posição dela.
             * A pauta só anda para a esquerda; as notas que já saíram de vista são
             * apagadas de verdade (sem redesenhar as outras), então rolar é sempre suave.
             * Com chord = true a nota entra no acorde da última posição (tocadas juntas).
             */
            push(index, figureName, ms = 0, chord = false) {
                if (!mode) return -1;
                const last = notes[notes.length - 1];
                const grow = chord && last;
                const pads = grow ? [...new Set([...last.pads, index])] : [index];
                const figure = grow ? last.figure : figureName;
                // Posição: logo depois da anterior, com folga se um dos dois for largo
                // (cabeça do outro lado da haste, acidentes escalonados).
                const prev = grow ? notes[notes.length - 2] : last;
                const probe = chordSvg(pads, 0, figure);
                const x = prev ? prev.x + DX + prev.extraRight + probe.extraLeft : X0 + probe.extraLeft;
                const drawn = chordSvg(pads, x, figure);
                let slot;
                if (grow) {
                    slot = first + notes.length - 1;
                    const keep = [...last.el.classList].filter((c) => c !== "pop");
                    last.el.insertAdjacentHTML("afterend", drawn.html);
                    const el = last.el.nextElementSibling;
                    last.el.remove();
                    el.classList.add(...keep);
                    Object.assign(last, { el, pads, x, extraRight: drawn.extraRight });
                } else {
                    slot = first + notes.length;
                    layer.insertAdjacentHTML("beforeend", drawn.html);
                    const el = layer.lastElementChild;
                    el.classList.add("pop");
                    notes.push({ el, pads, figure, x, extraRight: drawn.extraRight });
                }
                scrollTo(slot);
                // Guarda no máximo MAX_NOTES; só apaga as que já estão fora da pauta.
                while (notes.length > MAX_NOTES && notes[0].x - shift < X0 - 3 * DX) {
                    const old = notes.shift();
                    clearTimeout(old.off);
                    old.el.remove();
                    first++;
                }
                if (ms) this.light(slot, ms);
                return slot;
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
            /** Marca a nota i como acertada (fica forte). */
            done(i) { notes[i - first]?.el.classList.add("done"); },
            allDone() { notes.forEach((n) => n.el.classList.add("done")); },
            get length() { return first + notes.length; },
        };
    };

    window.SigaDinoStaff = { createStaff, figureFor, FIGURES };
})();
