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
  // Textos en los 10 idiomas del sitio ("mute" es la etiqueta del botón
  // mientras el video está en silencio, o sea, la acción de activar sonido)
  const T = window.CDH_I18N_ADS || {
    es: { tag: "Publicidad", minimize: "Minimizar", restore: "Mostrar anuncio", mute: "Activar sonido", unmute: "Silenciar", caption: "Ingeniería, IA y fabricación digital — hecho realidad." },
    en: { tag: "Advertisement", minimize: "Minimize", restore: "Show ad", mute: "Unmute", unmute: "Mute", caption: "Engineering, AI and digital fabrication — made real." },
    zh: { tag: "广告", minimize: "最小化", restore: "显示广告", mute: "开启声音", unmute: "静音", caption: "工程、AI 与数字制造——把想法变为现实。" },
    hi: { tag: "विज्ञापन", minimize: "छोटा करें", restore: "विज्ञापन दिखाएँ", mute: "आवाज़ चालू करें", unmute: "म्यूट करें", caption: "इंजीनियरिंग, AI और डिजिटल फ़ैब्रिकेशन — हकीकत में।" },
    ar: { tag: "إعلان", minimize: "تصغير", restore: "عرض الإعلان", mute: "تشغيل الصوت", unmute: "كتم الصوت", caption: "هندسة وذكاء اصطناعي وتصنيع رقمي — أصبحت واقعًا." },
    pt: { tag: "Publicidade", minimize: "Minimizar", restore: "Mostrar anúncio", mute: "Ativar som", unmute: "Silenciar", caption: "Engenharia, IA e fabricação digital — feitas realidade." },
    bn: { tag: "বিজ্ঞাপন", minimize: "ছোট করুন", restore: "বিজ্ঞাপন দেখান", mute: "শব্দ চালু করুন", unmute: "নিঃশব্দ করুন", caption: "ইঞ্জিনিয়ারিং, AI ও ডিজিটাল ফ্যাব্রিকেশন — বাস্তবে রূপ পেয়েছে।" },
    ru: { tag: "Реклама", minimize: "Свернуть", restore: "Показать рекламу", mute: "Включить звук", unmute: "Выключить звук", caption: "Инженерия, ИИ и цифровое производство — воплощённые в жизнь." },
    fr: { tag: "Publicité", minimize: "Réduire", restore: "Afficher l'annonce", mute: "Activer le son", unmute: "Couper le son", caption: "Ingénierie, IA et fabrication numérique — devenues réalité." },
    id: { tag: "Iklan", minimize: "Kecilkan", restore: "Tampilkan iklan", mute: "Nyalakan suara", unmute: "Bisukan", caption: "Rekayasa, AI, dan fabrikasi digital — menjadi nyata." },
  };
  function lang() {
    const l = (document.documentElement.lang || "es").slice(0, 2);
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
          <span>${t.caption || ad.caption}</span>
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

    // El video (2,6 MB) se pide recién cuando el widget es VISIBLE: antes se
    // descargaba en cada visita de escritorio aunque nadie bajara hasta
    // revelarlo (era más del 90 % del peso de la página).
    let revealed = false;

    function applyState(minimized, persist) {
      card.hidden = minimized;
      pill.hidden = !minimized;
      if (minimized) {
        try { video.pause(); } catch (e) {}
      } else if (revealed || persist) { // persist = el visitante lo pidió con un clic
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

    // El widget es de posición fija: si aparece apenas carga la página,
    // se monta encima del propio contenido del hero (le pasó al mensaje
    // de "sin registros ni cuentas" en móvil). Por eso se revela solo
    // cuando el visitante ya bajó de esa zona, nunca en la primera vista.
    const REVEAL_AFTER_SCROLL = 400;
    function reveal() {
      root.classList.add("show");
      revealed = true;
      if (!card.hidden) applyState(false, false); // ahora sí: cargar y reproducir
    }
    if (window.scrollY > REVEAL_AFTER_SCROLL) {
      setTimeout(reveal, 20);
    } else {
      const onScroll = () => {
        if (window.scrollY > REVEAL_AFTER_SCROLL) {
          window.removeEventListener("scroll", onScroll);
          reveal();
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  function schedule() {
    setTimeout(build, 1200);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") schedule();
  else document.addEventListener("DOMContentLoaded", schedule);
})();
