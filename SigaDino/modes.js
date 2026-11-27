/* =====================================================================
   Siga o Dino — conjuntos de botões (modos)
   ---------------------------------------------------------------------
   Cada modo descreve os botões do aparelho. O desenho (anel ou flor),
   o som e o teclado se adaptam sozinhos à quantidade de botões, então
   para criar um modo novo basta acrescentar uma entrada aqui.

   Campos de cada modo:
     title     nome que aparece no seletor "Modelo"
     look      desenho do aparelho em game.js ("anel" = disco, "teclado");
               se omitido, "anel"
     enabled   false = já pronto no código, mas ainda fora do seletor
     labels    true = escreve o nome de cada botão sobre ele (notas)
     rotate    ângulo (graus) do centro do 1º botão; -90 = no topo.
               Se omitido, o 1º botão fica logo à esquerda do topo.
     pads      lista em sentido horário, cada um com:
                 name   nome (leitores de tela, rótulos e mensagens)
                 short  rótulo curto opcional
                 flat   nome com bemol (ex.: "Ré♭" para o "Dó♯"); o jogador
                        escolhe no seletor ♯/♭ qual nome aparece
                 letter nome em letra (C D E F G A B; "C♯"), usado quando o
                        jogador escolhe "Letras"; flatLetter é a versão bemol ("D♭")
                 colorName  nome da cor (legenda)
                 color  cor do botão
                 freq   frequência do som em Hz
                 keys   teclas que tocam o botão (minúsculas)
                 sharp  true = tecla "preta" (sustenido/bemol): no teclado é a
                        tecla preta, no anel um botão menor; "color" é a cor
                        com que ela acende
     freeMode  modo usado no "Tocar livre" (ex.: o teclado de 7 notas vira o
               de 12, para as teclas pretas também tocarem)
     freeOnly  true = só no "Tocar livre" e no "Executar música" (o piano grande)
   ===================================================================== */
(() => {
    "use strict";

    // Frequências da escala temperada a partir do Dó central (C4 = 261,63 Hz).
    const NOTE = (semitones) => +(261.63 * Math.pow(2, semitones / 12)).toFixed(2);

    // As 7 notas naturais, cada uma com uma cor do arco-íris
    // (dó vermelho … si roxo), como nos teclados coloridos de musicalização.
    const RAINBOW_NOTES = [
        { name: "Dó",  letter: "C", colorName: "Vermelho",    color: "#e53935", freq: NOTE(0),  keys: ["1", "c"] },
        { name: "Ré",  letter: "D", colorName: "Laranja",     color: "#fb8c00", freq: NOTE(2),  keys: ["2", "d"] },
        { name: "Mi",  letter: "E", colorName: "Amarelo",     color: "#fdd835", freq: NOTE(4),  keys: ["3", "e"] },
        { name: "Fá",  letter: "F", colorName: "Verde",       color: "#43a047", freq: NOTE(5),  keys: ["4", "f"] },
        { name: "Sol", letter: "G", colorName: "Azul claro",  color: "#29b6f6", freq: NOTE(7),  keys: ["5", "g"] },
        { name: "Lá",  letter: "A", colorName: "Azul escuro", color: "#3949ab", freq: NOTE(9),  keys: ["6", "a"] },
        { name: "Si",  letter: "B", colorName: "Violeta",     color: "#8e24aa", freq: NOTE(11), keys: ["7", "b"] },
    ];

    /** Mistura duas cores (a luz da tecla preta é a média das vizinhas). */
    const mix = (a, b) => "#" + [1, 3, 5].map((k) =>
        Math.round((parseInt(a.substr(k, 2), 16) + parseInt(b.substr(k, 2), 16)) / 2)
            .toString(16).padStart(2, "0")).join("");

    // Escala cromática: as 7 notas coloridas + 5 teclas pretas.
    // Teclas do computador das pretas: Q W T Y U (R já é "repetir").
    const SHARPS = [
        { after: 0, name: "Dó♯",  flat: "Ré♭",  key: "q" },
        { after: 1, name: "Ré♯",  flat: "Mi♭",  key: "w" },
        { after: 3, name: "Fá♯",  flat: "Sol♭", key: "t" },
        { after: 4, name: "Sol♯", flat: "Lá♭",  key: "y" },
        { after: 5, name: "Lá♯",  flat: "Si♭",  key: "u" },
    ];
    /** Uma oitava cromática a partir de uma lista de 7 notas e das teclas das pretas. */
    const chromatic = (naturals, sharpKeys) => naturals.flatMap((pad, i) => {
        const s = SHARPS.find((x) => x.after === i);
        if (!s) return [pad];
        return [pad, {
            name: s.name, flat: s.flat, sharp: true, keys: [sharpKeys[SHARPS.indexOf(s)]],
            letter: pad.letter + "♯", flatLetter: naturals[i + 1].letter + "♭",
            color: mix(pad.color, naturals[i + 1].color),
            freq: +(pad.freq * Math.pow(2, 1 / 12)).toFixed(2),
        }];
    });
    const CHROMATIC = chromatic(RAINBOW_NOTES, SHARPS.map((s) => s.key));

    // 2ª oitava (Dó5 a Si5): mesmas cores, uma oitava acima.
    // Teclas do computador: 8 9 0 I O K L nas brancas e S X H J V nas pretas.
    const UPPER_KEYS = ["8", "9", "0", "i", "o", "k", "l"];
    const UPPER_NOTES = RAINBOW_NOTES.map((pad, i) => ({
        ...pad, freq: +(pad.freq * 2).toFixed(2), keys: [UPPER_KEYS[i]], octave: 1,
    }));
    const CHROMATIC_24 = [...CHROMATIC, ...chromatic(UPPER_NOTES, ["s", "x", "h", "j", "v"]).map((p) => ({ ...p, octave: 1 }))];

    /**
     * Uma oitava cromática (12 teclas) oct oitavas acima (+) ou abaixo (−) do Dó central,
     * com as mesmas cores; sem teclas do computador (só toque/clique).
     */
    const octaveAt = (oct) => chromatic(
        RAINBOW_NOTES.map((pad) => ({ ...pad, freq: +(pad.freq * Math.pow(2, oct)).toFixed(2), keys: [] })),
        [],
    ).map((p) => ({ ...p, keys: [], octave: oct }));

    /**
     * Piano da oitava lo até a hi (0 = a do Dó central, 1 = a de cima, −1 = a de baixo…).
     * As 2 oitavas do meio (0 e 1) são as do teclado de 24 notas, com as teclas do
     * computador; o Dó central ganha a marca center.
     */
    const pianoPads = (lo, hi) => {
        const pads = [];
        for (let oct = lo; oct <= hi; oct++) {
            if (oct === 0) pads.push(...CHROMATIC.map((p, i) => (i === 0 ? { ...p, center: true } : p)));
            else if (oct === 1) pads.push(...CHROMATIC_24.slice(12));
            else pads.push(...octaveAt(oct));
        }
        return pads;
    };
    /** Modo de piano (look teclado) da oitava lo até a hi, guardado para não recriar. */
    const pianoCache = {};
    const pianoMode = (lo, hi) => {
        const id = `${lo}:${hi}`;
        return pianoCache[id] || (pianoCache[id] = {
            title: `Piano (${hi - lo + 1} oitavas)`,
            enabled: false,
            look: "teclado",
            labels: true,
            octaves: [lo, hi],
            pads: pianoPads(lo, hi),
        });
    };
    window.SIGA_DINO_PIANO = pianoMode;

    window.SIGA_DINO_LEGEND = RAINBOW_NOTES; // Nota - Letra - Cor

    window.SIGA_DINO_MODES = {
        // Modelo clássico de 4 cores. Os tons formam um acorde de Dó maior
        // com sétima (Dó, Mi, Sol, Si bemol) — fáceis de distinguir de ouvido.
        cores4: {
            title: "4 cores",
            enabled: true,
            pads: [
                { name: "Verde",    color: "#16a34a", freq: NOTE(0),  keys: ["1", "q"] },
                { name: "Vermelho", color: "#dc2626", freq: NOTE(4),  keys: ["2", "w"] },
                { name: "Azul",     color: "#2563eb", freq: NOTE(10), keys: ["3", "s"] },
                { name: "Amarelo",  color: "#facc15", freq: NOTE(7),  keys: ["4", "a"] },
            ],
        },

        // Teclado colorido: uma tecla de cor para cada nota, mesmas regras de memória.
        teclado7: {
            title: "Teclado (7 notas)",
            enabled: true,
            look: "teclado",
            labels: true,
            freeMode: "teclado12",
            pads: RAINBOW_NOTES,
        },

        // Teclado com as teclas pretas (sustenidos/bemóis) também na sequência.
        teclado12: {
            title: "Teclado (12 notas ♯/♭)",
            enabled: true,
            look: "teclado",
            labels: true,
            pads: CHROMATIC,
        },

        // Duas oitavas de piano (Dó central até o Si de cima), com as pretas.
        teclado24: {
            title: "Teclado (24 notas, 2 oitavas)",
            enabled: true,
            look: "teclado",
            labels: true,
            pads: CHROMATIC_24,
        },

        // Piano de 5 oitavas (Dó grave, -1C, até o Si agudo, 3B). freeOnly: aparece no
        // Modelo só no Tocar livre e no Executar música (no jogo de memória vira o de 24 notas).
        piano60: { ...pianoMode(-2, 2), title: "Piano (5 oitavas)", enabled: true, freeOnly: true },

        // As mesmas 7 notas no disco. Para liberar, troque enabled para true.
        notas7: {
            title: "7 notas (disco)",
            enabled: false,
            labels: true,
            rotate: -90,
            pads: RAINBOW_NOTES,
        },

        // As 12 notas no disco. Para liberar, troque enabled para true.
        cromatica12: {
            title: "12 notas (disco)",
            enabled: false,
            labels: true,
            rotate: -90,
            pads: CHROMATIC,
        },
    };
})();
