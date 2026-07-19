/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — metaverse.js
   Fondo animado "Astillero de productos" del sitio (canvas #metaverse).
   Construye, ladrillo a ladrillo (estilo LEGO), la silueta de cada producto
   de CDH Maker: PrivacyCheck, EvaIA, A Tiempo, TaxiYa, IncubApp y el
   engranaje de la marca. Las piezas descienden y encajan con suavidad, la
   figura flota unos segundos con un destello que la recorre, y se desarma
   en burbujas que ascienden (guiño al océano). Se adapta al tema claro /
   oscuro y respeta la preferencia de "reducir movimiento" del sistema.
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
  // Accesibilidad: si el usuario prefiere menos movimiento, se pinta una figura estática
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Dimensiones lógicas del canvas (en píxeles CSS)
  let W = 0, H = 0;
  // Densidad de píxeles (máx. 2 para no derrochar GPU en pantallas 3x/4x)
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ── Paletas de color por tema (RGB) ─────────────────────────────────────────
  // "tones" son los 5 acabados de ladrillo que usan los planos de las figuras:
  // 1 marco · 2 cuerpo · 3 detalle claro · 4 detalle oscuro · 5 acento luminoso
  const THEMES = {
    dark: {
      bg1: [3, 16, 26],            // degradado de fondo: color superior
      bg2: [4, 20, 31],            // degradado de fondo: color inferior
      grid: [17, 52, 68],          // matriz de puntos del fondo
      deep: [2, 12, 20],           // sombras y contornos de los ladrillos
      label: [168, 230, 242],      // rótulo bajo la figura
      tones: {
        1: [34, 211, 238],         // cian brillante — marco de las figuras
        2: [21, 94, 117],          // cian profundo — cuerpo
        3: [224, 247, 250],        // casi blanco — ventanas, detalles
        4: [8, 51, 68],            // cian noche — ruedas, huecos
        5: [94, 234, 212],         // aqua luminoso — ojos, grietas, acentos
      },
    },
    light: {
      bg1: [228, 244, 248],
      bg2: [210, 235, 242],
      grid: [176, 215, 228],
      deep: [7, 46, 61],
      label: [11, 95, 118],
      tones: {
        1: [8, 145, 178],
        2: [140, 216, 233],
        3: [255, 255, 255],
        4: [21, 94, 117],
        5: [13, 148, 136],
      },
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
  // Número aleatorio uniforme en el rango [a, b)
  const rand = (a, b) => a + Math.random() * (b - a);
  // Acota v al rango [a, b]
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  // Curvas de animación: salida suave (aterrizar) y entrada suave (despegar)
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  // Interpola linealmente cada canal entre dos colores RGB y devuelve "rgb(...)"
  function mix(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r},${g},${b})`;
  }
  // Rectángulo redondeado (con fallback para navegadores sin ctx.roundRect)
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ── Planos de construcción ("blueprints") ───────────────────────────────────
  // Cada producto es una matriz de caracteres: "." vacío, "1".."5" = tono del
  // ladrillo (ver THEMES.tones). Todas las filas de un plano miden lo mismo.
  const PRODUCTS = [
    {
      name: "PrivacyCheck", // escudo con chulo de verificación
      art: [
        "..11111111..",
        ".1222222221.",
        "122222222221",
        "122222223321",
        "122222233221",
        "122322332221",
        "122333222221",
        "122232222221",
        ".1222222221.",
        ".1222222221.",
        "..12222221..",
        "...122221...",
        "....1221....",
        ".....11.....",
      ],
    },
    {
      name: "EvaIA", // cabeza de asistente robótico con ojos encendidos
      art: [
        ".....33.....",
        ".....11.....",
        "..11111111..",
        ".1222222221.",
        "122222222221",
        "122552255221",
        "122552255221",
        "122222222221",
        "122233332221",
        ".1222222221.",
        "..11111111..",
        "....1111....",
      ],
    },
    {
      name: "A Tiempo Logística", // camión de última milla con franja en el furgón
      art: [
        "11111111111......",
        "12222222221......",
        "122222222211111..",
        "123333322211331..",
        "1222222222112221.",
        "1111111111111111.",
        "..44....44..44...",
      ],
    },
    {
      name: "TaxiYa", // taxi con letrero en el techo y banda ajedrezada
      art: [
        "......343......",
        "....1111111....",
        "...133233221...",
        "12343434343421.",
        "12222222222221.",
        "11111111111111.",
        "..44......44...",
      ],
    },
    {
      name: "IncubApp", // huevo eclosionando: la grieta brilla con vida adentro
      art: [
        "....111....",
        "..1222221..",
        ".122222221.",
        "12552255221",
        "12225522551",
        "12222222221",
        "12222222221",
        "12222222221",
        ".122222221.",
        ".122222221.",
        "..1222221..",
        "...11111...",
      ],
    },
    {
      name: "CDH Maker", // engranaje de la marca: ingeniería a la medida
      art: [
        "....11111....",
        "....12221....",
        "..111111111..",
        "..122222221..",
        ".12222222221.",
        "1122244422211",
        "1122244422211",
        "1122244422211",
        ".12222222221.",
        "..122222221..",
        "..111111111..",
        "....12221....",
        "....11111....",
      ],
    },
  ];

  // ── Tiempos de la coreografía (en milisegundos) ─────────────────────────────
  const BRICK_MS = 640;   // vuelo de cada ladrillo hasta encajar
  const STAGGER = 24;     // demora entre un ladrillo y el siguiente al armar
  const HOLD_MS = 3400;   // pausa con la figura completa
  const DROP_MS = 560;    // ascenso y desvanecido de cada ladrillo al desarmar
  const DROP_STAG = 13;   // demora entre ladrillos al desarmar
  const GAP_MS = 650;     // silencio entre un producto y el siguiente

  // ── Estado de la escena ─────────────────────────────────────────────────────
  let S = 14;             // lado de cada ladrillo en píxeles (se calcula en layout)
  let prodIdx = 0;        // producto que se está construyendo
  let sideRight = false;  // alterna el costado de la pantalla en cada ciclo
  let fig = null;         // figura ya "maquetada": ladrillos con destino y demoras
  let cycleStart = 0;     // marca de tiempo del inicio del ciclo actual
  let lastT = 0;          // último timestamp de frame (detecta pausas de pestaña)

  // Convierte el plano del producto en ladrillos con posición destino, orden de
  // armado (de abajo hacia arriba, desde el centro), origen de vuelo y demoras
  function layout(p) {
    const rows = p.art.length, cols = p.art[0].length;
    // Tamaño del ladrillo proporcional a la pantalla, entre 10 y 17 px
    S = clamp(Math.round(Math.min(W, H) / 40), 10, 17);
    // Punto de anclaje: en pantallas anchas alterna izquierda/derecha; en
    // pantallas angostas va al centro con menos opacidad (no compite con el texto)
    const wide = W >= 960;
    const ax = wide ? W * (sideRight ? 0.78 : 0.22) : W * 0.5;
    const ay = H * (wide ? 0.52 : 0.46);
    const dim = wide ? 0.85 : 0.45; // opacidad global de la figura
    const x0 = ax - (cols * S) / 2; // esquina superior izquierda de la figura
    const y0 = ay - (rows * S) / 2;

    // Recolectar los ladrillos no vacíos del plano
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = p.art[r][c];
        if (ch === ".") continue;
        cells.push({
          tone: +ch,                    // acabado del ladrillo (1..5)
          c, r,                         // celda en el plano (para el destello)
          tx: x0 + c * S,               // posición destino en pantalla
          ty: y0 + r * S,
          fx: x0 + c * S + rand(-90, 90),    // origen del vuelo: arriba y disperso
          fy: y0 + r * S - rand(140, 320),
          rot0: rand(-0.4, 0.4),        // giro inicial que se endereza al encajar
          rise: rand(50, 120),          // cuánto asciende al desarmarse
          driftX: rand(-40, 40),        // deriva lateral de la "burbuja"
        });
      }
    }
    // Orden de armado: filas de abajo hacia arriba y, dentro de cada fila,
    // desde el centro hacia afuera (como se levanta un muro de verdad)
    const cc = cols / 2;
    cells.sort((a, b) => (b.r - a.r) || (Math.abs(a.c - cc) - Math.abs(b.c - cc)));
    cells.forEach((cell, i) => { cell.delay = i * STAGGER; });
    // Orden de desarme: el inverso (las piezas de arriba se sueltan primero)
    cells.forEach((cell, i) => { cell.dropDelay = (cells.length - 1 - i) * DROP_STAG; });

    // Duraciones derivadas del número de piezas
    const buildDur = (cells.length - 1) * STAGGER + BRICK_MS;
    const dropDur = (cells.length - 1) * DROP_STAG + DROP_MS;
    fig = {
      name: p.name, cells, cols, rows, ax, ay, dim,
      buildDur,
      holdEnd: buildDur + HOLD_MS,
      total: buildDur + HOLD_MS + dropDur + GAP_MS,
      labelY: y0 + rows * S + S * 1.3, // el rótulo va bajo la figura
    };
  }

  // Pasa al siguiente producto y reinicia el reloj del ciclo
  function nextProduct(t) {
    prodIdx = (prodIdx + 1) % PRODUCTS.length;
    sideRight = !sideRight; // cambia de costado: equilibrio visual
    layout(PRODUCTS[prodIdx]);
    cycleStart = t;
  }

  // ── Un ladrillo estilo LEGO en 2.5D ─────────────────────────────────────────
  // (x, y) esquina superior izquierda · tone acabado · alpha opacidad ·
  // lift extra de luz (destello) · rot giro en radianes · sc escala
  function drawBrick(x, y, tone, alpha, lift, rot, sc) {
    if (alpha <= 0.01) return;
    const col = T.tones[tone] || T.tones[1];
    const deep = T.deep;
    const body = S - Math.max(1.4, S * 0.11); // deja una "junta" entre ladrillos
    const half = body / 2;
    const rad = S * 0.22;                     // radio de las esquinas

    ctx.save();
    ctx.translate(x + S / 2, y + S / 2); // origen en el centro del ladrillo
    if (rot) ctx.rotate(rot);
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.globalAlpha = alpha;

    // El acento luminoso (tono 5) irradia un halo sutil
    if (tone === 5) {
      ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},0.9)`;
      ctx.shadowBlur = S * 0.7;
    }

    // 1. Sombra suave proyectada abajo-derecha (despega el ladrillo del fondo)
    ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},0.28)`;
    rrect(-half + 1.5, -half + 2.2, body, body, rad);
    ctx.fill();

    // 2. Cuerpo con degradado vertical: más luz arriba, más sombra abajo
    const g = ctx.createLinearGradient(0, -half, 0, half);
    g.addColorStop(0, mix(col, [255, 255, 255], clamp(0.30 + lift, 0, 0.75)));
    g.addColorStop(1, mix(col, deep, 0.25));
    ctx.fillStyle = g;
    rrect(-half, -half, body, body, rad);
    ctx.fill();
    ctx.shadowBlur = 0; // el halo solo aplica al cuerpo

    // 3. Contorno fino que define la pieza
    ctx.strokeStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},0.35)`;
    ctx.lineWidth = 1;
    rrect(-half, -half, body, body, rad);
    ctx.stroke();

    // 4. El "stud" (tetón) característico de la pieza LEGO
    const sr = S * 0.21;
    // 4a. media sombra bajo el stud: sensación de relieve
    ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},0.22)`;
    ctx.beginPath();
    ctx.arc(0, 0.9, sr, 0, Math.PI * 2);
    ctx.fill();
    // 4b. cara superior del stud, un paso más clara que el cuerpo
    ctx.fillStyle = mix(col, [255, 255, 255], clamp(0.45 + lift, 0, 0.85));
    ctx.beginPath();
    ctx.arc(0, -0.4, sr, 0, Math.PI * 2);
    ctx.fill();
    // 4c. brillo especular: arco fino en el borde superior-izquierdo del stud
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + lift * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -0.4, sr * 0.6, Math.PI * 0.85, Math.PI * 1.6);
    ctx.stroke();

    ctx.restore();
  }

  // ── Rótulo elegante bajo la figura ──────────────────────────────────────────
  function drawLabel(x, y, text, alpha) {
    if (alpha <= 0.01) return;
    const [lr, lg, lb] = T.label;
    const [ar, ag, ab] = T.tones[5];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const fs = Math.max(12, Math.round(S * 0.95));
    ctx.font = `600 ${fs}px "Space Grotesk", Inter, system-ui, sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px"; // aire entre letras
    const label = text.toUpperCase();
    ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
    ctx.fillText(label, x, y);
    // Subrayado fino con degradado aqua que se desvanece en las puntas
    const tw = ctx.measureText(label).width;
    const grad = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
    grad.addColorStop(0, `rgba(${ar},${ag},${ab},0)`);
    grad.addColorStop(0.5, `rgba(${ar},${ag},${ab},0.9)`);
    grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - tw / 2, y + fs + 8, tw, 1);
    ctx.restore();
  }

  // ── Fondo degradado ─────────────────────────────────────────────────────────
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

  // ── Grid de fondo (matriz de puntos) ────────────────────────────────────────
  // Pinta una retícula de puntos tenues cada 30 px (estética de plano técnico)
  function drawGrid() {
    const [r, g, b] = T.grid;
    ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
    for (let y = 0; y < H; y += 30) {
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2); // punto de 1 px de radio
        ctx.fill();
      }
    }
  }

  // ── Piezas ambiente: mini-ladrillos que ascienden como burbujas ─────────────
  let motes = [];
  function buildMotes() {
    // Densidad proporcional al área, acotada (rendimiento estable)
    const n = clamp(Math.round((W * H) / 60000), 12, 32);
    motes = [];
    for (let i = 0; i < n; i++) {
      motes.push({
        x: rand(0, W),
        y: rand(0, H),
        s: rand(3.5, 7),                    // lado del mini-ladrillo
        vy: rand(0.06, 0.22),               // velocidad de ascenso
        sway: rand(0, Math.PI * 2),         // fase del vaivén lateral
        swayAmp: rand(4, 14),               // amplitud del vaivén
        depth: rand(0.3, 1),                // profundidad: opacidad y paralaje
        rot: rand(-0.5, 0.5),               // giro fijo, como pieza a la deriva
        tone: Math.random() < 0.18 ? 5 : 1, // alguna que otra pieza acento
      });
    }
  }

  function drawMotes(time) {
    for (const m of motes) {
      if (!reduced) {
        m.y -= m.vy;                            // asciende lentamente
        if (m.y < -20) { m.y = H + 20; m.x = rand(0, W); } // reaparece abajo
      }
      // Vaivén senoidal + paralaje según profundidad
      const x = m.x + Math.sin(time * 0.0004 + m.sway) * m.swayAmp + par.x * m.depth * 0.6;
      const alpha = 0.05 + m.depth * 0.12;
      const col = T.tones[m.tone];
      const half = m.s / 2;
      ctx.save();
      ctx.translate(x, m.y + par.y * m.depth * 0.6);
      ctx.rotate(m.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      rrect(-half, -half, m.s, m.s, m.s * 0.25); // cuerpo simplificado
      ctx.fill();
      if (m.s >= 5) {
        // stud diminuto: basta un punto más claro en el centro
        ctx.fillStyle = mix(col, [255, 255, 255], 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, m.s * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Interacción con mouse / touch: paralaje sereno ──────────────────────────
  // La escena se desplaza apenas unos píxeles en sentido contrario al cursor
  const mouse = { x: -1, y: -1 };
  const par = { x: 0, y: 0 }; // desplazamiento de paralaje suavizado
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
  }, { passive: true }); // passive: no bloquea el scroll táctil

  function updateParallax() {
    if (mouse.x < 0) return; // aún no se ha movido el cursor
    // Objetivo: máx. ±10 px horizontales y ±6 verticales, interpolado al 4%
    const txp = ((mouse.x - W / 2) / W) * -20;
    const typ = ((mouse.y - H / 2) / H) * -12;
    par.x += (txp - par.x) * 0.04;
    par.y += (typ - par.y) * 0.04;
  }

  // ── La figura en su ciclo: armar → contemplar → desarmar ────────────────────
  // "e" es el tiempo transcurrido del ciclo; "time" el reloj global (vaivén)
  function drawFigure(e, time) {
    const f = fig;
    // Vaivén vertical de la figura completa una vez armada (flota en el agua)
    const bobAmp = 3 * clamp((e - f.buildDur) / 700, 0, 1);
    const bob = Math.sin(time * 0.0009) * bobAmp;

    // Destello: una banda diagonal de luz recorre la figura durante la pausa
    let sweepC = null;
    const sweepT = (e - f.buildDur - 300) / 1600; // progreso 0..1 del barrido
    if (sweepT > 0 && sweepT < 1) sweepC = sweepT * (f.cols + f.rows);

    for (const cell of f.cells) {
      if (e < cell.delay) continue; // esta pieza aún no ha salido
      let x = cell.tx + par.x;
      let y = cell.ty + par.y + bob;
      let alpha = 1, rot = 0, lift = 0, sc = 1;

      if (e < cell.delay + BRICK_MS) {
        // Fase de vuelo: desciende desde su origen y encaja con suavidad
        const p = (e - cell.delay) / BRICK_MS;
        const k = easeOut(p);
        x = cell.fx + (cell.tx - cell.fx) * k + par.x;
        y = cell.fy + (cell.ty - cell.fy) * k + par.y + bob * p;
        alpha = Math.min(1, p / 0.25);    // aparece en el primer cuarto del vuelo
        rot = cell.rot0 * (1 - k);        // se endereza al llegar
        sc = 1.16 - 0.16 * k;             // leve "asentamiento" al encajar
      } else if (e > f.holdEnd) {
        // Fase de desarme: la pieza asciende como burbuja y se desvanece
        const q = clamp((e - f.holdEnd - cell.dropDelay) / DROP_MS, 0, 1);
        if (q >= 1) continue; // ya se disolvió
        const k = easeIn(q);
        y -= k * cell.rise;
        x += k * cell.driftX;
        rot = cell.rot0 * k * 0.8;
        alpha = 1 - k;
      } else if (sweepC !== null) {
        // Fase de contemplación: la banda de luz aporta un brillo pasajero
        const d = cell.c + cell.r; // coordenada diagonal de la celda
        lift = 0.4 * Math.exp(-((d - sweepC) * (d - sweepC)) / 10);
      }

      drawBrick(x, y, cell.tone, alpha * f.dim, lift, rot, sc);
    }

    // Rótulo: aparece cuando el armado va terminando, se va al iniciar el desarme
    const laIn = clamp((e - f.buildDur * 0.8) / 500, 0, 1);
    const laOut = 1 - clamp((e - f.holdEnd) / 400, 0, 1);
    drawLabel(f.ax + par.x, f.labelY + par.y + bob, f.name, laIn * laOut * f.dim);
  }

  // ── Bucle de animación (un frame por refresco de pantalla) ──────────────────
  function frame(time) {
    // Si la pestaña estuvo oculta, correr el reloj del ciclo: nada de saltos
    if (lastT && time - lastT > 900) cycleStart += time - lastT;
    lastT = time;
    if (!cycleStart) cycleStart = time;
    const e = time - cycleStart;

    drawBackground();          // 1. degradado oceánico (borra el frame anterior)
    drawGrid();                // 2. retícula de puntos
    updateParallax();          // 3. paralaje sereno hacia el cursor
    drawMotes(time);           // 4. mini-piezas a la deriva

    if (e >= fig.total) {
      nextProduct(time);       // ciclo terminado: siguiente producto
      drawFigure(0, time);
    } else {
      drawFigure(e, time);     // 5. la construcción del producto en curso
    }

    if (running) requestAnimationFrame(frame); // agenda el siguiente frame
  }

  // Ajusta el tamaño real del canvas al de la ventana (con soporte de DPR)
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;      // tamaño CSS
    canvas.width = W * DPR; canvas.height = H * DPR;      // tamaño físico (nítido en retina)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);               // escala el sistema de coordenadas
    buildMotes();                                          // repoblar el ambiente
    layout(PRODUCTS[prodIdx]);                             // remaquetar la figura
    cycleStart = 0;                                        // reiniciar el armado
    if (reduced) drawStatic();                             // sin animación: refrescar
  }

  // ── Imagen estática para "reducir movimiento" ───────────────────────────────
  // Pinta la primera figura ya armada, con su rótulo, sin bucle de animación
  function drawStatic() {
    drawBackground();
    drawGrid();
    drawMotes(0);
    for (const cell of fig.cells) drawBrick(cell.tx, cell.ty, cell.tone, fig.dim, 0, 0, 1);
    drawLabel(fig.ax, fig.labelY, fig.name, fig.dim);
  }

  // ── Gestión de ciclo de vida ────────────────────────────────────────────────
  let running = true;
  // Pausar la animación cuando la pestaña no está visible (ahorra batería/CPU)
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame); // reanudar al volver
  });
  // Al cambiar el tema: recargar la paleta (los colores se leen en cada frame)
  window.addEventListener("cdh:themechange", () => { theme(); if (reduced) drawStatic(); });
  // Redimensionado con "debounce" de 180 ms (evita remaquetar en cada píxel)
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

  // ── Arranque ────────────────────────────────────────────────────────────────
  theme();  // cargar paleta según el tema actual
  resize(); // dimensionar el canvas, crear ambiente y maquetar la primera figura

  if (reduced) {
    // Accesibilidad: usuario prefiere menos movimiento → figura armada, quieta
    running = false;
    drawStatic();
  } else {
    // Modo normal: iniciar el bucle de animación
    requestAnimationFrame(frame);
  }
})();
