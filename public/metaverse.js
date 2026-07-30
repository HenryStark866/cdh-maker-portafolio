/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — metaverse.js
   Fondo animado "Núcleo tecnológico" del sitio (canvas #metaverse).

   Seis capas que se componen en un solo lienzo 2D, sin librerías externas:
     1. Atmósfera   → degradado profundo con halo del acento y viñeta
     2. Rejilla     → malla en perspectiva que fluye hacia el horizonte
     3. Partículas  → campo de puntos 3D con proyección y paralaje
     4. Red neuronal→ nodos que respiran, unidos por aristas dinámicas
     5. Pulsos      → paquetes de datos que viajan por las aristas
     6. HUD         → anillos holográficos, retícula y barrido de escaneo

   Adapta la paleta al tema claro / oscuro, respeta "reducir movimiento",
   escala la densidad según el área de pantalla y se pausa cuando la pestaña
   deja de estar visible.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-30
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE: módulo autocontenido, sin variables globales
(function () {
  // Canvas de fondo declarado en index.html; si no existe, no hay nada que hacer
  const canvas = document.getElementById("metaverse");
  if (!canvas) return;
  // Contexto 2D con canal alfa (el degradado de fondo lo pinta el propio canvas)
  const ctx = canvas.getContext("2d", { alpha: true });
  // Accesibilidad: si el usuario prefiere menos movimiento, se pinta un frame quieto
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Dimensiones lógicas del canvas (en píxeles CSS)
  let W = 0, H = 0;
  // Densidad de píxeles (máx. 2 para no derrochar GPU en pantallas 3x/4x)
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  // Equipos modestos: menos densidad de partículas y aristas
  const LOW_POWER =
    (navigator.hardwareConcurrency || 4) <= 4 ||
    window.matchMedia("(max-width: 720px)").matches;

  // ── Paletas por tema (RGB) ──────────────────────────────────────────────────
  // accent  → cian de marca, protagonista de la red
  // accent2 → aqua/violeta secundario, da profundidad cromática
  // data    → color de los paquetes que viajan por las aristas
  const THEMES = {
    dark: {
      bg1: [3, 14, 24],        // atmósfera: arriba
      bg2: [2, 9, 17],         // atmósfera: abajo
      glow: [8, 47, 73],       // halo central
      grid: [22, 78, 99],      // malla en perspectiva
      accent: [34, 211, 238],
      accent2: [94, 234, 212],
      data: [186, 250, 255],
      hud: [45, 130, 160],
      dim: 1,                  // intensidad global de la escena
    },
    light: {
      bg1: [232, 246, 250],
      bg2: [205, 232, 241],
      glow: [176, 222, 236],
      grid: [140, 195, 214],
      accent: [14, 116, 144],   // alineado con --accent del tema claro
      accent2: [15, 118, 110],  // alineado con --accent-2 del tema claro
      data: [4, 82, 104],
      hud: [90, 160, 184],
      dim: 0.72,               // en claro se baja para no competir con el texto
    },
  };
  // Paleta activa (se actualiza al cambiar de tema)
  let T = THEMES.dark;

  // Sincroniza la paleta con el tema actual del documento (data-theme de <html>)
  function theme() {
    const t = document.documentElement.getAttribute("data-theme") || "dark";
    T = THEMES[t] || THEMES.dark;
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  // "rgba(...)" a partir de un color de la paleta y una opacidad
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ── Interacción: paralaje suave hacia el cursor ─────────────────────────────
  const mouse = { x: -1, y: -1 };
  const par = { x: 0, y: 0 };   // desplazamiento suavizado que usan las capas
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener(
    "touchmove",
    (e) => { if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } },
    { passive: true } // no bloquea el scroll táctil
  );

  function updateParallax() {
    if (mouse.x < 0) return; // aún no se ha movido el cursor
    const tx = ((mouse.x - W / 2) / W) * -26;
    const ty = ((mouse.y - H / 2) / H) * -16;
    par.x += (tx - par.x) * 0.045; // interpolación: el movimiento nunca es brusco
    par.y += (ty - par.y) * 0.045;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAPA 1 — Atmósfera
  // ═══════════════════════════════════════════════════════════════════════════
  // Degradado vertical + halo radial del acento + viñeta que cierra los bordes
  function drawAtmosphere(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${T.bg1})`);
    g.addColorStop(1, `rgb(${T.bg2})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Halo que late muy despacio: da la sensación de un núcleo encendido
    const pulse = 0.5 + Math.sin(time * 0.00035) * 0.5;
    const cx = W * 0.5 + par.x * 1.6;
    const cy = H * 0.46 + par.y * 1.6;
    const r = Math.max(W, H) * (0.42 + pulse * 0.05);
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    halo.addColorStop(0, rgba(T.glow, 0.55 * T.dim));
    halo.addColorStop(0.55, rgba(T.glow, 0.16 * T.dim));
    halo.addColorStop(1, rgba(T.glow, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Viñeta: oscurece las esquinas y centra la mirada
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(${T.bg2},0.75)`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAPA 2 — Rejilla en perspectiva
  // ═══════════════════════════════════════════════════════════════════════════
  // Suelo y techo infinitos: las líneas transversales se acercan al observador
  // acelerando (efecto de profundidad) y las longitudinales convergen al centro.
  const GRID_ROWS = 16;      // líneas transversales visibles por plano
  const GRID_COLS = 22;      // líneas longitudinales (en abanico)
  let gridOffset = 0;        // avance continuo de la malla

  function drawGridPlane(horizon, dir, time) {
    const vx = W / 2 + par.x * 0.8;  // punto de fuga
    ctx.lineWidth = 1;

    // Líneas transversales: z va de 0 (horizonte) a 1 (bajo el observador)
    for (let i = 0; i < GRID_ROWS; i++) {
      const z = ((i + gridOffset) % GRID_ROWS) / GRID_ROWS;
      const p = z * z;                       // curva: separación creciente
      const y = horizon + dir * p * (H * 0.62);
      const fade = (1 - z) * 0.55 * z * 4;   // se apaga en el horizonte y al salir
      ctx.strokeStyle = rgba(T.grid, clamp(fade, 0, 0.5) * T.dim);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Líneas longitudinales: salen del punto de fuga hacia el borde inferior
    const edgeY = horizon + dir * H * 0.62;
    for (let c = 0; c <= GRID_COLS; c++) {
      const t = c / GRID_COLS;
      const x = (t - 0.5) * W * 3.2 + vx;    // abanico más ancho que la pantalla
      const grad = ctx.createLinearGradient(vx, horizon, x, edgeY);
      grad.addColorStop(0, rgba(T.grid, 0));
      grad.addColorStop(0.35, rgba(T.grid, 0.16 * T.dim));
      grad.addColorStop(1, rgba(T.grid, 0.03 * T.dim));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(vx, horizon);
      ctx.lineTo(x, edgeY);
      ctx.stroke();
    }
  }

  function drawGrid(time) {
    if (!reduced) gridOffset = (gridOffset + 0.035) % GRID_ROWS;
    const horizon = H * 0.5 + par.y * 0.5;
    drawGridPlane(horizon, 1, time);   // suelo
    drawGridPlane(horizon, -1, time);  // techo (espejo)

    // Línea del horizonte: el filo luminoso donde se juntan ambos planos
    const hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, rgba(T.accent, 0));
    hg.addColorStop(0.5, rgba(T.accent, 0.32 * T.dim));
    hg.addColorStop(1, rgba(T.accent, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 0.5, W, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAPA 3 — Campo de partículas 3D
  // ═══════════════════════════════════════════════════════════════════════════
  // Puntos con coordenada z que viajan hacia el observador. Al salir de plano
  // se reciclan al fondo, de modo que el campo nunca se agota.
  const FOCAL = 520;         // distancia focal de la proyección en perspectiva
  let dust = [];

  function buildDust() {
    const base = LOW_POWER ? 90000 : 42000;
    const n = clamp(Math.round((W * H) / base), 26, LOW_POWER ? 60 : 150);
    dust = [];
    for (let i = 0; i < n; i++) {
      dust.push({
        x: rand(-W, W),
        y: rand(-H, H),
        z: rand(60, 1400),          // profundidad
        vz: rand(0.5, 2.0),         // velocidad de acercamiento
        hot: Math.random() < 0.22,  // algunas brillan con el color de datos
      });
    }
  }

  function drawDust() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // los brillos se suman entre sí
    for (const d of dust) {
      if (!reduced) {
        d.z -= d.vz;
        if (d.z < 40) { // reciclar al fondo con posición nueva
          d.z = rand(1200, 1500);
          d.x = rand(-W, W);
          d.y = rand(-H, H);
        }
      }
      const k = FOCAL / d.z;                       // factor de proyección
      const sx = W / 2 + d.x * k + par.x * (1 - k * 0.4);
      const sy = H / 2 + d.y * k + par.y * (1 - k * 0.4);
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;

      const depth = clamp(1 - d.z / 1500, 0, 1);   // cerca = más grande y brillante
      const r = clamp(k * 1.5, 0.4, 3.2);
      const col = d.hot ? T.data : T.accent;
      ctx.fillStyle = rgba(col, (0.12 + depth * 0.55) * T.dim);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAPA 4 y 5 — Red neuronal y pulsos de datos
  // ═══════════════════════════════════════════════════════════════════════════
  // Nodos flotantes que se enlazan con sus vecinos cercanos. Por cada arista
  // viajan paquetes: un punto brillante con estela que va de un nodo al otro.
  const LINK_DIST = 190;     // radio máximo de enlace entre nodos
  let nodes = [];
  let pulses = [];

  function buildNodes() {
    const base = LOW_POWER ? 46000 : 26000;
    const n = clamp(Math.round((W * H) / base), 14, LOW_POWER ? 26 : 52);
    nodes = [];
    for (let i = 0; i < n; i++) {
      nodes.push({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-0.18, 0.18),        // deriva lenta
        vy: rand(-0.18, 0.18),
        r: rand(1.6, 3.4),            // radio del núcleo
        phase: rand(0, Math.PI * 2),  // desfase del latido
        depth: rand(0.45, 1),         // profundidad: paralaje y opacidad
      });
    }
    pulses = [];
  }

  // Lanza un paquete de datos entre dos nodos vecinos
  function spawnPulse() {
    if (nodes.length < 2 || pulses.length > (LOW_POWER ? 8 : 18)) return;
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    // Buscar un vecino dentro del radio de enlace
    const vecinos = nodes.filter((b) => {
      if (b === a) return false;
      const dx = b.x - a.x, dy = b.y - a.y;
      return dx * dx + dy * dy < LINK_DIST * LINK_DIST;
    });
    if (!vecinos.length) return;
    const b = vecinos[Math.floor(Math.random() * vecinos.length)];
    pulses.push({ a, b, t: 0, speed: rand(0.006, 0.016) });
  }

  function drawNetwork(time) {
    // Mover los nodos y rebotarlos contra los bordes
    if (!reduced) {
      for (const nd of nodes) {
        nd.x += nd.vx;
        nd.y += nd.vy;
        if (nd.x < 0 || nd.x > W) nd.vx *= -1;
        if (nd.y < 0 || nd.y > H) nd.vy *= -1;
      }
    }

    // Aristas: opacidad inversamente proporcional a la distancia
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const ax = a.x + par.x * a.depth, ay = a.y + par.y * a.depth;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK_DIST * LINK_DIST) continue;
        const d = Math.sqrt(d2);
        const alpha = (1 - d / LINK_DIST) * 0.22 * T.dim;
        ctx.strokeStyle = rgba(T.accent, alpha);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(b.x + par.x * b.depth, b.y + par.y * b.depth);
        ctx.stroke();
      }
    }

    // Núcleos: latido suave con halo aditivo
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const nd of nodes) {
      const beat = 0.6 + Math.sin(time * 0.0013 + nd.phase) * 0.4;
      const x = nd.x + par.x * nd.depth;
      const y = nd.y + par.y * nd.depth;
      const r = nd.r * (0.85 + beat * 0.35);

      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      halo.addColorStop(0, rgba(T.accent, 0.5 * beat * nd.depth * T.dim));
      halo.addColorStop(1, rgba(T.accent, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba(T.accent2, (0.55 + beat * 0.45) * nd.depth * T.dim);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Paquetes de datos viajando por las aristas
    if (!reduced) {
      if (Math.random() < 0.06) spawnPulse();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += p.speed;
        if (p.t >= 1) { pulses.splice(i, 1); continue; }
        const ax = p.a.x + par.x * p.a.depth, ay = p.a.y + par.y * p.a.depth;
        const bx = p.b.x + par.x * p.b.depth, by = p.b.y + par.y * p.b.depth;
        const x = ax + (bx - ax) * p.t;
        const y = ay + (by - ay) * p.t;
        // Estela: segmento corto detrás del paquete
        const tail = clamp(p.t - 0.16, 0, 1);
        const tx = ax + (bx - ax) * tail;
        const ty = ay + (by - ay) * tail;
        const gr = ctx.createLinearGradient(tx, ty, x, y);
        gr.addColorStop(0, rgba(T.data, 0));
        gr.addColorStop(1, rgba(T.data, 0.85 * T.dim));
        ctx.strokeStyle = gr;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        // Cabeza del paquete
        ctx.fillStyle = rgba(T.data, 0.95 * T.dim);
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAPA 6 — HUD holográfico
  // ═══════════════════════════════════════════════════════════════════════════
  // Anillos concéntricos con marcas de tick que giran a distinta velocidad,
  // más un barrido de escaneo que recorre la pantalla cada cierto tiempo.
  function drawHud(time) {
    const cx = W * 0.5 + par.x * 1.2;
    const cy = H * 0.5 + par.y * 1.2;
    const base = Math.min(W, H) * 0.30;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Tres anillos: radio, velocidad y sentido distintos
    const rings = [
      { r: base, speed: 0.00012, ticks: 60, len: 7, w: 1 },
      { r: base * 1.34, speed: -0.00008, ticks: 32, len: 12, w: 1 },
      { r: base * 0.72, speed: 0.00021, ticks: 90, len: 4, w: 0.8 },
    ];

    for (const ring of rings) {
      const rot = time * ring.speed;
      // Circunferencia tenue
      ctx.strokeStyle = rgba(T.hud, 0.14 * T.dim);
      ctx.lineWidth = ring.w;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();

      // Marcas de tick: una de cada cinco resalta
      for (let i = 0; i < ring.ticks; i++) {
        const a = rot + (i / ring.ticks) * Math.PI * 2;
        const fuerte = i % 5 === 0;
        const len = fuerte ? ring.len * 1.8 : ring.len;
        const alpha = (fuerte ? 0.34 : 0.15) * T.dim;
        ctx.strokeStyle = rgba(fuerte ? T.accent : T.hud, alpha);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r);
        ctx.lineTo(cx + Math.cos(a) * (ring.r + len), cy + Math.sin(a) * (ring.r + len));
        ctx.stroke();
      }

      // Arco luminoso que recorre el anillo: el "cursor" del HUD
      const head = rot * 6;
      ctx.strokeStyle = rgba(T.accent2, 0.4 * T.dim);
      ctx.lineWidth = ring.w * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, head, head + 0.55);
      ctx.stroke();
    }

    ctx.restore();

    // Barrido de escaneo: banda horizontal que baja cada ~9 s
    if (!reduced) {
      const cycle = (time % 9000) / 9000;
      if (cycle < 0.42) {
        const y = cycle / 0.42 * H;
        const band = ctx.createLinearGradient(0, y - 60, 0, y + 60);
        band.addColorStop(0, rgba(T.accent, 0));
        band.addColorStop(0.5, rgba(T.accent, 0.07 * T.dim));
        band.addColorStop(1, rgba(T.accent, 0));
        ctx.fillStyle = band;
        ctx.fillRect(0, y - 60, W, 120);
        // Filo nítido del barrido
        ctx.fillStyle = rgba(T.accent2, 0.16 * T.dim);
        ctx.fillRect(0, y, W, 1);
      }
    }
  }

  // ── Composición de un frame ─────────────────────────────────────────────────
  function render(time) {
    updateParallax();
    drawAtmosphere(time);
    drawGrid(time);
    drawDust();
    drawNetwork(time);
    drawHud(time);
  }

  // ── Bucle de animación (un frame por refresco de pantalla) ──────────────────
  let running = true;
  function frame(time) {
    render(time);
    if (running) requestAnimationFrame(frame);
  }

  // Ajusta el tamaño real del canvas al de la ventana (con soporte de DPR)
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;   // tamaño CSS
    canvas.width = W * DPR; canvas.height = H * DPR;   // tamaño físico (nítido en retina)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);            // escala el sistema de coordenadas
    buildDust();
    buildNodes();
    if (reduced) render(0);                            // sin animación: refrescar una vez
  }

  // ── Gestión de ciclo de vida ────────────────────────────────────────────────
  // Pausar la animación cuando la pestaña no está visible (ahorra batería/CPU)
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame);
  });
  // Al cambiar el tema: recargar la paleta (los colores se leen en cada frame)
  window.addEventListener("cdh:themechange", () => { theme(); if (reduced) render(0); });
  // Redimensionado con "debounce" de 180 ms (evita recalcular en cada píxel)
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

  // ── Arranque ────────────────────────────────────────────────────────────────
  theme();  // cargar paleta según el tema actual
  resize(); // dimensionar el canvas y poblar las capas

  if (reduced) {
    // Accesibilidad: usuario prefiere menos movimiento → un frame quieto
    running = false;
    render(0);
  } else {
    requestAnimationFrame(frame);
  }
})();
