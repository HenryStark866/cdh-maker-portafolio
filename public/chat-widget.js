/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chat-widget.js
   Reemplazo del bot de menús: una cajita simple para escribirle a Henry.

   No hay motor conversacional, ni intenciones, ni respuestas armadas: el
   visitante escribe su mensaje y, al enviarlo, se le abre SU WhatsApp con
   el texto ya listo para mandárselo a Henry — quien responde en persona.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Textos en los 10 idiomas del sitio. Si el visitante usa otro idioma no
  // listado aquí, cae en español (mismo criterio que ya usa ads.js).
  const T = {
    es: {
      title: "Escríbeme directo", subtitle: "Sin bots — te respondo yo",
      intro: "Cuéntame tu proyecto o tu duda. Al enviarlo se abre tu WhatsApp con el mensaje listo — lo recibo yo directamente.",
      placeholder: "Escribe tu mensaje…", send: "Enviar por WhatsApp",
      confirm: "¡Listo! Se abrió WhatsApp con tu mensaje. Solo dale enviar.",
      open_wa: "Abrir WhatsApp", fab: "Escribirme", close: "Cerrar",
    },
    en: {
      title: "Message me directly", subtitle: "No bots — I answer myself",
      intro: "Tell me about your project or question. Sending it opens your WhatsApp with the message ready — I get it directly.",
      placeholder: "Type your message…", send: "Send via WhatsApp",
      confirm: "Done! WhatsApp opened with your message. Just hit send.",
      open_wa: "Open WhatsApp", fab: "Message me", close: "Close",
    },
    pt: {
      title: "Fale comigo direto", subtitle: "Sem bots — respondo eu mesmo",
      intro: "Conte-me sobre seu projeto ou dúvida. Ao enviar, abre seu WhatsApp com a mensagem pronta — eu recebo direto.",
      placeholder: "Escreva sua mensagem…", send: "Enviar pelo WhatsApp",
      confirm: "Pronto! O WhatsApp abriu com sua mensagem. É só enviar.",
      open_wa: "Abrir WhatsApp", fab: "Fale comigo", close: "Fechar",
    },
    fr: {
      title: "Écrivez-moi directement", subtitle: "Pas de bot — je réponds moi-même",
      intro: "Parlez-moi de votre projet ou de votre question. En l'envoyant, votre WhatsApp s'ouvre avec le message prêt — je le reçois directement.",
      placeholder: "Écrivez votre message…", send: "Envoyer via WhatsApp",
      confirm: "C'est fait ! WhatsApp s'est ouvert avec votre message. Il ne reste qu'à l'envoyer.",
      open_wa: "Ouvrir WhatsApp", fab: "M'écrire", close: "Fermer",
    },
    ru: {
      title: "Напишите мне напрямую", subtitle: "Без ботов — отвечаю я сам",
      intro: "Расскажите о своём проекте или вопросе. При отправке откроется WhatsApp с готовым сообщением — я получу его напрямую.",
      placeholder: "Напишите сообщение…", send: "Отправить через WhatsApp",
      confirm: "Готово! WhatsApp открылся с вашим сообщением. Осталось только отправить.",
      open_wa: "Открыть WhatsApp", fab: "Написать мне", close: "Закрыть",
    },
    zh: {
      title: "直接给我留言", subtitle: "没有机器人——我本人回复",
      intro: "告诉我你的项目或问题。发送后会打开你的 WhatsApp，消息已经准备好——我会直接收到。",
      placeholder: "输入你的消息…", send: "通过 WhatsApp 发送",
      confirm: "好了！WhatsApp 已打开并带上你的消息，点击发送即可。",
      open_wa: "打开 WhatsApp", fab: "给我留言", close: "关闭",
    },
    hi: {
      title: "मुझे सीधे लिखें", subtitle: "कोई बॉट नहीं — मैं खुद जवाब देता हूँ",
      intro: "अपने प्रोजेक्ट या सवाल के बारे में बताएं। भेजते ही आपका WhatsApp खुल जाएगा, संदेश तैयार होगा — मुझे सीधे मिलेगा।",
      placeholder: "अपना संदेश लिखें…", send: "WhatsApp से भेजें",
      confirm: "हो गया! आपके संदेश के साथ WhatsApp खुल गया। बस भेज दीजिए।",
      open_wa: "WhatsApp खोलें", fab: "मुझे लिखें", close: "बंद करें",
    },
    ar: {
      title: "راسلني مباشرة", subtitle: "بدون بوتات — أرد أنا بنفسي",
      intro: "أخبرني عن مشروعك أو سؤالك. عند الإرسال سيفتح واتساب برسالتك جاهزة — تصلني مباشرة.",
      placeholder: "اكتب رسالتك…", send: "إرسال عبر واتساب",
      confirm: "تم! فُتح واتساب برسالتك. فقط اضغط إرسال.",
      open_wa: "فتح واتساب", fab: "راسلني", close: "إغلاق",
    },
    bn: {
      title: "সরাসরি আমাকে লিখুন", subtitle: "কোনো বট নেই — আমি নিজেই উত্তর দিই",
      intro: "আপনার প্রকল্প বা প্রশ্ন সম্পর্কে বলুন। পাঠালে আপনার WhatsApp খুলে যাবে, বার্তা প্রস্তুত থাকবে — আমি সরাসরি পাব।",
      placeholder: "আপনার বার্তা লিখুন…", send: "WhatsApp দিয়ে পাঠান",
      confirm: "হয়ে গেছে! আপনার বার্তাসহ WhatsApp খুলেছে। শুধু পাঠিয়ে দিন।",
      open_wa: "WhatsApp খুলুন", fab: "আমাকে লিখুন", close: "বন্ধ করুন",
    },
    id: {
      title: "Kirim pesan langsung", subtitle: "Tanpa bot — saya sendiri yang membalas",
      intro: "Ceritakan proyek atau pertanyaan Anda. Saat dikirim, WhatsApp Anda terbuka dengan pesan siap — saya menerimanya langsung.",
      placeholder: "Tulis pesan Anda…", send: "Kirim lewat WhatsApp",
      confirm: "Selesai! WhatsApp terbuka dengan pesan Anda. Tinggal kirim.",
      open_wa: "Buka WhatsApp", fab: "Kirim pesan", close: "Tutup",
    },
  };
  function t() {
    const l = (document.documentElement.lang || "es").slice(0, 2);
    return T[l] || T.es;
  }

  const ICON_WA = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>';

  function buildWaUrl(msg) {
    const base = "Hola Henry, vengo de tu página web:";
    const full = msg ? base + "\n\n" + msg : base;
    return (window.CDH_CONTACT && window.CDH_CONTACT.waUrl) ? window.CDH_CONTACT.waUrl(full) : "#";
  }

  function build() {
    const root = document.createElement("div");
    root.id = "cdh-chat";
    root.innerHTML = `
      <button id="cdh-chat-fab" aria-label="${t().fab}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <div id="cdh-chat-panel" role="dialog" aria-modal="false" aria-label="${t().title}" hidden>
        <div class="cdh-chat-header">
          <div class="cdh-chat-avatar">${ICON_WA}</div>
          <div><strong id="cdh-chat-title">${t().title}</strong><span id="cdh-chat-sub">${t().subtitle}</span></div>
          <button id="cdh-chat-close" aria-label="${t().close}">✕</button>
        </div>
        <div class="cdh-chat-msgs" id="cdh-chat-msgs" role="log" aria-live="polite" aria-relevant="additions">
          <div class="cdh-msg bot" id="cdh-chat-intro">${esc(t().intro)}</div>
        </div>
        <form class="cdh-chat-input" id="cdh-chat-form">
          <input type="text" id="cdh-chat-text" placeholder="${t().placeholder}" autocomplete="off" maxlength="500"/>
          <button type="submit" aria-label="${t().send}">${ICON_WA}</button>
        </form>
      </div>`;
    document.body.appendChild(root);

    const panel = document.getElementById("cdh-chat-panel");
    const fab   = document.getElementById("cdh-chat-fab");
    const msgs  = document.getElementById("cdh-chat-msgs");
    const form  = document.getElementById("cdh-chat-form");
    const input = document.getElementById("cdh-chat-text");

    function addMsg(html, who) {
      const div = document.createElement("div");
      div.className = "cdh-msg " + who;
      div.innerHTML = html;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    fab.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) setTimeout(() => input.focus(), 50);
    });
    document.getElementById("cdh-chat-close").addEventListener("click", () => { panel.hidden = true; });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) panel.hidden = true;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMsg(esc(text), "user");
      input.value = "";
      const href = buildWaUrl(text);
      window.open(href, "_blank", "noopener,noreferrer");
      addMsg(
        esc(t().confirm) +
          `<br><a class="cdh-wa-btn" href="${href}" target="_blank" rel="noopener">${ICON_WA}${esc(t().open_wa)}</a>`,
        "bot"
      );
    });

    // Al cambiar de idioma, re-pintar los textos fijos de la interfaz
    // (el historial de mensajes ya escritos se deja tal cual quedó).
    window.addEventListener("cdh:langchange", () => {
      const d = t();
      fab.setAttribute("aria-label", d.fab);
      panel.setAttribute("aria-label", d.title);
      document.getElementById("cdh-chat-title").textContent = d.title;
      document.getElementById("cdh-chat-sub").textContent = d.subtitle;
      document.getElementById("cdh-chat-close").setAttribute("aria-label", d.close);
      input.placeholder = d.placeholder;
      form.querySelector("button[type=submit]").setAttribute("aria-label", d.send);
      const intro = document.getElementById("cdh-chat-intro");
      if (intro) intro.textContent = d.intro;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
