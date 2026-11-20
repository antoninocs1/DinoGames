/* =====================================================================
   Damas — motor de regras e inteligência artificial
   Regras oficiais da CBD/FMJD para o tabuleiro de 64 casas:
   - pedra anda 1 casa para frente e captura para frente e para trás;
   - dama "voadora": anda e captura a qualquer distância na diagonal;
   - captura obrigatória, em cadeia, Lei da Maioria (pedra e dama valem igual);
   - Tema Turco: peças capturadas só saem no fim do lance (continuam bloqueando
     e não podem ser capturadas duas vezes); pode passar várias vezes pela mesma
     casa vazia (casa cruz);
   - pedra que só passa pela casa de coroação durante a captura não vira dama.
   Este arquivo funciona no navegador (window.DamasEngine) e como Web Worker.
   ===================================================================== */
(function (root) {
    "use strict";

    const N = 8;
    const WM = 1, WK = 2, BM = -1, BK = -2;
    const WHITE = 1, BLACK = -1;
    const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const FILES = "abcdefgh";

    const idx = (r, c) => r * N + c;
    const rowOf = (sq) => (sq / N) | 0;
    const colOf = (sq) => sq % N;
    const isDark = (r, c) => (r + c) % 2 === 1;
    const side = (p) => (p > 0 ? WHITE : p < 0 ? BLACK : 0);
    const isKing = (p) => p === WK || p === BK;
    const sqName = (sq) => `${FILES[colOf(sq)]}${N - rowOf(sq)}`;
    // Grande diagonal: a1–h8.
    const onLongDiagonal = (sq) => rowOf(sq) + colOf(sq) === N - 1;

    // Raios pré-calculados: RAYS[casa][direção] = casas na diagonal a partir dela.
    const RAYS = [];
    for (let sq = 0; sq < N * N; sq++) {
        RAYS[sq] = DIRS.map(([dr, dc]) => {
            const ray = [];
            let r = rowOf(sq) + dr, c = colOf(sq) + dc;
            while (r >= 0 && r < N && c >= 0 && c < N) {
                ray.push(idx(r, c));
                r += dr; c += dc;
            }
            return ray;
        });
    }
    // Direções "para frente" das pedras (brancas sobem, pretas descem).
    const FORWARD = { [WHITE]: [0, 1], [BLACK]: [2, 3] };

    function initialBoard() {
        const b = new Int8Array(N * N);
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (!isDark(r, c)) continue;
                if (r < 3) b[idx(r, c)] = BM;
                else if (r > 4) b[idx(r, c)] = WM;
            }
        }
        return b;
    }

    // ---------- Geração de lances ----------

    function captureSearch(b, from, out) {
        const piece = b[from];
        const color = side(piece);
        const king = isKing(piece);
        const taken = new Uint8Array(N * N);
        const path = [];
        const caps = [];
        b[from] = 0; // a peça saiu da casa de origem (pode passar ou parar nela de novo)

        const dfs = (sq) => {
            let extended = false;
            for (let d = 0; d < 4; d++) {
                const ray = RAYS[sq][d];
                if (!king) {
                    if (ray.length < 2) continue;
                    const e = ray[0], l = ray[1];
                    if (side(b[e]) === -color && !taken[e] && b[l] === 0) {
                        extended = true;
                        taken[e] = 1; caps.push(e); path.push(l);
                        dfs(l);
                        path.pop(); caps.pop(); taken[e] = 0;
                    }
                    continue;
                }
                let i = 0;
                while (i < ray.length && b[ray[i]] === 0) i++;
                if (i >= ray.length) continue;
                const e = ray[i];
                // Peça própria ou já capturada (ainda no tabuleiro) bloqueia a diagonal.
                if (side(b[e]) !== -color || taken[e]) continue;
                let j = i + 1;
                if (j >= ray.length || b[ray[j]] !== 0) continue;
                extended = true;
                taken[e] = 1; caps.push(e);
                for (; j < ray.length && b[ray[j]] === 0; j++) {
                    path.push(ray[j]);
                    dfs(ray[j]);
                    path.pop();
                }
                caps.pop(); taken[e] = 0;
            }
            if (!extended && caps.length) {
                out.push({ from, to: sq, path: path.slice(), captures: caps.slice(), piece });
            }
        };

        dfs(from);
        b[from] = piece;
    }

    /**
     * Todos os lances legais de `color`.
     * Com unique=true junta capturas que só diferem na ordem/caminho (mesma origem,
     * destino e peças capturadas) — usado pela IA para não repetir trabalho.
     */
    function generateMoves(b, color, unique = false) {
        let caps = [];
        for (let sq = 0; sq < N * N; sq++) {
            if (side(b[sq]) === color) captureSearch(b, sq, caps);
        }
        if (caps.length) {
            // Lei da Maioria: só valem as capturas com o maior número de peças.
            let max = 0;
            for (const m of caps) if (m.captures.length > max) max = m.captures.length;
            caps = caps.filter((m) => m.captures.length === max);
            if (unique) {
                const seen = new Set();
                caps = caps.filter((m) => {
                    const key = `${m.from}-${m.to}:${m.captures.slice().sort((a, z) => a - z).join(",")}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }
            return caps;
        }

        const moves = [];
        for (let sq = 0; sq < N * N; sq++) {
            const p = b[sq];
            if (side(p) !== color) continue;
            if (isKing(p)) {
                for (let d = 0; d < 4; d++) {
                    for (const t of RAYS[sq][d]) {
                        if (b[t] !== 0) break;
                        moves.push({ from: sq, to: t, path: [t], captures: [], piece: p });
                    }
                }
            } else {
                for (const d of FORWARD[color]) {
                    const t = RAYS[sq][d][0];
                    if (t !== undefined && b[t] === 0) moves.push({ from: sq, to: t, path: [t], captures: [], piece: p });
                }
            }
        }
        return moves;
    }

    const promotes = (m) => !isKing(m.piece) &&
        ((m.piece === WM && rowOf(m.to) === 0) || (m.piece === BM && rowOf(m.to) === N - 1));

    // Aplica o lance e devolve o necessário para desfazer.
    function makeMove(b, m) {
        const captured = m.captures.map((sq) => b[sq]);
        b[m.from] = 0;
        for (const sq of m.captures) b[sq] = 0;
        b[m.to] = promotes(m) ? m.piece * 2 : m.piece;
        return captured;
    }

    function unmakeMove(b, m, captured) {
        b[m.to] = 0;
        m.captures.forEach((sq, i) => { b[sq] = captured[i]; });
        b[m.from] = m.piece;
    }

    function notation(m) {
        const sep = m.captures.length ? "x" : "-";
        return [m.from, ...m.path].map(sqName).join(sep);
    }

    function count(b) {
        const n = { wm: 0, wk: 0, bm: 0, bk: 0 };
        for (let sq = 0; sq < N * N; sq++) {
            const p = b[sq];
            if (p === WM) n.wm++; else if (p === WK) n.wk++;
            else if (p === BM) n.bm++; else if (p === BK) n.bk++;
        }
        return n;
    }

    // ---------- Avaliação ----------

    // Bônus posicional das pedras brancas por casa (pretas usam o espelho).
    const MAN_TABLE = new Int16Array(N * N);
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const advance = N - 1 - r;              // 0 na própria base, 7 na coroação
            let v = advance * advance * 0.9;          // avançar vale cada vez mais
            if (c >= 2 && c <= 5) v += 6;             // centro
            if (c === 0 || c === 7) v -= 4;           // bordas são mais passivas
            if (r === N - 1) v += 8;                  // guardar a base atrasa as damas rivais
            MAN_TABLE[idx(r, c)] = Math.round(v);
        }
    }

    function evaluate(b, color) {
        let score = 0;
        let white = 0, black = 0, pieces = 0, wKings = 0, bKings = 0;
        for (let sq = 0; sq < N * N; sq++) {
            const p = b[sq];
            if (!p) continue;
            pieces++;
            switch (p) {
                case WM: score += 100 + MAN_TABLE[sq]; white += 100; break;
                case BM: score -= 100 + MAN_TABLE[63 - sq]; black += 100; break;
                case WK: score += 320 + (onLongDiagonal(sq) ? 18 : 0); white += 320; wKings++; break;
                case BK: score -= 320 + (onLongDiagonal(sq) ? 18 : 0); black += 320; bKings++; break;
            }
        }
        // Quem está na frente quer trocar peças; quem está atrás quer manter.
        const diff = white - black;
        if (diff) score += Math.sign(diff) * Math.min(Math.abs(diff), 300) * (24 - pieces) / 24;
        return score * color;
    }

    // ---------- Busca (negamax + alfa-beta + tabela de transposição) ----------

    // Zobrist com dois inteiros de 32 bits para chaves com poucas colisões.
    let seed = 0x9e3779b9;
    const rnd = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return seed >>> 0;
    };
    const Z1 = [], Z2 = [];
    for (let sq = 0; sq < N * N; sq++) {
        Z1[sq] = [rnd(), rnd(), rnd(), rnd(), rnd()];
        Z2[sq] = [rnd(), rnd(), rnd(), rnd(), rnd()];
    }
    const zIndex = (p) => p + 2; // -2..2 -> 0..4
    const SIDE1 = rnd(), SIDE2 = rnd();

    function hashBoard(b, color) {
        let h1 = color === WHITE ? SIDE1 : 0, h2 = color === WHITE ? SIDE2 : 0;
        for (let sq = 0; sq < N * N; sq++) {
            if (b[sq]) { h1 ^= Z1[sq][zIndex(b[sq])]; h2 ^= Z2[sq][zIndex(b[sq])]; }
        }
        return (h1 >>> 0) * 0x100000 + (h2 & 0xfffff);
    }

    const WIN = 100000;
    const moveKey = (m) => `${m.from}>${m.path.join(">")}`;

    class TimeUp extends Error {}

    function search(board, color, { maxDepth = 6, timeMs = 1000, noise = 0, randomChance = 0 } = {}) {
        const b = Int8Array.from(board);
        const rootMoves = generateMoves(b, color, true);
        if (!rootMoves.length) return null;
        if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0 };
        if (randomChance && Math.random() < randomChance) {
            return { move: rootMoves[(Math.random() * rootMoves.length) | 0], score: 0, depth: 0 };
        }

        const tt = new Map();
        const start = Date.now();
        let nodes = 0;

        const negamax = (depth, alpha, beta, col, ply) => {
            if ((++nodes & 1023) === 0 && Date.now() - start > timeMs) throw new TimeUp();
            const moves = generateMoves(b, col, true);
            if (!moves.length) return -WIN + ply;
            const forced = moves[0].captures.length > 0;
            // Quiescência: com captura obrigatória a posição não está "calma"; continua buscando.
            if (depth <= 0 && (!forced || depth < -10)) return evaluate(b, col);

            const key = hashBoard(b, col);
            const entry = tt.get(key);
            const alpha0 = alpha;
            if (entry && entry.depth >= depth) {
                if (entry.flag === 0) return entry.score;
                if (entry.flag === 1 && entry.score > alpha) alpha = entry.score;
                else if (entry.flag === 2 && entry.score < beta) beta = entry.score;
                if (alpha >= beta) return entry.score;
            }
            if (entry?.best) {
                const i = moves.findIndex((m) => moveKey(m) === entry.best);
                if (i > 0) moves.unshift(moves.splice(i, 1)[0]);
            } else if (!forced) {
                // Promoções primeiro: costumam ser os melhores lances.
                moves.sort((x, y) => promotes(y) - promotes(x));
            }

            let best = -Infinity, bestKey = null;
            for (const m of moves) {
                const undo = makeMove(b, m);
                // Lance único não gasta profundidade (sequências forçadas).
                const score = -negamax(depth - (moves.length === 1 ? 0 : 1), -beta, -alpha, -col, ply + 1);
                unmakeMove(b, m, undo);
                if (score > best) { best = score; bestKey = moveKey(m); }
                if (best > alpha) alpha = best;
                if (alpha >= beta) break;
            }
            if (tt.size > 400000) tt.clear();
            tt.set(key, {
                depth, score: best, best: bestKey,
                flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0,
            });
            return best;
        };

        let result = { move: rootMoves[0], score: 0, depth: 0 };
        let ordered = rootMoves.slice();
        try {
            for (let depth = 1; depth <= maxDepth; depth++) {
                const scored = [];
                for (const m of ordered) {
                    const undo = makeMove(b, m);
                    // Com "ruído" precisa da nota exata de cada lance (janela cheia).
                    const alpha = noise ? -Infinity : (scored.length ? Math.max(...scored.map((s) => s.score)) : -Infinity);
                    const score = -negamax(depth - 1, -Infinity, noise ? Infinity : -alpha, -color, 1);
                    unmakeMove(b, m, undo);
                    scored.push({ move: m, score });
                }
                scored.sort((x, y) => y.score - x.score);
                ordered = scored.map((s) => s.move);
                let pick = scored[0];
                if (noise) {
                    const ok = scored.filter((s) => s.score >= scored[0].score - noise);
                    pick = ok[(Math.random() * ok.length) | 0];
                }
                result = { move: pick.move, score: pick.score, depth };
                if (Math.abs(scored[0].score) > WIN - 100) break; // vitória/derrota forçada encontrada
            }
        } catch (err) {
            if (!(err instanceof TimeUp)) throw err;
        }
        return result;
    }

    // Níveis de dificuldade do computador.
    const LEVELS = {
        facil: { maxDepth: 2, timeMs: 400, noise: 60, randomChance: 0.3 },
        medio: { maxDepth: 4, timeMs: 700, noise: 18 },
        dificil: { maxDepth: 9, timeMs: 1200 },
        mestre: { maxDepth: 40, timeMs: 3000 },
        dica: { maxDepth: 12, timeMs: 900 },
    };

    function bestMove(board, color, level) {
        const r = search(board, color, LEVELS[level] || LEVELS.medio);
        return r && r.move;
    }

    const api = {
        N, WM, WK, BM, BK, WHITE, BLACK,
        idx, rowOf, colOf, isDark, side, isKing, sqName, onLongDiagonal,
        initialBoard, generateMoves, makeMove, unmakeMove, promotes, notation, count, evaluate,
        bestMove, LEVELS,
    };

    if (typeof window === "undefined" && typeof self !== "undefined" && typeof importScripts === "function") {
        // Web Worker: calcula o lance do computador sem travar a tela.
        self.onmessage = (event) => {
            const { id, board, color, level } = event.data;
            const move = bestMove(board, color, level);
            self.postMessage({ id, move });
        };
    } else {
        root.DamasEngine = api;
    }
})(typeof self !== "undefined" ? self : this);
