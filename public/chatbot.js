// CDH Maker — "Maker", asesor comercial del sitio (natural y bilingüe)
(function () {
  const WA_NUMBER = "573245769748";

  // ---------- Utilidades ----------
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => s.replace(/</g, "&lt;");

  // Idioma del chat: español si la página está en español; inglés para el resto
  const lang = () => ((document.documentElement.lang || "es").startsWith("es") ? "es" : "en");

  // ---------- Textos por idioma ----------
  const TEXT = {
    es: {
      header_sub: "Asesor de CDH Maker · en línea",
      placeholder: "Escribe tu mensaje…",
      open_label: "Abrir chat de asistencia",
      close_label: "Cerrar chat",
      greeting: [
        "¡Hola! 👋 Soy <b>Maker</b>, el asesor de <b>CDH Maker</b>. Cuéntame, ¿qué te trae por aquí? ¿Una idea, un proyecto, o solo estás explorando?",
        "¡Hola, bienvenido! 👋 Soy <b>Maker</b>. Aquí construimos de todo: software, piezas 3D, electrónica… ¿Qué tienes en mente?",
        "¡Hey! 👋 Soy <b>Maker</b>, del equipo de CDH Maker. Si tienes una idea dando vueltas, este es el lugar para aterrizarla. ¿En qué te ayudo?",
      ],
      re_greeting: ["¡Hola de nuevo! 😄 ¿En qué te ayudo?", "¡Aquí sigo! ¿Qué más quieres saber?"],
      menu: [
        { label: "Web y software", action: { type: "svc", svc: "web" } },
        { label: "Impresión 3D · Láser · CNC", action: { type: "svc", svc: "maker" } },
        { label: "Electrónica e IoT", action: { type: "svc", svc: "iot" } },
        { label: "Diseño y asesorías", action: { type: "svc", svc: "consultoria" } },
        { label: "Hablar con Henry", action: { type: "contacto" } },
      ],
      back: "Ver otros servicios",
      quote_wa: "Cotizar por WhatsApp",
      how_long: "¿Cuánto se demora?",
      services: {
        web: {
          pitch: "Buena elección. Una página o sistema bien hecho trabaja por ti las 24 horas. Hacemos <b>sitios web, tiendas y software a la medida</b> — esta misma página salió de nuestro taller, igual que plataformas como <b>PrivacyCheck</b> o <b>TaxiYa</b>.",
          hook: "¿Qué necesitas exactamente? ¿Una página para tu negocio, una tienda, un sistema interno…? Cuéntame con tus palabras y te oriento.",
          waMsg: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de desarrollo web/software: ",
        },
        maker: {
          pitch: "Me encanta. Convertimos ideas y planos en <b>piezas reales</b>: impresión 3D (FDM y resina), corte láser y CNC. Desde un repuesto imposible de conseguir hasta prototipos de producto.",
          hook: "¿Qué quieres fabricar? Si tienes una foto, medida o archivo (STL, DXF), mejor todavía — descríbemelo y lo cotizamos.",
          waMsg: "Hola Henry, vengo de tu página. Quiero cotizar fabricación digital (3D/láser/CNC): ",
        },
        iot: {
          pitch: "Excelente terreno. Automatizamos casas, cultivos e industria con <b>Arduino, ESP32 y Raspberry Pi</b>: sensores, monitoreo desde el celular, domótica y sistemas a la medida.",
          hook: "¿Qué te gustaría automatizar o monitorear? ¿Temperatura, riego, seguridad, consumo…? Cuéntame el escenario.",
          waMsg: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de electrónica/IoT: ",
        },
        consultoria: {
          pitch: "Claro que sí. Ofrecemos <b>diseño CAD 2D/3D, asesoría técnica y talleres</b>. Si tienes una idea pero no sabes por dónde empezar, te acompañamos desde el boceto.",
          hook: "¿Buscas el diseño de una pieza, una asesoría para tu proyecto o una capacitación? Cuéntame un poco más.",
          waMsg: "Hola Henry, vengo de tu página. Me interesa diseño CAD / asesoría / capacitación: ",
        },
      },
      price: [
        "Cada proyecto es distinto, así que no manejamos precios de catálogo: la <b>cotización es personalizada y gratis</b>. Henry revisa tu caso y te responde con precio y tiempos, normalmente <b>en menos de 24 horas</b>.",
        "Te soy honesto: depende del alcance. Por eso la <b>cotización es gratis y sin compromiso</b> — describes lo que necesitas y Henry te da un precio claro en menos de 24 horas.",
      ],
      price_cta: "Si me cuentas brevemente qué necesitas, te dejo el mensaje listo para enviar. O escríbele directo:",
      time: "Depende del proyecto: una pieza 3D o un corte láser puede estar <b>en días</b>; una página web sencilla, <b>en 1–2 semanas</b>; sistemas más grandes se van entregando <b>por etapas</b>, para que veas avances desde el inicio.",
      time_cta: "¿Te cotizo el tuyo? Es gratis:",
      contact: 'Puedes hablar directo con Henry: 📱 WhatsApp <b>324 576 9748</b> o ✉️ <a href="mailto:cdhmaker@gmail.com">cdhmaker@gmail.com</a>. Suele responder en menos de 24 horas.',
      contact_wa_msg: "Hola Henry, vengo de tu página web y quiero hablar contigo.",
      open_wa: "Abrir WhatsApp",
      who: "CDH Maker es el taller de <b>Henry Taborda</b>, ingeniero y maker de Medellín 🇨🇴. De aquí han salido proyectos como <b>EvaIA</b> (asistente de IA local), <b>TaxiYa</b>, <b>IncubApp</b> y <b>PrivacyCheck</b>. La filosofía es simple: <i>si lo puedes imaginar, lo podemos construir</i>.",
      thanks: ["¡Con gusto! 😊 ¿Algo más en lo que te pueda ayudar?", "¡Para eso estamos! ¿Quieres ver algo más?"],
      bye: ["¡Que te vaya muy bien! Aquí estaré cuando quieras retomar tu proyecto. 👋", "¡Gracias por pasar! Cuando la idea madure, ya sabes dónde encontrarnos. 👋"],
      yes: "¡Perfecto! Cuéntame un poco más o elige una opción:",
      no_worries: "Sin problema. Si prefieres, explora los servicios con calma o pregúntame lo que sea:",
      expensive: "Te entiendo — el presupuesto siempre importa. Lo bueno es que trabajamos <b>por etapas</b>: empezamos por lo esencial y creces cuando lo necesites. La cotización es gratis, así sabes exactamente de qué hablamos antes de decidir.",
      human: "¡Claro! Nada mejor que hablar con una persona. Henry te atiende directamente:",
      where: "Estamos en <b>Medellín, Colombia</b> 🇨🇴, pero trabajamos con clientes de cualquier lugar: los proyectos de software se entregan en la nube y las piezas físicas se envían por mensajería.",
      captured: [
        "¡Suena muy bien! 🙌 Ya te preparé el mensaje con tu descripción — un clic y le llega directo a Henry para cotizártelo gratis:",
        "¡Eso se puede hacer! Te dejo el mensaje listo con lo que me contaste; envíalo y Henry te responde con precio y tiempos:",
      ],
      send_project: "Enviar mi proyecto por WhatsApp",
      fallback: "Buena pregunta. Para darte una respuesta precisa, lo mejor es que se la hagas directo a Henry — o si me cuentas un poco más, te oriento hacia el servicio indicado:",
      ask_direct: "Preguntarle a Henry",
      wa_generic: "Hola Henry, vengo de tu página web. Tengo una consulta: ",
      wa_quote_generic: "Hola Henry, vengo de tu página y quiero una cotización: ",
    },
    en: {
      header_sub: "CDH Maker advisor · online",
      placeholder: "Type your message…",
      open_label: "Open support chat",
      close_label: "Close chat",
      greeting: [
        "Hi there! 👋 I'm <b>Maker</b>, the CDH Maker advisor. Tell me — an idea, a project, or just exploring?",
        "Welcome! 👋 I'm <b>Maker</b>. We build all sorts of things here: software, 3D parts, electronics… What's on your mind?",
      ],
      re_greeting: ["Hello again! 😄 How can I help?", "Still here! What else would you like to know?"],
      menu: [
        { label: "Web & software", action: { type: "svc", svc: "web" } },
        { label: "3D printing · Laser · CNC", action: { type: "svc", svc: "maker" } },
        { label: "Electronics & IoT", action: { type: "svc", svc: "iot" } },
        { label: "Design & consulting", action: { type: "svc", svc: "consultoria" } },
        { label: "Talk to Henry", action: { type: "contacto" } },
      ],
      back: "See other services",
      quote_wa: "Get a quote on WhatsApp",
      how_long: "How long does it take?",
      services: {
        web: {
          pitch: "Good choice. A well-built site or system works for you 24/7. We build <b>websites, stores and custom software</b> — this very page came out of our workshop, along with platforms like <b>PrivacyCheck</b> and <b>TaxiYa</b>.",
          hook: "What exactly do you need? A business site, a store, an internal system…? Tell me in your own words and I'll point you the right way.",
          waMsg: "Hi Henry, I come from your website. I'd like a quote for a web/software project: ",
        },
        maker: {
          pitch: "Love it. We turn ideas and drawings into <b>real parts</b>: 3D printing (FDM and resin), laser cutting and CNC. From an impossible-to-find spare part to product prototypes.",
          hook: "What do you want to make? If you have a photo, measurements or a file (STL, DXF), even better — describe it and we'll quote it.",
          waMsg: "Hi Henry, I come from your website. I'd like a quote for digital fabrication (3D/laser/CNC): ",
        },
        iot: {
          pitch: "Great territory. We automate homes, crops and industry with <b>Arduino, ESP32 and Raspberry Pi</b>: sensors, phone monitoring, home automation and custom systems.",
          hook: "What would you like to automate or monitor? Temperature, irrigation, security, power usage…? Tell me the scenario.",
          waMsg: "Hi Henry, I come from your website. I'd like a quote for an electronics/IoT project: ",
        },
        consultoria: {
          pitch: "Of course. We offer <b>2D/3D CAD design, technical consulting and workshops</b>. If you have an idea but don't know where to start, we'll walk you from the first sketch.",
          hook: "Are you looking for a part design, project advice or training? Tell me a bit more.",
          waMsg: "Hi Henry, I come from your website. I'm interested in CAD design / consulting / training: ",
        },
      },
      price: [
        "Every project is different, so there's no price list: <b>quotes are personalized and free</b>. Henry reviews your case and replies with price and timing, usually <b>within 24 hours</b>.",
      ],
      price_cta: "Tell me briefly what you need and I'll prepare the message. Or write to him directly:",
      time: "It depends on the project: a 3D part or laser cut can be ready <b>in days</b>; a simple website, <b>in 1–2 weeks</b>; bigger systems are delivered <b>in stages</b>, so you see progress from day one.",
      time_cta: "Want a quote for yours? It's free:",
      contact: 'You can talk directly to Henry: 📱 WhatsApp <b>+57 324 576 9748</b> or ✉️ <a href="mailto:cdhmaker@gmail.com">cdhmaker@gmail.com</a>. He usually replies within 24 hours.',
      contact_wa_msg: "Hi Henry, I come from your website and I'd like to talk to you.",
      open_wa: "Open WhatsApp",
      who: "CDH Maker is the workshop of <b>Henry Taborda</b>, engineer and maker from Medellín, Colombia 🇨🇴. Projects like <b>EvaIA</b>, <b>TaxiYa</b>, <b>IncubApp</b> and <b>PrivacyCheck</b> were born here. The philosophy is simple: <i>if you can imagine it, we can build it</i>.",
      thanks: ["My pleasure! 😊 Anything else I can help with?", "Anytime! Want to see anything else?"],
      bye: ["Take care! I'll be here whenever you want to pick up your project. 👋"],
      yes: "Great! Tell me a bit more or pick an option:",
      no_worries: "No problem. Feel free to explore the services or ask me anything:",
      expensive: "I hear you — budget always matters. The good news: we work <b>in stages</b>, starting with the essentials so you grow when you need to. The quote is free, so you'll know exactly what we're talking about before deciding.",
      human: "Of course! Nothing beats talking to a person. Henry will help you directly:",
      where: "We're in <b>Medellín, Colombia</b> 🇨🇴, but we work with clients anywhere: software is delivered in the cloud and physical parts are shipped by courier.",
      captured: [
        "Sounds great! 🙌 I've prepared the message with your description — one click and it goes straight to Henry for a free quote:",
      ],
      send_project: "Send my project on WhatsApp",
      fallback: "Good question. For a precise answer, it's best to ask Henry directly — or tell me a bit more and I'll point you to the right service:",
      ask_direct: "Ask Henry",
      wa_generic: "Hi Henry, I come from your website. I have a question: ",
      wa_quote_generic: "Hi Henry, I come from your website and I'd like a quote: ",
    },
  };

  // ---------- Detección de intenciones ----------
  const INTENTS = [
    { keys: ["precio", "costo", "cuanto vale", "cuanto cuesta", "cotiz", "presupuesto", "tarifa", "price", "cost", "quote", "how much"], type: "precio" },
    { keys: ["caro", "costoso", "barato", "economico", "expensive", "cheap", "afford"], type: "caro" },
    { keys: ["web", "pagina", "sitio", "app", "software", "sistema", "tienda", "landing", "aplicacion", "website", "store", "ecommerce"], type: "svc", svc: "web" },
    { keys: ["3d", "impresion", "imprimir", "laser", "corte", "cnc", "pieza", "prototipo", "stl", "filamento", "resina", "grabado", "repuesto", "print", "part", "engrav"], type: "svc", svc: "maker" },
    { keys: ["iot", "arduino", "esp32", "raspberry", "sensor", "domotica", "automatiz", "electron", "riego", "monitoreo", "embebido", "robot", "automation"], type: "svc", svc: "iot" },
    { keys: ["asesoria", "consultoria", "curso", "taller", "capacitacion", "cad", "diseno", "clase", "aprender", "consult", "training", "workshop", "design", "learn"], type: "svc", svc: "consultoria" },
    { keys: ["tiempo", "demora", "cuando", "plazo", "entrega", "rapido", "how long", "delivery", "deadline", "time"], type: "tiempo" },
    { keys: ["persona", "humano", "alguien real", "human", "person", "real"], type: "humano" },
    { keys: ["donde", "ubicacion", "ciudad", "pais", "envio", "where", "location", "ship"], type: "donde" },
    { keys: ["whatsapp", "contacto", "telefono", "numero", "hablar", "henry", "llamar", "correo", "email", "contact", "phone", "call", "talk"], type: "contacto" },
    { keys: ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hey", "saludos", "hello", "hi ", "good morning"], type: "saludo" },
    { keys: ["gracias", "genial", "perfecto", "excelente", "thank", "great", "awesome", "cool"], type: "gracias" },
    { keys: ["adios", "chao", "hasta luego", "nos vemos", "bye", "goodbye", "see you"], type: "bye" },
    { keys: ["quien eres", "quienes son", "sobre ti", "que es cdh", "who are", "about you"], type: "quien" },
    { keys: ["si", "claro", "dale", "listo", "ok", "vale", "yes", "sure", "yeah"], type: "si" },
    { keys: ["no ", "nope", "todavia no", "not yet"], type: "no" },
  ];

  function detectIntent(text) {
    const t = " " + norm(text) + " ";
    let best = null, bestScore = 0;
    for (const intent of INTENTS) {
      let score = 0;
      for (const k of intent.keys) {
        if (t.includes(norm(k))) score += k.length > 4 ? 2 : 1; // frases largas pesan más
      }
      if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best;
  }

  // ---------- Estado ----------
  let lastService = null;
  let askedProject = false;
  let greeted = false;

  // ---------- UI ----------
  const root = document.createElement("div");
  root.id = "cdh-chat";
  root.innerHTML = `
    <button id="cdh-chat-fab" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="cdh-fab-badge">1</span>
    </button>
    <div id="cdh-chat-panel" hidden>
      <div class="cdh-chat-header">
        <div class="cdh-chat-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5z"/><path d="M12 22V12"/><path d="M3 7l9 5 9-5"/></svg>
        </div>
        <div>
          <strong>Maker</strong>
          <span id="cdh-chat-sub">Asesor de CDH Maker · en línea</span>
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

  // Sincronizar textos de la interfaz del chat con el idioma
  function syncUiLang() {
    const T = TEXT[lang()];
    document.getElementById("cdh-chat-sub").textContent = T.header_sub;
    input.placeholder = T.placeholder;
    fab.setAttribute("aria-label", T.open_label);
    document.getElementById("cdh-chat-close").setAttribute("aria-label", T.close_label);
  }
  window.addEventListener("cdh:langchange", syncUiLang);

  function addMsg(html, who) {
    const div = document.createElement("div");
    div.className = "cdh-msg " + who;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function botSay(html, extraDelay) {
    return new Promise((res) => {
      const typing = addMsg('<span class="cdh-typing"><i></i><i></i><i></i></span>', "bot");
      // Retardo proporcional al largo del texto: se siente más humano
      const delay = Math.min(450 + html.replace(/<[^>]+>/g, "").length * 9, 1900) + (extraDelay || 0);
      setTimeout(() => {
        typing.innerHTML = html;
        msgs.scrollTop = msgs.scrollHeight;
        res();
      }, delay);
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

  function waButton(text, msg) {
    return `<a class="cdh-wa-btn" href="${waLink(msg)}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
      ${text}</a>`;
  }

  function backQuick(T) {
    return [{ label: T.back, action: { type: "menu" } }];
  }

  async function respond(action, rawText) {
    const T = TEXT[lang()];

    if (action.type === "svc") {
      const s = T.services[action.svc];
      lastService = action.svc;
      askedProject = true;
      await botSay(s.pitch);
      await botSay(s.hook);
      setQuick([
        { label: T.quote_wa, action: { type: "wa" } },
        { label: T.how_long, action: { type: "tiempo" } },
        ...backQuick(T),
      ]);
      return;
    }

    switch (action.type) {
      case "saludo":
        await botSay(greeted ? pick(T.re_greeting) : pick(T.greeting));
        greeted = true;
        setQuick(T.menu);
        break;

      case "precio": {
        const svc = lastService ? T.services[lastService] : null;
        askedProject = true;
        await botSay(pick(T.price));
        const msg = svc ? svc.waMsg : T.wa_quote_generic;
        await botSay(T.price_cta + "<br>" + waButton(T.quote_wa, msg));
        setQuick(backQuick(T));
        break;
      }

      case "caro":
        await botSay(T.expensive);
        await botSay(waButton(T.quote_wa, lastService ? T.services[lastService].waMsg : T.wa_quote_generic));
        setQuick(backQuick(T));
        break;

      case "tiempo":
        await botSay(T.time);
        await botSay(T.time_cta + "<br>" + waButton(T.quote_wa, lastService ? T.services[lastService].waMsg : T.wa_quote_generic));
        setQuick(backQuick(T));
        break;

      case "contacto":
      case "humano":
        await botSay(action.type === "humano" ? T.human : T.contact);
        await botSay(waButton(T.open_wa, T.contact_wa_msg));
        setQuick(backQuick(T));
        break;

      case "donde":
        await botSay(T.where);
        setQuick(T.menu);
        break;

      case "quien":
        await botSay(T.who);
        setQuick(T.menu);
        break;

      case "gracias":
        await botSay(pick(T.thanks));
        setQuick(T.menu);
        break;

      case "bye":
        await botSay(pick(T.bye));
        setQuick(T.menu);
        break;

      case "si":
        await botSay(T.yes);
        setQuick(T.menu);
        break;

      case "no":
        await botSay(T.no_worries);
        setQuick(T.menu);
        break;

      case "menu":
        await botSay(lang() === "es" ? "Claro, estos son nuestros servicios. ¿Cuál te llama la atención?" : "Sure — here's what we do. Which one catches your eye?");
        setQuick(T.menu);
        break;

      case "wa": {
        const msg = lastService ? T.services[lastService].waMsg : T.wa_quote_generic;
        await botSay(waButton(T.open_wa, msg));
        setQuick(backQuick(T));
        break;
      }

      default: {
        if (askedProject && rawText && rawText.trim().length > 12) {
          const base = lastService ? T.services[lastService].waMsg : T.wa_quote_generic;
          await botSay(pick(T.captured));
          await botSay(waButton(T.send_project, base + rawText));
          setQuick(backQuick(T));
        } else {
          await botSay(T.fallback + "<br>" + waButton(T.ask_direct, T.wa_generic + (rawText || "")));
          setQuick(T.menu);
        }
      }
    }
  }

  function handleUser(text, forcedAction) {
    addMsg(esc(text), "user");
    quick.innerHTML = "";
    let action = forcedAction || detectIntent(text) || { type: "fallback" };
    // Si ya pedimos la descripción y el texto es sustancioso, capturarlo
    // aunque contenga palabras de servicio (afinando el servicio detectado).
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
    syncUiLang();
    if (!started) {
      started = true;
      greeted = true;
      const T = TEXT[lang()];
      botSay(pick(T.greeting)).then(() => setQuick(T.menu));
    }
    input.focus();
  }
  function closeChat() {
    panel.hidden = true;
    fab.classList.remove("open");
  }
  fab.addEventListener("click", () => (panel.hidden ? openChat() : closeChat()));
  document.getElementById("cdh-chat-close").addEventListener("click", closeChat);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closeChat();
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !root.contains(e.target)) closeChat();
  });

  syncUiLang();
})();
