/* =====================================================================
   Siga o Dino — opções do seletor "Som"
   ---------------------------------------------------------------------
   A ordem aqui é a ordem do seletor. Dois tipos:

   type: "synth"   som gerado na hora (Web Audio)
     wave      onda principal ("sine" ou "triangle"; evite as ásperas)
     partials  [múltiplo da frequência, volume relativo, onda opcional]
     attack    segundos até o volume máximo
     decay     true = o som vai sumindo (sino); false = sustenta enquanto acende
     raw       true = sai direto, sem o filtro que suaviza os agudos

   type: "sample"  arquivo de som (WAV, MP3, OGG… o que o navegador tocar)
     file      caminho do arquivo (lembre de incluí-lo no sw.js)
     base      frequência (Hz) da nota gravada no arquivo; o jogo muda a
               altura de cada botão pela velocidade de reprodução
     ring      true = deixa a nota soar até sumir (instrumentos de toque);
               false = corta quando a luz apaga (tom contínuo)
     tones4    opcional: frequências próprias para o modo de 4 cores
               (ordem dos botões: verde, vermelho, azul, amarelo)

   Os arquivos de sounds/ são gerados por scripts/gen-sigadino-sounds.js
   (sintetizados, livres de direitos). Para usar uma gravação de verdade,
   troque o arquivo e ajuste "base".
   ===================================================================== */
(() => {
    "use strict";

    window.SIGA_DINO_SOUNDS = {
        suave:      { title: "Suave",      type: "synth", wave: "sine", partials: [[1, 1], [2, 0.12]], attack: 0.03, decay: false },
        sininho:    { title: "Sininho",    type: "synth", wave: "sine", partials: [[1, 1], [3, 0.1], [4.2, 0.04]], attack: 0.006, decay: true },
        classico:   { title: "Clássico",   type: "synth", wave: "triangle", partials: [[1, 1]], attack: 0.02, decay: false },
        inicial:    { title: "Inicial",    type: "synth", wave: "triangle", partials: [[1, 1.3], [2, 0.23, "sine"]], attack: 0.012, decay: false, raw: true },

        // Mesmo tipo de som e mesmos tons dos MP3 do projeto de referência
        // (≈ 220, 196, 147 e 110 Hz), mas gerado por nós.
        eletronico: { title: "Eletrônico", type: "sample", file: "sounds/eletronico.wav", base: 220, ring: false, tones4: [220, 196, 110, 147] },
        harpa:      { title: "Harpa",      type: "sample", file: "sounds/harpa.wav",      base: 261.63, ring: true },
        xilofone:   { title: "Xilofone",   type: "sample", file: "sounds/xilofone.wav",   base: 523.25, ring: true },
        caixinha:   { title: "Caixinha de música", type: "sample", file: "sounds/caixinha.wav", base: 523.25, ring: true },
    };
})();
