/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — catalogo-pagina.js
   /catalogo y /en/catalog salen como HTML estático del build (es lo que leen
   buscadores y asistentes de IA). Este script compara ese HTML con el
   catálogo vivo del CRM (catalogo-vivo.js) y, si cambió algo después del
   último deploy —un precio, un texto, un producto nuevo o retirado—, repinta
   las tarjetas de cada categoría con lo de hoy. El próximo deploy lo vuelve
   estático. Si Firestore no responde, la página queda tal cual.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const main = document.querySelector("main[data-catalogo]");
  if (!main || typeof window.CDH_CATALOGO !== "function") return;
  const L = main.dataset.catalogo === "en" ? "en" : "es";
  const T = {
    es: { incluye: "Incluye", plazo: "Tiempo", precio: "Precio", pedir: "Cotizar esto", ver: "Ver producto", destacado: "Recomendado", usd: "Fuera de Colombia", desde: "desde " },
    en: { incluye: "Includes", plazo: "Timeline", precio: "Price", pedir: "Get a quote", ver: "See product", destacado: "Recommended", usd: "Outside Colombia", desde: "from " },
  }[L];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tx = (o) => (o && (o[L] || o.es)) || "";
  const httpsOk = (u) => { try { return new URL(u).protocol === "https:" ? u : ""; } catch (e) { return ""; } };

  // Huella de lo que se ve (nombre, texto, precio, plazo, lista, destacado,
  // versión de la imagen): si coincide con el CRM, no se toca nada
  const q = (a, sel) => { const n = a.querySelector(sel); return n ? n.textContent.trim() : ""; };
  const versionImg = (a) => { const i = a.querySelector(".cat-img"); const m = i && (i.getAttribute("src") || "").match(/-(\w+)\.\w+$/); return m ? m[1] : ""; };
  const huellaHTML = () => Array.from(main.querySelectorAll(".cat-item")).map((a) => [a.id, q(a, "h3"), q(a, "h3 + p"), q(a, ".cat-price"),
    q(a, ".cat-meta div:last-child dd"), Array.from(a.querySelectorAll("ul li")).map((li) => li.textContent.trim()).join(";"),
    a.classList.contains("is-featured") ? 1 : 0, versionImg(a)].join("|")).join("\n");
  const huellaItems = (items, prov) => items.map((x) => [x.id, tx(x.nombre), tx(x.para), (x.precio_texto || {})[L] + (prov && !(x.precio && x.precio.gratis) ? "*" : ""),
    tx(x.plazo), ((x.incluye && (x.incluye[L] && x.incluye[L].length ? x.incluye[L] : x.incluye.es)) || []).join(";"),
    x.destacado ? 1 : 0, x.imagen_v ? String(x.imagen_v) : ""].join("|")).join("\n");

  // Imagen grande: la del build si existe; si el CRM la cambió después, se pide aparte
  async function imagenViva(x) {
    try {
      const emu = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu(=|&|$)/.test(location.search);
      const base = emu ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
      const r = await fetch(`${base}/v1/projects/cdh-maker-portafolio/databases/(default)/documents/catalogo_imagenes/${encodeURIComponent(x.id)}`, { credentials: "omit" });
      if (!r.ok) return "";
      const d = await r.json();
      const uri = d.fields && d.fields.d && d.fields.d.stringValue;
      return /^data:image\/(webp|jpeg|png);base64,/.test(uri || "") ? uri : "";
    } catch (e) {
      return "";
    }
  }

  function tarjeta(x, prov) {
    const p = x.precio || {};
    const ast = prov && !p.gratis ? "*" : "";
    const usd = L === "es" && typeof p.usd === "number" && typeof p.cop === "number"
      ? `<small class="cat-usd">${T.usd}: ${p.desde ? T.desde : ""}USD ${esc(p.usd)}</small>` : "";
    const url = httpsOk(x.url);
    const cta = url
      ? `<a class="btn btn-ghost cat-cta" href="${esc(url)}" target="_blank" rel="noopener">${T.ver} ↗</a>`
      : `<a class="btn btn-primary cat-cta" href="#contacto" data-cat-item="${esc(tx(x.nombre))}">${T.pedir}</a>`;
    const inc = (x.incluye && (x.incluye[L] && x.incluye[L].length ? x.incluye[L] : x.incluye.es)) || [];
    const img = x.imagen || x.mini || "";
    return `<article class="card cat-item${x.destacado ? " is-featured" : ""}" id="${esc(x.id)}">
      ${img ? `<img class="cat-img" src="${esc(img)}" alt="${esc(tx(x.nombre))}" loading="lazy" decoding="async" width="640" height="360" />` : ""}
      ${x.destacado ? `<span class="cat-badge">${T.destacado}</span>` : ""}
      <h3>${esc(tx(x.nombre))}</h3>
      <p>${esc(tx(x.para))}</p>
      ${inc.length ? `<p class="cat-inc-t">${T.incluye}</p><ul>${inc.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
      <dl class="cat-meta">
        <div><dt>${T.precio}</dt><dd><strong class="cat-price">${esc((x.precio_texto || {})[L])}${ast}</strong>${usd}</dd></div>
        <div><dt>${T.plazo}</dt><dd>${esc(tx(x.plazo))}</dd></div>
      </dl>
      ${cta}
    </article>`;
  }

  window.CDH_CATALOGO().then(async (cat) => {
    if (!cat || !cat.vivo || !cat.items.length) return;
    if (huellaHTML() === huellaItems(cat.items, cat.provisional)) return; // nada cambió desde el deploy
    // Imágenes cambiadas en el CRM después del build: se piden (solo esas)
    const estaticas = {};
    main.querySelectorAll(".cat-item").forEach((a) => { const i = a.querySelector(".cat-img"); if (i) estaticas[a.id] = i.getAttribute("src"); });
    await Promise.all(cat.items.map(async (x) => {
      const prev = estaticas[x.id] || "";
      const v = String(x.imagen_v || "");
      if (prev && v && prev.includes(`-${v}.`)) { x.imagen = prev; return; }
      if (v) x.imagen = (await imagenViva(x)) || prev;
      else x.imagen = prev;
    }));
    for (const sec of main.querySelectorAll("section[id]")) {
      const grid = sec.querySelector(".cat-grid");
      if (!grid) continue;
      const items = cat.items.filter((x) => x.cat === sec.id);
      grid.innerHTML = items.length ? items.map((x) => tarjeta(x, cat.provisional)).join("") : "";
      sec.hidden = !items.length;
    }
    const nota = main.querySelector(".cat-provisional");
    if (nota) nota.hidden = !cat.provisional;
    main.dataset.vivo = "1";
  });
})();
