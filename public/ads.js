// CDH Maker — Ventana de anuncios
// Sistema simple: un array de anuncios; por ahora solo el video de presentación.
// Se muestra una vez por sesión (sessionStorage), con opción de cerrar y CTA a WhatsApp.
(function () {
  const ADS = [
    {
      id: "ad-video-1",
      type: "video",
      src: "media/ad-video.mp4",
      poster: "media/ad-poster.jpg",
      title: "CDH Maker",
      caption: "Ingeniería, IA y fabricación digital — hecho realidad.",
    },
  ];

  if (!ADS.length) return;
  const ad = ADS[0];

  const SEEN_KEY = "cdh-ad-seen-" + ad.id;
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return;
  } catch (e) {}

  const T = (window.CDH_I18N_ADS) || {
    es: { label: "Anuncio", close: "Cerrar anuncio", cta: "Conocer más", skip: "Saltar" },
    en: { label: "Ad", close: "Close ad", cta: "Learn more", skip: "Skip" },
  };
  function lang() {
    const l = document.documentElement.lang || "es";
    return T[l] ? l : "es";
  }

  function build() {
    const t = T[lang()];
    const root = document.createElement("div");
    root.id = "cdh-ad-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", ad.title);
    root.innerHTML = `
      <div class="cdh-ad-backdrop"></div>
      <div class="cdh-ad-window">
        <div class="cdh-ad-head">
          <span class="cdh-ad-tag">${t.label}</span>
          <button type="button" class="cdh-ad-close" aria-label="${t.close}">✕</button>
        </div>
        <div class="cdh-ad-media">
          <video
            id="cdh-ad-video"
            src="${ad.src}"
            poster="${ad.poster}"
            autoplay
            muted
            playsinline
            loop
            preload="auto"
          ></video>
          <button type="button" class="cdh-ad-mute" aria-label="Activar sonido">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M22 9 16 15M16 9l6 6"/></svg>
          </button>
        </div>
        <div class="cdh-ad-body">
          <strong>${ad.title}</strong>
          <span>${ad.caption}</span>
        </div>
      </div>`;
    document.body.appendChild(root);

    const video = root.querySelector("#cdh-ad-video");
    const muteBtn = root.querySelector(".cdh-ad-mute");
    const closeBtn = root.querySelector(".cdh-ad-close");
    const backdrop = root.querySelector(".cdh-ad-backdrop");

    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M22 9 16 15M16 9l6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    });

    function close() {
      root.classList.add("closing");
      setTimeout(() => root.remove(), 220);
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    // setTimeout en vez de requestAnimationFrame: rAF no se ejecuta en
    // pestañas en segundo plano/sin foco, y el anuncio debe aparecer igual.
    setTimeout(() => root.classList.add("show"), 20);
  }

  function schedule() {
    // Pequeño respiro tras la carga para no competir con el primer pintado
    setTimeout(build, 1200);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    schedule();
  } else {
    document.addEventListener("DOMContentLoaded", schedule);
  }
})();
