#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/build-i18n.mjs
   Genera una página estática por idioma para buscadores y asistentes de IA.

   Por qué existe: los rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot…)
   casi nunca ejecutan JavaScript, así que una traducción hecha en el
   navegador no existe para ellos. Este script deja cada idioma escrito en su
   propio HTML, con su URL, sus metadatos y sus datos estructurados.

   Qué hace (sin dependencias, solo Node ≥ 18):
     1. Lee public/es.html (la fuente: el sitio en español, servido en /es) y sincroniza
        public/i18n/es.js con sus textos — el HTML manda, el diccionario sigue.
     2. Rellena el bloque <!-- seo:start --> … <!-- seo:end --> de cada página:
        title, description, canonical, hreflang, Open Graph, Twitter y JSON-LD
        (organización, fundador, servicios, proyectos y preguntas frecuentes),
        todo sacado del diccionario del idioma.
     3. Escribe la portada de los otros 9 idiomas con el cuerpo ya traducido:
        el inglés en public/index.html ("/", idioma por defecto) y el resto en
        public/<código>.html (Firebase con cleanUrls los sirve en /pt, /fr…).
     3b. Escribe las páginas por servicio y ciudad (§SERVICES): español en
        public/servicios/<slug>.html (/servicios/…) y los demás idiomas en
        public/<código>/services/<slug>.html, con textos de
        tools/servicios/<código>.mjs, tiempos leídos de public/estimator.js,
        hreflang propio y JSON-LD Service (provider = #org).
     3c. Escribe el catálogo con precios (tools/catalogo.mjs): /catalogo (es),
        /en/catalog (en) y public/catalogo.json (lo leen la cinta, el chat y
        el bot de Shorts).
     4. Regenera public/sitemap.xml y public/llms.txt.

   Uso:  node tools/build-i18n.mjs            (avisa si faltan traducciones)
         node tools/build-i18n.mjs --strict   (falla si falta alguna)
   El deploy de Firebase lo corre solo (firebase.json → hosting.predeploy).

   Archivos que este script ESCRIBE (no editarlos a mano):
     public/index.html (inglés), public/{zh,hi,ar,pt,bn,ru,fr,id}.html, public/servicios/*.html,
     public/<código>/services/*.html, public/sitemap.xml,
     public/llms.txt, public/catalogo.html, public/en/catalog.html,
     public/catalogo.json, public/i18n/es.js (solo las claves presentes en el HTML)
     y el bloque seo de public/es.html.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-14
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CATALOGO, CATEGORIAS, PREGUNTAS, PROVISIONAL, TEXTOS as CAT_T, cargarRemoto, catalogoPublico, precioTexto } from "./catalogo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const STRICT = process.argv.includes("--strict");

// ═════════════════════════ §CONFIG — ajustar aquí ═════════════════════════
// Dominio canónico: el de la marca. El sitio también responde en
// cdh-maker-portafolio.web.app y www.cdhmaker.com, pero todas las páginas
// declaran ESTE como el oficial (canonical, hreflang, JSON-LD, sitemap), para
// que buscadores e IA junten la autoridad en una sola dirección.
// Si cambia, se cambia SOLO aquí (y la línea Sitemap de robots.txt).
const SITE = "https://cdhmaker.com";

// Idiomas: código del sitio, locale de Open Graph y nombre nativo.
// El inglés es la portada ("/") y el idioma por defecto (x-default); el
// español vive en "/es" y el resto en "/<código>". La FUENTE sigue siendo el
// español: public/es.html se edita a mano y de ahí salen todas las demás.
const DEFAULT = "en";
const LANGS = [
  { code: "es", locale: "es_CO", name: "Español" },
  { code: "en", locale: "en_US", name: "English" },
  { code: "zh", locale: "zh_CN", name: "中文" },
  { code: "hi", locale: "hi_IN", name: "हिन्दी" },
  { code: "ar", locale: "ar_AR", name: "العربية" },
  { code: "pt", locale: "pt_BR", name: "Português" },
  { code: "bn", locale: "bn_BD", name: "বাংলা" },
  { code: "ru", locale: "ru_RU", name: "Русский" },
  { code: "fr", locale: "fr_FR", name: "Français" },
  { code: "id", locale: "id_ID", name: "Bahasa Indonesia" },
];
const RTL = ["ar"];

// Datos de la entidad que no dependen del idioma. Lo que las IA usan para
// saber QUIÉN es CDH Maker: mantenerlos verdaderos y en sincronía con el sitio.
const ENTITY = {
  name: "CDH Maker",
  alternateName: ["CDH Maker IT", "CDHMaker"],
  email: "cdhmaker@gmail.com",
  address: { addressLocality: "Medellín", addressRegion: "Antioquia", addressCountry: "CO" },
  // Idiomas en los que se ATIENDE a clientes (el sitio está en 10, pero esto
  // es un dato sobre el servicio: solo lo que sea cierto).
  serviceLanguages: [
    { code: "es", name: "Spanish" },
    { code: "en", name: "English" },
  ],
  founder: {
    name: "Henry Taborda",
    honorificPrefix: "Ing.",
    // Perfiles públicos de Henry: LinkedIn, etc. Cada uno refuerza la entidad.
    sameAs: ["https://github.com/HenryStark866"],
  },
  // Perfiles públicos de la MARCA (Google Business Profile, LinkedIn de
  // empresa, Instagram, YouTube, Clutch…). Agregar aquí cada uno que se cree.
  sameAs: [],
  // Tecnologías con nombre propio (no se traducen)
  tech: ["Next.js", "JavaScript", "Python", "FastAPI", "Supabase", "Firebase", "Gemini",
    "Arduino", "ESP32", "Raspberry Pi"],
};

// Proyectos del portafolio: claves del diccionario de su título y descripción
const PROJECTS = [
  { name: "PrivacyCheck", url: "https://privacycheck-co.vercel.app", t: "pj_featured_t", p: "pj_featured_p" },
  // YAM es el SaaS estrella de CDH Maker: la plataforma de A Tiempo Logística
  { name: "YAM", url: "https://yam.cdhmaker.com", t: "pj_at_t", p: "pj_at_p" },
  { name: "TaxiYa", url: "https://taxiya.vercel.app", t: "pj_taxi_t", p: "pj_taxi_p" },
  { name: "IncubApp", url: "https://incubapp.cdhmaker.com", t: "pj_inc_t", p: "pj_inc_p" },
  { name: "EvaIA", t: "pj_eva_t", p: "pj_eva_p" },
  { name: "SIGI", t: "pj_sigi_t", p: "pj_sigi_p" },
  // Refricom es el sistema privado de un cliente: se lista sin URL (solo se muestra en video)
  { name: "Refricom — Sistema de Gestión del Mantenimiento", t: "pj_ref_t", p: "pj_ref_p" },
  // El autodiagnóstico Ley 1581 del reto CAVALTEC es el mismo PrivacyCheck,
  // hecho con el equipo Sintaxis TI: no se lista dos veces ni como obra solo propia.
];
const FAQ_COUNT = 10;  // faq1_q … faq10_q
// Claves que solo usan la cabecera y el JSON-LD (no aparecen en el <body>)
const HEAD_KEYS = ["meta_title", "meta_desc", "person_job"];
const NEEDS_COUNT = 8; // n1_t … n8_t

// §SERVICES — páginas por servicio y ciudad (textos en tools/servicios/<código>.mjs).
// Rutas: español en /servicios/<slug.es>; los demás idiomas en
// /<código>/services/<slug.en> (con cleanUrls, el archivo es
// public/<código>/services/<slug>.html).
//   card:     tarjeta de #servicios de la portada que la representa (su
//             Offer del JSON-LD de la portada recibe la url de la página)
//   area:     "local" = Medellín + Colombia (físico); "global" = además el mundo
//   projects: claves de PROJECT_CARDS, en el orden en que se muestran
//   tools:    muestra el bloque cotizador + visor 3D (fabricación)
const SERVICES = [
  { id: "print3d", slug: { es: "impresion-3d-medellin", en: "3d-printing-medellin" }, card: 2, area: "local", projects: [], tools: true },
  { id: "software", slug: { es: "software-a-la-medida-medellin", en: "custom-software-medellin" }, card: 1, area: "global", projects: ["ref", "at", "taxi", "inc", "pc"] },
  { id: "ai", slug: { es: "inteligencia-artificial-medellin", en: "ai-integration-medellin" }, area: "global", projects: ["eva", "sigi", "inc", "pc"] },
  { id: "iot", slug: { es: "iot-automatizacion-medellin", en: "iot-automation-medellin" }, card: 3, area: "local", projects: [] },
];
// Tarjetas de proyecto de las páginas de servicio: textos del diccionario
// principal (los mismos de #proyectos) y la imagen de public/media. La URL
// en vivo sale de PROJECTS: se cambia en un solo lugar.
const PROJECT_CARDS = {
  at: { t: "pj_at_t", p: "pj_at_p", tag: "tag_star", img: "atiempo-logistica", ext: "jpg", w: 1000, h: 625, alt: "alt_at" },
  taxi: { t: "pj_taxi_t", p: "pj_taxi_p", tag: "tag_saas", img: "taxiya", ext: "jpg", w: 1000, h: 625, alt: "alt_taxi" },
  inc: { t: "pj_inc_t", p: "pj_inc_p", tag: "tag_saas_ai", img: "incubapp", ext: "jpg", w: 1000, h: 625, alt: "alt_inc" },
  pc: { t: "pj_featured_t", p: "pj_featured_p", tag: "tag_web", img: "privacycheck-poster", ext: "jpg", w: 1280, h: 720, alt: "pj_featured_t" },
  eva: { t: "pj_eva_t", p: "pj_eva_p", tag: "tag_ai", img: "evaia-avatar", ext: "png", w: 640, h: 640, alt: "alt_eva" },
  sigi: { t: "pj_sigi_t", p: "pj_sigi_p", tag: "tag_sigi" },
  ref: { t: "pj_ref_t", p: "pj_ref_p", tag: "tag_client" },
};
for (const card of Object.values(PROJECT_CARDS)) {
  const pj = PROJECTS.find((x) => x.t === card.t);
  if (pj && pj.url) card.url = pj.url;
}
// Íconos de las tarjetas de servicio (los mismos trazos de la portada)
const SVC_ICON = {
  print3d: '<path d="M6 3h12l4 6-10 12L2 9l4-6z" /><path d="M11 3 8 9l4 12 4-12-3-6" /><path d="M2 9h20" />',
  software: '<path d="m8 6-6 6 6 6" /><path d="m16 6 6 6-6 6" /><path d="m14 4-4 16" />',
  ai: '<path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-1 5.2V17a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-.8A3 3 0 0 1 5 11v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" /><path d="M12 2v19" />',
  iot: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />',
};
// ════════════════════════════════════════════════════════════════════════

const BUILD_DATE = new Date().toISOString().slice(0, 10);
const urlOf = (code) => (code === DEFAULT ? `${SITE}/` : `${SITE}/${code}`);
const homePath = (code) => (code === DEFAULT ? "/" : `/${code}`);
// Archivo de la portada de cada idioma: el inglés es index.html ("/")
const homeFile = (code) => (code === DEFAULT ? "index.html" : `${code}.html`);
const svcPath = (svc, code) => (code === "es" ? `/servicios/${svc.slug.es}` : `/${code}/services/${svc.slug.en}`);
const svcUrl = (svc, code) => SITE + svcPath(svc, code);
// Catálogo: solo español e inglés (los otros idiomas enlazan al inglés)
const CAT_LANGS = ["es", "en"];
const catLang = (code) => (code === "es" ? "es" : "en");
const catPath = (code) => (catLang(code) === "es" ? "/catalogo" : "/en/catalog");
const catUrl = (code) => SITE + catPath(code);

// ── Utilidades de texto ──────────────────────────────────────────────────
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");
const decode = (s) =>
  String(s)
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const squash = (s) => String(s).replace(/\s+/g, " ").trim();
// Texto plano para metadatos y JSON-LD: sin etiquetas ni entidades
const plain = (s) => squash(decode(String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")));

// ── Diccionarios ─────────────────────────────────────────────────────────
function dictPath(code) {
  return path.join(PUB, "i18n", `${code}.js`);
}
function loadDict(code) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(dictPath(code), "utf8"), ctx, { filename: `${code}.js` });
  const d = ctx.window.CDH_I18N_DICT && ctx.window.CDH_I18N_DICT[code];
  if (!d) throw new Error(`i18n/${code}.js no define CDH_I18N_DICT["${code}"]`);
  return JSON.parse(JSON.stringify(d)); // objeto plano fuera del contexto vm
}

// ── Recorrido de etiquetas del HTML ──────────────────────────────────────
// Un escáner mínimo en vez de un parser completo: el HTML del sitio está
// escrito a mano y es regular, y así el resultado conserva el formato
// original byte por byte salvo en lo que se traduce.
const TAG_RE = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(src) {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(src || ""))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

// Índice donde empieza el </tag> que cierra el elemento abierto en `from`
function findClose(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0].endsWith("/>")) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error(`<${tag}> sin cerrar cerca de la posición ${from}`);
}

// Cambia el valor de un atributo dentro del texto de una etiqueta de apertura
function setAttr(openTag, name, value) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  if (re.test(openTag)) return openTag.replace(re, (_, pre) => `${pre}"${escAttr(value)}"`);
  return openTag.replace(/\s*\/?>$/, (end) => ` ${name}="${escAttr(value)}"${end}`);
}

/**
 * Recorre los elementos marcados con data-i18n / data-i18n-aria / data-i18n-alt.
 * visit({ key, kind: "text"|"html"|"aria"|"alt", inner }) devuelve el valor
 * nuevo (o undefined para dejarlo igual). Devuelve el HTML resultante.
 */
function walkI18n(html, visit) {
  let out = "", last = 0, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html))) {
    const tag = m[2];
    if (!tag) continue; // comentario o <script>/<style>: se copia tal cual
    const attrs = parseAttrs(m[3]);
    if (!("data-i18n" in attrs) && !("data-i18n-aria" in attrs) && !("data-i18n-alt" in attrs)) continue;

    let open = m[0];
    if (attrs["data-i18n-aria"]) {
      const v = visit({ key: attrs["data-i18n-aria"], kind: "aria", inner: decode(attrs["aria-label"] || "") });
      if (v !== undefined) open = setAttr(open, "aria-label", v);
    }
    if (attrs["data-i18n-alt"]) {
      const v = visit({ key: attrs["data-i18n-alt"], kind: "alt", inner: decode(attrs["alt"] || "") });
      if (v !== undefined) open = setAttr(open, "alt", v);
    }
    out += html.slice(last, m.index) + open;
    last = m.index + m[0].length;

    if (attrs["data-i18n"]) {
      const isHtml = "data-i18n-html" in attrs;
      const closeAt = findClose(html, tag, last);
      const inner = html.slice(last, closeAt);
      const v = visit({ key: attrs["data-i18n"], kind: isHtml ? "html" : "text", inner });
      out += v === undefined ? inner : isHtml ? v : escText(v);
      last = closeAt;
      TAG_RE.lastIndex = closeAt; // lo de adentro ya quedó resuelto
    }
  }
  return out + html.slice(last);
}

// ── 1. Sincronizar es.js con es.html ──────────────────────────────────
function extractSpanish(html) {
  const found = {};
  walkI18n(html, ({ key, kind, inner }) => {
    let v;
    if (kind === "html") v = squash(inner);
    else if (kind === "text") v = squash(decode(inner.replace(/<[^>]+>/g, "")));
    else v = squash(inner);
    if (key in found && found[key] !== v) {
      throw new Error(`La clave "${key}" aparece con textos distintos en es.html:\n  «${found[key]}»\n  «${v}»`);
    }
    found[key] = v;
    return undefined;
  });
  return found;
}

function writeDict(code, dict) {
  const file = dictPath(code);
  const src = fs.readFileSync(file, "utf8");
  const head = src.slice(0, src.indexOf("window.CDH_I18N_DICT"));
  const body =
    `window.CDH_I18N_DICT = window.CDH_I18N_DICT || {};\n` +
    `window.CDH_I18N_DICT["${code}"] = ${JSON.stringify(dict, null, 2)};\n`;
  if (head + body !== src) fs.writeFileSync(file, head + body);
}

// ── 2. Bloque SEO del <head> ─────────────────────────────────────────────
function jsonLd(code, d) {
  const page = urlOf(code);
  const ORG = `${SITE}/#org`, PERSON = `${SITE}/#henry`, WEBSITE = `${SITE}/#website`;
  const world = { "@type": "Place", name: "Worldwide" };
  const colombia = { "@type": "Country", name: "Colombia" };
  const address = { "@type": "PostalAddress", ...ENTITY.address };
  const knowsAbout = [
    ...["s1_a", "s1_b", "s1_c", "s2_a", "s2_b", "s2_c", "s3_a", "s3_b", "s3_c", "s4_a", "s4_b", "s4_c", "t_ai"]
      .filter((k) => d[k]).map((k) => plain(d[k])),
    ...ENTITY.tech,
  ];

  const services = [1, 2, 3, 4].map((n) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      // La línea que tiene página propia apunta a ella (en este idioma)
      ...(SERVICES.some((s) => s.card === n) ? { url: svcUrl(SERVICES.find((s) => s.card === n), code) } : {}),
      name: plain(d[`s${n}_t`]),
      description: plain(d[`s${n}_p`]),
      serviceType: ["a", "b", "c"].map((x) => plain(d[`s${n}_${x}`])),
      provider: { "@id": ORG },
      // Fabricación y electrónica son físicas (dentro de Colombia); software y
      // diseño/consultoría se entregan de forma remota a cualquier país
      areaServed: n === 2 || n === 3 ? colombia : world,
    },
  }));

  const org = {
    "@type": ["ProfessionalService", "Organization"],
    "@id": ORG,
    name: ENTITY.name,
    alternateName: ENTITY.alternateName,
    url: `${SITE}/`,
    logo: `${SITE}/icon.svg`,
    image: `${SITE}/media/og.jpg`,
    description: plain(d.meta_desc),
    slogan: plain(d.foot_tag),
    email: ENTITY.email,
    founder: { "@id": PERSON },
    address,
    areaServed: [world, colombia],
    knowsAbout,
    knowsLanguage: ENTITY.serviceLanguages.map((l) => l.code),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: ENTITY.email,
      url: `${page}#contacto`,
      availableLanguage: ENTITY.serviceLanguages.map((l) => l.name),
      areaServed: "Worldwide",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog", name: plain(d.nav_serv),
      // El catálogo con precios vive en su propia página (es / en)
      itemListElement: [...services, { "@type": "OfferCatalog", "@id": `${catUrl(code)}#catalogo`, name: CAT_T[catLang(code)].crumb, url: catUrl(code) }],
    },
  };
  if (ENTITY.sameAs.length) org.sameAs = ENTITY.sameAs;

  const person = {
    "@type": "Person",
    "@id": PERSON,
    name: ENTITY.founder.name,
    honorificPrefix: ENTITY.founder.honorificPrefix,
    jobTitle: plain(d.person_job),
    worksFor: { "@id": ORG },
    address,
    knowsLanguage: ENTITY.serviceLanguages.map((l) => l.code),
    knowsAbout,
    sameAs: ENTITY.founder.sameAs,
  };

  const website = {
    "@type": "WebSite",
    "@id": WEBSITE,
    url: `${SITE}/`,
    name: ENTITY.name,
    inLanguage: LANGS.map((l) => l.code),
    publisher: { "@id": ORG },
  };

  const webpage = {
    "@type": "WebPage",
    "@id": `${page}#webpage`,
    url: page,
    name: plain(d.meta_title),
    description: plain(d.meta_desc),
    inLanguage: code,
    isPartOf: { "@id": WEBSITE },
    about: { "@id": ORG },
    primaryImageOfPage: { "@type": "ImageObject", url: `${SITE}/media/og.jpg`, width: 1200, height: 630 },
    dateModified: BUILD_DATE,
  };

  const projects = {
    "@type": "ItemList",
    "@id": `${page}#proyectos`,
    name: plain(d.proj_t),
    itemListElement: PROJECTS.map((p, i) => {
      const item = {
        "@type": "CreativeWork",
        name: p.name,
        headline: plain(d[p.t]),
        description: plain(d[p.p]),
        creator: { "@id": ORG },
      };
      if (p.url) item.url = p.url;
      return { "@type": "ListItem", position: i + 1, item };
    }),
  };

  const faq = {
    "@type": "FAQPage",
    "@id": `${page}#faq`,
    inLanguage: code,
    mainEntity: Array.from({ length: FAQ_COUNT }, (_, i) => i + 1)
      .filter((n) => d[`faq${n}_q`] && d[`faq${n}_a`])
      .map((n) => ({
        "@type": "Question",
        name: plain(d[`faq${n}_q`]),
        acceptedAnswer: { "@type": "Answer", text: plain(d[`faq${n}_a`]) },
      })),
  };

  // Un nodo por línea: legible al inspeccionar y sin el peso de la indentación.
  // "<" escapado: un texto con "</script>" no puede cerrar el bloque antes de tiempo
  const nodes = [org, person, website, webpage, projects, faq].map((n) => JSON.stringify(n));
  return `{"@context":"https://schema.org","@graph":[\n${nodes.join(",\n")}\n]}`.replace(/</g, "\\u003c");
}

function seoBlock(code, d) {
  const lang = LANGS.find((l) => l.code === code);
  const title = plain(d.meta_title);
  const desc = plain(d.meta_desc);
  const page = urlOf(code);
  const I = "  ";
  const lines = [
    `<!-- seo:start — bloque GENERADO por tools/build-i18n.mjs desde i18n/${code}.js: no editar a mano -->`,
    `<title>${escText(title)}</title>`,
    `<meta name="description" content="${escAttr(desc)}" />`,
    `<link rel="canonical" href="${page}" />`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${urlOf(l.code)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${ENTITY.name}" />`,
    `<meta property="og:title" content="${escAttr(title)}" />`,
    `<meta property="og:description" content="${escAttr(desc)}" />`,
    `<meta property="og:url" content="${page}" />`,
    `<meta property="og:image" content="${SITE}/media/og.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escAttr(title)}" />`,
    `<meta property="og:locale" content="${lang.locale}" />`,
    ...LANGS.filter((l) => l.code !== code).map((l) => `<meta property="og:locale:alternate" content="${l.locale}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(title)}" />`,
    `<meta name="twitter:description" content="${escAttr(desc)}" />`,
    `<meta name="twitter:image" content="${SITE}/media/og.jpg" />`,
    `<script type="application/ld+json">`,
    jsonLd(code, d),
    `</script>`,
    `<!-- seo:end -->`,
  ];
  return lines.map((l) => (l.startsWith("{") ? l : I + l)).join("\n").trimStart();
}

function replaceSeo(html, block) {
  const re = /<!-- seo:start[\s\S]*?<!-- seo:end -->/;
  // Exactamente un bloque: si la marca apareciera también en otro comentario,
  // el reemplazo se comería todo lo que hay entre ambas
  const n = html.split("<!-- seo:start").length - 1;
  if (n !== 1 || !re.test(html)) {
    throw new Error(`es.html debe tener exactamente un bloque "<!-- seo:start" … "<!-- seo:end -->" (tiene ${n})`);
  }
  return html.replace(re, () => block);
}

// ── 3. Página traducida ──────────────────────────────────────────────────
// d: diccionario del idioma. es: diccionario español, respaldo de cabecera y
// JSON-LD (un dato en español es mejor que un "undefined" en el JSON-LD).
function translatePage(src, code, d, es, missing) {
  let html = walkI18n(src, ({ key }) => {
    if (key in d) return d[key];
    missing.add(key);
    return undefined; // sin traducción: queda el español que ya trae el HTML
  });
  html = replaceSeo(html, seoBlock(code, { ...es, ...d }));
  // Idioma y dirección del documento
  html = html.replace(/<html\b[^>]*>/, `<html lang="${code}" dir="${RTL.includes(code) ? "rtl" : "ltr"}">`);
  // Rutas relativas → absolutas: la página se sirve en /en y también debe
  // funcionar si alguien llega por /en/ (con barra final)
  html = html.replace(/\s(src|href|poster|srcset)="(?!#|\/|[a-z][a-z0-9+.-]*:)([^"]+)"/gi, ` $1="/$2"`);
  html = localizeSvcLinks(html, code);
  // Fila de idiomas del footer: marcar como actual el de esta página
  html = html
    .replace(/(<a href="[^"]*" hreflang="[a-z]{2}"[^>]*?) aria-current="page"/g, "$1")
    .replace(new RegExp(`(<a href="${homePath(code)}" hreflang="${code}"[^>]*?)>`), `$1 aria-current="page">`);
  // El comentario de cabecera describe es.html: se cambia por un aviso
  html = html.replace(
    /^(<!DOCTYPE html>\s*)<!--[\s\S]*?-->/i,
    `$1<!-- GENERADO por tools/build-i18n.mjs a partir de es.html + i18n/${code}.js.\n     No editar: los cambios se pierden en el próximo build. -->`
  );
  return html;
}

// ── 3b. Páginas por servicio y ciudad ────────────────────────────────────
// Cada página reutiliza el "cascarón" de la portada YA traducida (menú,
// footer, scripts, sección de proceso y de contacto) y cambia el <main>, el
// bloque seo y los enlaces que dependen de la URL.

// Enlaces de la portada (fuente en español) → la ruta del idioma de la página
function localizeSvcLinks(html, code) {
  if (code === "es") return html;
  for (const s of SERVICES) html = html.split(`href="${svcPath(s, "es")}"`).join(`href="${svcPath(s, code)}"`);
  html = html.split('href="/catalogo').join(`href="${catPath(code)}`);
  return html;
}

// Tiempos de referencia: se leen de public/estimator.js para que las páginas
// nunca contradigan al cotizador (TIME_WEB, TIME_IOT, TIME_DESIGN y PRICE)
function readEstimator() {
  const src = fs.readFileSync(path.join(PUB, "estimator.js"), "utf8");
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`));
    if (!m) throw new Error(`estimator.js: no se encontró "const ${name} = {…};"`);
    return vm.runInNewContext(`(${m[1]})`);
  };
  return { web: grab("TIME_WEB"), iot: grab("TIME_IOT"), design: grab("TIME_DESIGN"), price: grab("PRICE") };
}

// Valores de los marcadores {landing}, {app}… en el idioma de la página
function timeVars(est, sd) {
  const c = sd.common;
  const r = (x, u) => fill(c.range, { min: x.min, max: x.max, u: c[u] });
  return {
    landing: r(est.web.landing, "u_weeks"), app: r(est.web.app, "u_weeks"), auto: r(est.web.auto, "u_weeks"),
    proto: r(est.iot.proto, "u_weeks"), product: r(est.iot.product, "u_weeks"), iotauto: r(est.iot.auto, "u_weeks"),
    cad: r(est.design.cad, "u_days"), advice: r(est.design.advice, "u_days"), workshop: r(est.design.workshop, "u_days"),
    fdm: fill(sd.print3d.fdm, { n: est.price.fdm_cm3_por_hora }),
    resin: fill(sd.print3d.resin, { n: est.price.resina_cm_alto_por_hora }),
  };
}
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

async function loadServiceDict(code) {
  const file = path.join(ROOT, "tools", "servicios", `${code}.mjs`);
  if (!fs.existsSync(file)) return {};
  // ?v= evita la caché de módulos si el build se importa dos veces en un proceso
  return (await import(`${pathToFileURL(file).href}?v=${Date.now()}`)).default;
}

// Completa `d` con `es` donde falte algo (mismas claves, listas del mismo
// largo) y anota cada hueco en `missing` como "servicio.clave"
function withFallback(es, d, missing, where = "") {
  if (Array.isArray(es)) {
    if (!Array.isArray(d) || d.length !== es.length) { missing.add(where); return es; }
    return es.map((v, i) => withFallback(v, d[i], missing, `${where}[${i}]`));
  }
  if (es && typeof es === "object") {
    const out = {};
    for (const k of Object.keys(es)) out[k] = withFallback(es[k], d && d[k], missing, where ? `${where}.${k}` : k);
    return out;
  }
  if (typeof d !== "string" || !d.trim()) { missing.add(where); return es; }
  return d;
}

// Extrae <section … id="X"> … </section> de una página ya armada
function sectionById(html, id) {
  const m = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if (!m) throw new Error(`No se encontró la sección #${id} en la portada`);
  const end = findClose(html, "section", m.index + m[0].length);
  return html.slice(m.index, end + "</section>".length);
}

function svcJsonLd(svc, code, s, c, d) {
  const page = svcUrl(svc, code);
  const ORG = `${SITE}/#org`, WEBSITE = `${SITE}/#website`;
  const medellin = { "@type": "City", name: "Medellín", containedInPlace: { "@type": "Country", name: "Colombia" } };
  const areaServed = [medellin, { "@type": "Country", name: "Colombia" }];
  if (svc.area === "global") areaServed.push({ "@type": "Place", name: "Worldwide" });

  const org = {
    "@type": ["ProfessionalService", "Organization"],
    "@id": ORG,
    name: ENTITY.name,
    url: `${SITE}/`,
    logo: `${SITE}/icon.svg`,
    email: ENTITY.email,
    address: { "@type": "PostalAddress", ...ENTITY.address },
  };
  const service = {
    "@type": "Service",
    "@id": `${page}#service`,
    name: s.name,
    serviceType: s.name,
    description: s.meta_desc,
    url: page,
    provider: { "@id": ORG },
    areaServed,
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${page}#contacto`,
      availableLanguage: ENTITY.serviceLanguages.map((l) => l.name),
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: c.inc_t,
      itemListElement: s.inc.map(([t, p]) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: t, description: p, provider: { "@id": ORG } },
      })),
    },
  };
  const webpage = {
    "@type": "WebPage",
    "@id": `${page}#webpage`,
    url: page,
    name: s.meta_title,
    description: s.meta_desc,
    inLanguage: code,
    isPartOf: { "@id": WEBSITE },
    about: { "@id": `${page}#service` },
    breadcrumb: { "@id": `${page}#breadcrumb` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${SITE}/media/og.jpg`, width: 1200, height: 630 },
    dateModified: BUILD_DATE,
  };
  const projects = svc.projects.map((k) => PROJECT_CARDS[k]);
  if (projects.length) {
    webpage.mentions = projects.map((p) => {
      const pj = PROJECTS.find((x) => x.t === p.t);
      const item = { "@type": "CreativeWork", name: pj ? pj.name : plain(d[p.t]), description: plain(d[p.p]), creator: { "@id": ORG } };
      if (p.url) item.url = p.url;
      return item;
    });
  }
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${page}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: c.crumb_home, item: urlOf(code) },
      { "@type": "ListItem", position: 2, name: plain(d.nav_serv), item: `${urlOf(code)}#servicios` },
      { "@type": "ListItem", position: 3, name: s.name, item: page },
    ],
  };
  const faq = {
    "@type": "FAQPage",
    "@id": `${page}#faq`,
    inLanguage: code,
    mainEntity: s.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const nodes = [org, service, webpage, breadcrumb, faq].map((n) => JSON.stringify(n));
  return `{"@context":"https://schema.org","@graph":[\n${nodes.join(",\n")}\n]}`.replace(/</g, "\\u003c");
}

function svcSeoBlock(svc, code, s, c, d, langsWithPage) {
  const lang = LANGS.find((l) => l.code === code);
  const page = svcUrl(svc, code);
  const I = "  ";
  const lines = [
    `<!-- seo:start — bloque GENERADO por tools/build-i18n.mjs desde tools/servicios/${code}.mjs: no editar a mano -->`,
    `<title>${escText(s.meta_title)}</title>`,
    `<meta name="description" content="${escAttr(s.meta_desc)}" />`,
    `<link rel="canonical" href="${page}" />`,
    ...langsWithPage.map((l) => `<link rel="alternate" hreflang="${l}" href="${svcUrl(svc, l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${svcUrl(svc, langsWithPage.includes(DEFAULT) ? DEFAULT : "es")}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${ENTITY.name}" />`,
    `<meta property="og:title" content="${escAttr(s.meta_title)}" />`,
    `<meta property="og:description" content="${escAttr(s.meta_desc)}" />`,
    `<meta property="og:url" content="${page}" />`,
    `<meta property="og:image" content="${SITE}/media/og.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escAttr(s.meta_title)}" />`,
    `<meta property="og:locale" content="${lang.locale}" />`,
    ...LANGS.filter((l) => l.code !== code && langsWithPage.includes(l.code)).map((l) => `<meta property="og:locale:alternate" content="${l.locale}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(s.meta_title)}" />`,
    `<meta name="twitter:description" content="${escAttr(s.meta_desc)}" />`,
    `<meta name="twitter:image" content="${SITE}/media/og.jpg" />`,
    `<script type="application/ld+json">`,
    svcJsonLd(svc, code, s, c, d),
    `</script>`,
    `<!-- seo:end -->`,
  ];
  return lines.map((l) => (l.startsWith("{") ? l : I + l)).join("\n").trimStart();
}

const ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>';

// El <main> de la página: héroe, qué incluye, tiempos, proyectos, proceso,
// preguntas, otros servicios y contacto
function svcMain(svc, code, sd, d, vars, home) {
  const c = sd.common;
  const s = sd[svc.id];
  const t = (x) => escText(fill(x, vars));
  const H = homePath(code);
  const sections = [];

  // Qué incluye
  sections.push(`<section class="section" id="incluye">
    <div class="container">
      <p class="section-kicker">${t(c.inc_k)}</p>
      <h2>${t(c.inc_t)}</h2>
      <div class="cards svc-inc">
${s.inc.map(([h, p]) => `        <article class="card">
          <h3>${t(h)}</h3>
          <p>${t(p)}</p>
        </article>`).join("\n")}
      </div>
    </div>
  </section>`);

  // Tiempos (del cotizador) + herramientas
  const tools = svc.tools
    ? `
      <div class="svc-tools">
        <h3>${t(s.tools_t)}</h3>
        <p>${t(s.tools_p)}</p>
        <div class="hero-cta svc-tools-cta">
          <button type="button" class="btn btn-primary" data-estimator>${escText(plain(d.tool_est_open))}</button>
          <button type="button" class="btn btn-ghost" id="openViewer3d">${escText(plain(d.tool_view_open))}</button>
        </div>
      </div>`
    : `
      <div class="hero-cta svc-tools-cta">
        <button type="button" class="btn btn-primary" data-estimator>${escText(plain(d.tool_est_open))}</button>
      </div>`;
  sections.push(`<section class="section" id="tiempos">
    <div class="container">
      <p class="section-kicker">${t(c.times_k)}</p>
      <h2>${t(c.times_t)}</h2>
      <p class="section-sub">${t(c.times_s)}</p>
      <dl class="svc-times">
${s.times.map(([label, value]) => `        <div class="svc-time"><dt>${t(label)}</dt><dd>${t(value)}</dd></div>`).join("\n")}
      </dl>${s.times_note ? `\n      <p class="svc-note">${t(s.times_note)}</p>` : ""}${tools}
    </div>
  </section>`);

  // Proyectos relacionados (solo los que existen en la portada)
  if (svc.projects.length) {
    const cards = svc.projects.map((k) => {
      const p = PROJECT_CARDS[k];
      const media = p.img
        ? `
          <${p.url ? `a class="project-media" href="${p.url}" target="_blank" rel="noopener"` : "div class=\"project-media\""}>
            <picture>
              <source srcset="/media/${p.img}.webp" type="image/webp" />
              <img src="/media/${p.img}.${p.ext}" alt="${escAttr(plain(d[p.alt]))}" loading="lazy" decoding="async" width="${p.w}" height="${p.h}" />
            </picture>
          </${p.url ? "a" : "div"}>`
        : "";
      const link = p.url ? `\n            <a class="project-link" href="${p.url}" target="_blank" rel="noopener">${escText(plain(d.live))}</a>` : "";
      return `        <article class="project${p.img ? " project-with-media" : ""}">${media}
          <div class="project-body">
            <div class="project-tag">${escText(plain(d[p.tag]))}</div>
            <h3>${escText(plain(d[p.t]))}</h3>
            <p>${escText(plain(d[p.p]))}</p>${link}
          </div>
        </article>`;
    });
    sections.push(`<section class="section" id="proyectos">
    <div class="container">
      <p class="section-kicker">${t(c.proj_k)}</p>
      <h2>${t(c.proj_t)}</h2>
      <p class="section-sub">${t(c.proj_s)}</p>
      <div class="projects">
${cards.join("\n")}
      </div>
    </div>
  </section>`);
  }

  // Proceso: la misma sección de la portada
  sections.push(sectionById(home, "proceso"));

  // Preguntas frecuentes del servicio
  sections.push(`<section class="section" id="faq">
    <div class="container">
      <p class="section-kicker">${escText(plain(d.faq_k))}</p>
      <h2>${t(c.faq_t)}</h2>
      <div class="faq-list">
${s.faq.map(([q, a]) => `        <details class="faq-item">
          <summary><span>${t(q)}</span><i class="faq-chev"></i></summary>
          <p>${t(a)}</p>
        </details>`).join("\n")}
      </div>
    </div>
  </section>`);

  // Otros servicios (enlazado interno entre las páginas del mismo idioma)
  sections.push(`<section class="section" id="otros-servicios">
    <div class="container">
      <p class="section-kicker">${t(c.more_k)}</p>
      <h2>${t(c.more_t)}</h2>
      <div class="cards">
${SERVICES.filter((o) => o !== svc).map((o) => `        <a class="card svc-link-card" href="${svcPath(o, code)}">
          <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SVC_ICON[o.id]}</svg></div>
          <h3>${t(sd[o.id].name)}</h3>
          <p>${t(sd[o.id].meta_desc)}</p>
          <span class="tool-card-cta" aria-hidden="true">→</span>
        </a>`).join("\n")}
      </div>
    </div>
  </section>`);

  // Contacto: la misma sección de la portada
  sections.push(sectionById(home, "contacto"));

  // Fondos alternos: una sección sí y una no, sin importar cuáles haya
  const body = sections.map((sec, i) =>
    sec.replace(/<section class="section(?: section-alt)?"/, `<section class="section${i % 2 ? "" : " section-alt"}"`));

  const hero = `<!-- ===== HÉROE DEL SERVICIO ===== -->
  <section class="hero svc-hero">
    <div class="orb orb-1" aria-hidden="true"></div>
    <div class="orb orb-2" aria-hidden="true"></div>
    <div class="container hero-inner">
      <nav class="breadcrumb" aria-label="${escAttr(c.crumb_aria)}">
        <ol>
          <li><a href="${H}">${t(c.crumb_home)}</a></li>
          <li><a href="${H}#servicios">${escText(plain(d.nav_serv))}</a></li>
          <li aria-current="page">${t(s.name)}</li>
        </ol>
      </nav>
      <p class="hero-kicker">${t(s.kicker)}</p>
      <h1>${t(s.h1)}</h1>
      <p class="hero-sub">${t(s.lead)}</p>
      <div class="hero-cta">
        <a href="#contacto" class="btn btn-primary btn-glow">${ARROW_SVG}<span>${escText(plain(d.hero_cta1))}</span></a>
        <button type="button" class="btn btn-ghost" data-estimator>${t(c.estimate)}</button>
      </div>
    </div>
  </section>`;

  return `<main id="contenido">

  ${hero}

  ${body.join("\n\n  ")}

  </main>`;
}

function buildServicePage(svc, code, home, sd, d, vars, langsWithPage) {
  const s = sd[svc.id];
  const c = sd.common;
  let html = home;
  // Cabecera
  html = replaceSeo(html, svcSeoBlock(svc, code, s, c, d, langsWithPage));
  html = html.replace(/<html\b[^>]*>/, `<html lang="${code}" dir="${RTL.includes(code) ? "rtl" : "ltr"}">`);
  html = html.replace(
    /^(<!DOCTYPE html>\s*)<!--[\s\S]*?-->/i,
    `$1<!-- GENERADO por tools/build-i18n.mjs (página de servicio "${svc.id}") a partir de es.html,\n     i18n/${code}.js y tools/servicios/${code}.mjs. No editar: los cambios se pierden en el próximo build. -->`
  );
  // Rutas relativas → absolutas (la página vive en una subcarpeta)
  html = html.replace(/\s(src|href|poster|srcset)="(?!#|\/|[a-z][a-z0-9+.-]*:)([^"]+)"/gi, ` $1="/$2"`);
  // Anclas de la portada (#servicios…) → la portada del idioma. El logo
  // lleva a la portada; el enlace "saltar al contenido", al <main> de aquí.
  html = html.replace(/<a href="#servicios" class="skip-link"/, '<a href="#contenido" class="skip-link"');
  html = html.replace(/<a href="#top" class="nav-logo"/, `<a href="${homePath(code)}" class="nav-logo"`);
  html = html.replace(/href="#(?!top"|contenido")([a-zA-Z][\w-]*)"/g, `href="${homePath(code)}#$1"`);
  // Fila de idiomas del footer → esta misma página en cada idioma
  for (const l of langsWithPage) {
    html = html.split(`<a href="${homePath(l)}" hreflang="${l}"`).join(`<a href="${svcPath(svc, l)}" hreflang="${l}"`);
  }
  // Contenido propio (las secciones de proceso y contacto salen de la portada
  // original, con sus anclas internas intactas)
  const start = html.indexOf('<main id="contenido">');
  const end = html.indexOf("</main>", start);
  if (start < 0 || end < 0) throw new Error('La portada debe tener <main id="contenido"> … </main>');
  return html.slice(0, start) + svcMain(svc, code, sd, d, vars, home) + html.slice(end + "</main>".length);
}

// ── 3c. Catálogo con precios (tools/catalogo.mjs) ────────────────────────
// Mismo cascarón que las páginas de servicio: la portada ya traducida con
// otro <main>, otro bloque seo y los enlaces de idioma apuntando al catálogo.

// Solo las categorías que tienen algo publicado (el CRM puede dejar una vacía)
const catConItems = () => CATEGORIAS.filter((c) => CATALOGO.some((x) => x.cat === c.id));

// El precio en la otra moneda, para llms.txt
function catOther(x, L) {
  const p = x.precio || {};
  if (typeof p.usd !== "number" || typeof p.cop !== "number") return "";
  return L === "es" ? ` (USD ${p.usd} fuera de Colombia)` : ` (${p.cop.toLocaleString("en-US")} COP in Colombia)`;
}

function catJsonLd(L) {
  const T = CAT_T[L];
  const page = catUrl(L);
  const ORG = `${SITE}/#org`, WEBSITE = `${SITE}/#website`;
  const world = { "@type": "Place", name: "Worldwide" };
  const colombia = { "@type": "Country", name: "Colombia" };
  const physical = new Set(["fabricacion", "iot"]);
  const offer = (x) => {
    const p = x.precio || {};
    const product = x.cat === "productos";
    const o = {
      "@type": "Offer",
      name: x.nombre[L],
      description: x.para[L],
      url: x.url || `${page}#${x.id}`,
      ...(x.imagen ? { image: SITE + x.imagen } : {}),
      seller: { "@id": ORG },
      itemOffered: {
        "@type": product ? "SoftwareApplication" : "Service",
        name: x.nombre[L],
        description: x.para[L],
        provider: { "@id": ORG },
        ...(product
          ? { applicationCategory: "BusinessApplication", operatingSystem: "Web", ...(x.url ? { url: x.url } : {}) }
          : { areaServed: physical.has(x.cat) ? colombia : [colombia, world] }),
      },
    };
    if (p.gratis) { o.price = 0; o.priceCurrency = "COP"; }
    const specs = [];
    for (const [cur, n] of [["COP", p.cop], ["USD", p.usd]]) {
      if (typeof n !== "number") continue;
      const sp = { "@type": "UnitPriceSpecification", priceCurrency: cur, valueAddedTaxIncluded: false };
      if (p.desde) sp.minPrice = n; else sp.price = n;
      if (p.unidad) sp.unitText = p.unidad[L];
      specs.push(sp);
    }
    if (specs.length) o.priceSpecification = specs;
    return o;
  };
  const catalog = {
    "@type": "OfferCatalog",
    "@id": `${page}#catalogo`,
    name: T.crumb,
    description: PROVISIONAL ? T.provisional : T.meta_desc,
    provider: { "@id": ORG },
    itemListElement: catConItems().map((c) => ({
      "@type": "OfferCatalog",
      "@id": `${page}#${c.id}`,
      name: c.nombre[L],
      description: c.lema[L],
      itemListElement: CATALOGO.filter((x) => x.cat === c.id).map(offer),
    })),
  };
  const org = {
    "@type": ["ProfessionalService", "Organization"],
    "@id": ORG,
    name: ENTITY.name,
    url: `${SITE}/`,
    logo: `${SITE}/icon.svg`,
    email: ENTITY.email,
    address: { "@type": "PostalAddress", ...ENTITY.address },
    hasOfferCatalog: { "@id": `${page}#catalogo` },
  };
  const webpage = {
    "@type": "WebPage",
    "@id": `${page}#webpage`,
    url: page,
    name: T.meta_title,
    description: T.meta_desc,
    inLanguage: L,
    isPartOf: { "@id": WEBSITE },
    about: { "@id": `${page}#catalogo` },
    breadcrumb: { "@id": `${page}#breadcrumb` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${SITE}/media/og.jpg`, width: 1200, height: 630 },
    dateModified: BUILD_DATE,
  };
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${page}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: T.crumb_home, item: urlOf(L) },
      { "@type": "ListItem", position: 2, name: T.crumb, item: page },
    ],
  };
  const faq = {
    "@type": "FAQPage",
    "@id": `${page}#faq`,
    inLanguage: L,
    mainEntity: PREGUNTAS[L].map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const nodes = [org, catalog, webpage, breadcrumb, faq].map((n) => JSON.stringify(n));
  return `{"@context":"https://schema.org","@graph":[\n${nodes.join(",\n")}\n]}`.replace(/</g, "\\u003c");
}

function catSeoBlock(L) {
  const T = CAT_T[L];
  const lang = LANGS.find((l) => l.code === L);
  const page = catUrl(L);
  const I = "  ";
  const lines = [
    `<!-- seo:start — bloque GENERADO por tools/build-i18n.mjs desde tools/catalogo.mjs: no editar a mano -->`,
    `<title>${escText(T.meta_title)}</title>`,
    `<meta name="description" content="${escAttr(T.meta_desc)}" />`,
    `<link rel="canonical" href="${page}" />`,
    ...CAT_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${catUrl(l)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${catUrl("en")}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${ENTITY.name}" />`,
    `<meta property="og:title" content="${escAttr(T.meta_title)}" />`,
    `<meta property="og:description" content="${escAttr(T.meta_desc)}" />`,
    `<meta property="og:url" content="${page}" />`,
    `<meta property="og:image" content="${SITE}/media/og.jpg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${lang.locale}" />`,
    ...CAT_LANGS.filter((l) => l !== L).map((l) => `<meta property="og:locale:alternate" content="${LANGS.find((x) => x.code === l).locale}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(T.meta_title)}" />`,
    `<meta name="twitter:description" content="${escAttr(T.meta_desc)}" />`,
    `<meta name="twitter:image" content="${SITE}/media/og.jpg" />`,
    `<script type="application/ld+json">`,
    catJsonLd(L),
    `</script>`,
    `<!-- seo:end -->`,
  ];
  return lines.map((l) => (l.startsWith("{") ? l : I + l)).join("\n").trimStart();
}

// El <main> del catálogo: héroe, una sección por categoría (la Consultoría
// primero), preguntas y la sección de contacto de la portada
function catMain(L, d, home) {
  const T = CAT_T[L];
  const H = homePath(L);
  const e = escText;
  const card = (x) => {
    const p = x.precio || {};
    // En la página en español, la referencia en dólares para quien está afuera
    const usd = L === "es" && typeof p.usd === "number" && typeof p.cop === "number"
      ? `<small class="cat-usd">${e(T.usd)}: ${p.desde ? "desde " : ""}USD ${p.usd}</small>` : "";
    const cta = x.url
      ? `<a class="btn btn-ghost cat-cta" href="${x.url}" target="_blank" rel="noopener">${e(T.ver)} ↗</a>`
      : `<a class="btn btn-primary cat-cta" href="#contacto" data-cat-item="${escAttr(x.nombre[L])}">${e(T.pedir)}</a>`;
    const img = x.imagen ? `
          <img class="cat-img" src="${escAttr(x.imagen)}" alt="${escAttr(x.nombre[L])}" loading="lazy" decoding="async" width="640" height="360" />` : "";
    return `        <article class="card cat-item${x.destacado ? " is-featured" : ""}" id="${x.id}">${img}${x.destacado ? `
          <span class="cat-badge">${e(T.destacado)}</span>` : ""}
          <h3>${e(x.nombre[L])}</h3>
          <p>${e(x.para[L])}</p>
          <p class="cat-inc-t">${e(T.incluye)}</p>
          <ul>
${x.incluye[L].map((i) => `            <li>${e(i)}</li>`).join("\n")}
          </ul>
          <dl class="cat-meta">
            <div><dt>${e(T.precio)}</dt><dd><strong class="cat-price">${e(precioTexto(x, L))}${PROVISIONAL && !p.gratis ? "*" : ""}</strong>${usd}</dd></div>
            <div><dt>${e(T.plazo)}</dt><dd>${e(x.plazo[L])}</dd></div>
          </dl>
          ${cta}
        </article>`;
  };
  const sections = catConItems().map((c) => `<section class="section" id="${c.id}">
    <div class="container">
      <p class="section-kicker">// ${e(c.nombre[L])}</p>
      <h2>${e(c.nombre[L])}</h2>
      <p class="section-sub">${e(c.lema[L])}</p>
      <div class="cards cat-grid">
${CATALOGO.filter((x) => x.cat === c.id).map(card).join("\n")}
      </div>
    </div>
  </section>`);
  sections.push(`<section class="section" id="faq">
    <div class="container">
      <p class="section-kicker">${e(plain(d.faq_k))}</p>
      <h2>${e(T.dudas_t)}</h2>
      <div class="faq-list">
${PREGUNTAS[L].map(([q, a]) => `        <details class="faq-item">
          <summary><span>${e(q)}</span><i class="faq-chev"></i></summary>
          <p>${e(a)}</p>
        </details>`).join("\n")}
      </div>
    </div>
  </section>`);
  sections.push(sectionById(home, "contacto"));
  const body = sections.map((sec, i) =>
    sec.replace(/<section class="section(?: section-alt)?"/, `<section class="section${i % 2 ? "" : " section-alt"}"`));
  const hero = `<!-- ===== HÉROE DEL CATÁLOGO ===== -->
  <section class="hero svc-hero">
    <div class="orb orb-1" aria-hidden="true"></div>
    <div class="orb orb-2" aria-hidden="true"></div>
    <div class="container hero-inner">
      <nav class="breadcrumb" aria-label="${escAttr(T.crumb_aria)}">
        <ol>
          <li><a href="${H}">${e(T.crumb_home)}</a></li>
          <li aria-current="page">${e(T.crumb)}</li>
        </ol>
      </nav>
      <p class="hero-kicker">${e(T.kicker)}</p>
      <h1>${e(T.h1)}</h1>
      <p class="hero-sub">${e(T.lead)}</p>
      <div class="hero-cta">
        <a href="#orientacion" class="btn btn-primary btn-glow">${ARROW_SVG}<span>${e(T.cta1)}</span></a>
        <a href="#consultoria" class="btn btn-ghost">${e(T.cta2)}</a>
      </div>${PROVISIONAL ? `
      <p class="cat-provisional">* ${e(T.provisional)}</p>` : ""}
    </div>
  </section>`;
  return `<main id="contenido" data-catalogo="${L}">

  ${hero}

  ${body.join("\n\n  ")}

  </main>
  <script src="/catalogo-pagina.js?v=1" defer></script>`;
}

function buildCatalogPage(code, home, d) {
  const L = catLang(code);
  let html = home;
  html = replaceSeo(html, catSeoBlock(L));
  html = html.replace(/<html\b[^>]*>/, `<html lang="${L}" dir="ltr">`);
  html = html.replace(
    /^(<!DOCTYPE html>\s*)<!--[\s\S]*?-->/i,
    `$1<!-- GENERADO por tools/build-i18n.mjs (catálogo) a partir de es.html,\n     i18n/${L}.js y tools/catalogo.mjs. No editar: los cambios se pierden en el próximo build. -->`
  );
  html = html.replace(/\s(src|href|poster|srcset)="(?!#|\/|[a-z][a-z0-9+.-]*:)([^"]+)"/gi, ` $1="/$2"`);
  html = html.replace(/<a href="#servicios" class="skip-link"/, '<a href="#contenido" class="skip-link"');
  html = html.replace(/<a href="#top" class="nav-logo"/, `<a href="${homePath(L)}" class="nav-logo"`);
  // Anclas de la portada → la portada del idioma (las del catálogo se
  // escriben después, en catMain, y no pasan por aquí)
  html = html.replace(/href="#(?!top"|contenido")([a-zA-Z][\w-]*)"/g, `href="${homePath(L)}#$1"`);
  for (const l of CAT_LANGS) {
    html = html.split(`<a href="${homePath(l)}" hreflang="${l}"`).join(`<a href="${catPath(l)}" hreflang="${l}"`);
  }
  const start = html.indexOf('<main id="contenido">');
  const end = html.indexOf("</main>", start);
  if (start < 0 || end < 0) throw new Error('La portada debe tener <main id="contenido"> … </main>');
  return html.slice(0, start) + catMain(L, d, home) + html.slice(end + "</main>".length);
}

// Imágenes del catálogo (llegan del CRM como data URI): un archivo por
// versión en public/media/catalogo/, y cada ítem apunta al suyo.
function escribirImagenesCatalogo(imagenes) {
  const porId = Object.fromEntries(imagenes.map((x) => [x.id, x]));
  for (const item of CATALOGO) {
    const img = porId[item.id];
    if (!img) continue;
    const [, mime, b64] = img.d.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/);
    const nombre = `${item.id}-${String(img.v || "1").replace(/[^\w-]/g, "")}.${mime === "jpeg" ? "jpg" : mime}`;
    const file = path.join(PUB, "media", "catalogo", nombre);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(b64, "base64"));
    item.imagen = `/media/catalogo/${nombre}`;
  }
}

// ── 4. sitemap.xml y llms.txt ────────────────────────────────────────────
function sitemap(svcLangs) {
  // Un grupo = la misma página en varios idiomas: cada <url> lista a todas
  const group = (codes, url, xDefault) => {
    const alts = [
      ...codes.map((c) => `    <xhtml:link rel="alternate" hreflang="${c}" href="${url(c)}" />`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}" />`,
    ].join("\n");
    return codes.map((c) => `  <url>
    <loc>${url(c)}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
${alts}
  </url>`).join("\n");
  };
  const urls = [
    group(LANGS.map((l) => l.code), urlOf, `${SITE}/`),
    ...SERVICES.map((s) => group(svcLangs, (c) => svcUrl(s, c), svcUrl(s, svcLangs.includes(DEFAULT) ? DEFAULT : "es"))),
    group(CAT_LANGS, catUrl, catUrl("en")),
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- CDH Maker — mapa del sitio. GENERADO por tools/build-i18n.mjs: no editar.
     La portada y cada página de servicio, una URL por idioma; el panel de
     clientes y el perfil quedan fuera a propósito (ver robots.txt). -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

// llms.txt (llmstxt.org): resumen en Markdown pensado para modelos de
// lenguaje. Va en inglés —lo que más leen los asistentes— con un bloque en
// español, y todo lo variable sale de los diccionarios.
function llmsTxt(en, es, svcEn, svcEs) {
  const p = (s) => plain(s);
  const svc = (d, n) => `${p(d[`s${n}_p`])} (${["a", "b", "c"].map((x) => p(d[`s${n}_${x}`])).join("; ")})`;
  const needs = (d) =>
    Array.from({ length: NEEDS_COUNT }, (_, i) => i + 1).map((n) => `- ${p(d[`n${n}_t`])}: ${p(d[`n${n}_p`])}`).join("\n");
  const faqs = (d) =>
    Array.from({ length: FAQ_COUNT }, (_, i) => i + 1)
      .filter((n) => d[`faq${n}_q`])
      .map((n) => `- **${p(d[`faq${n}_q`])}** ${p(d[`faq${n}_a`])}`).join("\n");
  const projects = PROJECTS.map((x) =>
    x.url ? `- [${x.name}](${x.url}): ${p(en[x.p])}` : `- ${x.name}: ${p(en[x.p])}`).join("\n");
  const pages = LANGS.map((l) => `- [${l.name}](${urlOf(l.code)})`).join("\n");
  // Páginas de servicio: cada una con su descripción y lo que incluye
  const svcPages = (sd, code) => SERVICES.map((s) =>
    `- [${sd[s.id].name}](${svcUrl(s, code)}): ${sd[s.id].meta_desc} ${code === "es" ? "Incluye" : "Includes"}: ${sd[s.id].inc.map(([t]) => t).join("; ")}.`).join("\n");

  // Catálogo: cada línea con precio, plazo y para qué sirve
  const catLlms = (L) => [
    `${L === "es" ? "Página" : "Page"}: ${catUrl(L)}${PROVISIONAL ? ` — ${CAT_T[L].provisional}` : ""}`,
    ...catConItems().map((c) => `\n**${c.nombre[L]}** — ${c.lema[L]}\n` + CATALOGO.filter((x) => x.cat === c.id)
      .map((x) => `- [${x.nombre[L]}](${x.url || `${catUrl(L)}#${x.id}`}): ${precioTexto(x, L)}${catOther(x, L)}. ${x.para[L]} ${CAT_T[L].plazo}: ${x.plazo[L]}.`).join("\n")),
    `\n${PREGUNTAS[L].map(([q, a]) => `- **${q}** ${a}`).join("\n")}`,
  ].join("\n");

  return `# CDH Maker

> CDH Maker is an engineering studio founded by Ing. Henry Taborda in Medellín, Colombia. It builds custom software and SaaS platforms, integrates artificial intelligence, automates processes and delivers digital fabrication (3D printing, laser cutting, CNC machining), electronics and IoT, CAD design and technical consulting. Software, AI and design work is delivered remotely to clients worldwide; physical parts ship anywhere in Colombia. Service in Spanish and English.

- Founder: Ing. Henry Taborda, engineer and maker (GitHub: https://github.com/HenryStark866). Clients talk directly with the person who designs, builds and delivers the project.
- Location: ${ENTITY.address.addressLocality}, ${ENTITY.address.addressRegion}, Colombia. Area served: worldwide (remote) and all of Colombia (shipping of physical parts).
- How to hire: free, no-commitment quote with price and timeline in under 24 hours; work in stages with partial deliveries and milestone payments.
- Contact: WhatsApp or email from ${urlOf("en")}#contacto — email ${ENTITY.email}
- Website: ${SITE}/ (available in ${LANGS.length} languages). It includes a free instant time estimator and an STL 3D viewer: ${urlOf("en")}#herramientas

## Services

${[1, 2, 3, 4].map((n) => `- [${p(en[`s${n}_t`])}](${urlOf("en")}#servicios): ${svc(en, n)}`).join("\n")}

## Service pages

${svcPages(svcEn, "en")}

## Catalog and indicative prices

${catLlms("en")}

## What clients come for

${needs(en)}

## Projects (proof of work)

${projects}

## FAQ

${faqs(en)}

## En español

${p(es.meta_desc)}

${[1, 2, 3, 4].map((n) => `- [${p(es[`s${n}_t`])}](${urlOf("es")}#servicios): ${svc(es, n)}`).join("\n")}

${svcPages(svcEs, "es")}

### Catálogo y precios orientativos

${catLlms("es")}

${faqs(es)}

## Optional

${pages}
`;
}

// ── Principal ────────────────────────────────────────────────────────────
async function main() {
  // 0. El catálogo que se publica es el del CRM (Firestore); sin red, la semilla
  const remoto = process.argv.includes("--sin-crm") ? { origen: "semilla (--sin-crm)", imagenes: [] } : await cargarRemoto();
  escribirImagenesCatalogo(remoto.imagenes);
  console.log(`· catálogo: ${remoto.origen}`);
  // La fuente es la portada en español (public/es.html, servida en /es)
  const indexFile = path.join(PUB, "es.html");
  let index = fs.readFileSync(indexFile, "utf8");

  // 1. es.js ← es.html (el HTML es la fuente del español)
  const es = loadDict("es");
  Object.assign(es, extractSpanish(index));
  writeDict("es", es);

  const report = [];
  const dicts = { es };

  // 2. Portada en español: solo se reescribe su bloque seo
  const indexOut = replaceSeo(index, seoBlock("es", es));
  if (indexOut !== index) fs.writeFileSync(indexFile, indexOut);
  index = indexOut;

  // 3. Una página por cada otro idioma
  for (const { code } of LANGS) {
    if (code === "es") continue;
    const d = loadDict(code);
    dicts[code] = d;
    const missing = new Set();
    // Claves de cabecera y JSON-LD que no viven en el DOM
    for (const k of HEAD_KEYS) if (!(k in d)) missing.add(k);
    const html = translatePage(index, code, d, es, missing);
    fs.writeFileSync(path.join(PUB, homeFile(code)), html);
    report.push({ code, missing: [...missing] });
  }

  // 3b. Páginas por servicio: solo en los idiomas que tienen su archivo
  // tools/servicios/<código>.mjs (una página a medio traducir no se publica)
  const est = readEstimator();
  const svcEsSrc = await loadServiceDict("es");
  const svcDicts = {};
  for (const { code } of LANGS) {
    const src = code === "es" ? svcEsSrc : await loadServiceDict(code);
    if (!Object.keys(src).length) { report.push({ code, missing: [`tools/servicios/${code}.mjs (no existe: sin páginas de servicio)`] }); continue; }
    const missing = new Set();
    svcDicts[code] = withFallback(svcEsSrc, src, missing);
    if (missing.size) report.push({ code, missing: [...missing].map((k) => "servicios:" + k) });
  }
  const svcLangs = LANGS.map((l) => l.code).filter((c) => svcDicts[c]);
  let nSvc = 0;
  for (const code of svcLangs) {
    // Marcadores rellenados en TODO el diccionario: HTML, JSON-LD y llms.txt
    const vars = timeVars(est, svcDicts[code]);
    const fillDeep = (v) => (typeof v === "string" ? fill(v, vars) : Array.isArray(v) ? v.map(fillDeep)
      : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillDeep(x)])));
    const sd = svcDicts[code] = fillDeep(svcDicts[code]);
    const d = { ...es, ...(dicts[code] || {}) };
    const home = code === "es" ? index : translatePage(index, code, dicts[code], es, new Set());
    for (const svc of SERVICES) {
      const file = path.join(PUB, ...svcPath(svc, code).split("/").filter(Boolean)) + ".html";
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buildServicePage(svc, code, home, sd, d, vars, svcLangs));
      nSvc++;
    }
  }

  // 3c. Catálogo con precios (es y en) + public/catalogo.json
  for (const code of CAT_LANGS) {
    const home = code === "es" ? index : translatePage(index, code, dicts[code], es, new Set());
    const file = path.join(PUB, ...catPath(code).split("/").filter(Boolean)) + ".html";
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buildCatalogPage(code, home, { ...es, ...(dicts[code] || {}) }));
  }
  fs.writeFileSync(path.join(PUB, "catalogo.json"), JSON.stringify(catalogoPublico(), null, 2) + "\n");

  // 4. Mapa del sitio y llms.txt
  fs.writeFileSync(path.join(PUB, "sitemap.xml"), sitemap(svcLangs));
  fs.writeFileSync(path.join(PUB, "llms.txt"), llmsTxt({ ...es, ...dicts.en }, es, svcDicts.en || svcDicts.es, svcDicts.es));

  // Reporte
  let faltan = 0;
  for (const r of report) {
    if (!r.missing.length) continue;
    faltan += r.missing.length;
    console.warn(`⚠ ${r.code}: ${r.missing.length} clave(s) sin traducir (quedan en español): ${r.missing.join(", ")}`);
  }
  console.log(`✓ ${LANGS.length} portadas, ${nSvc} páginas de servicio, catálogo (es/en), sitemap.xml y llms.txt generados (${BUILD_DATE}).`);
  if (faltan && STRICT) {
    console.error("✗ --strict: hay traducciones faltantes.");
    process.exit(1);
  }
}

await main();
