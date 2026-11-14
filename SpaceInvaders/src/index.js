import AudioEngine from "./classes/AudioEngine.js";
import Grid from "./classes/Grid.js";
import Obstacle from "./classes/Obstacle.js";
import Particle from "./classes/Particle.js";
import Player from "./classes/Player.js";
import Projectile from "./classes/Projectile.js";
import SoundEffects from "./classes/SoundEffects.js";
import Star from "./classes/Star.js";
import { BOSS_LEVEL_INTERVAL, GameState, NUMBER_STARS, PATH_INVADER_IMAGE, getScale } from "./utils/constants.js";

const soundEffects = new SoundEffects();
const audioEngine = new AudioEngine();

const startScreen = document.querySelector(".start-screen");
const gameOverScreen = document.querySelector(".game-over");
const scoreUi = document.querySelector(".score-ui");
const scoreElement = scoreUi.querySelector(".score > span");
const levelElement = scoreUi.querySelector(".level > span");
const highElement = scoreUi.querySelector(".high > span");
const livesElement = scoreUi.querySelector(".lives > span");
const buttonPlay = document.querySelector(".button-play");
const buttonRestart = document.querySelector(".button-restart");
const buttonExit = document.querySelector(".button-exit");
const buttonMute = document.querySelector(".toggle-mute");
const buttonPause = document.querySelector(".toggle-pause");
const pauseOverlay = document.querySelector(".pause-overlay");
const exitModal = document.querySelector(".exit-modal");
const exitBtnYes = document.querySelector(".exit-btn-yes");
const exitBtnNo = document.querySelector(".exit-btn-no");

gameOverScreen.remove();

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

canvas.width = innerWidth;
canvas.height = innerHeight;

ctx.imageSmoothingEnabled = false;

let currentState = GameState.START;
let invaderShootIntervalId = null;
let respawnTimeoutId = null;

const RESPAWN_DELAY = 1200;
const HIGH_SCORE_KEY = "space-invaders-high-score";

const loadHighScore = () => {
    try {
        return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    } catch {
        return 0;
    }
};

const gameData = {
    score: 0,
    level: 1,
    high: loadHighScore(),
    lives: 3,
};

const getLevelSettings = (level) => {
    const progression = [
        { rows: 2, cols: 4 },
        { rows: 2, cols: 5 },
        { rows: 3, cols: 5 },
        { rows: 3, cols: 6 },
        { rows: 4, cols: 6 },
        { rows: 4, cols: 7 },
        { rows: 5, cols: 7 },
        { rows: 5, cols: 8 },
        { rows: 6, cols: 8 },
        { rows: 6, cols: 9 },
    ];
    const size = progression[Math.min(level - 1, progression.length - 1)];
    const velocity = 1 + (level - 1) * 0.15;
    const boost = 0.1 + (level - 1) * 0.01;

    return { ...size, velocity, boost };
};

const applyLevelSettings = () => {
    const settings = getLevelSettings(gameData.level);

    grid.rows = settings.rows;
    grid.cols = settings.cols;
    grid.boost = settings.boost;
    grid.invadersVelocity = settings.velocity;
    grid.restart();
};

const showGameData = () => {
    scoreElement.textContent = gameData.score;
    levelElement.textContent = gameData.level;
    highElement.textContent = gameData.high;
    livesElement.textContent = gameData.lives;
};

const updateHudState = () => {
    buttonMute.textContent = soundEffects.isMuted() ? "🔇" : "🔊";
    const canPause = [GameState.PLAYING, GameState.RESPAWNING, GameState.PAUSED].includes(currentState);
    buttonPause.style.display = canPause ? "block" : "none";
    buttonPause.textContent = currentState === GameState.PAUSED ? "▶" : "⏸";

    if (currentState === GameState.PAUSED) {
        pauseOverlay.classList.add("show");
    } else {
        pauseOverlay.classList.remove("show");
    }
};

const toggleMute = () => {
    soundEffects.toggleMute();
    audioEngine.toggleMute();
    updateHudState();
};

const togglePause = () => {
    if (![GameState.PLAYING, GameState.PAUSED].includes(currentState)) return;

    if (currentState === GameState.PLAYING) {
        currentState = GameState.PAUSED;
    } else {
        currentState = GameState.PLAYING;
    }

    updateHudState();
};

const player = new Player(canvas.width, canvas.height);

const stars = [];
const playerProjectiles = [];
const invadersProjectiles = [];
const particles = [];
const obstacles = [];
const bossLevel = { active: false, boss: null };

const initObstacles = () => {
    const scale = getScale();
    const width = 100 * scale;
    const x = canvas.width / 2 - width / 2;
    const y = canvas.height - player.height - 30 - 110 * scale;
    const offset = canvas.width * 0.2;
    const color = "crimson";

    const obstacle1 = new Obstacle({ x: x - offset, y }, width, 20 * scale, color);
    const obstacle2 = new Obstacle({ x: x + offset, y }, width, 20 * scale, color);

    obstacles.push(obstacle1);
    obstacles.push(obstacle2);
};

initObstacles();

const grid = new Grid(2, 4);

const keys = {
    left: false,
    right: false,
    shoot: {
        pressed: false,
        released: true,
    },
};

const mouse = {
    x: 0,
    useMouseControl: false,
};
let mouseTilt = 0;

const incrementScore = (value) => {
    gameData.score += value;

    if (gameData.score > gameData.high) {
        gameData.high = gameData.score;
        try {
            localStorage.setItem(HIGH_SCORE_KEY, String(gameData.high));
        } catch {
            // A pontuação atual continua válida mesmo se o armazenamento estiver indisponível.
        }
    }
};

const incrementLevel = () => {
    gameData.level += 1;
};

const generateStars = () => {
    for (let i = 0; i < NUMBER_STARS; i += 1) {
        stars.push(new Star(canvas.width, canvas.height));
    }
};

const drawStars = () => {
    stars.forEach((star) => {
        star.draw(ctx);
        star.update();
    });
};

const drawProjectiles = () => {
    const projectiles = [...playerProjectiles, ...invadersProjectiles];

    projectiles.forEach((projectile) => {
        if (!projectile || typeof projectile.draw !== "function") return;
        projectile.draw(ctx);
        projectile.update();
    });
};

const drawParticles = () => {
    particles.forEach((particle) => {
        particle.draw(ctx);
        particle.update();
    });
};

const drawObstacles = () => {
    obstacles.forEach((obstacle) => obstacle.draw(ctx));
};

const clearProjectiles = () => {
    for (let i = playerProjectiles.length - 1; i >= 0; i -= 1) {
        if (playerProjectiles[i].position.y + playerProjectiles[i].height <= 0) {
            playerProjectiles.splice(i, 1);
        }
    }

    for (let i = invadersProjectiles.length - 1; i >= 0; i -= 1) {
        if (invadersProjectiles[i].position.y >= canvas.height) {
            invadersProjectiles.splice(i, 1);
        }
    }
};

const clearParticles = () => {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
        if (particles[i].opacity <= 0) particles.splice(i, 1);
    }
};

const createExplosion = (position, size, color) => {
    for (let i = 0; i < size; i += 1) {
        const particle = new Particle(
            {
                x: position.x,
                y: position.y,
            },
            {
                x: (Math.random() - 0.5) * 1.5,
                y: (Math.random() - 0.5) * 1.5,
            },
            2,
            color
        );

        particles.push(particle);
    }

    if (size > 8) {
        audioEngine.explosion();
    }
};

const checkShootInvaders = () => {
    for (let invaderIndex = grid.invaders.length - 1; invaderIndex >= 0; invaderIndex -= 1) {
        const invader = grid.invaders[invaderIndex];
        for (let projectileIndex = playerProjectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
            if (invader.hit(playerProjectiles[projectileIndex])) {
                soundEffects.playHitSound();
                audioEngine.hit();
                playerProjectiles.splice(projectileIndex, 1);

                // Inimigos mais resistentes (tank) precisam de mais de um tiro.
                if (typeof invader.takeDamage === "function" && !invader.takeDamage()) {
                    createExplosion(
                        {
                            x: invader.position.x + invader.width / 2,
                            y: invader.position.y + invader.height / 2,
                        },
                        6,
                        invader.color
                    );
                    break;
                }

                createExplosion(
                    {
                        x: invader.position.x + invader.width / 2,
                        y: invader.position.y + invader.height / 2,
                    },
                    10,
                    "#941CFF"
                );

                incrementScore(invader.points || 10);

                grid.invaders.splice(invaderIndex, 1);

                break;
            }
        }
    }

    if (bossLevel.active && bossLevel.boss) {
        for (let projectileIndex = playerProjectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
            const projectile = playerProjectiles[projectileIndex];
            if (bossLevel.boss.hit(projectile)) {
                bossLevel.boss.health -= 1;
                bossLevel.boss.hitFlash = 6;
                createExplosion({ x: projectile.position.x, y: projectile.position.y }, 6, "#ff5a3c");
                playerProjectiles.splice(projectileIndex, 1);
                soundEffects.playHitSound();
                audioEngine.hit();

                if (bossLevel.boss.health <= 0) {
                    createExplosion({ x: bossLevel.boss.position.x + bossLevel.boss.width / 2, y: bossLevel.boss.position.y + bossLevel.boss.height / 2 }, 30, "#FF7B00");
                    incrementScore(200);
                    bossLevel.active = false;
                    bossLevel.boss = null;
                    currentState = GameState.PLAYING;
                }
                break;
            }
        }
    }
};

const showGameOverScreen = () => {
    document.body.append(gameOverScreen);
    updateHudState();
};

const resetPlayerPosition = () => {
    player.alive = true;
    player.updateSize();
    player.position.x = canvas.width / 2 - player.width / 2;
    player.position.y = canvas.height - player.height - 30;
    player.setShield(1.5);
};

const loseLife = () => {
    if (currentState !== GameState.PLAYING || !player.alive) return;

    player.alive = false;
    currentState = GameState.RESPAWNING;
    gameData.lives -= 1;
    livesElement.textContent = gameData.lives;
    invadersProjectiles.length = 0;
    playerProjectiles.length = 0;

    clearTimeout(respawnTimeoutId);
    respawnTimeoutId = setTimeout(() => {
        if (gameData.lives <= 0) {
            currentState = GameState.GAME_OVER;
            stopInvaderShooting();
            showGameOverScreen();
            return;
        }

        resetPlayerPosition();
        currentState = GameState.PLAYING;
        keys.shoot.pressed = false;
        keys.shoot.released = true;
    }, RESPAWN_DELAY);
};

const gameOver = () => {
    if (!player.alive || currentState !== GameState.PLAYING) return;

    createExplosion(
        {
            x: player.position.x + player.width / 2,
            y: player.position.y + player.height / 2,
        },
        10,
        "white"
    );

    createExplosion(
        {
            x: player.position.x + player.width / 2,
            y: player.position.y + player.height / 2,
        },
        5,
        "#4D9BE6"
    );

    createExplosion(
        {
            x: player.position.x + player.width / 2,
            y: player.position.y + player.height / 2,
        },
        5,
        "crimson"
    );

    loseLife();
};

const checkShootPlayer = () => {
    if (player.shield > 0) return;

    invadersProjectiles.some((projectile, index) => {
        if (player.hit(projectile)) {
            soundEffects.playExplosionSound();
            invadersProjectiles.splice(index, 1);

            gameOver();
            return true;
        }

        return false;
    });
};

const checkShootObstacles = () => {
    obstacles.forEach((obstacle) => {
        for (let index = playerProjectiles.length - 1; index >= 0; index -= 1) {
            if (obstacle.hit(playerProjectiles[index])) {
                playerProjectiles.splice(index, 1);
            }
        }

        for (let index = invadersProjectiles.length - 1; index >= 0; index -= 1) {
            if (obstacle.hit(invadersProjectiles[index])) {
                invadersProjectiles.splice(index, 1);
            }
        }
    });
};

const checkInvadersCollidedObstacles = () => {
    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
        if (grid.invaders.some((invader) => invader.collided(obstacles[i]))) {
            obstacles.splice(i, 1);
        }
    }
};

const checkPlayerCollidedInvaders = () => {
    if (!player.alive || player.shield > 0 || currentState !== GameState.PLAYING) return;

    grid.invaders.some((invader) => {
        if (invader.collidedWithPlayer(player)) {
            gameOver();
            return true;
        }

        return false;
    });
};

// Se a formação chegar até a altura da nave, o jogador perde uma vida e a onda recomeça.
const checkInvadersReachedBottom = () => {
    if (!player.alive || currentState !== GameState.PLAYING) return;

    const limit = player.position.y + player.height * 0.6;
    if (grid.invaders.some((invader) => invader.position.y + invader.height >= limit)) {
        player.shield = 0;
        gameOver();
        applyLevelSettings();
    }
};

const updateBoss = () => {
    const boss = bossLevel.boss;
    boss.time = (boss.time || 0) + 1;
    boss.position.x += boss.velocity;
    boss.position.y = 90 + Math.sin(boss.time / 40) * 18;

    // Mantém o chefão dentro da tela e inverte a direção nas bordas.
    if (boss.position.x <= 0) {
        boss.position.x = 0;
        boss.velocity = Math.abs(boss.velocity);
    } else if (boss.position.x + boss.width >= canvas.width) {
        boss.position.x = canvas.width - boss.width;
        boss.velocity = -Math.abs(boss.velocity);
    }

    // Rajada de 3 tiros a cada ~0,8 s (48 quadros a 60 FPS), como no jogo em Java/libGDX.
    boss.shotTimer = (boss.shotTimer ?? 48) - 1;
    if (boss.shotTimer <= 0) {
        boss.shoot(invadersProjectiles);
        boss.shotTimer = 48;
    }
};

const bossImage = new Image();
bossImage.src = PATH_INVADER_IMAGE;
const bossSprites = { red: null, white: null };

// Gera (uma vez) versões tingidas do sprite: vermelho para o chefão e branco para o lampejo ao ser atingido.
const getBossSprite = (variant) => {
    if (bossSprites[variant]) return bossSprites[variant];
    if (!bossImage.complete || bossImage.naturalWidth === 0) return null;

    const sprite = document.createElement("canvas");
    sprite.width = bossImage.naturalWidth;
    sprite.height = bossImage.naturalHeight;
    const sctx = sprite.getContext("2d");
    sctx.drawImage(bossImage, 0, 0);
    sctx.globalCompositeOperation = "source-atop";

    if (variant === "red") {
        const gradient = sctx.createLinearGradient(0, 0, 0, sprite.height);
        gradient.addColorStop(0, "#ff5a3c");
        gradient.addColorStop(1, "#c4101e");
        sctx.fillStyle = gradient;
    } else {
        sctx.fillStyle = "#ffffff";
    }
    sctx.fillRect(0, 0, sprite.width, sprite.height);

    bossSprites[variant] = sprite;
    return sprite;
};

const spawnBoss = () => {
    if (bossLevel.active || gameData.level % BOSS_LEVEL_INTERVAL !== 0) return;

    const bossScale = getScale();
    bossLevel.active = true;
    bossLevel.boss = {
        position: {
            x: canvas.width / 2 - 75 * bossScale,
            y: 90,
        },
        // Mantém a proporção do sprite do invasor (50x37).
        width: 160 * bossScale,
        height: 160 * (37 / 50) * bossScale,
        hitFlash: 0,
        velocity: 2 + gameData.level * 0.2,
        health: 20 + gameData.level,
        maxHealth: 20 + gameData.level,
        hit(projectile) {
            return projectile.position.x >= this.position.x &&
                projectile.position.x <= this.position.x + this.width &&
                projectile.position.y >= this.position.y &&
                projectile.position.y <= this.position.y + this.height;
        },
        shoot(projectiles) {
            // 3 tiros lado a lado, saindo da base do chefão.
            const gap = 18 * bossScale;
            [-1, 0, 1].forEach((side) => {
                projectiles.push(
                    new Projectile(
                        {
                            x: this.position.x + this.width / 2 - 3.5 + side * gap,
                            y: this.position.y + this.height,
                        },
                        8,
                        7 * Math.max(0.7, bossScale),
                        "#ff4d6d",
                        16
                    )
                );
            });
        },
        draw(ctx) {
            const { x, y } = this.position;
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // Aura vermelha pulsante ao redor do chefão
            ctx.shadowColor = `rgba(255, 40, 40, ${0.55 + 0.35 * pulse})`;
            ctx.shadowBlur = 18 + 14 * pulse;

            const sprite = getBossSprite("red");
            if (sprite) {
                ctx.drawImage(sprite, x, y, this.width, this.height);
            } else {
                ctx.fillStyle = "#e0242f";
                ctx.fillRect(x, y, this.width, this.height);
            }

            // Lampejo branco ao ser atingido
            if (this.hitFlash > 0) {
                const flash = getBossSprite("white");
                ctx.shadowBlur = 0;
                ctx.globalAlpha = this.hitFlash / 6;
                if (flash) ctx.drawImage(flash, x, y, this.width, this.height);
                this.hitFlash -= 1;
            }
            ctx.restore();

            // Barra de vida logo abaixo do chefão
            const barY = y + this.height + 10;
            const ratio = Math.max(0, this.health / this.maxHealth);
            ctx.save();
            ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
            ctx.fillRect(x, barY, this.width, 7);
            ctx.fillStyle = ratio > 0.5 ? "#ff4d4d" : ratio > 0.25 ? "#ff8c1a" : "#ffd23f";
            ctx.fillRect(x, barY, this.width * ratio, 7);
            ctx.restore();
        },
    };

    if (grid.invaders.length > 0) {
        grid.invaders.length = 0;
    }
    invadersProjectiles.length = 0;
    playerProjectiles.length = 0;
    audioEngine.nextLevel();
};

const spawnGrid = () => {
    if (bossLevel.active) return;

    if (grid.invaders.length === 0) {
        soundEffects.playNextLevelSound();
        audioEngine.nextLevel();

        incrementLevel();
        applyLevelSettings();
        invadersProjectiles.length = 0;
        stopInvaderShooting();
        startInvaderShooting();

        if (gameData.level % BOSS_LEVEL_INTERVAL === 0) {
            spawnBoss();
            return;
        }

        if (obstacles.length === 0) {
            initObstacles();
        }
    }
};

const startInvaderShooting = () => {
    if (invaderShootIntervalId) return;

    const fireDelay = Math.max(260, 1000 - (gameData.level - 1) * 75);

    invaderShootIntervalId = setInterval(() => {
        if (currentState !== GameState.PLAYING || isExitModalOpen() || bossLevel.active) return;

        const invader = grid.getRandomInvader();

        if (invader) {
            invader.shoot(invadersProjectiles);
        }
    }, fireDelay);
};

const stopInvaderShooting = () => {
    clearInterval(invaderShootIntervalId);
    invaderShootIntervalId = null;
};

const isExitModalOpen = () => exitModal.classList.contains("show");

// A lógica do jogo é baseada em quadros; limitamos a ~60 FPS para que a
// velocidade seja a mesma em monitores de 120/144 Hz.
const FRAME_INTERVAL = 1000 / 61;
let lastFrameTime = 0;

const gameLoop = (timestamp = performance.now()) => {
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTime = elapsed > 250 ? timestamp : timestamp - (elapsed % FRAME_INTERVAL);

    // Enquanto a janela de saída estiver aberta, o último quadro fica congelado.
    if (isExitModalOpen()) {
        requestAnimationFrame(gameLoop);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawStars();

    if (currentState === GameState.PAUSED) {
        drawProjectiles();
        drawParticles();
        drawObstacles();
        if (bossLevel.active && bossLevel.boss) {
            bossLevel.boss.draw(ctx);
        }
        grid.draw(ctx);

        if (player.alive) {
            player.draw(ctx);
        }

        updateHudState();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (
        currentState === GameState.PLAYING ||
        currentState === GameState.RESPAWNING
    ) {
        showGameData();

        if (currentState === GameState.PLAYING) {
            spawnGrid();
        }

        drawProjectiles();
        drawParticles();
        drawObstacles();

        if (bossLevel.active && bossLevel.boss) {
            bossLevel.boss.draw(ctx);
        }

        clearProjectiles();
        clearParticles();

        if (currentState === GameState.PLAYING) {
            checkShootInvaders();
            checkShootPlayer();
            if (currentState === GameState.PLAYING) {
                checkShootObstacles();
                checkInvadersCollidedObstacles();
                checkPlayerCollidedInvaders();
                checkInvadersReachedBottom();
            }
        }

        grid.draw(ctx);

        if (currentState === GameState.PLAYING) {
            grid.update(player.alive);
        }

        if (currentState === GameState.PLAYING && keys.shoot.pressed) {
            if (player.shoot(playerProjectiles)) {
                soundEffects.playShootSound();
            }
        }

        let playerTilt = 0;

        // O teclado tem prioridade sobre o mouse enquanto uma seta estiver pressionada.
        if (currentState === GameState.PLAYING && (keys.left || keys.right)) {
            mouse.useMouseControl = false;

            if (keys.left && player.position.x >= 0) {
                player.moveLeft();
                playerTilt = -0.15;
            }

            if (keys.right && player.position.x <= canvas.width - player.width) {
                player.moveRight();
                playerTilt = 0.15;
            }
        } else if (currentState === GameState.PLAYING && mouse.useMouseControl) {
            const targetX = mouse.x - player.width / 2;
            const maxX = canvas.width - player.width;
            const nextX = Math.max(0, Math.min(targetX, maxX));
            const horizontalMovement = nextX - player.position.x;
            const targetTilt = Math.max(-0.15, Math.min(0.15, horizontalMovement * 0.025));

            player.position.x = nextX;
            mouseTilt += (targetTilt - mouseTilt) * 0.2;
            playerTilt = mouseTilt;
        } else {
            mouseTilt += (0 - mouseTilt) * 0.2;
        }

        if (player.alive) {
            player.draw(ctx, playerTilt);
        }

        if (currentState === GameState.PLAYING && bossLevel.active && bossLevel.boss) {
            updateBoss();
        }
    }

    if (currentState === GameState.GAME_OVER) {
        checkShootObstacles();

        drawProjectiles();
        drawParticles();
        drawObstacles();

        clearProjectiles();
        clearParticles();

        grid.draw(ctx);
        grid.update(player.alive);
    }

    requestAnimationFrame(gameLoop);
};

const restartGame = () => {
    clearTimeout(respawnTimeoutId);
    respawnTimeoutId = null;
    bossLevel.active = false;
    bossLevel.boss = null;

    currentState = GameState.PLAYING;
    updateHudState();

    resetPlayerPosition();

    invadersProjectiles.length = 0;
    playerProjectiles.length = 0;
    particles.length = 0;
    obstacles.length = 0;
    initObstacles();
    
    gameData.score = 0;
    gameData.level = 1;
    gameData.lives = 3;
    keys.left = false;
    keys.right = false;
    keys.shoot.pressed = false;
    keys.shoot.released = true;
    applyLevelSettings();
    showGameData();

    gameOverScreen.remove();
    scoreUi.style.display = "block";
    startInvaderShooting();
    audioEngine.startMusic();
};

const exitGame = () => {
    currentState = GameState.START;
    updateHudState();
    stopInvaderShooting();
    clearTimeout(respawnTimeoutId);
    respawnTimeoutId = null;
    bossLevel.active = false;
    bossLevel.boss = null;
    audioEngine.stopMusic();

    resetPlayerPosition();

    invadersProjectiles.length = 0;
    playerProjectiles.length = 0;
    particles.length = 0;
    keys.left = false;
    keys.right = false;
    keys.shoot.pressed = false;
    keys.shoot.released = true;

    exitModal.classList.remove("show");
    gameOverScreen.remove();
    document.body.append(startScreen);
    scoreUi.style.display = "none";
};

const resetKeys = () => {
    keys.left = false;
    keys.right = false;
    keys.shoot.pressed = false;
    keys.shoot.released = true;
};

const isInGame = () =>
    [GameState.PLAYING, GameState.RESPAWNING, GameState.PAUSED].includes(currentState);

const blurFocusedElement = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

const showExitModal = () => {
    if (!isInGame()) return;
    resetKeys();
    exitModal.classList.add("show");
};

const hideExitModal = () => {
    exitModal.classList.remove("show");
    resetKeys();
    blurFocusedElement();
};

// event.code identifica a tecla física, independente do layout do teclado (ABNT2, US etc.).
const isLeftKey = (event) => event.code === "ArrowLeft" || event.code === "KeyA" || event.key === "ArrowLeft";
const isRightKey = (event) => event.code === "ArrowRight" || event.code === "KeyD" || event.key === "ArrowRight";
const isShootKey = (event) => event.code === "Space" || event.key === " ";

addEventListener("keydown", (event) => {
    if (isExitModalOpen()) {
        if (event.code === "Escape" || event.code === "KeyN") {
            event.preventDefault();
            hideExitModal();
        } else if (event.code === "KeyS") {
            event.preventDefault();
            exitGame();
        }
        return;
    }

    if (event.code === "Enter") {
        if (currentState === GameState.START) {
            startScreen.remove();
            restartGame();
            return;
        }

        if (currentState === GameState.GAME_OVER) {
            restartGame();
            return;
        }

        if (currentState === GameState.PAUSED) {
            togglePause();
            return;
        }
    }

    if (!isInGame()) return;

    // Impede que a página role ou que um botão focado seja acionado pelo Espaço.
    if (isLeftKey(event) || isRightKey(event) || isShootKey(event)) {
        event.preventDefault();
    }

    if (event.code === "Escape") {
        showExitModal();
        return;
    }

    if (event.code === "KeyP") {
        togglePause();
        return;
    }

    if (event.code === "KeyM") {
        toggleMute();
        return;
    }

    if (isLeftKey(event)) keys.left = true;
    if (isRightKey(event)) keys.right = true;
    if (isShootKey(event)) keys.shoot.pressed = true;
});

addEventListener("keyup", (event) => {
    if (isInGame() && isShootKey(event)) event.preventDefault();

    if (isLeftKey(event)) keys.left = false;
    if (isRightKey(event)) keys.right = false;
    if (isShootKey(event)) {
        keys.shoot.pressed = false;
        keys.shoot.released = true;
    }
});

// Evita que uma tecla fique "presa" ao trocar de janela e pausa automaticamente
// (por exemplo, ao trocar de jogo no menu do DinoGames ou mudar de aba).
const autoPause = () => {
    resetKeys();
    if (currentState === GameState.PLAYING) togglePause();
};
addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoPause();
});

canvas.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.useMouseControl = true;
});

canvas.addEventListener("mouseleave", () => {
    mouse.useMouseControl = false;
});

canvas.addEventListener("touchmove", (event) => {
    event.preventDefault();
    mouse.x = event.touches[0].clientX;
    mouse.useMouseControl = true;
}, { passive: false });

canvas.addEventListener("touchstart", (event) => {
    mouse.x = event.touches[0].clientX;
    mouse.useMouseControl = true;
    keys.shoot.pressed = true;
}, { passive: true });

canvas.addEventListener("touchend", () => {
    keys.shoot.pressed = false;
    keys.shoot.released = true;
});

addEventListener("resize", () => {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    ctx.imageSmoothingEnabled = false;

    player.updateSize();
    player.position.x = Math.min(canvas.width - player.width, Math.max(0, player.position.x + (canvas.width - oldWidth) / 2));
    player.position.y = canvas.height - player.height - 30;
    stars.forEach((star) => star.resize(oldWidth, oldHeight, canvas.width, canvas.height));
    obstacles.length = 0;
    initObstacles();
});

canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) { // botão esquerdo
        keys.shoot.pressed = true;
    }
});

canvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) { // botão esquerdo
        keys.shoot.pressed = false;
        keys.shoot.released = true;
    }
});

buttonPlay.addEventListener("click", () => {
    startScreen.remove();
    restartGame();
});

buttonRestart.addEventListener("click", restartGame);
buttonExit.addEventListener("click", exitGame);
// Tira o foco do botão após o clique para que o Espaço continue servindo para atirar.
buttonMute.addEventListener("click", () => {
    toggleMute();
    blurFocusedElement();
});
buttonPause.addEventListener("click", () => {
    togglePause();
    blurFocusedElement();
});

exitBtnYes.addEventListener("click", exitGame);
exitBtnNo.addEventListener("click", hideExitModal);

generateStars();
showGameData();
updateHudState();
gameLoop();
