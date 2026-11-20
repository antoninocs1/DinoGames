# 🦖 DinoGames

Coleção de jogos feitos com **JavaScript, HTML e CSS puros** — sem frameworks e sem instalação.
Os jogos abrem em uma janela dentro do app, com menu lateral, tema claro/escuro e suporte a
celular (controles de toque). Pode ser instalado como **PWA** e funciona offline.

## Jogos

| Jogo | Destaques |
| --- | --- |
| **Tetris** | Blocos de vidro 3D, linhas que racham e estilhaçam, onda de choque no TETRIS, peça fantasma, guardar peça, fila de próximas, sons sintetizados e **peças especiais** (tecla `E`): pedra que quebra a peça em que bate e peça transparente que tapa buracos. |
| **Space Invaders** | Ondas de invasores, inimigos com mais vida, chefão a cada 5 níveis com rajada de 3 tiros, recorde salvo. |
| **Batalha Naval** | Navios desenhados (vista de cima) ou em blocos; toque num navio para girar e arraste para mover; IA em três níveis; cenário com nuvens e ondas, tema noturno ou céu azul; radar. |
| **Dino Rally** | Corrida de resistência em pseudo-3D: ultrapasse a cota de carros de cada dia passando por amanhecer, sol, neve, pôr do sol, noite com faróis e neblina. Os outros carros mudam de faixa para ultrapassar e batem entre si. Dirija pelo teclado, pelo mouse (botão esquerdo acelera, direito freia) ou arrastando o dedo. |
| **Labirinto do Ratinho** | Leve o ratinho ao queijo enquanto as paredes mudam de lugar. Gato, túneis, ratoeiras e biscoito de força. Sozinho (3 vidas), contra o computador, 2 jogadores no mesmo teclado ou **online** (2 a 4 jogadores). No celular em pé o labirinto fica em pé. |
| **Damas** | Regras oficiais da CBD (64 casas): captura obrigatória em cadeia, Lei da Maioria, dama voadora, Tema Turco e regras de empate. Contra o computador em 4 níveis (Fácil, Médio, Difícil, Mestre — a IA roda num Web Worker) ou 2 jogadores; desfazer, dica, girar tabuleiro, 4 temas de tabuleiro e sons sintetizados. |

## Recursos do app

- Menu lateral recolhível (gaveta no celular) e janela do jogo com reiniciar, tela cheia e fechar
- Tema claro/escuro, efeito lanterna, páginas **Sobre** e **Nos apoie**
- **PWA**: botão *Instalar* (Android/Chrome/Edge) ou *Compartilhar → Adicionar à Tela de Início* (iPhone)
- Funciona offline depois do primeiro acesso (service worker)

## Como rodar localmente

Os jogos usam módulos JavaScript, então é preciso um servidor local (abrir o `index.html` direto não funciona para todos):

```bash
npm start          # ou: node server.js
# abra http://localhost:8080
```

Não há dependências para instalar — o `server.js` usa só o Node.js.

### Labirinto online

O modo online do Labirinto do Ratinho usa o próprio `server.js` (WebSocket em `/maze-ws`, sem dependências).
Quem cria a partida recebe um código de 4 letras; na mesma rede, os amigos abrem `http://<IP-do-anfitrião>:8080`,
escolhem **Labirinto do Ratinho → Online: entrar** e digitam o código. No GitHub Pages (só arquivos estáticos)
os modos locais funcionam, mas o online precisa do `npm start`.

## Nova versão

Antes de publicar, rode:

```bash
npm run versao            # 1.004 -> 1.005 (ou: npm run versao -- 1.100)
```

O script atualiza a versão mostrada no rodapé do menu (`hub/hub.js`), o cache do PWA (`sw.js`) e os
`?v=` dos arquivos `.js`/`.css` de cada página. Quem estiver com o app aberto vê o aviso
**Nova versão do DinoGames disponível → Atualizar**. Se algo ficar preso numa versão antiga, o botão
⟳ no topo (**Limpar cookies/cache e carregar versão atual**) apaga cookies, caches e o service worker e recarrega.

## Publicar (GitHub Pages)

Todos os caminhos são relativos, então o app funciona em `https://<usuario>.github.io/DinoGames/`.
Ative em *Settings → Pages → Deploy from a branch → main / (root)*. O PWA exige HTTPS, que o GitHub Pages já fornece.

## Estrutura

```
index.html            # app principal (menu + janela dos jogos)
hub/                  # estilos, ícones, catálogo de jogos e lógica do menu
assets/               # ícone do dinossauro e ícones do PWA
manifest.webmanifest  # configuração do PWA
sw.js                 # service worker (offline)
Tetris/  SpaceInvaders/  BatalhaNaval/  DinoRally/  Maze/  Damas/
assets/combobox.js    # lista dos <select> no celular (modelo do PCF)
Maze/maze-server.js   # partidas online do Labirinto (usado pelo server.js)
```

Para adicionar um jogo, crie a pasta dele e inclua uma entrada em `hub/games.js`
(e os arquivos na lista do `sw.js` para funcionar offline).
