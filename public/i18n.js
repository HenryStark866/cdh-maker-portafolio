/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — i18n.js
   Motor de internacionalización del sitio: 10 idiomas (los más hablados).

   Cómo funciona:
     1. El HTML marca cada texto traducible con data-i18n="clave".
     2. Los diccionarios NO viven aquí: cada idioma tiene su archivo en
        i18n/<código>.js y se descarga solo cuando alguien lo usa.
     3. apply(lang) carga el diccionario si hace falta, recorre el DOM y
        reemplaza cada texto, ajusta <html lang> y la dirección rtl/ltr
        (árabe), y emite "cdh:langchange" para que el resto de scripts se
        re-rendericen.
     4. El idioma inicial se decide por: ?lang= en la URL → elección guardada
        en localStorage → idioma del navegador → español por defecto.

   El español es gratis: el HTML ya está escrito en español, así que mientras
   nadie toque el selector no se descarga ningún diccionario. Solo se pide
   es.js si el visitante se fue a otro idioma y quiere volver.

   Para editar una traducción: abre i18n/<código>.js y busca la clave.
   Para añadir un idioma: agrégalo a LANGS y crea su archivo i18n/<código>.js
   copiando la estructura de uno existente.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-30
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
  const DICT_V = 1;

  // Lo único que el español necesita cuando el HTML ya está en español:
  // las palabras del texto rotativo del hero, que no viven en el DOM.
  const ES_MINIMO = {
    hero_typed: [
      "Ingeniería", "Fabricación digital", "Desarrollo de software",
      "Electrónica e IoT", "Inteligencia Artificial", "Cultura maker",
    ],
  };

  // ¿Ya se tradujo el DOM a un idioma distinto del original (español)?
  // Si es así, volver al español exige el diccionario completo para restaurar
  // los textos; si no, basta con ES_MINIMO y no se descarga nada.
  let domTraducido = false;

  // ── Carga de diccionarios bajo demanda ──────────────────────────────────────
  const pendientes = {}; // code → promesa en curso (evita descargas duplicadas)

  function cargarDiccionario(code) {
    const cache = window.CDH_I18N_DICT || {};
    if (cache[code]) return Promise.resolve(cache[code]);
    if (pendientes[code]) return pendientes[code];

    pendientes[code] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "i18n/" + code + ".js?v=" + DICT_V;
      s.async = true;
      s.onload = () => {
        const dict = (window.CDH_I18N_DICT || {})[code];
        dict ? resolve(dict) : reject(new Error("diccionario vacío: " + code));
      };
      s.onerror = () => reject(new Error("no se pudo cargar el idioma " + code));
      document.head.appendChild(s);
    });
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
    // 2. Atributos de accesibilidad (aria-label) también traducidos
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key in dict) el.setAttribute("aria-label", dict[key]);
    });
    // 3. Título de la pestaña del navegador
    if (dict.meta_title) document.title = dict.meta_title;
    // 4. Atributos del documento: idioma y dirección de escritura
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", RTL.includes(lang) ? "rtl" : "ltr");
    // 5. Publica las palabras del texto rotativo del hero (las usa script.js)
    if (dict.hero_typed) window.CDH_TYPED = dict.hero_typed;
    // 6. Recuerda la elección para futuras visitas
    try { localStorage.setItem("cdh-lang", lang); } catch (e) { }
    // 7. Notifica al resto de scripts (chatbot, auth, hero) para re-renderizar
    window.dispatchEvent(new CustomEvent("cdh:langchange", { detail: { lang } }));
  }

  // Aplica un idioma a toda la página (el corazón del sistema i18n).
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

  // Decide el idioma inicial de la visita (en orden de prioridad)
  function initialLang() {
    // 1º: parámetro explícito en la URL (?lang=en) — ideal para compartir enlaces
    try {
      const p = new URLSearchParams(location.search).get("lang");
      if (p && CODIGOS.includes(p)) return p;
    } catch (e) { }
    // 2º: idioma guardado de una visita anterior
    let saved;
    try { saved = localStorage.getItem("cdh-lang"); } catch (e) { }
    if (saved && CODIGOS.includes(saved)) return saved;
    // 3º: idioma del navegador del visitante (si está soportado)
    const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
    return CODIGOS.includes(nav) ? nav : "es"; // 4º: español por defecto
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
    // Cambio manual del usuario → aplicar el idioma elegido de inmediato.
    // Si la descarga falla, el selector vuelve al idioma que sigue en pantalla.
    sel.addEventListener("change", () => {
      const elegido = sel.value;
      sel.disabled = true;
      apply(elegido)
        .then((ok) => { if (!ok) sel.value = document.documentElement.lang || "es"; })
        .finally(() => { sel.disabled = false; });
    });
    return sel;
  }

  // Arranque: montar el selector, decidir idioma inicial y aplicarlo
  document.addEventListener("DOMContentLoaded", () => {
    const sel = buildSelector();
    const lang = initialLang();
    if (sel) sel.value = lang; // sincronizar el selector con el idioma aplicado
    apply(lang);
  });

  // API pública para otros scripts (cambiar idioma programáticamente)
  window.CDH_I18N = { apply, LANGS };
})();
