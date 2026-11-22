/* =====================================================================
   Pontos e Quadrados — regras e computador (sem tela e sem som)
   ---------------------------------------------------------------------
   Tabuleiro de rows × cols quadrados ((rows+1) × (cols+1) pontos).
   Cada traço (aresta) tem um número:
     horizontais  id = r * cols + c                 (r 0..rows, c 0..cols-1)
     verticais    id = H + r * (cols + 1) + c       (r 0..rows-1, c 0..cols)
   Quem fecha o 4º lado de um quadrado ganha o quadrado e joga de novo.
   ===================================================================== */
(() => {
    "use strict";

    /** Geometria fixa do tabuleiro: quais quadrados cada traço toca e vice-versa. */
    const makeGeometry = (rows, cols) => {
        const H = (rows + 1) * cols;
        const V = rows * (cols + 1);
        const hId = (r, c) => r * cols + c;
        const vId = (r, c) => H + r * (cols + 1) + c;
        const boxEdges = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                boxEdges.push([hId(r, c), hId(r + 1, c), vId(r, c), vId(r, c + 1)]);
            }
        }
        const edgeBoxes = Array.from({ length: H + V }, () => []);
        boxEdges.forEach((edges, b) => edges.forEach((e) => edgeBoxes[e].push(b)));
        /** Pontas do traço em coordenadas de ponto (x = coluna, y = linha). */
        const ends = (e) => {
            if (e < H) {
                const r = Math.floor(e / cols), c = e % cols;
                return [[c, r], [c + 1, r]];
            }
            const k = e - H, r = Math.floor(k / (cols + 1)), c = k % (cols + 1);
            return [[c, r], [c, r + 1]];
        };
        return { rows, cols, H, V, edgeCount: H + V, boxCount: rows * cols, boxEdges, edgeBoxes, hId, vId, ends };
    };

    /** Estado da partida. */
    const createState = (geo, first = 0) => ({
        geo,
        edges: new Uint8Array(geo.edgeCount),   // 1 = traço feito
        owner: new Int8Array(geo.boxCount).fill(-1),
        sides: new Uint8Array(geo.boxCount),     // lados feitos de cada quadrado
        score: [0, 0],
        turn: first,
        moves: 0,
    });

    const clone = (s) => ({
        geo: s.geo,
        edges: s.edges.slice(),
        owner: s.owner.slice(),
        sides: s.sides.slice(),
        score: s.score.slice(),
        turn: s.turn,
        moves: s.moves,
    });

    const isOver = (s) => s.score[0] + s.score[1] === s.geo.boxCount;
    const freeEdges = (s) => {
        const list = [];
        for (let e = 0; e < s.edges.length; e++) if (!s.edges[e]) list.push(e);
        return list;
    };

    /** Faz o traço. Devolve os quadrados fechados (vazio = passa a vez). */
    const play = (s, e) => {
        if (s.edges[e]) return null;
        s.edges[e] = 1;
        s.moves++;
        const closed = [];
        for (const b of s.geo.edgeBoxes[e]) {
            if (++s.sides[b] === 4) {
                s.owner[b] = s.turn;
                s.score[s.turn]++;
                closed.push(b);
            }
        }
        if (!closed.length) s.turn = 1 - s.turn;
        return closed;
    };

    // =================================================================
    // Computador
    // =================================================================
    /** Quantos quadrados o traço fecharia agora. */
    const closes = (s, e) => s.geo.edgeBoxes[e].filter((b) => s.sides[b] === 3).length;
    /** Traço "seguro": não deixa nenhum quadrado com 3 lados para o adversário. */
    const isSafe = (s, e) => s.geo.edgeBoxes[e].every((b) => s.sides[b] < 2);
    const pickRandom = (list, random) => list[Math.floor(random() * list.length)];

    /** Joga (numa cópia) todos os quadrados disponíveis, um atrás do outro. Devolve quantos. */
    const greedyTake = (s) => {
        let total = 0;
        for (;;) {
            const e = freeEdges(s).find((x) => closes(s, x) > 0);
            if (e === undefined) return total;
            total += play(s, e).length;
        }
    };

    /** Quantos quadrados o adversário ganha se eu fizer este traço (ele pegando tudo). */
    const giveaway = (s, e) => {
        const t = clone(s);
        play(t, e);
        return greedyTake(t);
    };

    /** Entrega o menor pedaço possível; no empate, prefere o traço do meio de uma
     *  dupla (os dois quadrados ficam separados e o adversário não pode recusar). */
    const cheapestGift = (s, free) => {
        let best = [], bestCost = Infinity;
        for (const e of free) {
            const cost = giveaway(s, e);
            if (cost < bestCost) { bestCost = cost; best = [e]; } else if (cost === bestCost) best.push(e);
        }
        const middle = best.filter((e) => s.geo.edgeBoxes[e].length === 2 && s.geo.edgeBoxes[e].every((b) => s.sides[b] === 2));
        return { edges: middle.length ? middle : best, cost: bestCost };
    };

    /**
     * Corrente que começa no quadrado de 3 lados b: devolve os quadrados em
     * ordem e o quadrado logo depois da ponta (undefined = borda).
     */
    const chainFrom = (s, b) => {
        const g = s.geo;
        const boxes = [b];
        let prevEdge = g.boxEdges[b].find((e) => !s.edges[e]);
        let cur = b;
        for (;;) {
            const next = g.edgeBoxes[prevEdge].find((x) => x !== cur);
            if (next === undefined || s.sides[next] !== 2) return { boxes, endBox: next };
            boxes.push(next);
            const out = g.boxEdges[next].find((e) => !s.edges[e] && e !== prevEdge);
            cur = next;
            prevEdge = out;
        }
    };

    /**
     * Escolhe o traço do computador.
     * level: "facil" | "medio" | "dificil"
     */
    const chooseMove = (s, level = "medio", random = Math.random) => {
        const free = freeEdges(s);
        if (!free.length) return -1;
        const captures = free.filter((e) => closes(s, e) > 0);
        const safe = free.filter((e) => isSafe(s, e) && !captures.includes(e));

        if (level === "facil") {
            if (captures.length && random() < 0.75) return pickRandom(captures, random);
            if (safe.length && random() < 0.6) return pickRandom(safe, random);
            return pickRandom(free, random);
        }

        if (level === "dificil" && captures.length) {
            const dd = doubleDeal(s, captures);
            if (dd !== null) return dd;
        }
        if (captures.length) {
            // Primeiro os que fecham dois de uma vez, depois qualquer um.
            const doubles = captures.filter((e) => closes(s, e) === 2);
            return pickRandom(doubles.length ? doubles : captures, random);
        }
        if (safe.length) {
            if (level === "dificil") {
                // Entre os seguros, evita os que tiram quadrados "zerados" (preserva opções).
                const calm = safe.filter((e) => s.geo.edgeBoxes[e].every((b) => s.sides[b] === 0));
                if (calm.length && random() < 0.5) return pickRandom(calm, random);
            }
            return pickRandom(safe, random);
        }
        return pickRandom(cheapestGift(s, free).edges, random);
    };

    /**
     * Jogada de "controle" (nível difícil): ao pegar uma corrente no fim do
     * jogo, deixa os 2 últimos quadrados para o adversário, que então é
     * obrigado a abrir a próxima corrente longa. Devolve o traço ou null.
     */
    const doubleDeal = (s, captures) => {
        // Só vale a pena quando, depois de pegar tudo, não sobra jogada segura
        // e ainda existe corrente longa (3+) para ganhar depois.
        const after = clone(s);
        greedyTake(after);
        if (isOver(after)) return null;
        const free = freeEdges(after);
        if (free.some((e) => isSafe(after, e))) return null;
        const longLeft = free.some((e) => giveaway(after, e) >= 3);
        if (!longLeft) return null;

        // Pega primeiro tudo o que não é a última dupla de uma corrente.
        const threeSided = [...new Set(captures.flatMap((e) => s.geo.edgeBoxes[e].filter((b) => s.sides[b] === 3)))];
        const chains = threeSided.map((b) => ({ b, ...chainFrom(s, b) }));
        const pairs = chains.filter((ch) => ch.boxes.length === 2 && (ch.endBox === undefined || s.sides[ch.endBox] < 2));
        const pairBoxes = new Set(pairs.flatMap((p) => p.boxes));
        const other = captures.find((e) => s.geo.edgeBoxes[e].some((b) => s.sides[b] === 3 && !pairBoxes.has(b)));
        if (other !== undefined) return other;
        // Só sobrou a dupla: faz o traço da ponta de lá (os dois ficam para o adversário).
        if (pairs.length === 1 && captures.every((e) => s.geo.edgeBoxes[e].some((b) => pairBoxes.has(b)))) {
            const farBox = pairs[0].boxes[1];
            const far = s.geo.boxEdges[farBox].find((e) => !s.edges[e] && !s.geo.edgeBoxes[e].includes(pairs[0].boxes[0]));
            if (far !== undefined) return far;
        }
        return null;
    };

    window.PontosEngine = { makeGeometry, createState, clone, play, isOver, freeEdges, chooseMove, closes };
})();
