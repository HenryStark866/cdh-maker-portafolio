/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — metaverse.js
   Fondo animado "Atómico / Molecular" del sitio (canvas #metaverse).
   Dibuja átomos con electrones en órbita que se mueven, se enlazan entre sí
   cuando están cerca y reaccionan al cursor. Se adapta al tema claro/oscuro
   y respeta la preferencia de "reducir movimiento" del sistema.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-19
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE: módulo autocontenido, sin variables globales
(function () {
  // Canvas de fondo declarado en index.html; si no existe, no hay nada que hacer
  const canvas = document.getElementById("metaverse");
  if (!canvas) return;
  // Contexto 2D con canal alfa (el degradado de fondo lo pinta el propio canvas)
  const ctx = canvas.getContext("2d", { alpha: true });
  // Accesibilidad: si el usuario prefiere menos movimiento, se pinta una imagen estática
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Dimensiones lógicas del canvas (en píxeles CSS)
  let W = 0, H = 0;
  // Densidad de píxeles (máx. 2 para no derrochar GPU en pantallas 3x/4x)
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ── Paletas de color por tema (RGB) ─────────────────────────────────────────
  const THEMES = {
    dark: {
      bg1: [3, 16, 26],               // degradado de fondo: color superior
      bg2: [4, 20, 31],               // degradado de fondo: color inferior
      atomColor: [34, 211, 238],      // núcleos — cian
      electronColor: [94, 234, 212],  // electrones — aqua
      bondColor: [34, 211, 238],      // enlaces entre átomos
      gridColor: [17, 52, 68],        // matriz de puntos del fondo
    },
    light: {
      bg1: [228, 244, 248],
      bg2: [210, 235, 242],
      atomColor: [8, 145, 178],
      electronColor: [13, 148, 136],
      bondColor: [8, 145, 178],
      gridColor: [176, 215, 228],
    },
  };
  // Paleta activa (se actualiza al cambiar de tema)
  let T = THEMES.dark;

  // Sincroniza la paleta con el tema actual del documento (data-theme de <html>)
  function theme() {
    const t = document.documentElement.getAttribute("data-theme") || "dark";
    T = THEMES[t] || THEMES.dark;
  }

  // Número aleatorio uniforme en el rango [a, b)
  const rand = (a, b) => a + Math.random() * (b - a);

  // ─── Átomos ─────────────────────────────────────────────────────────────────
  let atoms = []; // población actual de átomos en pantalla
  // Distancia máxima a la que dos átomos dibujan un "enlace químico" entre sí
  const MAX_BOND_DIST = 160;
  // Versión al cuadrado: permite comparar distancias sin calcular raíces (más rápido)
  const MAX_BOND_DIST_SQ = MAX_BOND_DIST * MAX_BOND_DIST;

  // Crea la población de átomos proporcional al área de la ventana
  function buildAtoms() {
    const area = W * H;
    // 1 átomo por cada ~20 000 px², acotado entre 20 y 65 (rendimiento estable)
    const count = Math.min(Math.max(Math.round(area / 20000), 20), 65);
    atoms = [];
    for (let i = 0; i < count; i++) {
      // Cada átomo lleva de 1 a 3 electrones en órbita
      const numElectrons = Math.floor(rand(1, 4));
      const electrons = [];
      for (let j = 0; j < numElectrons; j++) {
        electrons.push({
          angle: rand(0, Math.PI * 2),  // posición angular inicial en la órbita
          // Velocidad angular; el signo aleatorio da sentido horario o antihorario
          speed: rand(0.02, 0.05) * (Math.random() > 0.5 ? 1 : -1),
          radius: rand(12, 22),          // radio de la órbita en píxeles
        });
      }
      atoms.push({
        x: rand(0, W),            // posición inicial aleatoria
        y: rand(0, H),
        vx: rand(-0.15, 0.15),    // velocidad inicial (deriva lenta)
        vy: rand(-0.15, 0.15),
        r: rand(3, 6),            // radio del núcleo
        electrons: electrons,     // sus electrones orbitando
        pulse: rand(0, Math.PI * 2), // desfase del pulso de brillo (que no laten a la vez)
      });
    }
  }

  // ─── Grid de fondo (matriz de puntos) ───────────────────────────────────────
  // Pinta una retícula de puntos tenues cada 30 px (estética de laboratorio)
  function drawGrid() {
    const [r, g, b] = T.gridColor;
    ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
    for (let y = 0; y < H; y += 30) {
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2); // punto de 1 px de radio
        ctx.fill();
      }
    }
  }

  // ─── Fondo degradado ────────────────────────────────────────────────────────
  // Degradado vertical entre los dos colores de fondo del tema activo
  function drawBackground() {
    const [r1, g1, b1] = T.bg1;
    const [r2, g2, b2] = T.bg2;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H); // cubre todo el lienzo (borra el frame anterior)
  }

  // ─── Enlaces químicos (bonds) ───────────────────────────────────────────────
  // Une con una línea cada par de átomos que estén a menos de MAX_BOND_DIST;
  // cuanto más cerca, más opaca y gruesa la línea (como un enlace que se forma)
  function drawBonds() {
    const [r, g, b] = T.bondColor;
    // Doble bucle triangular: cada par (i, j) se evalúa una sola vez
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = atoms[j].x - atoms[i].x;
        const dy = atoms[j].y - atoms[i].y;
        const distSq = dx * dx + dy * dy;
        if (distSq > MAX_BOND_DIST_SQ) continue; // demasiado lejos: sin enlace
        // ratio: 1 cuando se tocan → 0 en la distancia máxima
        const ratio = 1 - Math.sqrt(distSq) / MAX_BOND_DIST;

        ctx.beginPath();
        ctx.moveTo(atoms[i].x, atoms[i].y);
        ctx.lineTo(atoms[j].x, atoms[j].y);
        ctx.strokeStyle = `rgba(${r},${g},${b},${ratio * 0.5})`; // opacidad ∝ cercanía
        ctx.lineWidth = ratio * 2.5;                              // grosor ∝ cercanía
        ctx.stroke();
      }
    }
  }

  // ─── Átomos y electrones ────────────────────────────────────────────────────
  function drawAtoms(time) {
    for (const a of atoms) {
      // Pulso de brillo senoidal (0…1) desfasado por átomo
      const pulse = 0.5 + 0.5 * Math.sin(a.pulse + time * 0.002);
      const [r, g, b] = T.atomColor;

      // 1. Halo del núcleo: degradado radial que "respira" con el pulso
      const haloR = a.r * (2 + pulse * 0.5);
      const haloG = ctx.createRadialGradient(a.x, a.y, a.r * 0.5, a.x, a.y, haloR);
      haloG.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
      haloG.addColorStop(1, `rgba(${r},${g},${b},0)`); // se desvanece hacia afuera
      ctx.beginPath();
      ctx.arc(a.x, a.y, haloR, 0, Math.PI * 2);
      ctx.fillStyle = haloG;
      ctx.fill();

      // 2. Núcleo sólido blanco en el centro
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // 3. Órbitas y electrones
      const [er, eg, eb] = T.electronColor;
      for (const e of a.electrons) {
        // Trazo muy sutil de la órbita circular
        ctx.beginPath();
        ctx.arc(a.x, a.y, e.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${er},${eg},${eb},0.15)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Posición del electrón sobre su órbita (coordenadas polares → cartesianas)
        const ex = a.x + Math.cos(e.angle) * e.radius;
        const ey = a.y + Math.sin(e.angle) * e.radius;

        // Punto brillante del electrón
        ctx.beginPath();
        ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${er},${eg},${eb},0.95)`;
        ctx.fill();

        // Estela suave alrededor del electrón (sensación de movimiento)
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${er},${eg},${eb},0.4)`;
        ctx.fill();

        // Avanza el ángulo orbital (solo si las animaciones están permitidas)
        if (!reduced) {
          e.angle += e.speed;
        }
      }
    }
  }

  // ─── Interacción con mouse / touch ──────────────────────────────────────────
  // Posición del puntero; (−999, −999) significa "fuera de pantalla"
  const mouse = { x: -999, y: -999 };
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
  }, { passive: true }); // passive: no bloquea el scroll táctil

  // ─── Repulsión de átomos alrededor del cursor ───────────────────────────────
  // Los átomos a menos de 150 px del cursor reciben un empuje que los aleja
  function applyMouseForce() {
    const MX = mouse.x, MY = mouse.y;
    if (MX < 0) return; // cursor fuera de pantalla: sin fuerza
    const FORCE_R = 150, FORCE_R_SQ = FORCE_R * FORCE_R; // radio de influencia
    for (const a of atoms) {
      const dx = a.x - MX, dy = a.y - MY;
      const dSq = dx * dx + dy * dy;
      if (dSq < FORCE_R_SQ && dSq > 0) {
        const d = Math.sqrt(dSq);
        // La fuerza decrece linealmente con la distancia (suave repulsión)
        const strength = (1 - d / FORCE_R) * 0.025;
        a.vx += (dx / d) * strength; // empuje en la dirección opuesta al cursor
        a.vy += (dy / d) * strength;
      }
    }
  }

  // ─── Física de los átomos ───────────────────────────────────────────────────
  const FRICTION = 0.98;  // fricción por frame (frena gradualmente)
  const MAX_SPEED = 0.8;  // velocidad máxima permitida (px/frame)
  function updateAtoms() {
    applyMouseForce(); // primero, la influencia del cursor
    for (const a of atoms) {
      // Integración de la posición según la velocidad
      a.x += a.vx;
      a.y += a.vy;
      // Fricción: reduce la velocidad un 2% por frame
      a.vx *= FRICTION;
      a.vy *= FRICTION;

      // Limitar la velocidad máxima (evita átomos "disparados" por el cursor)
      const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (spd > MAX_SPEED) { a.vx = (a.vx / spd) * MAX_SPEED; a.vy = (a.vy / spd) * MAX_SPEED; }

      // Rebote elástico en los bordes de la ventana
      if (a.x < 0) { a.x = 0; a.vx *= -1; }
      if (a.x > W) { a.x = W; a.vx *= -1; }
      if (a.y < 0) { a.y = 0; a.vy *= -1; }
      if (a.y > H) { a.y = H; a.vy *= -1; }

      // Ruido browniano: pequeños empujones aleatorios (movimiento "vivo")
      a.vx += rand(-0.01, 0.01);
      a.vy += rand(-0.01, 0.01);
    }
  }

  // ─── Bucle de animación (un frame por refresco de pantalla) ────────────────
  function frame(time) {
    drawBackground(); // 1. fondo degradado (borra el frame anterior)
    drawGrid();       // 2. retícula de puntos
    updateAtoms();    // 3. física: mover átomos

    ctx.globalCompositeOperation = "source-over"; // modo de dibujo normal
    drawBonds();      // 4. enlaces entre átomos cercanos
    drawAtoms(time);  // 5. núcleos, halos y electrones

    if (running) requestAnimationFrame(frame); // agenda el siguiente frame
  }

  // Ajusta el tamaño real del canvas al de la ventana (con soporte de DPR)
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;      // tamaño CSS
    canvas.width = W * DPR; canvas.height = H * DPR;      // tamaño físico (nítido en retina)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);               // escala el sistema de coordenadas
    buildAtoms(); // repoblar con densidad acorde al nuevo tamaño
  }

  // ── Gestión de ciclo de vida ────────────────────────────────────────────────
  let running = true;
  // Pausar la animación cuando la pestaña no está visible (ahorra batería/CPU)
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame); // reanudar al volver
  });
  // Al cambiar el tema: recargar la paleta y regenerar los átomos
  window.addEventListener("cdh:themechange", () => { theme(); buildAtoms(); });
  // Redimensionado con "debounce" de 180 ms (evita reconstruir en cada píxel)
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

  // ── Arranque ────────────────────────────────────────────────────────────────
  theme();  // cargar paleta según el tema actual
  resize(); // dimensionar el canvas y crear los átomos

  if (reduced) {
    // Accesibilidad: usuario prefiere menos movimiento → un solo frame estático
    running = false;
    drawBackground();
    drawGrid();
    drawBonds();
    drawAtoms(0);
  } else {
    // Modo normal: iniciar el bucle de animación
    requestAnimationFrame(frame);
  }
})();
