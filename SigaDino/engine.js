/* =====================================================================
   Siga o Dino — regras (sem tela e sem som)
   ---------------------------------------------------------------------
   A partida guarda a sequência sorteada e confere cada toque do jogador.
   Não sabe nada de cores, notas ou desenho: trabalha só com índices
   de 0 a padCount-1, então serve para qualquer modo de modes.js.
   ===================================================================== */
(() => {
    "use strict";

    /** Velocidade de cada nível: tempo aceso, pausa entre sons e limite para responder (ms). */
    const SPEEDS = {
        facil:  { on: 620, gap: 200, wait: 8000 },
        normal: { on: 450, gap: 150, wait: 5000 },
        rapido: { on: 320, gap: 110, wait: 3500 },
    };

    /** A sequência acelera conforme cresce (a cada 5 passos, até 3 vezes). */
    const ACCEL = [1, 0.85, 0.72, 0.62];

    const timing = (level, length) => {
        const base = SPEEDS[level] || SPEEDS.normal;
        const k = ACCEL[Math.min(ACCEL.length - 1, Math.floor((length - 1) / 5))];
        return { on: Math.round(base.on * k), gap: Math.round(base.gap * k), wait: base.wait };
    };

    /**
     * Cria uma partida.
     * @param {object} opts
     * @param {number} opts.padCount  quantidade de botões
     * @param {number} opts.goal      passos para vencer (0 = sem fim)
     * @param {boolean} opts.strict   true = errou, acabou; false = ouve de novo
     * @param {() => number} [opts.random]  gerador (para testes)
     */
    const createGame = ({ padCount, goal = 0, strict = true, random = Math.random }) => {
        const sequence = [];
        let step = 0;          // posição que o jogador deve acertar agora
        let mistakes = 0;

        const addStep = () => {
            sequence.push(Math.floor(random() * padCount));
            step = 0;
            return sequence.length;
        };

        /**
         * Confere um toque. Resultados:
         *  "ok"      acertou e ainda faltam passos desta rodada
         *  "round"   completou a rodada (o jogo deve sortear o próximo passo)
         *  "win"     completou o objetivo
         *  "retry"   errou no modo tolerante (repetir a mesma sequência)
         *  "over"    errou no modo estrito (fim de jogo)
         */
        const press = (pad) => {
            if (pad !== sequence[step]) {
                mistakes++;
                step = 0;
                return strict ? "over" : "retry";
            }
            step++;
            if (step < sequence.length) return "ok";
            if (goal && sequence.length >= goal) return "win";
            return "round";
        };

        return {
            get sequence() { return sequence.slice(); },
            get length() { return sequence.length; },
            /** Passos completados com sucesso (o que conta para o recorde). */
            get score() { return Math.max(0, sequence.length - 1); },
            get step() { return step; },
            get mistakes() { return mistakes; },
            get goal() { return goal; },
            get strict() { return strict; },
            expected() { return sequence[step]; },
            addStep,
            press,
            resetStep() { step = 0; },
        };
    };

    window.SigaDinoEngine = { createGame, timing, SPEEDS };
})();
