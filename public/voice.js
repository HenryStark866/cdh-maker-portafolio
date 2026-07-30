/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — voice.js
   Voz propia del asesor "Maker": síntesis de habla en el propio navegador.

   Usa la Web Speech API (window.speechSynthesis), así que el audio se genera
   en el dispositivo del visitante: suena al instante, no cuesta nada y no
   viaja ningún dato a un servidor externo.

   Qué resuelve este módulo:
     · Elige la mejor voz disponible para el idioma activo (es / en), dando
       prioridad a las voces neuronales modernas y al acento colombiano.
     · Limpia el texto antes de leerlo (HTML, emojis, URLs, signos sueltos).
     · Trocea los mensajes largos en frases: varios motores cortan el audio
       a los ~200 caracteres si se les manda todo de una vez.
     · Sortea el fallo conocido de Chrome, que suspende la síntesis pasados
       unos segundos, con un "resume" periódico mientras habla.
     · Recuerda si el visitante prefiere el audio encendido o silenciado.

   API pública (window.CDH_VOICE):
     supported()      → ¿el navegador puede hablar?
     isEnabled()      → ¿el audio está activo?
     setEnabled(bool) → enciende o silencia (persiste en localStorage)
     toggle()         → alterna y devuelve el nuevo estado
     speak(texto)     → lee el texto en el idioma actual del sitio
     stop()           → corta lo que esté sonando
     isSpeaking()     → ¿hay audio en curso?

   Eventos que emite en window:
     cdh:voicestate → { speaking: bool, enabled: bool }
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-30
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const SUPPORTED = !!(synth && Utterance);

  // Clave de preferencia del visitante. Por defecto el audio viene encendido:
  // el asesor responde hablando desde el primer mensaje.
  const LS_KEY = "cdh_voice_on";
  let enabled = SUPPORTED && localStorage.getItem(LS_KEY) !== "0";

  // Estado interno
  let voices = [];          // catálogo de voces del sistema
  let speaking = false;     // ¿hay audio sonando ahora?
  let queue = [];           // frases pendientes del mensaje actual
  let watchdog = null;      // temporizador anti-suspensión de Chrome

  // ── Catálogo de voces ───────────────────────────────────────────────────────
  // getVoices() suele venir vacío en la primera llamada: el navegador carga las
  // voces de forma asíncrona y avisa con el evento "voiceschanged".
  function loadVoices() {
    if (!SUPPORTED) return;
    voices = synth.getVoices() || [];
  }
  if (SUPPORTED) {
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    if ("onvoiceschanged" in synth) synth.onvoiceschanged = loadVoices;
  }

  // Marcas que delatan una voz neuronal (mucho más natural que las clásicas)
  const NEURAL_HINTS = ["natural", "neural", "online", "premium", "enhanced", "wavenet"];
  // Orden de preferencia regional: primero Colombia, luego LatAm, luego España
  const ES_REGIONS = ["es-co", "es-mx", "es-us", "es-ar", "es-cl", "es-pe", "es-es", "es"];
  const EN_REGIONS = ["en-us", "en-gb", "en"];

  // Puntúa una voz: gana la más natural del acento más cercano a la marca
  function scoreVoice(v, regions) {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    // Debe pertenecer al idioma pedido
    const idx = regions.findIndex((r) => lang === r || lang.startsWith(r + "-"));
    if (idx === -1) return -1;
    let score = (regions.length - idx) * 10;              // cercanía regional
    if (NEURAL_HINTS.some((h) => name.includes(h))) score += 35; // calidad neural
    if (name.includes("google")) score += 12;             // Google suele sonar bien
    if (name.includes("microsoft")) score += 8;
    if (v.localService) score += 4;                       // local = sin latencia
    return score;
  }

  // Devuelve la mejor voz para "es" o "en" (o null si no hay ninguna)
  function pickVoice(langCode) {
    if (!voices.length) loadVoices();
    const regions = langCode === "en" ? EN_REGIONS : ES_REGIONS;
    let best = null, bestScore = -1;
    for (const v of voices) {
      const s = scoreVoice(v, regions);
      if (s > bestScore) { best = v; bestScore = s; }
    }
    return bestScore > 0 ? best : null;
  }

  // Idioma activo del sitio (lo fija i18n.js en <html lang>)
  function currentLang() {
    return (document.documentElement.lang || "es").startsWith("en") ? "en" : "es";
  }

  // ── Limpieza del texto ──────────────────────────────────────────────────────
  // El chat entrega HTML con botones, enlaces y emojis: nada de eso se lee bien.
  function toPlainText(html) {
    if (!html) return "";
    // 1. Quitar bloques que no son discurso (botones de acción, scripts)
    let s = String(html)
      .replace(/<button[\s\S]*?<\/button>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, ". ")
      .replace(/<\/(p|div|li|h[1-6])>/gi, ". ");
    // 2. Resolver entidades y eliminar el resto de etiquetas
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    s = tmp.textContent || "";
    // 3. Fuera URLs y correos: deletrearlos suena fatal
    s = s.replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+\.\S+/g, " ");
    // 4. Fuera emojis y símbolos decorativos
    s = s.replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
      " "
    );
    // 5. Normalizar espacios y puntuación repetida
    return s.replace(/\s*·\s*/g, ", ").replace(/\s+/g, " ").replace(/\s([.,;:!?])/g, "$1").trim();
  }

  // Parte el texto en frases de como mucho ~180 caracteres, cortando por
  // puntuación para que las pausas caigan donde caerían al hablar.
  function splitSentences(text, max = 180) {
    const partes = text.match(/[^.!?…]+[.!?…]*/g) || [text];
    const out = [];
    let buf = "";
    for (const p of partes) {
      const frase = p.trim();
      if (!frase) continue;
      if ((buf + " " + frase).trim().length <= max) {
        buf = (buf ? buf + " " : "") + frase;
      } else {
        if (buf) out.push(buf);
        // Una sola frase más larga que el máximo: partirla por comas
        if (frase.length > max) {
          let resto = frase;
          while (resto.length > max) {
            const corte = resto.lastIndexOf(",", max);
            const i = corte > max * 0.4 ? corte + 1 : max;
            out.push(resto.slice(0, i).trim());
            resto = resto.slice(i).trim();
          }
          buf = resto;
        } else {
          buf = frase;
        }
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  // ── Estado y avisos a la interfaz ───────────────────────────────────────────
  function emitState() {
    window.dispatchEvent(
      new CustomEvent("cdh:voicestate", { detail: { speaking, enabled } })
    );
  }

  function setSpeaking(v) {
    if (speaking === v) return;
    speaking = v;
    emitState();
  }

  // Chrome suspende la síntesis pasados ~14 s. Un resume() periódico lo evita.
  function startWatchdog() {
    stopWatchdog();
    watchdog = setInterval(() => {
      if (!synth.speaking) { stopWatchdog(); return; }
      synth.pause();
      synth.resume();
    }, 9000);
  }
  function stopWatchdog() {
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
  }

  // ── Reproducción ────────────────────────────────────────────────────────────
  // Encola la siguiente frase; al terminar la última se apaga el indicador.
  function playNext(voice, langTag) {
    if (!queue.length) { setSpeaking(false); stopWatchdog(); return; }
    const frase = queue.shift();
    const u = new Utterance(frase);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : langTag;
    // Ritmo de conversación: un pelín por encima del natural, tono neutro
    u.rate = 1.04;
    u.pitch = 1.0;
    u.volume = 1;
    u.onend = () => playNext(voice, langTag);
    u.onerror = () => playNext(voice, langTag); // una frase fallida no corta el resto
    synth.speak(u);
  }

  function speak(html) {
    if (!SUPPORTED || !enabled) return;
    const texto = toPlainText(html);
    if (!texto || texto.length < 2) return;

    stop(); // lo nuevo siempre reemplaza a lo anterior

    const lang = currentLang();
    const voice = pickVoice(lang);
    const langTag = lang === "en" ? "en-US" : "es-CO";
    queue = splitSentences(texto);
    setSpeaking(true);
    startWatchdog();
    playNext(voice, langTag);
  }

  function stop() {
    if (!SUPPORTED) return;
    queue = [];
    stopWatchdog();
    try { synth.cancel(); } catch (_) { /* algunos motores lanzan si no hay nada */ }
    setSpeaking(false);
  }

  function setEnabled(v) {
    enabled = !!v && SUPPORTED;
    localStorage.setItem(LS_KEY, enabled ? "1" : "0");
    if (!enabled) stop();
    emitState();
    return enabled;
  }

  // ── Cortes de cortesía ──────────────────────────────────────────────────────
  // Nadie quiere que la web le siga hablando en otra pestaña o al salir.
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  window.addEventListener("cdh:langchange", stop); // el idioma cambió: voz nueva

  // ── API pública ─────────────────────────────────────────────────────────────
  window.CDH_VOICE = {
    supported: () => SUPPORTED,
    isEnabled: () => enabled,
    isSpeaking: () => speaking,
    setEnabled,
    toggle: () => setEnabled(!enabled),
    speak,
    stop,
    // Expuesto para pruebas y para el panel de depuración
    _voiceName: () => { const v = pickVoice(currentLang()); return v ? v.name + " (" + v.lang + ")" : "—"; },
  };
})();
