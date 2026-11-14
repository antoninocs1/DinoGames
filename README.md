# 🦖 DinoGames

Coleção de jogos feitos com **JavaScript, HTML e CSS puros** — sem frameworks e sem instalação.
Os jogos abrem em uma janela dentro do app, com menu lateral, tema claro/escuro e suporte a
celular (controles de toque). Pode ser instalado como **PWA** e funciona offline.

## Jogos

| Jogo | Destaques |
| --- | --- |
| **Tetris** | Blocos de vidro 3D, linhas que racham e estilhaçam, onda de choque no TETRIS, peça fantasma, guardar peça, fila de próximas, sons sintetizados e **peças especiais** (tecla `E`): pedra que quebra a peça em que bate e peça transparente que tapa buracos. |
| **Space Invaders** | Ondas de invasores, inimigos com mais vida, chefão a cada 5 níveis com rajada de 3 tiros, recorde salvo. |
| **Batalha Naval** | Posicionamento manual (botão direito/`R` gira) ou aleatório, IA em três níveis (fácil, normal e difícil com mapa de probabilidade), explosões, splash e sonar. |
| **Dino Rally** | Corrida de resistência em pseudo-3D: ultrapasse a cota de carros de cada dia passando por amanhecer, sol, neve, pôr do sol, noite com faróis e neblina. Motor com som grave e suave. |

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
Tetris/  SpaceInvaders/  BatalhaNaval/  DinoRally/
```

Para adicionar um jogo, crie a pasta dele e inclua uma entrada em `hub/games.js`
(e os arquivos na lista do `sw.js` para funcionar offline).
