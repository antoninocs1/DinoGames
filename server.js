// Servidor estático mínimo (sem dependências) para rodar o DinoGames localmente.
// Também hospeda as partidas online do Labirinto do Ratinho (WebSocket em /maze-ws).
// Uso: node server.js [porta]   ->   http://localhost:8080
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT) || 8080;

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
};

const server = http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
        res.writeHead(400).end("Bad request");
        return;
    }

    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end("Forbidden");
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");

        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado");
                return;
            }
            res.writeHead(200, {
                "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
                "Cache-Control": "no-cache",
            });
            res.end(data);
        });
    });
});

require("./Maze/maze-server").attach(server);

server.listen(PORT, () => {
    console.log(`DinoGames rodando em http://localhost:${PORT}`);
});
