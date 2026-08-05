/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chatbot.js
   "Maker": asesor comercial virtual de CDH Maker.
   
   Motor conversacional 100% texto con MEMORIA AVANZADA de contexto:
   - Registra y recuerda los servicios, productos y detalles específicos de la
     idea descrita por el visitante durante toda la sesión.
   - Conecta de forma inteligente las dudas (precios, tiempos, garantía) con el
     contexto acumulado del proyecto.
   - Construye enlaces de WhatsApp enriquecidos con todo el resumen del proyecto.
   - Soporte multilenguaje fluido para 10 idiomas.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-08-04
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ---------- Utilidades ----------
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const isAuthed = () => !!(window.CDH_AUTH && window.CDH_AUTH.isLoggedIn && window.CDH_AUTH.isLoggedIn());
  const waLink = (msg) => {
    if (window.CDH_AUTH && window.CDH_AUTH.CONTACT && window.CDH_AUTH.CONTACT.buildWa) {
      return window.CDH_AUTH.CONTACT.buildWa(msg) || "#";
    }
    return "#";
  };
  const pick = (arr) => (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : arr);
  const esc = (s) => String(s || "").replace(/</g, "&lt;");

  function safeBtoa(str) {
    try {
      return btoa(unescape(encodeURIComponent(str || "")));
    } catch (_) {
      return "";
    }
  }

  function safeAtob(b64) {
    try {
      return decodeURIComponent(escape(atob(b64 || "")));
    } catch (_) {
      return "";
    }
  }

  const lang = () => (document.documentElement.lang || "es").toLowerCase();

  // ---------- MEMORIA CONVERSACIONAL AVANZADA ----------
  const memory = {
    service: null,         // 'web' | 'maker' | 'iot' | 'consultoria'
    serviceName: null,     // Nombre traducido del servicio
    product: null,         // 'privacycheck' | 'evaia' | 'taxiya' | 'incubapp' | 'atiempo' | 'cavaltec'
    details: [],           // Fragmentos relevantes descritos por el usuario
    techMentioned: [],     // Tecnologías detectadas (Next.js, 3D, Arduino, etc.)
    topicsDiscussed: new Set(),
    turnCount: 0,
    askedProject: false,
    greeted: false,

    rememberService(svcKey, name) {
      if (svcKey) {
        this.service = svcKey;
        if (name) this.serviceName = name;
        this.save();
      }
    },
    rememberProduct(prodKey) {
      if (prodKey) {
        this.product = prodKey;
        this.save();
      }
    },
    rememberDetail(txt) {
      if (typeof txt === "string" && txt.trim().length > 10) {
        const clean = txt.trim().replace(/\s+/g, " ");
        // Evitar duplicar fragmentos muy similares
        if (!this.details.some((d) => d.toLowerCase() === clean.toLowerCase())) {
          this.details.push(clean);
          if (this.details.length > 5) this.details.shift(); // Mantener los últimos 5
        }
        this.save();
      }
    },
    rememberTopic(topic) {
      if (topic) {
        this.topicsDiscussed.add(topic);
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
      if (this.details.length) {
        parts.push(this.details.slice(-2).join(" / "));
      }
      return parts.join(" — ");
    },
    buildWaMessage(baseMsg, extraInput) {
      let msg = baseMsg || "";
      const summary = this.getSummary();
      if (summary && !msg.includes(summary)) {
        msg += summary;
      }
      if (extraInput && extraInput.trim().length > 8) {
        const cleanInput = extraInput.trim();
        if (!msg.includes(cleanInput)) {
          msg += (msg.endsWith(":") || msg.endsWith(" ") ? "" : " — ") + cleanInput;
        }
      }
      return msg;
    },
    save() {
      try {
        const data = {
          service: this.service,
          serviceName: this.serviceName,
          product: this.product,
          details: this.details,
          techMentioned: this.techMentioned,
          topicsDiscussed: Array.from(this.topicsDiscussed),
          turnCount: this.turnCount,
          askedProject: this.askedProject,
        };
        sessionStorage.setItem("cdh_maker_memory", JSON.stringify(data));
      } catch (_) {}
    },
    load() {
      try {
        const raw = sessionStorage.getItem("cdh_maker_memory");
        if (raw) {
          const data = JSON.parse(raw);
          this.service = data.service || null;
          this.serviceName = data.serviceName || null;
          this.product = data.product || null;
          this.details = Array.isArray(data.details) ? data.details : [];
          this.techMentioned = Array.isArray(data.techMentioned) ? data.techMentioned : [];
          this.topicsDiscussed = new Set(Array.isArray(data.topicsDiscussed) ? data.topicsDiscussed : []);
          this.turnCount = data.turnCount || 0;
          this.askedProject = !!data.askedProject;
        }
      } catch (_) {}
    }
  };

  // Cargar memoria existente en la sesión
  memory.load();

  // ---------- Carga bajo demanda de la Base de Conocimiento ----------
  let kbPromise = null;
  function ensureKB() {
    if (window.CDH_KB) return Promise.resolve(window.CDH_KB);
    if (kbPromise) return kbPromise;
    kbPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "chatbot-kb.js?v=2";
      s.async = true;
      s.onload = () => resolve(window.CDH_KB || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return kbPromise;
  }

  function getLangKB() {
    if (!window.CDH_KB || !window.CDH_KB.L) return null;
    const l = lang();
    const shortCode = l.split("-")[0];
    return window.CDH_KB.L[l] || window.CDH_KB.L[shortCode] || window.CDH_KB.L.es;
  }

  // ---------- Similitud de Dice para erratas ----------
  function dice(a, b) {
    if (a === b) return 1;
    if (a.length < 3 || b.length < 3) return 0;
    const pares = (s) => {
      const out = [];
      for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
      return out;
    };
    const pa = pares(a), pb = pares(b);
    let comunes = 0;
    const usados = new Array(pb.length).fill(false);
    for (const p of pa) {
      const j = pb.findIndex((q, i) => !usados[i] && q === p);
      if (j !== -1) { usados[j] = true; comunes++; }
    }
    return (2 * comunes) / (pa.length + pb.length);
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
      if (score > bestScore) {
        best = intent;
        bestScore = score;
      }
    }
    return best;
  }

  function nombreCliente() {
    try {
      const u = window.CDH_AUTH && window.CDH_AUTH.getUser && window.CDH_AUTH.getUser();
      if (!u || !u.name) return "";
      const pila = String(u.name).trim().split(/\s+/)[0];
      return /^[a-záéíóúñü]{2,15}$/i.test(pila) ? pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase() : "";
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
    if (html.length < 60) return html;
    if (Math.random() > 0.45) return html;
    const curLang = lang().split("-")[0];
    const lista = CONNECTORS[curLang] || CONNECTORS.es;
    const opciones = lista.filter((c) => c !== lastConnector);
    const c = opciones[Math.floor(Math.random() * opciones.length)];
    lastConnector = c;
    const resto = html.replace(/^(\s*)([A-ZÁÉÍÓÚÑ])/, (m, sp, letra) =>
      /^(CDH|IoT|PrivacyCheck|EvaIA|TaxiYa|IncubApp|Henry|A Tiempo)/.test(html.trim()) ? m : sp + letra.toLowerCase()
    );
    return c + resto;
  }

  // ---------- UI Solo Texto ----------
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

  const fab = document.getElementById("cdh-chat-fab");
  const panel = document.getElementById("cdh-chat-panel");
  const msgs = document.getElementById("cdh-chat-msgs");
  const quick = document.getElementById("cdh-chat-quick");
  const form = document.getElementById("cdh-chat-form");
  const input = document.getElementById("cdh-chat-text");

  function syncUiLang() {
    const lKB = getLangKB();
    if (!lKB) return;
    const ui = lKB.ui || {};
    const sub = document.getElementById("cdh-chat-sub");
    if (sub && ui.sub) sub.textContent = ui.sub;
    if (input && ui.placeholder) input.placeholder = ui.placeholder;
    if (fab && ui.open) fab.setAttribute("aria-label", ui.open);
    const closeBtn = document.getElementById("cdh-chat-close");
    if (closeBtn && ui.close) closeBtn.setAttribute("aria-label", ui.close);
    if (panel && ui.chat) panel.setAttribute("aria-label", ui.chat);
    if (quick && ui.quick) quick.setAttribute("aria-label", ui.quick);
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

  function botSay(rawHtml, extraDelay) {
    const html = humanize(rawHtml);
    return new Promise((res) => {
      const typing = addMsg('<span class="cdh-typing"><i></i><i></i><i></i></span>', "bot");
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

  function authButton(text) {
    return `<button type="button" class="cdh-wa-btn cdh-auth-btn" data-cdh-open-auth="register">${text}</button>`;
  }

  function waButton(text, msg) {
    if (!isAuthed()) {
      const lKB = getLangKB();
      const createAcc = (lKB && lKB.btn && lKB.btn.create_account) || "Crear cuenta gratis";
      return authButton(createAcc);
    }
    const b64Msg = safeBtoa(msg || "");
    return `<button type="button" class="cdh-wa-btn cdh-wa-trigger" data-wa-msg="${b64Msg}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>
      ${text}</button>`;
  }

  function backQuick(btn) {
    return [{ label: (btn && btn.back) || "Ver otros servicios", action: { type: "menu" } }];
  }

  function getMenuOptions(lKB) {
    const btn = (lKB && lKB.btn) || {};
    const svc = (lKB && lKB.svc) || {};
    const esSvc = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.svc) || {};
    return [
      { label: (svc.web && svc.web.name) || (esSvc.web && esSvc.web.name) || "Web y software", action: { type: "svc", svc: "web" } },
      { label: (svc.maker && svc.maker.name) || (esSvc.maker && esSvc.maker.name) || "Impresión 3D · Láser · CNC", action: { type: "svc", svc: "maker" } },
      { label: (svc.iot && svc.iot.name) || (esSvc.iot && esSvc.iot.name) || "Electrónica e IoT", action: { type: "svc", svc: "iot" } },
      { label: (svc.consultoria && svc.consultoria.name) || (esSvc.consultoria && esSvc.consultoria.name) || "Diseño y asesorías", action: { type: "svc", svc: "consultoria" } },
      { label: btn.talk_henry || "Hablar con Henry", action: { type: "topic", topic: "contacto" } },
    ];
  }

  function getTextVal(val) {
    if (!val) return "";
    if (Array.isArray(val)) return pick(val);
    if (typeof val === "object") {
      if (val.a) return Array.isArray(val.a) ? pick(val.a) : val.a;
    }
    return String(val);
  }

  async function respond(action, rawText) {
    const lKB = getLangKB();
    const btn = (lKB && lKB.btn) || {};
    const t = (lKB && lKB.t) || {};
    const wa = (lKB && lKB.wa) || {};
    const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};
    const esSvc = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.svc) || {};

    if (action.type === "svc") {
      const s = (lKB && lKB.svc && lKB.svc[action.svc]) || esSvc[action.svc];
      memory.rememberService(action.svc, s ? s.name : action.svc);
      memory.askedProject = true;
      if (s) {
        await botSay(s.pitch);
        await botSay(s.hook);
      }
      setQuick([
        { label: btn.quote || "Cotizar por WhatsApp", action: { type: "wa" } },
        { label: btn.how_long || "¿Cuánto se demora?", action: { type: "topic", topic: "tiempo" } },
        ...backQuick(btn),
      ]);
      return;
    }

    const topicKey = action.topic || action.type;
    memory.rememberTopic(topicKey);

    // Enriquecer respuestas usando la memoria de contexto acumulada
    switch (topicKey) {
      case "saludo": {
        const h = new Date().getHours();
        const hi = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const greetingList = t.greeting || esT.greeting || ["¡Hola!"];
        const reGreetingList = t.re_greeting || esT.re_greeting || ["¡Hola de nuevo!"];
        
        let intro = memory.greeted ? pick(reGreetingList) : hi + " " + pick(greetingList);
        if (memory.getSummary()) {
          intro += `<br><small style="opacity:0.85;">(Tengo guardado tu interés en <b>${memory.getSummary()}</b>)</small>`;
        }
        await botSay(intro);
        memory.greeted = true;
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "precio": {
        const activeSvcKey = memory.service;
        const s = (activeSvcKey && lKB && lKB.svc && lKB.svc[activeSvcKey]) || (activeSvcKey && esSvc[activeSvcKey]);
        memory.askedProject = true;
        
        let answerText = pick(t.precio || esT.precio || "La cotización es personalizada y gratis.");
        if (memory.getSummary()) {
          answerText = `Para tu proyecto de <b>${memory.getSummary()}</b>, ` + answerText.toLowerCase();
        }
        await botSay(answerText);
        
        const baseMsg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay((t.price_cta || "Te dejo el mensaje listo con tu proyecto:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      case "caro": {
        const activeSvcKey = memory.service;
        const s = (activeSvcKey && lKB && lKB.svc && lKB.svc[activeSvcKey]) || (activeSvcKey && esSvc[activeSvcKey]);
        await botSay(getTextVal(t.caro || esT.caro));
        const baseMsg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay(waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      case "tiempo": {
        const activeSvcKey = memory.service;
        const s = (activeSvcKey && lKB && lKB.svc && lKB.svc[activeSvcKey]) || (activeSvcKey && esSvc[activeSvcKey]);
        let answerText = getTextVal(t.tiempo || esT.tiempo);
        if (memory.serviceName) {
          answerText = `En <b>${memory.serviceName}</b>: ` + answerText;
        }
        await botSay(answerText);
        const baseMsg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay((t.time_cta || "¿Te cotizo el tuyo? Es gratis:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      case "contacto":
      case "humano": {
        if (!isAuthed()) {
          await botSay(getTextVal(t.contact_guest || t.contacto || esT.contact_guest));
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

      case "menu":
        await botSay(lang().startsWith("es") ? "Claro, estos son nuestros servicios. ¿Cuál te llama la atención?" : "Sure — here is what we do. Which one catches your eye?");
        setQuick(getMenuOptions(lKB));
        break;

      case "wa": {
        const activeSvcKey = memory.service;
        const s = (activeSvcKey && lKB && lKB.svc && lKB.svc[activeSvcKey]) || (activeSvcKey && esSvc[activeSvcKey]);
        const baseMsg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        const finalMsg = memory.buildWaMessage(baseMsg, rawText);
        await botSay(waButton(btn.open_wa || "Abrir WhatsApp", finalMsg));
        setQuick(backQuick(btn));
        break;
      }

      default: {
        // Verificar si es un producto directo
        if (["privacycheck", "evaia", "taxiya", "incubapp", "atiempo", "cavaltec"].includes(topicKey)) {
          memory.rememberProduct(topicKey);
        }

        const topicVal = t[topicKey] || esT[topicKey];
        if (topicVal) {
          if (typeof topicVal === "object" && !Array.isArray(topicVal) && topicVal.url && topicVal.cta) {
            await botSay(getTextVal(topicVal.a));
            await botSay(`<a class="cdh-wa-btn" href="${topicVal.url}" target="_blank" rel="noopener">${topicVal.cta}</a>`);
          } else {
            await botSay(getTextVal(topicVal));
          }
          setQuick(backQuick(btn));
        } else {
          // Captura de detalle de proyecto con memoria acumulativa
          if (rawText && rawText.trim().length > 8) {
            memory.rememberDetail(rawText);
          }

          if (memory.askedProject && rawText && rawText.trim().length > 10) {
            const activeSvcKey = memory.service;
            const s = (activeSvcKey && lKB && lKB.svc && lKB.svc[activeSvcKey]) || (activeSvcKey && esSvc[activeSvcKey]);
            const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
            const finalWaMsg = memory.buildWaMessage(base, rawText);
            
            const capturedList = t.captured || esT.captured || ["¡Suena muy bien! 🙌 Te dejé el mensaje listo para WhatsApp:"];
            await botSay(pick(capturedList));
            await botSay(waButton(btn.send_project || "Enviar mi proyecto por WhatsApp", finalWaMsg));
            setQuick(backQuick(btn));
          } else {
            const fallbackList = t.fallback || esT.fallback || ["Para una respuesta exacta, lo mejor es consultarle a Henry:"];
            const genericWa = wa.generic || "Hola Henry, tengo una consulta: ";
            const finalWaMsg = memory.buildWaMessage(genericWa, rawText);
            await botSay(pick(fallbackList) + "<br>" + waButton(btn.ask_direct || "Preguntarle a Henry", finalWaMsg));
            setQuick(getMenuOptions(lKB));
          }
        }
      }
    }
  }

  function handleUser(text, forcedAction) {
    addMsg(esc(text), "user");
    quick.innerHTML = "";
    memory.turnCount++;

    if (text && text.trim().length > 10) {
      memory.rememberDetail(text);
    }

    ensureKB().then(() => {
      let matched = detectIntent(text);
      let action = forcedAction || (matched ? { type: "topic", topic: matched.t.startsWith("svc:") ? "svc" : matched.t, svc: matched.t.startsWith("svc:") ? matched.t.split(":")[1] : null } : { type: "fallback" });

      if (action.svc) {
        action.type = "svc";
        memory.rememberService(action.svc);
      }

      if (!forcedAction && memory.askedProject && text.trim().length > 10 && action.type === "svc") {
        memory.rememberService(action.svc);
        action = { type: "fallback" };
      }
      respond(action, text);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    handleUser(t);
  });

  msgs.addEventListener("click", (e) => {
    const authBtn = e.target.closest("[data-cdh-open-auth]");
    if (authBtn) {
      e.preventDefault();
      if (window.CDH_AUTH && window.CDH_AUTH.openAuth) {
        window.CDH_AUTH.openAuth(authBtn.getAttribute("data-cdh-open-auth") || "register");
      }
      return;
    }

    const waBtn = e.target.closest(".cdh-wa-trigger");
    if (waBtn) {
      e.preventDefault();
      if (!isAuthed()) {
        if (window.CDH_AUTH && window.CDH_AUTH.openAuth) {
          window.CDH_AUTH.openAuth("register");
        }
        return;
      }
      const b64Msg = waBtn.getAttribute("data-wa-msg");
      const msg = safeAtob(b64Msg);
      const href = waLink(msg);
      if (href !== "#") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    }
  });

  function openChat() {
    panel.hidden = false;
    fab.classList.add("open");
    const badge = fab.querySelector(".cdh-fab-badge");
    if (badge) badge.style.display = "none";

    ensureKB().then(() => {
      syncUiLang();
      if (!memory.greeted) {
        memory.greeted = true;
        const lKB = getLangKB();
        const t = (lKB && lKB.t) || {};
        const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};
        const h = new Date().getHours();
        const hi = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const quien = nombreCliente();
        const saludo = quien ? hi.replace(/!/, ", " + quien + "!") : hi;
        const greetingList = t.greeting || esT.greeting || ["¡Hola!"];
        
        let initialSay = saludo + " " + pick(greetingList);
        if (memory.getSummary()) {
          initialSay += `<br><small style="opacity:0.85;">(Recuerdo que te interesaba <b>${memory.getSummary()}</b>)</small>`;
        }
        botSay(initialSay).then(() => setQuick(getMenuOptions(lKB)));
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closeChat();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !root.contains(e.target)) closeChat();
  });

  ensureKB().then(() => syncUiLang());
})();
