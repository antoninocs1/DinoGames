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
| **Dino Rally** | Corrida de resistência em pseudo-3D: ultrapasse a cota de carros de cada dia passando por amanhecer, sol, neve, pôr do sol, noite com faróis e neblina. Os outros carros mudam de faixa para ultrapassar e batem entre si. Dirija pelo teclado, pelo mouse (botão esquerdo acelera, direito freia) ou no celular arrastando o dedo sobre o carro; os botões de toque podem trocar de lado (⇄), com acelerar/frear à esquerda por padrão. |
| **Labirinto do Ratinho** | Leve o ratinho ao queijo enquanto as paredes mudam de lugar. Gato, túneis, ratoeiras e biscoito de força. Sozinho (3 vidas), contra o computador, 2 jogadores no mesmo teclado ou **online** (2 a 4 jogadores). No celular em pé o labirinto fica em pé. |
| **Damas** | Regras oficiais da CBD (64 casas): captura obrigatória em cadeia, Lei da Maioria, dama voadora, Tema Turco e regras de empate. Contra o computador em 4 níveis (Fácil, Médio, Difícil, Mestre — a IA roda num Web Worker) ou 2 jogadores; desfazer, dica, girar tabuleiro, 4 temas de tabuleiro e sons sintetizados. |
| **Dominó** | Dominó brasileiro com 28 peças: duplas (você e o parceiro contra o computador, sem monte), 1 contra 1 ou 3 jogadores com monte para comprar. A 1ª rodada sai com o ás (1|1) ou a sena (6|6), à escolha, e as seguintes com quem ganhou a anterior. Batida simples (1), carroça (2), lá-e-lô (3) e cruzada (4); jogo fechado vale 1 ponto para quem tem menos pontos na mão. Computador em 3 níveis, dica, partidas até 3/6/10 pontos e 4 mesas. |
| **Siga o Dino** | Jogo de memória pensado para crianças: repita a sequência de cores e sons, que ganha um passo a cada acerto e acelera a cada 5. Modelos: disco preto brilhante de 4 cores com botões de vidro em forma de gota, **teclado colorido de 7 notas** (dó vermelho … si roxo) ou **de 12 notas** com as teclas pretas (nomes em sustenido ♯ ou bemol ♭, à escolha). Opção **Tocar livre** para só tocar, sem sequência, e **Executar música (notas)**: um editor de código de notas (ex.: `E[n1/4]; C[n1], E[n1], G[n1];`) que abre, salva e toca a música no piano de 2 oitavas, acendendo teclas e pentagrama (exemplo: Ode à Alegria). Sons suaves para escolher (Suave, Sininho, Clássico, Inicial, Eletrônico, Harpa, Xilofone e Caixinha de música); ao errar, mensagens de incentivo e notas subindo no mesmo som dos botões. A sequência pode tocar de novo ao errar (ou "fim de jogo"), e o botão 🔁 Repetir toca outra vez na vez do jogador. 3 velocidades, objetivo de 8 a 31 passos ou sem fim. |
| **Pontos e Quadrados** | Ligue dois pontos vizinhos por vez; quem fecha o 4º lado ganha o quadrado (com a inicial do seu nome) e joga de novo. Contra o Dino em 3 níveis (o Difícil sabe entregar as correntes menores e "guardar o controle" no fim) ou 2 jogadores; tabuleiro de 3×3 a 8×8; toque perto do traço ou arraste de um ponto ao vizinho; desfazer, dica, teclado (setas + Enter), nomes dos jogadores, placar guardado e 4 aparências (papel, caderno, lousa, noite). |

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
Tetris/  SpaceInvaders/  BatalhaNaval/  DinoRally/  Maze/  Damas/  Domino/  SigaDino/  PontosQuadrados/
assets/combobox.js    # lista dos <select> no celular (modelo do PCF)
Maze/maze-server.js   # partidas online do Labirinto (usado pelo server.js)
SigaDino/sounds.js    # opções de som do Siga o Dino (geradas ou arquivos)
SigaDino/music.js     # leitura do código de notas (Executar música) e exemplos
SigaDino/musicas/     # músicas de exemplo em .txt (Ode à Alegria)
scripts/gen-sigadino-sounds.js  # gera os arquivos de SigaDino/sounds/ (sintetizados, livres de direitos)
```

Para adicionar um jogo, crie a pasta dele e inclua uma entrada em `hub/games.js`
(e os arquivos na lista do `sw.js` para funcionar offline).
