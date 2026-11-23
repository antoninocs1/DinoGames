/* =====================================================================
   Siga o Dino — pentagrama (clave de sol) para os modelos de teclado
   ---------------------------------------------------------------------
   Desenha as notas da sequência na pauta, com a cor da tecla e o nome
   dentro da cabeça da nota. A nota acende quando toca.
   A figura acompanha a velocidade:
     semibreve (lenta) → mínima → semínima (rápida)
   Não sabe nada da partida: o jogo chama begin/push/light/done.
   ===================================================================== */
(() => {
    "use strict";

    const SP = 12;               // distância entre as linhas da pauta
    const BOTTOM = 48;           // y da 1ª linha (Mi)
    const X0 = 62, DX = 32;      // x da 1ª nota e espaço entre notas
    const W = 420;               // largura do desenho
    const VIEW = `0 -20 ${W} 96`;
    const STEM = 34;
    const MAX_NOTES = 40;        // no tocar livre, guarda só as últimas
    const SLOTS = Math.floor((W - X0 - 8) / DX) + 1; // notas que cabem sem rolar

    const FIGURES = {
        semibreve: { title: "Semibreve", rx: 12.5, ry: 9.4, hollow: true, stem: false },
        minima:    { title: "Mínima",    rx: 11, ry: 9, hollow: true, stem: true },
        seminima:  { title: "Semínima",  rx: 11, ry: 9, hollow: false, stem: true },
    };

    /** Figura pela duração da nota acesa (ms): quanto mais rápido, menor a figura. */
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
        let notes = [];          // { el, pad }
        let shift = 0;           // quantas notas já rolaram para a esquerda

        svg.setAttribute("viewBox", VIEW);
        svg.innerHTML = `
            <defs><clipPath id="staff-clip"><rect x="${X0 - 19}" y="-30" width="${W}" height="120"/></clipPath></defs>
            <g class="staff-lines">${[0, 1, 2, 3, 4].map((i) =>
                `<line x1="2" x2="${W - 2}" y1="${BOTTOM - i * SP}" y2="${BOTTOM - i * SP}"/>`).join("")}</g>
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

        const noteSvg = (index, slot, figureName) => {
            const pad = mode.pads[index];
            const fig = FIGURES[figureName] || FIGURES.semibreve;
            const { step, acc } = placeOf(index);
            const x = X0 + slot * DX, y = yOf(step);
            const color = pad.color;
            // ♯/♭ já aparece fora da figura: dentro vai só o nome da nota natural (Dó♯ → Dó).
            const naturals = mode.pads.filter((p) => !p.sharp);
            const name = acc ? nameOf(naturals[step] || pad) : nameOf(pad);
            const parts = [];
            if (step <= 0) parts.push(`<line class="ledger" x1="${x - 17}" x2="${x + 17}" y1="${yOf(0)}" y2="${yOf(0)}"/>`);
            if (fig.stem) {
                const up = step < 6; // do Si (3ª linha) para cima, haste para baixo
                const sx = up ? x + fig.rx - 1 : x - fig.rx + 1;
                parts.push(`<line class="stem" x1="${f(sx)}" x2="${f(sx)}" y1="${y}" y2="${up ? y - STEM : y + STEM}"/>`);
            }
            if (acc) parts.push(`<text class="acc" x="${f(x - fig.rx - 4.5)}" y="${y}">${acc}</text>`);
            const fill = fig.hollow ? tint(color, 0.72) : color;
            const ink = fig.hollow ? "#1d1b22" : lum(color) > 0.6 ? "#1d1b22" : "#fff";
            const size = name.length > 3 ? 6.2 : name.length > 2 ? 7.2 : 8;
            parts.push(`<g class="head" style="--c:${color}">
                <ellipse rx="${fig.rx}" ry="${fig.ry}" cx="${x}" cy="${y}" fill="${fill}" stroke="${fig.hollow ? color : "#00000066"}" stroke-width="${fig.hollow ? 3 : 1}"/>
                <text x="${x}" y="${f(y + 0.3)}" font-size="${size}" fill="${ink}">${name}</text>
            </g>`);
            return `<g class="note" data-figure="${figureName}">${parts.join("")}</g>`;
        };

        /** Rola as notas para a nota "focus" (índice) ficar à vista. */
        const scrollTo = (focus) => {
            const want = Math.max(0, focus - (SLOTS - 2));
            if (want === shift) return;
            shift = want;
            layer.style.transform = `translateX(${-shift * DX}px)`;
        };

        const relayout = () => {
            // Recalcula as posições (usado quando as notas antigas saem no tocar livre).
            layer.innerHTML = "";
            notes.forEach((n, slot) => {
                layer.insertAdjacentHTML("beforeend", noteSvg(n.pad, slot, n.figure));
                const el = layer.lastElementChild;
                el.className.baseVal = n.el.className.baseVal.replace(/\b(pop|lit)\b/g, "").trim();
                n.el = el;
            });
        };

        return {
            figureFor,
            FIGURES,
            /** Troca o modo (botões) e como o nome aparece (♯ ou ♭). */
            setMode(newMode, nameFn, useFlats) {
                mode = newMode;
                nameOf = nameFn;
                flats = useFlats;
                this.clear();
            },
            clear() {
                notes = [];
                shift = 0;
                layer.style.transition = "none";
                layer.style.transform = "";
                layer.innerHTML = "";
                void layer.getBoundingClientRect();
                layer.style.transition = "";
            },
            /** Acrescenta uma nota (índice do botão) e acende por ms. Devolve a posição dela. */
            push(index, figureName, ms = 0) {
                if (!mode) return -1;
                if (notes.length >= MAX_NOTES) {
                    notes.splice(0, notes.length - MAX_NOTES + 1);
                    shift = 0;
                    layer.style.transition = "none";
                    layer.style.transform = "";
                    relayout();
                    void layer.getBoundingClientRect();
                    layer.style.transition = "";
                    scrollTo(notes.length);
                }
                const slot = notes.length;
                layer.insertAdjacentHTML("beforeend", noteSvg(index, slot, figureName));
                const el = layer.lastElementChild;
                el.classList.add("pop");
                notes.push({ el, pad: index, figure: figureName });
                scrollTo(slot);
                if (ms) this.light(slot, ms);
                return slot;
            },
            /** Acende a nota na posição i por ms. */
            light(i, ms) {
                const n = notes[i];
                if (!n) return;
                scrollTo(i);
                n.el.classList.add("lit");
                clearTimeout(n.off);
                n.off = setTimeout(() => n.el.classList.remove("lit"), ms);
            },
            /** Marca a nota i como acertada (fica forte). */
            done(i) { notes[i]?.el.classList.add("done"); },
            allDone() { notes.forEach((n) => n.el.classList.add("done")); },
            get length() { return notes.length; },
        };
    };

    window.SigaDinoStaff = { createStaff, figureFor, FIGURES };
})();
