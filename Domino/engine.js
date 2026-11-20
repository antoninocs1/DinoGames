/* =====================================================================
   Dominó — regras, inteligência do computador e layout da mesa.
   Não mexe na página: o game.js cuida da interface.

   Regras (dominó brasileiro, 28 peças do duplo-seis):
   - Cada jogador recebe 7 peças. Em duplas (4 jogadores) não sobra monte;
     com 2 ou 3 jogadores as peças restantes formam o monte para comprar.
   - 1ª rodada: começa quem tem a maior carroça (o duplo-seis em duplas)
     e é obrigado a jogá-la. Nas seguintes começa quem ganhou a anterior.
   - Quem não tem peça que encaixe compra do monte até poder jogar;
     sem monte, passa a vez.
   - Batida: simples 1 ponto, carroça 2, lá-e-lô 3, cruzada 4.
   - Jogo fechado (ninguém consegue jogar): ganha 1 ponto quem tiver
     menos pontos na mão (em duplas, a dupla desse jogador). Empate: ninguém pontua.
   ===================================================================== */
(() => {
    "use strict";

    const HAND_SIZE = 7;
    const ALL_TILES = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) ALL_TILES.push([a, b]);

    const isDouble = (t) => t[0] === t[1];
    const pips = (t) => t[0] + t[1];
    const same = (t, u) => t[0] === u[0] && t[1] === u[1];
    const has = (t, v) => t[0] === v || t[1] === v;
    const other = (t, v) => (t[0] === v ? t[1] : t[0]);
    const label = (t) => `${t[0]}|${t[1]}`;
    const handPips = (hand) => hand.reduce((s, t) => s + pips(t), 0);

    const shuffle = (list) => {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    const teamOf = (n, p) => (n === 4 ? p % 2 : p);
    const sortHand = (hand) => hand.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

    // ---------------------------------------------------------------
    // Rodada
    // ---------------------------------------------------------------

    /**
     * Cria uma rodada. starter = quem começa (null = maior carroça, obrigada).
     */
    function newRound(n, starter = null) {
        let hands, stock;
        // Com 5 carroças ou mais na mesma mão, embaralha de novo.
        do {
            const deck = shuffle(ALL_TILES);
            hands = Array.from({ length: n }, (_, p) => sortHand(deck.slice(p * HAND_SIZE, (p + 1) * HAND_SIZE)));
            stock = deck.slice(n * HAND_SIZE);
        } while (hands.some((h) => h.filter(isDouble).length >= 5));

        let mustPlay = null;
        if (starter === null) {
            // Maior carroça; sem nenhuma (2 ou 3 jogadores), a peça mais pesada.
            let best = null;
            hands.forEach((hand, p) => hand.forEach((t) => {
                const value = (isDouble(t) ? 100 : 0) + pips(t) * 2 + Math.max(t[0], t[1]) / 10;
                if (!best || value > best.value) best = { p, t, value };
            }));
            starter = best.p;
            mustPlay = best.t;
        }

        return {
            n,
            hands,
            stock,
            center: null, // primeira peça da mesa
            left: [], // peças à esquerda (da mais próxima para a ponta): { tile, inner, outer }
            right: [],
            ends: [null, null],
            turn: starter,
            starter,
            mustPlay,
            passes: 0,
            lastPlayer: null,
            lacks: Array.from({ length: n }, () => new Set()), // números que cada um mostrou não ter
            log: [],
            over: null,
        };
    }

    const onTable = (r) => (r.center ? 1 : 0) + r.left.length + r.right.length;

    /** Jogadas possíveis: { tile, side: "center" | "left" | "right" } */
    function legalMoves(r, p) {
        const hand = r.hands[p];
        if (!r.center) {
            if (r.mustPlay) return hand.filter((t) => same(t, r.mustPlay)).map((tile) => ({ tile, side: "center" }));
            return hand.map((tile) => ({ tile, side: "center" }));
        }
        const moves = [];
        hand.forEach((tile) => {
            if (has(tile, r.ends[0])) moves.push({ tile, side: "left" });
            if (has(tile, r.ends[1])) moves.push({ tile, side: "right" });
        });
        return moves;
    }

    const canPlay = (r, p) => legalMoves(r, p).length > 0;

    /** Pontos da batida feita com a peça t sobre as pontas e (antes da jogada). */
    function knockPoints(t, e) {
        if (isDouble(t)) {
            return e[0] === e[1] && e[0] === t[0]
                ? { points: 4, kind: "cruzada", name: "Cruzada" }
                : { points: 2, kind: "carroca", name: "Batida de carroça" };
        }
        if (e[0] !== e[1] && has(t, e[0]) && has(t, e[1])) return { points: 3, kind: "laelo", name: "Lá-e-lô" };
        return { points: 1, kind: "simples", name: "Batida simples" };
    }

    function play(r, p, move) {
        const hand = r.hands[p];
        const i = hand.findIndex((t) => same(t, move.tile));
        if (i < 0) throw new Error("peça não está na mão");
        const tile = hand[i];
        const before = r.ends.slice();
        hand.splice(i, 1);

        if (move.side === "center") {
            r.center = tile;
            r.ends = [tile[0], tile[1]];
            r.mustPlay = null;
        } else {
            const idx = move.side === "left" ? 0 : 1;
            const inner = r.ends[idx];
            if (!has(tile, inner)) throw new Error("a peça não encaixa nessa ponta");
            const outer = other(tile, inner);
            r[move.side].push({ tile, inner, outer });
            r.ends[idx] = outer;
        }

        r.passes = 0;
        r.lastPlayer = p;
        r.log.push({ p, type: "play", tile, side: move.side });

        if (hand.length === 0) {
            const knock = r.center === tile ? { points: 1, kind: "simples", name: "Batida simples" } : knockPoints(tile, before);
            r.over = { type: "batida", winner: p, team: teamOf(r.n, p), ...knock, tile };
        } else {
            r.turn = (p + 1) % r.n;
        }
        return tile;
    }

    function draw(r, p) {
        if (!r.stock.length) return null;
        const tile = r.stock.pop();
        r.hands[p].push(tile);
        sortHand(r.hands[p]);
        if (r.center) r.ends.forEach((v) => r.lacks[p].add(v));
        r.log.push({ p, type: "draw" });
        return tile;
    }

    function pass(r, p) {
        if (r.center) r.ends.forEach((v) => r.lacks[p].add(v));
        r.passes++;
        r.log.push({ p, type: "pass" });
        if (r.passes >= r.n) {
            const totals = r.hands.map(handPips);
            const min = Math.min(...totals);
            const holders = totals.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
            const teams = new Set(holders.map((i) => teamOf(r.n, i)));
            if (teams.size === 1) {
                // Entre parceiros empatados, vale quem fechou primeiro na ordem da mesa.
                const winner = holders[0];
                r.over = { type: "fechado", winner, team: teamOf(r.n, winner), points: 1, kind: "fechado", name: "Jogo fechado", totals };
            } else {
                r.over = { type: "fechado", winner: null, team: null, points: 0, kind: "empate", name: "Jogo fechado empatado", totals, next: r.lastPlayer ?? r.starter };
            }
        } else {
            r.turn = (p + 1) % r.n;
        }
    }

    // ---------------------------------------------------------------
    // Computador
    // ---------------------------------------------------------------

    const LEVELS = ["facil", "medio", "dificil"];

    function chooseMove(r, p, level = "medio") {
        const moves = legalMoves(r, p);
        if (!moves.length) return null;
        if (moves.length === 1) return moves[0];

        if (level === "facil") {
            if (Math.random() < 0.3) return moves.reduce((a, b) => (pips(b.tile) > pips(a.tile) ? b : a));
            return moves[Math.floor(Math.random() * moves.length)];
        }

        const hand = r.hands[p];
        const n = r.n;
        const partner = n === 4 ? (p + 2) % 4 : -1;
        const next = (p + 1) % n;

        // Peças que este jogador ainda não viu (mãos dos outros + monte).
        const seen = [];
        if (r.center) seen.push(r.center);
        r.left.forEach((x) => seen.push(x.tile));
        r.right.forEach((x) => seen.push(x.tile));
        hand.forEach((t) => seen.push(t));
        const unseen = ALL_TILES.filter((t) => !seen.some((s) => same(s, t)));

        const scoreMove = (m) => {
            const t = m.tile;
            let s = pips(t) + (isDouble(t) ? 4 : 0);
            if (level === "medio") return s + Math.random() * 1.5;

            const rest = hand.filter((x) => !same(x, t));
            if (!rest.length) return 1000 + knockPoints(t, r.ends).points * 10;

            let ends;
            if (m.side === "center") ends = [t[0], t[1]];
            else {
                ends = r.ends.slice();
                const idx = m.side === "left" ? 0 : 1;
                ends[idx] = other(t, ends[idx]);
            }

            // Manter o controle: quantas peças da mão continuam jogáveis.
            const playable = rest.filter((x) => has(x, ends[0]) || has(x, ends[1])).length;
            s += playable * 2.2;

            // Variedade: guardar números diferentes ajuda a não ter de comprar/passar.
            const numbers = new Set(rest.flat());
            s += numbers.size * 0.6;

            ends.forEach((v) => {
                for (let o = 0; o < n; o++) {
                    if (o === p) continue;
                    if (!r.lacks[o].has(v)) continue;
                    if (o === partner) s -= 4; // não trancar o parceiro
                    else s += o === next ? 6 : 3.5; // trancar quem joga em seguida vale mais
                }
                // Número "morto" para os outros e eu ainda tenho: controle da ponta.
                const left = unseen.filter((x) => has(x, v)).length;
                const mine = rest.filter((x) => has(x, v)).length;
                if (left === 0 && mine > 0) s += 3 * mine;
                if (left <= 1 && mine === 0) s -= 1.5;
            });

            // Preparar um lá-e-lô / cruzada para a última peça.
            if (rest.length === 1) {
                const last = rest[0];
                if (has(last, ends[0]) || has(last, ends[1])) s += 6;
            }
            return s + Math.random() * 0.4;
        };

        let best = moves[0], bestScore = -Infinity;
        moves.forEach((m) => {
            const s = scoreMove(m);
            if (s > bestScore) { bestScore = s; best = m; }
        });
        return best;
    }

    // ---------------------------------------------------------------
    // Layout da mesa (cobrinha que dobra nas bordas)
    // Unidade = meia peça. Peça deitada: 2×1; carroça atravessada: 1×2.
    // Peças: { x, y, w, h, a, b } — a = metade esquerda/de cima, b = direita/de baixo.
    // ---------------------------------------------------------------

    function walkArm(items, startX, dir0, vdir, halfW) {
        const out = [];
        let x = startX, y = 0, dir = dir0, afterCorner = false;
        items.forEach((it) => {
            const dbl = isDouble(it.tile);
            const w = dbl && !afterCorner ? 1 : 2;
            if (Math.abs(x + dir * w) > halfW) {
                // Curva: peça em pé, descendo (braço direito) ou subindo (esquerdo).
                out.push({
                    x: dir > 0 ? x : x - 1, y: vdir > 0 ? y - 0.5 : y - 1.5, w: 1, h: 2,
                    a: vdir > 0 ? it.inner : it.outer, b: vdir > 0 ? it.outer : it.inner, tile: it.tile,
                });
                x += dir;
                y += 2 * vdir;
                dir = -dir;
                afterCorner = true;
                return;
            }
            if (dbl && !afterCorner) {
                out.push({ x: dir > 0 ? x : x - 1, y: y - 1, w: 1, h: 2, a: it.inner, b: it.inner, tile: it.tile });
                x += dir;
            } else {
                out.push({
                    x: dir > 0 ? x : x - 2, y: y - 0.5, w: 2, h: 1,
                    a: dir > 0 ? it.inner : it.outer, b: dir > 0 ? it.outer : it.inner, tile: it.tile,
                });
                x += 2 * dir;
            }
            afterCorner = false;
        });
        return out;
    }

    /** extra = { side, tile } desenha uma peça fantasma (onde a peça escolhida vai cair). */
    function layout(r, halfW, extra = null) {
        if (!r.center) {
            if (extra) {
                const t = extra.tile;
                return { pieces: [], ghost: isDouble(t) ? { x: -0.5, y: -1, w: 1, h: 2, a: t[0], b: t[1], tile: t } : { x: -1, y: -0.5, w: 2, h: 1, a: t[0], b: t[1], tile: t } };
            }
            return { pieces: [], ghost: null };
        }
        const c = r.center;
        const dbl = isDouble(c);
        const centerPiece = dbl
            ? { x: -0.5, y: -1, w: 1, h: 2, a: c[0], b: c[1], tile: c, center: true }
            : { x: -1, y: -0.5, w: 2, h: 1, a: c[0], b: c[1], tile: c, center: true };
        const start = dbl ? 0.5 : 1;

        const withExtra = (side) => {
            const list = r[side].slice();
            if (extra && extra.side === side) {
                const inner = r.ends[side === "left" ? 0 : 1];
                list.push({ tile: extra.tile, inner, outer: other(extra.tile, inner) });
            }
            return list;
        };
        const leftArm = walkArm(withExtra("left"), -start, -1, -1, halfW);
        const rightArm = walkArm(withExtra("right"), start, 1, 1, halfW);

        let ghost = null;
        if (extra?.side === "left") ghost = leftArm.pop();
        if (extra?.side === "right") ghost = rightArm.pop();

        // Ordem de jogada não importa para desenhar; marca as pontas.
        if (leftArm.length) leftArm[leftArm.length - 1].end = "left";
        if (rightArm.length) rightArm[rightArm.length - 1].end = "right";
        return { pieces: [centerPiece, ...leftArm, ...rightArm], ghost };
    }

    window.DominoEngine = {
        ALL_TILES, HAND_SIZE, LEVELS,
        isDouble, pips, same, has, label, handPips, teamOf, onTable,
        newRound, legalMoves, canPlay, play, draw, pass, chooseMove, knockPoints, layout,
    };
})();
