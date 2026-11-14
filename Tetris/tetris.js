"use strict";

// =====================================================================
// Configuração
// =====================================================================

const SHAPES = [
    // I
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    // J
    [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    // L
    [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],
    // O
    [
        [1, 1],
        [1, 1],
    ],
    // S
    [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    // T
    [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    // Z
    [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
];

const SHAPE_COLORS = ["#00BCD4", "#485FE5", "#FF9800", "#FFEB3B", "#4CAF50", "#A629BC", "#F44336", "#8F755C", "#CCF2FF"];

// Peças especiais (como no jogo em Java/libGDX), ativadas com a tecla E:
//  - PEDRA: ao pousar se desfaz e quebra a peça em que bateu;
//  - TRANSPARENTE: atravessa os blocos e pousa na célula vazia mais baixa da coluna (tapa buracos).
const STONE = 7;
const GHOST = 8;
SHAPES.push([[1]], [[1]]);
const GHOST_ALPHA = 0.45;
const SPECIAL_MIN_HEIGHT = 5; // só surgem com a pilha chegando à 5ª linha
const SPECIAL_PIECE_CHANCE = 0.07; // chance de cada peça especial
const GHOST_BEEP_INTERVAL = 600; // ms
const SPECIALS_KEY = "dinogames-tetris-specials";

const GRID_COLS = 10;
const GRID_ROWS = 20;
const BLOCK_EMPTY = -1;

// Layout lógico do canvas (em pixels CSS antes da escala)
const BLOCK = 32;
const PREVIEW_BLOCK = 22;
const PAD = 16;
const SIDE_W = 160;
const GRID_W = GRID_COLS * BLOCK;
const GRID_H = GRID_ROWS * BLOCK;
const HUD_H = 96; // altura do painel superior no layout compacto (celular)

// Variáveis de layout: mudam entre o modo largo (computador) e o compacto (celular em pé)
let compact = false;
let GRID_X, GRID_Y, RIGHT_X, CANVAS_W, CANVAS_H;

const LAYOUTS = {
    wide: { w: PAD * 4 + SIDE_W * 2 + GRID_W, h: GRID_H + PAD * 2 },
    compact: { w: GRID_W + PAD * 2, h: PAD + HUD_H + 12 + GRID_H + PAD },
};

const setLayout = (isCompact) => {
    compact = isCompact;
    if (compact) {
        GRID_X = PAD;
        GRID_Y = PAD + HUD_H + 12;
        RIGHT_X = 0;
        CANVAS_W = LAYOUTS.compact.w;
        CANVAS_H = LAYOUTS.compact.h;
    } else {
        GRID_X = PAD + SIDE_W + PAD;
        GRID_Y = PAD;
        RIGHT_X = GRID_X + GRID_W + PAD;
        CANVAS_W = LAYOUTS.wide.w;
        CANVAS_H = LAYOUTS.wide.h;
    }
};
setLayout(false);

// Tempos (ms)
const DAS_DELAY = 160; // atraso antes de repetir o movimento lateral
const ARR_INTERVAL = 45; // intervalo de repetição lateral
const SOFT_DROP_INTERVAL = 35;
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const CLEAR_ANIMATION = 180; // linhas racham por um instante antes de estilhaçar
const MAX_DT = 100;

const LINE_SCORES = [0, 100, 300, 500, 800];
const LINES_PER_LEVEL = 10;
const NEXT_COUNT = 3;
const HIGH_SCORE_KEY = "dinogames-tetris-high";
const SOUND_KEY = "dinogames-tetris-sound";

// Escala dos efeitos: o jogo original em Java usa blocos de 60 px.
const UNIT = BLOCK / 60;

// Fim de jogo: cada linha (de baixo para cima) fica cinza com um pequeno atraso.
const GAME_OVER_ROW_DELAY = 0.06;
const GAME_OVER_FADE = 0.25;

// Tom do cenário a cada nível (volta ao início depois do último).
const LEVEL_TINTS = [
    { r: 0.25, g: 0.85, b: 1.0 }, // ciano
    { r: 0.3, g: 0.85, b: 0.75 }, // verde-água
    { r: 0.55, g: 0.45, b: 1.0 }, // violeta
    { r: 1.0, g: 0.5, b: 0.75 }, // rosa
    { r: 1.0, g: 0.7, b: 0.35 }, // âmbar
    { r: 0.45, g: 0.9, b: 0.4 }, // verde
    { r: 0.95, g: 0.45, b: 0.4 }, // coral
];

// Deslocamentos tentados ao girar perto de paredes/peças ("wall kicks")
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];

const KEY_TO_ACTION = {
    ArrowLeft: "moveLeft",
    KeyA: "moveLeft",
    ArrowRight: "moveRight",
    KeyD: "moveRight",
    ArrowDown: "softDrop",
    KeyS: "softDrop",
    ArrowUp: "rotateCW",
    KeyX: "rotateCW",
    KeyW: "rotateCW",
    KeyZ: "rotateCCW",
    ControlLeft: "rotateCCW",
    Space: "hardDrop",
    KeyC: "hold",
    ShiftLeft: "hold",
    ShiftRight: "hold",
    KeyP: "pause",
    Escape: "pause",
    KeyR: "restart",
    KeyM: "mute",
    KeyE: "specials",
    Enter: "confirm",
    NumpadEnter: "confirm",
};

const COLORS = {
    background: "#0f121a",
    panel: "#171b26",
    panelBorder: "#262c3d",
    grid: "#1b1f2b",
    gridLine: "#222838",
    text: "#ffffff",
    textDim: "#8b93a7",
    accent: "#00BCD4",
    overlay: "rgba(8, 10, 16, 0.78)",
};

// =====================================================================
// Utilitários
// =====================================================================

const randomInt = (n) => Math.floor(Math.random() * n);

const storage = {
    get(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch { /* indisponível */ }
    },
};

const makeEmptyGrid = () =>
    Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(BLOCK_EMPTY));

const rotateCW = (shape) =>
    shape[0].map((_, i) => shape.map((row) => row[i]).reverse());

const rotateCCW = (shape) =>
    shape[0].map((_, i) => shape.map((row) => row[row.length - 1 - i]));

// "Saco" com as 7 peças embaralhadas: garante distribuição justa
const makeBag = () => {
    const bag = SHAPES.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
};

// Velocidade de queda por nível (curva semelhante à dos jogos modernos)
const gravityInterval = (level) =>
    Math.max(16, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);

// =====================================================================
// Estado do jogo
// =====================================================================

const state = {
    phase: "start", // start | playing | paused | over
    grid: makeEmptyGrid(),
    pieceIds: makeEmptyGrid(), // a qual peça pertence cada célula (usado pela pedra)
    pieceSerial: 0,
    specials: storage.get(SPECIALS_KEY) === "1",
    ghostBeepTimer: 0,
    bag: [],
    queue: [],
    current: null,
    holdId: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    high: Number(storage.get(HIGH_SCORE_KEY)) || 0,
    newRecord: false,
    gravityTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    clearing: null, // { rows: number[], timer: number }
    popups: [], // textos flutuantes: { text, timer }

    // Efeitos visuais
    time: 0,
    tint: { ...LEVEL_TINTS[0] },
    shake: 0,
    displayScore: 0,
    pieceOffsetY: 0,
    gameOverTime: 0,
    gameOverRowsDone: 0,
    gameOverRows: 0,
};

const particles = TetrisFX.createParticles(UNIT);
const sounds = TetrisFX.createSounds(storage.get(SOUND_KEY) !== "0");

const input = {
    held: {}, // ação -> true enquanto pressionada
    pending: [], // ações disparadas uma vez
    horizontal: null, // última direção lateral pressionada
    dasTimer: 0,
    arrTimer: 0,
};

// Altura da pilha (em linhas ocupadas a partir do fundo).
const stackHeight = () => {
    const top = state.grid.findIndex((row) => row.some((cell) => cell !== BLOCK_EMPTY));
    return top < 0 ? 0 : GRID_ROWS - top;
};

const nextShapeId = () => {
    if (state.specials && stackHeight() >= SPECIAL_MIN_HEIGHT) {
        const roll = Math.random();
        if (roll < SPECIAL_PIECE_CHANCE) return STONE;
        if (roll < SPECIAL_PIECE_CHANCE * 2) return GHOST;
    }
    if (state.bag.length === 0) state.bag = makeBag();
    return state.bag.pop();
};

const isSpecial = (id) => id === STONE || id === GHOST;

const createPiece = (id) => {
    const shape = SHAPES[id];
    const emptyTop = shape.findIndex((row) => row.some(Boolean));
    return {
        id,
        shape,
        x: Math.floor((GRID_COLS - shape[0].length) / 2),
        y: -emptyTop,
    };
};

const fits = (shape, x, y) =>
    shape.every((row, i) =>
        row.every((solid, j) => {
            if (!solid) return true;
            const gx = x + j;
            const gy = y + i;
            if (gx < 0 || gx >= GRID_COLS || gy >= GRID_ROWS) return false;
            return gy < 0 || state.grid[gy][gx] === BLOCK_EMPTY;
        })
    );

// Linha da célula vazia mais baixa da coluna (-1 se a coluna estiver cheia).
const lowestEmptyRow = (col) => {
    for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (state.grid[r][col] === BLOCK_EMPTY) return r;
    }
    return -1;
};

// A peça transparente atravessa blocos, mas não passa da célula vazia mais baixa da coluna.
const pieceFits = (piece, x, y, shape = piece.shape) => {
    if (piece.id === GHOST) return x >= 0 && x < GRID_COLS && y <= lowestEmptyRow(x);
    return fits(shape, x, y);
};

const isGrounded = () => {
    const piece = state.current;
    return !pieceFits(piece, piece.x, piece.y + 1);
};

const resetGame = () => {
    Object.assign(state, {
        phase: "playing",
        grid: makeEmptyGrid(),
        pieceIds: makeEmptyGrid(),
        pieceSerial: 0,
        bag: [],
        queue: [],
        current: null,
        holdId: null,
        canHold: true,
        score: 0,
        lines: 0,
        level: 1,
        newRecord: false,
        gravityTimer: 0,
        lockTimer: 0,
        lockResets: 0,
        clearing: null,
        popups: [],
        shake: 0,
        displayScore: 0,
        pieceOffsetY: 0,
    });
    particles.clear();
    sounds.play("start", 0.8);

    for (let i = 0; i < NEXT_COUNT; i++) state.queue.push(nextShapeId());
    spawn(state.queue.shift());
};

const spawn = (id) => {
    if (state.queue.length < NEXT_COUNT) state.queue.push(nextShapeId());

    state.current = createPiece(id);
    state.pieceOffsetY = 0;
    state.gravityTimer = 0;
    state.lockTimer = 0;
    state.lockResets = 0;

    state.ghostBeepTimer = GHOST_BEEP_INTERVAL;
    if (id === GHOST) sounds.play("beep", 0.5);

    if (!pieceFits(state.current, state.current.x, state.current.y)) {
        gameOver();
    }
};

const spawnNext = () => {
    state.canHold = true;
    spawn(state.queue.shift());
};

const addScore = (points) => {
    state.score += points;
    if (state.score > state.high) {
        state.high = state.score;
        state.newRecord = true;
        storage.set(HIGH_SCORE_KEY, String(state.high));
    }
};

const gameOver = () => {
    state.phase = "over";
    input.held = {};

    // Animação: linhas ocupadas ficam cinza de baixo para cima
    const topRow = state.grid.findIndex((row) => row.some((cell) => cell !== BLOCK_EMPTY));
    state.gameOverRows = topRow < 0 ? 0 : GRID_ROWS - topRow;
    state.gameOverTime = 0;
    state.gameOverRowsDone = 0;
    state.shake = 18 * UNIT;
    sounds.play("gameOver", 0.9);
};

const setPaused = (paused) => {
    if (paused && state.phase === "playing") state.phase = "paused";
    else if (!paused && state.phase === "paused") state.phase = "playing";
};

// =====================================================================
// Ações do jogador
// =====================================================================

const onPieceAdjusted = () => {
    // Mover/girar no chão reinicia o tempo de travamento (com limite)
    if (isGrounded() && state.lockResets < MAX_LOCK_RESETS) {
        state.lockTimer = 0;
        state.lockResets++;
    }
};

const tryMove = (dx, dy) => {
    const piece = state.current;
    if (!pieceFits(piece, piece.x + dx, piece.y + dy)) return false;
    piece.x += dx;
    piece.y += dy;
    if (dx !== 0) {
        onPieceAdjusted();
        sounds.play("move", 0.4);
    }
    return true;
};

// Desce uma linha deixando o rastro de jato e suavizando o movimento.
const movePieceDown = () => {
    if (!tryMove(0, 1)) return false;
    const piece = state.current;
    state.pieceOffsetY = Math.min(state.pieceOffsetY + BLOCK, BLOCK * 1.5);

    const cols = piece.shape[0].length;
    for (let j = 0; j < cols; j++) {
        // Primeiro bloco (de cima para baixo) da coluna: o rastro sai da célula acima dele
        const i = piece.shape.findIndex((row) => row[j]);
        if (i < 0) continue;
        const vacatedRow = piece.y + i - 1;
        if (vacatedRow < 0) continue;
        const x = GRID_X + (piece.x + j) * BLOCK + BLOCK / 2;
        const y = GRID_Y + vacatedRow * BLOCK;
        particles.trail(x, y, BLOCK, SHAPE_COLORS[piece.id]);
    }
    return true;
};

// Queda rápida: faixa de luz por coluna, de onde a peça estava até onde pousou, e impacto no chão.
const hardDropEffect = (startY) => {
    const piece = state.current;
    const color = SHAPE_COLORS[piece.id];
    const cols = piece.shape[0].length;
    for (let j = 0; j < cols; j++) {
        let top = -1;
        let bottom = -1;
        piece.shape.forEach((row, i) => {
            if (!row[j]) return;
            if (top < 0) top = i;
            bottom = i;
        });
        if (top < 0) continue;
        const x = GRID_X + (piece.x + j) * BLOCK + BLOCK / 2;
        const yTop = Math.max(GRID_Y, GRID_Y + (startY + top) * BLOCK);
        const yBottom = GRID_Y + (piece.y + bottom + 1) * BLOCK;
        particles.dropStreak(x, yTop, yBottom, BLOCK, color);
        particles.impact(x, yBottom, BLOCK, color);
    }
    state.shake = Math.max(state.shake, (6 + Math.min(piece.y - startY, 20) * 0.5) * UNIT);
};

const tryRotate = (clockwise) => {
    const piece = state.current;
    if (isSpecial(piece.id)) return false; // peças de um só quadrado não giram
    const shape = clockwise ? rotateCW(piece.shape) : rotateCCW(piece.shape);

    for (const [kx, ky] of KICKS) {
        const kickX = clockwise ? kx : -kx;
        if (fits(shape, piece.x + kickX, piece.y + ky)) {
            piece.shape = shape;
            piece.x += kickX;
            piece.y += ky;
            onPieceAdjusted();
            sounds.play("rotate", 0.55);
            return true;
        }
    }
    return false;
};

const hardDrop = () => {
    const startY = state.current.y;
    let rows = 0;
    while (pieceFits(state.current, state.current.x, state.current.y + 1)) {
        state.current.y++;
        rows++;
    }
    addScore(rows * 2);
    sounds.play("jet", 0.8);
    if (rows > 0) hardDropEffect(startY);
    state.pieceOffsetY = 0;
    lockPiece();
};

const hold = () => {
    if (!state.canHold) return;
    const currentId = state.current.id;

    if (state.holdId === null) {
        state.holdId = currentId;
        spawn(state.queue.shift());
    } else {
        const heldId = state.holdId;
        state.holdId = currentId;
        spawn(heldId);
    }
    state.canHold = false;
};

const ghostY = () => {
    const piece = state.current;
    let y = piece.y;
    while (pieceFits(piece, piece.x, y + 1)) y++;
    return y;
};

// A pedra se desfaz ao pousar, levando junto a peça em que bateu (se houver).
const smashWithStone = () => {
    const { x, y } = state.current;
    const stoneX = GRID_X + x * BLOCK;
    const centerX = stoneX + BLOCK / 2;
    particles.shatterBlock(stoneX, GRID_Y + y * BLOCK, BLOCK, SHAPE_COLORS[STONE], centerX);

    const below = y + 1;
    const hitPiece = below < GRID_ROWS && state.grid[below][x] !== BLOCK_EMPTY;
    if (hitPiece) {
        const target = state.pieceIds[below][x];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                if (state.grid[r][c] === BLOCK_EMPTY || state.pieceIds[r][c] !== target) continue;
                const bx = GRID_X + c * BLOCK;
                const by = GRID_Y + r * BLOCK;
                particles.shatterBlock(bx, by, BLOCK, SHAPE_COLORS[state.grid[r][c]], centerX);
                particles.lineFlash(bx, by, BLOCK, BLOCK);
                state.grid[r][c] = BLOCK_EMPTY;
                state.pieceIds[r][c] = 0;
            }
        }
        addScore(25 * state.level);
    }
    state.shake = (hitPiece ? 20 : 8) * UNIT;
    sounds.play("stone", hitPiece ? 1 : 0.6);
    spawnNext();
};

const lockPiece = () => {
    const { id, shape, x, y } = state.current;
    if (id === STONE) {
        smashWithStone();
        return;
    }
    if (id === GHOST) sounds.play("beep", 0.7, 1.5);

    let lockedAboveTop = false;
    state.pieceSerial++;

    shape.forEach((row, i) =>
        row.forEach((solid, j) => {
            if (!solid) return;
            const gy = y + i;
            if (gy < 0) lockedAboveTop = true;
            else {
                state.grid[gy][x + j] = id;
                state.pieceIds[gy][x + j] = state.pieceSerial;
            }
        })
    );

    if (lockedAboveTop) {
        gameOver();
        return;
    }

    const fullRows = [];
    state.grid.forEach((row, i) => {
        if (row.every((cell) => cell !== BLOCK_EMPTY)) fullRows.push(i);
    });

    if (fullRows.length > 0) {
        const cleared = fullRows.length;
        addScore(LINE_SCORES[Math.min(cleared, 4)] * state.level);
        state.lines += cleared;

        const newLevel = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
        if (newLevel > state.level) {
            state.level = newLevel;
            state.popups.push({ text: `NÍVEL ${newLevel}!`, timer: 0 });
            sounds.play("levelUp", 0.9);
        }

        // Som de vidro estilhaçando: mais forte e grave quanto mais linhas
        sounds.play("shatter", Math.min(1, 0.6 + 0.1 * cleared), 1.1 - 0.07 * cleared);

        const names = ["", "", "DUPLA!", "TRIPLA!", "TETRIS!"];
        if (names[cleared]) state.popups.push({ text: names[cleared], timer: 0 });

        state.clearing = { rows: fullRows, timer: 0 };
        state.current = null;
    } else {
        spawnNext();
    }
};

// Estilhaça as linhas completas: cacos de vidro, flash e, num TETRIS, onda de choque.
const shatterClearedRows = () => {
    const rows = state.clearing.rows;
    const centerX = GRID_X + GRID_W / 2;
    rows.forEach((row) => {
        const y = GRID_Y + row * BLOCK;
        state.grid[row].forEach((cell, c) => {
            if (cell !== BLOCK_EMPTY) particles.shatterBlock(GRID_X + c * BLOCK, y, BLOCK, SHAPE_COLORS[cell], centerX);
        });
        particles.lineFlash(GRID_X, y, GRID_W, BLOCK);
    });

    const cleared = rows.length;
    state.shake = (8 + 6 * cleared) * UNIT;
    if (cleared === 4) {
        const midRow = (rows[0] + rows[cleared - 1]) / 2;
        particles.shockwave(centerX, GRID_Y + (midRow + 0.5) * BLOCK, state.tint);
        state.shake = 40 * UNIT;
    }
};

const removeClearedRows = () => {
    const rows = new Set(state.clearing.rows);
    const remaining = state.grid.filter((_, i) => !rows.has(i));
    const remainingIds = state.pieceIds.filter((_, i) => !rows.has(i));
    while (remaining.length < GRID_ROWS) {
        remaining.unshift(Array(GRID_COLS).fill(BLOCK_EMPTY));
        remainingIds.unshift(Array(GRID_COLS).fill(0));
    }
    state.grid = remaining;
    state.pieceIds = remainingIds;
    state.clearing = null;
};

// =====================================================================
// Atualização
// =====================================================================

const handleAction = (action) => {
    if (action === "restart") {
        resetGame();
        return;
    }

    if (action === "confirm") {
        if (state.phase === "start" || state.phase === "over") resetGame();
        else if (state.phase === "paused") setPaused(false);
        return;
    }

    if (action === "specials") {
        state.specials = !state.specials;
        storage.set(SPECIALS_KEY, state.specials ? "1" : "0");
        state.popups.push({ text: state.specials ? "ESPECIAIS: SIM" : "ESPECIAIS: NÃO", timer: 0 });
        // Remove peças especiais já sorteadas da fila ao desativar
        if (!state.specials) state.queue = state.queue.map((id) => (isSpecial(id) ? nextShapeId() : id));
        return;
    }

    if (action === "mute") {
        storage.set(SOUND_KEY, sounds.toggle() ? "1" : "0");
        return;
    }

    if (action === "pause") {
        if (state.phase === "playing") setPaused(true);
        else if (state.phase === "paused") setPaused(false);
        return;
    }

    if (state.phase !== "playing" || !state.current) return;

    switch (action) {
        case "moveLeft":
            tryMove(-1, 0);
            break;
        case "moveRight":
            tryMove(1, 0);
            break;
        case "rotateCW":
            tryRotate(true);
            break;
        case "rotateCCW":
            tryRotate(false);
            break;
        case "hardDrop":
            hardDrop();
            break;
        case "hold":
            hold();
            break;
        default:
            break;
    }
};

const updateHorizontal = (dt) => {
    const dir = input.horizontal;
    if (!dir || !input.held[dir] || !state.current) return;

    input.dasTimer += dt;
    if (input.dasTimer < DAS_DELAY) return;

    input.arrTimer += dt;
    while (input.arrTimer >= ARR_INTERVAL) {
        input.arrTimer -= ARR_INTERVAL;
        if (!tryMove(dir === "moveLeft" ? -1 : 1, 0)) break;
    }
};

const updateGravity = (dt) => {
    const softDrop = Boolean(input.held.softDrop);
    const interval = softDrop
        ? Math.min(SOFT_DROP_INTERVAL, gravityInterval(state.level))
        : gravityInterval(state.level);

    state.gravityTimer += dt;
    while (state.gravityTimer >= interval) {
        state.gravityTimer -= interval;
        if (movePieceDown()) {
            if (softDrop) addScore(1);
        } else {
            state.gravityTimer = 0;
            break;
        }
    }

    if (isGrounded()) {
        state.lockTimer += dt;
        if (state.lockTimer >= LOCK_DELAY) lockPiece();
    } else {
        state.lockTimer = 0;
    }
};

const updateEffects = (seconds) => {
    state.time += seconds;
    particles.update(seconds);

    // Peça desliza suavemente para a nova linha
    state.pieceOffsetY -= state.pieceOffsetY * Math.min(1, seconds * 22);

    // Placar "conta" até o valor real
    state.displayScore += (state.score - state.displayScore) * Math.min(1, seconds * 8);
    if (Math.abs(state.score - state.displayScore) < 0.5) state.displayScore = state.score;

    // Tom do cenário acompanha o nível
    const target = LEVEL_TINTS[(state.level - 1) % LEVEL_TINTS.length];
    const k = Math.min(1, seconds * 1.2);
    state.tint.r += (target.r - state.tint.r) * k;
    state.tint.g += (target.g - state.tint.g) * k;
    state.tint.b += (target.b - state.tint.b) * k;

    // Tremor de tela
    state.shake = Math.max(0, state.shake - seconds * 60 * UNIT);

    // Fim de jogo: cada linha que fica cinza solta um flash
    if (state.phase === "over") {
        state.gameOverTime += seconds;
        while (state.gameOverRowsDone < state.gameOverRows &&
            state.gameOverTime >= state.gameOverRowsDone * GAME_OVER_ROW_DELAY) {
            const row = GRID_ROWS - 1 - state.gameOverRowsDone;
            if (state.grid[row].some((cell) => cell !== BLOCK_EMPTY)) {
                particles.lineFlash(GRID_X, GRID_Y + row * BLOCK, GRID_W, BLOCK);
            }
            state.gameOverRowsDone++;
        }
    }
};

const update = (dt) => {
    while (input.pending.length > 0) handleAction(input.pending.shift());

    state.popups.forEach((p) => (p.timer += dt));
    state.popups = state.popups.filter((p) => p.timer < 1200);
    updateEffects(dt / 1000);

    if (state.phase !== "playing") return;

    if (state.clearing) {
        state.clearing.timer += dt;
        if (state.clearing.timer >= CLEAR_ANIMATION) {
            shatterClearedRows();
            removeClearedRows();
            spawnNext();
        }
        return;
    }

    updateHorizontal(dt);
    if (state.phase === "playing" && state.current) {
        if (state.current.id === GHOST) {
            state.ghostBeepTimer -= dt;
            if (state.ghostBeepTimer <= 0) {
                sounds.play("beep", 0.5);
                state.ghostBeepTimer = GHOST_BEEP_INTERVAL;
            }
        }
        updateGravity(dt);
    }
};

// =====================================================================
// Desenho
// =====================================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let renderScale = 1; // pixels reais por pixel lógico (inclui devicePixelRatio)
let backgroundCanvas = null;

const { css } = TetrisFX;

const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
};

// Cor cinza equivalente (usada na animação de fim de jogo).
const grayHex = (hex) => {
    const { r, g, b } = TetrisFX.hexToRgb(hex);
    const gray = Math.round((0.12 + 0.4 * (0.3 * r + 0.59 * g + 0.11 * b)) * 255);
    const h = gray.toString(16).padStart(2, "0");
    return `#${h}${h}${h}`;
};

// Bloco de vidro 3D (textura gerada e guardada em cache por cor/tamanho).
const drawBlock = (x, y, size, color, alpha = 1) => {
    const px = Math.round(size * renderScale);
    ctx.globalAlpha = color === SHAPE_COLORS[GHOST] ? alpha * GHOST_ALPHA : alpha;
    const texture = color === SHAPE_COLORS[STONE] ? TetrisFX.stoneBlock(px) : TetrisFX.glassBlock(color, px);
    ctx.drawImage(texture, x, y, size, size);
    ctx.globalAlpha = 1;
};

const drawBlockShadow = (x, y, size) => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x + size * 0.1, y + size * 0.1, size, size);
};

const forEachCell = (shape, fn) =>
    shape.forEach((row, i) => row.forEach((solid, j) => solid && fn(i, j)));

const drawPreview = (id, cx, cy, size, alpha = 1) => {
    const shape = SHAPES[id];
    let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
    forEachCell(shape, (i, j) => {
        minR = Math.min(minR, i); maxR = Math.max(maxR, i);
        minC = Math.min(minC, j); maxC = Math.max(maxC, j);
    });
    const w = (maxC - minC + 1) * size;
    const h = (maxR - minR + 1) * size;
    const ox = cx - w / 2;
    const oy = cy - h / 2;
    forEachCell(shape, (i, j) =>
        drawBlock(ox + (j - minC) * size, oy + (i - minR) * size, size, SHAPE_COLORS[id], alpha)
    );
};

// Moldura neon com halo na cor do nível.
const drawNeonFrame = (x, y, w, h, alpha = 1) => {
    const tint = state.tint;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 3; i >= 1; i--) {
        const k = i * 3 * UNIT;
        ctx.lineWidth = (3 + 2 * k) * UNIT;
        ctx.strokeStyle = css(tint, 0.06 * alpha);
        ctx.strokeRect(x - k, y - k, w + 2 * k, h + 2 * k);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 3 * UNIT;
    ctx.strokeStyle = css(tint, 0.95 * alpha);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
};

// Painel de vidro escuro com borda neon suave.
const drawPanel = (x, y, w, h, label) => {
    ctx.fillStyle = "rgba(8, 11, 24, 0.62)";
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(state.tint, 0.45);
    ctx.stroke();

    if (label) {
        text(label, x + 14, y + 12, { size: 13, color: css(state.tint, 0.9) });
    }
};

const text = (value, x, y, { size = 16, color = COLORS.text, align = "left", baseline = "top", weight = "bold" } = {}) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(value, x, y);
};

// Fundo futurista com véu do nível e orbes de luz flutuando.
const drawBackground = () => {
    if (backgroundCanvas) ctx.drawImage(backgroundCanvas, -12, -12, CANVAS_W + 24, CANVAS_H + 24);
    else {
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const tint = state.tint;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = css(tint, 0.13);
    ctx.fillRect(-12, -12, CANVAS_W + 24, CANVAS_H + 24);

    for (let i = 0; i < 5; i++) {
        const phase = i * 1.7;
        const ox = CANVAS_W * (0.1 + 0.2 * i) + Math.sin(state.time * 0.15 + phase) * 90 * UNIT;
        const oy = CANVAS_H * (0.25 + 0.13 * ((i * 3) % 5)) + Math.cos(state.time * 0.11 + phase) * 70 * UNIT;
        const size = (420 + 120 * (i % 3)) * UNIT;
        const color = i % 2 === 0
            ? tint
            : { r: 0.5 + tint.r * 0.5, g: 0.3 + tint.g * 0.4, b: 0.5 + tint.b * 0.5 };
        ctx.globalAlpha = i % 2 === 0 ? 0.14 : 0.1;
        ctx.drawImage(TetrisFX.glow(color), ox - size / 2, oy - size / 2, size, size);
    }
    ctx.restore();
};

const drawGrid = () => {
    const tint = state.tint;

    // Vidro escuro levemente tingido com grade sutil
    ctx.fillStyle = css({ r: 0.02 + tint.r * 0.1, g: 0.02 + tint.g * 0.1, b: 0.04 + tint.b * 0.1 }, 0.78);
    ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H);

    ctx.fillStyle = css({ r: 0.3 + tint.r * 0.4, g: 0.3 + tint.g * 0.4, b: 0.3 + tint.b * 0.4 }, 0.1);
    for (let c = 1; c < GRID_COLS; c++) ctx.fillRect(GRID_X + c * BLOCK - 0.5, GRID_Y, 1, GRID_H);
    for (let r = 1; r < GRID_ROWS; r++) ctx.fillRect(GRID_X, GRID_Y + r * BLOCK - 0.5, GRID_W, 1);
    drawNeonFrame(GRID_X, GRID_Y, GRID_W, GRID_H);

    // Sombras primeiro, depois os blocos (dá profundidade ao vidro)
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID_X, GRID_Y, GRID_W, GRID_H);
    ctx.clip();
    state.grid.forEach((row, i) =>
        row.forEach((cell, j) => {
            if (cell !== BLOCK_EMPTY && cell !== GHOST) drawBlockShadow(GRID_X + j * BLOCK, GRID_Y + i * BLOCK, BLOCK);
        })
    );
    ctx.restore();

    state.grid.forEach((row, i) => {
        // No fim de jogo a linha passa ao cinza quando chega a vez dela (de baixo para cima)
        const grayT = state.phase === "over"
            ? Math.max(0, Math.min(1, (state.gameOverTime - (GRID_ROWS - 1 - i) * GAME_OVER_ROW_DELAY) / GAME_OVER_FADE))
            : 0;
        row.forEach((cell, j) => {
            if (cell === BLOCK_EMPTY) return;
            const x = GRID_X + j * BLOCK;
            const y = GRID_Y + i * BLOCK;
            const color = SHAPE_COLORS[cell];
            if (grayT < 1) drawBlock(x, y, BLOCK, color);
            if (grayT > 0) drawBlock(x, y, BLOCK, grayHex(color), grayT);
        });
    });

    // Linhas completas rachando antes de estilhaçar
    if (state.clearing) {
        const progress = Math.min(1, state.clearing.timer / CLEAR_ANIMATION);
        const crackTextures = TetrisFX.cracks(Math.round(BLOCK * renderScale));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        state.clearing.rows.forEach((row) => {
            for (let c = 0; c < GRID_COLS; c++) {
                const x = GRID_X + c * BLOCK;
                const y = GRID_Y + row * BLOCK;
                ctx.globalAlpha = 0.25 + 0.6 * progress;
                ctx.drawImage(crackTextures[(row * 7 + c) % crackTextures.length], x, y, BLOCK, BLOCK);
                ctx.globalAlpha = 0.35 * progress;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x, y, BLOCK, BLOCK);
            }
        });
        ctx.restore();
    }
};

// Peça fantasma: contorno pulsante mostrando onde a peça vai pousar.
const drawLandingPreview = () => {
    const piece = state.current;
    if (!piece || state.phase !== "playing") return;
    const gy = ghostY();
    if (gy === piece.y) return;

    const color = TetrisFX.hexToRgb(SHAPE_COLORS[piece.id]);
    const pulse = 0.85 + 0.15 * Math.sin(state.time * 4);
    ctx.lineWidth = 3 * UNIT;
    forEachCell(piece.shape, (i, j) => {
        if (gy + i < 0) return;
        const x = GRID_X + (piece.x + j) * BLOCK + 3 * UNIT;
        const y = GRID_Y + (gy + i) * BLOCK + 3 * UNIT;
        const size = BLOCK - 6 * UNIT;
        ctx.fillStyle = css(color, 0.1);
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = css(color, 0.55 * pulse);
        ctx.strokeRect(x, y, size, size);
    });
};

const drawCurrentPiece = () => {
    const piece = state.current;
    if (!piece || state.phase === "over") return;
    const color = SHAPE_COLORS[piece.id];
    const offset = state.pieceOffsetY;

    // Pisca levemente enquanto está prestes a travar
    const lockFade = isGrounded() ? 1 - (state.lockTimer / LOCK_DELAY) * 0.35 : 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID_X, GRID_Y, GRID_W, GRID_H);
    ctx.clip();
    if (piece.id === GHOST) {
        // Halo pulsante: mantém a peça visível enquanto atravessa os outros blocos
        const halo = BLOCK * 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(state.time * 8);
        ctx.drawImage(TetrisFX.glow({ r: 0.7, g: 0.95, b: 1 }),
            GRID_X + piece.x * BLOCK - BLOCK / 2, GRID_Y + piece.y * BLOCK - offset - BLOCK / 2, halo, halo);
        ctx.restore();
    } else {
        forEachCell(piece.shape, (i, j) =>
            drawBlockShadow(GRID_X + (piece.x + j) * BLOCK, GRID_Y + (piece.y + i) * BLOCK - offset, BLOCK)
        );
    }
    forEachCell(piece.shape, (i, j) =>
        drawBlock(GRID_X + (piece.x + j) * BLOCK, GRID_Y + (piece.y + i) * BLOCK - offset, BLOCK, color, lockFade)
    );
    ctx.restore();
};

const scoreText = () => String(Math.round(state.displayScore)).padStart(7, "0");

const drawLeftPanel = () => {
    const x = PAD;
    drawPanel(x, PAD, SIDE_W, 120, "GUARDADA");
    if (state.holdId !== null) {
        drawPreview(state.holdId, x + SIDE_W / 2, PAD + 70, PREVIEW_BLOCK, state.canHold ? 1 : 0.35);
    }

    const helpY = PAD + 120 + PAD;
    const helpH = CANVAS_H - helpY - PAD;
    drawPanel(x, helpY, SIDE_W, helpH, "CONTROLES");
    const help = [
        ["← →", "mover"],
        ["↓", "descer"],
        ["↑ X", "girar"],
        ["Z", "girar ↺"],
        ["Espaço", "soltar"],
        ["C", "guardar"],
        ["P", "pausar"],
        ["R", "reiniciar"],
        ["M", sounds.enabled ? "som: sim" : "som: não"],
        ["E", state.specials ? "especiais: sim" : "especiais: não"],
    ];
    help.forEach(([key, label], i) => {
        const y = helpY + 40 + i * 26;
        text(key, x + 14, y, { size: 13, color: css(state.tint) });
        text(label, x + SIDE_W - 14, y, { size: 13, color: COLORS.textDim, align: "right", weight: "normal" });
    });
};

const drawRightPanel = () => {
    const x = RIGHT_X;
    const nextH = 40 + NEXT_COUNT * 70;
    drawPanel(x, PAD, SIDE_W, nextH, "PRÓXIMAS");
    state.queue.slice(0, NEXT_COUNT).forEach((id, i) => {
        const size = i === 0 ? PREVIEW_BLOCK : PREVIEW_BLOCK * 0.8;
        drawPreview(id, x + SIDE_W / 2, PAD + 70 + i * 70, size, i === 0 ? 1 : 0.7);
    });

    const statsY = PAD + nextH + PAD;
    const statsH = CANVAS_H - statsY - PAD;
    drawPanel(x, statsY, SIDE_W, statsH);

    const stats = [
        ["PONTOS", scoreText()],
        ["NÍVEL", String(state.level)],
        ["LINHAS", String(state.lines)],
        ["RECORDE", String(state.high).padStart(7, "0")],
    ];
    const rowH = (statsH - 20) / stats.length;
    stats.forEach(([label, value], i) => {
        const y = statsY + 14 + i * rowH;
        text(label, x + 14, y, { size: 12, color: css(state.tint, 0.9) });
        text(value, x + 14, y + 18, { size: 22, color: i === 3 && state.newRecord ? "#FFEB3B" : COLORS.text });
    });
};

// Layout compacto: peça guardada, placar e próxima peça acima do tabuleiro.
const drawCompactHud = () => {
    const y = PAD;
    const boxW = 80;
    const gap = 8;
    const statsX = PAD + boxW + gap;
    const statsW = GRID_W - boxW * 2 - gap * 2;
    const nextX = statsX + statsW + gap;

    drawPanel(PAD, y, boxW, HUD_H);
    text("GUARDA", PAD + boxW / 2, y + 8, { size: 11, color: css(state.tint, 0.9), align: "center" });
    if (state.holdId !== null) {
        drawPreview(state.holdId, PAD + boxW / 2, y + 58, 16, state.canHold ? 1 : 0.35);
    }

    drawPanel(nextX, y, boxW, HUD_H);
    text("PRÓXIMA", nextX + boxW / 2, y + 8, { size: 11, color: css(state.tint, 0.9), align: "center" });
    if (state.queue.length > 0) drawPreview(state.queue[0], nextX + boxW / 2, y + 58, 16);

    drawPanel(statsX, y, statsW, HUD_H);
    const cx = statsX + statsW / 2;
    text(scoreText(), cx, y + 10, { size: 22, align: "center" });
    text(`NÍVEL ${state.level}  ·  ${state.lines} L`, cx, y + 42, { size: 12, align: "center", color: css(state.tint) });
    text(`RECORDE ${state.high}`, cx, y + 66, {
        size: 11,
        align: "center",
        color: state.newRecord ? "#FFEB3B" : COLORS.textDim,
        weight: "normal",
    });
};

const drawOverlay = (title, lines, titleColor = COLORS.text, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H);
    const cx = GRID_X + GRID_W / 2;
    const cy = GRID_Y + GRID_H / 2;

    // Brilho atrás do título
    ctx.globalCompositeOperation = "lighter";
    const glowColor = TetrisFX.hexToRgb(titleColor.startsWith("#") ? titleColor : "#ffffff");
    ctx.globalAlpha = alpha * (0.25 + 0.1 * Math.sin(state.time * 3));
    ctx.drawImage(TetrisFX.glow(glowColor), cx - 150, cy - 90, 300, 100);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;

    text(title, cx, cy - 40, { size: 34, align: "center", baseline: "middle", color: titleColor });
    lines.forEach((line, i) =>
        text(line, cx, cy + 10 + i * 26, { size: 15, align: "center", baseline: "middle", color: COLORS.textDim, weight: "normal" })
    );
    ctx.restore();
};

const drawPopups = () => {
    state.popups.forEach((p, i) => {
        const t = p.timer / 1200;
        ctx.globalAlpha = 1 - t;
        text(p.text, GRID_X + GRID_W / 2, GRID_Y + GRID_H * 0.35 - t * 50 + i * 40, {
            size: 30,
            align: "center",
            baseline: "middle",
            color: "#FFEB3B",
        });
        ctx.globalAlpha = 1;
    });
};

const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

const render = () => {
    ctx.save();
    // Tremor de tela (estilhaços, queda rápida e fim de jogo)
    if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    drawBackground();
    if (compact) {
        drawCompactHud();
    } else {
        drawLeftPanel();
        drawRightPanel();
    }
    drawGrid();
    drawLandingPreview();
    particles.drawTrail(ctx);
    drawCurrentPiece();
    particles.drawFront(ctx);
    drawPopups();

    if (state.phase === "start") {
        drawOverlay("TETRIS", isTouch ? ["Toque para começar"] : ["Pressione Enter", "para começar"], COLORS.accent);
    } else if (state.phase === "paused") {
        drawOverlay("PAUSA", [isTouch ? "Toque para continuar" : "P ou Enter para continuar"]);
    } else if (state.phase === "over") {
        // O painel aparece depois que as linhas terminam de ficar cinza
        const animEnd = state.gameOverRows * GAME_OVER_ROW_DELAY + GAME_OVER_FADE;
        const alpha = Math.max(0, Math.min(1, (state.gameOverTime - animEnd) / 0.4));
        if (alpha > 0) {
            drawOverlay("FIM DE JOGO", [
                `Pontos: ${state.score}`,
                state.newRecord ? "Novo recorde!" : `Recorde: ${state.high}`,
                "",
                isTouch ? "Toque para jogar de novo" : "Enter ou R para jogar de novo",
            ], "#F44336", alpha);
        }
    }
    ctx.restore();
};

// =====================================================================
// Canvas responsivo
// =====================================================================

const touchControls = document.querySelector(".touch-controls");
if (isTouch) document.body.classList.add("touch");

const fitCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const stage = canvas.parentElement;
    const styles = getComputedStyle(stage);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const controlsH = touchControls.offsetHeight ? touchControls.offsetHeight + parseFloat(styles.rowGap || 0) : 0;

    const availW = stage.clientWidth - padX;
    const availH = stage.clientHeight - padY - controlsH;
    const scaleFor = ({ w, h }) => Math.min(availW / w, availH / h);

    // Usa o layout compacto quando ele deixa o tabuleiro visivelmente maior (ex.: celular em pé).
    setLayout(scaleFor(LAYOUTS.compact) > scaleFor(LAYOUTS.wide) * 1.1);
    const scale = Math.max(0.2, scaleFor(compact ? LAYOUTS.compact : LAYOUTS.wide));

    canvas.style.width = `${Math.floor(CANVAS_W * scale)}px`;
    canvas.style.height = `${Math.floor(CANVAS_H * scale)}px`;

    renderScale = scale * dpr;
    canvas.width = Math.round(CANVAS_W * renderScale);
    canvas.height = Math.round(CANVAS_H * renderScale);
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    backgroundCanvas = TetrisFX.background(CANVAS_W + 24, CANVAS_H + 24, renderScale);
};

// =====================================================================
// Entrada
// =====================================================================

const press = (action) => {
    if (input.held[action]) return;
    input.held[action] = true;

    if (action === "moveLeft" || action === "moveRight") {
        input.horizontal = action;
        input.dasTimer = 0;
        input.arrTimer = 0;
    }

    if (action !== "softDrop") input.pending.push(action);
};

const release = (action) => {
    delete input.held[action];
    if (input.horizontal === action) {
        // Se a outra direção ainda estiver pressionada, volta a valer
        const other = action === "moveLeft" ? "moveRight" : "moveLeft";
        input.horizontal = input.held[other] ? other : null;
        input.dasTimer = 0;
        input.arrTimer = 0;
    }
};

// O navegador só libera o áudio após um gesto do usuário.
window.addEventListener("keydown", () => sounds.unlock(), { once: true });
window.addEventListener("pointerdown", () => sounds.unlock(), { once: true });

window.addEventListener("keydown", (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    press(action);
});

window.addEventListener("keyup", (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (action) release(action);
});

// Pausa automaticamente ao perder o foco (ex.: trocar de jogo ou de aba)
const autoPause = () => {
    input.held = {};
    input.horizontal = null;
    setPaused(true);
};
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
});

touchControls.querySelectorAll("button").forEach((button) => {
    const action = button.dataset.action;
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        press(action);
    });
    const up = () => release(action);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("contextmenu", (e) => e.preventDefault());
});

canvas.addEventListener("pointerdown", (event) => {
    canvas.focus();
    if (state.phase !== "playing") input.pending.push("confirm");
    // No celular, tocar no tabuleiro gira a peça.
    else if (event.pointerType === "touch") input.pending.push("rotateCW");
});

window.addEventListener("resize", fitCanvas);

// =====================================================================
// Laço principal
// =====================================================================

let previousTime = performance.now();

const loop = (now) => {
    const dt = Math.min(now - previousTime, MAX_DT);
    previousTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
};

fitCanvas();
canvas.focus();
requestAnimationFrame(loop);
