/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — theme.js
   Gestor del tema visual de todo el sitio: claro, oscuro e inmersivo.
   Aplica el tema lo antes posible (antes de pintar) para evitar "parpadeo",
   lo persiste en localStorage y expone un botón que rota entre los tres
   (#themeToggle): claro → oscuro → inmersivo → claro.
   Inmersivo = paleta nocturna + el fondo animado de metaverse.js, que solo se
   descarga la primera vez que alguien entra a ese modo.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-29
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE (función autoejecutable): aísla las variables para no contaminar el scope global
(function () {
  // Clave usada en localStorage para recordar el tema elegido por el usuario
  const KEY = "cdh-theme";
  // Orden de rotación del botón
  const ORDEN = ["light", "dark", "immersive"];
  // Referencia al elemento <html>; el tema se aplica como atributo data-theme
  const root = document.documentElement;

  // Lee el tema guardado en localStorage ("light" | "dark" | "immersive" | null)
  // El try/catch protege contra navegadores con localStorage bloqueado (modo privado)
  function saved() {
    try {
      const v = localStorage.getItem(KEY);
      return ORDEN.includes(v) ? v : null;
    } catch (e) { return null; }
  }

  // Consulta al sistema operativo si el usuario prefiere tema claro
  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  // Devuelve el tema actualmente aplicado en <html data-theme="...">
  function current() {
    const t = root.getAttribute("data-theme");
    return ORDEN.includes(t) ? t : "dark";
  }
  const siguiente = (t) => ORDEN[(ORDEN.indexOf(t) + 1) % ORDEN.length];

  // Iconos SVG inline del botón. Regla de UX: el icono anuncia el modo al que
  // se pasa con el clic (en claro se ve la luna, en oscuro el destello del
  // inmersivo y en inmersivo el sol).
  // Sin width/height: así aplica la regla `.nav-icon svg { width:20px }` de
  // styles.css y el icono queda alineado con los demás del menú lateral.
  const ICONS = {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    immersive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  };
  // Nombre de cada modo para el tooltip y el lector de pantalla
  const NOMBRES = {
    es: { light: "claro", dark: "oscuro", immersive: "inmersivo", pre: "Tema: ", sig: " · siguiente: " },
    en: { light: "light", dark: "dark", immersive: "immersive", pre: "Theme: ", sig: " · next: " },
    pt: { light: "claro", dark: "escuro", immersive: "imersivo", pre: "Tema: ", sig: " · próximo: " },
    fr: { light: "clair", dark: "sombre", immersive: "immersif", pre: "Thème : ", sig: " · suivant : " },
  };

  // Pinta el icono DENTRO de <span class="nav-icon">, nunca sobre el botón
  // entero: antes un btn.innerHTML borraba también <span class="nav-label">Tema</span>,
  // así que la etiqueta desaparecía para siempre al primer clic (y en móvil,
  // donde los labels sí se ven, el botón quedaba mudo).
  function pintarIcono(theme) {
    const btn = document.getElementById("themeToggle");
    if (!btn) return; // páginas sin botón de tema
    const caja = btn.querySelector(".nav-icon") || btn;
    const prox = siguiente(theme);
    caja.innerHTML = ICONS[prox];
    const n = NOMBRES[(root.getAttribute("lang") || "en").slice(0, 2)] || NOMBRES.en;
    btn.title = n.pre + n[theme] + n.sig + n[prox];
  }

  // Fondo animado: el canvas y metaverse.js se crean la primera vez que se
  // entra al modo inmersivo (quien nunca lo usa no descarga nada). Solo en
  // páginas con botón de tema: el perfil y los paneles quedan en oscuro plano.
  let fondoListo = false;
  function montarFondo() {
    if (fondoListo || !document.getElementById("themeToggle")) return;
    fondoListo = true;
    const c = document.createElement("canvas");
    c.id = "metaverse";
    c.setAttribute("aria-hidden", "true");
    document.body.prepend(c);
    const s = document.createElement("script");
    s.src = "/metaverse.js?v=12";
    s.defer = true;
    document.head.appendChild(s);
  }
  function fondoSiHaceFalta() {
    if (current() !== "immersive") return;
    if (document.body) montarFondo();
    else document.addEventListener("DOMContentLoaded", montarFondo, { once: true });
  }

  // Aplica un tema al documento.
  //   theme:   "light" | "dark" | "immersive"
  //   persist: true → además lo guarda en localStorage para futuras visitas
  function set(theme, persist) {
    // 1. Estampa el atributo que activa las variables CSS del tema (ver styles.css)
    root.setAttribute("data-theme", theme);
    // 2. Persiste la elección si corresponde (try/catch por localStorage bloqueado)
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
    // 3. Actualiza el icono del botón de alternancia si ya existe en el DOM
    pintarIcono(theme);
    // 4. El inmersivo necesita su fondo animado
    fondoSiHaceFalta();
    // 5. Notifica al resto de scripts (ej: metaverse.js se pausa fuera del inmersivo)
    window.dispatchEvent(new CustomEvent("cdh:themechange", { detail: { theme } }));
  }

  // ── Arranque inmediato: decidir el tema inicial ─────────────────────────────
  // Prioridad: 1) parámetro de URL ?theme=  2) elección guardada  3) preferencia del SO
  // (el inmersivo nunca es automático: se elige con el botón o con ?theme=immersive)
  let urlTheme = null;
  try {
    // Permite forzar el tema por URL (útil para demos y capturas): ?theme=immersive
    const p = new URLSearchParams(location.search).get("theme");
    if (ORDEN.includes(p)) urlTheme = p;
  } catch (e) {}
  // Resuelve el tema con la cadena de prioridades y lo aplica ya mismo (evita flash)
  const initial = urlTheme || saved() || (systemPrefersLight() ? "light" : "dark");
  // Solo se persiste si vino explícito por URL (una visita normal no debe sobreescribir)
  set(initial, !!urlTheme);

  // ── Conexión del botón (cuando el DOM esté listo) ───────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return; // páginas sin botón (ej: perfil.html) simplemente no lo conectan
    // Pinta el icono correcto según el tema ya aplicado
    pintarIcono(current());
    // Al hacer clic: pasa al siguiente modo y persiste la elección
    btn.addEventListener("click", () => set(siguiente(current()), true));
  });
  // El idioma cambia el texto del tooltip
  window.addEventListener("cdh:langchange", () => pintarIcono(current()));
})();
