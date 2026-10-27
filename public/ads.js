/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — ads.js
   Cinta de la portada (#cinta): banda horizontal animada que intercala
     · Shorts del canal de YouTube (los publica el bot ClipFactory). La lista
       sale de /media/shorts.json, que escribe tools/sync-shorts.mjs en cada
       deploy. Al hacer clic se abre un visor con el embed de
       youtube-nocookie; el iframe se crea SOLO al abrirlo y se destruye al
       cerrarlo (nada de YouTube se carga mientras nadie lo pida, salvo las
       miniaturas de i.ytimg.com). Los Shorts subidos con la inserción
       desactivada ("embed": false) se abren en youtube.com.
     · Ofertas: servicios de CDH Maker (WhatsApp vía contact.js), la tarjeta
       "Vende en YAM" y, si el feed público de YAM responde, productos y
       campañas reales de sus comercios. Nunca se inventan productos: sin
       feed solo quedan las ofertas fijas de CDH.

   Reemplaza al widget flotante con un solo video (versiones ≤ 6).
   Accesibilidad: se pausa con el mouse encima, con el foco dentro y con el
   botón Pausar (WCAG 2.2.2); con "reducir movimiento" no se anima y queda
   como fila con desplazamiento horizontal. Las copias que hacen el bucle van
   con aria-hidden + inert. Se detiene sola cuando sale de la pantalla.
   Textos en los 10 idiomas del sitio (objeto T; el título de la banda va en
   index.html con data-i18n: cinta_k, cinta_t).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const root = document.getElementById("cinta");
  if (!root) return;
  const track = root.querySelector(".cinta-track");
  const viewport = root.querySelector(".cinta-viewport");
  const toggle = root.querySelector(".cinta-toggle");
  if (!track || !viewport) return;

  const SHORTS_URL = "/media/shorts.json";
  const FEED_URL = "https://yam.cdhmaker.com/api/publico/vitrina";
  const FEED_TIMEOUT = 4000;
  const YAM_SIGNUP = "https://yam.cdhmaker.com/registro?ref=cdh-cinta";
  const MAX_FEED = 12;
  const SPEED = 42; // px por segundo

  // ── Textos (10 idiomas) ────────────────────────────────────────────────
  // svc: [título, texto] de cada servicio, en el orden de SERVICES abajo.
  // msg: mensaje de WhatsApp ({t} = título de la oferta).
  const T = {
    es: { short: "Short", watch: "Ver short", close: "Cerrar", yt: "Ver en YouTube", pause: "Pausar", play: "Reanudar",
      offer: "Oferta", service: "Servicio", quote: "Cotiza gratis", see: "Ver oferta", before: "Antes", newtab: "se abre en una pestaña nueva",
      msg: "Hola CDH Maker, vi \"{t}\" en su página y quiero cotizar.",
      yam_tag: "YAM · Tiendas", yam_t: "Vende en YAM — crea tu tienda", yam_p: "Tienda en línea, envíos de última milla y recaudo contraentrega en Medellín.", yam_cta: "Crear mi tienda",
      svc: [["Tu software o SaaS a la medida", "Cotización gratis con precio y tiempos en menos de 24 h."],
        ["Automatiza tu negocio con IA", "Chatbots, contenido y procesos que trabajan solos."],
        ["Tu pieza en 3D, láser o CNC", "Fabricación digital en Medellín, envíos a toda Colombia."],
        ["Electrónica, IoT y domótica", "De la idea al prototipo funcional, conectado."]] },
    en: { short: "Short", watch: "Watch short", close: "Close", yt: "Watch on YouTube", pause: "Pause", play: "Play",
      offer: "Deal", service: "Service", quote: "Free quote", see: "See deal", before: "Was", newtab: "opens in a new tab",
      msg: "Hi CDH Maker, I saw \"{t}\" on your website and I'd like a quote.",
      yam_tag: "YAM · Stores", yam_t: "Sell on YAM — open your store", yam_p: "Online store, last-mile delivery and cash on delivery in Medellín.", yam_cta: "Open my store",
      svc: [["Custom software or SaaS", "Free quote with price and timeline in under 24 h."],
        ["Automate your business with AI", "Chatbots, content and processes that run on their own."],
        ["Your part in 3D, laser or CNC", "Digital fabrication in Medellín, shipping across Colombia."],
        ["Electronics, IoT and home automation", "From idea to a working, connected prototype."]] },
    zh: { short: "短视频", watch: "观看短视频", close: "关闭", yt: "在 YouTube 上观看", pause: "暂停", play: "继续",
      offer: "优惠", service: "服务", quote: "免费报价", see: "查看优惠", before: "原价", newtab: "在新标签页中打开",
      msg: "你好 CDH Maker，我在你们的网站上看到了“{t}”，想要报价。",
      yam_tag: "YAM · 网店", yam_t: "在 YAM 开店销售", yam_p: "在麦德林提供网店、最后一公里配送和货到付款。", yam_cta: "开我的店",
      svc: [["定制软件或 SaaS", "24 小时内免费报价，含价格与工期。"],
        ["用 AI 让业务自动化", "聊天机器人、内容和自动运行的流程。"],
        ["3D 打印、激光或 CNC 零件", "麦德林数字制造，发货至哥伦比亚全境。"],
        ["电子、物联网与智能家居", "从想法到可运行的联网原型。"]] },
    hi: { short: "शॉर्ट", watch: "शॉर्ट देखें", close: "बंद करें", yt: "YouTube पर देखें", pause: "रोकें", play: "चलाएँ",
      offer: "ऑफ़र", service: "सेवा", quote: "मुफ़्त कोटेशन", see: "ऑफ़र देखें", before: "पहले", newtab: "नए टैब में खुलता है",
      msg: "नमस्ते CDH Maker, मैंने आपकी वेबसाइट पर \"{t}\" देखा और कोटेशन चाहता/चाहती हूँ।",
      yam_tag: "YAM · स्टोर", yam_t: "YAM पर बेचें — अपना स्टोर बनाएँ", yam_p: "मेडेयिन में ऑनलाइन स्टोर, लास्ट-माइल डिलीवरी और कैश ऑन डिलीवरी।", yam_cta: "मेरा स्टोर बनाएँ",
      svc: [["आपके लिए कस्टम सॉफ़्टवेयर या SaaS", "24 घंटे से कम में कीमत और समय के साथ मुफ़्त कोटेशन।"],
        ["AI से अपना व्यवसाय ऑटोमेट करें", "चैटबॉट, कंटेंट और अपने-आप चलने वाली प्रक्रियाएँ।"],
        ["3D, लेज़र या CNC में आपका पार्ट", "मेडेयिन में डिजिटल फ़ैब्रिकेशन, पूरे कोलंबिया में डिलीवरी।"],
        ["इलेक्ट्रॉनिक्स, IoT और होम ऑटोमेशन", "विचार से काम करने वाले, जुड़े हुए प्रोटोटाइप तक।"]] },
    ar: { short: "مقطع قصير", watch: "شاهد المقطع", close: "إغلاق", yt: "شاهد على YouTube", pause: "إيقاف مؤقت", play: "تشغيل",
      offer: "عرض", service: "خدمة", quote: "عرض سعر مجاني", see: "شاهد العرض", before: "كان", newtab: "يُفتح في علامة تبويب جديدة",
      msg: "مرحبًا CDH Maker، رأيت \"{t}\" على موقعكم وأريد عرض سعر.",
      yam_tag: "YAM · متاجر", yam_t: "بِع على YAM — أنشئ متجرك", yam_p: "متجر إلكتروني وتوصيل الميل الأخير والدفع عند الاستلام في ميديلين.", yam_cta: "أنشئ متجري",
      svc: [["برمجيات أو SaaS حسب الطلب", "عرض سعر مجاني بالسعر والمدة في أقل من 24 ساعة."],
        ["أتمت عملك بالذكاء الاصطناعي", "روبوتات دردشة ومحتوى وعمليات تعمل وحدها."],
        ["قطعتك بالطباعة ثلاثية الأبعاد أو الليزر أو CNC", "تصنيع رقمي في ميديلين مع الشحن إلى كل كولومبيا."],
        ["إلكترونيات وإنترنت الأشياء والمنزل الذكي", "من الفكرة إلى نموذج أولي يعمل ومتصل."]] },
    pt: { short: "Short", watch: "Ver short", close: "Fechar", yt: "Ver no YouTube", pause: "Pausar", play: "Retomar",
      offer: "Oferta", service: "Serviço", quote: "Orçamento grátis", see: "Ver oferta", before: "Antes", newtab: "abre em uma nova aba",
      msg: "Olá CDH Maker, vi \"{t}\" no site de vocês e quero um orçamento.",
      yam_tag: "YAM · Lojas", yam_t: "Venda no YAM — crie sua loja", yam_p: "Loja online, entrega de última milha e pagamento na entrega em Medellín.", yam_cta: "Criar minha loja",
      svc: [["Seu software ou SaaS sob medida", "Orçamento grátis com preço e prazos em menos de 24 h."],
        ["Automatize seu negócio com IA", "Chatbots, conteúdo e processos que funcionam sozinhos."],
        ["Sua peça em 3D, laser ou CNC", "Fabricação digital em Medellín, envio para toda a Colômbia."],
        ["Eletrônica, IoT e domótica", "Da ideia ao protótipo funcional e conectado."]] },
    bn: { short: "শর্ট", watch: "শর্ট দেখুন", close: "বন্ধ করুন", yt: "YouTube-এ দেখুন", pause: "বিরতি", play: "চালান",
      offer: "অফার", service: "সেবা", quote: "বিনামূল্যে কোটেশন", see: "অফার দেখুন", before: "আগে", newtab: "নতুন ট্যাবে খোলে",
      msg: "হ্যালো CDH Maker, আপনাদের ওয়েবসাইটে \"{t}\" দেখেছি এবং কোটেশন চাই।",
      yam_tag: "YAM · স্টোর", yam_t: "YAM-এ বিক্রি করুন — আপনার স্টোর খুলুন", yam_p: "মেদেইনে অনলাইন স্টোর, লাস্ট-মাইল ডেলিভারি ও ক্যাশ অন ডেলিভারি।", yam_cta: "আমার স্টোর খুলুন",
      svc: [["আপনার জন্য কাস্টম সফটওয়্যার বা SaaS", "২৪ ঘণ্টার কম সময়ে দাম ও সময়সহ বিনামূল্যে কোটেশন।"],
        ["AI দিয়ে আপনার ব্যবসা অটোমেট করুন", "চ্যাটবট, কনটেন্ট ও নিজে থেকে চলা প্রক্রিয়া।"],
        ["3D, লেজার বা CNC-তে আপনার পার্ট", "মেদেইনে ডিজিটাল ফ্যাব্রিকেশন, সারা কলম্বিয়ায় ডেলিভারি।"],
        ["ইলেকট্রনিক্স, IoT ও হোম অটোমেশন", "ধারণা থেকে কার্যকর, সংযুক্ত প্রোটোটাইপ।"]] },
    ru: { short: "Short", watch: "Смотреть", close: "Закрыть", yt: "Смотреть на YouTube", pause: "Пауза", play: "Продолжить",
      offer: "Акция", service: "Услуга", quote: "Бесплатный расчёт", see: "Смотреть предложение", before: "Было", newtab: "откроется в новой вкладке",
      msg: "Здравствуйте, CDH Maker! Я увидел(а) «{t}» на вашем сайте и хочу получить расчёт.",
      yam_tag: "YAM · Магазины", yam_t: "Продавайте на YAM — откройте магазин", yam_p: "Интернет-магазин, доставка последней мили и оплата при получении в Медельине.", yam_cta: "Открыть магазин",
      svc: [["ПО или SaaS под ваши задачи", "Бесплатный расчёт цены и сроков менее чем за 24 часа."],
        ["Автоматизируйте бизнес с ИИ", "Чат-боты, контент и процессы, которые работают сами."],
        ["Ваша деталь: 3D-печать, лазер или ЧПУ", "Цифровое производство в Медельине, доставка по всей Колумбии."],
        ["Электроника, IoT и умный дом", "От идеи до работающего подключённого прототипа."]] },
    fr: { short: "Short", watch: "Voir le short", close: "Fermer", yt: "Voir sur YouTube", pause: "Pause", play: "Reprendre",
      offer: "Offre", service: "Service", quote: "Devis gratuit", see: "Voir l'offre", before: "Avant", newtab: "s'ouvre dans un nouvel onglet",
      msg: "Bonjour CDH Maker, j'ai vu « {t} » sur votre site et je voudrais un devis.",
      yam_tag: "YAM · Boutiques", yam_t: "Vendez sur YAM — créez votre boutique", yam_p: "Boutique en ligne, livraison du dernier kilomètre et paiement à la livraison à Medellín.", yam_cta: "Créer ma boutique",
      svc: [["Votre logiciel ou SaaS sur mesure", "Devis gratuit avec prix et délais en moins de 24 h."],
        ["Automatisez votre activité avec l'IA", "Chatbots, contenu et processus qui tournent seuls."],
        ["Votre pièce en 3D, laser ou CNC", "Fabrication numérique à Medellín, livraison dans toute la Colombie."],
        ["Électronique, IoT et domotique", "De l'idée au prototype fonctionnel et connecté."]] },
    id: { short: "Short", watch: "Tonton short", close: "Tutup", yt: "Tonton di YouTube", pause: "Jeda", play: "Lanjutkan",
      offer: "Promo", service: "Layanan", quote: "Penawaran gratis", see: "Lihat promo", before: "Sebelumnya", newtab: "terbuka di tab baru",
      msg: "Halo CDH Maker, saya melihat \"{t}\" di situs Anda dan ingin meminta penawaran.",
      yam_tag: "YAM · Toko", yam_t: "Jual di YAM — buat toko Anda", yam_p: "Toko online, pengiriman last-mile, dan bayar di tempat di Medellín.", yam_cta: "Buat toko saya",
      svc: [["Perangkat lunak atau SaaS khusus", "Penawaran gratis dengan harga dan waktu dalam kurang dari 24 jam."],
        ["Otomatiskan bisnis Anda dengan AI", "Chatbot, konten, dan proses yang berjalan sendiri."],
        ["Komponen Anda dengan 3D, laser, atau CNC", "Fabrikasi digital di Medellín, dikirim ke seluruh Kolombia."],
        ["Elektronik, IoT, dan otomasi rumah", "Dari ide hingga prototipe yang berfungsi dan terhubung."]] },
  };
  const LOCALE = { es: "es-CO", en: "en-US", zh: "zh-CN", hi: "hi-IN", ar: "ar", pt: "pt-BR", bn: "bn-BD", ru: "ru-RU", fr: "fr-FR", id: "id-ID" };
  const lang = () => {
    const l = (document.documentElement.lang || "es").slice(0, 2);
    return T[l] ? l : "es";
  };

  // Íconos: los mismos trazos de las tarjetas de #servicios
  const ICON = {
    software: '<path d="m8 6-6 6 6 6" /><path d="m16 6 6 6-6 6" /><path d="m14 4-4 16" />',
    ai: '<path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-1 5.2V17a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-.8A3 3 0 0 1 5 11v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z" /><path d="M12 2v19" />',
    print3d: '<path d="M6 3h12l4 6-10 12L2 9l4-6z" /><path d="M11 3 8 9l4 12 4-12-3-6" /><path d="M2 9h20" />',
    iot: '<rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />',
  };
  const SERVICES = ["software", "ai", "print3d", "iot"];
  const svg = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  // ── Utilidades ─────────────────────────────────────────────────────────
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Solo URLs https: los datos del feed vienen de otro sistema (nada de javascript:)
  function safeUrl(u) {
    if (!u) return null;
    try {
      const x = new URL(String(u));
      return x.protocol === "https:" ? x.href : null;
    } catch (e) {
      return null;
    }
  }
  async function getJSON(url, ms) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : 0;
    try {
      const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: "omit" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (!/json/i.test(res.headers.get("content-type") || "")) throw new Error("no es JSON");
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
  function money(n, cur) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    try {
      return new Intl.NumberFormat(LOCALE[lang()], { style: "currency", currency: cur || "COP", maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return "$" + Math.round(n).toLocaleString();
    }
  }

  // ── Tarjetas ───────────────────────────────────────────────────────────
  // Si el Short no permite inserción (embed === false en shorts.json) la
  // tarjeta es un enlace a youtube.com; si la permite, un botón que abre el visor.
  function shortCard(s, t) {
    const canEmbed = s.embed !== false;
    const b = el(canEmbed ? "button" : "a", "cinta-card cinta-short");
    if (canEmbed) {
      b.type = "button";
      b.dataset.id = s.id;
      b.dataset.title = s.titulo || "";
      b.setAttribute("aria-label", `${t.watch}: ${s.titulo || ""}`);
    } else {
      b.href = `https://www.youtube.com/shorts/${s.id}`;
      b.target = "_blank";
      b.rel = "noopener";
      b.setAttribute("aria-label", `${t.watch}: ${s.titulo || ""} (${t.newtab})`);
    }
    const thumb = el("span", "cinta-thumb");
    const img = el("img");
    img.src = `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`;
    img.alt = "";
    img.width = 480;
    img.height = 360;
    img.loading = "lazy";
    img.decoding = "async";
    thumb.appendChild(img);
    b.appendChild(thumb);
    b.appendChild(el("span", "cinta-badge", t.short));
    const play = el("span", "cinta-play");
    play.innerHTML = svg(ICON.play);
    b.appendChild(play);
    b.appendChild(el("span", "cinta-cap", s.titulo || ""));
    return b;
  }

  function offerCard(o, t) {
    const a = el("a", "cinta-card cinta-offer cinta-" + o.kind);
    a.href = o.href;
    if (o.external) {
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", `${o.title} — ${o.cta} (${t.newtab})`);
    }
    if (o.msg) a.dataset.msg = o.msg;
    if (o.image) {
      const fig = el("span", "cinta-img");
      const img = el("img");
      img.src = o.image;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => fig.remove();
      fig.appendChild(img);
      a.appendChild(fig);
    } else if (o.icon) {
      const ico = el("span", "cinta-ico");
      ico.innerHTML = svg(ICON[o.icon]);
      a.appendChild(ico);
    }
    a.appendChild(el("span", "cinta-badge", o.tag));
    a.appendChild(el("strong", "cinta-ttl", o.title));
    if (o.text) a.appendChild(el("span", "cinta-txt", o.text));
    if (o.price) {
      const p = el("span", "cinta-price");
      p.appendChild(el("b", null, o.price));
      if (o.before) {
        const s = el("s", null, o.before);
        s.setAttribute("aria-label", `${t.before}: ${o.before}`);
        p.appendChild(s);
      }
      a.appendChild(p);
    }
    if (o.store) a.appendChild(el("span", "cinta-store", o.store));
    a.appendChild(el("span", "cinta-cta", o.cta + " →"));
    return a;
  }

  // Ofertas fijas: "Vende en YAM" + servicios de CDH (respaldo siempre presente)
  function staticOffers(t) {
    const svc = SERVICES.map((icon, i) => ({
      kind: "svc", icon, tag: t.service, title: t.svc[i][0], text: t.svc[i][1], cta: t.quote,
      href: "#contacto", msg: t.msg.replace("{t}", t.svc[i][0]),
    }));
    const yam = { kind: "yam", icon: "bag", tag: t.yam_tag, title: t.yam_t, text: t.yam_p, cta: t.yam_cta, href: YAM_SIGNUP, external: true };
    return [yam, ...svc];
  }

  // Ofertas reales de los comercios de YAM (contrato: /api/publico/vitrina)
  function feedOffers(data, t) {
    if (!data || typeof data !== "object") return [];
    const out = [];
    const ofertas = Array.isArray(data.ofertas) ? data.ofertas : [];
    const campanas = Array.isArray(data.campanas) ? data.campanas : [];
    for (const o of ofertas) {
      const href = o && safeUrl(o.url);
      if (!href || !o.titulo) continue;
      const hasBefore = typeof o.precio_antes === "number" && typeof o.precio === "number" && o.precio_antes > o.precio;
      out.push({
        kind: "prod", tag: t.offer, title: String(o.titulo).slice(0, 80), cta: t.see, href, external: true,
        image: safeUrl(o.imagen), icon: "bag",
        price: money(o.precio, o.moneda), before: hasBefore ? money(o.precio_antes, o.moneda) : "",
        store: o.comercio && o.comercio.nombre ? String(o.comercio.nombre).slice(0, 40) : "",
      });
    }
    for (const c of campanas) {
      const href = c && safeUrl(c.url);
      if (!href || !c.titulo) continue;
      out.push({
        kind: "camp", tag: c.comercio && c.comercio.nombre ? String(c.comercio.nombre).slice(0, 40) : t.offer,
        title: String(c.titulo).slice(0, 80), text: c.texto ? String(c.texto).slice(0, 120) : "",
        cta: t.see, href, external: true, image: safeUrl(c.imagen), icon: "bag",
      });
    }
    return out.slice(0, MAX_FEED);
  }

  // Reparte b entre los elementos de a, de forma pareja
  function spread(a, b) {
    if (!a.length) return b.slice();
    if (!b.length) return a.slice();
    const out = [];
    const step = a.length / b.length;
    let j = 0;
    a.forEach((x, i) => {
      out.push(x);
      while (j < b.length && i + 1 >= step * (j + 1) - 1e-9) out.push(b[j++]);
    });
    while (j < b.length) out.push(b[j++]);
    return out;
  }

  // ── Visor de Shorts (dialog; el iframe existe solo mientras está abierto)
  let dialog = null;
  let lastTrigger = null;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el("dialog", "cinta-modal");
    dialog.setAttribute("aria-labelledby", "cinta-modal-t");
    dialog.innerHTML = `
      <div class="cinta-modal-box">
        <div class="cinta-modal-head">
          <strong id="cinta-modal-t"></strong>
          <button type="button" class="cinta-modal-x"><span aria-hidden="true">×</span></button>
        </div>
        <div class="cinta-modal-frame"></div>
        <a class="cinta-modal-yt" target="_blank" rel="noopener"></a>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".cinta-modal-x").addEventListener("click", () => dialog.close());
    // Clic en el fondo (fuera de la caja) cierra
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.querySelector(".cinta-modal-frame").textContent = ""; // destruye el iframe: detiene el video
      root.classList.remove("is-modal");
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    });
    return dialog;
  }
  function openShort(id, title) {
    const t = T[lang()];
    const watchUrl = `https://www.youtube.com/shorts/${id}`;
    if (typeof HTMLDialogElement !== "function") {
      window.open(watchUrl, "_blank", "noopener");
      return;
    }
    const d = ensureDialog();
    d.querySelector("#cinta-modal-t").textContent = title || t.short;
    const x = d.querySelector(".cinta-modal-x");
    x.setAttribute("aria-label", t.close);
    const yt = d.querySelector(".cinta-modal-yt");
    yt.href = watchUrl;
    yt.textContent = t.yt + " ↗";
    const iframe = el("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
    iframe.title = title || t.short;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    d.querySelector(".cinta-modal-frame").appendChild(iframe);
    root.classList.add("is-modal");
    d.showModal();
    x.focus();
  }

  // ── Montaje y animación ────────────────────────────────────────────────
  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let shorts = [];
  let feedData = null;
  let paused = false;

  function setToggleLabel() {
    if (!toggle) return;
    const t = T[lang()];
    toggle.querySelector(".cinta-toggle-l").textContent = paused ? t.play : t.pause;
  }

  function render() {
    const t = T[lang()];
    const offers = spread(feedOffers(feedData, t), staticOffers(t));
    const items = spread(shorts.map((s) => ({ short: s })), offers.map((o) => ({ offer: o })));
    track.classList.remove("is-anim");
    track.textContent = "";
    const frag = document.createDocumentFragment();
    for (const it of items) {
      const li = el("li", "cinta-item");
      li.appendChild(it.short ? shortCard(it.short, t) : offerCard(it.offer, t));
      frag.appendChild(li);
    }
    track.appendChild(frag);
    root.classList.add("is-ready");
    setupMotion();
    setToggleLabel();
  }

  // Bucle infinito: se duplica el juego de tarjetas (copia oculta para
  // lectores de pantalla y sin foco) y la pista se desplaza la mitad.
  function setupMotion() {
    track.querySelectorAll(".cinta-item.is-clone").forEach((n) => n.remove());
    track.classList.remove("is-anim");
    const reduce = reduceMQ.matches;
    root.classList.toggle("is-static", reduce);
    if (toggle) toggle.hidden = reduce;
    if (reduce) return;
    const originals = Array.from(track.children);
    if (!originals.length) return;
    // Si el juego no llena la pantalla, se repite hasta llenarla
    const minW = viewport.clientWidth + 40;
    let guard = 0;
    while (track.scrollWidth < minW && guard++ < 6) {
      originals.forEach((n) => track.appendChild(cloneItem(n)));
    }
    const setW = track.scrollWidth;
    Array.from(track.children).forEach((n) => track.appendChild(cloneItem(n)));
    track.style.setProperty("--cinta-dur", Math.max(20, Math.round(setW / SPEED)) + "s");
    track.classList.add("is-anim");
  }
  function cloneItem(n) {
    const c = n.cloneNode(true);
    c.classList.add("is-clone");
    // Las copias van ocultas a lectores y sin foco: la lista real se anuncia una vez
    c.setAttribute("aria-hidden", "true");
    c.inert = true;
    c.querySelectorAll("a, button").forEach((x) => x.setAttribute("tabindex", "-1"));
    return c;
  }

  // Delegación de clics (sirve también para las copias)
  track.addEventListener("click", (e) => {
    const s = e.target.closest("button.cinta-short");
    if (s) {
      lastTrigger = s;
      openShort(s.dataset.id, s.dataset.title);
      return;
    }
    const svcLink = e.target.closest(".cinta-svc");
    if (svcLink && window.CDH_CONTACT && typeof window.CDH_CONTACT.waUrl === "function") {
      const url = window.CDH_CONTACT.waUrl(svcLink.dataset.msg || "");
      if (url && url !== "#") {
        e.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
    // Sin contact.js el enlace lleva a #contacto
  });

  if (toggle) {
    toggle.addEventListener("click", () => {
      paused = !paused;
      root.classList.toggle("is-paused", paused);
      toggle.setAttribute("aria-pressed", String(paused));
      setToggleLabel();
    });
  }

  // Fuera de pantalla no se anima (ahorra batería en móvil)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      for (const en of entries) root.classList.toggle("is-off", !en.isIntersecting);
    }).observe(root);
  }

  let resizeTimer = 0;
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) return; // la barra del navegador móvil solo cambia el alto
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupMotion, 250);
  }, { passive: true });
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", setupMotion);
  window.addEventListener("cdh:langchange", () => {
    if (root.classList.contains("is-ready")) render();
  });

  // Datos: primero lo local (rápido) con las ofertas fijas; el feed de YAM
  // llega después y, si trae algo, se vuelve a pintar.
  async function load() {
    try {
      const data = await getJSON(SHORTS_URL, 6000);
      shorts = (Array.isArray(data && data.shorts) ? data.shorts : []).filter((s) => s && /^[\w-]{11}$/.test(s.id));
    } catch (e) {
      shorts = [];
    }
    render();
    try {
      const data = await getJSON(FEED_URL, FEED_TIMEOUT);
      if (feedOffers(data, T[lang()]).length) {
        feedData = data;
        render();
      }
    } catch (e) {
      // Feed caído, sin CORS o aún no publicado: quedan las ofertas fijas
    }
  }

  // Las miniaturas pesan: se espera a que la página termine su carga inicial
  function start() {
    const go = () => load();
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 300);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
