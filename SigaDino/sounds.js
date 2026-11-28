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
     gain      volume geral do som (1 = normal)
     ring      com decay: segundos até a nota sumir (os harmônicos agudos somem antes)
     release   sem decay: segundos para apagar depois que a luz apaga
     reverb    eco de igreja (0 a 1)

   type: "sample"  arquivo de som (WAV, MP3, OGG… o que o navegador tocar)
     file      caminho do arquivo (lembre de incluí-lo no sw.js)
     base      frequência (Hz) da nota gravada no arquivo; o jogo muda a
               altura de cada botão pela velocidade de reprodução
     ring      true = deixa a nota soar até sumir (instrumentos de toque);
               false = corta quando a luz apaga (tom contínuo)
     octave    opcional: toca N oitavas abaixo (-1) ou acima (1) dos botões
               (o guqin é grave: soa uma oitava abaixo)
     tones4    opcional: frequências próprias para o modo de 4 cores
               (ordem dos botões: verde, vermelho, azul, amarelo)

   Os arquivos de sounds/ são gerados por scripts/gen-sigadino-sounds.js
   (sintetizados, livres de direitos). Para usar uma gravação de verdade,
   troque o arquivo e ajuste "base".
   ===================================================================== */
(() => {
    "use strict";

    window.SIGA_DINO_SOUNDS = {
        suave:      { title: "Suave", icon: "🎵",      type: "synth", wave: "sine", partials: [[1, 1], [2, 0.12]], attack: 0.03, decay: false },
        sininho:    { title: "Sininho", icon: "🔔",    type: "synth", wave: "sine", partials: [[1, 1], [3, 0.1], [4.2, 0.04]], attack: 0.006, decay: true },
        classico:   { title: "Clássico", icon: "🎼",   type: "synth", wave: "triangle", partials: [[1, 1]], attack: 0.02, decay: false },
        // Piano: martelo rápido e corda que vai sumindo; harmônicos agudos somem antes.
        piano:      { title: "Piano", icon: "🎹",      type: "synth", wave: "sine", partials: [[1, 1], [2, 0.5], [3, 0.24], [4, 0.13], [5, 0.07], [6, 0.04]], attack: 0.004, decay: true, ring: 1.6, gain: 0.9, reverb: 0.12 },
        // Órgão de igreja: tubos de várias alturas (oitava abaixo, quinta, oitavas acima)
        // soando juntos, entrada macia e eco longo de igreja.
        orgao:      { title: "Órgão de igreja", icon: "⛪", type: "synth", wave: "sine", partials: [[0.5, 0.5], [1, 1], [1.5, 0.22], [2, 0.6], [3, 0.26], [4, 0.32], [8, 0.08]], attack: 0.07, decay: false, release: 0.3, gain: 0.5, reverb: 0.55 },
        inicial:    { title: "Inicial", icon: "🕹️",    type: "synth", wave: "triangle", partials: [[1, 1.3], [2, 0.23, "sine"]], attack: 0.012, decay: false, raw: true },

        // Mesmo tipo de som e mesmos tons dos MP3 do projeto de referência
        // (≈ 220, 196, 147 e 110 Hz), mas gerado por nós.
        eletronico: { title: "Eletrônico", icon: "🎛️", type: "sample", file: "sounds/eletronico.wav", base: 220, ring: false, tones4: [220, 196, 110, 147] },
        harpa:      { title: "Harpa", icon: "🎶",      type: "sample", file: "sounds/harpa.wav",      base: 261.63, ring: true },
        xilofone:   { title: "Xilofone", icon: "🥁",   type: "sample", file: "sounds/xilofone.wav",   base: 523.25, ring: true },
        caixinha:   { title: "Caixinha de música", icon: "🎁", type: "sample", file: "sounds/caixinha.wav", base: 523.25, ring: true },
        // Instrumentos chineses: cordas dedilhadas com o vibrato da mão esquerda, e a flauta de bambu.
        guzheng:    { title: "Guzheng (cítara chinesa)", icon: "🏮", type: "sample", file: "sounds/guzheng.wav", base: 392, ring: true },
        guqin:      { title: "Guqin (cítara de 7 cordas)", icon: "🏯", type: "sample", file: "sounds/guqin.wav", base: 196, ring: true, octave: -1 },
        flauta:     { title: "Flauta de bambu (dizi)", icon: "🎍", type: "sample", file: "sounds/flauta.wav", base: 440, ring: false },
        // Flauta transversal de metal, a da orquestra: som puro e redondo.
        flautaOrq:  { title: "Flauta (orquestra)", icon: "🪈", type: "sample", file: "sounds/flauta-orquestra.wav", base: 523.25, ring: false },
    };
})();
