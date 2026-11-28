/* =====================================================================
   Siga o Dino — "Executar música (notas)": leitura do código de notas
   ---------------------------------------------------------------------
   Formato (do material "Teoria Musical"):
     E[n1/4];          nota Mi, semínima
     4C[n1];           Dó central (oitava 4, como no piano), semibreve
     5C[n1/2];         Dó de cima (oitava 5); 3G[n1/4] = Sol abaixo do Dó central
     F#[n1/8];  Bb[n1/2];   sustenido (# ou ♯) e bemol (b ou ♭)
     Dó[n1/4]; Sol[n1/2];   também com os nomes em português
     [p1/4]; p[1/4];   pausa (aqui de semínima)
     [s1/4];           espera em silêncio, sem desenhar a pausa (a 2ª voz esperando)
     C[n1], E[n1], G[n1];   separadas por vírgula = acorde (tocam juntas)
     E[n1/4.];         ponto de aumento (vale 1 vez e meia)
     E[n1/4..];        ponto duplo (vale 1 vez e três quartos)
     F[n1/2.]~ F[n1/4];   ligadura (~ depois da nota ou do acorde): a nota seguinte de
                       mesma altura não é tocada de novo, só continua soando
                       (serve para a nota passar da barra de compasso)
     {3 C[n1/8]; D[n1/8]; E[n1/8];}   quiáltera: 3 notas no tempo de 2 (tercina)
     {2 C[n1/8]; D[n1/8];}            duína: 2 colcheias no tempo de 3
     {5:4 …}           n:m = n notas no tempo de m da mesma figura
   Separadas por ponto e vírgula (ou em linhas diferentes) = uma depois da outra.
   Oitava (o número na frente da letra, como no piano): 4 = do Dó central (4C) ao Si
   (4B); 5 = a de cima; 3, 2, 1 = mais graves (mão esquerda, clave de Fá); 6, 7 = mais
   agudas. Sem número vale 4. O número fica na frente (4C, não C4) para não se misturar
   com a figura e os acordes: 4C[n1/4], 4E[n1/4], 4G[n1/4];
   Textos da numeração antiga (Dó central = C ou 1C) viram a nova com migrateOctaves.
   Figuras: [n2] breve, [n1] semibreve, [n1/2] mínima, [n1/4] semínima,
   [n1/8] colcheia, [n1/16] semicolcheia, [n1/32] fusa, [n1/64] semifusa,
   [n1/128] quartifusa.
   Fórmula de compasso: "Compasso: x1/x2" (com dois-pontos), ex. 4/4, 3/4, 2/2, 6/8.
     x1 = quantos tempos cabem no compasso; x2 = a figura que vale um tempo
     (1 semibreve, 2 mínima, 4 semínima, 8 colcheia, 16 semicolcheia).
     Cada compasso aceita x1/x2 de semibreve: 4/4 = 1 semibreve, 3/4 = mínima pontuada,
     2/2 = 1 semibreve, 6/8 = mínima pontuada. "Compasso: C" = 4/4 (tempo comum) e
     "Compasso: ¢" = 2/2 (tempo cortado, alla breve) — aparecem com o símbolo.
     Com a fórmula, as barras de compasso saem da duração das notas (as linhas do
     texto só organizam a leitura) e a nota que não cabe no que sobra do compasso
     fica marcada no pentagrama e gera um aviso.
   Sem a fórmula: nota que começa uma linha nova, ou vem depois de "Compasso"
   ou de "|", ganha a barra antes dela no pentagrama.
   Texto que não é nota (títulos, "Compasso 1:", |) é ignorado; "//" começa um
   comentário até o fim da linha. "Andamento: semínima = 160" define a velocidade
   (vale também "mínima = 80", "colcheia = 200", "semínima. = 60"); só o número
   ("Andamento: 120") conta tempos da figura da fórmula de compasso (x2).
   "Música: Nome da música" dá o título, mostrado em cima do pentagrama.
   Uma linha "Fim" (ou ":Fim") põe a barra dupla de fim depois da última nota.
   Duas mãos (piano): "MD:" (mão direita) e "ME:" (mão esquerda) — vale também
   "Mão direita:" / "Mão esquerda:". O que vem depois do marcador é daquela mão até
   o próximo marcador; sem marcador, tudo é mão direita. Cada mão tem a sua linha do
   tempo (compassos, ligaduras e quiálteras contam separados) e as duas tocam juntas:
     Compasso 1:
     MD: E[n1/4]; F[n1/4]; G[n1/2];
     ME: C[n1/2], 0G[n1/2]; 0B[n1/2];
   Segunda voz da mesma mão: "MD2:" e "ME2:" (ex.: a melodia em colcheias por cima de
   uma nota longa). Cada voz tem a sua linha do tempo; no pentagrama a voz 1 fica com
   a haste para cima e a voz 2 para baixo.
   Cada evento ganha hand ("md", "md2", "me", "me2") e at (início, em unidades UNIT de
   semibreve); a lista volta em ordem de tempo (no mesmo instante: md, md2, me, me2).
   Armadura: "Tom: Ré♭ maior" (ou "Tom: Db", "Tom: Lá menor") ou "Armadura: 5b" / "3#".
   Outra linha "Tom:" no meio do texto troca a armadura dali em diante (cada evento
   ganha key = armadura valendo; o pentagrama desenha a nova depois de uma barra dupla).
   As notas sem acidente seguem a armadura (com 5 bemóis, B vira Si♭); "♮" ou "="
   depois da letra é o bequadro (A♮[n1/4] ou A=[n1/4]: Lá natural). O pentagrama
   desenha a armadura depois da clave e só mostra o acidente que foge dela.
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

    // Nota: [oitava colada, ex. 2C] letra/nome [acidente] [n num / den .]   — pausa: [p1/4] ou p[1/4]
    const NOTE_RE = String.raw`(?<![\p{L}\d-])(\d)?(D[óo]|R[ée]|Mi|F[áa]|Sol|L[áa]|Si|[A-G])\s*(##|#|♯|bb|b|♭|♮|=)?\s*\[\s*n\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.{0,2})\s*\]`;
    const REST_RE = String.raw`(?<!\p{L})(?:p\s*\[\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.{0,2})\s*\]|\[\s*p\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.{0,2})\s*\])`;
    const TOKEN = new RegExp(`${NOTE_RE}|${REST_RE}`, "giu");
    const CODE_LIKE = /\[\s*[np][^\]]*\]/giu; // parece código, mas não foi entendido
    // Quiáltera: "{3 …}" ou "{n:m …}" (o m colado nos dois-pontos e seguido de espaço, para
    // "{3: 2C[n1/8]…" continuar sendo o Dó de cima).
    const TUPLET = /\{\s*(\d{1,2})(?::(\d{1,2})(?=\s))?[^{}]*\}/g;
    // Marcador de mão: "MD:" / "ME:" ou "Mão direita:" / "Mão esquerda:".
    const HAND = /(?<![\p{L}\d])(MD2|ME2|MD|ME|m[ãa]o\s+direita|m[ãa]o\s+esquerda)\s*:/giu;
    const HAND_SPLIT = /(?<![\p{L}\d])(?:MD2|ME2|MD|ME|m[ãa]o\s+direita|m[ãa]o\s+esquerda)\s*:/iu;
    /** Vozes na ordem do desenho e do som: mão direita (1 e 2), mão esquerda (1 e 2). */
    const VOICES = ["md", "md2", "me", "me2"];
    const VOICE_NAME = { md: "mão direita", md2: "mão direita, voz 2", me: "mão esquerda", me2: "mão esquerda, voz 2" };
    const handKey = (word) => {
        const w = plain(word).replace(/\s+/g, " ");
        return w === "mao direita" ? "md" : w === "mao esquerda" ? "me" : w;
    };
    /** Tempo padrão de cada quiáltera: 3 no tempo de 2, 2 no tempo de 3… */
    const TUPLET_DEFAULT = { 2: 3, 3: 2, 4: 3, 5: 4, 6: 4, 7: 4, 9: 8 };

    /**
     * Lê o texto e devolve { events, tempo, warnings }.
     * events: { kind: "note", notes: [{ semi, step, acc, label }], frac, figure, dotted, from, to }
     *       | { kind: "rest", frac, figure, dotted, from, to }
     * semi = semitons a partir do Dó central; step = posição na pauta (0 = Dó central, 1 = Ré…).
     */
    const parse = (raw) => {
        // Comentários viram espaços (as posições continuam valendo para o editor).
        const spacers = new Set(); // "[s1/4]": pausa invisível (a 2ª voz esperando), vira "[p1/4]" escondida
        const text = raw.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
            .replace(/\[(\s*)s(?=\s*\d)/g, (m, sp, at) => { spacers.add(at); return `[${sp}p`; });
        const warnings = [];
        const used = [];
        let m;
        // Mãos: cada uma com a sua lista de eventos e o fim do último código lido.
        const marks = [];
        HAND.lastIndex = 0;
        while ((m = HAND.exec(text))) marks.push({ at: m.index, hand: handKey(m[1]) });
        const handAt = (pos) => { let h = "md"; for (const mk of marks) { if (mk.at > pos) break; h = mk.hand; } return h; };
        const lists = { md: [], md2: [], me: [], me2: [] };
        const lastEndOf = { md: -1, md2: -1, me: -1, me2: -1 };
        // Armadura: acidente de cada letra (−1 bemol, +1 sustenido). Uma linha "Tom:" no meio do
        // texto troca a armadura dali em diante; antes da 1ª linha vale a 1ª.
        const keys = readKeys(text);
        const keyAt = (pos) => { let k = keys[0] || NO_KEY; for (const x of keys) { if (x.pos > pos) break; k = x; } return k; };
        let events = lists.md, lastEnd = -1;
        // Quiálteras: "{3 …}", "{2 …}" ou "{n:m …}" (n notas no tempo de m).
        const groups = [];
        let g;
        TUPLET.lastIndex = 0;
        while ((g = TUPLET.exec(text))) {
            const n = Number(g[1]);
            const mm = Number(g[2] || TUPLET_DEFAULT[n] || 0);
            if (!n || !mm) { warnings.push(`quiáltera “{${g[1]}” sem o tempo: escreva {${g[1]}:m …}`); continue; }
            groups.push({ from: g.index, to: g.index + g[0].length, n, m: mm, id: groups.length });
        }
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(text))) {
            const from = m.index, to = from + m[0].length;
            used.push([from, to]);
            const hand = handAt(from);
            events = lists[hand];
            lastEnd = lastEndOf[hand];
            const isNote = m[2] !== undefined;
            const num = Number(isNote ? m[4] : m[7] ?? m[10]);
            const den = Number((isNote ? m[5] : m[8] ?? m[11]) || 1);
            const dots = ((isNote ? m[6] : m[9] ?? m[12]) || "").length; // 0, 1 (ponto) ou 2 (ponto duplo)
            const dotted = dots > 0;
            const base = num / den;
            const figure = figureOf(base);
            if (!figure || !num) { warnings.push(`figura desconhecida em “${m[0].trim()}”`); lastEndOf[hand] = to; continue; }
            const group = groups.find((gr) => from > gr.from && to < gr.to);
            const frac = base * (dots === 2 ? 1.75 : dots ? 1.5 : 1) * (group ? group.m / group.n : 1);
            const tuplet = group ? { id: group.id, n: group.n, m: group.m } : null;
            const gap = lastEnd >= 0 ? text.slice(lastEnd, from) : "";
            lastEndOf[hand] = to;
            // "~" logo depois da nota anterior = ligadura para a próxima (resolvida no fim).
            if (/^\s*~/.test(gap) && events.length) events[events.length - 1].tieNext = true;
            // Linha nova, "Compasso" ou "|" antes desta nota = começa outro compasso.
            const bar = events.length > 0 && /\n|compasso|\|/i.test(gap);
            const key = keyAt(from);
            if (!isNote) { events.push({ kind: "rest", hand, frac, figure, dotted, dots, tuplet, bar, from, to, hidden: spacers.has(from), key: key.count }); continue; }

            const word = plain(m[2]);
            const letter = word.length === 1 ? LETTERS.indexOf(word.toUpperCase()) : NAMES[word];
            const octave = m[1] ? Number(m[1]) : 4; // como no piano: 4 = a do Dó central (sem número vale 4)
            const accText = m[3] || "";
            const natural = accText === "♮" || accText === "=";
            const inKey = key.acc[letter];
            // Sem acidente escrito vale a armadura; ♮/= é o bequadro (natural).
            const acc = natural ? 0 : !accText ? inKey
                : /^(#|♯)$/.test(accText) ? 1 : accText === "##" ? 2 : /^(b|♭)$/.test(accText) ? -1 : accText === "bb" ? -2 : 0;
            const sign = (a) => (a > 0 ? "♯".repeat(a) : a < 0 ? "♭".repeat(-a) : "");
            const note = {
                semi: (octave - 4) * 12 + NATURAL_SEMI[letter] + acc,
                step: (octave - 4) * 7 + letter,
                // No pentagrama: só o acidente que foge da armadura (♮ quando volta ao natural).
                acc: acc === inKey ? "" : acc === 0 ? "♮" : sign(acc),
                label: `${octave}${LETTERS[letter]}${sign(acc)}`,
            };
            const prev = events[events.length - 1];
            // Vírgula entre duas notas = acorde (soam juntas; vale a figura mais longa).
            if (prev && prev.kind === "note" && /^\s*~?\s*,\s*$/.test(gap)) {
                prev.notes.push(note);
                prev.to = to;
                if (frac > prev.frac) Object.assign(prev, { frac, figure, dotted, dots });
                continue;
            }
            events.push({ kind: "note", hand, notes: [note], frac, figure, dotted, dots, tuplet, bar, from, to, key: key.count });
        }
        const voicesUsed = VOICES.filter((v) => lists[v].length);
        const two = voicesUsed.length > 1;
        const meterInfo = readMeter(text);
        const ends = {};
        for (const hand of VOICES) {
            const list = lists[hand];
            if (!list.length) continue;
            // "~" depois da última nota da mão também vale (ligadura que não leva a nada: avisa).
            const tail = text.slice(lastEndOf[hand]).split(HAND_SPLIT)[0];
            if (/^\s*~/.test(tail)) list[list.length - 1].tieNext = true;
            const who = two ? ` (${VOICE_NAME[hand]})` : "";
            resolveTies(list, warnings, who);
            if (meterInfo) measureBars(list, meterInfo, warnings, who);
            // Início de cada evento na linha do tempo da mão (unidades inteiras).
            let at = 0;
            list.forEach((ev) => { ev.at = at; at += unitsOf(ev.frac); });
            ends[hand] = at;
        }
        if (two && new Set(voicesUsed.map((v) => ends[v])).size > 1) {
            warnings.push(`as vozes não terminam juntas: ${voicesUsed.map((v) => `${VOICE_NAME[v]} ${fracText(ends[v])}`).join(", ")} de semibreve`);
        }
        // Ordem de tempo; no mesmo instante: md, md2, me, me2 (sort é estável).
        events = VOICES.flatMap((v) => lists[v]).sort((a, b) => a.at - b.at || VOICES.indexOf(a.hand) - VOICES.indexOf(b.hand));
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
        const titleMatch = text.match(/^[ \t]*m[úu]sica[ \t]*:[ \t]*(.+?)[ \t]*$/im);
        const title = titleMatch ? titleMatch[1] : "";
        const meter = meterInfo ? meterInfo.text : "";
        const tempo = readTempo(text, meterInfo);
        const end = /^[ \t]*:?[ \t]*fim[ \t]*[:.!]?[ \t]*$/im.test(text) || /:[ \t]*fim(?![\p{L}\d])/iu.test(text);
        const hands = lists.me.length || lists.me2.length ? 2 : 1;
        return { events, tempo, warnings, title, meter, end, hands, key: (keys[0] || NO_KEY).count, voices: VOICES.filter((v) => lists[v].length) };
    };

    /**
     * Ligaduras: a nota da próxima posição com a mesma altura (semi) vira continuação
     * (tied = true, não toca de novo). A nota que começa a ligadura ganha hold = duração
     * somada de toda a cadeia (fração da semibreve), usada para o som durar até o fim.
     */
    const resolveTies = (events, warnings, who = "") => {
        events.forEach((ev, k) => {
            if (!ev.tieNext) return;
            const next = events[k + 1];
            const what = ev.kind === "rest" ? "pausa" : ev.notes.map((n) => n.label).join("+");
            if (ev.kind !== "note" || !next || next.kind !== "note") {
                warnings.push(`ligadura em ${what}${who} sem nota igual logo depois`);
                ev.tieNext = false;
                return;
            }
            let any = false;
            next.notes.forEach((n) => {
                if (ev.notes.some((p) => p.semi === n.semi)) { n.tied = true; any = true; }
            });
            if (!any) { warnings.push(`ligadura em ${what}${who}: a nota seguinte não é a mesma`); ev.tieNext = false; }
        });
        for (let k = events.length - 1; k >= 0; k--) {
            const ev = events[k];
            if (ev.kind !== "note") continue;
            const next = events[k + 1];
            ev.notes.forEach((n) => {
                const cont = ev.tieNext && next.notes.find((q) => q.tied && q.semi === n.semi);
                n.hold = ev.frac + (cont ? cont.hold : 0);
            });
        }
    };

    // Armaduras: quantos sustenidos (+) ou bemóis (−) cada tom maior tem.
    const MAJOR = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
    const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // Fá, Dó, Sol, Ré, Lá, Mi, Si (índices de LETTERS)
    const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];  // Si, Mi, Lá, Ré, Sol, Dó, Fá
    /**
     * "Tom: Ré♭ maior" / "Tom: Db" / "Tom: Lá menor" / "Tom: Am" ou "Armadura: 5b" / "3#" / "0".
     * Devolve { count, acc }: count > 0 sustenidos, < 0 bemóis; acc[letra] = −1, 0 ou +1.
     */
    const readKey = (text) => {
        let count = 0;
        const arm = text.match(/^[ \t]*armadura[ \t]*:[ \t]*(\d)[ \t]*(b|♭|#|♯)?/im);
        const tom = text.match(/^[ \t]*(?:tom|tonalidade)[ \t]*:[ \t]*(D[óo]|R[ée]|Mi|F[áa]|Sol|L[áa]|Si|[A-G])[ \t]*(#|♯|b|♭)?[ \t]*(maior|menor|m(?![\p{L}]))?/imu);
        if (arm) count = Math.min(7, Number(arm[1])) * (/b|♭/.test(arm[2] || "") ? -1 : 1);
        else if (tom) {
            const word = plain(tom[1]);
            const letter = LETTERS[word.length === 1 ? LETTERS.indexOf(word.toUpperCase()) : NAMES[word]];
            const name = letter + (/#|♯/.test(tom[2] || "") ? "#" : /b|♭/.test(tom[2] || "") ? "b" : "");
            const minor = /^m(enor)?$/i.test(tom[3] || "");
            const base = MAJOR[name];
            if (base != null) count = Math.max(-7, Math.min(7, base - (minor ? 3 : 0)));
        }
        const acc = [0, 0, 0, 0, 0, 0, 0];
        (count > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(count)).forEach((l) => (acc[l] = count > 0 ? 1 : -1));
        return { count, acc };
    };

    const NO_KEY = { count: 0, acc: [0, 0, 0, 0, 0, 0, 0], pos: 0 };
    /** Todas as linhas "Tom:"/"Armadura:" do texto, na ordem: [{ pos, count, acc }]. */
    const readKeys = (text) => {
        const list = [];
        const re = /^[ \t]*(?:armadura|tom|tonalidade)[ \t]*:[^\n]*/gimu;
        let m;
        while ((m = re.exec(text))) list.push({ pos: m.index, ...readKey(m[0]) });
        return list;
    };

    /**
     * "Compasso: 3/4", "Compasso: C" (= 4/4) ou "Compasso: ¢" (= 2/2).
     * Devolve { text, beats, unit } — text é o que o pentagrama desenha ("3/4", "C" ou "¢").
     */
    const readMeter = (text) => {
        const num = text.match(/compasso[ \t]*:[ \t]*(\d{1,2})[ \t]*\/[ \t]*(\d{1,2})/i);
        if (num) {
            const beats = Number(num[1]), unit = Number(num[2]);
            // x2 tem que ser uma figura: 1, 2, 4, 8, 16, 32, 64 (potência de 2).
            if (beats > 0 && unit > 0 && unit <= 64 && (unit & (unit - 1)) === 0) return { text: `${beats}/${unit}`, beats, unit };
            return null;
        }
        const sym = text.match(/compasso[ \t]*:[ \t]*(¢|₵|C[ \t]*\||C[ \t]+cortado|C)[ \t]*(?:$|\/\/|[(;,.-])/im);
        if (!sym) return null;
        return /^C$/i.test(sym[1]) ? { text: "C", beats: 4, unit: 4 } : { text: "¢", beats: 2, unit: 2 };
    };

    // Durações em unidades inteiras, para somar sem erro de arredondamento: 1 semibreve =
    // 512 × 2520 (a quartifusa com ponto duplo e as quiálteras de 2 a 9 dão número inteiro).
    const UNIT = 512 * 2520;
    const unitsOf = (frac) => Math.round(frac * UNIT);
    /** 384 → "3/4" (fração da semibreve), para os avisos. */
    const fracText = (u) => {
        const g = (x, y) => (y ? g(y, x % y) : x);
        const d = g(u, UNIT);
        return UNIT / d === 1 ? String(u / d) : `${u / d}/${UNIT / d}`;
    };

    /**
     * Com fórmula de compasso: soma a duração das notas e põe a barra quando o compasso
     * enche (x1 tempos da figura 1/x2). As quebras de linha do texto deixam de valer como barra.
     * Nota que passa do que sobra no compasso: marca over = true e avisa; o compasso
     * seguinte começa depois dela. Cada evento ganha measure (número do compasso, de 1).
     */
    const measureBars = (events, { beats, unit, text }, warnings, who = "") => {
        const cap = unitsOf(beats / unit);
        let used = 0, measure = 1;
        events.forEach((ev, k) => {
            ev.bar = k > 0 && used === 0;
            ev.measure = measure;
            const len = unitsOf(ev.frac);
            if (used + len > cap) {
                ev.over = true;
                const what = ev.kind === "rest" ? "a pausa" : `a nota ${ev.notes.map((n) => n.label).join("+")}`;
                warnings.push(len > cap
                    ? `compasso ${measure}${who}: ${what} (${fracText(len)}) é maior que o compasso ${text} (${fracText(cap)})`
                    : `compasso ${measure}${who}: ${what} (${fracText(len)}) não cabe, só sobra ${fracText(cap - used)} no ${text}`);
                used = 0;
                measure++;
                return;
            }
            used += len;
            if (used === cap) { used = 0; measure++; }
        });
        if (used > 0) warnings.push(`último compasso (${measure})${who} incompleto: tem ${fracText(used)} de ${fracText(cap)}`);
    };

    /**
     * Andamento em semínimas por minuto (o ♩ = do jogo).
     * "semínima = 160", "mínima = 80", "colcheia pontuada = 60", "semínima. = 60"
     * dizem a figura; só o número ("Andamento: 120") conta o tempo da fórmula (x2).
     */
    const BEAT_FIG = { semibreve: 1, minima: 1 / 2, seminima: 1 / 4, colcheia: 1 / 8, semicolcheia: 1 / 16 };
    const readTempo = (text, meterInfo) => {
        const byFig = text.match(/(?<!\p{L})(semibreve|semicolcheia|sem[ií]nima|m[ií]nima|colcheia)(\s*(?:\.|pontuada))?\s*=\s*(\d{1,3})/iu);
        let fig, n;
        if (byFig) {
            fig = BEAT_FIG[plain(byFig[1])] * (byFig[2] ? 1.5 : 1);
            n = Number(byFig[3]);
        } else {
            const bare = text.match(/(?:andamento|bpm|tempo)\s*[:=]?\s*(\d{2,3})/i);
            if (!bare) return 0;
            n = Number(bare[1]);
            fig = meterInfo ? 1 / meterInfo.unit : 1 / 4;
        }
        return Math.min(240, Math.max(30, Math.round(n * fig * 4))); // figura do tempo → semínimas por minuto
    };

    // ---------- Exemplos ----------
    // Igual ao arquivo "Ode_a_Alegria_notas.txt" (melodia principal completa, 16 compassos e acorde final).
    const ODE = `Música: ODE À ALEGRIA – Ludwig van Beethoven
Transcrição em texto (melodia principal)

Referência: arquivo “Teoria Musical.pdf”, página 3.
Instrumento/linha considerada: pauta superior (melodia).
Compasso: 4/4
Andamento indicado na partitura: semínima = 160

Convenção utilizada conforme o material:
[n1/4] = semínima
[n1/2] = mínima
[n1]   = semibreve

As letras representam as notas conforme a legenda:
C = Dó | D = Ré | E = Mi | F = Fá | G = Sol | A = Lá | B = Si

MELODIA – TEMA PRINCIPAL

Compasso 1:
4E[n1/4]; 4E[n1/4]; 4F[n1/4]; 4G[n1/4];

Compasso 2:
4G[n1/4]; 4F[n1/4]; 4E[n1/4]; 4D[n1/4];

Compasso 3:
4C[n1/4]; 4C[n1/4]; 4D[n1/4]; 4E[n1/4];

Compasso 4:
4E[n1/2]; 4D[n1/2];

Compasso 5:
4E[n1/4]; 4E[n1/4]; 4F[n1/4]; 4G[n1/4];

Compasso 6:
4G[n1/4]; 4F[n1/4]; 4E[n1/4]; 4D[n1/4];

Compasso 7:
4C[n1/4]; 4C[n1/4]; 4D[n1/4]; 4E[n1/4];

Compasso 8:
4D[n1/2]; 4C[n1/2];

Compasso 9:
4D[n1/4]; 4D[n1/4]; 4E[n1/4]; 4C[n1/4];

Compasso 10:
4D[n1/4]; 4E[n1/8]; 4F[n1/8]; 4E[n1/4]; 4C[n1/4];

Compasso 11:
4D[n1/4]; 4E[n1/8]; 4F[n1/8]; 4E[n1/4]; 4D[n1/4];

Compasso 12 (G de baixo = 3G):
4C[n1/4]; 4D[n1/4]; 3G[n1/2];

Compasso 13:
4E[n1/4]; 4E[n1/4]; 4F[n1/4]; 4G[n1/4];

Compasso 14:
4G[n1/4]; 4F[n1/4]; 4E[n1/4]; 4D[n1/4];

Compasso 15:
4C[n1/4]; 4C[n1/4]; 4D[n1/4]; 4E[n1/4];

Compasso 16:
4D[n1/2]; 4C[n1/2];

Compasso 17 (final com acorde de Dó maior: Dó, Mi e Sol juntos):
4C[n1], 4E[n1], 4G[n1];

Fim

Observação: Esta transcrição apresenta o tema principal da melodia completo, com dezesseis compassos e o acorde final, com base na pauta superior da partitura da página 3 (compassos 1 a 8) e na continuação do tema (compassos 9 a 16). Não representa o acompanhamento da pauta inferior do piano.
`;

    // Igual ao arquivo "Clair_de_Lune_notas.txt" (a música inteira, 72 compassos, as duas mãos).
    const CLAIR = `Música: Clair de Lune – Claude Debussy
Transcrição em texto: a música inteira, 72 compassos (as duas mãos)

Referência: Suite bergamasque, 3º movimento, 1ª edição (E. Fromont, Paris, 1905),
páginas 14 a 19 — domínio público (IMSLP #83536), conferida com a edição digital do
Mutopia Project (Keith OHara, a partir da mesma edição de 1905, domínio público).
Andante très expressif · pp · con sordina
Tom: Ré♭ maior
Compasso: 9/8
Andamento: semínima. = 52

Convenção utilizada:
MD = mão direita (melodia); MD2 = 2ª voz da mão direita
ME = mão esquerda; ME2 = 2ª voz da mão esquerda (o baixo)
Com o Tom de Ré♭ maior, B, E, A, D e G já são bemóis; A♮ = Lá natural; Bbb = Si dobrado bemol.
Nos compassos 37 a 42 o Tom muda para Dó♯ menor: F, C, G e D já são sustenidos.
[s…] = espera em silêncio (só para a voz começar no lugar certo)
{2 …} = duína: 2 colcheias no tempo de 3; {6:9 …} = 6 colcheias no tempo de 9; ~ = ligadura

Compasso 1 (Andante très expressif):
MD:  [p1/4]; 5F[n1/8], 5A[n1/8]~ 5F[n1/4.], 5A[n1/4.]; 5D[n1/4.], 5F[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  [p1/8]; 4F[n1/4], 4A[n1/4]~ 4F[n1/2.], 4A[n1/2.];
ME2: [s1/2.]; [s1/4.];

Compasso 2:
MD:  5D[n1/8], 5F[n1/8]; 5C[n1/8], 5E[n1/8]; 5D[n1/8], 5F[n1/8]; 5C[n1/2.], 5E[n1/2.]~
MD2: [s1/2.]; [s1/4.];
ME:  4G[n1/2.], 4Bbb[n1/2.]~ 4G[n1/4.], 4Bbb[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 3:
MD:  5C[n1/8], 5E[n1/8]; 4B[n1/8], 5D[n1/8]; 5C[n1/8], 5E[n1/8]; {2 5D[n1/8]; 5F[n1/8]~} {2 5F[n1/8]; 5D[n1/8]~}
MD2: [s1/4.]; 4B[n1/2.]~
ME:  4F[n1/2.], 4A[n1/2.]~ 4F[n1/4.], 4A[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 4:
MD:  5D[n1/8]; 4A[n1/8], 5C[n1/8]; 4B[n1/8], 5D[n1/8]; 4A[n1/2.], 5C[n1/2.]~
MD2: 4B[n1/8]; [s1];
ME:  4E[n1/2.], 4G[n1/2.]~ 4E[n1/4.], 4G[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 5:
MD:  5C[n1/8]; 4B[n1/8]; 5C[n1/8]; 4B[n1/8]; 5E[n1/8]; 4B[n1/8]; 4A[n1/8]; 4B[n1/8]; 4A[n1/8]~
MD2: 4G[n1/2.]; 4G[n1/4.];
ME:  4E[n1/2.]; 4E[n1/4.];
ME2: 4D[n1/2.]; 4C[n1/4.];

Compasso 6:
MD:  4A[n1/8]; 4G[n1/8]; 4A[n1/8]; 4G[n1/4.]; 4F[n1/4.]~
MD2: 4E[n1/2.]; 4E[n1/4.];
ME:  4D[n1/2.]; 4C[n1/4.];
ME2: 3B[n1/2.]; 3A♮[n1/4.];

Compasso 7 (a mão esquerda passa para a clave de Fá):
MD:  4F[n1/8]; 4F[n1/8]; 4G[n1/8]; 4F[n1/8]; 4B[n1/8]; 4F[n1/8]; 4E[n1/8]; 4F[n1/8]; 4E[n1/8]~
MD2: 4D[n1/2.]~ 4D[n1/4.];
ME:  3B[n1/2.]~ 3B[n1/4.];
ME2: 3A[n1/2.]; 3G[n1/4.];

Compasso 8:
MD:  4E[n1/8]; 4D[n1/8]; 4E[n1/8]; 4D[n1/4.]; 4C[n1/4.];
MD2: 3B[n1/2.]; 3A[n1/4.];
ME:  3A[n1/2.]; 3G[n1/4.];
ME2: 3F[n1/2.]; {2 3E[n1/8]; 2A[n1/8]~}

Compasso 9 (volta o tema do começo; a mão esquerda faz um arpejo):
MD:  [p1/4.]; 5F[n1/4.], 5A[n1/4.]; 5D[n1/4.], 5F[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  [s1/2.]; [s1/4.];
ME2: 2D[n1/8], 2A[n1/8]; 3F[n1/8], 3A[n1/8]; 4F[n1/8], 4A[n1/8]~ 4F[n1/2.], 4A[n1/2.];

Compasso 10:
MD:  5D[n1/8], 5F[n1/8]; 5E[n1/8]; 5F[n1/8]; 5E[n1/2.]~
MD2: [p1/8]; 4G[n1/4], 4B[n1/4]~ 4G[n1/2.], 4B[n1/2.];
ME:  [p1/8]; 3D[n1/4], 3G[n1/4], 3B[n1/4], 4D[n1/4]~ 3D[n1/2.], 3G[n1/2.], 3B[n1/2.], 4D[n1/2.];
ME2: 2G[n1/2.], 3D[n1/2.]; [s1/4.];

Compasso 11:
MD:  5E[n1/8]; 5D[n1/8], 4D[n1/8]; 5E[n1/8], 4E[n1/8]; 5A[n1/4.], 5D[n1/4.], 4A[n1/4.]; 5F[n1/4.], 5D[n1/4.], 4F[n1/4.]~
MD2: [s1/8]; 4A[n1/4]; [s1/2.];
ME:  [p1/8]; 3F[n1/4], 3A[n1/4]; 4D[n1/4.], 4F[n1/4.]; 3A[n1/4.], 4D[n1/4.];
ME2: 2F[n1/2.], 3D[n1/2.]; [s1/4.];

Compasso 12:
MD:  5F[n1/8]; 5E[n1/8]; 5F[n1/8]; 5E[n1/4.]; 5D[n1/4.]~
MD2: [p1/8]; 4G[n1/4], 4B[n1/4]~ 4G[n1/2.], 4B[n1/2.];
ME:  [p1/8]; 3D[n1/4], 3G[n1/4], 3B[n1/4], 4D[n1/4]~ 3D[n1/2.], 3G[n1/2.], 3B[n1/2.], 4D[n1/2.];
ME2: 2G[n1/2.], 3D[n1/2.]; [s1/4.];

Compasso 13:
MD:  5D[n1/8]; 5D[n1/8], 4D[n1/8]; 5E[n1/8], 4E[n1/8]; {2 5B[n1/8], 4B[n1/8]; 5A[n1/8], 4A[n1/8]~} {2 5A[n1/8], 4A[n1/8]; 5F[n1/8], 4F[n1/8];}
MD2: [s1/8]; 4A[n1/4]; 5F[n1/2.];
ME:  [p1/8]; 3F[n1/4], 4C♭[n1/4]; 4C♭[n1/4.], 4D[n1/4.], 4F[n1/4.]~ 4C♭[n1/8], 4D[n1/8], 4F[n1/8]; [p1/8]; [p1/8];
ME2: 2A[n1/2.]~ 2A[n1/4.];

Compasso 14:
MD:  5F[n1/8]; 5E[n1/8]; 5F[n1/8]; {2 5E[n1/8]; 5D[n1/8]~} {2 5D[n1/8]; 4B[n1/8];}
MD2: [p1/8]; 4F[n1/4], 4B[n1/4]~ 4F[n1/2.], 4B[n1/2.];
ME:  [p1/8]; 4E[n1/4]~ {2 4E[n1/8]; 4D[n1/8]~} 4D[n1/4.];
ME2: 2B[n1/8]~ 2B[n1/4], 3F[n1/4], 3B[n1/4]~ 2B[n1/4.], 3F[n1/4.], 3B[n1/4.]~ 3F[n1/4.], 3B[n1/4.];

Compasso 15 (Tempo rubato: a melodia em oitavas, com acordes):
MD:  {2 [p1/8]; 5F[n1/8], 5B[n1/8], 6F[n1/8]~} 5F[n1/8], 5B[n1/8], 6F[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  {2 [p1/8]; 4F[n1/8], 4G[n1/8], 4B[n1/8]~} 4F[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8];
ME2: 2E[n1/2.], 1E[n1/2.]; [s1/4.];

Compasso 16:
MD:  5D[n1/8], 5B[n1/8], 6D[n1/8]; 5C[n1/8], 5G[n1/8], 5B[n1/8], 6C[n1/8]; 5C[n1/8], 5G[n1/8], 5B[n1/8], 6C[n1/8]; {2 5C[n1/8], 5G[n1/8], 5B[n1/8], 6C[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8];} 4B[n1/4.], 5G[n1/4.], 5B[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  4D[n1/8], 4G[n1/8], 4B[n1/8]; 4C[n1/8], 4G[n1/8], 4B[n1/8]; 4C[n1/8], 4G[n1/8], 4B[n1/8]; {2 4C[n1/8], 4G[n1/8], 4B[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8];} 3B[n1/4.], 4D[n1/4.], 4G[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 17:
MD:  {2 [p1/8]; 5F[n1/8], 5B[n1/8], 6F[n1/8]~} 5F[n1/8], 5B[n1/8], 6F[n1/8]; 5G[n1/8], 5B[n1/8], 6G[n1/8]; 5F[n1/8], 5B[n1/8], 6F[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8]; 5F[n1/8], 5B[n1/8], 6F[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8];
MD2: 2B[n1/2.]; [s1/4.];
ME:  {2 [p1/8]; 4F[n1/8], 4G[n1/8], 4B[n1/8]~} 4F[n1/8], 4G[n1/8], 4B[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8]; 4F[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8]; 4F[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8];
ME2: 2E[n1/2.], 1E[n1/2.]; [s1/4.];

Compasso 18:
MD:  5D[n1/8], 5B[n1/8], 6D[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8]; {2 5B[n1/8], 6C[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8];} 4B[n1/4.], 5G[n1/4.], 5B[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  4D[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8]; {2 4C[n1/8], 4G[n1/8], 4B[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8];} 3B[n1/4.], 4E[n1/4.], 4G[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 19 (peu à peu cresc. et animé (aos poucos, mais forte e mais animado)):
MD:  {6:9 4B[n1/8], 5G[n1/8], 5B[n1/8]; 4G[n1/8], 5G[n1/8]; 4A[n1/8], 5E[n1/8], 5A[n1/8]; 5C[n1/8], 6C[n1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 4G[n1/8], 5G[n1/8];}
MD2: [s1/2.]; [s1/4.];
ME:  [p1/8.]; {6:9 3G[n1/8]; 3A[n1/8]; 4C[n1/8]; 3B[n1/8]; 3G[n1/8];}
ME2: 2A[n1/4.], 1A[n1/4.]~ 2A[n1/4.], 1A[n1/4.], 4C[n1/4.], 4E[n1/4.]; 4E[n1/4.], 4G[n1/4.];

Compasso 20:
MD:  [p1/8]; 4G[n1/8], 5C[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 5C[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 5C[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 5C[n1/8], 5E[n1/8], 5G[n1/8]; 4A[n1/8], 5C[n1/8], 5E[n1/8], 5A[n1/8]; 4G[n1/4.], 5C[n1/4.], 5E[n1/4.], 5G[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  [p1/8]; 3G[n1/8], 4C[n1/8], 4E[n1/8]; 3G[n1/8], 4C[n1/8], 4E[n1/8]; 3G[n1/8], 4C[n1/8], 4E[n1/8]; 3G[n1/8], 4C[n1/8], 4E[n1/8]; 3A[n1/8], 4C[n1/8], 4E[n1/8]; 3G[n1/4.], 4C[n1/4.], 4E[n1/4.];
ME2: 2Bbb[n1/2.], 1Bbb[n1/2.]; [s1/4.];

Compasso 21:
MD:  [p1/8.]; {6:9 4G[n1/8], 5G[n1/8]; 4A[n1/8], 5A[n1/8]; 5D[n1/8], 6D[n1/8]; 4B[n1/8], 5B[n1/8]; 4G[n1/8], 5G[n1/8];}
MD2: [s1/8.]; 5D[n1/4.]; [s1/8.]; 5G[n1/4.];
ME:  [p1/8.]; {6:9 3G[n1/8]; 3A[n1/8]; 4D[n1/8]; 3B[n1/8]; 3G[n1/8];}
ME2: 2B[n1/8.], 1B[n1/8.]~ 2B[n1/4.], 1B[n1/4.], 3B[n1/4.], 4D[n1/4.]~ 2B[n1/8.], 1B[n1/8.]; 4D[n1/4.], 4G[n1/4.];

Compasso 22:
MD:  [p1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8], 5G[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8], 5G[n1/8]; 4A[n1/8], 5C[n1/8], 5F[n1/8], 5A[n1/8]; 4G[n1/4.], 4B[n1/4.], 5E[n1/4.], 5G[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  [p1/8]; 3G[n1/8], 3B[n1/8], 4E[n1/8]; 3G[n1/8], 3B[n1/8], 4E[n1/8]; 3G[n1/8], 3B[n1/8], 4E[n1/8]; 3G[n1/8], 3B[n1/8], 4E[n1/8]; 3A[n1/8], 4C[n1/8], 4F[n1/8]; 3G[n1/4.], 3B[n1/4.], 4E[n1/4.];
ME2: 2A[n1/2.], 1A[n1/2.]; [s1/4.];

Compasso 23:
MD:  [p1/8.]; {6:9 4G[n1/8], 5G[n1/8]; 4A[n1/8], 5A[n1/8]; 5E[n1/8], 6E[n1/8]; 5D[n1/8], 6D[n1/8]; 4B[n1/8], 5B[n1/8];}
MD2: [s1/8.]; 4B[n1/2], 5D[n1/2]~ 4B[n1/16], 5D[n1/16]; 5G[n1/4.], 5B[n1/4.];
ME:  [p1/8.]; {6:9 3G[n1/8]; 3A[n1/8]; 4E[n1/8]; 4D[n1/8]; 3B[n1/8];}
ME2: 3D[n1/8.], 2D[n1/8.]~ 3D[n1/4.], 2D[n1/4.], 3B[n1/4.], 4D[n1/4.]~ 3D[n1/8.], 2D[n1/8.], 3B[n1/8.], 4D[n1/8.]; 4G[n1/4.], 4B[n1/4.];

Compasso 24:
MD:  [p1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 5C[n1/8], 5A[n1/8], 6C[n1/8]; 4B[n1/8], 5G[n1/8], 5B[n1/8]; 5D[n1/8], 5B[n1/8], 6D[n1/8]; 5E[n1/8], 5B[n1/8], 6E[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  [p1/8]; 3B[n1/8], 4D[n1/8], 4G[n1/8]; 3B[n1/8], 4D[n1/8], 4G[n1/8]; 3B[n1/8], 4D[n1/8], 4G[n1/8]; 3B[n1/8], 4D[n1/8], 4G[n1/8]; 4C[n1/8], 4E[n1/8], 4A[n1/8]; 3B[n1/8], 4D[n1/8], 4G[n1/8]; 4D[n1/8], 4G[n1/8], 4B[n1/8]; 4E[n1/8], 4G[n1/8], 4B[n1/8];
ME2: 3E[n1/2.], 2E[n1/2.]; [s1/4.];

Compasso 25 (diminuendo molto: acordes arpejados):
MD:  5A[n1/2.], 6D[n1/2.], 6A[n1/2.]; 5A[n1/4.], 6D[n1/4.], 6A[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  4F[n1/2.], 4A[n1/2.], 5D[n1/2.], 5F[n1/2.]; 4F♭[n1/4.], 4A[n1/4.], 4B[n1/4.], 5D[n1/4.], 5F♭[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 26:
MD:  5A[n1/2.], 6D[n1/2.], 6A[n1/2.]; 4A[n1/4.], 5E[n1/4.], 5A[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  4E[n1/2.], 4G[n1/2.], 4A[n1/2.], 5D[n1/2.], 5E[n1/2.]; 3A[n1/4.], 4E[n1/4.], 4G[n1/4.], 5C[n1/4.];
ME2: [s1/2.]; [s1/4.];

Compasso 27 (Un poco mosso: a mão esquerda em arpejos de semicolcheias):
MD:  4F[n1/2.], 4A[n1/2.]; 4A[n1/4], 5C♭[n1/4]; 5D[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16]; 2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 2A[n1/16]; 3F♭[n1/16]; 3A[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4A[n1/16];
ME2: 2D[n1/4.]; 2F[n1/4.]; 2A[n1/4.];

Compasso 28:
MD:  4F[n1/2.], 4A[n1/2.]; 4A[n1/4], 5C♭[n1/4]; 4A[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16]; 2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 2A[n1/16]; 3F♭[n1/16]; 3A[n1/16]; 4C♭[n1/16]; 4A[n1/16]; 4F♭[n1/16];
ME2: 2D[n1/4.]; 2F[n1/4.]; 2A[n1/4.];

Compasso 29:
MD:  4F[n1/4], 5D[n1/4]; 4A[n1/8], 5E[n1/8]; 5D[n1/4.], 5F[n1/4.]; 4F[n1/4], 5D[n1/4]; 5D[n1/8], 5F[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 4F[n1/16]; 4D[n1/16]; 3A[n1/16]; 3F[n1/16]; 3A[n1/16]; 3F[n1/16]; 3D[n1/16]; 2A[n1/16]; 3D[n1/16]; 2A[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 30:
MD:  5E[n1/8], 5G♮[n1/8]; 5D[n1/8], 5F[n1/8]; 4B[n1/8], 5D[n1/8]; 4B[n1/4.], 5D[n1/4.]; [p1/4.];
MD2: [s1/4.]; 4G♮[n1/8]; 4F[n1/8]; 4D[n1/8]; 4D[n1/8.]; 3B[n1/8.];
ME:  2E[n1/16]; 2B[n1/16]; 3E[n1/16]; 3G♮[n1/16]; 3B[n1/16]; 4E[n1/16]; 4G♮[n1/16]; 4E[n1/16]; 3B[n1/16]; 3G♮[n1/16]; 3E[n1/16]; 2B[n1/16]; 2E[n1/16]; 2B[n1/16]; 3E[n1/16]; 3G♮[n1/16]; 3E[n1/16]; 2B[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 31:
MD:  4B[n1/2.]; 5C[n1/4]; 5F[n1/8];
MD2: [s1/2.]; [s1/4]; 4A[n1/16]; 4F[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3G[n1/16]; 3B[n1/16]; 4C[n1/16]; 4G[n1/16]; 2G[n1/16]; 3D[n1/16]; 3G[n1/16]; 3B[n1/16]; 4D[n1/16]; 4G[n1/16]; 2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/8];
ME2: 2A[n1/4.]; 2G[n1/4.]; 2F[n1/4.];

Compasso 32:
MD:  4B[n1/2.]; 5C[n1/4]; 5F[n1/8];
MD2: [s1/2.]; [s1/4]; 4A[n1/16]; 4F[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3G[n1/16]; 3B[n1/16]; 4C[n1/16]; 4G[n1/16]; 2G[n1/16]; 3D[n1/16]; 3G[n1/16]; 3B[n1/16]; 4D[n1/16]; 4G[n1/16]; 2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/8];
ME2: 2A[n1/4.]; 2G[n1/4.]; 2F[n1/4.];

Compasso 33 (a melodia passa para as duas mãos):
MD:  5G[n1/4.]~ 5G[n1/8.]; 5F[n1/8.]; 5D♮[n1/8.]; 5E[n1/8.];
MD2: [s1/4.]; 5G[n1/16]; 4G[n1/16]; 4B[n1/16]; 5F[n1/16]; 4G[n1/16]; 4B[n1/16]; 5D♮[n1/16]; 4G[n1/16]; 4B[n1/16]; 5E[n1/16]; 4G[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 2B[n1/16]; 3E[n1/16]; 3G[n1/16]; 3B[n1/16]; 4E[n1/16]; [s1/2.];
ME2: 2E[n1/4.]; 4G[n1/8.]; 4F[n1/8.]; 4D♮[n1/8.]; 4E[n1/8.];

Compasso 34:
MD:  5B[n1/2.]; 5A[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  4D♮[n1/16]; 4G[n1/16]; 4B[n1/16]; 4B[n1/16]; 5G[n1/16]; 5B[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 4B[n1/16]; 5G[n1/16]; 5B[n1/16]; 4C[n1/16]; 4E♮[n1/16]; 4A[n1/16]; 5C[n1/16]; 5E♮[n1/16]; 5A[n1/16];
ME2: 4D♮[n1/4.]; 4E[n1/4.]; 3A[n1/4.];

Compasso 35 (o tema do compasso 27, uma oitava acima (cresc.)):
MD:  5F[n1/2.], 5A[n1/2.]; 5A[n1/4], 6C♭[n1/4]; 6D[n1/8];
MD2: [s1/8]; [s1];
ME:  3D[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 5D[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4A[n1/16]; 5C♭[n1/16]; 5F♭[n1/16]; 5A[n1/16];
ME2: 3D[n1/4.]; 3F[n1/4.]; 3A[n1/4.];

Compasso 36:
MD:  5F[n1/2.], 5A[n1/2.]; 5A[n1/4], 6C♭[n1/4]; 5A[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  3D[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 5D[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4A[n1/16]; 5C♭[n1/16]; 5A[n1/16]; 5F♭[n1/16];
ME2: 3D[n1/4.]; 3F[n1/4.]; 3A[n1/4.];

Tom: Dó♯ menor  (armadura de 4 sustenidos)

Compasso 37 (En animant: mais animado, em Dó♯ menor):
MD:  6C[n1/4]; 5G[n1/8]; 6E[n1/4]; 6C[n1/8]; 6G[n1/4]; 6E[n1/8];
MD2: 6C[n1/8.]; 5C[n1/16]; 5G[n1/16]; 5E[n1/16]; 6E[n1/8.]; 5E[n1/16]; 6C[n1/16]; 5G[n1/16]; 6G[n1/8.]; 5G[n1/16]; 6E[n1/16]; 5B[n1/16];
ME:  4C[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/8.]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 5C[n1/8.]; 4G[n1/16]; 4B[n1/16]; 5C[n1/16]; 5E[n1/8.];
ME2: 3B[n1/4.]; 4C[n1/4.]; 4E[n1/4.];

Compasso 38:
MD:  6G[n1/4.]; 6F[n1/2.];
MD2: [s1/2.]; [s1/4.];
ME:  4G[n1/16]; 4A[n1/16]; 5C[n1/16]; 5G[n1/16]; 6C[n1/16]; 5A[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 6C[n1/16]; 5A[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 6C[n1/16]; 5A[n1/16];
ME2: 4G[n1/4.]; 4F[n1/4.]; 4E♯[n1/4.];

Compasso 39:
MD:  6F[n1/2.]; 6A[n1/4]; 7C[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 6C[n1/16]; 5A[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 6C[n1/16]; 5A[n1/16]; 4E[n1/16]; 4A[n1/16]; 5C[n1/16]; 5E[n1/16]; 6C[n1/16]; 5C[n1/16];
ME2: 4E[n1/4.]; 4D[n1/4.]; 4C[n1/4.];

Compasso 40:
MD:  5F[n1/2.]; 5A[n1/4]; 6C[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  3B[n1/16]; 4D[n1/16]; 4F[n1/16]; 4F[n1/16]; 5C[n1/16]; 4A[n1/16]; 3A[n1/16]; 4C[n1/16]; 4E[n1/16]; 4F[n1/16]; 5C[n1/16]; 4A[n1/16]; 3G[n1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16]; 5E[n1/16]; 5A[n1/16];
ME2: 3B[n1/4.]; 3A[n1/4.]; 3G[n1/4.];

Compasso 41 (f: a melodia desce em terças):
MD:  6C[n1/8], 6E[n1/8]; 5B[n1/8], 6D[n1/8]; 5A[n1/8], 6C[n1/8]; {2 5G[n1/8], 5B[n1/8]; 5F[n1/8], 5A[n1/8]~} 5F[n1/8], 5A[n1/8]; 5E[n1/8], 5G[n1/8]; 5D[n1/8], 5F[n1/8];
MD2: [s1/2.]; [s1/4.];
ME:  3F[n1/16]; 4C[n1/16]; 4E[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5E[n1/16]; 5F[n1/16]; 5E[n1/16]; 5C[n1/16]; 4A[n1/16]; 4F[n1/16]; 4E[n1/16]; 4F[n1/16]; 4E[n1/16]; 4C[n1/16]; 3A[n1/16]; 3F[n1/16];
ME2: 3F[n1/2.]~ 3F[n1/4.];

Compasso 42:
MD:  5C[n1/8], 5E[n1/8]; 4B[n1/8], 5D[n1/8]; 4A[n1/8], 5C[n1/8]; 4G[n1/8], 4B[n1/8]; 4F[n1/8], 4A[n1/8]; 4E[n1/8], 4G[n1/8]~ 4E[n1/8], 4G[n1/8]; 4D[n1/8], 4F[n1/8]; 4C[n1/8], 4E[n1/8];
MD2: [s1/2.]; 3A[n1/4.];
ME:  2F[n1/16]; 3C[n1/16]; 3E[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/16]; 4E[n1/16]; 4C[n1/16]; 3A[n1/16]; 3F[n1/16]; 3E[n1/16]; 3C[n1/16]; 2F[n1/16]; 3C[n1/16]; 2F[n1/16]; 3C[n1/16]; 2F[n1/16]; 3C[n1/16];
ME2: [s1/2.]; [s1/4.];

Tom: Ré♭ maior  (volta a armadura de 5 bemóis)

Compasso 43 (Calmato: volta o Ré♭ maior):
MD:  4D[n1/2.], 4E[n1/2.]; 4E[n1/4], 4G[n1/4]; 4E[n1/8], 4G[n1/8], 4B[n1/8];
MD2: 3G[n1/4]; 3A[n1/8]; 3B[n1/4]; 4D[n1/8]; 4C[n1/4.];
ME:  2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 44:
MD:  4D[n1/2.], 4E[n1/2.]; 4E[n1/4], 4G[n1/4]; 4E[n1/8], 4G[n1/8], 4B[n1/8]~
MD2: 3G[n1/4]; 3A[n1/8]; 3B[n1/4]; 4D[n1/8]; 4C[n1/4.];
ME:  2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 45:
MD:  4D[n1/8], 4G[n1/8], 4B[n1/8]; 4A[n1/8], 5C[n1/8], 5F[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8]; 4G[n1/4.], 4B[n1/4.]; 4G[n1/4.], 4A[n1/4.];
MD2: [s1/4.]; 4D[n1/8]; 3B[n1/8]; 4D[n1/8]; 3B[n1/8]; 4C[n1/8]; 4E[n1/8];
ME:  2A[n1/16]; 2E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 4E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 2E[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 46:
MD:  4D[n1/8], 4G[n1/8], 4B[n1/8]; 4A[n1/8], 5C[n1/8], 5F[n1/8]; 4G[n1/8], 4B[n1/8], 5E[n1/8]; 4G[n1/4.], 4B[n1/4.]; 4G[n1/4.], 4A[n1/4.];
MD2: [s1/4.]; 4D[n1/8]; 3B[n1/8]; 4D[n1/8]; 3B[n1/8]; 4C[n1/8]; 4E[n1/8];
ME:  2A[n1/16]; 2E[n1/16]; 2A[n1/16]; 3E[n1/16]; 2A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 4E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16]; 3A[n1/16]; 3E[n1/16];
ME2: [s1/2.]; [s1/4.];

Compasso 47:
MD:  5E[n1/2.]; 5G[n1/4]; 5B[n1/8];
MD2: 5E[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 4G[n1/16]; 4E[n1/16]; [p1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 4G[n1/16]; 4E[n1/16]; [s1/4.];
ME:  4D[n1/2.]; 4C[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 5C[n1/16]; 5E[n1/16];
ME2: 3G[n1/4]; 3A[n1/8]; 3B[n1/4]; 4D[n1/8]; 4C[n1/4.];

Compasso 48:
MD:  5E[n1/2.]; 5G[n1/4]; 5B[n1/8];
MD2: 5E[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 4G[n1/16]; 4E[n1/16]; [p1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 4G[n1/16]; 4E[n1/16]; [s1/4.];
ME:  4D[n1/2.]; 4C[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 5C[n1/16]; 5E[n1/16];
ME2: 3G[n1/4]; 3A[n1/8]; 3B[n1/4]; 4D[n1/8]; 4C[n1/4.];

Compasso 49:
MD:  6E[n1/2.]~ 6E[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  4G[n1/16]; 4B[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 5B[n1/16]; 4G[n1/16]; 4B[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 6C[n1/16]; 4G[n1/16]; 4B[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 5B[n1/16];
ME2: 4G[n1/2.]~ 4G[n1/4.];

Compasso 50:
MD:  6E[n1/4.]; 6D[n1/4.]; 6E[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  4G[n1/16]; 4A♮[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 5A♮[n1/16]; 4G[n1/16]; 4A♮[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 6C♭[n1/16]; 4G[n1/16]; 4A♮[n1/16]; 5D[n1/16]; 5E[n1/16]; 5G[n1/16]; 5A♮[n1/16];
ME2: 4G[n1/2.]~ 4G[n1/4.];

Compasso 51 (a Tempo 1º: volta o tema do começo, ppp):
MD:  [p1/4.]; 6F[n1/4.], 6A[n1/4.]; 6F[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 5A[n1/16]; 6C[n1/16]; [s1/4.]; [p1/4.];
ME2: 4F[n1/2.]; 4F[n1/4.];

Compasso 52:
MD:  6F[n1/8]; 6C[n1/8], 6E[n1/8]; 6D[n1/8], 6F[n1/8]; 6C[n1/2.], 6E[n1/2.]~
MD2: [s1/2.]; [s1/4.];
ME:  4F[n1/16]; 4A♮[n1/16]; 5C[n1/16]; 5E[n1/16]; 5F[n1/16]; 5A♮[n1/16]; [p1/4.]; [p1/4.];
ME2: 4F[n1/2.]; 4F[n1/4.];

Compasso 53:
MD:  6C[n1/8], 6E[n1/8]; 5B[n1/8], 6D[n1/8]; 6C[n1/8], 6E[n1/8]; {2 5B[n1/8], 6D[n1/8]; 6D[n1/8], 6F[n1/8]~} {2 6D[n1/8], 6F[n1/8]; 5B[n1/8], 6D[n1/8]~}
MD2: [s1/4.]; 5B[n1/2.]~
ME:  4F[n1/16]; 4A[n1/16]; 4B[n1/16]; 5D[n1/16]; 5F[n1/16]; 5A[n1/16]; [p1/4.]; [p1/4.];
ME2: 4F[n1/2.]; 4F[n1/4.];

Compasso 54:
MD:  5B[n1/8], 6D[n1/8]; 5A[n1/8], 6C[n1/8]; 5B[n1/8], 6D[n1/8]; 5A[n1/2.], 6C[n1/2.];
MD2: 5B[n1/8]; [s1];
ME:  4E[n1/16]; 4G[n1/16]; 4A[n1/16]; 5C[n1/16]; 5E[n1/16]; 5G[n1/16]; [p1/4.]; [p1/4.];
ME2: 4E[n1/2.]; 4E[n1/4.];

Compasso 55:
MD:  [p1/8]; 5G[n1/8], 5B[n1/8]; 5A[n1/8], 6C[n1/8]; 5B[n1/8]; 6E[n1/8]; 5B[n1/8]; 5A[n1/8]; 5B[n1/8]; 5A[n1/8]~
MD2: [s1/4.]; 5G[n1/4.]; 5F[n1/4.]~
ME:  4D[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/16]; 5D[n1/16]; 5E[n1/16]; [p1/4.]; 4C[n1/4.], 4E[n1/4.], 4F[n1/4.], 4A[n1/4.], 5C[n1/4.];
ME2: 4D[n1/2.]; 4C[n1/4.];

Compasso 56:
MD:  5A[n1/8]; 5E[n1/8], 5G[n1/8]; 5F[n1/8], 5A[n1/8]; 5E[n1/4.], 5G[n1/4.]; 5F[n1/4.], 4A♮[n1/4.]~
MD2: 5F[n1/8]; [s1];
ME:  3C[n1/16]; 3G[n1/16]; 3B[n1/16]; 4C[n1/16]; 4E[n1/16]; 4G[n1/16]; 4B[n1/4.]; 4C[n1/4.], 4E[n1/4.];
ME2: 3C[n1/2.]; 3F[n1/4.];

Compasso 57:
MD:  5F[n1/8]; 5D[n1/8], 5F[n1/8]; 5E[n1/8], 5G[n1/8]; 5F[n1/8]; 5B[n1/8]; 5F[n1/8]; 5E[n1/8]; 5F[n1/8]; 5E[n1/8]~
MD2: [s1/4.]; 5D[n1/4.]; 5D[n1/4.];
ME:  3A[n1/16]; 3B[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 4B[n1/16]; [p1/4.]; 3G[n1/4.], 3B[n1/4.], 4D[n1/4.], 4E[n1/4.];
ME2: 3A[n1/2.]; 3G[n1/4.];

Compasso 58:
MD:  5E[n1/8]; 4B[n1/8], 5D[n1/8]; 5C[n1/8], 5E[n1/8]; 4B[n1/4.], 5D[n1/4.]; 4A[n1/4.], 5C[n1/4.];
MD2: [s1/2.]; [s1/4.];
ME:  3F[n1/16]; 3A[n1/16]; 3B[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; [p1/4.]; 3G[n1/4.], 4C[n1/4.];
ME2: 3F[n1/2.]; {2 3E[n1/8]; 2A[n1/8];}

Compasso 59 (o tema do compasso 9 de novo):
MD:  [p1/4.]; 5F[n1/4.], 5A[n1/4.]; 5D[n1/4.], 5F[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  2D[n1/8], 2A[n1/8]; 3F[n1/8], 3A[n1/8]; 4F[n1/8], 4A[n1/8]~ 4F[n1/2.], 4A[n1/2.];
ME2: [s1/4.]; 4C♭[n1/2.];

Compasso 60:
MD:  5D[n1/8], 5F[n1/8]; 5E[n1/8]; 5F[n1/8]; 5E[n1/2.]~
MD2: [p1/8]; 4G[n1/4], 4B[n1/4]~ 4G[n1/2.], 4B[n1/2.];
ME:  [p1/8]; 3D[n1/4], 3G[n1/4], 3B[n1/4], 4D[n1/4]~ 3D[n1/2.], 3G[n1/2.], 3B[n1/2.], 4D[n1/2.];
ME2: 2G[n1/2.], 3D[n1/2.]; [s1/4.];

Compasso 61:
MD:  5E[n1/8]; 5D[n1/8], 4D[n1/8]; 5E[n1/8], 4E[n1/8]; 5A[n1/4.], 5F[n1/4.], 4A[n1/4.]; 5F[n1/4.], 5D[n1/4.], 4F[n1/4.]~
MD2: [p1/8]; 4A[n1/4]; [s1/2.];
ME:  [p1/8]; 3F[n1/4], 3A[n1/4]; 4D[n1/4.], 4F[n1/4.]; 4D[n1/4.];
ME2: 2A[n1/4.]~ 2A[n1/4.], 4C♭[n1/4.]~ 4C♭[n1/4.];

Compasso 62:
MD:  5F[n1/8]; 5E[n1/8]; 5F[n1/8]; 5E[n1/4.]; 5D[n1/4.];
MD2: [p1/8]; 4F[n1/4], 4B[n1/4]~ 4F[n1/2.], 4B[n1/2.];
ME:  [p1/8]; 4E[n1/4]~ 4E[n1/4.]; 4D[n1/4.];
ME2: 2B[n1/8]~ 2B[n1/4], 3F[n1/4], 3B[n1/4]~ 2B[n1/4.], 3F[n1/4.], 3B[n1/4.]~ 3F[n1/4.], 3B[n1/4.];

Compasso 63:
MD:  [p1/8]; 4D[n1/8]; 4E[n1/8]; 4F[n1/4.], 4B[n1/4.]; 4F[n1/4.], 4D[n1/4.], 3A[n1/4.];
MD2: [s1/8]; 3A[n1/4]; 4D[n1/4.]; [s1/4.];
ME:  [s1/2.]; [s1/4.];
ME2: 2F[n1/2.]~ 2F[n1/4.];

Compasso 64:
MD:  [p1/8]; 4G[n1/8]; 4A[n1/8]; 4B[n1/4.], 5D[n1/4.]; 4B[n1/4.], 4G[n1/4.], 4D[n1/4.];
MD2: [s1/8]; 4D[n1/4], 3B[n1/4]; 4G[n1/4.]; [s1/4.];
ME:  [s1/2.]; [s1/4.];
ME2: 2E[n1/4.]; 3E[n1/4.]; 4E[n1/4.];

Compasso 65:
MD:  [p1/8]; 4B[n1/8]; 5C[n1/8]; 5C[n1/4.], 5F[n1/4.]; 4A[n1/4.], 4G[n1/4.], 4C[n1/4.];
MD2: [s1/8]; 4G[n1/4], 4C[n1/4]; 4A[n1/4.]; [s1/4.];
ME:  {2 2A[n1/8]; 3E[n1/8];} 5A[n1/4.]; 3A[n1/4.];
ME2: 2A[n1/2.]; [s1/4.];

Compasso 66 (morendo jusqu'à la fin (sumindo até o fim)):
MD:  [p1/4]; [s1/8]; [p1/4]; [s1/8]; [p1/4]; [s1/8];
MD2: [s1/2.]; [s1/4.];
ME:  2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16]; 2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16];
ME2: 2D[n1/4.]; 2F[n1/4.]; 2D[n1/4.];

Compasso 67:
MD:  [p1/4]; [s1/8]; 5C♭[n1/4.]; 5D[n1/4.];
MD2: [s1/4]; [s1/8]; 4A[n1/4.]; 4F♭[n1/4.];
ME:  2F[n1/16]; 3C[n1/16]; 3F[n1/16]; 3A[n1/16]; 4C[n1/16]; 4F[n1/16]; 2A[n1/16]; 3F♭[n1/16]; 3A[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4G[n1/16]; 4A[n1/4.];
ME2: 2F[n1/4.]; 2A[n1/2.];

Compasso 68:
MD:  [p1/4]; [s1/8]; [p1/4]; [s1/8]; [p1/4]; [s1/8];
MD2: [s1/2.]; [s1/4.];
ME:  3D[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 5D[n1/16]; 3F[n1/16]; 4C[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 3D[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/16]; 4A[n1/16]; 5D[n1/16];
ME2: 3D[n1/4.]; 3F[n1/4.]; 3D[n1/4.];

Compasso 69:
MD:  [p1/4]; [s1/8]; 6C♭[n1/4.]; 6D[n1/4.];
MD2: [s1/4]; [s1/8]; 5A[n1/2.];
ME:  3F[n1/16]; 4C[n1/16]; 4F[n1/16]; 4A[n1/16]; 5C[n1/16]; 5F[n1/16]; 3A[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4A[n1/16]; 5C♭[n1/16]; 5F♭[n1/16]~ 5F♭[n1/4.];
ME2: 3F[n1/4.]; 3A[n1/2.];

Compasso 70:
MD:  6C♭[n1/4.]; 6D[n1/4.]; 6F♭[n1/4.];
MD2: 5A[n1/2.]; [s1/4.];
ME:  3A[n1/16]; 4C♭[n1/16]; 4F♭[n1/16]; 4A[n1/16]; 5C♭[n1/16]; 5F♭[n1/16]~ 5F♭[n1/4.]; 2A[n1/4.];
ME2: 3A[n1/2.]; [s1/4.];

Compasso 71:
MD:  [s1/2.]; [s1/4.];
MD2: 6F[n1/2.], 6A[n1/2.]~ 6F[n1/4.], 6A[n1/4.];
ME:  2D[n1/16]; 2A[n1/16]; 3D[n1/16]; 3F[n1/16]; 3A[n1/16]; 4D[n1/16]; 4F[n1/8]; 4A[n1/8]; 5D[n1/8]; 5F[n1/8]; 5A[n1/8]; 6D[n1/8];
ME2: 2D[n1/2.]; [s1/4.];

Compasso 72 (acorde final):
MD:  [s1/2.]; [s1/4.];
MD2: 5A[n1/2.], 6D[n1/2.], 6F[n1/2.], 6A[n1/2.]; [p1/4.];
ME:  4D[n1/2.], 4A[n1/2.], 5D[n1/2.], 5F[n1/2.]; [p1/4.];
ME2: [s1/2.]; [s1/4.];

Fim

Observação: a peça inteira (72 compassos). A linha "Tom:" no meio do texto troca a
armadura dali em diante (compassos 37 e 43). As mudanças de andamento (Tempo rubato,
animé, Un poco mosso, En animant, Calmato, a Tempo) e o pedal não estão no texto. Na
partitura, a mão esquerda às vezes usa a clave de Sol e o 8va; aqui ela fica na clave de
Fá da pauta dupla e as notas aparecem na altura real (por isso as linhas suplementares).
`;

    // Músicas para aprender (iguais aos arquivos da pasta musicas/), da mais fácil à mais difícil.
    const SONG_BRILHA = `Música: Brilha, brilha, estrelinha – canção tradicional
Nível: muito fácil (a mão esquerda só toca uma nota de cada vez)
Compasso: 4/4
Andamento: semínima = 100

Dica: comece praticando só a mão direita (MD). A melodia usa as 6 primeiras
notas do Dó central: Dó, Ré, Mi, Fá, Sol, Lá.

Compasso 1 (Brilha, brilha, estrelinha):
MD:  4C[n1/4]; 4C[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3C[n1];

Compasso 2:
MD:  4A[n1/4]; 4A[n1/4]; 4G[n1/2];
ME:  3F[n1/2]; 3C[n1/2];

Compasso 3:
MD:  4F[n1/4]; 4F[n1/4]; 4E[n1/4]; 4E[n1/4];
ME:  3F[n1/2]; 3C[n1/2];

Compasso 4:
MD:  4D[n1/4]; 4D[n1/4]; 4C[n1/2];
ME:  3G[n1/2]; 3C[n1/2];

Compasso 5 (Lá no alto, lá no céu):
MD:  4G[n1/4]; 4G[n1/4]; 4F[n1/4]; 4F[n1/4];
ME:  3C[n1/2]; 3F[n1/2];

Compasso 6:
MD:  4E[n1/4]; 4E[n1/4]; 4D[n1/2];
ME:  3C[n1/2]; 3G[n1/2];

Compasso 7:
MD:  4G[n1/4]; 4G[n1/4]; 4F[n1/4]; 4F[n1/4];
ME:  3C[n1/2]; 3F[n1/2];

Compasso 8:
MD:  4E[n1/4]; 4E[n1/4]; 4D[n1/2];
ME:  3C[n1/2]; 3G[n1/2];

Compasso 9 (Brilha, brilha, estrelinha (de novo)):
MD:  4C[n1/4]; 4C[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3C[n1];

Compasso 10:
MD:  4A[n1/4]; 4A[n1/4]; 4G[n1/2];
ME:  3F[n1/2]; 3C[n1/2];

Compasso 11:
MD:  4F[n1/4]; 4F[n1/4]; 4E[n1/4]; 4E[n1/4];
ME:  3F[n1/2]; 3C[n1/2];

Compasso 12:
MD:  4D[n1/4]; 4D[n1/4]; 4C[n1/2];
ME:  3G[n1/2]; 3C[n1/2];
Fim
`;

    const SONG_IRMAO = `Música: Irmão João (Frère Jacques) – cânone tradicional
Nível: fácil
Compasso: 4/4
Andamento: semínima = 112

Cânone: a mão esquerda toca a mesma melodia uma oitava abaixo, começando 2
compassos depois — as duas vozes se encaixam. Pratique primeiro só a MD.

Compasso 1 (Irmão João, irmão João):
MD:  4C[n1/4]; 4D[n1/4]; 4E[n1/4]; 4C[n1/4];
ME:  [p1];

Compasso 2:
MD:  4C[n1/4]; 4D[n1/4]; 4E[n1/4]; 4C[n1/4];
ME:  [p1];

Compasso 3 (dormes tu? (a mão esquerda começa: Irmão João…)):
MD:  4E[n1/4]; 4F[n1/4]; 4G[n1/2];
ME:  3C[n1/4]; 3D[n1/4]; 3E[n1/4]; 3C[n1/4];

Compasso 4:
MD:  4E[n1/4]; 4F[n1/4]; 4G[n1/2];
ME:  3C[n1/4]; 3D[n1/4]; 3E[n1/4]; 3C[n1/4];

Compasso 5 (tocam os sinos):
MD:  4G[n1/8]; 4A[n1/8]; 4G[n1/8]; 4F[n1/8]; 4E[n1/4]; 4C[n1/4];
ME:  3E[n1/4]; 3F[n1/4]; 3G[n1/2];

Compasso 6:
MD:  4G[n1/8]; 4A[n1/8]; 4G[n1/8]; 4F[n1/8]; 4E[n1/4]; 4C[n1/4];
ME:  3E[n1/4]; 3F[n1/4]; 3G[n1/2];

Compasso 7 (dim, dom, dão):
MD:  4C[n1/4]; 3G[n1/4]; 4C[n1/2];
ME:  3G[n1/8]; 3A[n1/8]; 3G[n1/8]; 3F[n1/8]; 3E[n1/4]; 3C[n1/4];

Compasso 8:
MD:  4C[n1/4]; 3G[n1/4]; 4C[n1/2];
ME:  3G[n1/8]; 3A[n1/8]; 3G[n1/8]; 3F[n1/8]; 3E[n1/4]; 3C[n1/4];

Compasso 9 (a mão direita terminou; a esquerda acaba sozinha):
MD:  [p1];
ME:  3C[n1/4]; 2G[n1/4]; 3C[n1/2];

Compasso 10:
MD:  [p1];
ME:  3C[n1/4]; 2G[n1/4]; 3C[n1/2];
Fim
`;

    const SONG_PARABENS = `Música: Parabéns a você – canção tradicional (domínio público)
Nível: fácil
Compasso: 3/4
Andamento: semínima = 100

A música começa no fim do compasso (anacruse): o 1º compasso tem uma pausa
e só as duas notas "Pa-ra". A colcheia pontuada seguida da semicolcheia
é o ritmo "longo-curto" de "Pa-ra".

Compasso 1 (Pa-ra…):
MD:  [p1/2]; 4G[n1/8.]; 4G[n1/16];
ME:  [p1/2.];

Compasso 2 (…béns a vo-cê):
MD:  4A[n1/4]; 4G[n1/4]; 5C[n1/4];
ME:  3C[n1/2.];

Compasso 3:
MD:  4B[n1/2]; 4G[n1/8.]; 4G[n1/16];
ME:  2G[n1/2.];

Compasso 4 (nes-ta da-ta que-ri-da):
MD:  4A[n1/4]; 4G[n1/4]; 5D[n1/4];
ME:  2G[n1/2.];

Compasso 5:
MD:  5C[n1/2]; 4G[n1/8.]; 4G[n1/16];
ME:  3C[n1/2.];

Compasso 6 (mui-tas fe-li-ci-da-des):
MD:  5G[n1/4]; 5E[n1/4]; 5C[n1/4];
ME:  3C[n1/2.];

Compasso 7:
MD:  4B[n1/4]; 4A[n1/4]; 5F[n1/8.]; 5F[n1/16];
ME:  3F[n1/2.];

Compasso 8 (mui-tos a-nos de vi-da):
MD:  5E[n1/4]; 5C[n1/4]; 5D[n1/4];
ME:  3G[n1/2.];

Compasso 9:
MD:  5C[n1/2.];
ME:  3C[n1/2.];
Fim
`;

    const SONG_MINUETO = `Música: Minueto em Sol – atribuído a Christian Petzold (BWV Anh. 114)
Transcrição em texto: a peça inteira, com as repetições escritas (A A B B)
Nível: médio

Referência: Caderno de Anna Magdalena Bach (1725) — edição digital do Mutopia Project
(domínio público, a partir da edição da Bach-Gesellschaft). Os ornamentos (mordentes)
não estão no texto.
Tom: Sol maior
Compasso: 3/4
Andamento: semínima = 120

Com o Tom de Sol maior, F já é sustenido (Fá♯).
ME2 = 2ª voz da mão esquerda (só nos compassos 25, 26 e 29 de cada parte B).

Compasso 1 (parte A):
MD:  5D[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 5C[n1/8];
ME:  3G[n1/2], 3B[n1/2], 4D[n1/2]; 3A[n1/4];
ME2: [s1/2.];

Compasso 2:
MD:  5D[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/2.];
ME2: [s1/2.];

Compasso 3:
MD:  5E[n1/4]; 5C[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  4C[n1/2.];
ME2: [s1/2.];

Compasso 4:
MD:  5G[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/2.];
ME2: [s1/2.];

Compasso 5:
MD:  5C[n1/4]; 5D[n1/8]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8];
ME:  3A[n1/2.];
ME2: [s1/2.];

Compasso 6:
MD:  4B[n1/4]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8];
ME:  3G[n1/2.];
ME2: [s1/2.];

Compasso 7:
MD:  4F[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 4G[n1/8];
ME:  4D[n1/4]; 3B[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 8:
MD:  4A[n1/2.];
ME:  4D[n1/4]; 3D[n1/8]; 4C[n1/8]; 3B[n1/8]; 3A[n1/8];
ME2: [s1/2.];

Compasso 9:
MD:  5D[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 5C[n1/8];
ME:  3B[n1/2]; 3A[n1/4];
ME2: [s1/2.];

Compasso 10:
MD:  5D[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3G[n1/4]; 3B[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 11:
MD:  5E[n1/4]; 5C[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  4C[n1/2.];
ME2: [s1/2.];

Compasso 12:
MD:  5G[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/4]; 4C[n1/8]; 3B[n1/8]; 3A[n1/8]; 3G[n1/8];
ME2: [s1/2.];

Compasso 13:
MD:  5C[n1/4]; 5D[n1/8]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8];
ME:  3A[n1/2]; 3F[n1/4];
ME2: [s1/2.];

Compasso 14:
MD:  4B[n1/4]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8];
ME:  3G[n1/2]; 3B[n1/4];
ME2: [s1/2.];

Compasso 15:
MD:  4A[n1/4]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8]; 4F[n1/8];
ME:  4C[n1/4]; 4D[n1/4]; 3D[n1/4];
ME2: [s1/2.];

Compasso 16:
MD:  4G[n1/2.];
ME:  3G[n1/2]; 2G[n1/4];
ME2: [s1/2.];

Compasso 17 (parte A de novo):
MD:  5D[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 5C[n1/8];
ME:  3G[n1/2], 3B[n1/2], 4D[n1/2]; 3A[n1/4];
ME2: [s1/2.];

Compasso 18:
MD:  5D[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/2.];
ME2: [s1/2.];

Compasso 19:
MD:  5E[n1/4]; 5C[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  4C[n1/2.];
ME2: [s1/2.];

Compasso 20:
MD:  5G[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/2.];
ME2: [s1/2.];

Compasso 21:
MD:  5C[n1/4]; 5D[n1/8]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8];
ME:  3A[n1/2.];
ME2: [s1/2.];

Compasso 22:
MD:  4B[n1/4]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8];
ME:  3G[n1/2.];
ME2: [s1/2.];

Compasso 23:
MD:  4F[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 4G[n1/8];
ME:  4D[n1/4]; 3B[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 24:
MD:  4A[n1/2.];
ME:  4D[n1/4]; 3D[n1/8]; 4C[n1/8]; 3B[n1/8]; 3A[n1/8];
ME2: [s1/2.];

Compasso 25:
MD:  5D[n1/4]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8]; 5C[n1/8];
ME:  3B[n1/2]; 3A[n1/4];
ME2: [s1/2.];

Compasso 26:
MD:  5D[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3G[n1/4]; 3B[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 27:
MD:  5E[n1/4]; 5C[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  4C[n1/2.];
ME2: [s1/2.];

Compasso 28:
MD:  5G[n1/4]; 4G[n1/4]; 4G[n1/4];
ME:  3B[n1/4]; 4C[n1/8]; 3B[n1/8]; 3A[n1/8]; 3G[n1/8];
ME2: [s1/2.];

Compasso 29:
MD:  5C[n1/4]; 5D[n1/8]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8];
ME:  3A[n1/2]; 3F[n1/4];
ME2: [s1/2.];

Compasso 30:
MD:  4B[n1/4]; 5C[n1/8]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8];
ME:  3G[n1/2]; 3B[n1/4];
ME2: [s1/2.];

Compasso 31:
MD:  4A[n1/4]; 4B[n1/8]; 4A[n1/8]; 4G[n1/8]; 4F[n1/8];
ME:  4C[n1/4]; 4D[n1/4]; 3D[n1/4];
ME2: [s1/2.];

Compasso 32:
MD:  4G[n1/2.];
ME:  3G[n1/2]; 2G[n1/4];
ME2: [s1/2.];

Compasso 33 (parte B):
MD:  5B[n1/4]; 5G[n1/8]; 5A[n1/8]; 5B[n1/8]; 5G[n1/8];
ME:  3G[n1/2.];
ME2: [s1/2.];

Compasso 34:
MD:  5A[n1/4]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8]; 5D[n1/8];
ME:  3F[n1/2.];
ME2: [s1/2.];

Compasso 35:
MD:  5G[n1/4]; 5E[n1/8]; 5F[n1/8]; 5G[n1/8]; 5D[n1/8];
ME:  3E[n1/4]; 3G[n1/4]; 3E[n1/4];
ME2: [s1/2.];

Compasso 36:
MD:  5C#[n1/4]; 4B[n1/8]; 5C#[n1/8]; 4A[n1/4];
ME:  3A[n1/2]; 2A[n1/4];
ME2: [s1/2.];

Compasso 37:
MD:  4A[n1/8]; 4B[n1/8]; 5C#[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  3A[n1/2.];
ME2: [s1/2.];

Compasso 38:
MD:  5G[n1/4]; 5F[n1/4]; 5E[n1/4];
ME:  3B[n1/4]; 4D[n1/4]; 4C#[n1/4];
ME2: [s1/2.];

Compasso 39:
MD:  5F[n1/4]; 4A[n1/4]; 5C#[n1/4];
ME:  4D[n1/4]; 3F[n1/4]; 3A[n1/4];
ME2: [s1/2.];

Compasso 40:
MD:  5D[n1/2.];
ME:  4D[n1/4]; 3D[n1/4]; 4C[n1/4];
ME2: [s1/2.];

Compasso 41:
MD:  5D[n1/4]; 4G[n1/8]; 4F[n1/8]; 4G[n1/4];
ME:  [p1/4]; 4D[n1/2];
ME2: 3B[n1/2]; 3B[n1/4];

Compasso 42:
MD:  5E[n1/4]; 4G[n1/8]; 4F[n1/8]; 4G[n1/4];
ME:  [p1/4]; 4E[n1/2];
ME2: 4C[n1/2]; 4C[n1/4];

Compasso 43:
MD:  5D[n1/4]; 5C[n1/4]; 4B[n1/4];
ME:  3B[n1/4]; 3A[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 44:
MD:  4A[n1/8]; 4G[n1/8]; 4F[n1/8]; 4G[n1/8]; 4A[n1/4];
ME:  4D[n1/2]; [p1/4];
ME2: [s1/2.];

Compasso 45:
MD:  4D[n1/8]; 4E[n1/8]; 4F[n1/8]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8];
ME:  [p1/4]; [p1/4]; 3F[n1/4];
ME2: 3D[n1/2.];

Compasso 46:
MD:  5C[n1/4]; 4B[n1/4]; 4A[n1/4];
ME:  3E[n1/4]; 3G[n1/4]; 3F[n1/4];
ME2: [s1/2.];

Compasso 47:
MD:  4B[n1/8]; 5D[n1/8]; 4G[n1/4]; 4F[n1/4];
ME:  3G[n1/4]; 2B[n1/4]; 3D[n1/4];
ME2: [s1/2.];

Compasso 48:
MD:  4G[n1/2.], 4D[n1/2.], 3B[n1/2.];
ME:  3G[n1/4]; 3D[n1/4]; 2G[n1/4];
ME2: [s1/2.];

Compasso 49 (parte B de novo):
MD:  5B[n1/4]; 5G[n1/8]; 5A[n1/8]; 5B[n1/8]; 5G[n1/8];
ME:  3G[n1/2.];
ME2: [s1/2.];

Compasso 50:
MD:  5A[n1/4]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8]; 5D[n1/8];
ME:  3F[n1/2.];
ME2: [s1/2.];

Compasso 51:
MD:  5G[n1/4]; 5E[n1/8]; 5F[n1/8]; 5G[n1/8]; 5D[n1/8];
ME:  3E[n1/4]; 3G[n1/4]; 3E[n1/4];
ME2: [s1/2.];

Compasso 52:
MD:  5C#[n1/4]; 4B[n1/8]; 5C#[n1/8]; 4A[n1/4];
ME:  3A[n1/2]; 2A[n1/4];
ME2: [s1/2.];

Compasso 53:
MD:  4A[n1/8]; 4B[n1/8]; 5C#[n1/8]; 5D[n1/8]; 5E[n1/8]; 5F[n1/8];
ME:  3A[n1/2.];
ME2: [s1/2.];

Compasso 54:
MD:  5G[n1/4]; 5F[n1/4]; 5E[n1/4];
ME:  3B[n1/4]; 4D[n1/4]; 4C#[n1/4];
ME2: [s1/2.];

Compasso 55:
MD:  5F[n1/4]; 4A[n1/4]; 5C#[n1/4];
ME:  4D[n1/4]; 3F[n1/4]; 3A[n1/4];
ME2: [s1/2.];

Compasso 56:
MD:  5D[n1/2.];
ME:  4D[n1/4]; 3D[n1/4]; 4C[n1/4];
ME2: [s1/2.];

Compasso 57:
MD:  5D[n1/4]; 4G[n1/8]; 4F[n1/8]; 4G[n1/4];
ME:  [p1/4]; 4D[n1/2];
ME2: 3B[n1/2]; 3B[n1/4];

Compasso 58:
MD:  5E[n1/4]; 4G[n1/8]; 4F[n1/8]; 4G[n1/4];
ME:  [p1/4]; 4E[n1/2];
ME2: 4C[n1/2]; 4C[n1/4];

Compasso 59:
MD:  5D[n1/4]; 5C[n1/4]; 4B[n1/4];
ME:  3B[n1/4]; 3A[n1/4]; 3G[n1/4];
ME2: [s1/2.];

Compasso 60:
MD:  4A[n1/8]; 4G[n1/8]; 4F[n1/8]; 4G[n1/8]; 4A[n1/4];
ME:  4D[n1/2]; [p1/4];
ME2: [s1/2.];

Compasso 61:
MD:  4D[n1/8]; 4E[n1/8]; 4F[n1/8]; 4G[n1/8]; 4A[n1/8]; 4B[n1/8];
ME:  [p1/4]; [p1/4]; 3F[n1/4];
ME2: 3D[n1/2.];

Compasso 62:
MD:  5C[n1/4]; 4B[n1/4]; 4A[n1/4];
ME:  3E[n1/4]; 3G[n1/4]; 3F[n1/4];
ME2: [s1/2.];

Compasso 63:
MD:  4B[n1/8]; 5D[n1/8]; 4G[n1/4]; 4F[n1/4];
ME:  3G[n1/4]; 2B[n1/4]; 3D[n1/4];
ME2: [s1/2.];

Compasso 64:
MD:  4G[n1/2.], 4D[n1/2.], 3B[n1/2.];
ME:  3G[n1/4]; 3D[n1/4]; 2G[n1/4];
ME2: [s1/2.];

Fim
`;

    const SONG_ELISE = `Música: Pour Elise (Für Elise) – Ludwig van Beethoven
Transcrição em texto: a parte A (o tema famoso, com as repetições escritas)
Nível: médio

Referência: Bagatela em Lá menor, WoO 59 — edição digital do Mutopia Project
(domínio público). "Poco moto". O tema se repete e a parte do meio (compassos 18 a 30)
passa por Dó maior.
Compasso: 3/8
Andamento: semínima = 72

Dica: pratique primeiro só a mão direita, devagar (Velocidade 50%). A mão esquerda
toca arpejos curtos (Lá–Mi–Lá e Mi–Mi–Sol♯) e descansa no resto do compasso.

Compasso 1 (anacruse: as 2 semicolcheias antes do 1º compasso):
MD:  [p1/4]; 5E[n1/16]; 5D#[n1/16];
ME:  [p1/4]; [p1/8];

Compasso 2:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 3:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 4:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 4G#[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 5:
MD:  5C[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 6:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 7:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 8:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5C[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 9 (1ª vez: as 2 semicolcheias levam de volta ao começo):
MD:  4A[n1/4]; 5E[n1/16]; 5D#[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 10 (a melodia de novo):
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 11:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 12:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 4G#[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 13:
MD:  5C[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 14:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 15:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 16:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5C[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 17 (2ª vez: segue para o trecho do meio):
MD:  4A[n1/8]; [p1/16]; 4B[n1/16]; 5C[n1/16]; 5D[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 18 (o trecho do meio, em Dó maior):
MD:  5E[n1/8.]; 4G[n1/16]; 5F[n1/16]; 5E[n1/16];
ME:  3C[n1/16]; 3G[n1/16]; 4C[n1/16]; [p1/16]; [p1/8];

Compasso 19:
MD:  5D[n1/8.]; 4F[n1/16]; 5E[n1/16]; 5D[n1/16];
ME:  2G[n1/16]; 3G[n1/16]; 3B[n1/16]; [p1/16]; [p1/8];

Compasso 20:
MD:  5C[n1/8.]; 4E[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 21:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; [p1/16];
ME:  2E[n1/16]; 3E[n1/16]; 4E[n1/16]; [p1/16]; [p1/16]; 4E[n1/16];

Compasso 22:
MD:  [p1/16]; 5E[n1/16]; 6E[n1/16]; [p1/16]; [p1/16]; 5D#[n1/16];
ME:  5E[n1/16]; [p1/16]; [p1/16]; 5D#[n1/16]; 5E[n1/16]; [p1/16];

Compasso 23:
MD:  5E[n1/8]; [p1/16]; 5D#[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  [p1/16]; 5D#[n1/16]; 5E[n1/16]; [p1/16]; [p1/8];

Compasso 24:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 25:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 26:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 4G#[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 27:
MD:  5C[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 28:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 29:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 30:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5C[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 31 (volta ao trecho do meio):
MD:  4A[n1/8]; [p1/16]; 4B[n1/16]; 5C[n1/16]; 5D[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 32 (o trecho do meio de novo):
MD:  5E[n1/8.]; 4G[n1/16]; 5F[n1/16]; 5E[n1/16];
ME:  3C[n1/16]; 3G[n1/16]; 4C[n1/16]; [p1/16]; [p1/8];

Compasso 33:
MD:  5D[n1/8.]; 4F[n1/16]; 5E[n1/16]; 5D[n1/16];
ME:  2G[n1/16]; 3G[n1/16]; 3B[n1/16]; [p1/16]; [p1/8];

Compasso 34:
MD:  5C[n1/8.]; 4E[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 35:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; [p1/16];
ME:  2E[n1/16]; 3E[n1/16]; 4E[n1/16]; [p1/16]; [p1/16]; 4E[n1/16];

Compasso 36:
MD:  [p1/16]; 5E[n1/16]; 6E[n1/16]; [p1/16]; [p1/16]; 5D#[n1/16];
ME:  5E[n1/16]; [p1/16]; [p1/16]; 5D#[n1/16]; 5E[n1/16]; [p1/16];

Compasso 37:
MD:  5E[n1/8]; [p1/16]; 5D#[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  [p1/16]; 5D#[n1/16]; 5E[n1/16]; [p1/16]; [p1/8];

Compasso 38:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 39:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 40:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 4G#[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 41:
MD:  5C[n1/8]; [p1/16]; 4E[n1/16]; 5E[n1/16]; 5D#[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 42:
MD:  5E[n1/16]; 5D#[n1/16]; 5E[n1/16]; 4B[n1/16]; 5D[n1/16]; 5C[n1/16];
ME:  [p1/4.];

Compasso 43:
MD:  4A[n1/8]; [p1/16]; 4C[n1/16]; 4E[n1/16]; 4A[n1/16];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Compasso 44:
MD:  4B[n1/8]; [p1/16]; 4E[n1/16]; 5C[n1/16]; 4B[n1/16];
ME:  2E[n1/16]; 3E[n1/16]; 3G#[n1/16]; [p1/16]; [p1/8];

Compasso 45 (fim da parte A):
MD:  4A[n1/4.];
ME:  2A[n1/16]; 3E[n1/16]; 3A[n1/16]; [p1/16]; [p1/8];

Fim
`;

    const SONG_CANON = `Música: Cânone em Ré – Johann Pachelbel (versão simplificada)
Nível: médio
Tom: Ré maior
Compasso: 4/4
Andamento: semínima = 72

Versão simplificada (arranjo para o Siga o Dino): a mão esquerda repete o baixo
famoso de 8 notas (Ré, Lá, Si, Fá♯, Sol, Ré, Sol, Lá), e a mão direita faz a melodia
em três partes, cada vez mais rápidas: semibreves, mínimas e semínimas. Com o Tom de
Ré maior, F e C já são sustenidos (Fá♯ e Dó♯).

Compasso 1 (o baixo de 8 notas e a melodia em semibreves):
MD:  5F[n1];
ME:  3D[n1/2]; 2A[n1/2];

Compasso 2:
MD:  5E[n1];
ME:  2B[n1/2]; 2F[n1/2];

Compasso 3:
MD:  5D[n1];
ME:  2G[n1/2]; 2D[n1/2];

Compasso 4:
MD:  5C[n1];
ME:  2G[n1/2]; 2A[n1/2];

Compasso 5:
MD:  4B[n1];
ME:  3D[n1/2]; 2A[n1/2];

Compasso 6:
MD:  4A[n1];
ME:  2B[n1/2]; 2F[n1/2];

Compasso 7:
MD:  4B[n1];
ME:  2G[n1/2]; 2D[n1/2];

Compasso 8:
MD:  5C[n1];
ME:  2G[n1/2]; 2A[n1/2];

Compasso 9 (a melodia em mínimas):
MD:  5D[n1/2]; 5C[n1/2];
ME:  3D[n1/2]; 2A[n1/2];

Compasso 10:
MD:  4B[n1/2]; 4A[n1/2];
ME:  2B[n1/2]; 2F[n1/2];

Compasso 11:
MD:  4G[n1/2]; 4F[n1/2];
ME:  2G[n1/2]; 2D[n1/2];

Compasso 12:
MD:  4G[n1/2]; 4E[n1/2];
ME:  2G[n1/2]; 2A[n1/2];

Compasso 13 (a melodia em semínimas):
MD:  5D[n1/4]; 5F[n1/4]; 5A[n1/4]; 5G[n1/4];
ME:  3D[n1/2]; 2A[n1/2];

Compasso 14:
MD:  5F[n1/4]; 5D[n1/4]; 5F[n1/4]; 5E[n1/4];
ME:  2B[n1/2]; 2F[n1/2];

Compasso 15:
MD:  5D[n1/4]; 4B[n1/4]; 5D[n1/4]; 4A[n1/4];
ME:  2G[n1/2]; 2D[n1/2];

Compasso 16:
MD:  4G[n1/4]; 4B[n1/4]; 4A[n1/4]; 4G[n1/4];
ME:  2G[n1/2]; 2A[n1/2];

Compasso 17 (acorde final):
MD:  4F[n1], 4A[n1], 5D[n1];
ME:  3D[n1];
Fim
`;

    /**
     * Numeração antiga das oitavas (Dó central = "C"/"1C", 2C = o de cima, 0C e −1C graves)
     * → a do piano (Dó central = 4C): o número de cada nota passa a ser o antigo + 3.
     */
    const OLD_NOTE = new RegExp(String.raw`(?<![\p{L}\d-])(-[12]|\d)?(D[óo]|R[ée]|Mi|F[áa]|Sol|L[áa]|Si|[A-G])(?=\s*(?:##|#|♯|bb|b|♭|♮|=)?\s*\[\s*n)`, "gu");
    const migrateOctaves = (text) => String(text || "").replace(OLD_NOTE, (m, oct, name) => `${(oct ? Number(oct) : 1) + 3}${name}`);

    window.SigaDinoMusic = {
        parse,
        migrateOctaves,
        UNIT,
        figureOf,
        EXAMPLES: [
            { id: "ode", title: "⭐ Ode à Alegria — Beethoven (fácil)", short: "Ode à Alegria", file: "Ode_a_Alegria_notas.txt", text: ODE },
            { id: "brilha", title: "⭐ Brilha, brilha, estrelinha (muito fácil)", short: "Brilha, brilha, estrelinha", file: "Brilha_brilha_estrelinha_notas.txt", text: SONG_BRILHA },
            { id: "irmao", title: "⭐ Irmão João — cânone (fácil)", short: "Irmão João", file: "Irmao_Joao_notas.txt", text: SONG_IRMAO },
            { id: "parabens", title: "⭐ Parabéns a você (fácil)", short: "Parabéns a você", file: "Parabens_a_voce_notas.txt", text: SONG_PARABENS },
            { id: "minueto", title: "⭐⭐ Minueto em Sol — Bach/Petzold (médio)", short: "Minueto em Sol", file: "Minueto_em_Sol_notas.txt", text: SONG_MINUETO },
            { id: "elise", title: "⭐⭐ Pour Elise — Beethoven (médio)", short: "Pour Elise", file: "Pour_Elise_notas.txt", text: SONG_ELISE },
            { id: "canon", title: "⭐⭐ Cânone em Ré — Pachelbel (médio)", short: "Cânone em Ré", file: "Canone_em_Re_notas.txt", text: SONG_CANON },
            { id: "clair", title: "⭐⭐⭐ Clair de Lune — Debussy (difícil)", short: "Clair de Lune", file: "Clair_de_Lune_notas.txt", text: CLAIR },
        ],
    };
})();
