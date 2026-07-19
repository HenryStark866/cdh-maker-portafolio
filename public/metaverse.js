// CDH Maker — Fondo "metaverso": campo de partículas 3D interactivo
(function () {
  const canvas = document.getElementById("metaverse");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, CX = 0, CY = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Paleta de marca
  const COLORS = [
    [167, 139, 250], // violeta
    [232, 121, 249], // fucsia
    [124, 58, 237],  // púrpura
    [99, 102, 241],  // índigo
  ];

  let stars = [];
  let NUM = 0;
  const FOCAL = 320;   // distancia focal (perspectiva)
  const DEPTH = 900;   // profundidad del campo

  // Nebulosas (manchas de luz que derivan)
  const nebulas = [
    { x: 0.2, y: 0.3, r: 380, c: [124, 58, 237], t: 0, sp: 0.00013 },
    { x: 0.8, y: 0.65, r: 320, c: [192, 38, 211], t: 2, sp: 0.00017 },
    { x: 0.55, y: 0.15, r: 260, c: [79, 70, 229], t: 4, sp: 0.00011 },
  ];

  // Estado de interacción
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = window.scrollY || 0;
  let scrollVel = 0;
  let lastScroll = scrollY;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeStar() {
    return {
      x: rand(-W, W),
      y: rand(-H, H),
      z: rand(1, DEPTH),
      c: COLORS[(Math.random() * COLORS.length) | 0],
      tw: Math.random() * Math.PI * 2, // fase de parpadeo
    };
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    CX = W / 2;
    CY = H / 2;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Densidad según área (con tope para rendimiento)
    const area = W * H;
    NUM = Math.min(Math.max(Math.round(area / 9000), 60), 180);
    stars = [];
    for (let i = 0; i < NUM; i++) stars.push(makeStar());
  }

  function drawNebulas(time) {
    ctx.globalCompositeOperation = "lighter";
    for (const n of nebulas) {
      const nx = (n.x + Math.sin(time * n.sp + n.t) * 0.06) * W;
      const ny = (n.y + Math.cos(time * n.sp * 1.3 + n.t) * 0.06) * H;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
      const [r, gr, b] = n.c;
      g.addColorStop(0, `rgba(${r},${gr},${b},0.16)`);
      g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(nx - n.r, ny - n.r, n.r * 2, n.r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(t) {
    const time = t || 0;

    // Suavizado de interacción
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scrollVel *= 0.9;

    // Fondo base con leve estela (trail) para sensación de movimiento
    ctx.fillStyle = "rgba(8, 6, 15, 0.35)";
    ctx.fillRect(0, 0, W, H);

    drawNebulas(time);

    // Velocidad de avance: base + impulso por scroll
    const speed = 0.6 + Math.abs(scrollVel) * 0.06;
    const rotX = mouse.y * 0.00028;
    const rotY = mouse.x * 0.00028;

    const proj = [];
    for (const s of stars) {
      // Avance hacia la cámara
      s.z -= speed;
      if (s.z < 1) {
        s.z = DEPTH;
        s.x = rand(-W, W);
        s.y = rand(-H, H);
      }

      // Rotación suave del campo según el mouse (parallax 3D)
      let x = s.x + mouse.x * (s.z / DEPTH) * 0.6;
      let y = s.y + mouse.y * (s.z / DEPTH) * 0.6;
      x += (s.y * rotY);
      y += (s.x * rotX);

      const k = FOCAL / s.z;
      const sx = CX + x * k;
      const sy = CY + y * k;

      if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;

      const depth = 1 - s.z / DEPTH;      // 0 lejos → 1 cerca
      const size = Math.max(0.4, depth * 2.6);
      const twinkle = 0.6 + Math.sin(time * 0.003 + s.tw) * 0.4;
      const alpha = Math.min(1, depth * 1.1) * twinkle;
      const [r, g, b] = s.c;

      proj.push({ sx, sy, size, depth, r, g, b, alpha });

      // Estrella con halo
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      if (depth > 0.55) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.18})`;
        ctx.arc(sx, sy, size * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Constelaciones: líneas entre partículas cercanas
    ctx.lineWidth = 1;
    const MAXD = 118, MAXD2 = MAXD * MAXD;
    for (let i = 0; i < proj.length; i++) {
      const a = proj[i];
      if (a.depth < 0.25) continue;
      for (let j = i + 1; j < proj.length; j++) {
        const b = proj[j];
        const dx = a.sx - b.sx, dy = a.sy - b.sy;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAXD2) {
          const o = (1 - Math.sqrt(d2) / MAXD) * 0.22 * Math.min(a.depth, b.depth);
          ctx.strokeStyle = `rgba(${a.r},${a.g},${a.b},${o})`;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }

    if (running) requestAnimationFrame(frame);
  }

  // --- Interacción ---
  window.addEventListener("mousemove", (e) => {
    mouse.tx = e.clientX - CX;
    mouse.ty = e.clientY - CY;
  });
  window.addEventListener("touchmove", (e) => {
    if (!e.touches[0]) return;
    mouse.tx = e.touches[0].clientX - CX;
    mouse.ty = e.touches[0].clientY - CY;
  }, { passive: true });
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    scrollVel += (y - lastScroll);
    lastScroll = y;
    scrollY = y;
  }, { passive: true });

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame);
  });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 180);
  });

  resize();
  if (reduced) {
    // Un solo fotograma estático, sin animación
    ctx.fillStyle = "#08060f";
    ctx.fillRect(0, 0, W, H);
    drawNebulas(0);
    running = false;
    for (const s of stars) {
      const k = FOCAL / s.z;
      const sx = CX + s.x * k, sy = CY + s.y * k;
      const depth = 1 - s.z / DEPTH;
      const [r, g, b] = s.c;
      ctx.fillStyle = `rgba(${r},${g},${b},${depth})`;
      ctx.beginPath();
      ctx.arc(sx, sy, depth * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    requestAnimationFrame(frame);
  }
})();
