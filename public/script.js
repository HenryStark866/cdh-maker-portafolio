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

// Texto rotativo del hero (efecto máquina de escribir)
const typedEl = document.getElementById("typed");
if (typedEl && !reducedMotion) {
  const WORDS = [
    "Ingeniería",
    "Fabricación digital",
    "Desarrollo de software",
    "Electrónica e IoT",
    "Inteligencia Artificial",
    "Cultura maker",
  ];
  let wi = 0, ci = 0, deleting = false;
  (function type() {
    const word = WORDS[wi];
    typedEl.textContent = word.slice(0, ci);
    if (!deleting) {
      if (ci++ < word.length) return setTimeout(type, 65);
      deleting = true;
      return setTimeout(type, 1600);
    }
    if (ci-- > 0) return setTimeout(type, 30);
    deleting = false;
    wi = (wi + 1) % WORDS.length;
    setTimeout(type, 350);
  })();
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
