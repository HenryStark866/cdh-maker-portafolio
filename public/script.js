/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — script.js
   Interacciones generales de la página principal (index.html):
   menú, scroll, animaciones de aparición, contadores, texto rotativo,
   terminal simulada, FAQ, efectos de cursor y HUD de profundidad.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-19
   ═══════════════════════════════════════════════════════════════════════════ */

// Respeta la preferencia de accesibilidad "reducir movimiento" del sistema:
// cuando es true, las animaciones se omiten o se muestran en su estado final
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Año dinámico en el footer ─────────────────────────────────────────────────
// Evita tener que actualizar el año del copyright manualmente cada enero
document.getElementById("year").textContent = new Date().getFullYear();

// ── Menú móvil ────────────────────────────────────────────────────────────────
// En desktop el nav es un sidebar colapsado; en móvil se abre con hamburguesa
const navToggle = document.getElementById("navToggle"); // botón hamburguesa
const navLinks = document.getElementById("navLinks");   // contenedor de enlaces
const navBottom = document.querySelector(".nav-bottom"); // zona idioma/tema/cuenta

// Abrir/cerrar el menú móvil al pulsar la hamburguesa
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");             // alterna visibilidad
  if (navBottom) navBottom.classList.toggle("open", open);    // sincroniza la zona inferior
  navToggle.setAttribute("aria-expanded", open ? "true" : "false"); // accesibilidad
});

// Cerrar el menú móvil automáticamente al elegir un enlace (mejor UX táctil)
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    if (navBottom) navBottom.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

// ── Resaltar sección activa en el sidebar según el scroll ─────────────────────
const navSections = ["servicios", "proceso", "proyectos", "sobre", "contacto"];
const navItems = navLinks.querySelectorAll("a.nav-item");
// IntersectionObserver: notifica cuándo cada sección entra en pantalla
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id; // id de la sección visible
        // Marca como "active" el enlace del nav cuyo href apunte a esa sección
        navItems.forEach((item) => {
          const href = item.getAttribute("href");
          item.classList.toggle("active", href === `#${id}`);
        });
      }
    });
  },
  { threshold: 0.35 } // la sección cuenta como visible con el 35% en pantalla
);
// Observa cada sección declarada arriba (si existe en el DOM)
navSections.forEach((id) => {
  const el = document.getElementById(id);
  if (el) sectionObserver.observe(el);
});

// ── Animación de aparición al hacer scroll (reveal) ───────────────────────────
// A cada tarjeta/bloque se le añade la clase .reveal (estado oculto) y al
// entrar en pantalla se le suma .visible (transición definida en styles.css)
const revealTargets = document.querySelectorAll(".card, .step, .project, .why-item, .about > div, .contact");
revealTargets.forEach((el) => el.classList.add("reveal"));
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target); // anima una sola vez por elemento
      }
    });
  },
  { threshold: 0.12 } // dispara con el 12% del elemento visible
);
revealTargets.forEach((el) => observer.observe(el));

// ── Texto rotativo del hero (efecto máquina de escribir) ──────────────────────
// Escribe y borra palabras en bucle. Multi-idioma: i18n.js publica la lista
// traducida en window.CDH_TYPED cuando el usuario cambia de idioma
const typedEl = document.getElementById("typed");
if (typedEl && !reducedMotion) {
  // Palabras por defecto (español) si i18n aún no cargó
  const DEFAULT_WORDS = [
    "Ingeniería", "Fabricación digital", "Desarrollo de software",
    "Electrónica e IoT", "Inteligencia Artificial", "Cultura maker",
  ];
  // wi: índice de palabra · ci: índice de carácter · deleting: fase de borrado
  let wi = 0, ci = 0, deleting = false, pending = null;
  // Devuelve la lista vigente (traducida si existe, por defecto si no)
  const words = () => (window.CDH_TYPED && window.CDH_TYPED.length ? window.CDH_TYPED : DEFAULT_WORDS);
  // Bucle de tipeo: escribe carácter a carácter, pausa, borra y pasa a la siguiente
  function type() {
    const list = words();
    if (wi >= list.length) wi = 0;      // por si la lista cambió de tamaño al traducir
    const word = list[wi];
    typedEl.textContent = word.slice(0, ci); // pinta los primeros `ci` caracteres
    if (!deleting) {
      // Fase de escritura: 65 ms por carácter
      if (ci++ < word.length) return (pending = setTimeout(type, 65));
      deleting = true;
      // Palabra completa: pausa de lectura de 1.6 s antes de borrar
      return (pending = setTimeout(type, 1600));
    }
    // Fase de borrado: 30 ms por carácter (más rápido que escribir)
    if (ci-- > 0) return (pending = setTimeout(type, 30));
    deleting = false;
    wi = (wi + 1) % list.length; // siguiente palabra (circular)
    pending = setTimeout(type, 350); // pequeña pausa antes de empezar a escribir
  }
  // Al cambiar idioma: cancelar el timer y reiniciar limpiamente desde cero
  window.addEventListener("cdh:langchange", () => {
    clearTimeout(pending);
    ci = 0; deleting = false; wi = 0;
    type();
  });
  type(); // arranque inicial
}

// ── Contadores animados de estadísticas ───────────────────────────────────────
// Los números del hero suben de 0 a su valor (data-count) al entrar en pantalla
const counters = document.querySelectorAll(".count");
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    counterObs.unobserve(entry.target); // cada contador anima una sola vez
    const el = entry.target;
    const target = +el.dataset.count; // valor final (el + convierte a número)
    if (reducedMotion) { el.textContent = target; return; } // accesibilidad: sin animación
    const dur = 1400, t0 = performance.now(); // duración total 1.4 s
    (function tick(t) {
      const p = Math.min((t - t0) / dur, 1);              // progreso 0→1
      // Easing cúbico "ease-out": rápido al inicio, suave al final
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);             // siguiente frame
    })(t0);
  });
}, { threshold: 0.6 }); // requiere 60% visible para empezar a contar
counters.forEach((el) => counterObs.observe(el));

// ── Barra de progreso + botón "volver arriba" + enlace activo ─────────────────
const progress = document.getElementById("scroll-progress"); // barra superior
const toTop = document.getElementById("to-top");             // botón flotante ↑
const sections = [...document.querySelectorAll("section[id]")];
const navAnchors = [...document.querySelectorAll(".nav-links a[href^='#']")];

// Se ejecuta en cada evento de scroll (pasivo: no bloquea el desplazamiento)
function onScroll() {
  // Ancho de la barra = porcentaje de página recorrido
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  // El botón ↑ aparece tras bajar 600 px
  toTop.classList.toggle("show", scrollY > 600);

  // Determina la última sección cuyo inicio ya pasó (con margen de 120 px)
  let current = "";
  for (const s of sections) {
    if (scrollY >= s.offsetTop - 120) current = s.id;
  }
  // Resalta el enlace del nav correspondiente a la sección actual
  navAnchors.forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + current)
  );
}
addEventListener("scroll", onScroll, { passive: true });
onScroll(); // estado inicial correcto al cargar la página

// Botón "volver arriba": scroll suave (o instantáneo si el usuario lo prefiere)
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

// ── Terminal animada (sección "Desarrollo a la medida") ───────────────────────
// Simula una sesión de terminal escribiéndose sola. El guion es genérico a
// propósito: demuestra el efecto sin exponer código real de proyectos
const codeSim = document.querySelector("#codeSim code");
if (codeSim) {
  // Guion de la animación: pares [claseCSS, texto]. La clase da color al token
  // (tk-kw: palabra clave · tk-fn: función · tk-str: string · tk-ok: éxito)
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
  // si: índice del segmento · sci: índice de carácter · spanEl: <span> en curso
  let si = 0, sci = 0, spanEl = null;
  // Escribe el guion carácter a carácter; al terminar, espera 4.2 s y reinicia
  function typeCode() {
    if (si >= SCRIPT.length) {
      // Fin del guion → limpiar y volver a empezar (bucle infinito)
      setTimeout(() => { codeSim.innerHTML = ""; si = 0; sci = 0; spanEl = null; typeCode(); }, 4200);
      return;
    }
    const [cls, text] = SCRIPT[si];
    if (!spanEl) {
      // Nuevo segmento: crear su <span> con la clase de color correspondiente
      spanEl = document.createElement("span");
      if (cls) spanEl.className = cls;
      codeSim.appendChild(spanEl);
    }
    spanEl.textContent = text.slice(0, ++sci); // añade un carácter más
    if (sci >= text.length) { si++; sci = 0; spanEl = null; } // segmento completo
    setTimeout(typeCode, reducedMotion ? 0 : 26); // velocidad de tipeo: 26 ms
  }
  if (reducedMotion) {
    // Accesibilidad: sin animación, se pinta el guion completo de una vez
    SCRIPT.forEach(([cls, text]) => {
      const s = document.createElement("span");
      if (cls) s.className = cls;
      s.textContent = text;
      codeSim.appendChild(s);
    });
  } else {
    // La animación solo arranca cuando la terminal entra en pantalla
    const codeObs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { codeObs.disconnect(); typeCode(); }
    }, { threshold: 0.3 });
    codeObs.observe(codeSim.parentElement);
  }
}

// ── FAQ: comportamiento acordeón (solo un panel abierto a la vez) ─────────────
const faqItems = [...document.querySelectorAll(".faq-item")];
faqItems.forEach((d) =>
  d.addEventListener("toggle", () => {
    // Al abrir un <details>, cierra todos los demás
    if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; });
  })
);

// ── Tilt 3D sutil en tarjetas (solo dispositivos con mouse) ───────────────────
// Inclina levemente la tarjeta siguiendo el cursor (efecto de profundidad)
const canHover = window.matchMedia("(hover: hover)").matches; // excluye táctiles
if (canHover && !reducedMotion) {
  document.querySelectorAll(".card, .project:not(.project-featured), .why-item").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      // Posición del cursor relativa al centro de la tarjeta: rango −0.5 … +0.5
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      // Máximo ±6° de inclinación + elevación de 4 px
      el.style.transform = `rotateY(${px * 6}deg) rotateX(${py * -6}deg) translateY(-4px)`;
    });
    // Al salir el cursor: vuelve a su posición natural
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// ── Resplandor del cursor (efecto "luz submarina") ────────────────────────────
// Un halo de luz sigue al cursor con retardo suave (interpolación)
const glow = document.getElementById("cursor-glow");
if (glow && canHover && !reducedMotion) {
  // gx/gy: posición actual del halo · tx/ty: posición objetivo (el cursor)
  let gx = 0, gy = 0, tx = 0, ty = 0, glowOn = false;
  addEventListener("mousemove", (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!glowOn) { glow.style.opacity = "1"; glowOn = true; } // aparece al primer movimiento
  });
  // El halo se oculta cuando el cursor sale de la ventana
  document.addEventListener("mouseleave", () => { glow.style.opacity = "0"; glowOn = false; });
  // Bucle de interpolación: el halo persigue al cursor al 12% de la distancia por frame
  (function moveGlow() {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = `translate(${gx}px, ${gy}px)`;
    requestAnimationFrame(moveGlow);
  })();
}

// ── HUD de profundidad (metros de inmersión oceánica) ─────────────────────────
// Indicador temático: muestra "−N m" según cuánto haya bajado el visitante
const depthHud = document.getElementById("depth-hud");
const depthVal = document.getElementById("depth-val");
if (depthHud && depthVal) {
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    // Escala el scroll total a un rango de 0–120 "metros"
    const m = max > 0 ? Math.round((scrollY / max) * 120) : 0;
    depthVal.textContent = "−" + m + " m";
    // El HUD solo aparece tras bajar 300 px (no estorba en el hero)
    depthHud.classList.toggle("show", scrollY > 300);
  }, { passive: true });
}

// ── Logo del footer: se arma pieza a pieza en cada visita ─────────────────────
// Al entrar el logo en pantalla se añade .play (las piezas llegan escalonadas,
// transición definida en styles.css); al salir se retira, de modo que el
// armado se repite cada vez que el visitante vuelve al footer.
const footerLogo = document.getElementById("footerLogo");
if (footerLogo) {
  const logoObs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      footerLogo.classList.toggle("play", entry.isIntersecting);
    });
  }, { threshold: 0.35 }); // exige un 35% del logo visible para arrancar
  logoObs.observe(footerLogo);
}
