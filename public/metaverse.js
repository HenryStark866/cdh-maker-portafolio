// CDH Maker — Fondo "océano tecnológico": aguas profundas inmersivas
(function () {
  const canvas = document.getElementById("metaverse");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Paletas por tema (agua profunda / agua iluminada)
  const THEMES = {
    dark: {
      top: "#06232e", bottom: "#03101a",
      bubble: [125, 211, 231],   // cian agua
      bubble2: [129, 140, 248],  // bioluminiscencia índigo
      plankton: [94, 234, 212],  // aqua
      ray: "255, 255, 255", rayAlpha: 0.05,
    },
    light: {
      top: "#dff3f8", bottom: "#a8d8e6",
      bubble: [14, 116, 144],
      bubble2: [37, 99, 168],
      plankton: [13, 148, 136],
      ray: "255, 255, 255", rayAlpha: 0.28,
    },
  };
  let T = THEMES.dark;

  function theme() {
    const t = document.documentElement.getAttribute("data-theme") || "dark";
    T = THEMES[t] || THEMES.dark;
  }

  let bubbles = [], plankton = [], rays = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    const area = W * H;
    const nB = Math.min(Math.max(Math.round(area / 26000), 14), 42);
    const nP = Math.min(Math.max(Math.round(area / 12000), 30), 90);
    bubbles = [];
    for (let i = 0; i < nB; i++) {
      bubbles.push({
        x: rand(0, W), y: rand(0, H), r: rand(3, 11),
        sp: rand(0.15, 0.55), sway: rand(8, 26), ph: rand(0, 6.28),
        c: Math.random() < 0.75 ? T.bubble : T.bubble2, a: rand(0.12, 0.4),
      });
    }
    plankton = [];
    for (let i = 0; i < nP; i++) {
      plankton.push({
        x: rand(0, W), y: rand(0, H), r: rand(0.6, 2),
        sp: rand(0.05, 0.2), drift: rand(-0.15, 0.15), ph: rand(0, 6.28),
        a: rand(0.15, 0.5),
      });
    }
    rays = [];
    const nR = 5;
    for (let i = 0; i < nR; i++) {
      rays.push({ x: rand(-0.1, 1.1), w: rand(0.05, 0.16), sp: rand(0.00004, 0.00011), ph: rand(0, 6.28) });
    }
  }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  // Interacción
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let scrollBoost = 0, lastScroll = window.scrollY || 0;
  window.addEventListener("mousemove", (e) => { mouse.tx = e.clientX / W; mouse.ty = e.clientY / H; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) { mouse.tx = e.touches[0].clientX / W; mouse.ty = e.touches[0].clientY / H; }
  }, { passive: true });
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    scrollBoost += Math.abs(y - lastScroll) * 0.01;
    lastScroll = y;
  }, { passive: true });

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, T.top);
    g.addColorStop(1, T.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRays(time) {
    ctx.globalCompositeOperation = "lighter";
    for (const r of rays) {
      const cx = (r.x + Math.sin(time * r.sp + r.ph) * 0.05) * W;
      const topW = r.w * W * 0.25, botW = r.w * W;
      const skew = W * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx - topW, -20);
      ctx.lineTo(cx + topW, -20);
      ctx.lineTo(cx + botW + skew, H + 20);
      ctx.lineTo(cx - botW + skew, H + 20);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, `rgba(${T.ray}, ${T.rayAlpha})`);
      lg.addColorStop(1, `rgba(${T.ray}, 0)`);
      ctx.fillStyle = lg;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(t) {
    const time = t || 0;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    scrollBoost *= 0.92;
    const current = (mouse.x - 0.5) * 18; // corriente lateral por el mouse

    drawBackground();
    drawRays(time);

    // Plancton (motas suspendidas)
    ctx.globalCompositeOperation = "lighter";
    for (const p of plankton) {
      p.y -= (p.sp + scrollBoost * 0.15);
      p.x += Math.sin(time * 0.0004 + p.ph) * 0.2 + p.drift + current * 0.02;
      if (p.y < -5) { p.y = H + 5; p.x = rand(0, W); }
      if (p.x < -5) p.x = W + 5; if (p.x > W + 5) p.x = -5;
      const tw = 0.6 + Math.sin(time * 0.002 + p.ph) * 0.4;
      const [r, g, b] = T.plankton;
      ctx.fillStyle = `rgba(${r},${g},${b},${p.a * tw})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Burbujas ascendentes
    for (const bu of bubbles) {
      bu.y -= (bu.sp + scrollBoost * 0.4);
      bu.x += Math.sin(time * 0.0009 + bu.ph) * (bu.sway * 0.02) + current * 0.03;
      if (bu.y < -bu.r * 2) { bu.y = H + bu.r * 2; bu.x = rand(0, W); }
      const [r, g, b] = bu.c;
      // cuerpo translúcido
      ctx.beginPath();
      ctx.arc(bu.x, bu.y, bu.r, 0, 6.2832);
      ctx.fillStyle = `rgba(${r},${g},${b},${bu.a * 0.28})`;
      ctx.fill();
      // borde
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${r},${g},${b},${bu.a})`;
      ctx.stroke();
      // brillo
      ctx.beginPath();
      ctx.arc(bu.x - bu.r * 0.3, bu.y - bu.r * 0.3, bu.r * 0.25, 0, 6.2832);
      ctx.fillStyle = `rgba(255,255,255,${bu.a * 0.6})`;
      ctx.fill();
    }

    if (running) requestAnimationFrame(frame);
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running && !reduced) requestAnimationFrame(frame);
  });
  window.addEventListener("cdh:themechange", () => { theme(); build(); });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

  theme();
  resize();
  if (reduced) {
    running = false;
    drawBackground();
    drawRays(0);
    for (const bu of bubbles) {
      const [r, g, b] = bu.c;
      ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r, 0, 6.2832);
      ctx.strokeStyle = `rgba(${r},${g},${b},${bu.a})`; ctx.stroke();
    }
  } else {
    requestAnimationFrame(frame);
  }
})();
