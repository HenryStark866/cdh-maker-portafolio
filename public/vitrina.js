/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — vitrina.js
   Vitrina de la portada (#vitrina): todos los productos y servicios del
   catálogo, con filtros por categoría, estado (en producción / demo / en
   desarrollo), precio de referencia, enlace a la demo o a la página del
   servicio y botón para cotizar por WhatsApp.

   Datos: window.CDH_CATALOGO() (catalogo-vivo.js): lo que hay HOY en el CRM
   (Firestore) con /catalogo.json del último deploy de respaldo. El HTML trae
   las mismas tarjetas escritas por tools/build-i18n.mjs (vitrina:start …
   vitrina:end) para buscadores, asistentes de IA y visitantes sin JS; este
   script las vuelve a pintar con el catálogo vivo y les da los filtros.

   Textos de la interfaz: los spans de .vt-txt (data-i18n, se traducen con el
   resto de la página). Nombres, descripciones y precios: del catálogo, en
   español en /es y en inglés en los demás idiomas (el catálogo solo tiene
   esos dos).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const sec = document.getElementById("vitrina");
  if (!sec) return;
  const grid = sec.querySelector(".vt-grid");
  const barra = sec.querySelector(".vt-filtros");
  const mas = sec.querySelector(".vt-mas");
  if (!grid || !barra) return;

  const LIMITE = 8; // tarjetas en «Todo» antes de «Ver N más»
  // Páginas de servicio: la ruta en español → el slug de los demás idiomas
  const SVC = {
    "/servicios/software-a-la-medida-medellin": "custom-software-medellin",
    "/servicios/inteligencia-artificial-medellin": "ai-integration-medellin",
    "/servicios/impresion-3d-medellin": "3d-printing-medellin",
    "/servicios/iot-automatizacion-medellin": "iot-automation-medellin",
  };
  const ESTADOS = { produccion: "prod", demo: "demo", desarrollo: "dev" }; // clase vt-st-<x>; texto en .vt-txt [data-k="st_<x>"]
  const WA_SVG = '<svg class="i-wa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" /></svg>';

  const lang = () => (document.documentElement.getAttribute("lang") || "es").slice(0, 2);
  const L = () => (lang() === "es" ? "es" : "en");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tx = (o) => (o && (o[L()] || o.es)) || "";
  const txt = (k) => { const n = sec.querySelector(`.vt-txt [data-k="${k}"]`); return n ? n.textContent.trim() : ""; };
  const segura = (u) => {
    if (typeof u !== "string" || !u) return "";
    if (/^\/[^/]/.test(u)) return u;
    try { return new URL(u).protocol === "https:" ? u : ""; } catch (e) { return ""; }
  };
  const pagina = (p) => (lang() === "es" || !SVC[p] ? p : `/${lang()}/services/${SVC[p]}`);
  const catalogo = () => (L() === "es" ? "/catalogo" : "/en/catalog");

  // Productos propios primero (en producción → demo → en desarrollo), luego
  // los servicios recomendados y después el resto, en el orden del catálogo
  function ordenar(items) {
    const est = { produccion: 0, demo: 1, desarrollo: 2 };
    const rango = (x) => (x.cat === "productos" ? (est[x.estado] ?? 3) : x.destacado ? 10 : 20);
    return items.map((x, i) => ({ x, i })).sort((a, b) => rango(a.x) - rango(b.x) || a.i - b.i).map((o) => o.x);
  }

  function nombreCat(id, cats) {
    const b = barra.querySelector(`[data-vt-cat="${id}"] [data-i18n]`);
    if (b) return b.textContent.trim();
    const c = (cats || []).find((c) => c.id === id);
    return c ? tx(c.nombre) : id;
  }

  // La misma tarjeta que escribe tools/build-i18n.mjs (vtCard)
  function tarjeta(x, cats) {
    const nombre = tx(x.nombre);
    const estado = ESTADOS[x.estado];
    const links = [];
    const url = segura(x.url), demo = segura(x.demo), pag = segura(x.pagina);
    if (url) links.push(`<a class="vt-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(txt("abrir"))} ↗</a>`);
    if (demo) links.push(`<a class="vt-link" href="${esc(demo)}" target="_blank" rel="noopener">${esc(txt(/\.mp4$/i.test(demo) ? "video" : "demo"))} ↗</a>`);
    if (pag) links.push(`<a class="vt-link" href="${esc(pagina(pag))}">${esc(txt("pagina"))} →</a>`);
    else if (!url) links.push(`<a class="vt-link" href="${catalogo()}#${esc(x.id)}">${esc(txt("detalle"))} →</a>`);
    const precio = (x.precio_texto || {})[L()] || "";
    return `<article class="vt-card${x.destacado ? " is-dest" : ""}" data-cat="${esc(x.cat)}" data-id="${esc(x.id)}">
  <div class="vt-top"><span class="vt-cat">${esc(nombreCat(x.cat, cats))}</span>${estado ? `<span class="vt-st vt-st-${estado}">${esc(txt("st_" + estado))}</span>` : ""}</div>
  <h3>${esc(nombre)}</h3>
  <p class="vt-para">${esc(tx(x.para))}</p>
  <p class="vt-precio"><strong>${esc(precio)}</strong>${tx(x.plazo) ? `<span>${esc(tx(x.plazo))}</span>` : ""}</p>
  <div class="vt-acts"><a class="btn btn-primary btn-sm vt-wa" href="#contacto" data-vt-wa="${esc(nombre)}">${WA_SVG}<span>${esc(txt(x.cat === "productos" ? "wa_p" : "wa"))}</span></a>${links.slice(0, 2).join("")}</div>
</article>`;
  }

  let actual = "";
  let abierto = false;

  function aplicarFiltro() {
    const cards = [...grid.querySelectorAll(".vt-card")];
    let visibles = 0, ocultas = 0;
    cards.forEach((c) => {
      const ok = !actual || c.dataset.cat === actual;
      let ver = ok;
      if (ok && !actual && !abierto) {
        visibles++;
        if (visibles > LIMITE) { ver = false; ocultas++; }
      }
      c.hidden = !ver;
    });
    barra.querySelectorAll("[data-vt-cat]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vtCat === actual)));
    if (mas) {
      mas.hidden = !ocultas;
      const n = mas.querySelector(".vt-mas-l");
      if (n) n.textContent = (txt("mas") || "+{n}").replace("{n}", ocultas);
    }
  }

  function contar() {
    const n = {};
    grid.querySelectorAll(".vt-card").forEach((c) => { n[c.dataset.cat] = (n[c.dataset.cat] || 0) + 1; });
    barra.querySelectorAll("[data-vt-cat]").forEach((b) => {
      const id = b.dataset.vtCat;
      const k = id ? n[id] || 0 : Object.values(n).reduce((a, v) => a + v, 0);
      const s = b.querySelector(".vt-n");
      if (s) s.textContent = k;
      b.hidden = !k;
    });
    if (actual && !n[actual]) actual = "";
  }

  let datos = null;
  function pintar() {
    if (datos && datos.items && datos.items.length) {
      // Categorías nuevas creadas en el CRM: su botón, con el nombre del catálogo
      for (const c of datos.categorias || []) {
        if (barra.querySelector(`[data-vt-cat="${CSS.escape(c.id)}"]`)) continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vt-f";
        b.dataset.vtCat = c.id;
        b.setAttribute("aria-pressed", "false");
        b.innerHTML = `<span>${esc(tx(c.nombre))}</span> <span class="vt-n"></span>`;
        barra.appendChild(b);
      }
      grid.innerHTML = ordenar(datos.items).map((x) => tarjeta(x, datos.categorias)).join("\n");
      sec.dataset.vivo = datos.vivo ? "1" : "0";
    }
    contar();
    aplicarFiltro();
  }

  barra.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vt-cat]");
    if (!b) return;
    actual = b.dataset.vtCat;
    aplicarFiltro();
  });
  if (mas) mas.addEventListener("click", () => { abierto = true; aplicarFiltro(); });

  grid.addEventListener("click", (e) => {
    const a = e.target.closest("[data-vt-wa]");
    if (!a || !window.CDH_CONTACT) return;
    e.preventDefault();
    const nombre = a.dataset.vtWa;
    const msg = (txt("msg") || "{x}").replace("{x}", nombre) + "\nServicio: " + nombre;
    window.open(window.CDH_CONTACT.waUrl(msg), "_blank", "noopener,noreferrer");
  });

  addEventListener("cdh:langchange", pintar);
  pintar(); // filtros sobre las tarjetas estáticas mientras llega el catálogo

  if (typeof window.CDH_CATALOGO === "function") {
    window.CDH_CATALOGO().then((cat) => {
      if (!cat || !cat.items || !cat.items.length) return;
      datos = cat;
      pintar();
    }).catch(() => { /* quedan las tarjetas del build */ });
  }
})();
