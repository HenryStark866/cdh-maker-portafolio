// CDH Maker — "Max", asistente comercial del sitio
(function () {
  const WA_NUMBER = "573245769748";

  // ---------- Utilidades ----------
  const norm = (s) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const waLink = (msg) =>
    `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  // ---------- Base de conocimiento / ventas ----------
  const SERVICES = {
    web: {
      label: "🌐 Web y software",
      pitch:
        "¡Buena elección! 🌐 Una página profesional es tu vendedor 24/7. En CDH Maker hacemos <b>sitios web, landing pages y sistemas a la medida</b> — modernos, rápidos y desplegados en la nube (como esta misma página 😉). Proyectos como <b>PrivacyCheck</b> (plataforma de cumplimiento con IA) salieron de este taller.",
      hook: "Cuéntame: ¿qué necesitas? ¿Una página para tu negocio, una tienda, un sistema interno…?",
      waMsg: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de desarrollo web/software: ",
    },
    maker: {
      label: "🖨️ Impresión 3D / Láser / CNC",
      pitch:
        "¡Perfecto! 🖨️ Convertimos tu idea o plano en una <b>pieza real</b>: impresión 3D (FDM y resina), corte y grabado láser, y mecanizado CNC. Ideal para <b>prototipos, repuestos difíciles de conseguir, regalos personalizados y producción de series cortas</b>.",
      hook: "¿Qué quieres fabricar? Si tienes una foto o un archivo (STL, DXF, imagen), me lo cuentas y lo cotizamos de una.",
      waMsg: "Hola Henry, vengo de tu página. Quiero cotizar fabricación digital (3D/láser/CNC): ",
    },
    iot: {
      label: "🤖 Electrónica e IoT",
      pitch:
        "¡Excelente! 🤖 Automatizamos hogares, cultivos e industria con <b>Arduino, ESP32 y Raspberry Pi</b>: sensores, monitoreo remoto en tiempo real, domótica y sistemas embebidos a la medida. Tu proceso medido y controlado desde el celular.",
      hook: "¿Qué te gustaría automatizar o monitorear? (temperatura, humedad, riego, seguridad, consumo…)",
      waMsg: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de electrónica/IoT: ",
    },
    consultoria: {
      label: "🎓 Diseño y asesorías",
      pitch:
        "¡Genial! 🎓 Ofrecemos <b>diseño CAD 2D/3D, consultoría técnica de proyectos y talleres maker</b>. Si tienes una idea y no sabes por dónde empezar, te acompañamos desde el boceto hasta el producto terminado.",
      hook: "¿Buscas diseño de una pieza, asesoría para tu proyecto o una capacitación?",
      waMsg: "Hola Henry, vengo de tu página. Me interesa diseño CAD / asesoría / capacitación: ",
    },
  };

  const INTENTS = [
    { keys: ["precio", "costo", "cuanto", "vale", "cotiz", "presupuesto", "tarifa"], type: "precio" },
    { keys: ["web", "pagina", "sitio", "app", "software", "sistema", "tienda", "landing", "aplicacion"], type: "svc", svc: "web" },
    { keys: ["3d", "impresion", "imprimir", "laser", "corte", "cnc", "pieza", "prototipo", "stl", "filamento", "resina", "grabado", "repuesto"], type: "svc", svc: "maker" },
    { keys: ["iot", "arduino", "esp32", "raspberry", "sensor", "domotica", "automatiz", "electron", "riego", "monitoreo", "embebido", "robot"], type: "svc", svc: "iot" },
    { keys: ["asesoria", "consultoria", "curso", "taller", "capacitacion", "cad", "diseno", "clase", "aprender"], type: "svc", svc: "consultoria" },
    { keys: ["tiempo", "demora", "cuando", "plazo", "entrega", "rapido"], type: "tiempo" },
    { keys: ["whatsapp", "contacto", "telefono", "numero", "hablar", "henry", "llamar", "correo", "email"], type: "contacto" },
    { keys: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey", "saludos"], type: "saludo" },
    { keys: ["gracias", "genial", "perfecto", "listo", "ok", "vale"], type: "gracias" },
    { keys: ["quien", "sobre ti", "eres", "cdh"], type: "quien" },
  ];

  function detectIntent(text) {
    const t = norm(text);
    let best = null, bestScore = 0;
    for (const intent of INTENTS) {
      const score = intent.keys.filter((k) => t.includes(k)).length;
      if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best;
  }

  // ---------- Estado ----------
  let lastService = null; // último servicio del que se habló, para armar el mensaje de WhatsApp
  let askedProject = false; // si ya le pedimos describir su proyecto

  // ---------- UI ----------
  const root = document.createElement("div");
  root.id = "cdh-chat";
  root.innerHTML = `
    <button id="cdh-chat-fab" aria-label="Abrir chat de asistencia">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="cdh-fab-badge">1</span>
    </button>
    <div id="cdh-chat-panel" hidden>
      <div class="cdh-chat-header">
        <div class="cdh-chat-avatar">M</div>
        <div>
          <strong>Max</strong>
          <span>Asistente de CDH Maker · en línea</span>
        </div>
        <button id="cdh-chat-close" aria-label="Cerrar chat">✕</button>
      </div>
      <div class="cdh-chat-msgs" id="cdh-chat-msgs"></div>
      <div class="cdh-chat-quick" id="cdh-chat-quick"></div>
      <form class="cdh-chat-input" id="cdh-chat-form">
        <input type="text" id="cdh-chat-text" placeholder="Escribe tu mensaje…" autocomplete="off" maxlength="300" />
        <button type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const fab = document.getElementById("cdh-chat-fab");
  const panel = document.getElementById("cdh-chat-panel");
  const msgs = document.getElementById("cdh-chat-msgs");
  const quick = document.getElementById("cdh-chat-quick");
  const form = document.getElementById("cdh-chat-form");
  const input = document.getElementById("cdh-chat-text");

  function addMsg(html, who) {
    const div = document.createElement("div");
    div.className = "cdh-msg " + who;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function botSay(html, delay) {
    return new Promise((res) => {
      const typing = addMsg('<span class="cdh-typing"><i></i><i></i><i></i></span>', "bot");
      setTimeout(() => {
        typing.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        res();
      }, delay || 700);
    });
  }

  function setQuick(options) {
    quick.innerHTML = "";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.addEventListener("click", () => handleUser(o.label, o.action));
      quick.appendChild(b);
    });
  }

  const MAIN_MENU = [
    { label: SERVICES.web.label, action: { type: "svc", svc: "web" } },
    { label: SERVICES.maker.label, action: { type: "svc", svc: "maker" } },
    { label: SERVICES.iot.label, action: { type: "svc", svc: "iot" } },
    { label: SERVICES.consultoria.label, action: { type: "svc", svc: "consultoria" } },
    { label: "💬 Hablar con Henry", action: { type: "contacto" } },
  ];

  function waButton(text, msg) {
    return `<a class="cdh-wa-btn" href="${waLink(msg)}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
      ${text}</a>`;
  }

  async function respond(action, rawText) {
    if (action.type === "svc") {
      const s = SERVICES[action.svc];
      lastService = action.svc;
      askedProject = true;
      await botSay(s.pitch);
      await botSay(s.hook + "<br><br>O si prefieres, escríbele directo a Henry:<br>" + waButton("Cotizar por WhatsApp", s.waMsg), 900);
      setQuick([
        { label: "💬 Cotizar por WhatsApp", action: { type: "wa" } },
        { label: "⏱️ ¿Cuánto se demora?", action: { type: "tiempo" } },
        { label: "◀️ Ver otros servicios", action: { type: "menu" } },
      ]);
      return;
    }

    switch (action.type) {
      case "saludo":
        await botSay("¡Hola! 😄 Qué gusto tenerte por aquí. Soy <b>Max</b>, el asistente de CDH Maker. ¿En qué te puedo ayudar hoy?");
        setQuick(MAIN_MENU);
        break;

      case "precio": {
        const svc = lastService ? SERVICES[lastService] : null;
        await botSay(
          "Cada proyecto es único, así que las <b>cotizaciones son personalizadas y gratis</b> 💜. Henry revisa tu idea y te responde con precio y tiempos, usualmente <b>en menos de 24 horas</b>."
        );
        const msg = svc ? svc.waMsg : "Hola Henry, vengo de tu página y quiero una cotización: ";
        await botSay("Cuéntame brevemente qué necesitas y te armo el mensaje, o escríbele ya mismo:<br>" + waButton("Pedir cotización gratis", msg), 800);
        setQuick([{ label: "◀️ Ver servicios", action: { type: "menu" } }]);
        break;
      }

      case "tiempo":
        await botSay(
          "Depende del proyecto ⏱️: una pieza 3D o un corte láser puede estar en <b>días</b>; una página web sencilla en <b>1–2 semanas</b>; sistemas y automatizaciones a la medida se cotizan por etapas. Lo bueno: trabajamos con <b>entregas parciales</b> para que veas avances desde el inicio."
        );
        await botSay("¿Te cotizo el tuyo? Es gratis y sin compromiso 👇<br>" + waButton("Cotizar ahora", (lastService ? SERVICES[lastService].waMsg : "Hola Henry, vengo de tu página y quiero saber tiempos y costos para mi proyecto: ")), 800);
        setQuick([{ label: "◀️ Ver servicios", action: { type: "menu" } }]);
        break;

      case "contacto":
        await botSay(
          'Puedes hablar directamente con Henry: 📱 WhatsApp <b>324 576 9748</b> o ✉️ <a href="mailto:cdhmaker@gmail.com">cdhmaker@gmail.com</a>. Responde usualmente en menos de 24 horas.'
        );
        await botSay(waButton("Abrir WhatsApp", "Hola Henry, vengo de tu página web y quiero hablar contigo."), 600);
        setQuick([{ label: "◀️ Ver servicios", action: { type: "menu" } }]);
        break;

      case "quien":
        await botSay(
          "CDH Maker es el taller de <b>Henry Taborda</b>, ingeniero y maker de Medellín 🇨🇴. Aquí nacen proyectos como <b>EvaIA</b> (asistente de IA local) y <b>PrivacyCheck</b> (plataforma de cumplimiento con IA). La filosofía: <i>si lo puedes imaginar, lo podemos construir</i>."
        );
        setQuick(MAIN_MENU);
        break;

      case "gracias":
        await botSay("¡Con mucho gusto! 💜 ¿Algo más en lo que te pueda ayudar?");
        setQuick(MAIN_MENU);
        break;

      case "menu":
        await botSay("Claro, estos son los servicios de CDH Maker. ¿Cuál te interesa?");
        setQuick(MAIN_MENU);
        break;

      case "wa": {
        const msg = (lastService ? SERVICES[lastService].waMsg : "Hola Henry, vengo de tu página web: ");
        await botSay("¡Perfecto! Te llevo con Henry 🚀<br>" + waButton("Abrir WhatsApp", msg));
        setQuick([{ label: "◀️ Ver servicios", action: { type: "menu" } }]);
        break;
      }

      default: {
        // Texto libre sin intención clara
        if (askedProject && rawText && rawText.length > 12) {
          // El usuario describió su proyecto → armar mensaje de WhatsApp con su descripción
          const base = lastService ? SERVICES[lastService].waMsg : "Hola Henry, vengo de tu página. Mi proyecto: ";
          await botSay(
            "¡Suena como un gran proyecto! 🙌 Ya te preparé el mensaje con tu descripción — un clic y le llega directo a Henry para cotizártelo <b>gratis</b>:"
          );
          await botSay(waButton("Enviar mi proyecto por WhatsApp", base + rawText), 700);
          setQuick([{ label: "◀️ Ver servicios", action: { type: "menu" } }]);
        } else {
          await botSay(
            "Interesante 🤔 Para ayudarte mejor: ¿tu consulta es sobre alguno de estos servicios? También puedes escribirle directo a Henry:<br>" +
            waButton("Hablar con Henry", "Hola Henry, vengo de tu página web. Tengo una consulta: " + (rawText || ""))
          );
          setQuick(MAIN_MENU);
        }
      }
    }
  }

  function handleUser(text, forcedAction) {
    addMsg(text.replace(/</g, "&lt;"), "user");
    quick.innerHTML = "";
    let action = forcedAction || detectIntent(text) || { type: "fallback" };
    // Si ya le pedimos describir su proyecto y escribe algo sustancioso,
    // capturamos la descripcion (afinando el servicio detectado) en vez de repetir el pitch.
    if (!forcedAction && askedProject && text.trim().length > 12 && action.type === "svc") {
      lastService = action.svc;
      action = { type: "fallback" };
    }
    respond(action, text);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    handleUser(t);
  });

  // Abrir / cerrar
  let started = false;
  function openChat() {
    panel.hidden = false;
    fab.classList.add("open");
    fab.querySelector(".cdh-fab-badge").style.display = "none";
    if (!started) {
      started = true;
      botSay(
        "¡Hola! 👋 Soy <b>Max</b>, el asistente de <b>CDH Maker</b>. Estoy aquí para ayudarte a hacer realidad tu proyecto: web, impresión 3D, electrónica, IoT y más. ¿Qué te interesa?",
        600
      ).then(() => setQuick(MAIN_MENU));
    }
    input.focus();
  }
  fab.addEventListener("click", () => (panel.hidden ? openChat() : closeChat()));
  document.getElementById("cdh-chat-close").addEventListener("click", closeChat);
  function closeChat() {
    panel.hidden = true;
    fab.classList.remove("open");
  }
  // Cerrar con Escape o haciendo clic fuera del widget
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closeChat();
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !root.contains(e.target)) closeChat();
  });
})();
