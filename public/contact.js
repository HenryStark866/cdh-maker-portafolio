/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — contact.js
   Contacto público: WhatsApp y correo, sin cuenta ni inicio de sesión.

   El número y el correo no viajan en texto plano en el código fuente (cifrado
   de desplazamiento Shift-3, igual que antes): así evitamos que bots de spam
   los recolecten escaneando el HTML. Pero a diferencia del sistema anterior,
   el enlace se arma para CUALQUIER visitante — no hace falta iniciar sesión.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const _d = (s) => {
    try {
      return s.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
    } catch {
      return "";
    }
  };
  const waNumber = () => _d("8:6578:9<:7;");
  const email = () => _d("fgkpdnhuCjpdlo1frp");

  // Todos los botones llaman a waUrl() en el momento del clic: aquí se marca el
  // contacto para el panel (ref.js, sin datos personales) y, si el visitante
  // llegó por un afiliado (?ref=), el código viaja al final del mensaje.
  const waUrl = (msg) => {
    const n = waNumber();
    const R = window.CDH_REF;
    if (R) {
      try {
        const svc = /^Servicio: (.+)$/m.exec(msg || "");
        R.contacto(null, { servicio: svc ? svc[1] : "" });
        const codigo = R.codigo();
        if (codigo) msg = (msg ? msg + "\n\n" : "") + "Ref: " + codigo;
      } catch (_) { }
    }
    const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
    return n ? `https://wa.me/${n}${q}` : "#";
  };
  const mailUrl = (subject) => {
    const e = email();
    if (!e) return "#";
    const s = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return `mailto:${e}${s}`;
  };

  // Conecta los botones de contacto de la página (WhatsApp / correo).
  // El href queda en '#' a propósito (no se ve el número al pasar el mouse
  // o ver el código fuente): la URL real se arma recién al hacer clic.
  function wire() {
    document.querySelectorAll("[data-contact='wa']").forEach((a) => {
      a.href = "#";
      a.onclick = (e) => {
        e.preventDefault();
        window.open(
          waUrl("Hola CDH Maker, vengo de su página web y quiero información sobre sus servicios."),
          "_blank",
          "noopener,noreferrer"
        );
      };
    });
    document.querySelectorAll("[data-contact='mail']").forEach((a) => {
      a.href = "#";
      a.onclick = (e) => {
        e.preventDefault();
        if (window.CDH_REF) try { window.CDH_REF.contacto("web_correo"); } catch (_) { }
        window.location.href = mailUrl("Proyecto con CDH Maker");
      };
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  // API pública: la usa chat-widget.js para armar el enlace de WhatsApp
  window.CDH_CONTACT = { waUrl, mailUrl };
})();
