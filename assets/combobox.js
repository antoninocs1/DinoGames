/* ========================================================
   DinoGames — combobox.js (mesmo modelo do projeto PCF)
   No celular, troca a lista do sistema dos <select> por uma
   lista compacta com título e marca na opção escolhida.
   O <select> continua na página guardando valor e eventos.
   ======================================================== */
(() => {
    const MARGEM = 8;
    const LARGURA_MINIMA = 220;
    const TOQUE_TOLERANCIA = 10;
    const CHECK_SVG = '<svg class="dg-combo-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.8 10A10 10 0 1 1 17 3.34"/><path d="m9 11 3 3L22 4"/></svg>';
    const modoCelular = window.matchMedia("(pointer: coarse), (max-width: 760px)");
    let aberta = null;
    let toqueInicio = null;

    const elegivel = (el) => modoCelular.matches && el instanceof HTMLSelectElement && !el.disabled && !el.multiple && el.size <= 1;

    const fechar = (devolverFoco = false) => {
        if (!aberta) return;
        const { lista, select } = aberta;
        aberta = null;
        lista.remove();
        if (devolverFoco && select.isConnected) select.focus({ preventScroll: true });
    };

    const tituloDe = (select) => {
        const rotulo = (select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`))
            || select.closest("label")?.querySelector("span");
        return (rotulo?.textContent || select.getAttribute("aria-label") || "").trim();
    };

    const posicionar = (lista, select) => {
        const r = select.getBoundingClientRect();
        const larguraTela = document.documentElement.clientWidth;
        const alturaTela = window.innerHeight;
        const largura = Math.min(Math.max(r.width, LARGURA_MINIMA), larguraTela - MARGEM * 2);
        lista.style.width = `${largura}px`;
        lista.style.left = `${Math.max(MARGEM, Math.min(r.left, larguraTela - largura - MARGEM))}px`;
        const abaixo = alturaTela - r.bottom - MARGEM * 2;
        const acima = r.top - MARGEM * 2;
        if (lista.scrollHeight <= abaixo || abaixo >= acima) {
            lista.style.top = `${r.bottom + MARGEM}px`;
            lista.style.maxHeight = `${abaixo}px`;
        } else {
            lista.style.bottom = `${alturaTela - r.top + MARGEM}px`;
            lista.style.maxHeight = `${acima}px`;
        }
    };

    const escolher = (select, valor) => {
        const mudou = select.value !== valor;
        fechar(true);
        if (!mudou || !select.isConnected) return;
        select.value = valor;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const abrir = (select, peloTeclado = false) => {
        if (aberta?.select === select) { fechar(true); return; }
        fechar();
        const lista = document.createElement("div");
        lista.className = "dg-combo-lista";
        lista.setAttribute("role", "listbox");
        const titulo = tituloDe(select);
        if (titulo) {
            const t = document.createElement("div");
            t.className = "dg-combo-titulo";
            t.textContent = titulo;
            lista.appendChild(t);
        }
        [...select.options].filter((o) => !o.hidden).forEach((o) => {
            const opt = document.createElement("button");
            opt.type = "button";
            opt.className = `dg-combo-opt${o.selected ? " selected" : ""}`;
            opt.setAttribute("role", "option");
            opt.setAttribute("aria-selected", String(o.selected));
            opt.disabled = o.disabled;
            const texto = document.createElement("span");
            texto.textContent = o.textContent;
            opt.appendChild(texto);
            if (o.selected) opt.insertAdjacentHTML("beforeend", CHECK_SVG);
            opt.onclick = () => escolher(select, o.value);
            lista.appendChild(opt);
        });
        document.body.appendChild(lista);
        posicionar(lista, select);
        aberta = { lista, select };
        const atual = lista.querySelector(".selected");
        if (atual) atual.scrollIntoView({ block: "nearest" });
        if (peloTeclado) (atual || lista.querySelector(".dg-combo-opt:not(:disabled)"))?.focus({ preventScroll: true });
    };

    const moverFoco = (e) => {
        const opcoes = [...aberta.lista.querySelectorAll(".dg-combo-opt:not(:disabled)")];
        if (!opcoes.length) return;
        const i = opcoes.indexOf(document.activeElement);
        const destino = { ArrowDown: Math.min(i + 1, opcoes.length - 1), ArrowUp: Math.max(i - 1, 0), Home: 0, End: opcoes.length - 1 }[e.key];
        e.preventDefault();
        opcoes[destino].focus();
    };

    // Mouse (tela estreita): impede a lista do sistema
    document.addEventListener("mousedown", (e) => {
        if (!elegivel(e.target)) return;
        e.preventDefault();
        e.target.focus({ preventScroll: true });
        abrir(e.target);
    });

    // Toque: arrastar o dedo sobre o campo é rolagem, não abre
    document.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        toqueInicio = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    document.addEventListener("touchend", (e) => {
        if (!elegivel(e.target) || !toqueInicio) return;
        const t = e.changedTouches[0];
        if (Math.abs(t.clientX - toqueInicio.x) > TOQUE_TOLERANCIA || Math.abs(t.clientY - toqueInicio.y) > TOQUE_TOLERANCIA) return;
        e.preventDefault();
        abrir(e.target);
    }, { passive: false });

    document.addEventListener("keydown", (e) => {
        if (aberta) {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(true); }
            else if (e.key === "Tab") fechar(true);
            else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) { moverFoco(e); e.stopPropagation(); }
            else if (e.key === "Enter" || e.key === " ") e.stopPropagation(); // o botão focado escolhe; o jogo não reage
            return;
        }
        const abreLista = e.key === "Enter" || e.key === " " || e.key === "F4"
            || (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"));
        if (abreLista && elegivel(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            abrir(e.target, true);
        }
    }, true);

    document.addEventListener("pointerdown", (e) => {
        if (aberta && !aberta.lista.contains(e.target) && e.target !== aberta.select) fechar();
    }, true);
    window.addEventListener("scroll", (e) => {
        if (aberta && !aberta.lista.contains(e.target)) fechar();
    }, true);
    window.addEventListener("resize", () => fechar());
})();
