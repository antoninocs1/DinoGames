"use strict";

// =====================================================================
// Labirinto do Ratinho — regras do jogo (sem desenho).
// Port de Maze.java, Mouse.java, Cat.java e Match.java.
// Funciona no navegador (window.MazeCore) e no Node (servidor online).
// =====================================================================

(function (root) {
    const NONE = -1, UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];
    const opposite = (d) => (d + 2) & 3;
    const randInt = (n) => Math.floor(Math.random() * n);

    // -----------------------------------------------------------------
    // Labirinto em grade: cada célula guarda 4 bits de parede (cima, direita, baixo, esquerda).
    // Início = (0, 0) canto superior esquerdo. Chegada = (cols-1, rows-1).
    // -----------------------------------------------------------------
    class Maze {
        constructor(cols, rows) {
            this.cols = cols;
            this.rows = rows;
            this.walls = new Uint8Array(cols * rows).fill(0x0f);
        }

        index(x, y) { return y * this.cols + x; }
        inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
        hasWall(x, y, d) { return (this.walls[this.index(x, y)] & (1 << d)) !== 0; }

        canMove(x, y, d) {
            if (d < 0 || d > 3 || !this.inside(x, y)) return false;
            return !this.hasWall(x, y, d) && this.inside(x + DX[d], y + DY[d]);
        }

        setWall(x, y, d, closed) {
            this.applyBit(x, y, d, closed);
            const nx = x + DX[d], ny = y + DY[d];
            if (this.inside(nx, ny)) this.applyBit(nx, ny, opposite(d), closed);
        }

        applyBit(x, y, d, closed) {
            const i = this.index(x, y);
            if (closed) this.walls[i] |= 1 << d;
            else this.walls[i] &= ~(1 << d);
        }

        // Labirinto perfeito (backtracking) + algumas passagens extras (caminhos alternativos).
        generate(loopFactor) {
            this.walls.fill(0x0f);
            const visited = new Uint8Array(this.cols * this.rows);
            const stack = [0];
            visited[0] = 1;
            while (stack.length) {
                const cur = stack[stack.length - 1];
                const x = cur % this.cols, y = Math.floor(cur / this.cols);
                const options = [];
                for (let d = 0; d < 4; d++) {
                    const nx = x + DX[d], ny = y + DY[d];
                    if (this.inside(nx, ny) && !visited[this.index(nx, ny)]) options.push(d);
                }
                if (!options.length) {
                    stack.pop();
                    continue;
                }
                const d = options[randInt(options.length)];
                const nx = x + DX[d], ny = y + DY[d];
                this.setWall(x, y, d, false);
                visited[this.index(nx, ny)] = 1;
                stack.push(this.index(nx, ny));
            }
            const extra = Math.round(this.cols * this.rows * loopFactor);
            for (let i = 0; i < extra; i++) {
                const x = randInt(this.cols), y = randInt(this.rows), d = randInt(4);
                if (this.inside(x + DX[d], y + DY[d]) && this.hasWall(x, y, d)) this.setWall(x, y, d, false);
            }
        }

        reachableFrom(sx, sy) {
            const seen = new Uint8Array(this.cols * this.rows);
            const queue = [this.index(sx, sy)];
            seen[queue[0]] = 1;
            for (let head = 0; head < queue.length; head++) {
                const c = queue[head];
                const x = c % this.cols, y = Math.floor(c / this.cols);
                for (let d = 0; d < 4; d++) {
                    if (!this.canMove(x, y, d)) continue;
                    const n = this.index(x + DX[d], y + DY[d]);
                    if (!seen[n]) {
                        seen[n] = 1;
                        queue.push(n);
                    }
                }
            }
            return seen;
        }

        // Distância (em passos) de cada célula até (gx, gy); -1 se inalcançável.
        distancesTo(gx, gy) {
            const dist = new Int32Array(this.cols * this.rows).fill(-1);
            const queue = [this.index(gx, gy)];
            dist[queue[0]] = 0;
            for (let head = 0; head < queue.length; head++) {
                const c = queue[head];
                const x = c % this.cols, y = Math.floor(c / this.cols);
                for (let d = 0; d < 4; d++) {
                    if (!this.canMove(x, y, d)) continue;
                    const n = this.index(x + DX[d], y + DY[d]);
                    if (dist[n] < 0) {
                        dist[n] = dist[c] + 1;
                        queue.push(n);
                    }
                }
            }
            return dist;
        }

        directionTowards(x, y, gx, gy) {
            const dist = this.distancesTo(gx, gy);
            const here = dist[this.index(x, y)];
            if (here <= 0) return NONE;
            for (let d = 0; d < 4; d++) {
                if (this.canMove(x, y, d) && dist[this.index(x + DX[d], y + DY[d])] === here - 1) return d;
            }
            return NONE;
        }

        // "Labirinto dinâmico": fecha uma passagem e abre outra, mantendo tudo conectado.
        mutate(isLocked) {
            const open = [], closed = [];
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    for (let d = RIGHT; d <= DOWN; d++) {
                        if (!this.inside(x + DX[d], y + DY[d])) continue;
                        const e = [x, y, d];
                        if (this.hasWall(x, y, d)) closed.push(e);
                        else if (!isLocked || !isLocked(x, y, d)) open.push(e);
                    }
                }
            }
            if (!open.length || !closed.length) return false;
            const cut = open[randInt(open.length)];
            this.setWall(cut[0], cut[1], cut[2], true);
            const side = this.reachableFrom(cut[0], cut[1]);
            const ox = cut[0] + DX[cut[2]], oy = cut[1] + DY[cut[2]];
            const candidates = side[this.index(ox, oy)]
                ? closed
                : closed.filter((e) => side[this.index(e[0], e[1])] !== side[this.index(e[0] + DX[e[2]], e[1] + DY[e[2]])]);
            if (!candidates.length) {
                this.setWall(cut[0], cut[1], cut[2], false);
                return false;
            }
            const e = candidates[randInt(candidates.length)];
            this.setWall(e[0], e[1], e[2], false);
            return true;
        }
    }

    // -----------------------------------------------------------------
    // Ratinho (humano ou computador) e gato
    // -----------------------------------------------------------------
    class Mouse {
        constructor(id) {
            Object.assign(this, {
                id, name: "", color: 0, ai: false, aiLevel: 0, address: "",
                cx: 0, cy: 0, tx: 0, ty: 0, progress: 0, moving: false,
                facing: RIGHT, desiredDir: NONE,
                participating: false, finished: false, finishTime: 0, wins: 0, lives: 0,
                caught: 0, teleports: 0, trapped: 0, ate: 0, scares: 0,
                stun: 0, power: 0, renderX: 0, renderY: 0, wanderSteps: 0,
            });
        }

        resetToStart() {
            this.cx = this.cy = this.tx = this.ty = 0;
            this.progress = 0;
            this.moving = false;
            this.facing = RIGHT;
            this.desiredDir = NONE;
            this.finished = false;
            this.finishTime = 0;
            this.wanderSteps = 0;
            this.stun = 0;
            this.power = 0;
            this.updateRender();
        }

        // Volta para a partida sem perder a tecla que o jogador está segurando.
        sendToStart() {
            this.cx = this.cy = this.tx = this.ty = 0;
            this.progress = 0;
            this.moving = false;
            this.wanderSteps = 0;
            this.stun = 0;
            this.updateRender();
        }

        updateRender() {
            this.renderX = this.cx + (this.tx - this.cx) * this.progress;
            this.renderY = this.cy + (this.ty - this.cy) * this.progress;
        }
    }

    const CAT = { HIDDEN: 0, WARNING: 1, ACTIVE: 2, WARNING_TIME: 1.5, HUNT_TIME: 8 };

    class Cat {
        constructor() {
            Object.assign(this, { state: CAT.HIDDEN, timer: 0, cx: 0, cy: 0, tx: 0, ty: 0, progress: 0, moving: false, facing: LEFT, renderX: 0, renderY: 0 });
        }
        placeAt(x, y) {
            this.cx = this.tx = x;
            this.cy = this.ty = y;
            this.progress = 0;
            this.moving = false;
            this.updateRender();
        }
        updateRender() {
            this.renderX = this.cx + (this.tx - this.cx) * this.progress;
            this.renderY = this.cy + (this.ty - this.cy) * this.progress;
        }
    }

    // -----------------------------------------------------------------
    // Partida: rodadas, contagem, movimento, IA, gato, túneis, ratoeiras, biscoito.
    // -----------------------------------------------------------------
    const PHASE = { WAITING: "waiting", COUNTDOWN: "countdown", RUNNING: "running", FINISHED: "finished", GAME_OVER: "gameover" };

    const C = {
        COLS: 25, ROWS: 15, MAX_MICE: 4,
        COUNTDOWN_TIME: 3, FINISHED_TIME: 5,
        MUTATION_INTERVAL: 4, MUTATIONS_PER_WAVE: 4, LOOP_FACTOR: 0.06,
        MAX_HOLES: 4, MAX_TRAPS: 3, TRAP_REARM: 6, POWER_TIME: 6, FOOD_RESPAWN: 8, CAT_FIRST_DELAY: 4,
        PLAYER_SPEED: 7,
        AI_LEVEL_NAMES: ["Fácil", "Médio", "Difícil"],
        AI_SPEED: [4.0, 4.8, 6.0],
        AI_MISTAKE: [0.18, 0.10, 0.03],
    };

    const holePairsForRound = (round) => (round <= 1 ? 1 : 2);
    const catInRound = (round) => round >= 2;
    const catSpeed = (round) => Math.min(6.2, 4.5 + 0.3 * (round - 2));
    const catInterval = (round) => Math.max(6, 13 - 2 * (round - 2));
    const trapsForRound = (round) => Math.max(1, Math.min(C.MAX_TRAPS, round));
    const trapStun = (round) => Math.min(4, 2 + 0.5 * (round - 1));

    class Match {
        // cols/rows: o labirinto pode ficar "em pé" (15 x 25) em celulares na vertical.
        constructor(minPlayers = 1, cols = C.COLS, rows = C.ROWS) {
            this.minPlayers = Math.max(1, minPlayers);
            this.maze = new Maze(cols, rows);
            this.maze.generate(C.LOOP_FACTOR);
            this.mice = [];
            this.phase = PHASE.WAITING;
            this.timer = 0;
            this.elapsed = 0;
            this.mutationTimer = 0;
            this.round = 0;
            this.winnerId = -1;
            this.bestTime = -1;
            this.maxLives = 0;
            this.hazards = true;
            this.cat = new Cat();
            this.holes = []; // [{x, y}] — o buraco 2i liga com o 2i+1
            this.traps = []; // [{x, y, rearm}]
            this.foodActive = false;
            this.foodX = 0;
            this.foodY = 0;
            this.foodTimer = 0;
            this.lock = (x, y, d) => this.isEdgeInUse(x, y, d);
        }

        goalX() { return this.maze.cols - 1; }
        goalY() { return this.maze.rows - 1; }

        // ---------------- jogadores
        addMouse(id, name, ai = false, aiLevel = 0) {
            const m = new Mouse(id);
            m.name = name;
            m.ai = ai;
            m.aiLevel = Math.max(0, Math.min(C.AI_SPEED.length - 1, aiLevel));
            m.color = this.freeColor();
            m.lives = this.maxLives;
            m.resetToStart();
            // Quem entra na contagem já participa; durante a corrida espera a próxima rodada.
            m.participating = this.phase === PHASE.COUNTDOWN;
            this.mice.push(m);
            return m;
        }

        removeMouse(id) {
            this.mice = this.mice.filter((m) => m.id !== id);
        }

        getMouse(id) {
            return this.mice.find((m) => m.id === id) || null;
        }

        setInput(id, dir) {
            const m = this.getMouse(id);
            if (m && !m.ai) m.desiredDir = dir >= 0 && dir <= 3 ? dir : NONE;
        }

        participants() {
            return this.mice.filter((m) => m.participating).length;
        }

        freeColor() {
            for (let c = 0; c < C.MAX_MICE; c++) if (!this.mice.some((m) => m.color === c)) return c;
            return this.mice.length % C.MAX_MICE;
        }

        enoughPlayers() {
            return this.mice.length > 0 && this.mice.length >= this.minPlayers;
        }

        // ---------------- simulação
        update(dt) {
            switch (this.phase) {
                case PHASE.WAITING:
                    if (this.enoughPlayers()) this.beginRound();
                    break;
                case PHASE.COUNTDOWN:
                    if (!this.enoughPlayers()) {
                        this.phase = PHASE.WAITING;
                        break;
                    }
                    this.timer -= dt;
                    if (this.timer <= 0) {
                        this.phase = PHASE.RUNNING;
                        this.elapsed = 0;
                        this.mutationTimer = C.MUTATION_INTERVAL;
                    }
                    break;
                case PHASE.RUNNING:
                    if (this.participants() === 0) {
                        this.phase = PHASE.WAITING;
                        break;
                    }
                    this.elapsed += dt;
                    this.tickHazards(dt);
                    this.mutationTimer -= dt;
                    if (this.mutationTimer <= 0) {
                        this.mutationTimer += C.MUTATION_INTERVAL;
                        for (let i = 0; i < C.MUTATIONS_PER_WAVE; i++) this.maze.mutate(this.lock);
                    }
                    for (const m of this.mice) {
                        if (m.participating && !m.finished) this.stepMouse(m, dt);
                        if (this.phase !== PHASE.RUNNING) break;
                    }
                    if (this.phase === PHASE.RUNNING) this.updateCat(dt);
                    break;
                case PHASE.FINISHED:
                    this.timer -= dt;
                    if (this.timer <= 0) {
                        if (this.enoughPlayers()) this.beginRound();
                        else this.phase = PHASE.WAITING;
                    }
                    break;
                default:
                    break;
            }
        }

        beginRound() {
            this.round++;
            this.maze.generate(C.LOOP_FACTOR);
            for (const m of this.mice) {
                m.resetToStart();
                m.participating = true;
            }
            this.winnerId = -1;
            this.elapsed = 0;
            this.foodActive = false;
            this.traps = [];
            this.placeHoles();
            this.placeTraps();
            this.placeFood();
            this.resetCat();
            this.timer = C.COUNTDOWN_TIME;
            this.mutationTimer = C.MUTATION_INTERVAL;
            this.phase = PHASE.COUNTDOWN;
        }

        stepMouse(m, dt) {
            if (m.stun > 0) { // preso na ratoeira
                m.updateRender();
                return;
            }
            let move = (m.ai ? C.AI_SPEED[m.aiLevel] : C.PLAYER_SPEED) * dt;
            while (move > 0) {
                if (!m.moving) {
                    const d = m.ai ? this.aiDecide(m) : m.desiredDir;
                    if (d === NONE || !this.maze.canMove(m.cx, m.cy, d)) break;
                    m.tx = m.cx + DX[d];
                    m.ty = m.cy + DY[d];
                    m.moving = true;
                    m.progress = 0;
                    m.facing = d;
                }
                const need = 1 - m.progress;
                if (move < need) {
                    m.progress += move;
                    move = 0;
                } else {
                    move -= need;
                    m.cx = m.tx;
                    m.cy = m.ty;
                    m.progress = 0;
                    m.moving = false;
                    if (m.cx === this.goalX() && m.cy === this.goalY()) {
                        this.finish(m);
                        break;
                    }
                    const hole = this.hazards ? this.holeAt(m.cx, m.cy) : -1;
                    if (hole >= 0) {
                        const other = this.holes[hole ^ 1]; // o par do buraco
                        m.cx = m.tx = other.x;
                        m.cy = m.ty = other.y;
                        m.teleports++;
                        m.wanderSteps = 0;
                    }
                    if (this.arriveHazards(m)) break;
                }
            }
            m.updateRender();
        }

        finish(m) {
            m.finished = true;
            m.finishTime = this.elapsed;
            if (this.winnerId < 0) {
                this.winnerId = m.id;
                m.wins++;
                if (this.bestTime < 0 || this.elapsed < this.bestTime) this.bestTime = this.elapsed;
                this.phase = PHASE.FINISHED;
                this.timer = C.FINISHED_TIME;
            }
        }

        // ---------------- ratoeiras, biscoito e túneis
        trapAt(x, y) {
            return this.traps.findIndex((t) => t.x === x && t.y === y && t.rearm <= 0);
        }

        occupied(x, y) {
            if (this.holeAt(x, y) >= 0) return true;
            if (this.traps.some((t) => t.x === x && t.y === y)) return true;
            return this.foodActive && this.foodX === x && this.foodY === y;
        }

        randomFreeCell(minFromStart) {
            const fromStart = this.maze.distancesTo(0, 0);
            const fromGoal = this.maze.distancesTo(this.goalX(), this.goalY());
            for (let attempt = 0; attempt < 400; attempt++) {
                const x = randInt(this.maze.cols), y = randInt(this.maze.rows);
                const i = this.maze.index(x, y);
                if (fromStart[i] < minFromStart || fromGoal[i] < 3 || this.occupied(x, y)) continue;
                if (!this.mice.some((m) => Math.abs(m.cx - x) + Math.abs(m.cy - y) < 3)) return i;
            }
            return -1;
        }

        placeTraps() {
            this.traps = [];
            if (!this.hazards) return;
            const n = trapsForRound(this.round);
            for (let t = 0; t < n; t++) {
                const c = this.randomFreeCell(5);
                if (c < 0) break;
                this.traps.push({ x: c % this.maze.cols, y: Math.floor(c / this.maze.cols), rearm: 0 });
            }
        }

        placeFood() {
            this.foodActive = false;
            if (!this.hazards || !catInRound(this.round)) return;
            const c = this.randomFreeCell(6);
            if (c < 0) return;
            this.foodX = c % this.maze.cols;
            this.foodY = Math.floor(c / this.maze.cols);
            this.foodActive = true;
        }

        tickHazards(dt) {
            for (const m of this.mice) {
                if (m.stun > 0) m.stun = Math.max(0, m.stun - dt);
                if (m.power > 0) m.power = Math.max(0, m.power - dt);
            }
            if (!this.hazards) return;
            for (const t of this.traps) if (t.rearm > 0) t.rearm = Math.max(0, t.rearm - dt);
            if (!this.foodActive && catInRound(this.round)) {
                this.foodTimer -= dt;
                if (this.foodTimer <= 0) this.placeFood();
            }
        }

        // Efeitos da célula onde o ratinho chegou. Retorna true se ficou preso.
        arriveHazards(m) {
            if (!this.hazards) return false;
            if (this.foodActive && m.cx === this.foodX && m.cy === this.foodY) {
                this.foodActive = false;
                this.foodTimer = C.FOOD_RESPAWN;
                m.power = C.POWER_TIME;
                m.ate++;
            }
            const t = this.trapAt(m.cx, m.cy);
            if (t >= 0) {
                this.traps[t].rearm = C.TRAP_REARM;
                m.stun = trapStun(this.round);
                m.trapped++;
                m.wanderSteps = 0;
                return true;
            }
            return false;
        }

        holeAt(x, y) {
            return this.holes.findIndex((h) => h.x === x && h.y === y);
        }

        placeHoles() {
            this.holes = [];
            if (!this.hazards) return;
            const pairs = holePairsForRound(this.round);
            const fromStart = this.maze.distancesTo(0, 0);
            const fromGoal = this.maze.distancesTo(this.goalX(), this.goalY());
            const good = (x, y) => {
                const i = this.maze.index(x, y);
                if (fromStart[i] < 4 || fromGoal[i] < 4) return false;
                return !this.holes.some((h) => Math.abs(h.x - x) + Math.abs(h.y - y) < 3);
            };
            for (let p = 0; p < pairs; p++) {
                for (let attempt = 0; attempt < 400; attempt++) {
                    const ax = randInt(this.maze.cols), ay = randInt(this.maze.rows);
                    const bx = randInt(this.maze.cols), by = randInt(this.maze.rows);
                    if (!good(ax, ay) || !good(bx, by)) continue;
                    if (Math.abs(ax - bx) + Math.abs(ay - by) < 12) continue; // pontas bem longe
                    this.holes.push({ x: ax, y: ay }, { x: bx, y: by });
                    break;
                }
            }
        }

        // ---------------- gato
        resetCat() {
            this.cat.state = CAT.HIDDEN;
            this.cat.timer = C.CAT_FIRST_DELAY;
            this.cat.placeAt(this.goalX(), this.goalY());
        }

        updateCat(dt) {
            const cat = this.cat;
            if (!this.hazards || !catInRound(this.round)) {
                cat.state = CAT.HIDDEN;
                return;
            }
            cat.timer -= dt;
            if (cat.state === CAT.HIDDEN) {
                if (cat.timer <= 0) {
                    const spawn = this.catSpawnCell();
                    cat.placeAt(spawn % this.maze.cols, Math.floor(spawn / this.maze.cols));
                    cat.state = CAT.WARNING;
                    cat.timer = CAT.WARNING_TIME;
                }
            } else if (cat.state === CAT.WARNING) {
                if (cat.timer <= 0) {
                    cat.state = CAT.ACTIVE;
                    cat.timer = CAT.HUNT_TIME;
                }
            } else if (cat.state === CAT.ACTIVE) {
                if (cat.timer <= 0) {
                    this.catLeaves();
                    return;
                }
                this.stepCat(dt);
                this.checkCatch();
            }
        }

        catLeaves() {
            this.cat.state = CAT.HIDDEN;
            this.cat.timer = catInterval(this.round);
        }

        // Aparece o mais longe possível de todos os ratinhos.
        catSpawnCell() {
            const n = this.maze.cols * this.maze.rows;
            const minDist = new Array(n).fill(Infinity);
            for (const m of this.mice) {
                if (!m.participating || m.finished) continue;
                const d = this.maze.distancesTo(m.cx, m.cy);
                for (let i = 0; i < n; i++) if (d[i] >= 0 && d[i] < minDist[i]) minDist[i] = d[i];
            }
            let best = -1, bestScore = -1;
            for (let i = 0; i < n; i++) {
                const x = i % this.maze.cols, y = Math.floor(i / this.maze.cols);
                if ((x === 0 && y === 0) || (x === this.goalX() && y === this.goalY()) || this.holeAt(x, y) >= 0) continue;
                const score = minDist[i] === Infinity ? 0 : Math.min(minDist[i], 18) * 10 + randInt(30);
                if (score > bestScore) {
                    bestScore = score;
                    best = i;
                }
            }
            return best < 0 ? this.maze.index(Math.floor(this.maze.cols / 2), Math.floor(this.maze.rows / 2)) : best;
        }

        stepCat(dt) {
            const cat = this.cat;
            let move = catSpeed(this.round) * dt;
            while (move > 0) {
                if (!cat.moving) {
                    const d = this.catDecide();
                    if (d === NONE) break;
                    cat.tx = cat.cx + DX[d];
                    cat.ty = cat.cy + DY[d];
                    cat.moving = true;
                    cat.progress = 0;
                    cat.facing = d;
                }
                const need = 1 - cat.progress;
                if (move < need) {
                    cat.progress += move;
                    move = 0;
                } else {
                    move -= need;
                    cat.cx = cat.tx;
                    cat.cy = cat.ty;
                    cat.progress = 0;
                    cat.moving = false;
                }
            }
            cat.updateRender();
        }

        // Persegue o ratinho mais próximo. A casa de partida é refúgio: o gato não entra.
        catDecide() {
            const cat = this.cat, mz = this.maze;
            const fromCat = mz.distancesTo(cat.cx, cat.cy);
            let target = null, best = Infinity, strongNearby = false;
            for (const m of this.mice) {
                if (!m.participating || m.finished || (m.cx === 0 && m.cy === 0 && !m.moving)) continue;
                const d = fromCat[mz.index(m.cx, m.cy)];
                if (m.power > 0) {
                    if (d >= 0 && d <= 6) strongNearby = true;
                    continue; // com medo de ratinho forte
                }
                if (d >= 0 && d < best) {
                    best = d;
                    target = m;
                }
            }
            if (strongNearby && (!target || best > 4)) return this.catFlee();
            if (!target) return NONE;
            const d = mz.directionTowards(cat.cx, cat.cy, target.cx, target.cy);
            if (d === NONE) return NONE;
            if (cat.cx + DX[d] === 0 && cat.cy + DY[d] === 0) return NONE;
            return d;
        }

        catFlee() {
            const cat = this.cat, mz = this.maze;
            const n = mz.cols * mz.rows;
            const near = new Array(n).fill(Infinity);
            for (const m of this.mice) {
                if (m.power <= 0 || !m.participating || m.finished) continue;
                const d = mz.distancesTo(m.cx, m.cy);
                for (let i = 0; i < n; i++) if (d[i] >= 0 && d[i] < near[i]) near[i] = d[i];
            }
            let best = NONE, bestDist = near[mz.index(cat.cx, cat.cy)];
            for (let d = 0; d < 4; d++) {
                if (!mz.canMove(cat.cx, cat.cy, d)) continue;
                const nx = cat.cx + DX[d], ny = cat.cy + DY[d];
                if (nx === 0 && ny === 0) continue;
                const v = near[mz.index(nx, ny)];
                if (v > bestDist) {
                    bestDist = v;
                    best = d;
                }
            }
            return best;
        }

        checkCatch() {
            const cat = this.cat;
            for (const m of this.mice) {
                if (!m.participating || m.finished) continue;
                const dx = m.renderX - cat.renderX, dy = m.renderY - cat.renderY;
                if (dx * dx + dy * dy < 0.55 * 0.55) {
                    if (m.power > 0) { // ratinho forte espanta o gato
                        m.scares++;
                        this.catLeaves();
                        return;
                    }
                    m.sendToStart();
                    m.caught++;
                    if (this.maxLives > 0) {
                        m.lives--;
                        if (m.lives <= 0) {
                            m.lives = 0;
                            this.phase = PHASE.GAME_OVER;
                        }
                    }
                    this.catLeaves(); // satisfeito, vai embora por um tempo
                    return;
                }
            }
        }

        // Uma passagem está "em uso" se alguém está atravessando-a agora.
        isEdgeInUse(x, y, d) {
            const nx = x + DX[d], ny = y + DY[d];
            const crossing = (o) => o.moving && ((o.cx === x && o.cy === y && o.tx === nx && o.ty === ny) ||
                (o.cx === nx && o.cy === ny && o.tx === x && o.ty === y));
            if (this.mice.some(crossing)) return true;
            return this.cat.state === CAT.ACTIVE && crossing(this.cat);
        }

        // ---------------- IA do computador
        // Segue o menor caminho até o queijo; às vezes "se distrai" e explora um caminho errado.
        aiDecide(m) {
            const back = opposite(m.facing);
            const options = [];
            for (let d = 0; d < 4; d++) if (d !== back && this.maze.canMove(m.cx, m.cy, d)) options.push(d);
            if (m.wanderSteps > 0) {
                m.wanderSteps--;
                if (!options.length) return this.maze.canMove(m.cx, m.cy, back) ? back : NONE;
                return options[randInt(options.length)];
            }
            const best = this.aiBestDirection(m);
            if (options.length >= 2 && Math.random() < C.AI_MISTAKE[m.aiLevel]) {
                const wrong = options.filter((d) => d !== best);
                if (wrong.length) {
                    m.wanderSteps = 3 + randInt(8);
                    return wrong[randInt(wrong.length)];
                }
            }
            return best;
        }

        // Melhor direção considerando túneis, ratoeiras, biscoito e o gato.
        aiBestDirection(m) {
            const mz = this.maze, cat = this.cat;
            const dist = mz.distancesTo(this.goalX(), this.goalY());
            const fromCat = cat.state === CAT.ACTIVE ? mz.distancesTo(cat.cx, cat.cy) : null;
            const foodDist = this.hazards && this.foodActive && cat.state !== CAT.HIDDEN ? mz.distancesTo(this.foodX, this.foodY) : null;
            let best = NONE, bestCost = Infinity;
            for (let d = 0; d < 4; d++) {
                if (!mz.canMove(m.cx, m.cy, d)) continue;
                const nx = m.cx + DX[d], ny = m.cy + DY[d];
                const ni = mz.index(nx, ny);
                let cost = dist[ni];
                const hole = this.hazards ? this.holeAt(nx, ny) : -1;
                if (hole >= 0) {
                    const ex = this.holes[hole ^ 1];
                    const exit = dist[mz.index(ex.x, ex.y)];
                    if (exit >= 0 && (cost < 0 || exit < cost)) cost = exit;
                }
                if (cost < 0) cost = 10000;
                if (this.hazards && this.trapAt(nx, ny) >= 0) cost += 40;
                if (foodDist && m.power <= 0) {
                    const f = foodDist[ni];
                    if (f >= 0 && f < 6) cost = Math.min(cost, f - 50); // biscoito perto e gato solto: vai comer
                }
                if (fromCat && m.power > 0) {
                    const c = fromCat[ni];
                    if (c >= 0 && c < 5) cost = Math.min(cost, c - 50); // forte: enfrenta o gato
                }
                if (fromCat && m.power <= 0) {
                    const c = fromCat[ni];
                    if (c >= 0 && c <= 3) cost += (4 - c) * 15; // quanto mais perto do gato, pior
                }
                if (cost < bestCost) {
                    bestCost = cost;
                    best = d;
                }
            }
            return best;
        }

        // ---------------- rede: snapshot completo (JSON) para os clientes
        snapshot() {
            const r = (v) => Math.round(v * 1000) / 1000;
            return {
                phase: this.phase, timer: r(this.timer), elapsed: r(this.elapsed), mutationTimer: r(this.mutationTimer),
                round: this.round, winnerId: this.winnerId, bestTime: r(this.bestTime), maxLives: this.maxLives,
                cols: this.maze.cols, rows: this.maze.rows,
                walls: Array.from(this.maze.walls, (w) => w.toString(16)).join(""),
                hazards: this.hazards, holes: this.holes, traps: this.traps.map((t) => ({ x: t.x, y: t.y, rearm: r(t.rearm) })),
                foodActive: this.foodActive, foodX: this.foodX, foodY: this.foodY,
                cat: { state: this.cat.state, timer: r(this.cat.timer), renderX: r(this.cat.renderX), renderY: r(this.cat.renderY), facing: this.cat.facing },
                mice: this.mice.map((m) => ({
                    id: m.id, name: m.name, address: m.address, color: m.color, ai: m.ai,
                    renderX: r(m.renderX), renderY: r(m.renderY), facing: m.facing,
                    participating: m.participating, finished: m.finished, finishTime: r(m.finishTime),
                    wins: m.wins, lives: m.lives, caught: m.caught, teleports: m.teleports, trapped: m.trapped,
                    ate: m.ate, scares: m.scares, stun: r(m.stun), power: r(m.power),
                })),
            };
        }

        // Cria uma partida só para desenho a partir de um snapshot.
        static fromSnapshot(s) {
            const m = new Match(1);
            Object.assign(m, {
                phase: s.phase, timer: s.timer, elapsed: s.elapsed, mutationTimer: s.mutationTimer,
                round: s.round, winnerId: s.winnerId, bestTime: s.bestTime, maxLives: s.maxLives,
                hazards: s.hazards, holes: s.holes, traps: s.traps,
                foodActive: s.foodActive, foodX: s.foodX, foodY: s.foodY,
            });
            m.maze = new Maze(s.cols, s.rows);
            for (let i = 0; i < m.maze.walls.length; i++) m.maze.walls[i] = parseInt(s.walls[i], 16);
            Object.assign(m.cat, s.cat);
            m.mice = s.mice.map((d) => Object.assign(new Mouse(d.id), d));
            return m;
        }
    }

    const api = { Maze, Mouse, Cat, Match, CAT, PHASE, C, NONE, UP, RIGHT, DOWN, LEFT, DX, DY, catInRound };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.MazeCore = api;
})(typeof window !== "undefined" ? window : globalThis);
