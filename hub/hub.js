(() => {
    const games = window.DINO_GAMES || [];
    const icons = window.DINO_ICONS || {};

    const $ = (id) => document.getElementById(id);
    const root = document.documentElement;
    const app = document.querySelector(".app");
    const backdrop = $("backdrop");
    const gameList = $("game-list");
    const cards = $("cards");
    const player = $("player");
    const frame = $("game-frame");
    const loading = $("loading");
    const info = $("info");
    const gameWindow = $("game-window");
    const title = $("topbar-title");
    const actions = $("topbar-actions");
    const divider = $("topbar-divider");
    const menuToggle = $("menu-toggle");
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    const PAGES = {
        home: { el: $("home"), title: "Início" },
        sobre: { el: $("page-sobre"), title: "Sobre" },
        apoie: { el: $("page-apoie"), title: "Nos apoie" },
    };

    // Versão do app (mostrada no rodapé do menu). Para publicar uma nova versão rode
    // "npm run versao": ele atualiza este número, o cache do sw.js e os ?v= dos arquivos.
    const APP_VERSION = "1.045";
    // Abre os jogos com ?v= para o navegador não usar arquivos de uma versão antiga.
    const withVersion = (path) => `${path}${path.includes("?") ? "&" : "?"}v=${APP_VERSION}`;
    $("app-version").innerHTML = `<span class="app-version-label">Versão </span>${APP_VERSION}`;

    const COLLAPSED_KEY = "dinogames-sidebar-collapsed";
    const THEME_KEY = "dinogames-theme";
    const GLOW_KEY = "dinogames-glow";
    const PIX_KEY = "71988177989";
    const mobileQuery = window.matchMedia("(max-width: 860px)");

    let currentGame = null;

    const storage = {
        get(key) {
            try { return localStorage.getItem(key); } catch { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch { /* indisponível */ }
        },
    };

    const escapeHtml = (text) =>
        String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    // ---------- Ícones ----------

    const renderIcons = (scope = document) => {
        scope.querySelectorAll("[data-icon]").forEach((el) => {
            const icon = icons[el.dataset.icon];
            if (icon && !el.firstElementChild) el.innerHTML = icon;
        });
        scope.querySelectorAll("[data-dino]").forEach((el) => {
            if (!el.firstElementChild) el.innerHTML = window.DINO_LOGO || "";
        });
    };

    // ---------- Construção do menu e dos cartões ----------

    // Ícone SVG do jogo (cai para o texto do campo "icon" se não existir um SVG com esse nome).
    const gameIcon = (game) => icons[game.icon] || escapeHtml(game.icon);

    const renderMenu = () => {
        gameList.innerHTML = games.map((game) => `
            <a class="game-link" href="#${game.id}" data-id="${game.id}" style="--accent:${game.color}" title="${escapeHtml(game.title)}">
                <span class="game-link-icon game-icon" aria-hidden="true">${gameIcon(game)}</span>
                <span class="game-link-title">${escapeHtml(game.title)}</span>
            </a>
        `).join("");

        cards.innerHTML = games.map((game) => `
            <a class="card" href="#${game.id}" style="--accent:${game.color}">
                <span class="card-icon game-icon" aria-hidden="true">${gameIcon(game)}</span>
                <span class="card-title">${escapeHtml(game.title)}</span>
                <span class="card-desc">${escapeHtml(game.description)}</span>
                <span class="card-play">Jogar ▶</span>
            </a>
        `).join("");

        $("stat-games").textContent = String(games.length);
    };

    const renderInfo = (game) => {
        info.innerHTML = `
            <h2><span class="info-icon game-icon" style="--accent:${game.color}" aria-hidden="true">${gameIcon(game)}</span> ${escapeHtml(game.title)}</h2>
            <p>${escapeHtml(game.description)}</p>
            <h3>Controles</h3>
            <dl class="controls">
                ${game.controls.map(([key, action]) => `
                    <div><dt><kbd>${escapeHtml(key)}</kbd></dt><dd>${escapeHtml(action)}</dd></div>
                `).join("")}
            </dl>
            <p class="hint">Clique dentro da janela do jogo se o teclado não responder.</p>
        `;
    };

    // ---------- Navegação ----------

    const focusGame = () => {
        try {
            frame.focus();
            frame.contentWindow?.focus();
        } catch { /* origem diferente: ignora */ }
    };

    const setGameUi = (visible) => {
        actions.hidden = !visible;
        divider.hidden = !visible;
        player.hidden = !visible;
    };

    const showPage = (name) => {
        Object.entries(PAGES).forEach(([key, page]) => {
            page.el.hidden = key !== name;
        });
    };

    const openGame = (game) => {
        if (currentGame?.id === game.id) {
            focusGame();
            return;
        }

        currentGame = game;
        document.title = `${game.title} · DinoGames`;
        title.textContent = game.title;
        showPage(null);
        setGameUi(true);
        player.style.setProperty("--accent", game.color);
        loading.hidden = false;
        renderInfo(game);

        frame.title = game.title;
        frame.src = withVersion(game.path);
    };

    const openPage = (name) => {
        if (currentGame) {
            currentGame = null;
            frame.src = "about:blank";
        }
        setGameUi(false);
        showPage(name);
        title.textContent = PAGES[name].title;
        document.title = name === "home" ? "DinoGames" : `${PAGES[name].title} · DinoGames`;
        PAGES[name].el.scrollTop = 0;
    };

    const updateActiveLinks = (activeKey) => {
        document.querySelectorAll(".sidebar .game-link").forEach((link) => {
            const key = link.dataset.id || link.dataset.page;
            const active = key === activeKey;
            link.classList.toggle("active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    };

    const route = () => {
        const id = decodeURIComponent(location.hash.slice(1));
        const game = games.find((g) => g.id === id);

        if (game) {
            openGame(game);
            updateActiveLinks(game.id);
        } else {
            const page = PAGES[id] ? id : "home";
            openPage(page);
            updateActiveLinks(page);
        }
        closeMobileMenu();
    };

    frame.addEventListener("load", () => {
        if (frame.src.endsWith("about:blank")) return;
        loading.hidden = true;
        focusGame();
    });

    // ---------- Menu lateral ----------

    const setCollapsed = (collapsed) => {
        app.classList.toggle("collapsed", collapsed);
        storage.set(COLLAPSED_KEY, collapsed ? "1" : "0");
    };

    const openMobileMenu = () => {
        app.classList.add("menu-open");
        backdrop.hidden = false;
        menuToggle.setAttribute("aria-expanded", "true");
    };

    const closeMobileMenu = () => {
        app.classList.remove("menu-open");
        backdrop.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
    };

    $("sidebar-collapse").addEventListener("click", () => setCollapsed(!app.classList.contains("collapsed")));
    menuToggle.addEventListener("click", () => {
        if (mobileQuery.matches) {
            app.classList.contains("menu-open") ? closeMobileMenu() : openMobileMenu();
        } else {
            setCollapsed(!app.classList.contains("collapsed"));
        }
    });
    backdrop.addEventListener("click", closeMobileMenu);
    mobileQuery.addEventListener("change", closeMobileMenu);

    document.querySelectorAll("[data-home]").forEach((link) =>
        link.addEventListener("click", (event) => {
            event.preventDefault();
            history.pushState(null, "", location.pathname);
            route();
        })
    );

    // ---------- Tema claro/escuro ----------

    const applyTheme = (theme) => {
        root.setAttribute("data-theme", theme);
        themeMeta?.setAttribute("content", theme === "light" ? "#f4f6fb" : "#0f1117");
        const btn = $("btn-theme");
        const label = theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro";
        btn.title = label;
        btn.setAttribute("aria-label", label);
    };

    $("btn-theme").addEventListener("click", () => {
        const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
        storage.set(THEME_KEY, next);
        applyTheme(next);
    });

    // Sem preferência salva, acompanha a mudança de tema do sistema.
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
        if (!storage.get(THEME_KEY)) applyTheme(event.matches ? "light" : "dark");
    });

    // ---------- Efeito lanterna ----------

    const glowBtn = $("btn-glow");

    const getLight = () => {
        let light = $("dino-luz");
        if (!light) {
            light = document.createElement("div");
            light.id = "dino-luz";
            light.className = "dino-luz";
            light.setAttribute("aria-hidden", "true");
            document.body.appendChild(light);
        }
        return light;
    };

    const onGlowMove = (event) => {
        const light = getLight();
        light.style.setProperty("--glow-x", `${event.clientX}px`);
        light.style.setProperty("--glow-y", `${event.clientY}px`);
        light.style.opacity = "1";
    };

    const hideGlow = () => {
        const light = $("dino-luz");
        if (light) light.style.opacity = "0";
    };

    const setGlow = (enabled) => {
        glowBtn.setAttribute("aria-pressed", String(enabled));
        glowBtn.title = enabled ? "Desativar efeito lanterna" : "Ativar efeito lanterna";
        storage.set(GLOW_KEY, enabled ? "1" : "0");

        if (enabled) {
            document.addEventListener("mousemove", onGlowMove, { passive: true });
            root.addEventListener("mouseleave", hideGlow);
            // O mouse sobre o jogo não gera eventos no hub: apaga a luz para não ficar parada.
            frame.addEventListener("mouseenter", hideGlow);
        } else {
            document.removeEventListener("mousemove", onGlowMove);
            root.removeEventListener("mouseleave", hideGlow);
            frame.removeEventListener("mouseenter", hideGlow);
            $("dino-luz")?.remove();
        }
    };

    glowBtn.addEventListener("click", () => setGlow(glowBtn.getAttribute("aria-pressed") !== "true"));

    // ---------- Nos apoie ----------

    $("support-copy-pix").addEventListener("click", async () => {
        const feedback = $("support-copy-feedback");
        try {
            await navigator.clipboard.writeText(PIX_KEY);
            feedback.textContent = "Chave PIX copiada. Obrigado pelo seu apoio!";
        } catch {
            feedback.textContent = `Chave PIX: ${PIX_KEY}`;
        }
        feedback.classList.add("show");
    });

    // ---------- Ações do jogo ----------

    $("btn-reload").addEventListener("click", () => {
        if (!currentGame) return;
        loading.hidden = false;
        frame.src = withVersion(currentGame.path);
    });

    $("btn-fullscreen").addEventListener("click", () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            gameWindow.requestFullscreen?.().then(focusGame).catch(() => {});
        }
    });

    $("btn-close").addEventListener("click", () => {
        history.pushState(null, "", location.pathname);
        route();
    });

    document.addEventListener("fullscreenchange", focusGame);

    // ---------- PWA: modo offline e instalação ----------

    // ---------- Limpar cookies/cache e carregar a versão atual (igual ao PCF) ----------
    const clearCacheAndReload = async () => {
        if (!confirm("Limpar cookies/cache deste navegador e recarregar a versão atual?")) return;
        try {
            document.cookie.split(";").forEach((cookie) => {
                const name = cookie.split("=")[0].trim();
                if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            });
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map((key) => caches.delete(key)));
            }
            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((reg) => reg.unregister()));
            }
        } catch (err) {
            console.warn("[DinoGames] Falha ao limpar cache/cookies:", err);
        } finally {
            const url = new URL(window.location.href);
            url.searchParams.set("refresh", Date.now().toString());
            window.location.replace(url.toString());
        }
    };
    $("btn-refresh-cache").addEventListener("click", clearCacheAndReload);

    // Tira o ?refresh= da barra de endereço depois de recarregar.
    if (new URLSearchParams(location.search).has("refresh")) {
        const url = new URL(location.href);
        url.searchParams.delete("refresh");
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }

    // ---------- Aviso de nova versão ----------
    // Quando uma versão nova do service worker assume o controle, oferece recarregar.
    const updateToast = $("update-toast");
    $("btn-update").addEventListener("click", () => window.location.reload());

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (hadController) updateToast.hidden = false;
        });
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js").then((reg) => {
                // Procura atualização ao voltar para o app (útil quando ele fica aberto muito tempo).
                document.addEventListener("visibilitychange", () => {
                    if (!document.hidden) reg.update().catch(() => {});
                });
            }).catch(() => { /* sem modo offline */ });
        });
    }

    // ---------- Instalar como app (mesmo modelo do PCF) ----------
    // Os botões ficam visíveis enquanto o DinoGames não estiver rodando instalado.
    // Com o pedido de instalação do navegador (Chrome/Edge/Android) instala direto;
    // sem ele (iPhone, Firefox…) mostra as instruções.
    const installBtns = [$("btn-install"), $("home-install")];
    const installBox = $("install-box");
    const installModal = $("install-modal");
    let installPrompt = null;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

    const syncInstall = () => {
        const hide = isStandalone();
        installBtns.forEach((btn) => (btn.hidden = hide));
        installBox.hidden = hide;
    };

    const showInstallSteps = () => {
        $("install-steps").innerHTML = isIos
            ? `<li>Toque no botão <strong>Compartilhar</strong> <span aria-hidden="true">⎋</span> do Safari.</li>
               <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
               <li>Confirme em <strong>Adicionar</strong>.</li>`
            : `<li>Abra o menu do navegador (<strong>⋮</strong> ou <strong>…</strong>).</li>
               <li>Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
               <li>Confirme a instalação.</li>`;
        $("install-note").textContent = isIos ? "" : "Se a opção não aparecer, use o Chrome, Edge ou Samsung Internet com o site aberto em HTTPS.";
        installModal.hidden = false;
        $("install-ok").focus();
    };
    const closeInstallSteps = () => (installModal.hidden = true);
    $("install-ok").addEventListener("click", closeInstallSteps);
    installModal.addEventListener("click", (event) => event.target === installModal && closeInstallSteps());
    document.addEventListener("keydown", (event) => event.key === "Escape" && !installModal.hidden && closeInstallSteps());

    const install = async () => {
        if (!installPrompt) {
            showInstallSteps();
            return;
        }
        const prompt = installPrompt;
        installPrompt = null;
        prompt.prompt();
        await prompt.userChoice.catch(() => null);
        syncInstall();
    };

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        installPrompt = event;
        syncInstall();
    });
    window.addEventListener("appinstalled", () => {
        installPrompt = null;
        syncInstall();
    });
    installBtns.forEach((btn) => btn.addEventListener("click", install));
    window.matchMedia("(display-mode: standalone)").addEventListener?.("change", syncInstall);
    syncInstall();

    // ---------- Contador de acessos ----------
    // Usa o Abacus (abacus.jasoncameron.dev), um contador gratuito sem cadastro:
    // cada abertura do DinoGames soma 1 e devolve o total. Sem internet ou com o
    // serviço fora do ar, a linha do contador fica oculta e o resto funciona normal.
    const countVisit = async () => {
        if (location.protocol === "file:") return;
        try {
            const res = await fetch("https://abacus.jasoncameron.dev/hit/dinogames-app/visits", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const count = Number((await res.json()).value) || 1;
            $("visit-count-label").textContent = count === 1 ? "1 acesso registrado" : `${count.toLocaleString("pt-BR")} acessos registrados`;
            $("visit-counter").hidden = false;
        } catch (err) {
            console.warn("[DinoGames] Contador de acessos indisponível:", err.message);
        }
    };

    // ---------- Inicialização ----------

    if (location.protocol === "file:") {
        $("server-warning").hidden = false;
    }

    renderMenu();
    renderIcons();
    applyTheme(root.getAttribute("data-theme") || "dark");
    setGlow(storage.get(GLOW_KEY) === "1");
    setCollapsed(storage.get(COLLAPSED_KEY) === "1");
    window.addEventListener("hashchange", route);
    window.addEventListener("popstate", route);
    route();
    countVisit();
})();
