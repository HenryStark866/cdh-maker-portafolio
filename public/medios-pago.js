/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — medios-pago.js
   Sección pública «Medios de pago» de la portada (#pagos): dibuja los QR
   Bre-B y el botón «Copiar llave».

   Los datos son públicos por decisión de Henry y son los mismos de
   crm/pagos.js (MEDIOS_BASE). Este archivo NO importa el CRM (que depende de
   Firebase y de la sesión de administrador): duplica solo el contenido de los
   QR y la función que los dibuja. Si cambia una llave o un QR, se cambia en
   los dos lugares (y en el texto estático de #pagos en es.html).

   El dibujo del QR es el de crm/pagos.js → qrSVG, con los mismos parámetros
   verificados con lectores reales: qrcode-generator 1.4.4, versión automática,
   corrección de errores M, módulos cuadrados, margen de 4 módulos, ojos con
   la tinta de la marca y el lobo al centro (tapa menos del 2 % del código).
   NO cambiar esos parámetros: así se leen.

   La librería (≈ 20 KB) solo se descarga cuando la sección se acerca a la
   pantalla. Sin JavaScript, la llave sigue visible para copiarla a mano.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const sec = document.getElementById("pagos");
  if (!sec) return;

  // Contenido exacto de cada QR (cadena EMVCo de Bre-B con su CRC): el mismo de crm/pagos.js
  const MEDIOS = {
    "breb-bancolombia": "00020101021126320014CO.COM.RBM.LLA0410@henry986649250014CO.COM.RBM.RED0103RBM50310013CO.COM.RBM.CU0110000000000051220013CO.COM.RBM.CA010105204000053031705802CO59010600106101062270710CC3CA115EA080200110363180270016CO.COM.RBM.CANAL0103APP81250015CO.COM.RBM.CIVA01020282260014CO.COM.RBM.IVA01040.0083270015CO.COM.RBM.BASE01040.0084250015CO.COM.RBM.CINC01020285260014CO.COM.RBM.INC01040.0090430016CO.COM.RBM.TRXID0119000001eUqMs6dG7C_1991460014CO.COM.RBM.SEC0124s8sGvdPw7/cKrOVG/qOzJ/1A6304E3E5",
    "breb-nequi-negocios": "00020101021126320014CO.COM.RBM.LLA0510008944390249250014CO.COM.RBM.RED0103RBM50310013CO.COM.RBM.CU0110008944390251250013CO.COM.RBM.CA010499995204999953031705802CO5922CDH MAKER HENRY TABORD60050500161050500162200703000080200110363180270016CO.COM.RBM.CANAL0103APP81250015CO.COM.RBM.CIVA01020382260014CO.COM.RBM.IVA01040.0083270015CO.COM.RBM.BASE01040.0084250015CO.COM.RBM.CINC01020385260014CO.COM.RBM.INC01040.0090430016CO.COM.RBM.TRXID011900000002E5cXGVRpIdf91460014CO.COM.RBM.SEC0124kS+7yLlc80o31iIjlfogq8/i6304BE4D",
  };
  const LIB = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";

  let libP = null;
  function cargarLib() {
    if (window.qrcode) return Promise.resolve();
    if (!libP) {
      libP = new Promise((ok, mal) => {
        const s = document.createElement("script");
        s.src = LIB;
        s.async = true;
        s.onload = ok;
        s.onerror = () => { libP = null; s.remove(); mal(new Error("No se pudo cargar " + LIB)); };
        document.head.appendChild(s);
      });
    }
    return libP;
  }

  // El lobo de la marca sobre su cuadro noche (viewBox 0 0 100 100)
  const LOBO = '<rect width="100" height="100" rx="22" fill="#0A0F17"/><g transform="translate(14 12.5) scale(0.72)">' +
    '<g fill="none" stroke="#E9EDF2" stroke-width="6.4" stroke-linejoin="round" stroke-linecap="round"><path d="M16 2L37 25H63L84 2L90 41L97 56L84 69V81L50 98L16 81V69L3 56L10 41Z"/><path d="M59 35H73L84 69L50 82"/><path d="M50 82V98"/></g>' +
    '<g fill="none" stroke="#22D3EE" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M41 35H27L16 69L50 82"/></g>' +
    '<path d="M42 60H58L54 66H46Z" fill="#E9EDF2"/><path d="M27 39L41 42.5L43 48L31.5 45.5Z" fill="#3BA4E6"/><path d="M73 39L59 42.5L57 48L68.5 45.5Z" fill="#3BA4E6"/></g>';

  // Igual que crm/pagos.js → qrSVG (módulos cuadrados, margen 4, corrección M)
  function qrSVG(texto, etiqueta) {
    const tinta = "#060B14", ec = "M";
    const qr = window.qrcode(0, ec);
    qr.addData(texto, "Byte");
    qr.make();
    const n = qr.getModuleCount(), q = 4, T = n + 2 * q;
    const ojos = [[0, 0], [0, n - 7], [n - 7, 0]];
    const enOjo = (r, c) => ojos.some(([y, x]) => r >= y - 1 && r <= y + 7 && c >= x - 1 && c <= x + 7);
    const k = Math.max(7, Math.round(n * 0.14) | 1), c0 = (n - k) / 2;
    const enLogo = (r, c) => r >= c0 - 0.5 && r < c0 + k + 0.5 && c >= c0 - 0.5 && c < c0 + k + 0.5;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || enOjo(r, c) || enLogo(r, c)) continue;
      let l = 0;
      while (c + l + 1 < n && qr.isDark(r, c + l + 1) && !enOjo(r, c + l + 1) && !enLogo(r, c + l + 1)) l++;
      d += `M${c + q} ${r + q}h${l + 1}v1h-${l + 1}z`;
      c += l;
    }
    const ojo = ([y, x]) => `<rect x="${x + q + 0.5}" y="${y + q + 0.5}" width="6" height="6" fill="none" stroke="${tinta}"/><rect x="${x + q + 2}" y="${y + q + 2}" width="3" height="3" fill="${tinta}"/>`;
    const x = c0 + q - 0.25, t = k + 0.5;
    const centro = `<rect x="${x - 0.6}" y="${x - 0.6}" width="${t + 1.2}" height="${t + 1.2}" rx="${t * 0.26}" fill="#fff"/>` +
      `<svg x="${x}" y="${x}" width="${t}" height="${t}" viewBox="0 0 100 100">${LOBO}</svg>`;
    const aria = String(etiqueta || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" role="img" aria-label="${aria}">` +
      `<rect width="${T}" height="${T}" rx="${T * 0.04}" fill="#fff"/><path d="${d}" fill="${tinta}" shape-rendering="crispEdges"/>${ojos.map(ojo).join("")}${centro}</svg>`;
  }

  let dibujados = false;
  async function dibujar() {
    if (dibujados) return;
    dibujados = true;
    try {
      await cargarLib();
    } catch (e) {
      dibujados = false;
      sec.querySelectorAll(".pago-qr").forEach((b) => b.classList.add("is-error"));
      return;
    }
    sec.querySelectorAll("[data-medio]").forEach((card) => {
      const payload = MEDIOS[card.dataset.medio];
      const caja = card.querySelector(".pago-qr");
      if (!payload || !caja) return;
      const etiqueta = (caja.getAttribute("data-aria") || "") + " · " + (card.querySelector(".pago-ent")?.textContent || "").trim();
      caja.innerHTML = qrSVG(payload, etiqueta);
      caja.classList.add("is-listo");
    });
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); dibujar(); }
    }, { rootMargin: "600px 0px" });
    io.observe(sec);
  } else {
    dibujar();
  }
  // Quien llega por /#pagos lo ve de inmediato
  if (location.hash === "#pagos") dibujar();
  addEventListener("hashchange", () => { if (location.hash === "#pagos") dibujar(); });

  // Copiar llave (con respaldo para navegadores sin API de portapapeles)
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  sec.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const ok = await copiar(b.dataset.copiar);
    const l = b.querySelector("span") || b;
    if (!b.dataset.txt) b.dataset.txt = l.textContent;
    const listo = sec.querySelector('.pago-txt [data-k="copiada"]');
    l.textContent = ok ? (listo ? listo.textContent : "✓") : b.dataset.copiar;
    b.classList.toggle("is-ok", ok);
    clearTimeout(b._t);
    b._t = setTimeout(() => { l.textContent = b.dataset.txt; b.classList.remove("is-ok"); }, 2200);
  });
})();
