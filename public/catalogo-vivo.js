/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — catalogo-vivo.js
   El catálogo de productos y servicios TAL COMO ESTÁ en el CRM, sin esperar
   un deploy. Lo usan la cinta (ads.js), el chat (chat-widget.js) y la página
   /catalogo (que se repinta si el CRM cambió algo después del último build).

   Fuente: Firestore, colecciones públicas de solo lectura
     catalogo/{id}            un producto o servicio (lo edita el CRM → Catálogo)
     catalogo_config/general  provisional, categorías
   Se lee por la API REST (sin el SDK de Firebase: ~0 KB extra). Si Firestore
   no responde o todavía está vacío, queda /catalogo.json, que escribe
   tools/build-i18n.mjs en cada deploy. Nunca se queda sin catálogo.

   Uso:  window.CDH_CATALOGO().then((cat) => …)   (una sola descarga por página)
   Forma: la de /catalogo.json → { provisional, categorias, preguntas, items:
          [{ id, cat, nombre:{es,en}, para, incluye, precio, precio_texto, … }] }
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const PROJECT = "cdh-maker-portafolio";
  // Pruebas locales: http://localhost:<puerto>/?emu lee el emulador de Firestore (como /crm?emu)
  const EMU = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu(=|&|$)/.test(location.search);
  const BASE = `${EMU ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com"}/v1/projects/${PROJECT}/databases/(default)/documents`;
  const STATIC = "/catalogo.json";
  const TIMEOUT = 4000;

  // Valor tipado de Firestore REST → JS
  function val(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(val);
    if ("mapValue" in v) return fields(v.mapValue.fields || {});
    return null;
  }
  function fields(f) {
    const o = {};
    for (const k of Object.keys(f || {})) o[k] = val(f[k]);
    return o;
  }

  async function getJSON(url) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT) : 0;
    try {
      const r = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: "omit" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // El mismo texto de precio que arma tools/catalogo.mjs (precioTexto)
  const LOCALE = { es: "es-CO", en: "en-US" };
  function precioTexto(item, L) {
    const p = item.precio || {};
    if (p.gratis) return L === "en" ? "Free" : "Gratis";
    if (p.texto && p.texto[L]) return p.texto[L];
    const usar = L === "en" && typeof p.usd === "number" ? { n: p.usd, cur: "USD" }
      : typeof p.cop === "number" ? { n: p.cop, cur: "COP" } : null;
    if (!usar) return L === "en" ? "Quote on request" : "A consultar";
    let monto;
    try {
      monto = new Intl.NumberFormat(LOCALE[L], { style: "currency", currency: usar.cur, currencyDisplay: L === "en" ? "code" : "symbol", maximumFractionDigits: 0 }).format(usar.n);
    } catch (e) {
      monto = usar.cur + " " + Math.round(usar.n);
    }
    const desde = p.desde ? (L === "en" ? "From " : "Desde ") : "";
    const unidad = p.unidad && p.unidad[L] ? ` ${p.unidad[L]}` : "";
    return `${desde}${monto}${unidad}`;
  }

  async function vivo() {
    const [items, conf] = await Promise.all([
      getJSON(`${BASE}/catalogo?pageSize=300`),
      getJSON(`${BASE}/catalogo_config/general`).catch(() => null),
    ]);
    const lista = (items.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...fields(d.fields) }));
    return { items: lista, config: conf && conf.fields ? fields(conf.fields) : {} };
  }

  // Une lo publicado en el último deploy con lo que hay hoy en el CRM
  function unir(base, live) {
    const out = Object.assign({ categorias: [], preguntas: {}, items: [] }, base || {});
    if (live && live.items.length) {
      const orden = {};
      (live.config.categorias || out.categorias || []).forEach((c, i) => { orden[c.id] = i; });
      out.items = live.items
        .filter((x) => x.activo !== false && x.nombre && x.nombre.es)
        .sort((a, b) => (orden[a.cat] ?? 99) - (orden[b.cat] ?? 99) || (a.orden ?? 999) - (b.orden ?? 999));
      if (Array.isArray(live.config.categorias) && live.config.categorias.length) out.categorias = live.config.categorias;
      if (typeof live.config.provisional === "boolean") out.provisional = live.config.provisional;
      out.vivo = true;
    }
    out.items = out.items.map((x) => Object.assign({}, x, { precio_texto: { es: precioTexto(x, "es"), en: precioTexto(x, "en") } }));
    return out;
  }

  let promesa = null;
  window.CDH_CATALOGO = function () {
    if (!promesa) {
      promesa = Promise.allSettled([getJSON(STATIC), vivo()]).then(([s, v]) => {
        const base = s.status === "fulfilled" ? s.value : null;
        const live = v.status === "fulfilled" ? v.value : null;
        if (!base && !(live && live.items.length)) return null;
        return unir(base, live);
      });
    }
    return promesa;
  };
  window.CDH_CATALOGO.precioTexto = precioTexto;
})();
