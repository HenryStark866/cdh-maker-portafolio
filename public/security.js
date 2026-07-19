/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — security.js
   Capa de protección del sitio en producción (anti-inspección y anti-copia).
   Bloquea clic derecho, atajos de DevTools, copia/arrastre de contenido y
   difumina la página si detecta las herramientas de desarrollador abiertas.
   En localhost (o con ?bypass_security=cdh2026) se desactiva para poder trabajar.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-19
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE: aísla todo el módulo del scope global
(function () {
  "use strict"; // modo estricto: errores silenciosos se vuelven visibles

  // ── Detección de entorno de desarrollo ──────────────────────────────────────
  // true si la página corre en local (firebase serve / archivo abierto directo)
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "";

  // Llave de escape por URL para depurar en producción sin desplegar cambios
  const urlParams = new URLSearchParams(location.search);
  const bypass = urlParams.get("bypass_security") === "cdh2026";

  // En desarrollo local o con bypass NO se bloquea nada: salir del módulo
  if (isLocal || bypass) {
    window.CDH_SECURITY = { enabled: false }; // otros scripts pueden consultar el estado
    return;
  }

  // ── Desactivar menú contextual (clic derecho) ───────────────────────────────
  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault(); // cancela el menú del navegador
      flashGuard();       // muestra el aviso "Contenido protegido"
      return false;
    },
    true // fase de captura: se ejecuta antes que cualquier otro listener
  );

  // ── Bloquear atajos de teclado de inspección / copia / guardado ─────────────
  document.addEventListener(
    "keydown",
    (e) => {
      const key = e.key || "";              // tecla tal como la reporta el navegador
      const k = key.toLowerCase();          // versión en minúscula para comparar
      const ctrl = e.ctrlKey || e.metaKey;  // Ctrl en Windows/Linux, Cmd en Mac
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Atajos bloqueados:
      //   F12                       → DevTools
      //   Ctrl+Shift+I/J/C/K        → Inspeccionar / Consola / Selector
      //   Ctrl+U                    → Ver código fuente
      //   Ctrl+S                    → Guardar página
      //   Ctrl+P                    → Imprimir (permite copiar como PDF)
      //   Ctrl+A                    → Seleccionar todo (solo fuera de formularios)
      // En inputs/textarea/chat se permite todo para no romper la usabilidad
      const isInput = e.target.closest("input, textarea, select, [contenteditable='true']");

      if (
        key === "F12" ||
        (ctrl && shift && (k === "i" || k === "j" || k === "c" || k === "k")) ||
        (ctrl && (k === "u" || k === "s" || k === "p")) ||
        (alt && (key === "F12" || k === "i" || k === "j" || k === "c")) ||
        (ctrl && k === "a" && !isInput)
      ) {
        e.preventDefault();  // cancela la acción del navegador
        e.stopPropagation(); // impide que otros listeners la reciban
        flashGuard();        // feedback visual al usuario
        return false;
      }
    },
    true // captura: gana prioridad sobre listeners de la página
  );

  // ── Evitar arrastrar imágenes o elementos de UI fuera de la página ──────────
  document.addEventListener("dragstart", (e) => {
    if (e.target && (e.target.tagName === "IMG" || e.target.closest("a, button, svg"))) {
      e.preventDefault();
    }
  });

  // ── Evitar selección de texto (excepto en formularios y chat) ───────────────
  document.addEventListener("selectstart", (e) => {
    const t = e.target;
    if (!t) return;
    // Zonas donde SÍ se permite seleccionar: campos de formularios, modal de
    // cuenta y el chat (el visitante necesita escribir/copiar ahí)
    if (t.closest("input, textarea, select, [contenteditable='true'], .auth-modal, #cdh-chat")) return;
    e.preventDefault();
  });

  // ── Desactivar "copiar" en zonas protegidas ─────────────────────────────────
  document.addEventListener("copy", (e) => {
    const t = e.target;
    // En formularios y chat se permite copiar con normalidad
    if (t && t.closest("input, textarea, select, #cdh-chat, .auth-modal")) return;
    e.preventDefault();
    // Además, vacía el portapapeles por si el navegador ya copió algo
    try {
      e.clipboardData.setData("text/plain", "");
    } catch (_) {}
  });

  // ── Detección de DevTools + trampa debugger ─────────────────────────────────
  let warned = false;    // para mostrar el aviso solo la primera vez
  let lastOpen = false;  // último estado conocido de DevTools (evita retrabajos)

  // Muestra brevemente el overlay "Contenido protegido" (1.8 s)
  function flashGuard() {
    const el = document.getElementById("cdh-security-guard");
    if (!el) return;
    el.classList.add("show");
    clearTimeout(flashGuard._t); // reinicia el temporizador si ya estaba visible
    flashGuard._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // Cambia el estado "DevTools abierto/cerrado" y reacciona en consecuencia
  function setDevtoolsOpen(open) {
    if (open === lastOpen) return; // sin cambios → nada que hacer
    lastOpen = open;
    // La clase CSS difumina todo el contenido mientras DevTools esté abierto
    document.documentElement.classList.toggle("cdh-devtools-open", open);
    if (open) {
      if (!warned) {
        warned = true;
        flashGuard(); // primer aviso visual
      }
      triggerDebuggerTrap(); // activa la trampa que dificulta inspeccionar
    }
  }

  // Comprobación de DevTools por pausa del debugger.
  // (No usamos gaps de tamaño de ventana: dan falsos positivos con zoom
  //  del navegador o paneles laterales y bloqueaban a visitantes normales.)
  // Cómo funciona: la sentencia `debugger` solo PAUSA la ejecución si las
  // DevTools están abiertas; si la pausa duró >100 ms, estaban abiertas.
  function checkDevtools() {
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const t1 = performance.now();
    setDevtoolsOpen(t1 - t0 > 100);
  }

  // Trampa recursiva: mientras DevTools siga abierto, dispara `debugger` cada
  // 50 ms y limpia la consola, haciendo muy incómodo inspeccionar el sitio
  function triggerDebuggerTrap() {
    if (!lastOpen) return;
    (function trap() {
      if (lastOpen) {
        // eslint-disable-next-line no-debugger
        debugger;
        console.clear();
        setTimeout(trap, 50);
      }
    })();
  }

  // Monitoreo periódico (cada 800 ms) + re-chequeo al redimensionar la ventana
  setInterval(checkDevtools, 800);
  window.addEventListener("resize", checkDevtools);

  // ── Blindar la consola ──────────────────────────────────────────────────────
  // Reemplaza los métodos de console por funciones vacías para reducir el
  // filtrado de información interna en producción
  try {
    const noop = () => {};
    const methods = ["log", "debug", "info", "warn", "table", "dir", "dirxml", "trace", "clear"];
    methods.forEach((m) => {
      try {
        console[m] = noop;
      } catch (_) {}
    });
  } catch (_) {}

  // ── Overlay de aviso "Contenido protegido" ──────────────────────────────────
  // Se crea por JS (no vive en el HTML) para que exista en todas las páginas
  function mountGuard() {
    if (document.getElementById("cdh-security-guard")) return; // ya montado
    const div = document.createElement("div");
    div.id = "cdh-security-guard";
    div.setAttribute("aria-hidden", "true"); // decorativo: invisible a lectores de pantalla
    div.innerHTML =
      '<div class="cdh-guard-card"><span class="cdh-guard-icon">🛡</span><strong>Contenido protegido</strong><p>La inspección y copia de este sitio están restringidas.</p></div>';
    document.body.appendChild(div);
  }

  // Montar el overlay cuando el DOM esté disponible
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountGuard);
  } else {
    mountGuard();
  }

  // ── Estilos de la capa de seguridad (inyectados por JS) ─────────────────────
  // Anti-selección global + estilos del overlay + difuminado con DevTools abierto
  const style = document.createElement("style");
  style.textContent = `
    /* Bloquea la selección de texto en todo el sitio */
    html.cdh-secure body {
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
    /* …pero la permite en los campos donde el usuario debe escribir */
    html.cdh-secure input,
    html.cdh-secure textarea,
    html.cdh-secure select,
    html.cdh-secure [contenteditable="true"],
    html.cdh-secure .auth-modal,
    html.cdh-secure #cdh-chat {
      -webkit-user-select: text;
      user-select: text;
    }
    /* Con DevTools abierto: difumina y congela todo excepto el aviso */
    html.cdh-devtools-open body > *:not(#cdh-security-guard) {
      filter: blur(12px) !important;
      pointer-events: none !important;
      user-select: none !important;
    }
    /* Overlay a pantalla completa (oculto por defecto) */
    #cdh-security-guard {
      position: fixed; inset: 0; z-index: 99999;
      display: grid; place-items: center;
      background: rgba(3, 16, 26, 0.85);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
      backdrop-filter: blur(6px);
    }
    /* Overlay visible: al hacer flash o mientras DevTools esté abierto */
    #cdh-security-guard.show,
    html.cdh-devtools-open #cdh-security-guard {
      opacity: 1; pointer-events: auto;
    }
    /* Tarjeta central del aviso */
    .cdh-guard-card {
      background: #0a2833; border: 1px solid #17404f; color: #e6f6f9;
      border-radius: 16px; padding: 28px 32px; text-align: center;
      max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.45);
      font-family: Inter, system-ui, sans-serif;
    }
    .cdh-guard-icon { font-size: 1.8rem; display: block; margin-bottom: 8px; }
    .cdh-guard-card strong { display: block; font-size: 1.1rem; margin-bottom: 6px; color: #22d3ee; }
    .cdh-guard-card p { margin: 0; color: #9fc0c9; font-size: 0.92rem; line-height: 1.45; }
  `;
  document.head.appendChild(style);
  // Activa el modo seguro (clase que dispara el CSS anti-selección de arriba)
  document.documentElement.classList.add("cdh-secure");

  // API pública mínima para otros scripts del sitio
  window.CDH_SECURITY = { enabled: true, flashGuard };
})();
