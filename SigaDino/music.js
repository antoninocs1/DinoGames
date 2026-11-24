/* =====================================================================
   Siga o Dino — "Executar música (notas)": leitura do código de notas
   ---------------------------------------------------------------------
   Formato (do material "Teoria Musical"):
     E[n1/4];          nota Mi, semínima
     2C[n1];           Dó da 2ª oitava (o 2º Dó do pentagrama), semibreve
     F#[n1/8];  Bb[n1/2];   sustenido (# ou ♯) e bemol (b ou ♭)
     Dó[n1/4]; Sol[n1/2];   também com os nomes em português
     [p1/4]; p[1/4];   pausa (aqui de semínima)
     C[n1], E[n1], G[n1];   separadas por vírgula = acorde (tocam juntas)
     E[n1/4.];         ponto de aumento (vale 1 vez e meia)
   Separadas por ponto e vírgula (ou em linhas diferentes) = uma depois da outra.
   Oitava: 1 (ou nada) = do Dó central ao Si; 2 = a de cima; 0 = a de baixo.
   Figuras: [n2] breve, [n1] semibreve, [n1/2] mínima, [n1/4] semínima,
   [n1/8] colcheia, [n1/16] semicolcheia, [n1/32] fusa, [n1/64] semifusa,
   [n1/128] quartifusa.
   Texto que não é nota (títulos, "Compasso 1:", |) é ignorado; "//" começa um
   comentário até o fim da linha. "Andamento: semínima = 80" define a velocidade.
   ===================================================================== */
(() => {
    "use strict";

    const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
    const NATURAL_SEMI = [0, 2, 4, 5, 7, 9, 11];
    const NAMES = { do: 0, re: 1, mi: 2, fa: 3, sol: 4, la: 5, si: 6 };

    /** Nome da figura pela fração da semibreve (2 = breve … 1/128 = quartifusa). */
    const FIGURE_BY_FRAC = [
        [2, "breve"], [1, "semibreve"], [1 / 2, "minima"], [1 / 4, "seminima"], [1 / 8, "colcheia"],
        [1 / 16, "semicolcheia"], [1 / 32, "fusa"], [1 / 64, "semifusa"], [1 / 128, "quartifusa"],
    ];
    const figureOf = (frac) => (FIGURE_BY_FRAC.find(([v]) => Math.abs(v - frac) < 1e-9) || [])[1];

    const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // Nota: [oitava] letra/nome [acidente] [n num / den .]   — pausa: [p1/4] ou p[1/4]
    const NOTE_RE = String.raw`(?<![\p{L}\d])(\d?)\s*(D[óo]|R[ée]|Mi|F[áa]|Sol|L[áa]|Si|[A-G])\s*(##|#|♯|bb|b|♭)?\s*\[\s*n\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.?)\s*\]`;
    const REST_RE = String.raw`(?<!\p{L})(?:p\s*\[\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.?)\s*\]|\[\s*p\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.?)\s*\])`;
    const TOKEN = new RegExp(`${NOTE_RE}|${REST_RE}`, "giu");
    const CODE_LIKE = /\[\s*[np][^\]]*\]/giu; // parece código, mas não foi entendido

    /**
     * Lê o texto e devolve { events, tempo, warnings }.
     * events: { kind: "note", notes: [{ semi, step, acc, label }], frac, figure, dotted, from, to }
     *       | { kind: "rest", frac, figure, dotted, from, to }
     * semi = semitons a partir do Dó central; step = posição na pauta (0 = Dó central, 1 = Ré…).
     */
    const parse = (raw) => {
        // Comentários viram espaços (as posições continuam valendo para o editor).
        const text = raw.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
        const events = [];
        const warnings = [];
        const used = [];
        let lastEnd = -1;
        let m;
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(text))) {
            const from = m.index, to = from + m[0].length;
            used.push([from, to]);
            const isNote = m[2] !== undefined;
            const num = Number(isNote ? m[4] : m[7] ?? m[10]);
            const den = Number((isNote ? m[5] : m[8] ?? m[11]) || 1);
            const dotted = (isNote ? m[6] : m[9] ?? m[12]) === ".";
            const base = num / den;
            const figure = figureOf(base);
            if (!figure || !num) { warnings.push(`figura desconhecida em “${m[0].trim()}”`); lastEnd = to; continue; }
            const frac = base * (dotted ? 1.5 : 1);
            const gap = lastEnd >= 0 ? text.slice(lastEnd, from) : "";
            lastEnd = to;
            if (!isNote) { events.push({ kind: "rest", frac, figure, dotted, from, to }); continue; }

            const word = plain(m[2]);
            const letter = word.length === 1 ? LETTERS.indexOf(word.toUpperCase()) : NAMES[word];
            const octave = m[1] === "" ? 1 : Number(m[1]);
            const accText = m[3] || "";
            const acc = /^(#|♯)$/.test(accText) ? 1 : accText === "##" ? 2 : /^(b|♭)$/.test(accText) ? -1 : accText === "bb" ? -2 : 0;
            const note = {
                semi: (octave - 1) * 12 + NATURAL_SEMI[letter] + acc,
                step: (octave - 1) * 7 + letter,
                acc: acc > 0 ? "♯".repeat(acc) : acc < 0 ? "♭".repeat(-acc) : "",
                label: `${octave !== 1 ? octave : ""}${LETTERS[letter]}${accText ? (acc > 0 ? "♯" : "♭").repeat(Math.abs(acc)) : ""}`,
            };
            const prev = events[events.length - 1];
            // Vírgula entre duas notas = acorde (soam juntas; vale a figura mais longa).
            if (prev && prev.kind === "note" && /^\s*,\s*$/.test(gap)) {
                prev.notes.push(note);
                prev.to = to;
                if (frac > prev.frac) Object.assign(prev, { frac, figure, dotted });
                continue;
            }
            events.push({ kind: "note", notes: [note], frac, figure, dotted, from, to });
        }
        // Códigos com colchetes que não viraram nota nem pausa (letra errada, etc.).
        let c;
        CODE_LIKE.lastIndex = 0;
        while ((c = CODE_LIKE.exec(text))) {
            const at = c.index;
            if (used.some(([a, b]) => at >= a && at < b)) continue;
            // Linhas de explicação como "[n1/4] = semínima" não são aviso.
            const lineEnd = text.indexOf("\n", at);
            const rest = text.slice(at + c[0].length, lineEnd < 0 ? undefined : lineEnd);
            if (/^\s*=/.test(rest)) continue;
            const lineStart = text.lastIndexOf("\n", at) + 1;
            const word = text.slice(lineStart, at).match(/(\S*)\s*$/)[1];
            warnings.push(`não entendi “${(word + c[0]).trim()}”`);
        }
        const tempoMatch = text.match(/sem[ií]nima\s*=\s*(\d{2,3})/i) || text.match(/(?:andamento|bpm|tempo)\s*[:=]?\s*(\d{2,3})/i);
        const tempo = tempoMatch ? Math.min(240, Math.max(30, Number(tempoMatch[1]))) : 0;
        return { events, tempo, warnings };
    };

    // ---------- Exemplos ----------
    const ODE = `ODE À ALEGRIA – Ludwig van Beethoven
Melodia (pauta de cima), compasso 4/4
Andamento: semínima = 80

// Como ler: E[n1/4] = Mi semínima; D[n1/2] = Ré mínima; G[n1] = Sol semibreve
// 0G = o Sol de baixo (abaixo do Dó central). Vírgula = acorde; ponto e vírgula = uma depois da outra.

Compasso 1:  E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];
Compasso 2:  G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];
Compasso 3:  C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];
Compasso 4:  E[n1/2]; D[n1/2];

Compasso 5:  E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];
Compasso 6:  G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];
Compasso 7:  C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];
Compasso 8:  D[n1/2]; C[n1/2];

Compasso 9:  D[n1/4]; D[n1/4]; E[n1/4]; C[n1/4];
Compasso 10: D[n1/4]; E[n1/8]; F[n1/8]; E[n1/4]; C[n1/4];
Compasso 11: D[n1/4]; E[n1/8]; F[n1/8]; E[n1/4]; D[n1/4];
Compasso 12: C[n1/4]; D[n1/4]; 0G[n1/2];

Compasso 13: E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];
Compasso 14: G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];
Compasso 15: C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];
Compasso 16: D[n1/2]; C[n1/2];

// Final com acorde de Dó maior (Dó, Mi e Sol juntos):
Compasso 17: C[n1], E[n1], G[n1];
`;

    window.SigaDinoMusic = {
        parse,
        figureOf,
        EXAMPLES: [
            { id: "ode", title: "Ode à Alegria (Beethoven)", file: "Ode_a_Alegria_notas.txt", text: ODE },
        ],
    };
})();
