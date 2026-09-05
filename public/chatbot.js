/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chatbot.js  v14
   "Maker": asesor comercial virtual. Motor 100% texto, sin voz.

   Diseño conversacional:
   - Los textos del KB son coherentes por sí solos; no se alteran con prefijos.
   - La memoria se usa silenciosamente (enriquecer el mensaje de WhatsApp),
     nunca se inyecta como texto en los mensajes del chat.
   - Se recuerda el servicio activo y los detalles del proyecto para
     personalizar la cotización enviada a Henry.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ---------- Utilidades ----------
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const waLink  = (msg) => (window.CDH_CONTACT && window.CDH_CONTACT.waUrl) ? window.CDH_CONTACT.waUrl(msg) : "#";
  const pick  = (arr) => Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : (arr || "");
  const esc   = (s)   => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lang  = ()    => (document.documentElement.lang || "es").toLowerCase();

  function safeBtoa(str) {
    try { return btoa(unescape(encodeURIComponent(str || ""))); } catch (_) { return ""; }
  }
  function safeAtob(b64) {
    try { return decodeURIComponent(escape(atob(b64 || ""))); } catch (_) { return ""; }
  }

  // ---------- MEMORIA (silenciosa — solo enriquece el WA, no el chat) ----------
  // Palabras que indican una pregunta, no descripción de proyecto
  const QUESTION_MARKERS = [
    "cuanto","cuánto","cómo","como","qué","que","cuando","cuándo","donde","dónde",
    "por qué","porque","tienen","hacen","puedes","pueden","es posible","hay",
    "how","what","when","where","why","do you","can you","is it","are you"
  ];

  const TECH_WORDS = [
    "flutter","react","angular","vue","svelte","nextjs","next.js","node","python",
    "django","laravel","php","mysql","postgresql","mongo","firebase","supabase",
    "arduino","esp32","raspberry","pla","petg","abs","tpu","nylon","resin",
    "autocad","solidworks","fusion 360","freecad","tensorflow","pytorch"
  ];

  function isQuestion(txt) {
    const n = norm(txt);
    return QUESTION_MARKERS.some((q) => n.startsWith(q) || n.includes(" " + q + " ")) || /[?¿]/.test(txt);
  }

  const memory = {
    service: null,
    serviceName: null,
    product: null,
    details: [],
    techMentioned: [],
    askedProject: false,
    greeted: false,

    rememberService(svcKey, name) {
      if (!svcKey) return;
      this.service = svcKey;
      if (name) this.serviceName = name;
      this.askedProject = true;
      this.save();
    },
    rememberProduct(prodKey) {
      if (prodKey) { this.product = prodKey; this.save(); }
    },
    rememberDetail(txt) {
      // Solo guardar si es descripción real (no pregunta, longitud mínima)
      if (!txt || txt.trim().length < 15 || isQuestion(txt)) return;
      const clean = txt.trim().replace(/\s+/g, " ");
      if (!this.details.some((d) => d.toLowerCase() === clean.toLowerCase())) {
        this.details.push(clean);
        if (this.details.length > 3) this.details.shift();
      }
      // Capturar tecnologías
      const n = norm(clean);
      for (const tech of TECH_WORDS) {
        if (n.includes(norm(tech)) && !this.techMentioned.includes(tech)) {
          this.techMentioned.push(tech);
        }
      }
      this.save();
    },
    buildWaContext() {
      // Construye el contexto para añadir al mensaje de WA
      const parts = [];
      if (this.serviceName) parts.push(this.serviceName);
      if (this.techMentioned.length) parts.push(this.techMentioned.slice(0,2).join("+"));
      if (this.details.length) parts.push(this.details.slice(-1)[0]);
      return parts.join(" · ");
    },
    buildWaMessage(baseMsg, extraInput) {
      let msg = baseMsg || "";
      const ctx = this.buildWaContext();
      if (ctx && !msg.toLowerCase().includes(ctx.slice(0,10).toLowerCase())) {
        msg += ctx;
      }
      if (extraInput && extraInput.trim().length > 12 && !isQuestion(extraInput)) {
        const clean = extraInput.trim();
        const cleanNorm = norm(clean).slice(0, 20);
        if (!norm(msg).includes(cleanNorm)) {
          msg += (msg.endsWith(":") || msg.endsWith(" ") ? " " : " — ") + clean;
        }
      }
      return msg;
    },
    save() {
      try {
        sessionStorage.setItem("cdh_maker_memory", JSON.stringify({
          service: this.service, serviceName: this.serviceName,
          product: this.product, details: this.details,
          techMentioned: this.techMentioned,
          askedProject: this.askedProject, greeted: this.greeted,
        }));
      } catch (_) {}
    },
    load() {
      try {
        const raw = sessionStorage.getItem("cdh_maker_memory");
        if (!raw) return;
        const d = JSON.parse(raw);
        this.service      = d.service      || null;
        this.serviceName  = d.serviceName  || null;
        this.product      = d.product      || null;
        this.details      = Array.isArray(d.details)       ? d.details       : [];
        this.techMentioned= Array.isArray(d.techMentioned) ? d.techMentioned : [];
        this.askedProject = !!d.askedProject;
        this.greeted      = !!d.greeted;
      } catch (_) {}
    },
  };
  memory.load();

  // ---------- Carga bajo demanda de la KB ----------
  let kbPromise = null;
  function ensureKB() {
    if (window.CDH_KB) return Promise.resolve(window.CDH_KB);
    if (kbPromise) return kbPromise;
    kbPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "chatbot-kb.js?v=5";
      s.async = true;
      s.onload  = () => resolve(window.CDH_KB || null);
      s.onerror = () => { s.remove(); resolve(null); };
      document.head.appendChild(s);
    });
    // No cachear el fallo: si la descarga se cayó por un corte momentáneo,
    // el siguiente mensaje debe volver a pedir el archivo en vez de quedar
    // con el chat muerto para el resto de la visita.
    return kbPromise.then((kb) => { if (!kb) kbPromise = null; return kb; });
  }

  // Aviso mínimo cuando la base de conocimiento no llegó (sin red, CDN caído).
  // Se escribe en el idioma del visitante: es lo único que no vive en el KB,
  // justamente porque hace falta cuando el KB no está.
  const SIN_KB = {
    es: "Se me cayó la conexión y no pude cargar mis respuestas. Recarga la página o escríbele a Henry desde la sección de contacto.",
    en: "My connection dropped and I couldn't load my answers. Reload the page, or write to Henry from the contact section.",
    pt: "Minha conexão caiu e não consegui carregar as respostas. Recarregue a página ou fale com o Henry na seção de contato.",
    fr: "Ma connexion a lâché et je n'ai pas pu charger mes réponses. Rechargez la page ou écrivez à Henry depuis la section contact.",
    ru: "Соединение прервалось, и я не смог загрузить ответы. Перезагрузите страницу или напишите Генри в разделе контактов.",
    zh: "我的连接中断了，没能加载回答。请刷新页面，或在联系板块联系 Henry。",
    hi: "मेरा कनेक्शन टूट गया और मैं उत्तर लोड नहीं कर सका। पेज दोबारा लोड करें या संपर्क अनुभाग से Henry को लिखें।",
    ar: "انقطع الاتصال ولم أتمكن من تحميل إجاباتي. أعد تحميل الصفحة أو راسل هنري من قسم التواصل.",
    bn: "আমার সংযোগ বিচ্ছিন্ন হয়েছে, উত্তরগুলো লোড করতে পারিনি। পাতাটি রিলোড করুন বা যোগাযোগ অংশ থেকে Henry-কে লিখুন।",
    id: "Koneksi saya terputus dan jawaban saya gagal dimuat. Muat ulang halaman, atau hubungi Henry lewat bagian kontak.",
  };
  const avisoSinKB = () => SIN_KB[lang().split("-")[0]] || SIN_KB.es;

  function getLangKB() {
    if (!window.CDH_KB || !window.CDH_KB.L) return null;
    const l = lang(), code = l.split("-")[0];
    return window.CDH_KB.L[l] || window.CDH_KB.L[code] || window.CDH_KB.L.es;
  }

  // ---------- Similitud Dice ----------
  function dice(a, b) {
    if (a === b) return 1;
    if (a.length < 3 || b.length < 3) return 0;
    const pares = (s) => { const o = []; for (let i = 0; i < s.length - 1; i++) o.push(s.slice(i,i+2)); return o; };
    const pa = pares(a), pb = pares(b);
    let c = 0; const used = new Array(pb.length).fill(false);
    for (const p of pa) { const j = pb.findIndex((q,i)=>!used[i]&&q===p); if (j!==-1){used[j]=true;c++;} }
    return (2*c)/(pa.length+pb.length);
  }
  function tokenParecido(tokens, clave) {
    return tokens.some((tk) => Math.abs(tk.length-clave.length)<=3 && dice(tk,clave)>=0.82);
  }

  // ---------- Detección de intenciones ----------
  function detectIntent(text) {
    if (!window.CDH_KB || !window.CDH_KB.intents) return null;
    const limpio = norm(text).replace(/[¿?¡!.,;]/g," ").replace(/\s+/g," ").trim();
    const t = " " + limpio + " ";
    const tokens = limpio.split(" ").filter((w) => w.length > 2);
    const l = lang().split("-")[0];
    let best = null, bestScore = 0;
    for (const intent of window.CDH_KB.intents) {
      let score = 0;
      // La coincidencia aproximada se acumula aparte: solo cuenta si la
      // intención NO tuvo ningún acierto exacto. Si no, plurales como
      // "paginas"≈"pagina" sumaban un punto extra sobre el acierto real y
      // desempataban mal (una pregunta de precio acababa en el servicio).
      let difusa = 0, exacto = false;
      // Universales + idioma del visitante + inglés SIEMPRE: el vocabulario
      // técnico ("print", "hosting", "sensor") aparece en cualquier idioma,
      // y antes se perdía porque el || cortaba en cuanto había claves propias.
      let keys = (intent.k.any||[]).concat(intent.k[l]||[]);
      if (l !== "en" && intent.k.en) keys = keys.concat(intent.k.en);
      if (!intent.k[l] && l !== "es" && intent.k.es) keys = keys.concat(intent.k.es);
      for (const k of keys) {
        const nk = norm(k).trim();
        if (!nk) continue;

        // Chino, japonés, hindi, árabe, bengalí… no separan palabras con
        // espacios: exigirles coincidencia de palabra completa las dejaba
        // SIEMPRE en cero y todo caía al fallback. Van por subcadena directa.
        if (!/[a-z]/.test(nk)) {
          if (limpio.includes(nk)) { score += nk.length > 2 ? 3 : 2; exacto = true; }
          continue;
        }
        // Claves latinas cortas: palabra completa (si no, "si" entra en "sitio")
        if (nk.length <= 3) {
          if (t.includes(" " + nk + " ")) { score += 2; exacto = true; }
          continue;
        }
        if (t.includes(nk)) {
          exacto = true;
          // Una clave de varias palabras ("cuanto cuesta") es mucho más
          // específica que una suelta ("web"): debe pesar más, o una pregunta
          // de precio sobre un servicio acababa contestando sobre el servicio.
          score += nk.includes(" ") ? 5 : nk.length > 6 ? 3 : 2;
        } else if (nk.length >= 5 && !nk.includes(" ") && tokenParecido(tokens, nk)) {
          difusa = 1; // rescate de erratas ("pagian" ≈ "pagina")
        }
      }
      if (!exacto) score += difusa;
      if (score > bestScore) { best=intent; bestScore=score; }
    }
    // Umbral mínimo para evitar falsos positivos con palabras muy cortas
    return bestScore >= 2 ? best : null;
  }

  function nombreCliente() {
    try {
      const u = window.CDH_AUTH && window.CDH_AUTH.getUser && window.CDH_AUTH.getUser();
      if (!u || !u.name) return "";
      const p = String(u.name).trim().split(/\s+/)[0];
      // \p{L} acepta cualquier alfabeto: el sitio habla 10 idiomas y un
      // nombre en cirílico, árabe o chino es tan válido como uno latino.
      return /^\p{L}{2,15}$/u.test(p) ? p.charAt(0).toUpperCase()+p.slice(1).toLowerCase() : "";
    } catch(_){ return ""; }
  }

  // ---------- UI ----------
  const root = document.createElement("div");
  root.id = "cdh-chat";
  root.innerHTML = `
    <button id="cdh-chat-fab" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="cdh-fab-badge">1</span>
    </button>
    <div id="cdh-chat-panel" role="dialog" aria-modal="false" aria-label="Chat con Maker" hidden>
      <div class="cdh-chat-header">
        <div class="cdh-chat-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5z"/><path d="M12 22V12"/><path d="M3 7l9 5 9-5"/></svg>
        </div>
        <div><strong>Maker</strong><span id="cdh-chat-sub">Asesor de CDH Maker · en línea</span></div>
        <button id="cdh-chat-close" aria-label="Cerrar chat">✕</button>
      </div>
      <div class="cdh-chat-msgs" id="cdh-chat-msgs" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="cdh-chat-quick" id="cdh-chat-quick" aria-label="Respuestas rápidas"></div>
      <form class="cdh-chat-input" id="cdh-chat-form">
        <input type="text" id="cdh-chat-text" placeholder="Escribe tu mensaje…" autocomplete="off" maxlength="300"/>
        <button type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const fab   = document.getElementById("cdh-chat-fab");
  const panel = document.getElementById("cdh-chat-panel");
  const msgs  = document.getElementById("cdh-chat-msgs");
  const quick = document.getElementById("cdh-chat-quick");
  const form  = document.getElementById("cdh-chat-form");
  const input = document.getElementById("cdh-chat-text");

  function syncUiLang() {
    const lKB = getLangKB(); if (!lKB) return;
    const ui = lKB.ui || {};
    const sub = document.getElementById("cdh-chat-sub");
    if (sub && ui.sub)          sub.textContent = ui.sub;
    if (input && ui.placeholder) input.placeholder = ui.placeholder;
    if (fab && ui.open)          fab.setAttribute("aria-label", ui.open);
    const cb = document.getElementById("cdh-chat-close");
    if (cb && ui.close)          cb.setAttribute("aria-label", ui.close);
    if (panel && ui.chat)        panel.setAttribute("aria-label", ui.chat);
    if (quick && ui.quick)       quick.setAttribute("aria-label", ui.quick);
  }
  window.addEventListener("cdh:langchange", syncUiLang);
  window.addEventListener("cdh:authchange", syncUiLang);

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
      const plain  = String(html).replace(/<[^>]+>/g, "");
      const delay  = Math.min(300 + plain.length * 7, 1600) + (extraDelay || 0);
      setTimeout(() => {
        typing.innerHTML = html;
        msgs.scrollTop   = msgs.scrollHeight;
        res();
      }, delay);
    });
  }

  function setQuick(options) {
    quick.innerHTML = "";
    options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = o.label;
      b.addEventListener("click", () => handleUser(o.label, o.action));
      quick.appendChild(b);
    });
  }

  function waButton(text, msg) {
    const b64 = safeBtoa(msg || "");
    return `<button type="button" class="cdh-wa-btn cdh-wa-trigger" data-wa-msg="${b64}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
      ${text}</button>`;
  }

  function getMenuOptions(lKB) {
    const btn   = (lKB && lKB.btn)  || {};
    const svc   = (lKB && lKB.svc)  || {};
    const esSvc = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.svc) || {};
    return [
      { label: (svc.web         && svc.web.name)         || (esSvc.web         && esSvc.web.name)         || "Web y software",            action: { type:"svc", svc:"web" } },
      { label: (svc.maker       && svc.maker.name)       || (esSvc.maker       && esSvc.maker.name)       || "Impresión 3D · Láser · CNC", action: { type:"svc", svc:"maker" } },
      { label: (svc.iot         && svc.iot.name)         || (esSvc.iot         && esSvc.iot.name)         || "Electrónica e IoT",          action: { type:"svc", svc:"iot" } },
      { label: (svc.consultoria && svc.consultoria.name) || (esSvc.consultoria && esSvc.consultoria.name) || "Diseño y asesorías",         action: { type:"svc", svc:"consultoria" } },
      { label: btn.talk_henry || "Hablar con Henry", action: { type:"topic", topic:"contacto" } },
    ];
  }

  function backQuick(btn) {
    return [{ label: (btn && btn.back) || "Ver otros servicios", action: { type:"topic", topic:"menu" } }];
  }

  function svcButtons(btn) {
    const quoteLbl = memory.serviceName
      ? ((btn && btn.quote) || "Cotizar") + " · " + memory.serviceName
      : (btn && btn.quote) || "Cotizar por WhatsApp";
    return [
      { label: quoteLbl, action: { type:"wa" } },
      { label: (btn && btn.how_long) || "¿Cuánto se demora?", action: { type:"topic", topic:"tiempo" } },
      ...backQuick(btn),
    ];
  }

  function getTextVal(val) {
    if (!val) return "";
    if (Array.isArray(val)) return pick(val);
    if (typeof val === "object" && val.a) return Array.isArray(val.a) ? pick(val.a) : String(val.a);
    return String(val);
  }

  // Obtiene objeto de servicio activo en el idioma correcto
  function getActiveSvc(lKB) {
    if (!memory.service) return null;
    const esSvc = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.svc) || {};
    return (lKB && lKB.svc && lKB.svc[memory.service]) || esSvc[memory.service] || null;
  }

  // Respuesta genérica de un topic que existe en t[key]
  async function replyTopic(key, lKB, btn) {
    const t   = (lKB && lKB.t)   || {};
    const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};
    const val = t[key] || esT[key];
    if (!val) return false;
    if (typeof val === "object" && !Array.isArray(val) && val.url && val.cta) {
      await botSay(getTextVal(val.a || val));
      await botSay(`<a class="cdh-wa-btn" href="${val.url}" target="_blank" rel="noopener">${val.cta}</a>`);
    } else {
      await botSay(getTextVal(val));
    }
    setQuick(backQuick(btn));
    return true;
  }

  // ---------- Motor de respuesta ----------
  async function respond(action, rawText) {
    const lKB  = getLangKB();
    const btn  = (lKB && lKB.btn) || {};
    const t    = (lKB && lKB.t)   || {};
    const wa   = (lKB && lKB.wa)  || {};
    const esL  = window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es;
    const esT  = (esL && esL.t)   || {};
    const esSvc= (esL && esL.svc) || {};

    // ── Servicio seleccionado ─────────────────────────────────────────────────
    if (action.type === "svc") {
      const s = (lKB && lKB.svc && lKB.svc[action.svc]) || esSvc[action.svc];
      memory.rememberService(action.svc, s ? s.name : action.svc);
      if (s) {
        await botSay(s.pitch);
        await botSay(s.hook);
      }
      setQuick(svcButtons(btn));
      return;
    }

    const topicKey = action.topic || action.type;

    switch (topicKey) {

      case "saludo": {
        const h  = new Date().getHours();
        const hi = h < 12 ? (t.good_morning||"¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon||"¡Buenas tardes!") : (t.good_evening||"¡Buenas noches! 🌙");
        if (memory.greeted) {
          await botSay(pick(t.re_greeting || esT.re_greeting || ["¡Hola de nuevo! 😄 ¿En qué te ayudo?"]));
        } else {
          memory.greeted = true;
          memory.save();
          await botSay(hi + " " + pick(t.greeting || esT.greeting || ["Soy Maker, asesor de CDH Maker. ¿En qué te ayudo?"]));
        }
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "comoestas":
        await botSay(pick(t.comoestas || esT.comoestas || ["¡Muy bien, gracias! 😊 ¿En qué proyecto andas?"]));
        setQuick(getMenuOptions(lKB));
        break;

      case "bot":
        await botSay(getTextVal(t.bot || esT.bot || "Soy un asistente virtual de CDH Maker. Cuando quieras hablar con Henry, el humano real, te paso con él."));
        setQuick(memory.service ? svcButtons(btn) : getMenuOptions(lKB));
        break;

      case "gracias":
        await botSay(pick(t.thanks || esT.thanks || ["¡Con gusto! 😊 ¿Algo más en lo que te pueda ayudar?"]));
        setQuick(memory.service ? svcButtons(btn) : getMenuOptions(lKB));
        break;

      case "bye":
        await botSay(pick(t.bye || esT.bye || ["¡Que te vaya muy bien! 👋 Aquí estaré cuando quieras retomar tu proyecto."]));
        // Se deja el menú a la vista: una despedida no debe dejar el chat
        // sin salida si el visitante cambia de idea y quiere seguir.
        setQuick(getMenuOptions(lKB));
        break;

      case "si":
        await botSay(getTextVal(t.yes || esT.yes || "¡Perfecto! ¿Qué más necesitas saber?"));
        setQuick(memory.service ? svcButtons(btn) : getMenuOptions(lKB));
        break;

      case "no":
        await botSay(getTextVal(t.no_worries || esT.no_worries || "Sin problema. Aquí estoy cuando lo necesites:"));
        setQuick(getMenuOptions(lKB));
        break;

      case "ayuda":
        await botSay(getTextVal(t.ayuda || esT.ayuda));
        setQuick(getMenuOptions(lKB));
        break;

      case "menu":
        await botSay(lang().startsWith("es") ? "Estos son nuestros servicios:" : "Here are our services:");
        setQuick(getMenuOptions(lKB));
        break;

      case "precio": {
        const s = getActiveSvc(lKB);
        await botSay(pick(t.precio || esT.precio || "La cotización es personalizada y gratis, con respuesta en menos de 24 horas."));
        const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay((t.price_cta || esT.price_cta || "Te dejo el acceso directo para cotizarlo gratis:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", memory.buildWaMessage(base, null)));
        setQuick(backQuick(btn));
        break;
      }

      case "caro": {
        const s = getActiveSvc(lKB);
        await botSay(getTextVal(t.caro || esT.caro));
        const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay(waButton(btn.quote || "Cotizar por WhatsApp", memory.buildWaMessage(base, null)));
        setQuick(backQuick(btn));
        break;
      }

      case "tiempo": {
        const s = getActiveSvc(lKB);
        let answer = getTextVal(t.tiempo || esT.tiempo);
        if (memory.serviceName) answer = `En <b>${memory.serviceName}</b>: ` + answer;
        await botSay(answer);
        const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay((t.time_cta || esT.time_cta || "¿Quieres que te cotice el tuyo?") + "<br>" + waButton(btn.quote || "Cotizar gratis", memory.buildWaMessage(base, null)));
        setQuick(backQuick(btn));
        break;
      }

      case "pago":
        await botSay(getTextVal(t.pago || esT.pago));
        setQuick(backQuick(btn));
        break;

      case "garantia":
        await botSay(getTextVal(t.garantia || esT.garantia));
        setQuick(backQuick(btn));
        break;

      case "contacto":
      case "humano": {
        await botSay(getTextVal(topicKey === "humano" ? (t.humano || esT.humano) : (t.contacto || esT.contacto)));
        const base = wa.contact || "Hola Henry, vengo de tu página y quiero hablar contigo.";
        await botSay(waButton(btn.open_wa || "Abrir WhatsApp", memory.buildWaMessage(base, null)));
        setQuick(backQuick(btn));
        break;
      }

      case "queja":
        await botSay(getTextVal(t.queja || esT.queja));
        await botSay(waButton(btn.open_wa || "Escribirle a Henry", memory.buildWaMessage(wa.generic || "Hola Henry, tengo un reclamo: ", rawText && !isQuestion(rawText) ? rawText : null)));
        setQuick(backQuick(btn));
        break;

      case "trabajo":
        await botSay(getTextVal(t.trabajo || esT.trabajo));
        await botSay(waButton(btn.open_wa || "Escribirle a Henry", wa.generic || "Hola Henry, me interesa colaborar con CDH Maker."));
        setQuick(backQuick(btn));
        break;

      case "portafolio": {
        // Mostrar proyecto relevante si hay servicio activo
        const relevantMap = { web: "privacycheck", iot: "incubapp" };
        const featured = memory.service && relevantMap[memory.service];
        const featuredVal = featured && (t[featured] || esT[featured]);
        if (featuredVal && featuredVal.url) {
          await botSay(getTextVal(featuredVal.a || featuredVal));
          await botSay(`<a class="cdh-wa-btn" href="${featuredVal.url}" target="_blank" rel="noopener">${featuredVal.cta || "Ver →"}</a>`);
          await botSay(getTextVal(t.portafolio || esT.portafolio));
        } else {
          await botSay(getTextVal(t.portafolio || esT.portafolio));
        }
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "wa": {
        const s = getActiveSvc(lKB);
        const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay(waButton(btn.open_wa || "Abrir WhatsApp", memory.buildWaMessage(base, null)));
        setQuick(backQuick(btn));
        break;
      }

      default: {
        // 1. Intentar responder con el topic de la KB
        const handled = await replyTopic(topicKey, lKB, btn);
        if (handled) break;

        // 2. Si el usuario describió su proyecto (no es pregunta), capturarlo
        if (memory.askedProject && rawText && rawText.trim().length > 15 && !isQuestion(rawText)) {
          memory.rememberDetail(rawText);
          const s    = getActiveSvc(lKB);
          const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
          await botSay(pick(t.captured || esT.captured || ["¡Entendido! Te dejé el mensaje listo para enviarle a Henry:"]));
          await botSay(waButton(btn.send_project || "Enviar mi proyecto por WhatsApp", memory.buildWaMessage(base, rawText)));
          setQuick(backQuick(btn));
        } else {
          // 3. Fallback genérico — no mostrar WA automáticamente, ofrecer menú
          await botSay(pick(t.fallback || esT.fallback || ["No tengo una respuesta exacta para eso. Puedo orientarte mejor si me cuentas qué necesitas o si eliges un servicio:"]));
          setQuick(getMenuOptions(lKB));
        }
      }
    }
  }

  // ---------- Manejo de mensajes ----------
  // Cadena de turnos: cada respuesta espera a que termine la anterior.
  // Sin esto, dos clics seguidos en las respuestas rápidas lanzaban dos
  // respond() en paralelo y sus mensajes se intercalaban en pantalla.
  let turno = Promise.resolve();

  function handleUser(text, forcedAction) {
    addMsg(esc(text), "user");
    quick.innerHTML = "";

    // Solo guardar detalles del usuario cuando describe un proyecto libremente
    if (!forcedAction && memory.askedProject && text && text.trim().length > 15 && !isQuestion(text)) {
      memory.rememberDetail(text);
    }

    turno = turno.then(() => ensureKB()).then((kb) => {
      if (!kb) return botSay(avisoSinKB());
      let matched = detectIntent(text);
      let action = forcedAction || (matched
        ? { type: matched.t.startsWith("svc:") ? "svc" : "topic",
            topic: matched.t.startsWith("svc:") ? null : matched.t,
            svc:   matched.t.startsWith("svc:") ? matched.t.split(":")[1] : null }
        : { type: "topic", topic: "none" });

      // Si detecta un servicio pero ya hay proyecto activo, tratar como captura
      if (!forcedAction && memory.askedProject && action.type === "svc" && text.trim().length > 15) {
        memory.rememberService(action.svc);
        action = { type: "topic", topic: "none" };
      }

      return respond(action, text);
    }).catch(() => { /* un turno fallido no debe romper la conversación */ });

    return turno;
  }

  // ---------- Eventos ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    handleUser(v);
  });

  msgs.addEventListener("click", (e) => {
    const waBtn = e.target.closest(".cdh-wa-trigger");
    if (waBtn) {
      e.preventDefault();
      const msg  = safeAtob(waBtn.getAttribute("data-wa-msg"));
      const href = waLink(msg);
      if (href !== "#") window.open(href, "_blank", "noopener,noreferrer");
    }
  });

  function openChat() {
    panel.hidden = false;
    fab.classList.add("open");
    const badge = fab.querySelector(".cdh-fab-badge");
    if (badge) badge.style.display = "none";

    // El saludo depende de si HAY mensajes en pantalla, no de memory.greeted:
    // ese flag vive en sessionStorage, así que tras recargar la página seguía
    // en true y el chat se abría vacío y sin botones, sin salida posible.
    const vacio = msgs.children.length === 0;
    if (!vacio) { enfocar(); return; }

    turno = turno.then(() => ensureKB()).then((kb) => {
      syncUiLang();
      if (!kb) return botSay(avisoSinKB());

      const lKB = getLangKB();
      const t   = (lKB && lKB.t) || {};
      const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};

      // Ya se había saludado en esta sesión (otra pestaña o recarga):
      // se retoma en vez de repetir la presentación completa.
      if (memory.greeted) {
        return botSay(pick(t.re_greeting || esT.re_greeting || ["¡Hola de nuevo! 😄 ¿En qué te ayudo?"]))
          .then(() => setQuick(getMenuOptions(lKB)));
      }

      memory.greeted = true;
      memory.save();
      const h  = new Date().getHours();
      const hi = h < 12 ? (t.good_morning||"¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon||"¡Buenas tardes!") : (t.good_evening||"¡Buenas noches! 🌙");
      const quien  = nombreCliente();
      // [!！] cubre también el signo de ancho completo del chino
      const saludo = quien ? hi.replace(/[!！]/, ", " + quien + "!") : hi;
      const gList  = t.greeting || esT.greeting || ["Soy Maker, asesor de CDH Maker. ¿En qué te ayudo?"];
      return botSay(saludo + " " + pick(gList)).then(() => setQuick(getMenuOptions(lKB)));
    }).catch(() => { });

    enfocar();
  }

  // En móvil no se fuerza el foco: abriría el teclado tapando la conversación
  function enfocar() {
    try {
      if (window.matchMedia("(hover: hover)").matches) input.focus();
    } catch (_) { input.focus(); }
  }

  function closeChat() {
    panel.hidden = true;
    fab.classList.remove("open");
  }

  fab.addEventListener("click", () => (panel.hidden ? openChat() : closeChat()));
  document.getElementById("cdh-chat-close").addEventListener("click", closeChat);
  document.addEventListener("keydown",     (e) => { if (e.key === "Escape" && !panel.hidden) closeChat(); });
  document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !root.contains(e.target)) closeChat(); });

  ensureKB().then(() => syncUiLang());
})();
