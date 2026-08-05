/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chatbot.js
   "Maker": asesor comercial virtual del sitio (natural, bilingüe y multilenguaje: 10 idiomas).
   
   Motor conversacional del chatbot: consulta la base de conocimiento en
   `chatbot-kb.js` (cargada bajo demanda al abrir el chat), detecta intenciones por
   palabras clave puntuadas + similitud de Dice (erratas), responde con textos
   naturales y guía la conversación hacia la cotización por WhatsApp.

   Funciona 100% en el navegador: no envía las conversaciones a ningún servidor.
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

  // Idioma activo de la página (por defecto "es")
  const lang = () => (document.documentElement.lang || "es").toLowerCase();

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

  // Obtiene el diccionario KB para el idioma actual (fallback a 'es' o 'en')
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

  // ---------- Estado conversacional ----------
  let lastService = null;
  let askedProject = false;
  let greeted = false;
  let lastConnector = "";
  let turnos = 0;

  function nombreCliente() {
    try {
      const u = window.CDH_AUTH && window.CDH_AUTH.getUser && window.CDH_AUTH.getUser();
      if (!u || !u.name) return "";
      const pila = String(u.name).trim().split(/\s+/)[0];
      return /^[a-záéíóúñü]{2,15}$/i.test(pila) ? pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase() : "";
    } catch (_) { return ""; }
  }

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

  // ---------- Construcción de la UI ----------
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
        <button id="cdh-chat-voice" class="cdh-voice-btn" aria-label="Silenciar voz" aria-pressed="true" hidden>
          <svg class="cdh-ico-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>
          <svg class="cdh-ico-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6"/><path d="m17 9 6 6"/></svg>
          <span class="cdh-voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </button>
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
        if (window.CDH_VOICE) window.CDH_VOICE.speak(html);
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
      lastService = action.svc;
      askedProject = true;
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

    switch (topicKey) {
      case "saludo": {
        const h = new Date().getHours();
        const hi = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const greetingList = t.greeting || esT.greeting || ["¡Hola!"];
        const reGreetingList = t.re_greeting || esT.re_greeting || ["¡Hola de nuevo!"];
        await botSay(greeted ? pick(reGreetingList) : hi + " " + pick(greetingList));
        greeted = true;
        setQuick(getMenuOptions(lKB));
        break;
      }

      case "precio": {
        const s = (lastService && lKB && lKB.svc && lKB.svc[lastService]) || (lastService && esSvc[lastService]);
        askedProject = true;
        await botSay(pick(t.precio || esT.precio || "La cotización es personalizada y gratis."));
        const msg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay((t.price_cta || "Si me cuentas qué necesitas, te dejo el mensaje listo:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", msg));
        setQuick(backQuick(btn));
        break;
      }

      case "caro": {
        const s = (lastService && lKB && lKB.svc && lKB.svc[lastService]) || (lastService && esSvc[lastService]);
        await botSay(getTextVal(t.caro || esT.caro));
        const msg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay(waButton(btn.quote || "Cotizar por WhatsApp", msg));
        setQuick(backQuick(btn));
        break;
      }

      case "tiempo": {
        const s = (lastService && lKB && lKB.svc && lKB.svc[lastService]) || (lastService && esSvc[lastService]);
        await botSay(getTextVal(t.tiempo || esT.tiempo));
        const msg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay((t.time_cta || "¿Te cotizo el tuyo? Es gratis:") + "<br>" + waButton(btn.quote || "Cotizar por WhatsApp", msg));
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
          await botSay(waButton(btn.open_wa || "Abrir WhatsApp", wa.contact || "Hola Henry, quiero hablar contigo."));
        }
        setQuick(backQuick(btn));
        break;
      }

      case "menu":
        await botSay(lang().startsWith("es") ? "Claro, estos son nuestros servicios. ¿Cuál te llama la atención?" : "Sure — here is what we do. Which one catches your eye?");
        setQuick(getMenuOptions(lKB));
        break;

      case "wa": {
        const s = (lastService && lKB && lKB.svc && lKB.svc[lastService]) || (lastService && esSvc[lastService]);
        const msg = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
        await botSay(waButton(btn.open_wa || "Abrir WhatsApp", msg));
        setQuick(backQuick(btn));
        break;
      }

      default: {
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
          if (askedProject && rawText && rawText.trim().length > 12) {
            const s = (lastService && lKB && lKB.svc && lKB.svc[lastService]) || (lastService && esSvc[lastService]);
            const base = s ? s.wa : (wa.quote || "Hola Henry, quiero una cotización: ");
            const capturedList = t.captured || esT.captured || ["¡Suena muy bien! 🙌 Te dejé el mensaje listo:"];
            await botSay(pick(capturedList));
            await botSay(waButton(btn.send_project || "Enviar mi proyecto por WhatsApp", base + rawText));
            setQuick(backQuick(btn));
          } else {
            const fallbackList = t.fallback || esT.fallback || ["Para una respuesta exacta, lo mejor es consultarle a Henry:"];
            const genericWa = wa.generic || "Hola Henry, tengo una consulta: ";
            await botSay(pick(fallbackList) + "<br>" + waButton(btn.ask_direct || "Preguntarle a Henry", genericWa + (rawText || "")));
            setQuick(getMenuOptions(lKB));
          }
        }
      }
    }
  }

  function handleUser(text, forcedAction) {
    addMsg(esc(text), "user");
    quick.innerHTML = "";
    turnos++;
    if (window.CDH_VOICE) window.CDH_VOICE.stop();

    ensureKB().then(() => {
      let matched = detectIntent(text);
      let action = forcedAction || (matched ? { type: "topic", topic: matched.t.startsWith("svc:") ? "svc" : matched.t, svc: matched.t.startsWith("svc:") ? matched.t.split(":")[1] : null } : { type: "fallback" });

      if (action.svc) {
        action.type = "svc";
      }

      if (!forcedAction && askedProject && text.trim().length > 12 && action.type === "svc") {
        lastService = action.svc;
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

  let started = false;
  function openChat() {
    panel.hidden = false;
    fab.classList.add("open");
    const badge = fab.querySelector(".cdh-fab-badge");
    if (badge) badge.style.display = "none";

    ensureKB().then(() => {
      syncUiLang();
      if (!started) {
        started = true;
        greeted = true;
        const lKB = getLangKB();
        const t = (lKB && lKB.t) || {};
        const esT = (window.CDH_KB && window.CDH_KB.L && window.CDH_KB.L.es && window.CDH_KB.L.es.t) || {};
        const h = new Date().getHours();
        const hi = h < 12 ? (t.good_morning || "¡Buenos días! ☀️") : h < 19 ? (t.good_afternoon || "¡Buenas tardes!") : (t.good_evening || "¡Buenas noches! 🌙");
        const quien = nombreCliente();
        const saludo = quien ? hi.replace(/!/, ", " + quien + "!") : hi;
        const greetingList = t.greeting || esT.greeting || ["¡Hola!"];
        botSay(saludo + " " + pick(greetingList)).then(() => setQuick(getMenuOptions(lKB)));
      }
      input.focus();
    });
  }

  function closeChat() {
    panel.hidden = true;
    fab.classList.remove("open");
    if (window.CDH_VOICE) window.CDH_VOICE.stop();
  }

  const voiceBtn = document.getElementById("cdh-chat-voice");
  if (window.CDH_VOICE && window.CDH_VOICE.supported()) {
    voiceBtn.hidden = false;

    function syncVoiceBtn() {
      const on = window.CDH_VOICE.isEnabled();
      const lKB = getLangKB();
      const ui = (lKB && lKB.ui) || {};
      voiceBtn.classList.toggle("off", !on);
      voiceBtn.setAttribute("aria-pressed", String(on));
      voiceBtn.setAttribute("aria-label", on ? (ui.voice_off || "Silenciar voz") : (ui.voice_on || "Activar voz"));
      voiceBtn.title = voiceBtn.getAttribute("aria-label");
    }

    voiceBtn.addEventListener("click", () => {
      const on = window.CDH_VOICE.toggle();
      syncVoiceBtn();
      if (on) {
        const lKB = getLangKB();
        const ui = (lKB && lKB.ui) || {};
        window.CDH_VOICE.speak(ui.voice_ready || "Listo, ya puedes escucharme.");
      }
    });

    window.addEventListener("cdh:voicestate", (e) => {
      voiceBtn.classList.toggle("speaking", !!(e.detail && e.detail.speaking));
    });
    window.addEventListener("cdh:langchange", syncVoiceBtn);
    syncVoiceBtn();
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
