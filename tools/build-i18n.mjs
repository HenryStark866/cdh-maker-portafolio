#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/build-i18n.mjs
   Genera una página estática por idioma para buscadores y asistentes de IA.

   Por qué existe: los rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot…)
   casi nunca ejecutan JavaScript, así que una traducción hecha en el
   navegador no existe para ellos. Este script deja cada idioma escrito en su
   propio HTML, con su URL, sus metadatos y sus datos estructurados.

   Qué hace (sin dependencias, solo Node ≥ 18):
     1. Lee public/index.html (la fuente: el sitio en español) y sincroniza
        public/i18n/es.js con sus textos — el HTML manda, el diccionario sigue.
     2. Rellena el bloque <!-- seo:start --> … <!-- seo:end --> de cada página:
        title, description, canonical, hreflang, Open Graph, Twitter y JSON-LD
        (organización, fundador, servicios, proyectos y preguntas frecuentes),
        todo sacado del diccionario del idioma.
     3. Escribe public/<código>.html para los otros 9 idiomas (Firebase con
        cleanUrls los sirve en /en, /pt, /fr…), con el cuerpo ya traducido.
     4. Regenera public/sitemap.xml y public/llms.txt.

   Uso:  node tools/build-i18n.mjs            (avisa si faltan traducciones)
         node tools/build-i18n.mjs --strict   (falla si falta alguna)
   El deploy de Firebase lo corre solo (firebase.json → hosting.predeploy).

   Archivos que este script ESCRIBE (no editarlos a mano):
     public/{en,zh,hi,ar,pt,bn,ru,fr,id}.html, public/sitemap.xml,
     public/llms.txt, public/i18n/es.js (solo las claves presentes en el HTML)
     y el bloque seo de public/index.html.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-14
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

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
// El español es la portada ("/"); el resto vive en "/<código>".
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
  { name: "A Tiempo Logística", url: "https://atiempo-logistica.vercel.app", t: "pj_at_t", p: "pj_at_p" },
  { name: "TaxiYa", url: "https://taxiya.vercel.app", t: "pj_taxi_t", p: "pj_taxi_p" },
  { name: "IncubApp", url: "https://incubant-app.vercel.app", t: "pj_inc_t", p: "pj_inc_p" },
  { name: "EvaIA", t: "pj_eva_t", p: "pj_eva_p" },
  { name: "SIGI", t: "pj_sigi_t", p: "pj_sigi_p" },
  // El autodiagnóstico Ley 1581 del reto CAVALTEC es el mismo PrivacyCheck,
  // hecho con el equipo Sintaxis TI: no se lista dos veces ni como obra solo propia.
];
const FAQ_COUNT = 9;   // faq1_q … faq9_q
// Claves que solo usan la cabecera y el JSON-LD (no aparecen en el <body>)
const HEAD_KEYS = ["meta_title", "meta_desc", "person_job"];
const NEEDS_COUNT = 8; // n1_t … n8_t
// ════════════════════════════════════════════════════════════════════════

const BUILD_DATE = new Date().toISOString().slice(0, 10);
const urlOf = (code) => (code === "es" ? `${SITE}/` : `${SITE}/${code}`);

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

// ── 1. Sincronizar es.js con index.html ──────────────────────────────────
function extractSpanish(html) {
  const found = {};
  walkI18n(html, ({ key, kind, inner }) => {
    let v;
    if (kind === "html") v = squash(inner);
    else if (kind === "text") v = squash(decode(inner.replace(/<[^>]+>/g, "")));
    else v = squash(inner);
    if (key in found && found[key] !== v) {
      throw new Error(`La clave "${key}" aparece con textos distintos en index.html:\n  «${found[key]}»\n  «${v}»`);
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
    hasOfferCatalog: { "@type": "OfferCatalog", name: plain(d.nav_serv), itemListElement: services },
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
    throw new Error(`index.html debe tener exactamente un bloque "<!-- seo:start" … "<!-- seo:end -->" (tiene ${n})`);
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
  // Fila de idiomas del footer: marcar como actual el de esta página
  html = html
    .replace(/(<a href="\/" hreflang="es"[^>]*?) aria-current="page"/, "$1")
    .replace(new RegExp(`(<a href="/${code}" hreflang="${code}"[^>]*?)>`), `$1 aria-current="page">`);
  // El comentario de cabecera describe index.html: se cambia por un aviso
  html = html.replace(
    /^(<!DOCTYPE html>\s*)<!--[\s\S]*?-->/i,
    `$1<!-- GENERADO por tools/build-i18n.mjs a partir de index.html + i18n/${code}.js.\n     No editar: los cambios se pierden en el próximo build. -->`
  );
  return html;
}

// ── 4. sitemap.xml y llms.txt ────────────────────────────────────────────
function sitemap() {
  const alts = [
    ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${urlOf(l.code)}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
  ].join("\n");
  const urls = LANGS.map((l) => `  <url>
    <loc>${urlOf(l.code)}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
${alts}
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- CDH Maker — mapa del sitio. GENERADO por tools/build-i18n.mjs: no editar.
     Una página por idioma; el panel de clientes y el perfil quedan fuera a
     propósito (ver robots.txt). -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

// llms.txt (llmstxt.org): resumen en Markdown pensado para modelos de
// lenguaje. Va en inglés —lo que más leen los asistentes— con un bloque en
// español, y todo lo variable sale de los diccionarios.
function llmsTxt(en, es) {
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

  return `# CDH Maker

> CDH Maker is an engineering studio founded by Ing. Henry Taborda in Medellín, Colombia. It builds custom software and SaaS platforms, integrates artificial intelligence, automates processes and delivers digital fabrication (3D printing, laser cutting, CNC machining), electronics and IoT, CAD design and technical consulting. Software, AI and design work is delivered remotely to clients worldwide; physical parts ship anywhere in Colombia. Service in Spanish and English.

- Founder: Ing. Henry Taborda, engineer and maker (GitHub: https://github.com/HenryStark866). Clients talk directly with the person who designs, builds and delivers the project.
- Location: ${ENTITY.address.addressLocality}, ${ENTITY.address.addressRegion}, Colombia. Area served: worldwide (remote) and all of Colombia (shipping of physical parts).
- How to hire: free, no-commitment quote with price and timeline in under 24 hours; work in stages with partial deliveries and milestone payments.
- Contact: WhatsApp or email from ${urlOf("en")}#contacto — email ${ENTITY.email}
- Website: ${SITE}/ (available in ${LANGS.length} languages). It includes a free instant time estimator and an STL 3D viewer: ${urlOf("en")}#herramientas

## Services

${[1, 2, 3, 4].map((n) => `- [${p(en[`s${n}_t`])}](${urlOf("en")}#servicios): ${svc(en, n)}`).join("\n")}

## What clients come for

${needs(en)}

## Projects (proof of work)

${projects}

## FAQ

${faqs(en)}

## En español

${p(es.meta_desc)}

${[1, 2, 3, 4].map((n) => `- [${p(es[`s${n}_t`])}](${urlOf("es")}#servicios): ${svc(es, n)}`).join("\n")}

${faqs(es)}

## Optional

${pages}
`;
}

// ── Principal ────────────────────────────────────────────────────────────
function main() {
  const indexFile = path.join(PUB, "index.html");
  let index = fs.readFileSync(indexFile, "utf8");

  // 1. es.js ← index.html (el HTML es la fuente del español)
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
    fs.writeFileSync(path.join(PUB, `${code}.html`), html);
    report.push({ code, missing: [...missing] });
  }

  // 4. Mapa del sitio y llms.txt
  fs.writeFileSync(path.join(PUB, "sitemap.xml"), sitemap());
  fs.writeFileSync(path.join(PUB, "llms.txt"), llmsTxt({ ...es, ...dicts.en }, es));

  // Reporte
  let faltan = 0;
  for (const r of report) {
    if (!r.missing.length) continue;
    faltan += r.missing.length;
    console.warn(`⚠ ${r.code}: ${r.missing.length} clave(s) sin traducir (quedan en español): ${r.missing.join(", ")}`);
  }
  console.log(`✓ ${LANGS.length} páginas, sitemap.xml y llms.txt generados (${BUILD_DATE}).`);
  if (faltan && STRICT) {
    console.error("✗ --strict: hay traducciones faltantes.");
    process.exit(1);
  }
}

main();
