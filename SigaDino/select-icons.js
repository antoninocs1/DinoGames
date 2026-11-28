/* =====================================================================
   Siga o Dino — ícones dos combobox (desenhos SVG, no estilo do menu)
   ---------------------------------------------------------------------
   Cada <option> pode ter data-icon="nome". O combobox fechado mostra o
   ícone da opção escolhida do lado esquerdo (sem ocupar altura) e a
   lista do celular (assets/combobox.js) mostra o ícone de cada opção.
   Os desenhos ficam em window.DINO_SELECT_ICONS.
   ===================================================================== */
(() => {
    "use strict";
    const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    const HAND = '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>';
    const ICONS = {
        // Sons (instrumentos)
        music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
        bell: svg('<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>'),
        note: svg('<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>'),
        piano: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 19v-5M12 19v-5M17 19v-5"/><path d="M6 5v9h2V5M11 5v9h2V5M16 5v9h2V5" fill="currentColor" stroke-width="1"/>'),
        church: svg('<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="M18 22V5.62a1 1 0 0 0-.55-.9l-4.56-2.27a2 2 0 0 0-1.78 0L6.55 4.72a1 1 0 0 0-.55.9V22"/><path d="m18 7 3.45 1.72a1 1 0 0 1 .55.9V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9.38a1 1 0 0 1 .55-.9L6 7"/>'),
        gamepad: svg('<path d="M6 11h4"/><path d="M8 9v4"/><path d="M15 12h.01"/><path d="M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.69-7.26A4 4 0 0 0 17.32 5z"/>'),
        wave: svg('<path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/>'),
        harp: svg('<path d="M6 21V3c7 2 11 8 12 16"/><path d="M4 21h16"/><path d="M9.5 6.5V21M13 10v11M16 14.5V21"/>'),
        xylophone: svg('<path d="M3 6h8M3 10h11M3 14h14M3 18h17"/><path d="m15 3 4.5 4.5"/><circle cx="20.5" cy="8.5" r="1.6"/>'),
        gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
        zither: svg('<path d="M2.6 16.6 19.4 5.4a2 2 0 0 1 2.2 3.3L4.8 19.9a2 2 0 0 1-2.2-3.3z"/><path d="M6 15.6 19 7M7.4 17.6 20.4 9"/>'),
        guqin: svg('<path d="M2.6 16.6 19.4 5.4a2 2 0 0 1 2.2 3.3L4.8 19.9a2 2 0 0 1-2.2-3.3z"/><path d="M6.5 16.4 19.5 7.8"/><circle cx="9" cy="17.2" r=".6" fill="currentColor"/><circle cx="12" cy="15.2" r=".6" fill="currentColor"/><circle cx="15" cy="13.2" r=".6" fill="currentColor"/>'),
        flute: svg('<path d="M3.6 20.4 18.6 5.4a1.4 1.4 0 0 1 2 2l-15 15a1.4 1.4 0 0 1-2-2z"/><circle cx="9.5" cy="15.5" r=".8" fill="currentColor"/><circle cx="12.5" cy="12.5" r=".8" fill="currentColor"/><circle cx="15.5" cy="9.5" r=".8" fill="currentColor"/>'),
        // Modelo, jogo e teclas
        simon: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="3"/>'),
        palette: svg('<circle cx="13.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".9" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".9" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2C19.48 16.38 22 13.88 22 10.82 21.97 6.01 17.46 2 12 2z"/>'),
        brain: svg('<path d="M12 5a3 3 0 1 0-6 .13 4 4 0 0 0-2.53 5.77 4 4 0 0 0 .56 6.59A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 6 .13 4 4 0 0 1 2.53 5.77 4 4 0 0 1-.56 6.59A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>'),
        score: svg('<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.7-1.7l-3.6-3.6A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v10.35"/><path d="M8 20v-7l3 1.47"/><circle cx="6" cy="20" r="2"/>'),
        eyeOff: svg('<path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>'),
        // Velocidade
        snail: svg('<path d="M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0"/><circle cx="10" cy="13" r="8"/><path d="M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6"/><path d="M18 3 19.1 5.2"/><path d="M22 3 20.9 5.2"/>'),
        turtle: svg('<path d="m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z"/><path d="M4.82 7.9 8 10"/><path d="M15.18 7.9 12 10"/><path d="M16.93 10H20a2 2 0 0 1 0 4H2"/>'),
        rabbit: svg('<path d="M13 16a3 3 0 0 1 2.24 5"/><path d="M18 12h.01"/><path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3"/><path d="M20 8.54V4a2 2 0 1 0-4 0v3"/><path d="M7.61 12.52a3 3 0 1 0-1.6 4.3"/>'),
        zap: svg('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'),
        // Ao errar, mão e dica
        repeat: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
        flag: svg('<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.07-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.53"/>'),
        handRight: svg(HAND),
        handLeft: svg(`<g transform="matrix(-1 0 0 1 24 0)">${HAND}</g>`),
        hands: svg('<path d="M3 21v-7.5a1.8 1.8 0 0 1 3.6 0V8a1.6 1.6 0 0 1 3.2 0v13"/><path d="M6.6 13.5V5.5a1.6 1.6 0 0 1 3.2 0"/><path d="M21 21v-7.5a1.8 1.8 0 0 0-3.6 0V8a1.6 1.6 0 0 0-3.2 0v13"/><path d="M17.4 13.5V5.5a1.6 1.6 0 0 0-3.2 0"/>'),
        bulb: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    };
    window.DINO_SELECT_ICONS = Object.assign(window.DINO_SELECT_ICONS || {}, ICONS);

    /** Mostra no combobox fechado o ícone da opção escolhida. */
    const update = (select) => {
        const key = select.selectedOptions[0]?.dataset.icon;
        const box = select._iconBox;
        if (!box) return;
        box.innerHTML = (key && ICONS[key]) || "";
        box.parentElement.classList.toggle("has-icon", !!(key && ICONS[key]));
    };
    /** Prepara os combobox que têm ícones (pode chamar de novo depois de trocar as opções). */
    const refresh = () => {
        document.querySelectorAll("select").forEach((select) => {
            if (![...select.options].some((o) => o.dataset.icon)) return;
            if (!select._iconBox) {
                const wrap = document.createElement("span");
                wrap.className = "sel-wrap";
                select.parentNode.insertBefore(wrap, select);
                wrap.appendChild(select);
                const box = document.createElement("span");
                box.className = "sel-icon";
                box.setAttribute("aria-hidden", "true");
                wrap.appendChild(box);
                select._iconBox = box;
                select.addEventListener("change", () => update(select));
                select.addEventListener("input", () => update(select));
            }
            update(select);
        });
    };
    window.DinoSelectIcons = { refresh };
})();
