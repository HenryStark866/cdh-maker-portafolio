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

  function set(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) {} }
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "🌙" : "☀️";
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
    btn.textContent = current() === "light" ? "🌙" : "☀️";
    btn.addEventListener("click", () => set(current() === "light" ? "dark" : "light", true));
  });
})();
