/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chatbot.js  (perfeccionado)
   "Maker": asesor comercial virtual de CDH Maker.

   Motor conversacional 100% texto con MEMORIA AVANZADA de contexto:
   - Recuerda servicios, productos, detalles y tecnologías mencionadas.
   - Conecta preguntas (precios, tiempos, garantía) con el contexto del proyecto.
   - Construye enlaces de WhatsApp enriquecidos con todo el resumen.
   - Switch completo: todos los intents de la KB tienen su case explícito.
   - Sin sintetizador de voz (eliminado en v11).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-08-05
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ---------- Utilidades ----------
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const isAuthed = () => !!(window.CDH_AUTH && window.CDH_AUTH.isLoggedIn && window.CDH_AUTH.isLoggedIn());
  const waLink  = (msg) => (window.CDH_AUTH && window.CDH_AUTH.CONTACT && window.CDH_AUTH.CONTACT.buildWa)
    ? window.CDH_AUTH.CONTACT.buildWa(msg) || "#"
    : "#";
  const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : arr);
  const esc  = (s)   => String(s || "").replace(/</g, "&lt;");

  function safeBtoa(str) {
    try { return btoa(unescape(encodeURIComponent(str || ""))); } catch (_) { return ""; }
  }
  function safeAtob(b64) {
    try { return decodeURIComponent(escape(atob(b64 || ""))); } catch (_) { return ""; }
  }

  const lang = () => (document.documentElement.lang || "es").toLowerCase();

  // ---------- MEMORIA CONVERSACIONAL ----------
  const TECH_WORDS = [
    "flutter", "react", "angular", "vue", "svelte", "next.js", "nextjs", "node",
    "python", "django", "laravel", "php", "mysql", "postgresql", "mongo",
    "firebase", "supabase", "vercel", "netlify", "docker", "kubernetes",
    "arduino", "esp32", "raspberry", "mqtt", "lora", "zigbee",
    "pla", "petg", "abs", "tpu", "nylon", "resina", "resin",
    "autocad", "solidworks", "fusion 360", "freecad",
    "tensorflow", "pytorch", "openai", "chatgpt", "llm"
  ];

  const memory = {
    service: null,
    serviceName: null,
    product: null,
    details: [],
    techMentioned: [],
    topicsDiscussed: [],
    turnCount: 0,
    askedProject: false,
    greeted: false,

    rememberService(svcKey, name) {
      if (!svcKey) return;
      this.service = svcKey;
      if (name) this.serviceName = name;
      this.rememberTopic("svc:" + svcKey);
      this.save();
    },
    rememberProduct(prodKey) {
      if (!prodKey) return;
      this.product = prodKey;
      this.save();
    },
    rememberDetail(txt) {
      if (typeof txt !== "string" || txt.trim().length <= 10) return;
      const clean = txt.trim().replace(/\s+/g, " ");
      if (!this.details.some((d) => d.toLowerCase() === clean.toLowerCase())) {
        this.details.push(clean);
        if (this.details.length > 5) this.details.shift();
      }
      // Capturar tecnologías mencionadas
      const lowerTxt = norm(clean);
      for (const tech of TECH_WORDS) {
        if (lowerTxt.includes(norm(tech)) && !this.techMentioned.includes(tech)) {
          this.techMentioned.push(tech);
        }
      }
      this.save();
    },
    rememberTopic(topic) {
      if (topic && !this.topicsDiscussed.includes(topic)) {
        this.topicsDiscussed.push(topic);
        this.save();
      }
    },
    getSummary() {
      const parts = [];
      if (this.serviceName) {
        parts.push(this.serviceName);
      } else if (this.product) {
        parts.push("Proyecto " + this.product);
      }
      if (this.techMentioned.length) {
        parts.push(this.techMentioned.slice(0, 2).join(", "));
      }
      if (this.details.length) {
        parts.push(this.details.slice(-1)[0]);
      }
      return parts.join(" — ");
    },
    buildWaMessage(baseMsg, extraInput) {
      let msg = baseMsg || "";
      const summary = this.getSummary();
      // Agregar resumen solo si no está ya contenido en el mensaje base
      if (summary) {
        const normalizedMsg = norm(msg);
        const normalizedSummary = norm(summary);
        if (!normalizedMsg.includes(normalizedSummary.slice(0, 12))) {
          msg += summary;
        }
      }
      if (extraInput && extraInput.trim().length > 8) {
        const cleanInput = extraInput.trim();
        const normalizedMsg = norm(msg);
        const normalizedInput = norm(cleanInput);
        // Solo añadir si no es substancialmente la misma que lo que ya hay
        if (!normalizedMsg.includes(normalizedInput.slice(0, 15))) {
          msg += (msg.endsWith(":") || msg.endsWith(" ") ? " " : " — ") + cleanInput;
        }
      }
      return msg;
    },
    save() {
      try {
        sessionStorage.setItem("cdh_maker_memory", JSON.stringify({
          service: this.service,
          serviceName: this.serviceName,
          product: this.product,
          details: this.details,
          techMentioned: this.techMentioned,
          topicsDiscussed: this.topicsDiscussed,
          turnCount: this.turnCount,
          askedProject: this.askedProject,
          greeted: this.greeted,
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
        this.details      = Array.isArray(d.details)         ? d.details         : [];
        this.techMentioned= Array.isArray(d.techMentioned)   ? d.techMentioned   : [];
        this.topicsDiscussed = Array.isArray(d.topicsDiscussed) ? d.topicsDiscussed : [];
        this.turnCount    = d.turnCount    || 0;
        this.askedProject = !!d.askedProject;
        this.greeted      = !!d.greeted;
      } catch (_) {}
    }
  };
  memory.load();

  // ---------- Carga bajo demanda de la KB ----------
  let kbPromise = null;
  function ensureKB() {
    if (window.CDH_KB) return Promise.resolve(window.CDH_KB);
    if (kbPromise) return kbPromise;
    kbPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "chatbot-kb.js?v=3";
      s.async = true;
      s.onload  = () => resolve(window.CDH_KB || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return kbPromise;
  }

  function getLangKB() {
    if (!window.CDH_KB || !window.CDH_KB.L) return null;
    const l = lang();
    const code = l.split("-")[0];
    return window.CDH_KB.L[l] || window.CDH_KB.L[code] || window.CDH_KB.L.es;
  }

  // ---------- Similitud Dice (tolerancia a erratas) ----------
  function dice(a, b) {
    if (a === b) return 1;
    if (a.length < 3 || b.length < 3) return 0;
    const pares = (s) => { const out = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
    const pa = pares(a), pb = pares(b);
    let c = 0;
    const used = new Array(pb.length).fill(false);
    for (const p of pa) {
      const j = pb.findIndex((q, i) => !used[i] && q === p);
      if (j !== -1) { used[j] = true; c++; }
    }
    return (2 * c) / (pa.length + pb.length);
  }

  function tokenParecido(tokens, clave) {
    for (const tk of tokens) {
      if (Math.abs(tk.length - clave.length) > 3) continue;
      if (dice(tk, clave) >= 0.82) return true;
    }
    return false;
  }

  // ---------- Detección de intenciones ----------
  function detectIntent(text) {
    if (!window.CDH_KB || !window.CDH_KB.intents) return null;
    const limpio = norm(text).replace(/[¿?¡!.,;]/g, " ").replace(/\s+/g, " ").trim();
    const t = " " + limpio + " ";
    const tokens = limpio.split(" ").filter((w) => w.length > 2);
    const l = lang().split("-")[0];

    let best = null, bestScore = 0;
    for (const intent of window.CDH_KB.intents) {
      let score = 0;
      const keys = (intent.k.any || []).concat(intent.k[l] || intent.k.es || intent.k.en || []);
      for (const k of keys) {
        const nk = norm(k);
        const hit = nk.length <= 3 ? t.includes(" " + nk.trim() + " ") : t.includes(nk);
        if (hit) {
          score += nk.length > 4 ? 2 : 1;
        } else if (nk.length >= 5 && !nk.includes(" ") && tokenParecido(tokens, nk)) {
          score += 1;
        }
      }
      if (score > bestScore) { best = intent; bestScore = score; }
    }
    return best;
  }

  function nombreCliente() {
    try {
      const u = window.CDH_AUTH && window.CDH_AUTH.getUser && window.CDH_AUTH.getUser();
      if (!u || !u.name) return "";
      const p = String(u.name).trim().split(/\s+/)[0];
      return /^[a-záéíóúñü]{2,15}$/i.test(p) ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
    } catch (_) { return ""; }
  }

  let lastConnector = "";
  const CONNECTORS = {
    es: ["Claro, ", "Mira, ", "Te cuento: ", "Perfecto. ", "Buena pregunta. ", "Con gusto. ", "Listo, "],
    en: ["Sure, ", "Look, ", "Here goes: ", "Perfect. ", "Good question. ", "Gladly. ", "Alright, "],
    pt: ["Claro, ", "Olha, ", "Perfeito. ", "Boa pergunta. ", "Com certeza, "],
    fr: ["Bien sûr, ", "Regarde, ", "Parfait. ", "Bonne question. ", "Avec plaisir, "],
  };
  const YA_CONECTADA = /^\s*(claro|mira|te cuento|perfecto|buena pregunta|con gusto|listo|genial|excelente|por supuesto|sure|look|here goes|good question|gladly|alright|of course|great|olha|boa pergunta|parfait|bonne question)\b/i;

  function humanize(html) {
    if (typeof html !== "string") return html;
    if (/^\s*<(button|div|ul|ol|p|table|a\s)/i.test(html)) return html;
    if (YA_CONECTADA.test(html.replace(/^\s*<[^>]+>/, ""))) return html;
    if (html.length < 60 || Math.random() > 0.45) return html;
    const cur = lang().split("-")[0];
    const lista = CONNECTORS[cur] || CONNECTORS.es;
    const opciones = lista.filter((c) => c !== lastConnector);
    const c = opciones[Math.floor(Math.random() * opciones.length)];
    lastConnector = c;
    return c + html.replace(/^(\s*)([A-ZÁÉÍÓÚÑ])/, (m, sp, l) =>
      /^(CDH|IoT|PrivacyCheck|EvaIA|TaxiYa|IncubApp|Henry|A Tiempo)/.test(html.trim()) ? m : sp + l.toLowerCase()
    );
  }

  // ---------- UI ----------
  const root = document.createElement("div");
  root.id = "cdh-chat";
  root.innerHTML = `
    <button id="cdh-chat-fab" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="cdh-fab-badge">1</span>
    </button>
    <div id="cdh-chat-panel" role="dialog" aria-modal="false" aria-label="Chat con Maker, asesor de CDH Maker" hidden>
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
      <div class="cdh-chat-msgs" id="cdh-chat-msgs" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="cdh-chat-quick" id="cdh-chat-quick" aria-label="Respuestas rápidas"></div>
      <form class="cdh-chat-input" id="cdh-chat-form">
        <input type="text" id="cdh-chat-text" placeholder="Escribe tu mensaje…" autocomplete="off" maxlength="300" />
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
    const lKB = getLangKB();
    if (!lKB) return;
    const ui = lKB.ui || {};
    const sub = document.getElementById("cdh-chat-sub");
    if (sub && ui.sub)         sub.textContent = ui.sub;
    if (input && ui.placeholder) input.placeholder = ui.placeholder;
    if (fab   && ui.open)      fab.setAttribute("aria-label", ui.open);
    const closeBtn = document.getElementById("cdh-chat-close");
    if (closeBtn && ui.close)  closeBtn.setAttribute("aria-label", ui.close);
    if (panel && ui.chat)      panel.setAttribute("aria-label", ui.chat);
    if (quick && ui.quick)     quick.setAttribute("aria-label", ui.quick);
  }
  window.addEventListener("cdh:langchange",  syncUiLang);
  window.addEventListener("cdh:authchange",  syncUiLang);

  function addMsg(html, who) {
    const div = document.createElement("div");
    div.className = "cdh-msg " + who;
    div.innerHTML  = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function botSay(rawHtml, extraDelay) {
    const html = humanize(rawHtml);
    return new Promise((res) => {
      const typing = addMsg('<span class="cdh-typing"><i></i><i></i><i></i></span>', "bot");
      const plain  = html.replace(/<[^>]+>/g, "");
      const delay  = Math.min(350 + plain.length * 8, 1800) + (extraDelay || 0);
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
      b.type = "button";
      b.textContent = o.label;
      b.addEventListener("click", () => handleUser(o.label, o.action));
      quick.appendChild(b);
    });
  }

  function authButton(text) {
    return `<button type="button" class="cdh-wa-btn cdh-auth-btn" data-cdh-open-auth="register">${text}</button>`;
  }

  function waButton(text, msg) {
    if (!isAuthed()) {
      const lKB = getLangKB();
      const label = (lKB && lKB.btn && lKB.btn.create_account) || "Crear cuenta gratis";
      return authButton(label);
    }
    const b64 = safeBtoa(msg || "");
    return `<button type="button" class="cdh-wa-btn cdh-wa-trigger" data-wa-msg="${b64}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
      ${text}</button>`;
  }

  function backQuick(btn) {
    return [{ label: (btn && btn.back) || "Ver otros servicios", action: { type: "menu" } }];
  }

  function getMenuOptions(lKB) {
    const btn  = (lKB && lKB.btn)  || {};
    const svc  = (lKB && lKB.svc)  || {};
    const esSvc = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.svc) || {};
    return [
      { label: (svc.web && svc.web.name)               || (esSvc.web && esSvc.web.name)               || "Web y software",            action: { type: "svc", svc: "web" } },
      { label: (svc.maker && svc.maker.name)            || (esSvc.maker && esSvc.maker.name)            || "Impresión 3D · Láser · CNC", action: { type: "svc", svc: "maker" } },
      { label: (svc.iot && svc.iot.name)                || (esSvc.iot && esSvc.iot.name)                || "Electrónica e IoT",          action: { type: "svc", svc: "iot" } },
      { label: (svc.consultoria && svc.consultoria.name)|| (esSvc.consultoria && esSvc.consultoria.name)|| "Diseño y asesorías",         action: { type: "svc", svc: "consultoria" } },
      { label: btn.talk_henry || "Hablar con Henry", action: { type: "topic", topic: "contacto" } },
    ];
  }

  function getTextVal(val) {
    if (!val) return "";
    if (Array.isArray(val)) return pick(val);
    if (typeof val === "object" && val.a) return Array.isArray(val.a) ? pick(val.a) : val.a;
    return String(val);
  }

  // Obtiene el servicio activo del KB
  function getActiveSvc(lKB, esSvc) {
    const key = memory.service;
    if (!key) return null;
    return (lKB && lKB.svc && lKB.svc[key]) || esSvc[key] || null;
  }

  // Quick buttons enriquecidos con nombre del servicio activo
  function svcQuickButtons(btn, svcName) {
    const quoteLbl = svcName
      ? ((btn && btn.quote) || "Cotizar") + " · " + svcName
      : (btn && btn.quote) || "Cotizar por WhatsApp";
    return [
      { label: quoteLbl, action: { type: "wa" } },
      { label: (btn && btn.how_long) || "¿Cuánto se demora?", action: { type: "topic", topic: "tiempo" } },
      ...backQuick(btn),
    ];
  }

  // Respuesta de portafolio con filtrado por servicio
  function portafolioForService(t, esT) {
    const map = {
      web:         ["privacycheck", "taxiya", "incubapp", "atiempo"],
      maker:       [],
      iot:         ["incubapp"],
      consultoria: ["cavaltec"],
    };
    const key = memory.service;
    if (key && map[key] && map[key].length) {
      const featuredKey = map[key][0];
      const featuredVal = t[featuredKey] || esT[featuredKey];
      if (featuredVal) return getTextVal(featuredVal);
    }
    return getTextVal(t.portafolio || esT.portafolio);
  }

  // ---------- Motor de respuesta (switch completo) ----------
  async function respond(action, rawText) {
    const lKB  = getLangKB();
    const btn  = (lKB && lKB.btn)  || {};
    const t    = (lKB && lKB.t)    || {};
    const wa   = (lKB && lKB.wa)   || {};
    const esL  = window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es;
    const esT  = (esL && esL.t)    || {};
    const esSvc= (esL && esL.svc)  || {};

    // ── Servicio elegido ──────────────────────────────────────────────────────
    if (action.type === "svc") {
      const s = (lKB && lKB.svc && lKB.svc[action.svc]) || esSvc[action.svc];
      memory.rememberService(action.svc, s ? s.name : action.svc);
      memory.askedProject = true;
      memory.save();
      if (s) {
        await botSay(s.pitch);
        await botSay(s.hook);
      }
      setQuick(svcQuickButtons(btn, memory.serviceName));
      return;
    }

    const topicKey = action.topic || action.type;
    memory.rememberTopic(topicKey);

    // ── Obtener servicio activo para contexto ─────────────────────────────────
    const activeSvc = getActiveSvc(lKB, esSvc);

    switch (topicKey) {

      // ── Saludos y charla ────────────────────────────────────────────────────
      case "saludo": {
        const h  = new Date().getHours();
        const hi = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const greetingList   = t.greeting    || esT.greeting    || ["¡Hola!"];
        const reGreetingList = t.re_greeting || esT.re_greeting || ["¡Hola de nuevo!"];
        let intro = memory.greeted ? pick(reGreetingList) : hi + " " + pick(greetingList);
        if (memory.getSummary()) {
          intro += `<br><small style="opacity:0.8;">(Recuerdo que te interesaba <b>${memory.getSummary()}</b>)</small>`;
        }
        await botSay(intro);
        memory.greeted = true;
        memory.save();
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "comoestas":
        await botSay(pick(t.comoestas || esT.comoestas || ["¡Muy bien, gracias! 😊 ¿En qué proyecto andas?"]));
        setQuick(getMenuOptions(lKB));
        break;

      case "bot":
        await botSay(getTextVal(t.bot || esT.bot));
        setQuick(getMenuOptions(lKB));
        break;

      case "gracias":
        await botSay(pick(t.thanks || esT.thanks || ["¡Con gusto! 😊 ¿Algo más?"]));
        if (memory.service) {
          setQuick(svcQuickButtons(btn, memory.serviceName));
        } else {
          setQuick(getMenuOptions(lKB));
        }
        break;

      case "bye":
        await botSay(pick(t.bye || esT.bye || ["¡Hasta pronto! 👋"]));
        quick.innerHTML = "";
        break;

      case "si":
        await botSay(getTextVal(t.yes || esT.yes || "¡Perfecto! ¿Qué más te cuento?"));
        setQuick(memory.service ? svcQuickButtons(btn, memory.serviceName) : getMenuOptions(lKB));
        break;

      case "no":
        await botSay(getTextVal(t.no_worries || esT.no_worries || "Sin problema. ¿Qué más puedo contarte?"));
        setQuick(getMenuOptions(lKB));
        break;

      case "ayuda":
        await botSay(getTextVal(t.ayuda || esT.ayuda));
        setQuick(getMenuOptions(lKB));
        break;

      // ── Sobre nosotros ──────────────────────────────────────────────────────
      case "quien":
        await botSay(getTextVal(t.quien || esT.quien));
        setQuick(getMenuOptions(lKB));
        break;

      case "henry":
        await botSay(getTextVal(t.henry || esT.henry));
        setQuick([
          { label: btn.talk_henry || "Hablar con Henry", action: { type: "topic", topic: "contacto" } },
          ...backQuick(btn),
        ]);
        break;

      case "equipo":
        await botSay(getTextVal(t.equipo || esT.equipo));
        setQuick(backQuick(btn));
        break;

      case "experiencia":
        await botSay(getTextVal(t.experiencia || esT.experiencia));
        setQuick([
          { label: btn.projects || "Ver proyectos", action: { type: "topic", topic: "portafolio" } },
          ...backQuick(btn),
        ]);
        break;

      case "proceso":
        await botSay(getTextVal(t.proceso || esT.proceso));
        setQuick(backQuick(btn));
        break;

      case "aliados":
        await botSay(getTextVal(t.aliados || esT.aliados));
        setQuick(backQuick(btn));
        break;

      // ── Ubicación y logística ───────────────────────────────────────────────
      case "donde":
        await botSay(getTextVal(t.donde || esT.donde));
        setQuick(backQuick(btn));
        break;

      case "envios":
        await botSay(getTextVal(t.envios || esT.envios));
        setQuick(backQuick(btn));
        break;

      case "horario":
        await botSay(getTextVal(t.horario || esT.horario));
        setQuick(backQuick(btn));
        break;

      // ── Comercial ───────────────────────────────────────────────────────────
      case "precio": {
        memory.askedProject = true;
        memory.save();
        let answer = pick(t.precio || esT.precio || "Cotización personalizada y gratis.");
        if (memory.getSummary()) {
          answer = `Para tu proyecto de <b>${memory.getSummary()}</b>, ` + answer.toLowerCase();
        }
        await botSay(answer);
        const baseMsg  = activeSvc ? activeSvc.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay((t.price_cta || esT.price_cta || "Te dejo el mensaje listo:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      case "caro": {
        await botSay(getTextVal(t.caro || esT.caro));
        const baseMsg  = activeSvc ? activeSvc.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay(waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      case "tiempo": {
        let answer = getTextVal(t.tiempo || esT.tiempo);
        if (memory.serviceName) answer = `En <b>${memory.serviceName}</b>: ` + answer;
        await botSay(answer);
        const baseMsg  = activeSvc ? activeSvc.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay((t.time_cta || esT.time_cta || "¿Te cotizo el tuyo? Es gratis:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
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

      // ── Técnico ─────────────────────────────────────────────────────────────
      case "materiales":
        await botSay(getTextVal(t.materiales || esT.materiales));
        setQuick([
          { label: (lKB && lKB.svc && lKB.svc.maker && lKB.svc.maker.name) || "Impresión 3D · Láser · CNC", action: { type: "svc", svc: "maker" } },
          ...backQuick(btn),
        ]);
        break;

      case "archivos":
        await botSay(getTextVal(t.archivos || esT.archivos));
        setQuick(backQuick(btn));
        break;

      case "tecnologias":
        await botSay(getTextVal(t.tecnologias || esT.tecnologias));
        setQuick(backQuick(btn));
        break;

      case "ia":
        await botSay(getTextVal(t.ia || esT.ia));
        setQuick([
          { label: (lKB && lKB.svc && lKB.svc.web && lKB.svc.web.name) || "Web y software", action: { type: "svc", svc: "web" } },
          ...backQuick(btn),
        ]);
        break;

      // ── Proyectos ───────────────────────────────────────────────────────────
      case "portafolio": {
        const answer = portafolioForService(t, esT);
        await botSay(answer);
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "privacycheck": {
        memory.rememberProduct("privacycheck");
        const v = t.privacycheck || esT.privacycheck;
        if (v && v.url) {
          await botSay(getTextVal(v.a || v));
          await botSay(`<a class="cdh-wa-btn" href="${v.url}" target="_blank" rel="noopener">${v.cta || "Abrir →"}</a>`);
        } else {
          await botSay(getTextVal(v));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "evaia":
        memory.rememberProduct("evaia");
        await botSay(getTextVal(t.evaia || esT.evaia));
        setQuick(backQuick(btn));
        break;

      case "taxiya": {
        memory.rememberProduct("taxiya");
        const v = t.taxiya || esT.taxiya;
        if (v && v.url) {
          await botSay(getTextVal(v.a || v));
          await botSay(`<a class="cdh-wa-btn" href="${v.url}" target="_blank" rel="noopener">${v.cta || "Ver →"}</a>`);
        } else {
          await botSay(getTextVal(v));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "incubapp": {
        memory.rememberProduct("incubapp");
        const v = t.incubapp || esT.incubapp;
        if (v && v.url) {
          await botSay(getTextVal(v.a || v));
          await botSay(`<a class="cdh-wa-btn" href="${v.url}" target="_blank" rel="noopener">${v.cta || "Ver →"}</a>`);
        } else {
          await botSay(getTextVal(v));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "atiempo": {
        memory.rememberProduct("atiempo");
        const v = t.atiempo || esT.atiempo;
        if (v && v.url) {
          await botSay(getTextVal(v.a || v));
          await botSay(`<a class="cdh-wa-btn" href="${v.url}" target="_blank" rel="noopener">${v.cta || "Ver →"}</a>`);
        } else {
          await botSay(getTextVal(v));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "cavaltec":
        memory.rememberProduct("cavaltec");
        await botSay(getTextVal(t.cavaltec || esT.cavaltec));
        setQuick(backQuick(btn));
        break;

      // ── Cuenta y contacto ───────────────────────────────────────────────────
      case "cuenta":
        await botSay(getTextVal(t.cuenta || esT.cuenta));
        await botSay(authButton(btn.create_account || "Crear cuenta gratis"));
        setQuick(backQuick(btn));
        break;

      case "privacidad":
        await botSay(getTextVal(t.privacidad || esT.privacidad));
        setQuick(backQuick(btn));
        break;

      case "contacto":
      case "humano": {
        if (!isAuthed()) {
          await botSay(getTextVal(t.contact_guest || esT.contact_guest));
          await botSay(authButton(btn.create_account || "Crear cuenta gratis"));
        } else {
          await botSay(getTextVal(topicKey === "humano" ? (t.humano || esT.humano) : (t.contacto || esT.contacto)));
          const baseContactMsg = wa.contact || "Hola Henry, quiero hablar contigo sobre mi proyecto.";
          const finalMsg = memory.buildWaMessage(baseContactMsg, rawText);
          await botSay(waButton(btn.open_wa || "Abrir WhatsApp", finalMsg));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "queja":
        await botSay(getTextVal(t.queja || esT.queja));
        await botSay(waButton(btn.open_wa || "Escribirle a Henry", memory.buildWaMessage(wa.generic || "Hola Henry, tengo un reclamo: ", rawText)));
        setQuick(backQuick(btn));
        break;

      case "trabajo":
        await botSay(getTextVal(t.trabajo || esT.trabajo));
        await botSay(waButton(btn.open_wa || "Escribirle a Henry", memory.buildWaMessage(wa.generic || "Hola Henry, me interesa trabajar con CDH Maker: ", rawText)));
        setQuick(backQuick(btn));
        break;

      // ── Menú y WA directo ───────────────────────────────────────────────────
      case "menu":
        await botSay(lang().startsWith("es") ? "Claro, estos son nuestros servicios:" : "Sure — here is what we do:");
        setQuick(getMenuOptions(lKB));
        break;

      case "wa": {
        const baseMsg  = activeSvc ? activeSvc.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay(waButton(btn.open_wa || "Abrir WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      // ── Fallback con captura de proyecto ────────────────────────────────────
      default: {
        // Responder a topics que existen en KB pero no tienen case específico
        const topicVal = t[topicKey] || esT[topicKey];
        if (topicVal) {
          if (typeof topicVal === "object" && !Array.isArray(topicVal) && topicVal.url && topicVal.cta) {
            await botSay(getTextVal(topicVal.a || topicVal));
            await botSay(`<a class="cdh-wa-btn" href="${topicVal.url}" target="_blank" rel="noopener">${topicVal.cta}</a>`);
          } else {
            await botSay(getTextVal(topicVal));
          }
          setQuick(backQuick(btn));
          return;
        }

        // Captura libre: el usuario describió algo de su proyecto
        if (memory.askedProject && rawText && rawText.trim().length > 10) {
          const base    = activeSvc ? activeSvc.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
          const finalWa = memory.buildWaMessage(base, rawText);
          await botSay(pick(t.captured || esT.captured || ["¡Suena muy bien! 🙌 Te dejé el mensaje listo:"]));
          await botSay(waButton(btn.send_project || "Enviar mi proyecto por WhatsApp", finalWa));
          setQuick(backQuick(btn));
        } else {
          const fallbackList = t.fallback || esT.fallback || ["Para una respuesta exacta, lo mejor es consultarle a Henry:"];
          const genericWa    = wa.generic || "Hola Henry, tengo una consulta: ";
          const finalWa      = memory.buildWaMessage(genericWa, rawText);
          await botSay(pick(fallbackList) + "<br>" + waButton(btn.ask_direct || "Preguntarle a Henry", finalWa));
          setQuick(getMenuOptions(lKB));
        }
      }
    }
  }

  // ---------- Manejo de mensajes del usuario ----------
  function handleUser(text, forcedAction) {
    addMsg(esc(text), "user");
    quick.innerHTML = "";
    memory.turnCount++;

    // Solo guardar detalles si es texto libre del usuario (no label de botón)
    if (!forcedAction && text && text.trim().length > 10) {
      memory.rememberDetail(text);
    }

    ensureKB().then(() => {
      let matched = detectIntent(text);
      let action = forcedAction || (matched
        ? { type: matched.t.startsWith("svc:") ? "svc" : "topic",
            topic: matched.t.startsWith("svc:") ? null : matched.t,
            svc:   matched.t.startsWith("svc:") ? matched.t.split(":")[1] : null }
        : { type: "topic", topic: "fallback" });

      // Si el intent es un servicio y ya hay proyecto activo y texto descriptivo,
      // capturar el detalle en vez de cambiar de servicio
      if (!forcedAction && memory.askedProject && text.trim().length > 10 && action.type === "svc") {
        memory.rememberService(action.svc);
        action = { type: "topic", topic: "fallback" };
      }

      respond(action, text);
    });
  }

  // ---------- Event listeners ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    handleUser(v);
  });

  msgs.addEventListener("click", (e) => {
    const authBtn = e.target.closest("[data-cdh-open-auth]");
    if (authBtn) {
      e.preventDefault();
      if (window.CDH_AUTH && window.CDH_AUTH.openAuth)
        window.CDH_AUTH.openAuth(authBtn.getAttribute("data-cdh-open-auth") || "register");
      return;
    }
    const waBtn = e.target.closest(".cdh-wa-trigger");
    if (waBtn) {
      e.preventDefault();
      if (!isAuthed()) {
        if (window.CDH_AUTH && window.CDH_AUTH.openAuth) window.CDH_AUTH.openAuth("register");
        return;
      }
      const msg  = safeAtob(waBtn.getAttribute("data-wa-msg"));
      const href = waLink(msg);
      if (href !== "#") window.open(href, "_blank", "noopener,noreferrer");
    }
  });

  // ---------- Abrir / cerrar ----------
  function openChat() {
    panel.hidden = false;
    fab.classList.add("open");
    const badge = fab.querySelector(".cdh-fab-badge");
    if (badge) badge.style.display = "none";

    ensureKB().then(() => {
      syncUiLang();
      if (!memory.greeted) {
        memory.greeted = true;
        memory.save();
        const lKB = getLangKB();
        const t   = (lKB && lKB.t) || {};
        const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};
        const h   = new Date().getHours();
        const hi  = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const quien  = nombreCliente();
        const saludo = quien ? hi.replace(/!/, ", " + quien + "!") : hi;
        const gList  = t.greeting || esT.greeting || ["¡Hola!"];
        let msg = saludo + " " + pick(gList);
        if (memory.getSummary()) {
          msg += `<br><small style="opacity:0.8;">(Recuerdo que te interesaba <b>${memory.getSummary()}</b>)</small>`;
        }
        botSay(msg).then(() => setQuick(getMenuOptions(lKB)));
      }
      input.focus();
    });
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
