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
                 short  rótulo curto opcional (ex.: "Dó♯")
                 color  cor do botão
                 freq   frequência do som em Hz
                 keys   teclas que tocam o botão (minúsculas)
                 sharp  true = tecla "preta" (sustenido/bemol), botão menor no anel
   ===================================================================== */
(() => {
    "use strict";

    // Frequências da escala temperada a partir do Dó central (C4 = 261,63 Hz).
    const NOTE = (semitones) => +(261.63 * Math.pow(2, semitones / 12)).toFixed(2);

    // As 7 notas naturais, cada uma com uma cor do arco-íris
    // (dó vermelho … si roxo), como nos teclados coloridos de musicalização.
    const RAINBOW_NOTES = [
        { name: "Dó",  color: "#e53935", freq: NOTE(0),  keys: ["1", "c"] },
        { name: "Ré",  color: "#fb8c00", freq: NOTE(2),  keys: ["2", "d"] },
        { name: "Mi",  color: "#fdd835", freq: NOTE(4),  keys: ["3", "e"] },
        { name: "Fá",  color: "#43a047", freq: NOTE(5),  keys: ["4", "f"] },
        { name: "Sol", color: "#29b6f6", freq: NOTE(7),  keys: ["5", "g"] },
        { name: "Lá",  color: "#3949ab", freq: NOTE(9),  keys: ["6", "a"] },
        { name: "Si",  color: "#8e24aa", freq: NOTE(11), keys: ["7", "b"] },
    ];

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
            pads: RAINBOW_NOTES,
        },

        // As mesmas 7 notas no disco. Para liberar, troque enabled para true.
        notas7: {
            title: "7 notas (disco)",
            enabled: false,
            labels: true,
            rotate: -90,
            pads: RAINBOW_NOTES,
        },

        // Depois: escala cromática (12 sons, com sustenidos/bemóis).
        cromatica12: {
            title: "12 notas (♯/♭)",
            enabled: false,
            labels: true,
            rotate: -90,
            pads: [
                { name: "Dó",       short: "Dó",  color: "#e11d48", freq: NOTE(0),  keys: ["1"] },
                { name: "Dó♯ / Ré♭", short: "Dó♯", color: "#9f1239", freq: NOTE(1),  keys: ["2"], sharp: true },
                { name: "Ré",       short: "Ré",  color: "#f97316", freq: NOTE(2),  keys: ["3"] },
                { name: "Ré♯ / Mi♭", short: "Ré♯", color: "#9a3412", freq: NOTE(3),  keys: ["4"], sharp: true },
                { name: "Mi",       short: "Mi",  color: "#facc15", freq: NOTE(4),  keys: ["5"] },
                { name: "Fá",       short: "Fá",  color: "#22c55e", freq: NOTE(5),  keys: ["6"] },
                { name: "Fá♯ / Sol♭", short: "Fá♯", color: "#166534", freq: NOTE(6),  keys: ["7"], sharp: true },
                { name: "Sol",      short: "Sol", color: "#14b8a6", freq: NOTE(7),  keys: ["8"] },
                { name: "Sol♯ / Lá♭", short: "Sol♯", color: "#115e59", freq: NOTE(8),  keys: ["9"], sharp: true },
                { name: "Lá",       short: "Lá",  color: "#6366f1", freq: NOTE(9),  keys: ["0"] },
                { name: "Lá♯ / Si♭", short: "Lá♯", color: "#3730a3", freq: NOTE(10), keys: ["-"], sharp: true },
                { name: "Si",       short: "Si",  color: "#c026d3", freq: NOTE(11), keys: ["="] },
            ],
        },
    };
})();
