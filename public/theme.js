// CDH Maker — Tema claro/oscuro
(function () {
  const KEY = "cdh-theme";
  const root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function current() {
    return root.getAttribute("data-theme") || "dark";
  }

  const ICONS = {
    // Al estar en oscuro se muestra el sol (para pasar a claro) y viceversa
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  };

  function set(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = theme === "light" ? ICONS.moon : ICONS.sun;
    window.dispatchEvent(new CustomEvent("cdh:themechange", { detail: { theme } }));
  }

  // Aplicar tema inicial cuanto antes (evita parpadeo)
  let urlTheme = null;
  try {
    const p = new URLSearchParams(location.search).get("theme");
    if (p === "light" || p === "dark") urlTheme = p;
  } catch (e) {}
  const initial = urlTheme || saved() || (systemPrefersLight() ? "light" : "dark");
  set(initial, !!urlTheme);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.innerHTML = current() === "light" ? ICONS.moon : ICONS.sun;
    btn.addEventListener("click", () => set(current() === "light" ? "dark" : "light", true));
  });
})();
