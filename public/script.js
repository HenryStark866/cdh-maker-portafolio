/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — script.js
   Interacciones discretas del sitio público (portada, servicios, catálogo):
   menú móvil, borde del encabezado al hacer scroll, enlace activo,
   apariciones suaves, contadores, botón "volver arriba" y FAQ en acordeón.

   Todo respeta "reducir movimiento" del sistema. El fondo animado, el HUD de
   profundidad, el resplandor del cursor, el texto rotativo y el tilt 3D se
   retiraron en el rediseño de 2026-10 (ver docs/MARCA.md: "plano técnico,
   no ciencia ficción").
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Última actualización: 2026-10-29
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Año del footer ──────────────────────────────────────────────────────
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ── Menú móvil: abre/cierra el panel del encabezado ─────────────────────
  const nav = document.querySelector(".nav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (navToggle) navToggle.addEventListener("click", () => setMenu(!nav.classList.contains("nav-open")));
  if (navLinks) navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // ── Apariciones suaves al entrar en pantalla (una sola vez) ─────────────
  const revealTargets = document.querySelectorAll(
    ".section-head, .svc-row, .project, .need-item, .step, .founder, .why-item, .tool-card, .about > *, .faq-list, .contact, .card:not(.svc-row):not(.tool-card)"
  );
  if (!reducedMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    revealTargets.forEach((el) => {
      // Lo que ya está en pantalla al cargar no se oculta (evita parpadeo)
      if (el.getBoundingClientRect().top < innerHeight * 0.9) return;
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  // ── Contadores del hero (suben una vez al verse) ────────────────────────
  const counters = document.querySelectorAll(".count");
  if (!reducedMotion && "IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        co.unobserve(entry.target);
        const el = entry.target;
        const target = +el.dataset.count;
        const dur = 1100, t0 = performance.now();
        (function tick(t) {
          const p = Math.min((t - t0) / dur, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  // ── Scroll: borde del encabezado, botón ↑ y enlace activo ───────────────
  const toTop = document.getElementById("to-top");
  const sections = [...document.querySelectorAll("main section[id]")];
  const navAnchors = navLinks ? [...navLinks.querySelectorAll("a[href^='#']")] : [];
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 8);
    if (toTop) toTop.classList.toggle("show", y > 700);
    let current = "";
    const offset = 160;
    for (const s of sections) if (y >= s.offsetTop - offset) current = s.id;
    navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

  // ── FAQ: un solo panel abierto a la vez ─────────────────────────────────
  const faqItems = [...document.querySelectorAll(".faq-item")];
  faqItems.forEach((d) =>
    d.addEventListener("toggle", () => {
      if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
    })
  );
})();
