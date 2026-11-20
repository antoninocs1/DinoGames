"use strict";

// =====================================================================
// Labirinto do Ratinho — servidor online (port de GameServer.java).
// WebSocket mínimo escrito à mão (sem dependências) no caminho /maze-ws.
// O servidor é a autoridade: move os ratinhos, muda o labirinto e decide o vencedor.
// Os clientes só enviam a direção e desenham o snapshot recebido.
//
// Cliente -> servidor (JSON):
//   { type: "create", hazards, portrait } cria uma sala (labirinto em pé se portrait) e entra nela
//   { type: "join", code: "ABCD" }       entra numa sala existente
//   { type: "dir", d: -1..3 }            direção desejada (-1 parado)
// Servidor -> cliente:
//   { type: "welcome", id, code, host, ips, port }
//   { type: "error", message }
//   { type: "state", s: snapshot }       a cada tick de rede
// =====================================================================

const crypto = require("crypto");
const os = require("os");
const { Match, C } = require("./maze-core");

const PATH = "/maze-ws";
const SIM_HZ = 60;
const NET_EVERY = 2; // envia o snapshot a cada 2 ticks (30 por segundo)
const MAX_FRAME = 64 * 1024;

const rooms = new Map(); // código -> { match, clients: Map(id -> conexão), tick }

// Endereços IPv4 desta máquina na rede local (para os amigos entrarem).
const localAddresses = () => {
    const list = [];
    Object.values(os.networkInterfaces()).forEach((ifaces) => {
        (ifaces || []).forEach((i) => {
            if (i.family === "IPv4" && !i.internal) list.push(i.address);
        });
    });
    return list;
};

const newCode = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I e O para não confundir com 1 e 0
    for (;;) {
        let code = "";
        for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
        if (!rooms.has(code)) return code;
    }
};

// ---------------- WebSocket (RFC 6455, só o necessário)

const encodeFrame = (text) => {
    const payload = Buffer.from(text, "utf8");
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    return Buffer.concat([header, payload]);
};

class Connection {
    constructor(socket, address, onMessage, onClose) {
        this.socket = socket;
        this.address = address;
        this.buffer = Buffer.alloc(0);
        this.closed = false;
        this.onMessage = onMessage;
        this.onClose = onClose;
        socket.setNoDelay(true);
        socket.on("data", (chunk) => this.receive(chunk));
        socket.on("close", () => this.finish());
        socket.on("error", () => this.finish());
    }

    send(obj) {
        if (this.closed) return;
        try {
            this.socket.write(encodeFrame(JSON.stringify(obj)));
        } catch {
            this.finish();
        }
    }

    finish() {
        if (this.closed) return;
        this.closed = true;
        this.socket.destroy();
        this.onClose(this);
    }

    receive(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 2) {
            const b0 = this.buffer[0], b1 = this.buffer[1];
            const opcode = b0 & 0x0f;
            const masked = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f;
            let offset = 2;
            if (len === 126) {
                if (this.buffer.length < 4) return;
                len = this.buffer.readUInt16BE(2);
                offset = 4;
            } else if (len === 127) {
                if (this.buffer.length < 10) return;
                len = Number(this.buffer.readBigUInt64BE(2));
                offset = 10;
            }
            if (len > MAX_FRAME || !masked) { // clientes sempre mascaram; frames gigantes são recusados
                this.finish();
                return;
            }
            if (this.buffer.length < offset + 4 + len) return;
            const mask = this.buffer.subarray(offset, offset + 4);
            const data = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + len));
            for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
            this.buffer = this.buffer.subarray(offset + 4 + len);

            if (opcode === 0x8) { // close
                this.finish();
                return;
            }
            if (opcode === 0x9) { // ping -> pong
                this.socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data]));
                continue;
            }
            if (opcode === 0x1) {
                try {
                    this.onMessage(this, JSON.parse(data.toString("utf8")));
                } catch {
                    /* mensagem inválida: ignora */
                }
            }
        }
    }
}

// ---------------- salas e partidas

const freeId = (room) => {
    for (let id = 0; id < C.MAX_MICE; id++) if (!room.clients.has(id)) return id;
    return -1;
};

const enterRoom = (conn, room, code, port) => {
    const id = freeId(room);
    if (id < 0) {
        conn.send({ type: "error", message: "A partida está cheia (máximo 4 jogadores)." });
        return;
    }
    conn.room = room;
    conn.playerId = id;
    room.clients.set(id, conn);
    const mouse = room.match.addMouse(id, `Jogador ${id + 1}`, false, 0);
    mouse.address = conn.address;
    conn.send({ type: "welcome", id, code, host: id === room.hostId, ips: localAddresses(), port });
    console.log(`[Labirinto ${code}] Jogador ${id + 1} conectado: ${conn.address}`);
};

const leaveRoom = (conn) => {
    const room = conn.room;
    if (!room) return;
    room.clients.delete(conn.playerId);
    room.match.removeMouse(conn.playerId);
    console.log(`[Labirinto ${room.code}] Jogador ${conn.playerId + 1} desconectado.`);
    if (!room.clients.size) {
        clearInterval(room.timer);
        rooms.delete(room.code);
    }
};

const createRoom = (hazards, portrait) => {
    const code = newCode();
    // online: mínimo 2 jogadores; quem cria escolhe o labirinto deitado (25x15) ou em pé (15x25)
    const match = portrait ? new Match(2, C.ROWS, C.COLS) : new Match(2);
    match.hazards = hazards !== false;
    const room = { code, match, clients: new Map(), tick: 0, hostId: 0 };
    room.timer = setInterval(() => {
        match.update(1 / SIM_HZ);
        room.tick++;
        if (room.tick % NET_EVERY === 0) {
            const msg = { type: "state", s: match.snapshot() };
            room.clients.forEach((c) => c.send(msg));
        }
    }, 1000 / SIM_HZ);
    rooms.set(code, room);
    return room;
};

exports.attach = (server) => {
    server.on("upgrade", (req, socket) => {
        let pathname;
        try {
            pathname = new URL(req.url, "http://localhost").pathname;
        } catch {
            pathname = "";
        }
        const key = req.headers["sec-websocket-key"];
        if (!pathname.endsWith(PATH) || !key) {
            socket.destroy();
            return;
        }
        const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);

        const address = (req.socket.remoteAddress || "").replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
        const port = server.address()?.port;
        new Connection(socket, address, (conn, msg) => {
            if (msg.type === "create" && !conn.room) {
                const room = createRoom(msg.hazards, msg.portrait === true);
                enterRoom(conn, room, room.code, port);
            } else if (msg.type === "join" && !conn.room) {
                const code = String(msg.code || "").trim().toUpperCase();
                const room = rooms.get(code);
                if (!room) conn.send({ type: "error", message: `Não existe partida com o código ${code || "(vazio)"}.` });
                else enterRoom(conn, room, code, port);
            } else if (msg.type === "dir" && conn.room) {
                conn.room.match.setInput(conn.playerId, Number(msg.d));
            }
        }, leaveRoom);
    });
};
