/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — ref.js
   Atribución de afiliados: captura ?ref=<codigo> y registra los contactos.

   1. Si la URL trae ?ref=<codigo> (4–20 caracteres [a-z0-9-]) lo guarda en
      localStorage "cdh-ref" como {codigo, ts}. Primer clic gana: si ya hay un
      código vigente (menos de 60 días) no se reemplaza. Luego quita ?ref= de la
      barra de direcciones para que no se comparta por accidente.
   2. Cuando el visitante abre WhatsApp desde el sitio (contact.js llama a
      CDH_REF.contacto()), deja en Firestore un lead mínimo SIN datos personales:
      origen, código de afiliado, página, idioma y servicio. No se envía el texto
      del mensaje ni el número del visitante: eso solo viaja a WhatsApp.
      Va por la API REST de Firestore (sin SDK: unos pocos bytes, no 300 KB).
      Las reglas (firestore.rules → crm_leads) solo permiten CREAR con esos
      campos; nadie anónimo puede leer.
   API: window.CDH_REF = { codigo(), datos(), contacto(origen?, extra?) }
   Lo incluye index.html (y las páginas generadas) con <script src="/ref.js" defer>.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const CLAVE = "cdh-ref";
  const VIGENCIA_MS = 60 * 24 * 3600 * 1000; // 60 días
  const RE_CODIGO = /^[a-z0-9-]{4,20}$/;
  const PROYECTO = "cdh-maker-portafolio";
  const API_KEY = "AIzaSyCmeLzxeK_TUHkmKu3G81oKyW6Bg3B-iS0"; // clave web pública (la seguridad está en las reglas)
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // En local solo se escribe si se pide ?emu (emulador); nunca contra producción.
  const EMU = LOCAL && /[?&]emu\b/.test(location.search + (sessionStorage.getItem("cdh-emu") ? "&emu" : ""));
  const ORIGENES = ["web_widget", "web_whatsapp", "web_correo", "web_cotizador", "web_visor3d"];

  const leer = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if (v && RE_CODIGO.test(v.codigo) && typeof v.ts === "number" && Date.now() - v.ts < VIGENCIA_MS) return v;
    } catch (_) { /* almacenamiento bloqueado o dato corrupto */ }
    return null;
  };

  // ── 1. Captura de ?ref= ───────────────────────────────────────────────────
  try {
    if (EMU) sessionStorage.setItem("cdh-emu", "1");
    const url = new URL(location.href);
    const crudo = (url.searchParams.get("ref") || "").trim().toLowerCase();
    if (crudo) {
      if (RE_CODIGO.test(crudo) && !leer()) {
        try { localStorage.setItem(CLAVE, JSON.stringify({ codigo: crudo, ts: Date.now() })); } catch (_) { }
      }
      url.searchParams.delete("ref");
      const qs = url.searchParams.toString().replace(/=(?=&|$)/g, ""); // ?emu= → ?emu
      history.replaceState(history.state, "", url.pathname + (qs ? "?" + qs : "") + url.hash);
    }
  } catch (_) { }

  // ── 2. Origen del contacto: según el último botón pulsado ──────────────────
  let ultimoOrigen = "web_whatsapp";
  document.addEventListener("click", (e) => {
    const el = e.target && e.target.closest ? e.target : null;
    if (!el) return;
    if (el.closest("#cdh-chat")) ultimoOrigen = "web_widget";
    else if (el.closest("#cdh-estimator, #estimatorModal")) ultimoOrigen = "web_cotizador";
    else if (el.closest("#viewerWaBtn")) ultimoOrigen = "web_visor3d";
    else if (el.closest("[data-contact='mail']")) ultimoOrigen = "web_correo";
    else if (el.closest("[data-contact='wa']")) ultimoOrigen = "web_whatsapp";
  }, true);

  const idioma = () => {
    const l = (document.documentElement.lang || "es").slice(0, 2).toLowerCase();
    return /^[a-z]{2}$/.test(l) ? l : "es";
  };

  const enviados = {};
  function contacto(origen, extra) {
    const o = ORIGENES.includes(origen) ? origen : ultimoOrigen;
    // un registro por origen cada 30 s (doble clic, reintentos)
    if (enviados[o] && Date.now() - enviados[o] < 30000) return;
    enviados[o] = Date.now();
    if (LOCAL && !EMU) return; // en desarrollo sin emulador no se escribe nada
    const r = leer();
    const servicio = extra && typeof extra.servicio === "string" ? extra.servicio.slice(0, 60) : "";
    const campos = {
      origen: { stringValue: o },
      estado: { stringValue: "nuevo" },
      ref: r ? { stringValue: r.codigo } : { nullValue: null },
      ref_ts: r ? { integerValue: String(r.ts) } : { nullValue: null },
      pagina: { stringValue: location.pathname.slice(0, 200) },
      idioma: { stringValue: idioma() },
      servicio: { stringValue: servicio },
    };
    const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, "0")).join("");
    const base = EMU ? "http://127.0.0.1:8080/v1" : "https://firestore.googleapis.com/v1";
    const raiz = `projects/${PROYECTO}/databases/(default)/documents`;
    const cuerpo = {
      writes: [{
        update: { name: `${raiz}/crm_leads/${id}`, fields: campos },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: "creado", setToServerValue: "REQUEST_TIME" }],
      }],
    };
    try {
      fetch(`${base}/${raiz}:commit?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        keepalive: true,
        credentials: "omit",
      }).catch(() => { });
    } catch (_) { /* nunca romper el botón de WhatsApp */ }
  }

  window.CDH_REF = {
    codigo: () => (leer() || {}).codigo || null,
    datos: leer,
    contacto,
  };
})();
