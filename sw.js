// Service worker do DinoGames: deixa os jogos disponíveis offline e permite instalar como app.
// Ao alterar arquivos do projeto, aumente CACHE_VERSION para que os usuários recebam a atualização.
const CACHE_VERSION = "dinogames-v1.056";

const APP_FILES = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "hub/hub.css",
    "hub/hub.js",
    "hub/icons.js",
    "hub/games.js",
    "assets/dino.svg",
    "assets/combobox.js",
    "assets/combobox.css",
    "assets/icons/icon-192.png",
    "assets/icons/icon-512.png",
    "assets/icons/icon-maskable-512.png",
    "assets/icons/apple-touch-icon.png",
    "assets/logo-pcf.png",

    "Tetris/index.html",
    "Tetris/tetris.css",
    "Tetris/tetris.js",
    "Tetris/fx.js",

    "SpaceInvaders/index.html",
    "SpaceInvaders/src/style.css",
    "SpaceInvaders/src/index.js",
    "SpaceInvaders/src/utils/constants.js",
    "SpaceInvaders/src/classes/AudioEngine.js",
    "SpaceInvaders/src/classes/Enemy.js",
    "SpaceInvaders/src/classes/Grid.js",
    "SpaceInvaders/src/classes/Invader.js",
    "SpaceInvaders/src/classes/Obstacle.js",
    "SpaceInvaders/src/classes/Particle.js",
    "SpaceInvaders/src/classes/Player.js",
    "SpaceInvaders/src/classes/Projectile.js",
    "SpaceInvaders/src/classes/SoundEffects.js",
    "SpaceInvaders/src/classes/Star.js",
    "SpaceInvaders/src/assets/images/engine.png",
    "SpaceInvaders/src/assets/images/engine_sprites.png",
    "SpaceInvaders/src/assets/images/invader.png",
    "SpaceInvaders/src/assets/images/spaceship.png",
    "SpaceInvaders/src/assets/audios/explosion.mp3",
    "SpaceInvaders/src/assets/audios/hit.mp3",
    "SpaceInvaders/src/assets/audios/next_level.mp3",
    "SpaceInvaders/src/assets/audios/shoot.mp3",

    "BatalhaNaval/index.html",
    "BatalhaNaval/style.css",
    "BatalhaNaval/game.js",

    "DinoRally/index.html",
    "DinoRally/style.css",
    "DinoRally/rally.js",

    "Damas/index.html",
    "Damas/style.css",
    "Damas/engine.js",
    "Damas/game.js",

    "Domino/index.html",
    "Domino/style.css",
    "Domino/engine.js",
    "Domino/game.js",

    "SigaDino/index.html",
    "SigaDino/style.css",
    "SigaDino/sounds.js",
    "SigaDino/sounds/eletronico.wav",
    "SigaDino/sounds/harpa.wav",
    "SigaDino/sounds/xilofone.wav",
    "SigaDino/sounds/caixinha.wav",
    "SigaDino/sounds/guzheng.wav",
    "SigaDino/sounds/guqin.wav",
    "SigaDino/sounds/flauta.wav",
    "SigaDino/sounds/flauta-orquestra.wav",
    "SigaDino/modes.js",
    "SigaDino/engine.js",
    "SigaDino/staff.js",
    "SigaDino/music.js",
    "SigaDino/musicas/Ode_a_Alegria_notas.txt",
    "SigaDino/game.js",

    "PontosQuadrados/index.html",
    "PontosQuadrados/style.css",
    "PontosQuadrados/engine.js",
    "PontosQuadrados/game.js",

    "DinoComeCome/index.html",
    "DinoComeCome/style.css",
    "DinoComeCome/mazes.js",
    "DinoComeCome/sound.js",
    "DinoComeCome/game.js",

    "Cobrinha/index.html",
    "Cobrinha/style.css",
    "Cobrinha/game.js",

    "Maze/index.html",
    "Maze/style.css",
    "Maze/maze-core.js",
    "Maze/game.js",
    "Maze/sounds/caught.wav",
    "Maze/sounds/countdown.wav",
    "Maze/sounds/eat.wav",
    "Maze/sounds/error.wav",
    "Maze/sounds/finish.wav",
    "Maze/sounds/gameover.wav",
    "Maze/sounds/go.wav",
    "Maze/sounds/hiss.wav",
    "Maze/sounds/join.wav",
    "Maze/sounds/leave.wav",
    "Maze/sounds/lose.wav",
    "Maze/sounds/menu_move.wav",
    "Maze/sounds/menu_select.wav",
    "Maze/sounds/meow.wav",
    "Maze/sounds/plop.wav",
    "Maze/sounds/snap.wav",
    "Maze/sounds/step.wav",
    "Maze/sounds/wall_change.wav",
    "Maze/sounds/win.wav",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Rede primeiro (sempre a versão mais nova quando online); sem conexão, usa o cache.
self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.open(CACHE_VERSION).then(async (cache) => {
            try {
                const response = await fetch(request);
                if (response.ok) cache.put(request, response.clone());
                return response;
            } catch {
                const cached = await cache.match(request, { ignoreSearch: true });
                if (cached) return cached;
                if (request.mode === "navigate") return cache.match("index.html");
                throw new Error("offline");
            }
        })
    );
});
