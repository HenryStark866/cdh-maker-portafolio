// CDH Maker — interacciones del sitio
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Año dinámico en el footer
document.getElementById("year").textContent = new Date().getFullYear();

// Menú móvil
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => navLinks.classList.remove("open"))
);

// Animación de aparición al hacer scroll
const revealTargets = document.querySelectorAll(".card, .step, .project, .why-item, .about > div, .contact");
revealTargets.forEach((el) => el.classList.add("reveal"));
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealTargets.forEach((el) => observer.observe(el));

// Texto rotativo del hero (efecto máquina de escribir), multi-idioma
const typedEl = document.getElementById("typed");
if (typedEl && !reducedMotion) {
  const DEFAULT_WORDS = [
    "Ingeniería", "Fabricación digital", "Desarrollo de software",
    "Electrónica e IoT", "Inteligencia Artificial", "Cultura maker",
  ];
  let wi = 0, ci = 0, deleting = false, pending = null;
  const words = () => (window.CDH_TYPED && window.CDH_TYPED.length ? window.CDH_TYPED : DEFAULT_WORDS);
  function type() {
    const list = words();
    if (wi >= list.length) wi = 0;
    const word = list[wi];
    typedEl.textContent = word.slice(0, ci);
    if (!deleting) {
      if (ci++ < word.length) return (pending = setTimeout(type, 65));
      deleting = true;
      return (pending = setTimeout(type, 1600));
    }
    if (ci-- > 0) return (pending = setTimeout(type, 30));
    deleting = false;
    wi = (wi + 1) % list.length;
    pending = setTimeout(type, 350);
  }
  // Al cambiar idioma, reiniciar limpiamente la palabra actual
  window.addEventListener("cdh:langchange", () => {
    clearTimeout(pending);
    ci = 0; deleting = false; wi = 0;
    type();
  });
  type();
}

// Contadores animados de estadísticas
const counters = document.querySelectorAll(".count");
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    counterObs.unobserve(entry.target);
    const el = entry.target;
    const target = +el.dataset.count;
    if (reducedMotion) { el.textContent = target; return; }
    const dur = 1400, t0 = performance.now();
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}, { threshold: 0.6 });
counters.forEach((el) => counterObs.observe(el));

// Barra de progreso de scroll + botón "volver arriba" + enlace activo del nav
const progress = document.getElementById("scroll-progress");
const toTop = document.getElementById("to-top");
const sections = [...document.querySelectorAll("section[id]")];
const navAnchors = [...document.querySelectorAll(".nav-links a[href^='#']")];

function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  toTop.classList.toggle("show", scrollY > 600);

  let current = "";
  for (const s of sections) {
    if (scrollY >= s.offsetTop - 120) current = s.id;
  }
  navAnchors.forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + current)
  );
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

// ===== Terminal animada (sin código real: demostración genérica) =====
const codeSim = document.querySelector("#codeSim code");
if (codeSim) {
  const SCRIPT = [
    ['tk-kw', '$ cdh crear proyecto\n'],
    ['tk-ok', '✓ análisis  ✓ diseño  ✓ plan\n\n'],
    ['tk-kw', 'def '], ['tk-fn', 'construir'], [null, '(idea):\n'],
    [null, '    plan = '], ['tk-fn', 'diseñar'], [null, '(idea)\n'],
    ['tk-kw', '    while '], [null, 'not perfecto(plan):\n'],
    [null, '        '], ['tk-fn', 'iterar'], [null, '(plan)\n'],
    ['tk-kw', '    return '], ['tk-str', '"producto ✓"'], [null, '\n\n'],
    ['tk-kw', '$ deploy '], [null, '--nube\n'],
    ['tk-ok', '✓ en línea — cliente feliz\n'],
  ];
  let si = 0, sci = 0, spanEl = null;
  function typeCode() {
    if (si >= SCRIPT.length) {
      setTimeout(() => { codeSim.innerHTML = ""; si = 0; sci = 0; spanEl = null; typeCode(); }, 4200);
      return;
    }
    const [cls, text] = SCRIPT[si];
    if (!spanEl) {
      spanEl = document.createElement("span");
      if (cls) spanEl.className = cls;
      codeSim.appendChild(spanEl);
    }
    spanEl.textContent = text.slice(0, ++sci);
    if (sci >= text.length) { si++; sci = 0; spanEl = null; }
    setTimeout(typeCode, reducedMotion ? 0 : 26);
  }
  if (reducedMotion) {
    SCRIPT.forEach(([cls, text]) => {
      const s = document.createElement("span");
      if (cls) s.className = cls;
      s.textContent = text;
      codeSim.appendChild(s);
    });
  } else {
    const codeObs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { codeObs.disconnect(); typeCode(); }
    }, { threshold: 0.3 });
    codeObs.observe(codeSim.parentElement);
  }
}

// ===== FAQ: solo un panel abierto a la vez =====
const faqItems = [...document.querySelectorAll(".faq-item")];
faqItems.forEach((d) =>
  d.addEventListener("toggle", () => {
    if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
  })
);

// ===== Tilt 3D sutil en tarjetas (solo dispositivos con mouse) =====
const canHover = window.matchMedia("(hover: hover)").matches;
if (canHover && !reducedMotion) {
  document.querySelectorAll(".card, .project:not(.project-featured), .why-item").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateY(${px * 6}deg) rotateX(${py * -6}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// ===== Resplandor del cursor (luz submarina) =====
const glow = document.getElementById("cursor-glow");
if (glow && canHover && !reducedMotion) {
  let gx = 0, gy = 0, tx = 0, ty = 0, glowOn = false;
  addEventListener("mousemove", (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!glowOn) { glow.style.opacity = "1"; glowOn = true; }
  });
  document.addEventListener("mouseleave", () => { glow.style.opacity = "0"; glowOn = false; });
  (function moveGlow() {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = `translate(${gx}px, ${gy}px)`;
    requestAnimationFrame(moveGlow);
  })();
}

// ===== HUD de profundidad (metros de inmersión) =====
const depthHud = document.getElementById("depth-hud");
const depthVal = document.getElementById("depth-val");
if (depthHud && depthVal) {
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const m = max > 0 ? Math.round((scrollY / max) * 120) : 0;
    depthVal.textContent = "−" + m + " m";
    depthHud.classList.toggle("show", scrollY > 300);
  }, { passive: true });
}
