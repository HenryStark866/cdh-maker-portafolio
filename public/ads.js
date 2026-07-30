// CDH Maker — Ventana de anuncios (widget fijo, no splash/modal)
// Reproductor persistente flotante: se queda visible mientras se navega.
// Por ahora presenta un solo video; el array ADS permite sumar más adelante.
(function () {
  const ADS = [
    {
      id: "ad-video-1",
      src: "media/ad-video.mp4",
      poster: "media/ad-poster.webp",
      title: "CDH Maker",
      caption: "Ingeniería, IA y fabricación digital — hecho realidad.",
    },
  ];

  if (!ADS.length) return;
  const ad = ADS[0];

  const MIN_KEY = "cdh-ad-minimized-" + ad.id;
  const T = window.CDH_I18N_ADS || {
    es: { tag: "Publicidad", minimize: "Minimizar", restore: "Mostrar anuncio", mute: "Activar sonido", unmute: "Silenciar" },
    en: { tag: "Advertisement", minimize: "Minimize", restore: "Show ad", mute: "Unmute", unmute: "Mute" },
  };
  function lang() {
    const l = document.documentElement.lang || "es";
    return T[l] ? l : "es";
  }
  function isMinimized() {
    try {
      const stored = localStorage.getItem(MIN_KEY);
      if (stored !== null) return stored === "1";
    } catch (e) {}
    // Sin preferencia guardada: en pantallas pequeñas arranca minimizado
    // (pastilla) para no tapar contenido; en escritorio arranca expandido.
    return window.innerWidth <= 760;
  }
  function setMinimized(v) {
    try { localStorage.setItem(MIN_KEY, v ? "1" : "0"); } catch (e) {}
  }

  const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M22 9 16 15M16 9l6 6"/></svg>';
  const ICON_UNMUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  function build() {
    const t = T[lang()];
    const root = document.createElement("div");
    root.id = "cdh-ad-widget";
    root.innerHTML = `
      <div class="cdh-ad-card" role="complementary" aria-label="${ad.title} — ${t.tag}">
        <div class="cdh-ad-head">
          <span class="cdh-ad-dot"></span>
          <span class="cdh-ad-tag">${t.tag}</span>
          <button type="button" class="cdh-ad-min" aria-label="${t.minimize}">–</button>
        </div>
        <div class="cdh-ad-media">
          <!-- El src se asigna por JS solo cuando la tarjeta está desplegada:
               así el video (varios MB) no se descarga si el widget arranca
               minimizado, que es lo habitual en móvil. -->
          <video id="cdh-ad-video" data-src="${ad.src}" poster="${ad.poster}"
            muted loop playsinline preload="none" width="720" height="406"></video>
          <button type="button" class="cdh-ad-mute" aria-label="${t.mute}">${ICON_MUTE}</button>
        </div>
        <div class="cdh-ad-body">
          <strong>${ad.title}</strong>
          <span>${ad.caption}</span>
        </div>
      </div>
      <button type="button" class="cdh-ad-pill" aria-label="${t.restore}" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        <span>${ad.title}</span>
      </button>`;
    document.body.appendChild(root);

    const card = root.querySelector(".cdh-ad-card");
    const pill = root.querySelector(".cdh-ad-pill");
    const video = root.querySelector("#cdh-ad-video");
    const muteBtn = root.querySelector(".cdh-ad-mute");
    const minBtn = root.querySelector(".cdh-ad-min");

    function applyState(minimized, persist) {
      card.hidden = minimized;
      pill.hidden = !minimized;
      if (minimized) {
        try { video.pause(); } catch (e) {}
      } else {
        // Primera vez que se despliega: recién ahí se pide el archivo
        if (!video.src && video.dataset.src) {
          video.src = video.dataset.src;
          video.preload = "auto";
        }
        video.play().catch(() => {});
      }
      if (persist) setMinimized(minimized);
    }

    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? ICON_MUTE : ICON_UNMUTE;
      muteBtn.setAttribute("aria-label", video.muted ? t.mute : t.unmute);
    });
    minBtn.addEventListener("click", () => applyState(true, true));
    pill.addEventListener("click", () => applyState(false, true));

    applyState(isMinimized(), false);
    setTimeout(() => root.classList.add("show"), 20);
  }

  function schedule() {
    setTimeout(build, 1200);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") schedule();
  else document.addEventListener("DOMContentLoaded", schedule);
})();
