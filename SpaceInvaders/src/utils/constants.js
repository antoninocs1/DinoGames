export const PATH_SPACESHIP_IMAGE = "src/assets/images/spaceship.png";
export const PATH_ENGINE_IMAGE = "src/assets/images/engine.png";
export const PATH_ENGINE_SPRITES = "src/assets/images/engine_sprites.png";
export const PATH_INVADER_IMAGE = "src/assets/images/invader.png";

export const NUMBER_STARS = 100;
export const INITIAL_FRAMES = 8;
export const BOSS_LEVEL_INTERVAL = 5;

export const GameState = {
    START: "start",
    PLAYING: "playing",
    RESPAWNING: "respawning",
    PAUSED: "paused",
    GAME_OVER: "gameOver",
};

// Escala dos elementos do jogo conforme a largura da tela (celular x computador).
export const getScale = () => Math.min(1, Math.max(0.55, innerWidth / 800));
export const isSmallScreen = () => innerWidth < 700;
