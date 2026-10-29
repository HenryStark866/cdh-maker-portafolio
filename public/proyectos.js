/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — proyectos.js
   Visor de proyectos: cada tarjeta de #proyectos abre su presentación en
   video en una ventana, en vez de llevar directo al sistema.

   La tarjeta trae todo lo que el visor necesita (así sirve en los 10 idiomas
   sin repetir textos):
     <article data-proyecto="id"            identificador (#proyecto-id lo abre)
              data-video="/media/x.mp4"     video de presentación (opcional)
              data-poster="/media/x.webp"   portada del video
              data-live="https://…"         sistema abierto al público (opcional)
              data-privado>                 sistema de un cliente: sin enlace
   Título, etiqueta, descripción e imagen se leen de la tarjeta ya traducida;
   los textos del visor salen de #pj-txt (también traducidos por el build).
   Cualquier elemento con data-pj-abrir (o data-pj-abrir="id") abre el visor.
   Sin JavaScript, los enlaces siguen funcionando como antes.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-29
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  const tarjetas = document.querySelectorAll("[data-proyecto]");
  if (!tarjetas.length) return;

  // Textos del visor en el idioma de la página
  const T = {};
  document.querySelectorAll("#pj-txt [data-k]").forEach((s) => { T[s.dataset.k] = s.textContent.trim(); });

  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  };

  // ── La ventana (una sola, se rellena en cada apertura) ─────────────────────
  const dlg = el("dialog", "pj-modal");
  dlg.setAttribute("aria-labelledby", "pj-titulo");
  const caja = el("div", "pj-card");
  const cerrar = el("button", "pj-x");
  cerrar.type = "button";
  cerrar.setAttribute("aria-label", T.close || "Close");
  cerrar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const media = el("div", "pj-media");
  const cuerpo = el("div", "pj-body");
  caja.append(cerrar, media, cuerpo);
  dlg.appendChild(caja);
  document.body.appendChild(dlg);

  let origen = null; // elemento que abrió el visor: recibe el foco al cerrar

  function cerrarVisor() {
    const v = media.querySelector("video");
    if (v) v.pause();
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener("close", () => {
    media.textContent = ""; // libera el video (deja de descargar)
    document.body.classList.remove("pj-abierto");
    if (location.hash.startsWith("#proyecto-")) history.replaceState(null, "", location.pathname + location.search);
    if (origen && origen.focus) origen.focus();
  });
  cerrar.addEventListener("click", cerrarVisor);
  // Clic fuera de la tarjeta (sobre el fondo) cierra
  dlg.addEventListener("click", (e) => { if (e.target === dlg) cerrarVisor(); });

  function abrir(card, quien) {
    origen = quien || null;
    const titulo = card.querySelector("h3")?.textContent.trim() || "";
    const nombre = titulo.split(" — ")[0];
    const etiqueta = card.querySelector(".project-tag")?.textContent.trim() || "";
    const texto = card.querySelector(".project-body > p")?.textContent.replace(/\s+/g, " ").trim() || "";
    const img = card.querySelector("img");
    const { video, poster, live } = card.dataset;
    const privado = card.hasAttribute("data-privado");

    // Medio: el video si existe; si no, la captura con el aviso de que viene en camino
    media.textContent = "";
    media.classList.toggle("sin-video", !video);
    if (video) {
      const v = el("video");
      v.controls = true;
      v.playsInline = true;
      v.preload = "auto";
      if (poster) v.poster = poster;
      v.src = video;
      v.setAttribute("aria-label", titulo);
      media.appendChild(v);
    } else if (img) {
      const i = el("img");
      i.src = img.currentSrc || img.src;
      i.alt = img.alt;
      media.append(i, el("p", "pj-soon", T.soon));
    }

    // Texto y acciones
    cuerpo.textContent = "";
    cuerpo.append(el("div", "project-tag", etiqueta));
    const h = el("h2", "", titulo);
    h.id = "pj-titulo";
    cuerpo.append(h, el("p", "pj-desc", texto));
    if (privado && T.private) cuerpo.append(el("p", "pj-note", T.private));
    cuerpo.append(el("p", "pj-apply", T.apply));
    const acciones = el("div", "pj-acts");
    const demo = el("a", "btn btn-primary", T.demo);
    demo.href = "#contacto";
    demo.addEventListener("click", (e) => {
      const C = window.CDH_CONTACT;
      if (!C) { cerrarVisor(); return; } // sin contact.js: el ancla lleva a #contacto
      e.preventDefault();
      window.open(C.waUrl((T.msg || "{p}").replace("{p}", nombre)), "_blank", "noopener");
    });
    acciones.appendChild(demo);
    if (live && !privado) {
      const a = el("a", "btn btn-ghost", T.live + " ↗");
      a.href = live;
      a.target = "_blank";
      a.rel = "noopener";
      acciones.appendChild(a);
    }
    cuerpo.appendChild(acciones);

    document.body.classList.add("pj-abierto");
    if (!dlg.open) dlg.showModal();
    cerrar.focus();
    const v = media.querySelector("video");
    if (v) v.play().catch(() => { }); // el clic del visitante permite reproducir con sonido
  }

  // ── Disparadores ───────────────────────────────────────────────────────────
  const porId = (id) => document.querySelector(`[data-proyecto="${CSS.escape(id)}"]`);
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-pj-abrir]");
    if (!t) return;
    const card = t.dataset.pjAbrir ? porId(t.dataset.pjAbrir) : t.closest("[data-proyecto]");
    if (!card) return; // fuera de la portada: el enlace navega normalmente
    e.preventDefault();
    abrir(card, t);
  });

  // Enlace directo a una presentación: /#proyecto-refricom (lo usa la cinta)
  function desdeHash() {
    const m = /^#proyecto-([\w-]+)$/.exec(location.hash);
    const card = m && porId(m[1]);
    if (!card) return;
    card.scrollIntoView({ block: "center" });
    if (card.dataset.video || card.dataset.live || card.hasAttribute("data-privado")) abrir(card);
  }
  window.addEventListener("hashchange", desdeHash);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", desdeHash);
  else desdeHash();
})();
