"use strict";

// =====================================================================
// Batalha Naval — DinoGames
// =====================================================================

const SIZE = 10;
const LETTERS = "ABCDEFGHIJ";
const FLEET = [
    { name: "Porta-aviões", size: 5 },
    { name: "Encouraçado", size: 4 },
    { name: "Cruzador", size: 3 },
    { name: "Submarino", size: 3 },
    { name: "Destróier", size: 2 },
];
const ENEMY_DELAY = 750; // ms até a IA atirar
const WINS_KEY = "dinogames-naval-wins";
const SOUND_KEY = "dinogames-naval-sound";
const DIFF_KEY = "dinogames-naval-difficulty";

const $ = (id) => document.getElementById(id);
const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } },
};
const randInt = (n) => Math.floor(Math.random() * n);
const coord = (r, c) => `${LETTERS[r]}${c + 1}`;

// =====================================================================
// Sons (Web Audio, sintetizados)
// =====================================================================

const audio = {
    ctx: null,
    enabled: storage.get(SOUND_KEY) !== "0",

    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
    },

    noise(duration, { freq = 800, q = 0.7, gain = 0.4, type = "lowpass", decay = 6 } = {}) {
        const ctx = this.ensure();
        if (!ctx || !this.enabled) return;
        const length = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * decay);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start();
    },

    tone(freq, duration, { type = "sine", gain = 0.15, slide = 0, delay = 0 } = {}) {
        const ctx = this.ensure();
        if (!ctx || !this.enabled) return;
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(g).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.05);
    },

    fire() {
        this.noise(0.25, { freq: 2200, type: "bandpass", q: 1.2, gain: 0.25, decay: 5 });
        this.tone(420, 0.22, { type: "triangle", gain: 0.06, slide: -300 });
    },
    splash() {
        this.noise(0.6, { freq: 1100, gain: 0.35, decay: 5 });
    },
    explosion() {
        this.noise(0.9, { freq: 420, gain: 0.9, decay: 4 });
        this.tone(70, 0.5, { type: "sine", gain: 0.35, slide: -35 });
    },
    sunk() {
        this.noise(1.4, { freq: 260, gain: 0.8, decay: 3 });
        this.tone(220, 0.3, { type: "square", gain: 0.05, delay: 0.15 });
        this.tone(165, 0.45, { type: "square", gain: 0.05, delay: 0.45 });
    },
    sonar() {
        this.tone(1320, 0.5, { type: "sine", gain: 0.05 });
    },
    victory() {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: "triangle", gain: 0.12, delay: i * 0.12 }));
    },
    defeat() {
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, { type: "triangle", gain: 0.12, delay: i * 0.18 }));
    },
};

// =====================================================================
// Modelo do tabuleiro
// =====================================================================

const createBoard = () => ({
    ships: [], // { name, size, cells: [{r,c}], hits: number, horizontal }
    occupied: Array.from({ length: SIZE }, () => Array(SIZE).fill(-1)), // índice do navio
    shots: Array.from({ length: SIZE }, () => Array(SIZE).fill(0)), // 0 nada, 1 água, 2 acerto
});

const shipCells = (r, c, size, horizontal) =>
    Array.from({ length: size }, (_, i) => (horizontal ? { r, c: c + i } : { r: r + i, c }));

const canPlace = (board, r, c, size, horizontal) =>
    shipCells(r, c, size, horizontal).every(
        (p) => p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE && board.occupied[p.r][p.c] === -1
    );

const placeShip = (board, spec, r, c, horizontal) => {
    const index = board.ships.length;
    const cells = shipCells(r, c, spec.size, horizontal);
    cells.forEach((p) => (board.occupied[p.r][p.c] = index));
    board.ships.push({ name: spec.name, size: spec.size, cells, hits: 0, horizontal });
};

const randomFleet = (board) => {
    FLEET.forEach((spec) => {
        for (;;) {
            const horizontal = Math.random() < 0.5;
            const r = randInt(SIZE);
            const c = randInt(SIZE);
            if (canPlace(board, r, c, spec.size, horizontal)) {
                placeShip(board, spec, r, c, horizontal);
                return;
            }
        }
    });
};

// Dispara numa célula. Retorna { result: "miss" | "hit" | "sunk", ship }
const fireAt = (board, r, c) => {
    const index = board.occupied[r][c];
    if (index === -1) {
        board.shots[r][c] = 1;
        return { result: "miss" };
    }
    board.shots[r][c] = 2;
    const ship = board.ships[index];
    ship.hits++;
    return { result: ship.hits === ship.size ? "sunk" : "hit", ship };
};

const shipsLeft = (board) => board.ships.filter((s) => s.hits < s.size).length;

// =====================================================================
// IA do adversário
// =====================================================================

const ai = {
    targets: [], // fila de alvos (modo "caça" após acerto)

    reset() {
        this.targets = [];
    },

    // Fácil: tiros aleatórios.
    easy(board) {
        const free = [];
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board.shots[r][c]) free.push({ r, c });
        return free[randInt(free.length)];
    },

    // Normal: procura em xadrez e, após acertar, investiga os vizinhos.
    normal(board) {
        while (this.targets.length) {
            const t = this.targets.shift();
            if (!board.shots[t.r][t.c]) return t;
        }
        const free = [];
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) if (!board.shots[r][c] && (r + c) % 2 === 0) free.push({ r, c });
        }
        return free.length ? free[randInt(free.length)] : this.easy(board);
    },

    // Difícil: mapa de probabilidade com os navios restantes (acertos não afundados pesam muito).
    hard(board) {
        const heat = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
        const sunkCells = new Set();
        board.ships.forEach((s) => {
            if (s.hits === s.size) s.cells.forEach((p) => sunkCells.add(p.r * SIZE + p.c));
        });
        const remaining = board.ships.filter((s) => s.hits < s.size).map((s) => s.size);

        remaining.forEach((size) => {
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    [true, false].forEach((horizontal) => {
                        const cells = shipCells(r, c, size, horizontal);
                        let hits = 0;
                        const valid = cells.every((p) => {
                            if (p.r >= SIZE || p.c >= SIZE) return false;
                            const shot = board.shots[p.r][p.c];
                            if (shot === 1 || sunkCells.has(p.r * SIZE + p.c)) return false;
                            if (shot === 2) hits++;
                            return true;
                        });
                        if (!valid) return;
                        const weight = 1 + hits * 30;
                        cells.forEach((p) => {
                            if (!board.shots[p.r][p.c]) heat[p.r][p.c] += weight;
                        });
                    });
                }
            }
        });

        let best = [];
        let max = -1;
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (board.shots[r][c]) continue;
                // leve preferência pelo padrão xadrez quando não há alvos abertos
                const v = heat[r][c] + ((r + c) % 2 === 0 ? 0.5 : 0);
                if (v > max) { max = v; best = [{ r, c }]; }
                else if (v === max) best.push({ r, c });
            }
        }
        return best.length ? best[randInt(best.length)] : this.easy(board);
    },

    pick(board, level) {
        return this[level] ? this[level](board) : this.normal(board);
    },

    // Informa o resultado para o modo Normal.
    report(r, c, result) {
        if (result === "hit") {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) this.targets.push({ r: nr, c: nc });
            });
        } else if (result === "sunk") {
            this.targets = [];
        }
    },
};

// =====================================================================
// Estado e interface
// =====================================================================

const ui = {
    game: $("game"),
    status: $("status"),
    playerBoard: $("player-board"),
    enemyBoard: $("enemy-board"),
    shipList: $("ship-list"),
    setup: $("setup"),
    stats: $("stats"),
    log: $("log"),
    overlay: $("overlay"),
    difficulty: $("difficulty"),
};

const state = {
    phase: "setup", // setup | battle | over
    player: createBoard(),
    enemy: createBoard(),
    placingIndex: 0,
    horizontal: true,
    turn: "player",
    shots: 0,
    hits: 0,
    wins: Number(storage.get(WINS_KEY)) || 0,
    cursor: { r: 0, c: 0 },
    hover: null,
};

const playerCells = [];
const enemyCells = [];

const buildBoard = (el, cells, isEnemy) => {
    el.querySelectorAll(".cell, .label").forEach((n) => n.remove());
    const corner = document.createElement("span");
    corner.className = "label";
    el.appendChild(corner);
    for (let c = 0; c < SIZE; c++) {
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = c + 1;
        el.appendChild(label);
    }
    for (let r = 0; r < SIZE; r++) {
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = LETTERS[r];
        el.appendChild(label);
        cells[r] = [];
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.setAttribute("aria-label", coord(r, c));
            cell.tabIndex = isEnemy ? 0 : -1;
            el.appendChild(cell);
            cells[r][c] = cell;
        }
    }
};

const setStatus = (text, tone = "") => {
    ui.status.textContent = text;
    ui.status.className = `status ${tone}`;
};

const addLog = (text, cls) => {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    ui.log.prepend(li);
};

// Desenha os navios e os disparos de um tabuleiro.
const renderBoard = (board, cells, revealShips) => {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = cells[r][c];
            cell.className = "cell";
            const shot = board.shots[r][c];
            if (shot) cell.classList.add("shot", shot === 1 ? "miss" : "hit");
        }
    }
    board.ships.forEach((ship) => {
        const sunk = ship.hits === ship.size;
        if (!revealShips && !sunk) return;
        ship.cells.forEach((p, i) => {
            const cell = cells[p.r][p.c];
            cell.classList.add("ship", ship.horizontal ? "h" : "v");
            if (i === 0) cell.classList.add("start");
            if (i === ship.size - 1) cell.classList.add("end");
            if (sunk) cell.classList.add("sunk", "sunk-cell");
        });
    });
};

const renderShipList = () => {
    ui.shipList.innerHTML = FLEET.map((ship, i) => `
        <li class="${i < state.placingIndex ? "placed" : ""} ${i === state.placingIndex ? "current" : ""}">
            <span>${ship.name}</span>
            <span class="ship-dots">${"<i></i>".repeat(ship.size)}</span>
        </li>`).join("");
    $("btn-start").disabled = state.placingIndex < FLEET.length;
};

const renderCounts = () => {
    $("player-left").textContent = state.phase === "setup" ? "" : `${shipsLeft(state.player)} navios`;
    $("enemy-left").textContent = state.phase === "setup" ? "" : `${shipsLeft(state.enemy)} navios`;
    $("stat-shots").textContent = state.shots;
    $("stat-hits").textContent = state.hits;
    $("stat-acc").textContent = state.shots ? `${Math.round((state.hits / state.shots) * 100)}%` : "0%";
    $("stat-wins").textContent = state.wins;
};

const render = () => {
    renderBoard(state.player, playerCells, true);
    renderBoard(state.enemy, enemyCells, state.phase === "over");

    // Pré-visualização do navio sendo posicionado
    if (state.phase === "setup" && state.hover && state.placingIndex < FLEET.length) {
        const spec = FLEET[state.placingIndex];
        const valid = canPlace(state.player, state.hover.r, state.hover.c, spec.size, state.horizontal);
        shipCells(state.hover.r, state.hover.c, spec.size, state.horizontal).forEach((p) => {
            if (p.r < SIZE && p.c < SIZE) playerCells[p.r][p.c].classList.add("preview", ...(valid ? [] : ["invalid"]));
        });
    }

    if (state.phase === "battle") {
        enemyCells[state.cursor.r][state.cursor.c].classList.add("cursor");
    }
    ui.enemyBoard.classList.toggle("locked", state.phase !== "battle" || state.turn !== "player");
    renderShipList();
    renderCounts();
};

// =====================================================================
// Efeitos visuais
// =====================================================================

const spawnFx = (boardEl, cell, kind) => {
    const cellRect = cell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const x = cellRect.left - boardRect.left + cellRect.width / 2;
    const y = cellRect.top - boardRect.top + cellRect.height / 2;
    const size = cellRect.width;

    const main = document.createElement("span");
    main.className = `fx ${kind === "miss" ? "splash" : "boom"}`;
    Object.assign(main.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
    boardEl.appendChild(main);
    setTimeout(() => main.remove(), 800);

    const count = kind === "miss" ? 8 : kind === "sunk" ? 22 : 12;
    for (let i = 0; i < count; i++) {
        const p = document.createElement("span");
        p.className = `fx ${kind === "miss" ? "drop" : "spark"}`;
        const ang = Math.random() * Math.PI * 2;
        const dist = size * (0.6 + Math.random() * (kind === "sunk" ? 2.2 : 1.2));
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
        p.style.setProperty("--dy", `${Math.sin(ang) * dist - (kind === "miss" ? size * 0.5 : 0)}px`);
        boardEl.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }

    if (kind !== "miss") {
        boardEl.classList.remove("shake");
        void boardEl.offsetWidth; // reinicia a animação
        boardEl.classList.add("shake");
    }
};

// =====================================================================
// Fluxo do jogo
// =====================================================================

const newGame = () => {
    state.phase = "setup";
    state.player = createBoard();
    state.enemy = createBoard();
    state.placingIndex = 0;
    state.horizontal = true;
    state.turn = "player";
    state.shots = 0;
    state.hits = 0;
    state.cursor = { r: 0, c: 0 };
    ai.reset();
    ui.game.classList.remove("battle");
    ui.setup.hidden = false;
    ui.stats.hidden = true;
    ui.overlay.hidden = true;
    ui.log.innerHTML = "";
    setStatus("Posicione sua frota.");
    render();
};

const placeCurrentShip = (r, c) => {
    if (state.placingIndex >= FLEET.length) return;
    const spec = FLEET[state.placingIndex];
    if (!canPlace(state.player, r, c, spec.size, state.horizontal)) {
        audio.tone(160, 0.12, { type: "square", gain: 0.05 });
        return;
    }
    placeShip(state.player, spec, r, c, state.horizontal);
    state.placingIndex++;
    audio.tone(660, 0.08, { type: "triangle", gain: 0.08 });
    setStatus(state.placingIndex < FLEET.length
        ? `Posicione: ${FLEET[state.placingIndex].name} (${FLEET[state.placingIndex].size})`
        : "Frota pronta! Clique em Iniciar batalha.", state.placingIndex >= FLEET.length ? "good" : "");
    render();
};

const randomizePlayer = () => {
    state.player = createBoard();
    randomFleet(state.player);
    state.placingIndex = FLEET.length;
    setStatus("Frota pronta! Clique em Iniciar batalha.", "good");
    render();
};

const startBattle = () => {
    if (state.placingIndex < FLEET.length) return;
    state.enemy = createBoard();
    randomFleet(state.enemy);
    state.phase = "battle";
    state.turn = "player";
    ui.game.classList.add("battle");
    ui.setup.hidden = true;
    ui.stats.hidden = false;
    setStatus("Sua vez! Escolha um alvo.", "good");
    audio.sonar();
    render();
    enemyCells[0][0].focus({ preventScroll: true });
};

const playerFire = (r, c) => {
    if (state.phase !== "battle" || state.turn !== "player" || state.enemy.shots[r][c]) return;
    state.cursor = { r, c };
    state.shots++;
    audio.fire();
    const { result, ship } = fireAt(state.enemy, r, c);
    const cell = enemyCells[r][c];

    if (result === "miss") {
        audio.splash();
        addLog(`Você: ${coord(r, c)} — água`, "you");
        setStatus("Água! Vez do inimigo…");
    } else {
        state.hits++;
        audio.explosion();
        if (result === "sunk") {
            audio.sunk();
            addLog(`Você afundou o ${ship.name}!`, "big");
            setStatus(`Você afundou o ${ship.name}!`, "good");
        } else {
            addLog(`Você: ${coord(r, c)} — fogo!`, "you");
            setStatus("Fogo! Acertou. Vez do inimigo…", "good");
        }
    }
    render();
    spawnFx(ui.enemyBoard, cell, result);

    if (!shipsLeft(state.enemy)) {
        endGame(true);
        return;
    }
    state.turn = "enemy";
    render();
    setTimeout(enemyTurn, ENEMY_DELAY);
};

const enemyTurn = () => {
    if (state.phase !== "battle") return;
    const { r, c } = ai.pick(state.player, ui.difficulty.value);
    audio.fire();
    const { result, ship } = fireAt(state.player, r, c);
    ai.report(r, c, result);

    if (result === "miss") {
        audio.splash();
        addLog(`Inimigo: ${coord(r, c)} — água`, "enemy");
    } else {
        audio.explosion();
        if (result === "sunk") {
            audio.sunk();
            addLog(`O inimigo afundou seu ${ship.name}!`, "big");
        } else {
            addLog(`Inimigo: ${coord(r, c)} — acertou!`, "enemy");
        }
    }
    render();
    spawnFx(ui.playerBoard, playerCells[r][c], result);

    if (!shipsLeft(state.player)) {
        endGame(false);
        return;
    }
    state.turn = "player";
    setStatus(result === "miss" ? "O inimigo errou. Sua vez!" : "Você foi atingido! Sua vez.", result === "miss" ? "good" : "bad");
    render();
};

const endGame = (won) => {
    state.phase = "over";
    if (won) {
        state.wins++;
        storage.set(WINS_KEY, String(state.wins));
        audio.victory();
    } else {
        audio.defeat();
    }
    render();
    const acc = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
    $("overlay-title").textContent = won ? "Vitória!" : "Derrota";
    $("overlay-text").textContent = won
        ? `Você afundou toda a frota inimiga com ${state.shots} disparos (${acc}% de precisão).`
        : `Sua frota foi afundada. Você acertou ${state.hits} de ${state.shots} disparos.`;
    ui.overlay.className = `overlay ${won ? "win" : "lose"}`;
    setTimeout(() => {
        ui.overlay.hidden = false;
        $("btn-again").focus();
    }, 900);
    setStatus(won ? "Vitória! 🎉" : "Sua frota foi derrotada.", won ? "good" : "bad");
};

// =====================================================================
// Eventos
// =====================================================================

const cellFromEvent = (event) => {
    const cell = event.target.closest(".cell");
    return cell ? { r: Number(cell.dataset.r), c: Number(cell.dataset.c) } : null;
};

ui.playerBoard.addEventListener("click", (event) => {
    const p = cellFromEvent(event);
    if (p && state.phase === "setup") placeCurrentShip(p.r, p.c);
});

ui.playerBoard.addEventListener("pointerover", (event) => {
    if (state.phase !== "setup") return;
    const p = cellFromEvent(event);
    if (p && (state.hover?.r !== p.r || state.hover?.c !== p.c)) {
        state.hover = p;
        render();
    }
});

// Botão direito do mouse gira o navio durante o posicionamento.
ui.playerBoard.addEventListener("contextmenu", (event) => {
    if (state.phase !== "setup") return;
    event.preventDefault();
    rotate();
});

ui.playerBoard.addEventListener("pointerleave", () => {
    state.hover = null;
    if (state.phase === "setup") render();
});

ui.enemyBoard.addEventListener("click", (event) => {
    const p = cellFromEvent(event);
    if (p) playerFire(p.r, p.c);
});

const rotate = () => {
    state.horizontal = !state.horizontal;
    render();
};

$("btn-rotate").addEventListener("click", rotate);
$("btn-random").addEventListener("click", randomizePlayer);
$("btn-clear").addEventListener("click", () => {
    state.player = createBoard();
    state.placingIndex = 0;
    setStatus("Posicione sua frota.");
    render();
});
$("btn-start").addEventListener("click", startBattle);
$("btn-new").addEventListener("click", newGame);
$("btn-again").addEventListener("click", newGame);

const updateSoundButton = () => {
    $("btn-sound").textContent = audio.enabled ? "🔊" : "🔇";
};
const toggleSound = () => {
    audio.enabled = !audio.enabled;
    storage.set(SOUND_KEY, audio.enabled ? "1" : "0");
    updateSoundButton();
};
$("btn-sound").addEventListener("click", toggleSound);

ui.difficulty.value = storage.get(DIFF_KEY) || "normal";
ui.difficulty.addEventListener("change", () => storage.set(DIFF_KEY, ui.difficulty.value));

window.addEventListener("keydown", (event) => {
    if (event.target.tagName === "SELECT") return;
    const key = event.code;
    if (key === "KeyR" && state.phase === "setup") rotate();
    else if (key === "KeyM") toggleSound();
    else if (key === "KeyN") newGame();
    else if (state.phase === "battle") {
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[key]) {
            event.preventDefault();
            const [dr, dc] = moves[key];
            state.cursor = {
                r: (state.cursor.r + dr + SIZE) % SIZE,
                c: (state.cursor.c + dc + SIZE) % SIZE,
            };
            render();
            enemyCells[state.cursor.r][state.cursor.c].focus({ preventScroll: true });
        } else if (key === "Enter" || key === "Space" || key === "NumpadEnter") {
            event.preventDefault();
            playerFire(state.cursor.r, state.cursor.c);
        }
    } else if (state.phase === "setup" && key === "Enter" && state.placingIndex >= FLEET.length) {
        startBattle();
    } else if (state.phase === "over" && key === "Enter") {
        newGame();
    }
});

// Libera o áudio no primeiro gesto do usuário
window.addEventListener("pointerdown", () => audio.ensure(), { once: true });
window.addEventListener("keydown", () => audio.ensure(), { once: true });

buildBoard(ui.playerBoard, playerCells, false);
buildBoard(ui.enemyBoard, enemyCells, true);
updateSoundButton();
newGame();
