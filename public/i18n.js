/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — i18n.js
   Motor de internacionalización del sitio: 10 idiomas (los más hablados).

   Cómo funciona:
     1. El HTML marca cada texto traducible con data-i18n="clave" (y los
        atributos con data-i18n-aria / data-i18n-alt).
     2. Cada idioma tiene su PROPIA página estática, generada por
        tools/build-i18n.mjs a partir de index.html + i18n/<código>.js:
          /  (español, index.html) · /en · /zh · /hi · /ar · /pt · /bn · /ru · /fr · /id
        Así buscadores y asistentes de IA (que casi nunca ejecutan JavaScript)
        leen el sitio completo en los 10 idiomas, cada uno con su URL.
     3. En esas páginas el idioma lo decide la URL. Este script solo:
          - carga el diccionario del idioma de la página (el español no
            descarga nada) para el texto rotativo del hero y avisa al resto
            de scripts con el evento "cdh:langchange";
          - lleva al visitante a la URL de otro idioma cuando lo elige en el
            selector (y recuerda esa elección);
          - convierte los enlaces viejos con ?lang=xx en la URL nueva;
          - si el navegador está en otro idioma disponible, SUGIERE la versión
            correspondiente con un aviso discreto. Nunca redirige por sí solo
            (Google y los rastreadores de IA lo penalizan).
     4. Una página sin versiones estáticas (sin <link rel="alternate"
        hreflang>) conserva el modo anterior: traduce el DOM en el sitio.

   Para editar una traducción: abre i18n/<código>.js, busca la clave y luego
   corre `node tools/build-i18n.mjs` para regenerar las páginas (el deploy de
   Firebase lo corre solo, ver firebase.json → predeploy).
   Para añadir un idioma: agrégalo a LANGS aquí y en tools/build-i18n.mjs y
   crea su archivo i18n/<código>.js copiando la estructura de uno existente.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-14
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE: módulo autocontenido
(function () {
  // Catálogo de idiomas disponibles en el selector (código ISO, nombre, bandera)
  const LANGS = [
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "zh", name: "中文", flag: "🇨🇳" },
    { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
    { code: "ar", name: "العربية", flag: "🇸🇦" },
    { code: "pt", name: "Português", flag: "🇧🇷" },
    { code: "bn", name: "বাংলা", flag: "🇧🇩" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "id", name: "Indonesia", flag: "🇮🇩" },
  ];
  const CODIGOS = LANGS.map((l) => l.code);

  // Idiomas que se escriben de derecha a izquierda (activan dir="rtl")
  const RTL = ["ar"];

  // Versión de los diccionarios: subirla invalida la caché del navegador
  // cuando se corrige una traducción (ver §10 del manual técnico).
  const DICT_V = 5;

  // Lo único que el español necesita cuando el HTML ya está en español:
  // las palabras del texto rotativo del hero, que no viven en el DOM.
  const ES_MINIMO = {
    hero_typed: [
      "Ingeniería", "Fabricación digital", "Desarrollo de software",
      "Electrónica e IoT", "Inteligencia Artificial", "Cultura maker",
    ],
  };

  // Aviso "esta página está disponible en tu idioma", escrito en el idioma
  // SUGERIDO (quien no entiende español no podría leerlo en español).
  const SUGERENCIA = {
    es: { msg: "Esta página está disponible en español", go: "Ver en español", x: "Cerrar" },
    en: { msg: "This page is available in English", go: "View in English", x: "Close" },
    zh: { msg: "本页面有中文版本", go: "查看中文版", x: "关闭" },
    hi: { msg: "यह पेज हिन्दी में उपलब्ध है", go: "हिन्दी में देखें", x: "बंद करें" },
    ar: { msg: "هذه الصفحة متوفرة باللغة العربية", go: "عرض بالعربية", x: "إغلاق" },
    pt: { msg: "Esta página está disponível em português", go: "Ver em português", x: "Fechar" },
    bn: { msg: "এই পৃষ্ঠাটি বাংলায় পাওয়া যায়", go: "বাংলায় দেখুন", x: "বন্ধ করুন" },
    ru: { msg: "Эта страница доступна на русском", go: "Открыть на русском", x: "Закрыть" },
    fr: { msg: "Cette page est disponible en français", go: "Voir en français", x: "Fermer" },
    id: { msg: "Halaman ini tersedia dalam bahasa Indonesia", go: "Lihat dalam bahasa Indonesia", x: "Tutup" },
  };

  // Elección EXPLÍCITA del visitante (selector, enlace de idioma o "Ver en…").
  // Clave nueva a propósito: la versión anterior guardaba en "cdh-lang" el
  // idioma detectado automáticamente, y eso no debe contar como elección.
  const PREF_KEY = "cdh-lang-v2";
  const DESCARTE_KEY = "cdh-lang-aviso-cerrado"; // solo silencia el aviso

  // ¿Ya se tradujo el DOM a un idioma distinto del original (español)?
  // Si es así, volver al español exige el diccionario completo para restaurar
  // los textos; si no, basta con ES_MINIMO y no se descarga nada.
  let domTraducido = false;

  // ── Páginas estáticas por idioma ────────────────────────────────────────────
  // Las rutas salen de los <link rel="alternate" hreflang> que escribe el
  // generador: así el script no repite la tabla de URLs y funciona igual en
  // localhost que en producción (se usa solo la ruta, no el dominio).
  function rutasEstaticas() {
    const rutas = Object.create(null); // sin prototipo: ?lang=constructor no "existe"
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => {
      const code = l.getAttribute("hreflang");
      if (!CODIGOS.includes(code)) return; // x-default no es un idioma
      try { rutas[code] = new URL(l.href).pathname; } catch (e) { }
    });
    return rutas;
  }
  const RUTAS = rutasEstaticas();
  const ESTATICO = Object.keys(RUTAS).length > 0;
  // Idioma con que se generó esta página (lo fija <html lang> en el HTML)
  const PAGINA = (document.documentElement.getAttribute("lang") || "es").slice(0, 2);

  function leerPref() {
    try {
      const v = localStorage.getItem(PREF_KEY);
      return v && CODIGOS.includes(v) ? v : null;
    } catch (e) { return null; }
  }
  function guardarPref(code) {
    try { localStorage.setItem(PREF_KEY, code); } catch (e) { }
  }
  // Ruta de un idioma conservando la sección (#servicios…) en la que estaba
  function urlDe(code) {
    return (RUTAS[code] || "/") + location.hash;
  }

  // ── Carga de diccionarios bajo demanda ──────────────────────────────────────
  const pendientes = {}; // code → promesa en curso (evita descargas duplicadas)

  function cargarDiccionario(code) {
    const cache = window.CDH_I18N_DICT || {};
    if (cache[code]) return Promise.resolve(cache[code]);
    if (pendientes[code]) return pendientes[code];

    const p = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      // Ruta absoluta: la misma para "/" que para "/en"
      s.src = "/i18n/" + code + ".js?v=" + DICT_V;
      s.async = true;
      s.onload = () => {
        const dict = (window.CDH_I18N_DICT || {})[code];
        dict ? resolve(dict) : reject(new Error("diccionario vacío: " + code));
      };
      s.onerror = () => { s.remove(); reject(new Error("no se pudo cargar el idioma " + code)); };
      document.head.appendChild(s);
    });
    // Si falla, se BORRA la entrada: antes la promesa rechazada quedaba
    // cacheada y ese idioma ya no se podía cargar en toda la visita, ni
    // reintentándolo, porque el return de arriba devolvía el mismo rechazo.
    pendientes[code] = p.catch((err) => { delete pendientes[code]; throw err; });
    return pendientes[code];
  }

  // Pinta el diccionario sobre el documento
  function pintar(dict, lang) {
    // 1. Textos normales: reemplaza el contenido de cada elemento marcado
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!(key in dict)) return; // clave sin traducción: se deja el texto original
      // data-i18n-html permite traducciones con etiquetas (<strong>, <br>…)
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = dict[key];
      else el.textContent = dict[key];
    });
    // 2. Atributos de accesibilidad (aria-label) y texto alternativo de imágenes
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key in dict) el.setAttribute("aria-label", dict[key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      const key = el.getAttribute("data-i18n-alt");
      if (key in dict) el.setAttribute("alt", dict[key]);
    });
    // 3. Título de la pestaña del navegador
    // (solo sin páginas estáticas: ahí el título ya viene escrito y en las
    // páginas de servicio NO es el de la portada que trae el diccionario)
    if (dict.meta_title && !ESTATICO) document.title = dict.meta_title;
    // 4. Atributos del documento: idioma y dirección de escritura
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", RTL.includes(lang) ? "rtl" : "ltr");
    // 5. Publica las palabras del texto rotativo del hero (las usa script.js)
    if (dict.hero_typed) window.CDH_TYPED = dict.hero_typed;
    // 6. Notifica al resto de scripts (chat, cotizador, hero) para re-renderizar
    window.dispatchEvent(new CustomEvent("cdh:langchange", { detail: { lang } }));
  }

  // Aplica un idioma a toda la página.
  // Devuelve una promesa: la descarga del diccionario es asíncrona.
  function apply(lang) {
    if (!CODIGOS.includes(lang)) lang = "es"; // idioma no soportado → español

    // Español sobre un DOM que nadie ha traducido: no hay nada que descargar
    if (lang === "es" && !domTraducido) {
      pintar(ES_MINIMO, "es");
      return Promise.resolve("es");
    }

    return cargarDiccionario(lang)
      .then((dict) => {
        pintar(dict, lang);
        if (lang !== "es") domTraducido = true;
        return lang;
      })
      .catch((err) => {
        // Sin red o archivo caído: se conserva lo que el visitante ya está viendo
        console.warn("[i18n]", err.message);
        return null;
      });
  }

  // Modo sin páginas estáticas: idioma inicial por ?lang= → elección guardada
  // → idioma del navegador → español
  function initialLang() {
    try {
      const p = new URLSearchParams(location.search).get("lang");
      if (p && CODIGOS.includes(p)) return p;
    } catch (e) { }
    const saved = leerPref();
    if (saved) return saved;
    const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
    return CODIGOS.includes(nav) ? nav : "es";
  }

  // Aviso discreto que ofrece la versión en el idioma del navegador
  function sugerirIdioma() {
    if (leerPref()) return; // el visitante ya eligió: no insistir
    try { if (localStorage.getItem(DESCARTE_KEY)) return; } catch (e) { }
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (!nav || nav === PAGINA || !RUTAS[nav] || !SUGERENCIA[nav]) return;
    const t = SUGERENCIA[nav];
    const box = document.createElement("div");
    box.id = "cdh-lang-suggest";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", t.msg);
    box.setAttribute("lang", nav);
    box.setAttribute("dir", RTL.includes(nav) ? "rtl" : "ltr");
    const span = document.createElement("span");
    span.textContent = t.msg;
    const a = document.createElement("a");
    a.href = urlDe(nav);
    a.hreflang = nav;
    a.textContent = t.go;
    a.addEventListener("click", () => guardarPref(nav));
    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", t.x);
    x.textContent = "✕";
    // Cerrar el aviso NO es elegir idioma: solo se recuerda que no se muestre más
    x.addEventListener("click", () => {
      try { localStorage.setItem(DESCARTE_KEY, "1"); } catch (e) { }
      box.remove();
    });
    box.append(span, a, x);
    document.body.appendChild(box);
  }

  // Construye el selector de idioma del nav con una opción por cada LANGS
  function buildSelector() {
    const sel = document.getElementById("langSelect");
    if (!sel) return; // páginas sin selector (ej: perfil) simplemente no lo montan
    LANGS.forEach((l) => {
      const o = document.createElement("option");
      o.value = l.code;                       // código ISO ("es", "en"…)
      o.textContent = l.flag + "  " + l.name; // bandera + nombre nativo
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      const elegido = sel.value;
      guardarPref(elegido);
      // Páginas estáticas: cada idioma vive en su URL → navegar a ella
      if (ESTATICO && RUTAS[elegido]) {
        location.assign(urlDe(elegido));
        return;
      }
      // Sin páginas estáticas: traducir en el sitio. Si la descarga falla,
      // el selector vuelve al idioma que sigue en pantalla.
      sel.disabled = true;
      apply(elegido)
        .then((ok) => { if (!ok) sel.value = document.documentElement.lang || "es"; })
        .finally(() => { sel.disabled = false; });
    });
    return sel;
  }

  // ── Arranque ────────────────────────────────────────────────────────────────
  // Redirecciones que deben ocurrir antes de montar nada (sin esperar al DOM):
  //  - enlaces viejos con ?lang=en → /en
  //  - la portada "/" con una elección explícita guardada → la URL de ese idioma
  //    (solo la portada: un enlace compartido a /pt se respeta tal cual)
  if (ESTATICO) {
    let destino = null, explicito = false;
    try {
      const p = new URLSearchParams(location.search).get("lang");
      if (p && RUTAS[p]) {
        guardarPref(p); // un ?lang= es una elección explícita
        explicito = true;
        if (p !== PAGINA) destino = p;
        else history.replaceState(null, "", location.pathname + location.hash); // limpia ?lang
      }
    } catch (e) { }
    const pref = leerPref();
    if (!destino && !explicito && pref && pref !== PAGINA && RUTAS[pref] && location.pathname === RUTAS[PAGINA] && PAGINA === "es") {
      destino = pref;
    }
    if (destino) {
      location.replace(urlDe(destino));
      return; // la página actual se abandona: no montar nada más
    }
  }

  // Cualquier enlace de idioma (fila del footer, aviso…) cuenta como elección:
  // se guarda antes de navegar para que la portada no rebote a otro idioma.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[hreflang]");
    const code = a && a.getAttribute("hreflang");
    if (code && CODIGOS.includes(code)) guardarPref(code);
  });

  document.addEventListener("DOMContentLoaded", () => {
    const sel = buildSelector();
    if (ESTATICO) {
      if (sel) sel.value = PAGINA;
      // El HTML ya viene traducido: esto solo publica el texto rotativo del
      // hero y avisa a los demás scripts (español: sin descargas).
      apply(PAGINA);
      // El aviso espera a la primera interacción real (scroll, toque, tecla,
      // mouse): así un rastreador que renderiza la página (Googlebot, con el
      // navegador en inglés) nunca lo ve ni lo mezcla con el contenido.
      const EVENTOS = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"];
      const unaVez = () => {
        EVENTOS.forEach((ev) => window.removeEventListener(ev, unaVez));
        sugerirIdioma();
      };
      EVENTOS.forEach((ev) => window.addEventListener(ev, unaVez, { passive: true }));
      return;
    }
    const lang = initialLang();
    if (sel) sel.value = lang;
    // El selector se sincroniza con el idioma REALMENTE aplicado: si la
    // descarga del diccionario falla, la página sigue en español y el
    // selector no debe quedar anunciando un idioma que no está en pantalla.
    apply(lang).then((ok) => {
      if (sel) sel.value = ok || document.documentElement.lang || "es";
    });
  });

  // API pública para otros scripts (cambiar idioma programáticamente)
  window.CDH_I18N = { apply, LANGS };
})();
