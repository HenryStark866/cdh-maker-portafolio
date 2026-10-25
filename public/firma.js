/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — firma.js
   Portal de firma electrónica (firma.html).

   Flujo para el cliente:
     1. Abre /firma#<token> y escribe el código que recibió por otro canal.
     2. El navegador descarga /e/<token>.json y lo descifra (AES-GCM con clave
        PBKDF2 derivada de código + token). Sin el código no hay contenido.
     3. Bienvenida (carta + video) → Condiciones (contrato, acuerdo de firma
        electrónica y aviso de privacidad: leer completo y aceptar) → Firma
        (acta y plan de pago: solo se habilitan con las condiciones aceptadas
        y el documento leído completo) → Descargas con constancia.

   Cada lectura, aceptación y firma es un evento en Firestore:
     firmas/{expediente}/eventos/{lectura-<doc> | condiciones | firma-<doc>}
   donde expediente = SHA-256(token:código). firestore.rules exige el orden
   (no se puede firmar sin las condiciones y la lectura), pone la hora del
   servidor y prohíbe editar o borrar eventos.

   Modo local de pruebas: http://localhost:<puerto>/firma?local#<token> guarda
   los eventos en localStorage en vez de Firestore.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const PROYECTO = "cdh-maker-portafolio";
  const API_KEY = "AIzaSyCmeLzxeK_TUHkmKu3G81oKyW6Bg3B-iS0"; // clave web pública (la misma de auth.js)
  const RAIZ = `projects/${PROYECTO}/databases/(default)/documents`;
  const FS = `https://firestore.googleapis.com/v1/${RAIZ}`;
  // Documentos que hay que leer y aceptar antes de firmar. Debe coincidir con
  // la regla "condiciones" de firestore.rules.
  const REQUERIDOS = ["contrato", "firmaelec", "privacidad"];
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
    new URLSearchParams(location.search).has("local");

  const $app = document.getElementById("app");
  const $visor = document.getElementById("visor");
  const $marco = document.getElementById("visorMarco");
  const $barra = document.getElementById("visorBarra");
  const $pie = document.getElementById("visorPie");

  const S = {
    token: location.hash.slice(1).replace(/[^A-Za-z0-9_-]/g, ""),
    exp: "",
    paquete: null,
    eventos: {},
    alterados: new Set(),
    ui: { checks: {}, nombre: "", cedula: "", cargo: "", referencia: false, error: "", ocupado: false },
    intentos: 0,
  };

  // ───────────────────────── utilidades ─────────────────────────
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const sha256 = async (txt) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)));
  const normCodigo = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ua = () => navigator.userAgent.slice(0, 400);
  const fecha = (iso) => iso ? new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota", dateStyle: "long", timeStyle: "medium",
  }) + " (hora de Colombia)" : "";
  const docs = (rol) => S.paquete.documentos.filter((d) => !rol || d.rol === rol);
  const doc = (id) => S.paquete.documentos.find((d) => d.id === id);
  const ev = (id) => S.eventos[id];

  // ───────────────────────── cifrado ─────────────────────────
  async function descifrar(sobre, codigo) {
    const base = await crypto.subtle.importKey("raw",
      new TextEncoder().encode(`${codigo}:${S.token}`), "PBKDF2", false, ["deriveKey"]);
    const clave = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: b64(sobre.salt), iterations: sobre.iter },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(sobre.iv) }, clave, b64(sobre.ct));
    return JSON.parse(new TextDecoder().decode(plano));
  }

  // ───────────────────────── registro de eventos ─────────────────────────
  const enc = (v) => typeof v === "string" ? { stringValue: v }
    : typeof v === "boolean" ? { booleanValue: v }
    : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  const dec = (f) => "stringValue" in f ? f.stringValue
    : "booleanValue" in f ? f.booleanValue
    : "timestampValue" in f ? f.timestampValue
    : "mapValue" in f ? decCampos(f.mapValue.fields || {}) : null;
  const decCampos = (fields) => Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, dec(f)]));

  const registro = LOCAL ? {
    async listar() { return JSON.parse(localStorage.getItem(`firma-local-${S.exp}`) || "{}"); },
    async crear(id, datos) {
      const todo = await this.listar();
      if (todo[id]) throw new Error("ya-existe");
      todo[id] = { ...datos, at: new Date().toISOString() };
      localStorage.setItem(`firma-local-${S.exp}`, JSON.stringify(todo));
    },
  } : {
    async listar() {
      const r = await fetch(`${FS}/firmas/${S.exp}/eventos?pageSize=100&key=${API_KEY}`);
      if (!r.ok) throw new Error(`No se pudo leer el registro (${r.status})`);
      const j = await r.json();
      return Object.fromEntries((j.documents || []).map((d) => [d.name.split("/").pop(), decCampos(d.fields || {})]));
    },
    async crear(id, datos) {
      const r = await fetch(`${FS}:commit?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writes: [{
          update: { name: `${RAIZ}/firmas/${S.exp}/eventos/${id}`, fields: enc(datos).mapValue.fields },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
        }] }),
      });
      if (r.ok) return;
      const txt = await r.text();
      if (/FAILED_PRECONDITION|ALREADY_EXISTS/.test(txt)) throw new Error("ya-existe");
      throw new Error(r.status === 403 ? "El servidor rechazó el registro. Recargue la página e intente de nuevo."
        : `No se pudo guardar (${r.status}). Revise su conexión.`);
    },
  };

  async function registrar(id, datos) {
    try {
      await registro.crear(id, datos);
    } catch (e) {
      if (e.message !== "ya-existe") throw e;
    }
    S.eventos = await registro.listar();
  }

  // ───────────────────────── pantalla de acceso ─────────────────────────
  function pantallaAcceso(msg = "") {
    if (!S.token) {
      $app.innerHTML = `<div class="tarjeta"><h1>Enlace incompleto</h1>
        <p>Abra el enlace exactamente como se lo enviamos, o escríbanos a cdhmaker@gmail.com.</p></div>`;
      return;
    }
    $app.innerHTML = `
      <div class="tarjeta">
        <h1>Sus documentos</h1>
        <p>Para proteger su información, los documentos están cifrados. Escriba el <b>código de acceso</b>
          que le enviamos por un canal distinto a este enlace (por ejemplo, WhatsApp).</p>
        <form id="fAcceso">
          <label class="campo">Código de acceso
            <input id="codigo" class="codigo" type="text" inputmode="text" autocomplete="one-time-code"
              autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX" required />
          </label>
          <p class="error" role="alert">${esc(msg)}</p>
          <div class="acciones"><button class="btn" type="submit">Abrir documentos</button></div>
        </form>
        <p class="ayuda">El código nunca sale de su navegador: solo se usa para descifrar los documentos.
          ${LOCAL ? "<br><b>Modo local de pruebas:</b> los eventos se guardan en este navegador." : ""}</p>
      </div>`;
    const $c = document.getElementById("codigo");
    $c.focus();
    document.getElementById("fAcceso").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (S.intentos >= 5) return pantallaAcceso("Demasiados intentos. Espere un minuto e intente de nuevo.");
      const codigo = normCodigo($c.value);
      if (codigo.length < 8) return pantallaAcceso("El código tiene 8 caracteres.");
      e.submitter.disabled = true;
      e.submitter.textContent = "Verificando…";
      await abrir(codigo);
    });
  }

  async function abrir(codigo) {
    let sobre;
    try {
      const r = await fetch(`/e/${S.token}.json`, { cache: "no-store" });
      if (r.status === 404) return pantallaAcceso("Este enlace no existe o fue anulado. Pida uno nuevo a CDH Maker.");
      if (!r.ok) throw new Error();
      sobre = await r.json();
    } catch {
      return pantallaAcceso("No se pudo descargar el expediente. Revise su conexión.");
    }
    try {
      S.paquete = await descifrar(sobre, codigo);
    } catch {
      S.intentos++;
      if (S.intentos >= 5) setTimeout(() => { S.intentos = 0; }, 60000);
      return pantallaAcceso("Código incorrecto. Revíselo e intente de nuevo.");
    }
    S.exp = await sha256(`${S.token}:${codigo}`);
    for (const d of S.paquete.documentos) {
      if (await sha256(d.html) !== d.sha256) S.alterados.add(d.id);
    }
    const c = S.paquete.cliente || {};
    S.ui.nombre = c.firmante || "";
    S.ui.cargo = c.cargo || "";
    try {
      S.eventos = await registro.listar();
    } catch (e) {
      S.paquete = null;
      return pantallaAcceso(e.message);
    }
    render();
  }

  // ───────────────────────── panel principal ─────────────────────────
  function render() {
    const P = S.paquete;
    const cond = ev("condiciones");
    const firmables = docs("firmar");
    const firmados = firmables.filter((d) => ev(`firma-${d.id}`));
    const todoFirmado = firmados.length === firmables.length;
    const carta = docs("leer")[0];
    const paso = !cond ? (ev(`lectura-${carta?.id}`) ? 2 : 1) : todoFirmado ? 4 : 3;

    const pasos = [["Bienvenida", "Carta y video"], ["Condiciones", "Leer y aceptar"],
      ["Firma", `${firmados.length} de ${firmables.length} firmados`], ["Descargas", "Copias en PDF"]]
      .map(([t, s], i) => `<li class="${i + 1 < paso || (i === 3 && todoFirmado) ? "hecho" : ""} ${i + 1 === paso ? "actual" : ""}">
        <b>${i + 1}. ${t}</b>${s}</li>`).join("");

    $app.innerHTML = `
      <div class="tarjeta">
        <h1>Hola, ${esc((P.cliente?.firmante || "").split(" ")[0])}</h1>
        <p>Aquí están los documentos de <b>${esc(P.proyecto)}</b> para <b>${esc(P.cliente?.empresa)}</b>.
          Puede leerlos, descargarlos y firmarlos desde cualquier dispositivo.</p>
        ${S.alterados.size ? `<p class="aviso">Uno o más documentos no coinciden con su huella digital y no se pueden firmar.
          Escríbanos a ${esc(P.proveedor?.correo)}.</p>` : ""}
      </div>
      <ol class="pasos">${pasos}</ol>

      <section class="tarjeta" id="sec-bienvenida">
        <h2>1. Bienvenida</h2>
        ${video(P.video)}
        ${carta ? tarjetaDoc(carta, { boton: "Leer la carta" }) : ""}
      </section>

      <section class="tarjeta" id="sec-condiciones">
        <h2>2. Condiciones</h2>
        ${cond ? `<p class="aviso ok">✓ Condiciones aceptadas por <b>${esc(cond.nombre)}</b> (C.C. ${esc(cond.cedula)})
          el ${esc(fecha(cond.at))}.</p>` : `<p>Lea completo cada documento. Al llegar al final se habilita su casilla de aceptación.</p>`}
        ${docs("aceptar").map((d) => tarjetaDoc(d, { aceptar: !cond })).join("")}
        ${cond ? "" : formularioCondiciones()}
      </section>

      <section class="tarjeta ${cond ? "" : "bloqueada"}" id="sec-firma">
        <h2>3. Firma</h2>
        ${cond ? `<p>Lea completo cada documento. Después de leerlo aparece el recuadro para firmar.</p>`
          : `<p class="aviso info">🔒 La firma del acta de entrega y del acuerdo de pago se habilita cuando lea y acepte
            las condiciones del paso 2.</p>`}
        ${firmables.map((d) => tarjetaDoc(d, { firmar: !!cond })).join("")}
      </section>

      <section class="tarjeta" id="sec-descargas">
        <h2>4. Descargas</h2>
        ${todoFirmado ? `<p class="aviso ok">✓ Todo está firmado. Gracias. Descargue sus copias: cada PDF incluye
          su constancia de firma electrónica.</p>
          ${P.proveedor?.whatsapp ? `<div class="acciones"><a class="btn btn-ok" target="_blank" rel="noopener"
            href="https://wa.me/${esc(P.proveedor.whatsapp)}?text=${encodeURIComponent(`Hola Henry, ya firmé los documentos de ${P.proyecto} en el portal (expediente ${P.expediente}).`)}">
            Avisar a CDH Maker por WhatsApp</a></div>` : ""}`
          : `<p>Puede descargar cualquier documento en cualquier momento. Los que aún no estén firmados se descargan como copia informativa.</p>`}
        <ul class="resumen" style="list-style:none;padding-left:14px">
          ${P.documentos.map((d) => `<li style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px">
            <span>${esc(d.titulo)} ${estadoDoc(d)}</span>
            <button type="button" class="btn btn-sec" data-accion="descargar" data-doc="${d.id}">Descargar PDF</button></li>`).join("")}
        </ul>
      </section>
      <p class="ayuda">Expediente ${esc(P.expediente)} · emitido por ${esc(P.proveedor?.nombre)} el ${esc(fecha(P.emitido))}.
        ¿Dudas? ${esc(P.proveedor?.correo)}</p>`;

    if (S.ui.error) {
      const box = document.querySelector("[data-error]");
      if (box) box.textContent = S.ui.error;
    }
    montarLienzos();
  }

  function video(v) {
    if (!v || !v.src) return `<div class="video"><div class="sin-video">🎬 El video explicativo de su sistema estará disponible aquí muy pronto.</div></div>`;
    const t = esc(v.titulo || "Video explicativo");
    return `<h3 style="margin-top:4px">${t}</h3><div class="video">${v.tipo === "url"
      ? `<iframe src="${esc(v.src)}" title="${t}" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<video controls playsinline preload="metadata" src="${esc(v.src)}"></video>`}</div>`;
  }

  function estadoDoc(d) {
    if (d.rol === "firmar") return ev(`firma-${d.id}`) ? `<span class="estado ok">✓ Firmado</span>`
      : `<span class="estado pendiente">Pendiente de firma</span>`;
    if (d.rol === "aceptar") return ev("condiciones") ? `<span class="estado ok">✓ Aceptado</span>`
      : ev(`lectura-${d.id}`) ? `<span class="estado">Leído</span>` : `<span class="estado pendiente">Sin leer</span>`;
    return ev(`lectura-${d.id}`) ? `<span class="estado ok">✓ Leído</span>` : `<span class="estado">Por leer</span>`;
  }

  function tarjetaDoc(d, o = {}) {
    const leido = !!ev(`lectura-${d.id}`);
    const firma = ev(`firma-${d.id}`);
    const resumen = (d.resumen || []).length ? `<p class="resumen-titulo">Lo esencial de este documento</p>
      <ul class="resumen">${d.resumen.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "";
    let extra = "";
    if (o.aceptar) {
      const ok = leido && !S.alterados.has(d.id);
      extra = `<label class="check ${ok ? "" : "inactivo"}"><input type="checkbox" data-check="${d.id}"
        ${ok ? "" : "disabled"} ${S.ui.checks[d.id] ? "checked" : ""} />
        <span>He leído completo y acepto «${esc(d.titulo)}».
        ${ok ? "" : "<br><span class='ayuda'>Se habilita al leer el documento hasta el final.</span>"}</span></label>`;
    }
    if (o.firmar && firma) {
      extra = `<p class="aviso ok">✓ Firmado por <b>${esc(firma.nombre)}</b> el ${esc(fecha(firma.at))}.</p>`;
    } else if (o.firmar && !leido) {
      extra = `<p class="ayuda">Lea el documento hasta el final para habilitar la firma.</p>`;
    } else if (o.firmar && !S.alterados.has(d.id)) {
      const c = ev("condiciones");
      extra = `<div class="panel-firma" data-firma="${d.id}">
        <p class="resumen-titulo">Firme dentro del recuadro con el dedo o el mouse</p>
        <div class="lienzo-marco"><canvas data-lienzo="${d.id}" aria-label="Recuadro para firmar"></canvas>
          <div class="linea-base"></div><span class="pista">${esc(c.nombre)} · C.C. ${esc(c.cedula)}</span></div>
        <div class="acciones" style="margin-top:6px"><button type="button" class="btn btn-texto" data-accion="limpiar" data-doc="${d.id}">Borrar trazo</button></div>
        <label class="check"><input type="checkbox" data-declara="${d.id}" />
          <span>Declaro que leí completo el documento «${esc(d.titulo)}», que lo apruebo en su totalidad y que tengo
          facultades para firmarlo en nombre de ${esc(S.paquete.cliente?.empresa)}. Entiendo que esta firma electrónica
          tiene la misma validez que mi firma manuscrita (Ley 527 de 1999).</span></label>
        <p class="error" data-error-doc="${d.id}" role="alert"></p>
        <div class="acciones"><button type="button" class="btn" data-accion="firmar" data-doc="${d.id}">Firmar ${esc(d.titulo.toLowerCase())}</button></div>
      </div>`;
    }
    return `<article class="tarjeta" style="margin:12px 0 0">
      <div class="doc-cabeza"><h3>${esc(d.titulo)}</h3>${estadoDoc(d)}</div>
      ${resumen}
      <div class="acciones"><button type="button" class="btn btn-sec" data-accion="leer" data-doc="${d.id}">${esc(o.boton || "Leer documento completo")}</button></div>
      ${extra}
    </article>`;
  }

  function formularioCondiciones() {
    const u = S.ui;
    const todos = REQUERIDOS.every((id) => u.checks[id]);
    return `<div class="tarjeta" style="margin:16px 0 0;background:var(--fondo)">
      <h3>Sus datos como firmante</h3>
      <p class="ayuda">Con estos datos queda identificada su aceptación y sus firmas.</p>
      <div class="campos">
        <label class="campo">Nombre completo<input type="text" data-campo="nombre" value="${esc(u.nombre)}" autocomplete="name" maxlength="120" /></label>
        <label class="campo">Cédula de ciudadanía<input type="text" data-campo="cedula" value="${esc(u.cedula)}" inputmode="numeric" maxlength="15" /></label>
        <label class="campo">Cargo en ${esc(S.paquete.cliente?.empresa)}<input type="text" data-campo="cargo" value="${esc(u.cargo)}" maxlength="80" /></label>
      </div>
      <label class="check"><input type="checkbox" data-campo="referencia" ${u.referencia ? "checked" : ""} />
        <span><b>Opcional:</b> autorizo a CDH Maker para mencionar el nombre de ${esc(S.paquete.cliente?.empresa)} y una
        descripción general del proyecto en su portafolio, sin información confidencial. Puedo revocarlo cuando quiera.</span></label>
      <p class="error" data-error role="alert"></p>
      <div class="acciones"><button type="button" class="btn" data-accion="aceptar" ${todos && !u.ocupado ? "" : "disabled"}>
        Aceptar condiciones</button></div>
      ${todos ? "" : `<p class="ayuda">Lea y marque los ${REQUERIDOS.length} documentos de arriba para continuar.</p>`}
    </div>`;
  }

  // ───────────────────────── firma manuscrita ─────────────────────────
  const lienzos = {};
  function montarLienzos() {
    document.querySelectorAll("canvas[data-lienzo]").forEach((cv) => {
      const id = cv.dataset.lienzo;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const caja = cv.getBoundingClientRect();
      cv.width = Math.round(caja.width * dpr);
      cv.height = Math.round(caja.height * dpr);
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b1f27";
      const L = { cv, tinta: 0 }; // tinta: largo total del trazo en px
      let previo = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener("pointerdown", (e) => {
        try { cv.setPointerCapture(e.pointerId); } catch { /* algunos navegadores no lo permiten */ }
        previo = pos(e);
      });
      cv.addEventListener("pointermove", (e) => {
        if (!previo) return;
        const p = pos(e);
        ctx.beginPath(); ctx.moveTo(...previo); ctx.lineTo(...p); ctx.stroke();
        L.tinta += Math.hypot(p[0] - previo[0], p[1] - previo[1]);
        previo = p;
      });
      const fin = () => { previo = null; };
      cv.addEventListener("pointerup", fin);
      cv.addEventListener("pointercancel", fin);
      lienzos[id] = L;
    });
  }
  function exportarTrazo(L) {
    const out = document.createElement("canvas");
    out.width = 600;
    out.height = Math.round(600 * L.cv.height / L.cv.width);
    out.getContext("2d").drawImage(L.cv, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }

  // ───────────────────────── visor y PDF ─────────────────────────
  function htmlDocumento(d) {
    const P = S.paquete;
    const dom = new DOMParser().parseFromString(`<main class="hoja">${d.html}</main>`, "text/html");
    const hoja = dom.querySelector(".hoja");
    const cond = ev("condiciones");
    const firma = ev(`firma-${d.id}`);
    const lect = ev(`lectura-${d.id}`);
    const bloques = dom.querySelectorAll(".firmas .firma");
    const sello = (txt) => { const s = dom.createElement("div"); s.style.cssText = "font-size:8pt;color:#0891b2;margin:-40px 0 6px;line-height:1.3"; s.innerHTML = txt; return s; };
    if (bloques[0]) bloques[0].prepend(sello(`Firmado electrónicamente al emitir<br>${esc(fecha(P.emitido))}`));
    if (bloques[1] && firma) {
      const img = dom.createElement("img");
      img.src = firma.trazo;
      img.alt = `Firma de ${firma.nombre}`;
      img.style.cssText = "display:block;height:56px;margin:-56px 0 0";
      bloques[1].prepend(img);
      const cc = [...bloques[1].querySelectorAll("span")].find((s) => /^C\.C\./.test(s.textContent));
      if (cc) cc.textContent = `C.C.: ${firma.cedula}`;
    } else if (bloques[1] && d.rol === "aceptar" && cond) {
      bloques[1].prepend(sello(`Aceptado electrónicamente<br>${esc(fecha(cond.at))}`));
    }

    const filas = [["Expediente", P.expediente], ["Documento", d.titulo], ["Huella SHA-256 del documento", d.sha256],
      ["Emitido por", `${P.proveedor?.nombre} (${P.proveedor?.marca}) — ${fecha(P.emitido)}`]];
    let titulo = "Copia informativa — documento pendiente de firma";
    if (firma) {
      titulo = "Constancia de firma electrónica";
      filas.push(["Firmado por", `${firma.nombre} — C.C. ${firma.cedula}${firma.cargo ? " — " + firma.cargo : ""} — ${P.cliente?.empresa}`],
        ["Fecha y hora de la firma (servidor)", fecha(firma.at)],
        ["Lectura completa del documento", fecha(lect?.at)],
        ["Aceptación de condiciones", fecha(cond?.at)],
        ["Huella registrada con la firma", firma.sha256],
        ["Navegador del firmante", firma.ua]);
    } else if (d.rol === "aceptar" && cond) {
      titulo = "Constancia de aceptación electrónica";
      filas.push(["Aceptado por", `${cond.nombre} — C.C. ${cond.cedula}${cond.cargo ? " — " + cond.cargo : ""} — ${P.cliente?.empresa}`],
        ["Fecha y hora de la aceptación (servidor)", fecha(cond.at)],
        ["Lectura completa del documento", fecha(lect?.at)],
        ["Huella registrada con la aceptación", cond.docs?.[d.id] || ""],
        ["Navegador del firmante", cond.ua]);
    } else if (d.rol === "leer" && lect) {
      titulo = "Constancia de lectura";
      filas.push(["Leído el", fecha(lect.at)]);
    }
    filas.push(["Identificador de verificación", S.exp],
      ["Método", "Enlace personal y código por canal separado, identificación con nombre y cédula, lectura completa, declaración expresa y trazo manuscrito (Acuerdo de Uso de Firma Electrónica; Ley 527 de 1999 y Decreto 2364 de 2012)."]);
    const constancia = dom.createElement("section");
    constancia.style.cssText = "page-break-inside:avoid;margin-top:24px";
    constancia.innerHTML = `<h2>${esc(titulo)}</h2><table class="datos">${filas.map(([k, v]) =>
      `<tr><th>${esc(k)}</th><td style="overflow-wrap:anywhere">${esc(v)}</td></tr>`).join("")}</table>`;
    const pie = hoja.querySelector(".pie");
    pie ? hoja.insertBefore(constancia, pie) : hoja.append(constancia);

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${esc(d.titulo)} — ${esc(P.cliente?.empresa)}</title><style>${P.css}</style></head><body>${hoja.outerHTML}</body></html>`;
  }

  let visorDoc = null;
  function abrirVisor(id, imprimir = false) {
    const d = doc(id);
    visorDoc = d;
    document.getElementById("visorTitulo").textContent = d.titulo;
    $barra.style.width = "0";
    $pie.textContent = ev(`lectura-${id}`) ? "✓ Ya leyó este documento completo." : "Desplácese hasta el final del documento.";
    $marco.onload = () => {
      const w = $marco.contentWindow;
      const revisar = () => {
        const el = w.document.scrollingElement || w.document.documentElement;
        const max = el.scrollHeight - w.innerHeight;
        const p = max <= 0 ? 1 : el.scrollTop / max;
        $barra.style.width = `${Math.round(p * 100)}%`;
        if (p >= 0.985) marcarLeido(d);
      };
      w.addEventListener("scroll", revisar, { passive: true });
      setTimeout(revisar, 300);
      if (imprimir) setTimeout(() => { w.focus(); w.print(); }, 600);
    };
    $marco.srcdoc = htmlDocumento(d);
    $visor.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function cerrarVisor() {
    $visor.hidden = true;
    document.body.style.overflow = "";
    $marco.srcdoc = "";
    visorDoc = null;
    render();
  }
  let marcando = false;
  async function marcarLeido(d) {
    if (ev(`lectura-${d.id}`) || marcando || S.alterados.has(d.id)) return;
    marcando = true;
    try {
      await registrar(`lectura-${d.id}`, { tipo: "lectura", doc: d.id, sha256: d.sha256, ua: ua() });
      if (visorDoc === d) $pie.textContent = "✓ Documento leído completo. Ya puede volver.";
    } catch (e) {
      $pie.textContent = e.message;
    } finally {
      marcando = false;
    }
  }

  // ───────────────────────── acciones ─────────────────────────
  async function aceptar(boton) {
    const u = S.ui;
    const cedula = u.cedula.replace(/\D/g, "");
    const esperada = (S.paquete.cliente?.cedula || "").replace(/\D/g, "");
    const fallo = u.nombre.trim().length < 3 ? "Escriba su nombre completo."
      : !/^\d{5,12}$/.test(cedula) ? "Escriba su número de cédula, solo números."
      : esperada && cedula !== esperada ? "La cédula no coincide con la registrada para este expediente. Escríbanos si es un error."
      : !REQUERIDOS.every((id) => u.checks[id] && ev(`lectura-${id}`)) ? "Lea y acepte los tres documentos." : "";
    if (fallo) { document.querySelector("[data-error]").textContent = fallo; return; }
    boton.disabled = true;
    boton.textContent = "Guardando…";
    try {
      await registrar("condiciones", {
        tipo: "condiciones",
        docs: Object.fromEntries(REQUERIDOS.map((id) => [id, doc(id).sha256])),
        nombre: u.nombre.trim().replace(/\s+/g, " "),
        cedula,
        cargo: u.cargo.trim().slice(0, 80),
        referencia: !!u.referencia,
        ua: ua(),
      });
      render();
      document.getElementById("sec-firma").scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      boton.disabled = false;
      boton.textContent = "Aceptar condiciones";
      document.querySelector("[data-error]").textContent = e.message;
    }
  }

  async function firmar(id, boton) {
    const L = lienzos[id];
    const $err = document.querySelector(`[data-error-doc="${id}"]`);
    if (!L || L.tinta < 120) { $err.textContent = "Dibuje su firma dentro del recuadro."; return; }
    if (!document.querySelector(`[data-declara="${id}"]`).checked) { $err.textContent = "Marque la declaración para firmar."; return; }
    const c = ev("condiciones");
    const d = doc(id);
    boton.disabled = true;
    boton.textContent = "Firmando…";
    try {
      await registrar(`firma-${id}`, {
        tipo: "firma", doc: id, sha256: d.sha256, nombre: c.nombre, cedula: c.cedula, cargo: c.cargo,
        trazo: exportarTrazo(L), declaracion: true, ua: ua(),
      });
      render();
      document.getElementById(docs("firmar").every((x) => ev(`firma-${x.id}`)) ? "sec-descargas" : "sec-firma")
        .scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      boton.disabled = false;
      boton.textContent = `Firmar ${d.titulo.toLowerCase()}`;
      $err.textContent = e.message;
    }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const id = b.dataset.doc;
    switch (b.dataset.accion) {
      case "leer": abrirVisor(id); break;
      case "descargar": abrirVisor(id, true); break;
      case "cerrar-visor": cerrarVisor(); break;
      case "imprimir": $marco.contentWindow.focus(); $marco.contentWindow.print(); break;
      case "aceptar": aceptar(b); break;
      case "firmar": firmar(id, b); break;
      case "limpiar": {
        const L = lienzos[id];
        L.cv.getContext("2d").clearRect(0, 0, L.cv.width, L.cv.height);
        L.tinta = 0;
        break;
      }
    }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.check) { S.ui.checks[t.dataset.check] = t.checked; render(); }
    else if (t.dataset.campo === "referencia") S.ui.referencia = t.checked;
    else if (t.dataset.campo) S.ui[t.dataset.campo] = t.value;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$visor.hidden) cerrarVisor(); });

  pantallaAcceso();
})();
