/* =====================================================================
   Siga o Dino — "Executar música (notas)": leitura do código de notas
   ---------------------------------------------------------------------
   Formato (do material "Teoria Musical"):
     E[n1/4];          nota Mi, semínima
     2C[n1];           Dó da 2ª oitava (o 2º Dó do pentagrama), semibreve
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
   Oitava: 1 (ou nada) = do Dó central ao Si; 2 = a de cima; 0 = a de baixo;
   -1 e -2 = mais graves ainda (mão esquerda do piano, na clave de Fá).
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
    const NOTE_RE = String.raw`(?<![\p{L}\d-])(-[12]|\d)?(D[óo]|R[ée]|Mi|F[áa]|Sol|L[áa]|Si|[A-G])\s*(##|#|♯|bb|b|♭|♮|=)?\s*\[\s*n\s*(\d+)(?:\s*\/\s*(\d+))?\s*(\.{0,2})\s*\]`;
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
        const key = readKey(text); // armadura: acidente de cada letra (−1 bemol, +1 sustenido)
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
            if (!isNote) { events.push({ kind: "rest", hand, frac, figure, dotted, dots, tuplet, bar, from, to, hidden: spacers.has(from) }); continue; }

            const word = plain(m[2]);
            const letter = word.length === 1 ? LETTERS.indexOf(word.toUpperCase()) : NAMES[word];
            const octave = m[1] ? Number(m[1]) : 1; // -2, -1, 0 (graves), 1 (central), 2…
            const accText = m[3] || "";
            const natural = accText === "♮" || accText === "=";
            const inKey = key.acc[letter];
            // Sem acidente escrito vale a armadura; ♮/= é o bequadro (natural).
            const acc = natural ? 0 : !accText ? inKey
                : /^(#|♯)$/.test(accText) ? 1 : accText === "##" ? 2 : /^(b|♭)$/.test(accText) ? -1 : accText === "bb" ? -2 : 0;
            const sign = (a) => (a > 0 ? "♯".repeat(a) : a < 0 ? "♭".repeat(-a) : "");
            const note = {
                semi: (octave - 1) * 12 + NATURAL_SEMI[letter] + acc,
                step: (octave - 1) * 7 + letter,
                // No pentagrama: só o acidente que foge da armadura (♮ quando volta ao natural).
                acc: acc === inKey ? "" : acc === 0 ? "♮" : sign(acc),
                label: `${octave !== 1 ? octave : ""}${LETTERS[letter]}${sign(acc)}`,
            };
            const prev = events[events.length - 1];
            // Vírgula entre duas notas = acorde (soam juntas; vale a figura mais longa).
            if (prev && prev.kind === "note" && /^\s*~?\s*,\s*$/.test(gap)) {
                prev.notes.push(note);
                prev.to = to;
                if (frac > prev.frac) Object.assign(prev, { frac, figure, dotted, dots });
                continue;
            }
            events.push({ kind: "note", hand, notes: [note], frac, figure, dotted, dots, tuplet, bar, from, to });
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
        return { events, tempo, warnings, title, meter, end, hands, key: key.count, voices: VOICES.filter((v) => lists[v].length) };
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
E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];

Compasso 2:
G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];

Compasso 3:
C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];

Compasso 4:
E[n1/2]; D[n1/2];

Compasso 5:
E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];

Compasso 6:
G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];

Compasso 7:
C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];

Compasso 8:
D[n1/2]; C[n1/2];

Compasso 9:
D[n1/4]; D[n1/4]; E[n1/4]; C[n1/4];

Compasso 10:
D[n1/4]; E[n1/8]; F[n1/8]; E[n1/4]; C[n1/4];

Compasso 11:
D[n1/4]; E[n1/8]; F[n1/8]; E[n1/4]; D[n1/4];

Compasso 12 (G de baixo = 0G):
C[n1/4]; D[n1/4]; 0G[n1/2];

Compasso 13:
E[n1/4]; E[n1/4]; F[n1/4]; G[n1/4];

Compasso 14:
G[n1/4]; F[n1/4]; E[n1/4]; D[n1/4];

Compasso 15:
C[n1/4]; C[n1/4]; D[n1/4]; E[n1/4];

Compasso 16:
D[n1/2]; C[n1/2];

Compasso 17 (final com acorde de Dó maior: Dó, Mi e Sol juntos):
C[n1], E[n1], G[n1];

Fim

Observação: Esta transcrição apresenta o tema principal da melodia completo, com dezesseis compassos e o acorde final, com base na pauta superior da partitura da página 3 (compassos 1 a 8) e na continuação do tema (compassos 9 a 16). Não representa o acompanhamento da pauta inferior do piano.
`;

    // Igual ao arquivo "Clair_de_Lune_notas.txt" (os 8 primeiros compassos, as duas mãos).
    const CLAIR = `Música: Clair de Lune – Claude Debussy
Transcrição em texto: os 8 primeiros compassos (as duas mãos)

Referência: Suite bergamasque, 3º movimento, 1ª edição (E. Fromont, Paris, 1905),
página 14 — partitura em domínio público (IMSLP #83536).
Andante très expressif · pp · con sordina
Tom: Ré♭ maior
Compasso: 9/8
Andamento: semínima. = 52

Convenção utilizada:
MD = mão direita (melodia); MD2 = 2ª voz da mão direita (notas longas por baixo)
ME = mão esquerda
Com o Tom de Ré♭ maior, B, E, A, D e G já são bemóis; A♮ = Lá natural.
[s…] = espera em silêncio (só para a 2ª voz começar no lugar certo)
{2 …} = duína: 2 colcheias no tempo de 3; ~ = ligadura

Compasso 1:
MD:  [p1/8]; [p1/8]; 2F[n1/8], 2A[n1/8]~ 2F[n1/4.], 2A[n1/4.]; 2D[n1/4.], 2F[n1/4.]~
MD2: [s1/2.]; [s1/4.];
ME:  [p1/4]; F[n1/8], A[n1/8]~ F[n1/2.], A[n1/2.];

Compasso 2:
MD:  2D[n1/8], 2F[n1/8]; 2C[n1/8], 2E[n1/8]; 2D[n1/8], 2F[n1/8]; 2C[n1/2.], 2E[n1/2.]~
MD2: [s1/2.]; [s1/4.];
ME:  G[n1/2.], A♮[n1/2.]~ G[n1/4.], A[n1/4.];

Compasso 3:
MD:  2C[n1/8], 2E[n1/8]; B[n1/8], 2D[n1/8]; 2C[n1/8], 2E[n1/8]; {2 2D[n1/8]; 2F[n1/8]~} {2 2F[n1/8]; 2D[n1/8]~}
MD2: [s1/4.]; A[n1/2.];
ME:  F[n1/2.], A[n1/2.]~ F[n1/4.], A[n1/4.];

Compasso 4:
MD:  B[n1/8], 2D[n1/8]; A[n1/8], 2C[n1/8]; B[n1/8], 2D[n1/8]; A[n1/2.], 2C[n1/2.]~
MD2: [s1/2.]; [s1/4.];
ME:  E[n1/2.], G[n1/2.]~ E[n1/4.], G[n1/4.];

Compasso 5:
MD:  2C[n1/8]; B[n1/8]; 2C[n1/8]; B[n1/8]; 2E[n1/8]; B[n1/8]; A[n1/8]; B[n1/8]; A[n1/8]~
MD2: G[n1/2.]; G[n1/4.];
ME:  C[n1/2.], E[n1/2.]; C[n1/4.], E[n1/4.];

Compasso 6:
MD:  A[n1/8]; G[n1/8]; A[n1/8]; G[n1/4.]; F[n1/4.];
MD2: E[n1/2.]; E[n1/4.];
ME:  0B[n1/2.], C[n1/2.]; 0A♮[n1/4.], C[n1/4.];

Compasso 7 (a mão esquerda passa para a clave de Fá):
MD:  G[n1/8]; F[n1/8]; G[n1/8]; F[n1/8]; B[n1/8]; F[n1/8]; E[n1/8]; F[n1/8]; E[n1/8]~
MD2: D[n1/2.]; D[n1/4.];
ME:  0A[n1/2.], 0B[n1/2.]; 0G[n1/4.], 0B[n1/4.];

Compasso 8:
MD:  E[n1/8]; D[n1/8]; E[n1/8]; D[n1/4.]; C[n1/4.];
MD2: 0B[n1/2.]; 0A[n1/4.];
ME:  0E[n1/2.], 0A[n1/2.]; {2 0E[n1/8], 0G[n1/8]; -1A[n1/8];}

Fim

Observação: a peça continua (72 compassos no total); aqui estão só os 8 primeiros, a
parte mais conhecida. As duas vozes da mão direita foram separadas em MD e MD2; na
partitura, a mão esquerda está na clave de Sol até o compasso 6 — aqui ela fica sempre
na clave de Fá da pauta dupla (por isso as linhas suplementares em cima).
`;

    window.SigaDinoMusic = {
        parse,
        UNIT,
        figureOf,
        EXAMPLES: [
            { id: "ode", title: "Ode à Alegria (Beethoven)", short: "Ode à Alegria", file: "Ode_a_Alegria_notas.txt", text: ODE },
            { id: "clair", title: "Clair de Lune (Debussy)", short: "Clair de Lune", file: "Clair_de_Lune_notas.txt", text: CLAIR },
        ],
    };
})();
