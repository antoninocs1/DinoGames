// Atualiza a versão do DinoGames em todos os lugares de uma vez.
//
//   npm run versao            -> 1.003 vira 1.004
//   npm run versao -- 1.100   -> usa a versão informada
//
// O que muda:
//   - APP_VERSION em hub/hub.js (aparece no rodapé do menu e vai como ?v= ao abrir os jogos)
//   - CACHE_VERSION em sw.js (o PWA baixa os arquivos novos e mostra "Nova versão disponível")
//   - os ?v= dos .js/.css no index.html e no index.html de cada jogo (o navegador não usa arquivo antigo)
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const file = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(file(p), "utf8");
const write = (p, text) => fs.writeFileSync(file(p), text);

const hub = read("hub/hub.js");
const match = hub.match(/const APP_VERSION = "(\d+)\.(\d+)";/);
if (!match) {
    console.error("APP_VERSION não encontrado em hub/hub.js");
    process.exit(1);
}
const current = `${match[1]}.${match[2]}`;
const next = process.argv[2] || `${match[1]}.${String(Number(match[2]) + 1).padStart(match[2].length, "0")}`;
if (!/^\d+\.\d+$/.test(next)) {
    console.error(`Versão inválida: ${next} (use o formato 1.004)`);
    process.exit(1);
}

write("hub/hub.js", hub.replace(match[0], `const APP_VERSION = "${next}";`));

const sw = read("sw.js").replace(/const CACHE_VERSION = "[^"]*";/, `const CACHE_VERSION = "dinogames-v${next}";`);
write("sw.js", sw);

const pages = ["index.html", ...fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(file(`${d.name}/index.html`)))
    .map((d) => `${d.name}/index.html`)];
pages.forEach((page) => write(page, read(page).replace(/\?v=[\w.]+"/g, `?v=${next}"`)));

console.log(`Versão ${current} -> ${next}`);
console.log(`Atualizados: hub/hub.js, sw.js, ${pages.join(", ")}`);
