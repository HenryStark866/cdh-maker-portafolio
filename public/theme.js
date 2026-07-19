/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — theme.js
   Gestor del tema visual claro/oscuro de todo el sitio.
   Aplica el tema lo antes posible (antes de pintar) para evitar "parpadeo",
   lo persiste en localStorage y expone un botón de alternancia (#themeToggle).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-19
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE (función autoejecutable): aísla las variables para no contaminar el scope global
(function () {
  // Clave usada en localStorage para recordar el tema elegido por el usuario
  const KEY = "cdh-theme";
  // Referencia al elemento <html>; el tema se aplica como atributo data-theme
  const root = document.documentElement;

  // Lee el tema guardado en localStorage ("light" | "dark" | null si nunca eligió)
  // El try/catch protege contra navegadores con localStorage bloqueado (modo privado)
  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  // Consulta al sistema operativo si el usuario prefiere tema claro
  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  // Devuelve el tema actualmente aplicado en <html data-theme="...">
  function current() {
    return root.getAttribute("data-theme") || "dark";
  }

  // Iconos SVG inline del botón de alternancia.
  // Regla de UX: estando en oscuro se muestra el SOL (invita a pasar a claro) y viceversa
  const ICONS = {
    // Icono de sol (se muestra cuando el tema activo es oscuro)
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    // Icono de luna (se muestra cuando el tema activo es claro)
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  };

  // Aplica un tema al documento.
  //   theme:   "light" | "dark"
  //   persist: true → además lo guarda en localStorage para futuras visitas
  function set(theme, persist) {
    // 1. Estampa el atributo que activa las variables CSS del tema (ver styles.css)
    root.setAttribute("data-theme", theme);
    // 2. Persiste la elección si corresponde (try/catch por localStorage bloqueado)
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
    // 3. Actualiza el icono del botón de alternancia si ya existe en el DOM
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = theme === "light" ? ICONS.moon : ICONS.sun;
    // 4. Notifica al resto de scripts (ej: metaverse.js re-colorea el fondo animado)
    window.dispatchEvent(new CustomEvent("cdh:themechange", { detail: { theme } }));
  }

  // ── Arranque inmediato: decidir el tema inicial ─────────────────────────────
  // Prioridad: 1) parámetro de URL ?theme=  2) elección guardada  3) preferencia del SO
  let urlTheme = null;
  try {
    // Permite forzar el tema por URL (útil para demos y capturas): ?theme=light
    const p = new URLSearchParams(location.search).get("theme");
    if (p === "light" || p === "dark") urlTheme = p;
  } catch (e) {}
  // Resuelve el tema con la cadena de prioridades y lo aplica ya mismo (evita flash)
  const initial = urlTheme || saved() || (systemPrefersLight() ? "light" : "dark");
  // Solo se persiste si vino explícito por URL (una visita normal no debe sobreescribir)
  set(initial, !!urlTheme);

  // ── Conexión del botón de alternancia (cuando el DOM esté listo) ────────────
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return; // páginas sin botón (ej: perfil.html) simplemente no lo conectan
    // Pinta el icono correcto según el tema ya aplicado
    btn.innerHTML = current() === "light" ? ICONS.moon : ICONS.sun;
    // Al hacer clic: alterna claro ↔ oscuro y persiste la elección
    btn.addEventListener("click", () => set(current() === "light" ? "dark" : "light", true));
  });
})();
