// Ícones SVG embutidos (estilo Lucide) usados no hub.
(() => {
    const svg = (body, { fill = "none" } = {}) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}" stroke="${fill === "none" ? "currentColor" : "none"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

    window.DINO_ICONS = {
        // Ícones dos jogos
        tetris: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2.5" y="4" width="6" height="6" rx="1.2"/><rect x="9" y="4" width="6" height="6" rx="1.2"/><rect x="15.5" y="4" width="6" height="6" rx="1.2"/><rect x="9" y="10.5" width="6" height="6" rx="1.2"/><rect x="2.5" y="14" width="6" height="6" rx="1.2" opacity=".55"/><rect x="15.5" y="14" width="6" height="6" rx="1.2" opacity=".55"/></svg>',
        invader: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -2 12 12" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1.02" height="1.02"/><rect x="8" y="0" width="1.02" height="1.02"/><rect x="3" y="1" width="1.02" height="1.02"/><rect x="7" y="1" width="1.02" height="1.02"/><rect x="2" y="2" width="1.02" height="1.02"/><rect x="3" y="2" width="1.02" height="1.02"/><rect x="4" y="2" width="1.02" height="1.02"/><rect x="5" y="2" width="1.02" height="1.02"/><rect x="6" y="2" width="1.02" height="1.02"/><rect x="7" y="2" width="1.02" height="1.02"/><rect x="8" y="2" width="1.02" height="1.02"/><rect x="1" y="3" width="1.02" height="1.02"/><rect x="2" y="3" width="1.02" height="1.02"/><rect x="4" y="3" width="1.02" height="1.02"/><rect x="5" y="3" width="1.02" height="1.02"/><rect x="6" y="3" width="1.02" height="1.02"/><rect x="8" y="3" width="1.02" height="1.02"/><rect x="9" y="3" width="1.02" height="1.02"/><rect x="0" y="4" width="1.02" height="1.02"/><rect x="1" y="4" width="1.02" height="1.02"/><rect x="2" y="4" width="1.02" height="1.02"/><rect x="3" y="4" width="1.02" height="1.02"/><rect x="4" y="4" width="1.02" height="1.02"/><rect x="5" y="4" width="1.02" height="1.02"/><rect x="6" y="4" width="1.02" height="1.02"/><rect x="7" y="4" width="1.02" height="1.02"/><rect x="8" y="4" width="1.02" height="1.02"/><rect x="9" y="4" width="1.02" height="1.02"/><rect x="10" y="4" width="1.02" height="1.02"/><rect x="0" y="5" width="1.02" height="1.02"/><rect x="2" y="5" width="1.02" height="1.02"/><rect x="3" y="5" width="1.02" height="1.02"/><rect x="4" y="5" width="1.02" height="1.02"/><rect x="5" y="5" width="1.02" height="1.02"/><rect x="6" y="5" width="1.02" height="1.02"/><rect x="7" y="5" width="1.02" height="1.02"/><rect x="8" y="5" width="1.02" height="1.02"/><rect x="10" y="5" width="1.02" height="1.02"/><rect x="0" y="6" width="1.02" height="1.02"/><rect x="2" y="6" width="1.02" height="1.02"/><rect x="8" y="6" width="1.02" height="1.02"/><rect x="10" y="6" width="1.02" height="1.02"/><rect x="3" y="7" width="1.02" height="1.02"/><rect x="4" y="7" width="1.02" height="1.02"/><rect x="6" y="7" width="1.02" height="1.02"/><rect x="7" y="7" width="1.02" height="1.02"/></svg>',

        ship: svg('<path d="M12 10.189V14"/><path d="M12 2v3"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>'),
        maze: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v8h4"/><path d="M15 7h-4"/><path d="M17 11v6h-6"/><path d="M7 15v6"/><path d="M11 11v2"/>'),
        checkers: svg('<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="4.5"/><path d="M8.5 7.5 9.5 4l2.5 2 2.5-2 1 3.5"/>'),
        car: svg('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),

        download: svg('<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'),
        sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
        moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
        flashlight: svg('<path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z"/><line x1="6" x2="18" y1="6" y2="6"/><line x1="12" x2="12" y1="12" y2="12"/>'),
        refresh: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
        home: svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
        info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
        heart: svg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
        globe: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
        mail: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
        copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
        github: svg('<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>'),
        instagram: svg('<path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5zm8.93 1.35a1.07 1.07 0 1 1 0 2.14 1.07 1.07 0 0 1 0-2.14zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z"/>', { fill: "currentColor" }),
    };

    // Dinossauro do DinoGames com o contorno controlado por CSS (--dino-line),
    // para se adaptar ao tema claro/escuro. Mesmo desenho de assets/dino.svg.
    window.DINO_LOGO = `<svg class="dino-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" aria-hidden="true">
  <g class="dino-line" stroke-width="44" stroke-linejoin="round" stroke-linecap="round">
    <g fill="#F5B021">
      <path d="M160 840 Q65 840 68 755 Q135 735 235 760 Z"/>
      <path d="M248 712 Q148 702 150 605 Q222 585 305 615 Z"/>
      <path d="M308 572 Q212 552 222 450 Q292 430 355 460 Z"/>
      <path d="M358 408 Q268 372 284 265 Q352 245 415 290 Z"/>
      <path d="M440 210 Q425 120 470 62 Q545 78 580 148 Z"/>
      <path d="M628 140 Q668 58 732 34 Q795 80 798 172 Z"/>
    </g>
    <path fill="#34CCA3" d="M40 880 C120 850 220 790 280 640 C330 520 350 380 400 280 C450 170 560 120 690 125 C830 130 930 220 935 330 C940 420 870 470 790 468 L745 490 C770 570 790 650 800 745 C825 695 880 685 930 712 C975 740 985 860 950 920 C920 955 820 950 700 948 L120 935 C60 932 20 912 40 880 Z"/>
    <g fill="none">
      <path d="M738 440 Q770 478 835 462"/>
      <path d="M600 510 C660 560 705 610 668 652 C628 690 565 655 515 600"/>
      <path d="M700 762 L800 762"/>
    </g>
  </g>
  <circle cx="655" cy="255" r="32" fill="#0B0B24"/>
</svg>`;
})();
