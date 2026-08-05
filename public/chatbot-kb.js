/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — chatbot-kb.js
   Base de conocimiento del asesor "Maker": TODO lo que sabe del negocio.

   Este archivo es el "cerebro"; chatbot.js es el "motor" que lo consulta.
   Se descarga bajo demanda, la primera vez que un visitante abre el chat
   (igual que los diccionarios de i18n): quien nunca abre el chat no lo paga.

   Cómo está organizado:
     KB.intents → lista de intenciones. Cada una tiene palabras clave por
                  idioma (`any` = sirven en todos: marcas, siglas y tecnicismos).
     KB.L[cod]  → todo lo que Maker puede DECIR en ese idioma:
                    ui   · textos de la interfaz del chat
                    btn  · etiquetas de botones y respuestas rápidas
                    svc  · las cuatro líneas de servicio
                    t    · los temas de conversación (el conocimiento real)

   Cobertura por idioma:
     es / en → conocimiento COMPLETO (los idiomas en que Henry hace negocio)
     los 8 restantes → núcleo conversacional completo; para el detalle fino
     el asesor deriva a Henry en el idioma del visitante (nunca mezcla idiomas).

   Un tema (KB.L[cod].t.clave) puede ser:
     "texto"                        → respuesta única
     ["texto A", "texto B"]         → variantes, para no repetirse nunca
     { a: texto|variantes, url, cta } → respuesta + botón de enlace

   Para enseñarle algo nuevo a Maker:
     1. Agrega el tema en KB.L.es.t (y en KB.L.en.t).
     2. Agrega sus palabras clave en KB.intents.
   No hace falta tocar chatbot.js.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

window.CDH_KB = (function () {
  "use strict";

  // ═════════════════════════════════════════════════════════════════════════
  // 1. INTENCIONES — cómo Maker entiende lo que le escriben
  // ═════════════════════════════════════════════════════════════════════════
  // `any`  → claves válidas en cualquier idioma (marcas, siglas, tecnicismos).
  // `es`/`en`/… → claves propias de ese idioma.
  // El orden importa poco: gana la intención con más puntaje (ver chatbot.js).
  const intents = [
    // ── Servicios ──────────────────────────────────────────────────────────
    {
      t: "svc:web",
      k: {
        any: ["web", "app", "software", "landing", "ecommerce", "e-commerce", "saas", "crm", "erp", "api", "backend", "frontend", "next.js", "react", "wordpress", "hosting", "dominio", "domain"],
        es: ["pagina", "paginas", "sitio", "sistema", "tienda", "aplicacion", "programa", "portal", "plataforma", "digitalizar"],
        en: ["website", "store", "shop", "platform", "system", "application"],
        pt: ["pagina", "site", "loja", "sistema", "aplicativo", "plataforma"],
        fr: ["site", "boutique", "logiciel", "application", "plateforme"],
        ru: ["сайт", "магазин", "приложение", "программа", "платформа"],
        zh: ["网站", "网页", "商城", "系统", "应用", "软件"],
        hi: ["वेबसाइट", "ऐप", "सॉफ्टवेयर", "दुकान"],
        ar: ["موقع", "متجر", "تطبيق", "برنامج", "منصة"],
        bn: ["ওয়েবসাইট", "অ্যাপ", "সফটওয়্যার", "দোকান"],
        id: ["situs", "toko", "aplikasi", "perangkat lunak", "platform"],
      },
    },
    {
      t: "svc:maker",
      k: {
        any: ["3d", "cnc", "stl", "dxf", "step", "pla", "petg", "abs", "tpu", "mdf", "fdm"],
        es: ["impresion", "imprimir", "impresora", "laser", "corte", "cortar", "grabado", "grabar", "pieza", "piezas", "prototipo", "prototipado", "filamento", "resina", "repuesto", "molde", "maqueta", "fabricar", "fabricacion", "acrilico", "madera"],
        en: ["print", "printing", "printer", "laser", "cut", "cutting", "engrav", "part", "parts", "prototype", "resin", "filament", "spare", "mold", "acrylic", "wood", "manufactur"],
        pt: ["impressao", "imprimir", "laser", "corte", "gravacao", "peca", "prototipo", "resina", "acrilico", "madeira"],
        fr: ["impression", "imprimer", "laser", "decoupe", "gravure", "piece", "prototype", "resine", "acrylique", "bois"],
        ru: ["печать", "принтер", "лазер", "резка", "гравировка", "деталь", "прототип", "смола"],
        zh: ["打印", "3d打印", "激光", "切割", "雕刻", "零件", "原型", "树脂"],
        hi: ["प्रिंट", "छपाई", "लेजर", "कटिंग", "पुर्जा", "प्रोटोटाइप"],
        ar: ["طباعة", "ليزر", "قص", "نقش", "قطعة", "نموذج"],
        bn: ["প্রিন্ট", "ছাপা", "লেজার", "কাটা", "যন্ত্রাংশ", "প্রোটোটাইপ"],
        id: ["cetak", "printer", "laser", "potong", "ukir", "suku cadang", "purwarupa", "resin"],
      },
    },
    {
      t: "svc:iot",
      k: {
        any: ["iot", "arduino", "esp32", "esp8266", "raspberry", "plc", "mqtt", "lora", "zigbee", "rfid"],
        es: ["sensor", "sensores", "domotica", "automatiz", "electronica", "riego", "monitoreo", "monitorear", "embebido", "robot", "robotica", "circuito", "tarjeta", "invernadero", "cultivo", "alarma", "camara"],
        en: ["sensor", "sensors", "automation", "automate", "electronics", "irrigation", "monitor", "monitoring", "embedded", "robot", "robotics", "circuit", "greenhouse", "alarm", "smart home"],
        pt: ["sensor", "domotica", "automacao", "eletronica", "irrigacao", "monitoramento", "robotica"],
        fr: ["capteur", "domotique", "automatisation", "electronique", "irrigation", "surveillance", "robotique"],
        ru: ["датчик", "автоматизация", "электроника", "полив", "мониторинг", "робот", "умный дом"],
        zh: ["传感器", "自动化", "电子", "灌溉", "监控", "机器人", "智能家居", "物联网"],
        hi: ["सेंसर", "स्वचालन", "इलेक्ट्रॉनिक", "सिंचाई", "निगरानी", "रोबोट"],
        ar: ["حساس", "أتمتة", "إلكترونيات", "ري", "مراقبة", "روبوت", "منزل ذكي"],
        bn: ["সেন্সর", "স্বয়ংক্রিয়", "ইলেকট্রনিক", "সেচ", "পর্যবেক্ষণ", "রোবট"],
        id: ["sensor", "otomatisasi", "elektronika", "irigasi", "pemantauan", "robot", "rumah pintar"],
      },
    },
    {
      t: "svc:consultoria",
      k: {
        any: ["cad", "solidworks", "fusion 360", "autocad", "freecad"],
        es: ["asesoria", "asesor", "consultoria", "consultor", "curso", "taller", "capacitacion", "capacitar", "clase", "clases", "aprender", "ensenar", "formacion", "acompanamiento", "diseno", "disenar", "plano", "planos"],
        en: ["consult", "consulting", "advice", "training", "workshop", "course", "class", "learn", "teach", "mentor", "design", "drawing", "blueprint"],
        pt: ["assessoria", "consultoria", "curso", "oficina", "treinamento", "aula", "aprender", "desenho", "projeto"],
        fr: ["conseil", "consultation", "formation", "atelier", "cours", "apprendre", "dessin", "conception"],
        ru: ["консультация", "обучение", "курс", "мастер-класс", "проектирование", "чертеж"],
        zh: ["咨询", "培训", "课程", "工作坊", "学习", "设计", "图纸"],
        hi: ["परामर्श", "प्रशिक्षण", "कोर्स", "कार्यशाला", "सीखना", "डिज़ाइन"],
        ar: ["استشارة", "تدريب", "دورة", "ورشة", "تعلم", "تصميم", "مخطط"],
        bn: ["পরামর্শ", "প্রশিক্ষণ", "কোর্স", "কর্মশালা", "শেখা", "ডিজাইন"],
        id: ["konsultasi", "pelatihan", "kursus", "lokakarya", "belajar", "desain", "gambar"],
      },
    },

    // ── Comercial ──────────────────────────────────────────────────────────
    {
      t: "precio",
      k: {
        any: ["cotiz", "quote"],
        es: ["precio", "precios", "costo", "costos", "cuanto vale", "cuanto cuesta", "cuanto sale", "presupuesto", "tarifa", "tarifas", "valor", "vale", "cobran", "cobras", "cuanto es"],
        en: ["price", "pricing", "cost", "how much", "budget", "rate", "rates", "charge", "fee"],
        pt: ["preco", "precos", "custo", "quanto custa", "orcamento", "tarifa", "valor"],
        fr: ["prix", "cout", "combien", "devis", "tarif", "budget"],
        ru: ["цена", "цены", "стоимость", "сколько стоит", "смета", "бюджет", "тариф"],
        zh: ["价格", "多少钱", "报价", "费用", "成本", "预算"],
        hi: ["कीमत", "दाम", "कितना", "लागत", "बजट", "शुल्क"],
        ar: ["سعر", "أسعار", "تكلفة", "كم", "عرض سعر", "ميزانية"],
        bn: ["দাম", "মূল্য", "কত", "খরচ", "বাজেট"],
        id: ["harga", "biaya", "berapa", "penawaran", "anggaran", "tarif"],
      },
    },
    {
      t: "caro",
      k: {
        es: ["caro", "costoso", "barato", "economico", "no me alcanza", "muy alto", "descuento", "rebaja", "mucho dinero"],
        en: ["expensive", "pricey", "cheap", "affordable", "too much", "discount", "tight budget"],
        pt: ["caro", "barato", "desconto", "muito alto"],
        fr: ["cher", "couteux", "pas cher", "reduction", "trop"],
        ru: ["дорого", "дешево", "скидка", "слишком"],
        zh: ["贵", "太贵", "便宜", "折扣"],
        hi: ["महंगा", "सस्ता", "छूट"],
        ar: ["غالي", "رخيص", "خصم"],
        bn: ["দামি", "সস্তা", "ছাড়"],
        id: ["mahal", "murah", "diskon"],
      },
    },
    {
      t: "tiempo",
      k: {
        es: ["cuanto se demora", "cuanto tarda", "cuanto tiempo", "demora", "tardan", "plazo", "plazos", "entrega", "entregan", "rapido", "urgente", "para cuando", "cuando esta"],
        en: ["how long", "how much time", "deadline", "delivery time", "lead time", "turnaround", "urgent", "when will", "fast"],
        pt: ["quanto tempo", "demora", "prazo", "entrega", "urgente"],
        fr: ["combien de temps", "delai", "livraison", "urgent", "quand"],
        ru: ["сколько времени", "срок", "сроки", "доставка", "срочно", "когда"],
        zh: ["多久", "多长时间", "工期", "交付", "什么时候", "急"],
        hi: ["कितना समय", "कब तक", "समय सीमा", "जल्दी"],
        ar: ["كم من الوقت", "مدة", "موعد", "متى", "عاجل"],
        bn: ["কত সময়", "কতদিন", "সময়সীমা", "কখন"],
        id: ["berapa lama", "waktu", "tenggat", "kapan", "cepat"],
      },
    },
    {
      t: "pago",
      k: {
        es: ["pago", "pagar", "pagos", "transferencia", "efectivo", "tarjeta", "anticipo", "abono", "cuotas", "financia", "nequi", "bancolombia", "pse", "factura", "facturan", "iva", "contrato"],
        en: ["payment", "pay", "installment", "deposit", "upfront", "invoice", "billing", "contract", "wire", "paypal"],
        pt: ["pagamento", "pagar", "parcela", "entrada", "fatura", "contrato"],
        fr: ["paiement", "payer", "acompte", "facture", "contrat", "echelonne"],
        ru: ["оплата", "платеж", "предоплата", "счет", "договор", "рассрочка"],
        zh: ["付款", "支付", "定金", "发票", "合同", "分期"],
        hi: ["भुगतान", "पेमेंट", "अग्रिम", "चालान", "अनुबंध"],
        ar: ["دفع", "الدفع", "عربون", "فاتورة", "عقد", "تقسيط"],
        bn: ["পেমেন্ট", "পরিশোধ", "অগ্রিম", "চালান", "চুক্তি"],
        id: ["pembayaran", "bayar", "uang muka", "faktur", "kontrak", "cicilan"],
      },
    },
    {
      t: "garantia",
      k: {
        es: ["garantia", "soporte", "mantenimiento", "falla", "fallo", "arregl", "reparar", "dano", "no funciona", "posventa", "actualizacion"],
        en: ["warranty", "guarantee", "support", "maintenance", "broken", "fix", "repair", "not working", "after sales", "update"],
        pt: ["garantia", "suporte", "manutencao", "conserto", "nao funciona"],
        fr: ["garantie", "support", "maintenance", "reparation", "ne marche pas"],
        ru: ["гарантия", "поддержка", "обслуживание", "ремонт", "не работает"],
        zh: ["保修", "质保", "支持", "维护", "维修", "不работает", "坏了"],
        hi: ["वारंटी", "सहायता", "रखरखाव", "मरम्मत", "काम नहीं"],
        ar: ["ضمان", "دعم", "صيانة", "إصلاح", "لا يعمل"],
        bn: ["ওয়ারেন্টি", "সহায়তা", "রক্ষণাবেক্ষণ", "মেরামত", "কাজ করছে না"],
        id: ["garansi", "dukungan", "pemeliharaan", "perbaikan", "tidak berfungsi"],
      },
    },

    // ── Sobre CDH Maker ────────────────────────────────────────────────────
    {
      t: "quien",
      k: {
        any: ["cdh", "cdh maker"],
        es: ["quien eres", "quienes son", "quien es", "sobre ti", "sobre ustedes", "que es cdh", "a que se dedican", "que hacen", "empresa", "de que se trata"],
        en: ["who are you", "who are", "about you", "about us", "what is cdh", "what do you do", "company"],
        pt: ["quem e voce", "quem sao", "sobre voces", "o que fazem", "empresa"],
        fr: ["qui etes", "qui es", "a propos", "que faites", "entreprise"],
        ru: ["кто вы", "кто ты", "о вас", "чем занимаетесь", "компания"],
        zh: ["你是谁", "你们是谁", "关于", "公司", "做什么"],
        hi: ["आप कौन", "तुम कौन", "कंपनी", "क्या करते"],
        ar: ["من أنت", "من أنتم", "عن الشركة", "ماذا تفعلون"],
        bn: ["আপনি কে", "তোমরা কে", "কোম্পানি", "কী করেন"],
        id: ["siapa kamu", "siapa anda", "tentang", "perusahaan", "apa yang kalian"],
      },
    },
    {
      t: "henry",
      k: {
        any: ["henry", "taborda"],
        es: ["quien esta detras", "el dueno", "el ingeniero", "fundador"],
        en: ["founder", "owner", "the engineer", "who runs"],
      },
    },
    {
      t: "equipo",
      k: {
        es: ["cuantos son", "el equipo", "trabajan solos", "cuantas personas", "socios"],
        en: ["team size", "how many people", "the team", "partners"],
        pt: ["quantos sao", "a equipe"],
        fr: ["equipe", "combien etes"],
        ru: ["команда", "сколько вас"],
        zh: ["团队", "几个人"],
        hi: ["टीम", "कितने लोग"],
        ar: ["الفريق", "كم شخص"],
        bn: ["দল", "কতজন"],
        id: ["tim", "berapa orang"],
      },
    },
    {
      t: "experiencia",
      k: {
        es: ["experiencia", "cuanto llevan", "cuantos anos", "trayectoria", "desde cuando", "referencias", "clientes"],
        en: ["experience", "how long have you", "years", "track record", "references", "clients"],
        pt: ["experiencia", "quantos anos", "clientes"],
        fr: ["experience", "depuis quand", "clients"],
        ru: ["опыт", "сколько лет", "клиенты"],
        zh: ["经验", "多少年", "客户"],
        hi: ["अनुभव", "कितने साल", "ग्राहक"],
        ar: ["خبرة", "كم سنة", "عملاء"],
        bn: ["অভিজ্ঞতা", "কত বছর", "ক্লায়েন্ট"],
        id: ["pengalaman", "berapa tahun", "klien"],
      },
    },
    {
      t: "donde",
      k: {
        es: ["donde estan", "donde queda", "ubicacion", "ciudad", "pais", "direccion", "medellin", "colombia", "presencial", "visitar"],
        en: ["where are you", "location", "city", "country", "address", "visit", "in person"],
        pt: ["onde ficam", "localizacao", "cidade", "pais", "endereco"],
        fr: ["ou etes", "localisation", "ville", "pays", "adresse"],
        ru: ["где вы", "адрес", "город", "страна", "местоположение"],
        zh: ["在哪", "位置", "城市", "国家", "地址"],
        hi: ["कहाँ", "स्थान", "शहर", "देश", "पता"],
        ar: ["أين", "موقع", "مدينة", "بلد", "عنوان"],
        bn: ["কোথায়", "অবস্থান", "শহর", "দেশ", "ঠিকানা"],
        id: ["di mana", "lokasi", "kota", "negara", "alamat"],
      },
    },
    {
      t: "envios",
      k: {
        es: ["envio", "envian", "enviar", "mensajeria", "despacho", "internacional", "exterior", "afuera", "otro pais", "flete"],
        en: ["shipping", "ship", "courier", "international", "abroad", "overseas", "freight"],
        pt: ["envio", "entrega", "internacional", "exterior"],
        fr: ["expedition", "livraison", "international", "etranger"],
        ru: ["доставка", "отправка", "международная", "за границу"],
        zh: ["运输", "邮寄", "国际", "海外", "发货"],
        hi: ["शिपिंग", "भेजना", "अंतरराष्ट्रीय", "विदेश"],
        ar: ["شحن", "إرسال", "دولي", "خارج"],
        bn: ["শিপিং", "পাঠানো", "আন্তর্জাতিক", "বিদেশ"],
        id: ["pengiriman", "kirim", "internasional", "luar negeri"],
      },
    },
    {
      t: "horario",
      k: {
        es: ["horario", "atienden", "abierto", "disponible", "a que hora", "fin de semana", "domingo", "festivo"],
        en: ["hours", "schedule", "open", "available", "what time", "weekend", "sunday"],
        pt: ["horario", "atendem", "aberto", "disponivel", "fim de semana"],
        fr: ["horaires", "ouvert", "disponible", "quelle heure", "week-end"],
        ru: ["часы работы", "график", "открыто", "доступны", "выходные"],
        zh: ["营业时间", "几点", "开门", "周末", "有空"],
        hi: ["समय", "खुला", "उपलब्ध", "सप्ताहांत"],
        ar: ["ساعات", "مواعيد", "مفتوح", "متاح", "عطلة"],
        bn: ["সময়", "খোলা", "উপলব্ধ", "সপ্তাহান্ত"],
        id: ["jam", "jadwal", "buka", "tersedia", "akhir pekan"],
      },
    },

    // ── Proyectos y tecnología ─────────────────────────────────────────────
    {
      t: "portafolio",
      k: {
        any: ["portafolio", "portfolio"],
        es: ["proyectos", "trabajos", "ejemplos", "casos", "que han hecho", "muestras", "demo", "demos"],
        en: ["projects", "work", "examples", "case studies", "what have you built", "samples", "demo"],
        pt: ["projetos", "trabalhos", "exemplos", "casos"],
        fr: ["projets", "travaux", "exemples", "realisations"],
        ru: ["проекты", "работы", "примеры", "кейсы"],
        zh: ["项目", "作品", "案例", "例子"],
        hi: ["परियोजना", "काम", "उदाहरण"],
        ar: ["مشاريع", "أعمال", "أمثلة"],
        bn: ["প্রকল্প", "কাজ", "উদাহরণ"],
        id: ["proyek", "karya", "contoh", "studi kasus"],
      },
    },
    { t: "privacycheck", k: { any: ["privacycheck", "privacy check", "ley 1581", "1581", "habeas data", "rnbd"], es: ["proteccion de datos"], en: ["data protection"] } },
    { t: "evaia", k: { any: ["evaia", "eva ia", "eva"] } },
    { t: "taxiya", k: { any: ["taxiya", "taxi ya"], es: ["taxis", "taxi"], en: ["taxi", "ride hailing"] } },
    { t: "incubapp", k: { any: ["incubapp", "incubant"], es: ["incubadora", "avicola", "granja", "pollos"], en: ["hatchery", "poultry", "farm"] } },
    { t: "atiempo", k: { any: ["a tiempo", "atiempo"], es: ["logistica", "ultima milla", "guias", "domicilios", "contraentrega"], en: ["logistics", "last mile", "delivery tracking"] } },
    { t: "cavaltec", k: { any: ["cavaltec", "sintaxis", "sintaxis ti", "reto"] } },
    {
      t: "ia",
      k: {
        any: ["ia", "ai", "chatgpt", "llm", "machine learning", "gpt"],
        es: ["inteligencia artificial", "modelo", "automatizar con ia"],
        en: ["artificial intelligence", "smart", "neural"],
        pt: ["inteligencia artificial"],
        fr: ["intelligence artificielle"],
        ru: ["искусственный интеллект", "нейросеть"],
        zh: ["人工智能", "智能"],
        hi: ["कृत्रिम बुद्धिमत्ता"],
        ar: ["ذكاء اصطناعي"],
        bn: ["কৃত্রিম বুদ্ধিমত্তা"],
        id: ["kecerdasan buatan"],
      },
    },
    {
      t: "tecnologias",
      k: {
        any: ["python", "javascript", "firebase", "supabase", "vercel", "nextjs", "node", "sql", "tecnologias", "stack"],
        es: ["que tecnologias", "con que trabajan", "lenguajes", "herramientas"],
        en: ["what tech", "technologies", "languages", "tools", "tech stack"],
      },
    },
    {
      t: "materiales",
      k: {
        any: ["pla", "petg", "abs", "tpu", "nylon", "mdf", "acrilico", "acrylic"],
        es: ["material", "materiales", "que material", "madera", "metal", "aluminio", "plastico"],
        en: ["material", "materials", "wood", "metal", "aluminum", "plastic"],
        pt: ["material", "materiais", "madeira", "metal", "plastico"],
        fr: ["materiau", "materiaux", "bois", "metal", "plastique"],
        ru: ["материал", "материалы", "дерево", "металл", "пластик"],
        zh: ["材料", "木材", "金属", "塑料"],
        hi: ["सामग्री", "लकड़ी", "धातु", "प्लास्टिक"],
        ar: ["مواد", "خشب", "معدن", "بلاستيك"],
        bn: ["উপকরণ", "কাঠ", "ধাতু", "প্লাস্টিক"],
        id: ["bahan", "material", "kayu", "logam", "plastik"],
      },
    },
    {
      t: "archivos",
      k: {
        any: ["stl", "dxf", "step", "obj", "svg", "gcode", "iges"],
        es: ["que archivo", "que necesitas", "que te mando", "que envio", "medidas", "plano", "formato"],
        en: ["what file", "what do you need", "send you", "measurements", "drawing", "format"],
      },
    },
    {
      t: "proceso",
      k: {
        es: ["como trabajan", "como es el proceso", "pasos", "metodologia", "como empiezo", "por donde empiezo", "como funciona"],
        en: ["how do you work", "process", "steps", "methodology", "how do i start", "get started", "how does it work"],
        pt: ["como trabalham", "processo", "etapas", "como comeco"],
        fr: ["comment travaillez", "processus", "etapes", "comment commencer"],
        ru: ["как работаете", "процесс", "этапы", "как начать"],
        zh: ["流程", "怎么合作", "步骤", "如何开始"],
        hi: ["प्रक्रिया", "कैसे काम", "चरण", "कैसे शुरू"],
        ar: ["كيف تعملون", "العملية", "خطوات", "كيف أبدأ"],
        bn: ["প্রক্রিয়া", "কীভাবে কাজ", "ধাপ", "কীভাবে শুরু"],
        id: ["proses", "cara kerja", "langkah", "bagaimana memulai"],
      },
    },
    { t: "aliados", k: { any: ["galactic", "galactic aima", "aima"], es: ["aliados", "socios comerciales"], en: ["allies", "partners"] } },

    // ── Cuenta, datos y contacto ───────────────────────────────────────────
    {
      t: "cuenta",
      k: {
        es: ["por que crear cuenta", "para que la cuenta", "registrarme", "registro", "por que registrarme", "crear cuenta", "iniciar sesion"],
        en: ["why create account", "why register", "sign up", "register", "log in", "account"],
        pt: ["criar conta", "cadastro", "registrar"],
        fr: ["creer un compte", "inscription", "s inscrire"],
        ru: ["создать аккаунт", "регистрация", "зарегистрироваться"],
        zh: ["注册", "账号", "登录"],
        hi: ["खाता", "पंजीकरण", "साइन अप"],
        ar: ["حساب", "تسجيل", "اشتراك"],
        bn: ["অ্যাকাউন্ট", "নিবন্ধন", "সাইন আপ"],
        id: ["akun", "daftar", "registrasi", "masuk"],
      },
    },
    {
      t: "privacidad",
      k: {
        es: ["mis datos", "que hacen con mis datos", "privacidad", "spam", "venden mis datos", "seguro", "seguridad"],
        en: ["my data", "privacy", "spam", "sell my data", "is it safe", "security"],
        pt: ["meus dados", "privacidade", "seguro"],
        fr: ["mes donnees", "confidentialite", "securite"],
        ru: ["мои данные", "конфиденциальность", "безопасно"],
        zh: ["我的数据", "隐私", "安全"],
        hi: ["मेरा डेटा", "गोपनीयता", "सुरक्षित"],
        ar: ["بياناتي", "خصوصية", "آمن"],
        bn: ["আমার ডেটা", "গোপনীয়তা", "নিরাপদ"],
        id: ["data saya", "privasi", "aman"],
      },
    },
    {
      t: "contacto",
      k: {
        any: ["whatsapp", "wa", "email", "e-mail", "telegram"],
        es: ["contacto", "contactar", "telefono", "numero", "celular", "correo", "escribir", "llamar", "hablar con"],
        en: ["contact", "phone", "number", "mail", "write to", "call", "reach you", "get in touch"],
        pt: ["contato", "telefone", "numero", "email", "ligar", "falar com"],
        fr: ["contact", "telephone", "numero", "courriel", "appeler", "joindre"],
        ru: ["контакт", "телефон", "номер", "почта", "позвонить", "связаться"],
        zh: ["联系", "电话", "号码", "邮箱", "联系方式"],
        hi: ["संपर्क", "फोन", "नंबर", "ईमेल", "बात"],
        ar: ["اتصال", "هاتف", "رقم", "بريد", "تواصل"],
        bn: ["যোগাযোগ", "ফোন", "নম্বর", "ইমেইল"],
        id: ["kontak", "telepon", "nomor", "surel", "hubungi"],
      },
    },
    {
      t: "humano",
      k: {
        es: ["persona real", "un humano", "alguien real", "hablar con alguien", "un asesor real", "operador"],
        en: ["real person", "a human", "talk to someone", "real agent", "operator", "speak to a person"],
        pt: ["pessoa real", "um humano", "falar com alguem"],
        fr: ["une personne", "un humain", "parler a quelqu un"],
        ru: ["живой человек", "оператор", "поговорить с человеком"],
        zh: ["真人", "人工", "找个人"],
        hi: ["असली आदमी", "इंसान", "किसी से बात"],
        ar: ["شخص حقيقي", "إنسان", "موظف"],
        bn: ["আসল মানুষ", "কারো সাথে কথা"],
        id: ["orang asli", "manusia", "bicara dengan orang"],
      },
    },

    // ── Charla y control de la conversación ────────────────────────────────
    {
      t: "saludo",
      k: {
        any: ["hola", "hey", "hi", "hello", "ola", "salut", "привет", "你好", "नमस्ते", "مرحبا", "হ্যালো", "halo"],
        es: ["buenas", "buenos dias", "buenas tardes", "buenas noches", "saludos", "que tal", "quiubo"],
        en: ["good morning", "good afternoon", "good evening", "hey there", "howdy"],
        pt: ["bom dia", "boa tarde", "boa noite"],
        fr: ["bonjour", "bonsoir", "coucou"],
        ru: ["здравствуйте", "добрый день", "доброе утро"],
        zh: ["您好", "早上好", "晚上好"],
        hi: ["नमस्कार", "सुप्रभात"],
        ar: ["السلام عليكم", "صباح الخير", "مساء الخير"],
        bn: ["নমস্কার", "সুপ্রভাত"],
        id: ["selamat pagi", "selamat siang", "selamat malam", "hai"],
      },
    },
    {
      t: "comoestas",
      k: {
        es: ["como estas", "como vas", "todo bien", "que mas"],
        en: ["how are you", "how is it going", "how do you do", "whats up"],
        pt: ["como vai", "tudo bem"],
        fr: ["comment ca va", "ca va"],
        ru: ["как дела", "как ты"],
        zh: ["你好吗", "最近怎么样"],
        hi: ["कैसे हो", "क्या हाल"],
        ar: ["كيف حالك"],
        bn: ["কেমন আছেন"],
        id: ["apa kabar"],
      },
    },
    {
      t: "bot",
      k: {
        any: ["bot", "robot", "chatbot"],
        es: ["eres un bot", "eres real", "eres humano", "eres una maquina", "eres ia", "hablo con una maquina"],
        en: ["are you a bot", "are you real", "are you human", "are you ai", "am i talking to a machine"],
        pt: ["voce e um bot", "voce e real", "e humano"],
        fr: ["es tu un robot", "es tu reel", "es tu humain"],
        ru: ["ты бот", "ты живой", "ты человек"],
        zh: ["你是机器人", "你是真人吗"],
        hi: ["क्या आप बॉट", "असली हो"],
        ar: ["هل أنت روبوت", "هل أنت حقيقي"],
        bn: ["আপনি কি বট", "সত্যি মানুষ"],
        id: ["apakah kamu bot", "kamu robot", "kamu manusia"],
      },
    },
    {
      t: "gracias",
      k: {
        any: ["ok", "okay", "thanks", "thank you", "merci", "obrigado", "obrigada", "spasibo", "спасибо", "谢谢", "धन्यवाद", "شكرا", "ধন্যবাদ", "terima kasih"],
        es: ["gracias", "genial", "perfecto", "excelente", "buenisimo", "vale", "listo", "de una", "chevere", "bacano"],
        en: ["great", "awesome", "cool", "perfect", "nice", "got it", "understood"],
      },
    },
    {
      t: "bye",
      k: {
        any: ["bye", "chao", "ciao", "tchau", "adieu", "пока", "再见", "अलविदा", "وداعا", "বিদায়"],
        es: ["adios", "hasta luego", "nos vemos", "me voy", "hasta pronto", "que estes bien"],
        en: ["goodbye", "see you", "later", "take care", "i am leaving"],
        fr: ["au revoir", "a bientot"],
        pt: ["ate logo", "ate mais"],
        id: ["sampai jumpa", "selamat tinggal"],
      },
    },
    {
      t: "si",
      k: {
        any: ["si", "yes", "sim", "oui", "да", "是", "हाँ", "نعم", "হ্যাঁ", "ya", "yeah", "yep", "sure", "claro", "dale"],
        es: ["por supuesto", "me interesa", "obvio"],
        en: ["of course", "i am interested", "definitely"],
      },
    },
    {
      t: "no",
      k: {
        any: ["no", "nope", "non", "nao", "нет", "不", "नहीं", "لا", "না", "tidak", "nah"],
        es: ["todavia no", "por ahora no", "ninguno", "nada"],
        en: ["not yet", "not now", "none", "nothing"],
      },
    },
    {
      t: "ayuda",
      k: {
        es: ["ayuda", "que puedes hacer", "que sabes", "opciones", "menu", "no se que preguntar"],
        en: ["help", "what can you do", "what do you know", "options", "menu"],
        pt: ["ajuda", "o que voce faz", "opcoes"],
        fr: ["aide", "que peux tu faire", "options"],
        ru: ["помощь", "что ты умеешь", "меню"],
        zh: ["帮助", "你能做什么", "菜单"],
        hi: ["मदद", "क्या कर सकते", "मेनू"],
        ar: ["مساعدة", "ماذا تستطيع", "قائمة"],
        bn: ["সাহায্য", "কী করতে পারেন", "মেনু"],
        id: ["bantuan", "apa yang bisa", "menu"],
      },
    },
    {
      t: "queja",
      k: {
        es: ["queja", "reclamo", "molesto", "mal servicio", "inservible", "estafa", "no me respondieron"],
        en: ["complaint", "angry", "bad service", "useless", "scam", "no one replied"],
      },
    },
    {
      t: "trabajo",
      k: {
        es: ["trabajo", "empleo", "vacante", "hoja de vida", "cv", "practicas", "pasantia", "contratan", "buscan gente"],
        en: ["job", "hiring", "vacancy", "resume", "internship", "career", "work with you"],
        pt: ["emprego", "vaga", "curriculo", "estagio"],
        fr: ["emploi", "recrutement", "stage", "cv"],
        ru: ["работа", "вакансия", "резюме", "стажировка"],
        zh: ["招聘", "工作", "简历", "实习"],
        hi: ["नौकरी", "भर्ती", "इंटर्नशिप"],
        ar: ["وظيفة", "توظيف", "تدريب"],
        bn: ["চাকরি", "নিয়োগ", "ইন্টার্নশিপ"],
        id: ["pekerjaan", "lowongan", "magang", "karier"],
      },
    },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  // 2. LO QUE MAKER DICE — un bloque por idioma
  // ═════════════════════════════════════════════════════════════════════════
  const L = {};

  // ── URLs reales de los proyectos (compartidas por todos los idiomas) ──────
  const URL = {
    privacycheck: "https://privacycheck-co.vercel.app",
    taxiya: "https://taxiya.vercel.app",
    incubapp: "https://incubant-app.vercel.app",
    atiempo: "https://atiempo-logistica.vercel.app",
    aliado: "https://www.galacticaima.com",
  };

  // ═════════════════════════ ESPAÑOL (completo) ════════════════════════════
  L.es = {
    ui: {
      sub: "Asesor de CDH Maker · en línea",
      placeholder: "Escribe tu mensaje…",
      open: "Abrir chat de asistencia",
      close: "Cerrar chat",
      chat: "Chat con Maker, asesor de CDH Maker",
      quick: "Respuestas rápidas",
      voice_on: "Activar voz del asesor",
      voice_off: "Silenciar voz del asesor",
      voice_ready: "Listo, ya me escuchas. Cuéntame en qué proyecto andas.",
    },
    btn: {
      back: "Ver otros servicios",
      menu: "Ver los servicios",
      quote: "Cotizar por WhatsApp",
      how_long: "¿Cuánto se demora?",
      how_much: "¿Cuánto cuesta?",
      open_wa: "Abrir WhatsApp",
      create_account: "Crear cuenta gratis",
      send_project: "Enviar mi proyecto por WhatsApp",
      ask_direct: "Preguntarle a Henry",
      talk_henry: "Hablar con Henry",
      more: "Cuéntame más",
      process: "¿Cómo trabajan?",
      projects: "Ver proyectos",
      visit: "Abrir el proyecto",
    },
    wa: {
      generic: "Hola Henry, vengo de tu página web. Tengo una consulta: ",
      quote: "Hola Henry, vengo de tu página y quiero una cotización: ",
      contact: "Hola Henry, vengo de tu página web (cliente registrado) y quiero hablar contigo.",
    },
    svc: {
      web: {
        name: "Web y software",
        pitch: "Buena elección. Una página o un sistema bien hecho trabaja por ti las 24 horas. Hacemos <b>sitios web, tiendas en línea y software a la medida</b> — esta misma página salió de nuestro taller, igual que <b>PrivacyCheck</b>, <b>TaxiYa</b> o <b>IncubApp</b>.",
        hook: "¿Qué necesitas exactamente? ¿Una página para tu negocio, una tienda, un sistema interno para tu equipo…? Cuéntamelo con tus palabras y te oriento.",
        detail: "En concreto construimos: <b>sitios y landing pages</b> que cargan rápido y salen en Google; <b>tiendas en línea</b> con pagos y envíos; <b>aplicaciones web a la medida</b> (inventarios, agendas, rutas, reportes); y <b>automatización</b> de eso que hoy se hace a mano en Excel o WhatsApp. Trabajamos con Next.js, JavaScript, Python, Firebase y Supabase, y desplegamos en la nube para que no tengas que administrar servidores.",
        wa: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de desarrollo web/software: ",
      },
      maker: {
        name: "Impresión 3D · Láser · CNC",
        pitch: "Me encanta ese terreno. Convertimos ideas y planos en <b>piezas reales</b>: impresión 3D (FDM y resina), corte y grabado láser, y mecanizado CNC. Desde un repuesto imposible de conseguir hasta un prototipo de producto.",
        hook: "¿Qué quieres fabricar? Si tienes una foto, las medidas o un archivo (STL, DXF, STEP), mejor todavía — descríbemelo y lo cotizamos.",
        detail: "Con <b>impresión 3D FDM</b> hacemos piezas funcionales, repuestos y carcasas; con <b>resina</b>, piezas con mucho detalle (miniaturas, joyería, modelos dentales). El <b>láser</b> corta y graba MDF, acrílico, cuero y cartón: señalización, souvenirs, tableros, empaques. El <b>CNC</b> es para piezas que necesitan más resistencia o mejor acabado. Si no tienes el archivo, lo diseñamos nosotros en CAD.",
        wa: "Hola Henry, vengo de tu página. Quiero cotizar fabricación digital (3D/láser/CNC): ",
      },
      iot: {
        name: "Electrónica e IoT",
        pitch: "Excelente terreno. Automatizamos casas, cultivos e industria con <b>Arduino, ESP32 y Raspberry Pi</b>: sensores, monitoreo desde el celular, domótica y sistemas a la medida.",
        hook: "¿Qué te gustaría automatizar o monitorear? ¿Temperatura, riego, seguridad, consumo de energía, una máquina…? Cuéntame el escenario.",
        detail: "Hacemos <b>sistemas embebidos</b> completos: diseñamos el circuito, programamos el microcontrolador y montamos la carcasa (la imprimimos aquí mismo). Lo típico: riego automático por humedad de suelo, control de temperatura en invernaderos o incubadoras, sensores de puertas y alarmas, medición de consumo eléctrico, y tableros para ver todo desde el celular. Si el proyecto lo pide, conectamos los datos a la nube y les montamos una web encima.",
        wa: "Hola Henry, vengo de tu página. Quiero cotizar un proyecto de electrónica/IoT: ",
      },
      consultoria: {
        name: "Diseño y asesorías",
        pitch: "Claro que sí. Ofrecemos <b>diseño CAD 2D/3D, asesoría técnica y talleres</b>. Si tienes una idea pero no sabes por dónde empezar, te acompañamos desde el boceto.",
        hook: "¿Buscas el diseño de una pieza, una asesoría para tu proyecto o una capacitación para tu equipo? Cuéntame un poco más.",
        detail: "En <b>diseño CAD</b> partimos de un boceto, una foto o una pieza física y entregamos el modelo listo para fabricar. En <b>asesoría</b> revisamos tu idea y te decimos con honestidad qué es viable, qué cuesta y por dónde conviene empezar — a veces la mejor recomendación es hacer menos. Y en <b>formación</b> damos talleres maker: impresión 3D, electrónica y programación, para colegios, empresas y grupos.",
        wa: "Hola Henry, vengo de tu página. Me interesa diseño CAD / asesoría / capacitación: ",
      },
    },
    t: {
      // ── Charla ───────────────────────────────────────────────────────────
      greeting: [
        "Soy <b>Maker</b>, el asesor de <b>CDH Maker</b>. Cuéntame, ¿qué te trae por aquí? ¿Una idea, un proyecto, o solo estás mirando?",
        "Soy <b>Maker</b>. Aquí construimos de todo: software, piezas 3D, electrónica… ¿Qué tienes en mente?",
        "Soy <b>Maker</b>, del equipo de CDH Maker. Si tienes una idea dando vueltas, este es el lugar para aterrizarla. ¿En qué te ayudo?",
      ],
      re_greeting: ["¡Hola de nuevo! 😄 ¿En qué te ayudo?", "¡Aquí sigo! ¿Qué más quieres saber?", "¡Hey! Dime, ¿seguimos con lo de antes o cambiamos de tema?"],
      good_morning: "¡Buenos días! ☀️",
      good_afternoon: "¡Buenas tardes!",
      good_evening: "¡Buenas noches! 🌙",
      comoestas: [
        "¡Muy bien, gracias por preguntar! 😊 Aquí, listo para ayudarte a aterrizar una idea. ¿Y tú, en qué andas?",
        "De maravilla — nunca me canso de hablar de proyectos. 😄 Cuéntame el tuyo.",
      ],
      bot: "Buena pregunta, y te contesto con honestidad: soy un <b>asistente virtual</b> de CDH Maker, no una persona. Lo que sí es real es todo lo que te cuento — los servicios, los proyectos y los tiempos son los de verdad. Y cuando quieras hablar con <b>Henry</b>, que sí es de carne y hueso, te paso con él en un clic.",
      thanks: ["¡Con gusto! 😊 ¿Algo más en lo que te pueda ayudar?", "¡Para eso estamos! ¿Quieres ver algo más?", "¡De nada! Si te queda alguna duda, aquí sigo."],
      bye: ["¡Que te vaya muy bien! Aquí estaré cuando quieras retomar tu proyecto. 👋", "¡Gracias por pasar! Cuando la idea madure, ya sabes dónde encontrarnos. 👋"],
      yes: "¡Perfecto! Cuéntame un poco más o elige una opción:",
      no_worries: "Sin problema. Si prefieres, explora los servicios con calma o pregúntame lo que sea:",
      ayuda: "Te cuento lo que sé: puedo explicarte nuestras <b>cuatro líneas de servicio</b> (web y software, fabricación digital, electrónica e IoT, diseño y asesorías), contarte de los <b>proyectos</b> que hemos construido, resolverte dudas de <b>precios, tiempos, pagos, garantía o materiales</b>, y dejarte el mensaje listo para que Henry te cotice. Pregúntame con tus palabras, que yo te entiendo.",
      queja: "Lamento que hayas tenido una mala experiencia, y quiero que se resuelva. Lo mejor es que se lo cuentes <b>directo a Henry</b>: él responde personalmente y no delega los reclamos. Escríbele y cuéntale qué pasó.",
      trabajo: "¡Qué bueno que preguntes! CDH Maker es un equipo pequeño y no tenemos vacantes publicadas, pero siempre estamos abiertos a <b>colaborar con gente buena</b> — desarrolladores, diseñadores, gente del mundo maker. Escríbele a Henry contándole qué haces y qué te gustaría construir.",

      // ── Sobre nosotros ───────────────────────────────────────────────────
      quien: "Somos <b>CDH Maker</b> y trabajamos desde <b>Medellín, Colombia</b> 🇨🇴 convirtiendo ideas en soluciones reales. Cubrimos cuatro frentes: <b>desarrollo de software</b>, <b>fabricación digital</b> (3D, láser, CNC), <b>electrónica e IoT</b> y <b>diseño y consultoría técnica</b>. De aquí han salido <b>EvaIA</b>, <b>TaxiYa</b>, <b>IncubApp</b>, <b>A Tiempo Logística</b> y <b>PrivacyCheck</b>. La filosofía es simple: <i>si lo puedes imaginar, lo podemos construir</i>.",
      henry: "Detrás de CDH Maker está el <b>Ing. Henry Taborda</b>, desde Medellín. Es quien diseña, programa y fabrica — y también con quien vas a hablar tú: aquí no hay call center ni intermediarios. Esa es justamente la ventaja de trabajar con un taller pequeño: hablas directo con quien construye tu proyecto.",
      equipo: "Somos un <b>equipo pequeño</b>, y eso es a propósito. Significa que hablas directamente con quien construye tu proyecto, que las decisiones se toman rápido y que no pagas la estructura de una agencia grande. Cuando un proyecto lo necesita, sumamos aliados de confianza para esa parte puntual.",
      experiencia: "La mejor respuesta son los proyectos: <b>PrivacyCheck</b> (cumplimiento de la Ley 1581 con IA), <b>IncubApp</b> (SaaS industrial multi-empresa), <b>TaxiYa</b> (central de taxis en tiempo real), <b>A Tiempo Logística</b> (última milla) y <b>EvaIA</b> (asistente de IA local). Varios están en producción y con demo en vivo — puedes entrar y probarlos ahora mismo, que es mejor que cualquier promesa.",
      proceso: "Trabajamos en <b>cuatro pasos</b>, siempre iguales:<br><b>1. Escucha</b> — entendemos qué necesitas, el contexto y a dónde quieres llegar.<br><b>2. Diseño</b> — propuesta técnica: bocetos, CAD o arquitectura del software, con precio y tiempos claros.<br><b>3. Construcción</b> — desarrollamos y fabricamos por etapas, mostrándote avances y ajustando con tu retroalimentación.<br><b>4. Entrega</b> — producto funcionando, documentación y acompañamiento posterior.",
      aliados: {
        a: "Trabajamos de la mano con <b>Galactic AIMA</b>, nuestro aliado. Cuando un proyecto pide una especialidad que no está en casa, preferimos sumar a alguien bueno antes que improvisar.",
        url: URL.aliado,
        cta: "Galactic AIMA →",
      },

      // ── Comercial ────────────────────────────────────────────────────────
      precio: [
        "Cada proyecto es distinto, así que no manejamos precios de catálogo: la <b>cotización es personalizada y gratis</b>. Henry revisa tu caso y te responde con precio y tiempos, normalmente <b>en menos de 24 horas</b>.",
        "Te soy honesto: depende del alcance. Por eso la <b>cotización es gratis y sin compromiso</b> — describes lo que necesitas y Henry te da un precio claro en menos de 24 horas.",
      ],
      price_cta: "Si me cuentas brevemente qué necesitas, te dejo el mensaje listo para enviar:",
      caro: "Te entiendo — el presupuesto siempre importa, y prefiero hablarlo de frente. Lo bueno es que trabajamos <b>por etapas</b>: arrancamos por lo esencial, lo pones a funcionar, y creces cuando el proyecto ya te esté dando resultados. La cotización es gratis, así que sabrás exactamente de qué hablamos antes de decidir nada.",
      tiempo: "Depende del proyecto: una pieza 3D o un corte láser puede estar <b>en días</b>; una página web sencilla, <b>en 1 a 2 semanas</b>; un sistema más grande se entrega <b>por etapas</b>, para que veas avances desde el inicio en vez de esperar meses a ciegas.",
      time_cta: "¿Te cotizo el tuyo? Es gratis:",
      pago: "El pago se acuerda <b>por etapas</b>: defines el alcance con Henry en la cotización y avanzas por hitos, viendo resultados antes de cada pago. Nada de pagar todo por adelantado y quedarte esperando. Los medios de pago (y la facturación, si tu empresa la necesita) se coordinan directamente con él según tu caso, dentro o fuera de Colombia.",
      garantia: "Toda entrega incluye pruebas, documentación y <b>acompañamiento posterior</b>: si algo no queda como esperabas, lo ajustamos. La idea es que el proyecto funcione, no solo entregarlo. Y si ya tienes algo nuestro que necesita mantenimiento o una mejora, escríbenos y lo revisamos.",
      materiales: "Trabajamos impresión 3D <b>FDM</b> (PLA, PETG, ABS, TPU flexible) y <b>resina</b> para piezas de mucho detalle; corte y grabado <b>láser</b> en MDF, acrílico, cartón y cuero; y <b>CNC</b> cuando la pieza necesita más resistencia o mejor acabado. El material ideal depende del uso: si va a estar al sol, si carga peso, si necesita flexibilidad o si lo que importa es la estética. Cuéntame para qué es la pieza y te oriento.",
      archivos: "Con lo que tengas nos arreglamos. Lo ideal es un archivo <b>STL o STEP</b> (3D) o <b>DXF/SVG</b> (láser y CNC). Pero si no tienes nada de eso, sirve perfectamente una <b>foto con las medidas anotadas</b>, un boceto a mano o incluso la pieza original para copiarla. Si hace falta, la diseñamos nosotros en CAD y te queda el archivo.",
      tecnologias: "En software: <b>JavaScript, Next.js, Python, Firebase y Supabase</b>, desplegando en la nube. En electrónica: <b>Arduino, ESP32 y Raspberry Pi</b>. En fabricación: <b>impresión 3D FDM y resina, láser y CNC</b>, con diseño <b>CAD 2D/3D</b>. Y usamos <b>IA</b> donde de verdad aporta, no por moda. Elegimos la herramienta según el problema, no al revés.",
      ia: "La IA nos gusta cuando resuelve algo concreto. Un par de ejemplos nuestros: <b>PrivacyCheck</b> analiza el cumplimiento de una empresa y genera un plan de acción con IA; <b>IncubApp</b> la usa para leer la operación de una planta y avisar antes de que algo se salga de control; y <b>EvaIA</b> es un asistente que corre <b>100% local</b>, sin mandar nada a la nube. Si tienes un proceso repetitivo o mucha información que nadie alcanza a leer, ahí suele haber una buena oportunidad.",

      // ── Ubicación y logística ────────────────────────────────────────────
      donde: "Estamos en <b>Medellín, Colombia</b> 🇨🇴, pero trabajamos con clientes de cualquier lugar: los proyectos de software se entregan en la nube y las piezas físicas se envían por mensajería.",
      envios: "Sí: el <b>software</b> se entrega en la nube, así que da igual dónde estés en el mundo. Las <b>piezas físicas</b> (3D, láser, CNC) las enviamos por mensajería a toda <b>Colombia</b>; si estás fuera del país, cuéntale a Henry a dónde va y él te dice si sale a cuenta el envío antes de que te comprometas a nada.",
      horario: "Con una cuenta de cliente puedes escribir <b>a cualquier hora</b> — Henry responde usualmente en menos de 24 horas, de lunes a sábado. Este chat, en cambio, está disponible 24/7. 😉",

      // ── Proyectos ────────────────────────────────────────────────────────
      portafolio: 'Con gusto. En la sección <a href="#proyectos">Proyectos</a> puedes ver trabajo real: <b>EvaIA</b> (asistente de IA local), <b>TaxiYa</b> (central de taxis), <b>IncubApp</b> (SaaS industrial), <b>A Tiempo Logística</b> (última milla) y <b>PrivacyCheck</b> (Ley 1581), varios con demo en vivo. ¿Alguno se parece a lo que necesitas?',
      privacycheck: {
        a: "<b>PrivacyCheck</b> es nuestra plataforma de autodiagnóstico de cumplimiento de la <b>Ley 1581</b> (protección de datos personales en Colombia): registras tu empresa, consultas el RNBD, respondes el cuestionario y obtienes <b>puntaje, brechas y un plan de acción generado con IA</b>. Está hecha en Next.js y corre en la nube. Puedes entrar y probarla gratis.",
        url: URL.privacycheck,
        cta: "Abrir PrivacyCheck →",
      },
      evaia: "<b>EvaIA</b> es un asistente de inteligencia artificial que corre <b>100% en local</b>, en tu propio equipo: entiende la voz, responde hablando, ve por la cámara, recuerda las conversaciones en una base de datos y tiene su propio avatar animado. Lo interesante es justamente eso: <b>ninguna conversación sale de tu computador</b>, no hay suscripción ni servidor de por medio.",
      taxiya: {
        a: "<b>TaxiYa</b> es una plataforma para que las empresas de taxis operen <b>sin llamadas ni planes de datos costosos</b>: tiene app de pasajero, app de conductor y panel de la central, con despacho en tiempo real. Es un producto propio de CDH Maker y tiene demo en vivo.",
        url: URL.taxiya,
        cta: "Ver TaxiYa →",
      },
      incubapp: {
        a: "<b>IncubApp</b> es un SaaS <b>multi-empresa</b> para plantas de incubación y granjas: rondas con foto, órdenes de trabajo, ventas, logística, sanidad y un tablero de gerencia en tiempo real, con IA que ayuda a leer la operación. Es de los proyectos más grandes que hemos construido.",
        url: URL.incubapp,
        cta: "Ver IncubApp →",
      },
      atiempo: {
        a: "<b>A Tiempo Logística</b> es una plataforma SaaS de <b>logística de última milla</b> para e-commerce en Medellín: rastreo de guías, gestión del CEDI, armado de rutas, recaudo contraentrega y trazabilidad punta a punta. Hecha con Next.js y Supabase.",
        url: URL.atiempo,
        cta: "Ver A Tiempo Logística →",
      },
      cavaltec: "El <b>Reto CAVALTEC</b> fue un desafío de autodiagnóstico de cumplimiento de la <b>Ley 1581</b> que trabajamos junto al equipo <b>Sintaxis TI</b>. De ahí salió una plataforma web donde una empresa mide qué tan bien protege los datos personales que maneja. Puedes verlo en la sección de proyectos de esta página.",

      // ── Cuenta y contacto ────────────────────────────────────────────────
      cuenta: "Te explico el porqué, que es justo: <b>no publicamos el número ni el correo</b> en la web. Eso nos evita el spam de bots y, de paso, nos deja saber con quién estamos hablando. Al crear tu cuenta (es gratis y toma menos de un minuto) se te abre el <b>contacto directo con Henry</b> por WhatsApp y correo. Nada de suscripciones ni pagos.",
      privacidad: "Buena pregunta, y merece respuesta clara. Tus datos se usan <b>solo</b> para que Henry te contacte y le haga seguimiento a tu proyecto: <b>no los vendemos, no los compartimos y no te vamos a llenar la bandeja de correos</b>. Las contraseñas se guardan cifradas (nunca en texto plano) y esta conversación que estamos teniendo <b>no sale de tu navegador</b>: no viaja a ningún servidor.",
      contacto: "Si ya tienes cuenta de cliente, te dejo el acceso directo a WhatsApp. Henry suele responder en menos de 24 horas.",
      contact_guest: "Para hablar con Henry o pedir una cotización, primero <b>crea tu cuenta de cliente</b> — es gratis y toma menos de un minuto. Así protegemos el contacto del spam y sabemos con quién hablamos: no publicamos número ni correo en la web.",
      humano: "¡Claro! Nada mejor que hablar con una persona. <b>Henry</b> te atiende directamente:",

      // ── Captura y salidas ────────────────────────────────────────────────
      ack: ["Entiendo.", "Perfecto, ya me hago la idea.", "Listo, te sigo.", "Vale, clarísimo."],
      captured: [
        "¡Suena muy bien! 🙌 Ya te preparé el mensaje con tu descripción — un clic y le llega directo a Henry para cotizártelo gratis:",
        "¡Eso se puede hacer! Te dejo el mensaje listo con lo que me contaste; envíalo y Henry te responde con precio y tiempos:",
        "Me gusta el proyecto. 👌 Te armé el mensaje con lo que me describiste, solo tienes que enviarlo:",
      ],
      ask_more: [
        "Cuéntame un poco más para orientarte bien: ¿para qué lo necesitas y para cuándo?",
        "¿Me das un par de detalles más? Con eso te digo por dónde conviene arrancar.",
      ],
      fallback: [
        "Esa no me la sé con precisión, y prefiero no inventarte una respuesta. Lo mejor es que se la hagas directo a Henry — o si me cuentas un poco más, te oriento hacia el servicio indicado:",
        "Buena pregunta. Para darte una respuesta exacta lo mejor es Henry; si me das un poco más de contexto, yo te ubico mientras tanto:",
      ],
      repeat: "Como te contaba hace un momento:",
    },
  };

  // ═════════════════════════ ENGLISH (complete) ════════════════════════════
  L.en = {
    ui: {
      sub: "CDH Maker advisor · online",
      placeholder: "Type your message…",
      open: "Open support chat",
      close: "Close chat",
      chat: "Chat with Maker, CDH Maker advisor",
      quick: "Quick replies",
      voice_on: "Turn on advisor voice",
      voice_off: "Mute advisor voice",
      voice_ready: "Great, you can hear me now. Tell me about your project.",
    },
    btn: {
      back: "See other services",
      menu: "See the services",
      quote: "Get a quote on WhatsApp",
      how_long: "How long does it take?",
      how_much: "How much does it cost?",
      open_wa: "Open WhatsApp",
      create_account: "Create a free account",
      send_project: "Send my project on WhatsApp",
      ask_direct: "Ask Henry",
      talk_henry: "Talk to Henry",
      more: "Tell me more",
      process: "How do you work?",
      projects: "See projects",
      visit: "Open the project",
    },
    wa: {
      generic: "Hi Henry, I come from your website. I have a question: ",
      quote: "Hi Henry, I come from your website and I'd like a quote: ",
      contact: "Hi Henry, I come from your website (registered client) and I'd like to talk to you.",
    },
    svc: {
      web: {
        name: "Web & software",
        pitch: "Good choice. A well-built site or system works for you 24/7. We build <b>websites, online stores and custom software</b> — this very page came out of our workshop, along with <b>PrivacyCheck</b>, <b>TaxiYa</b> and <b>IncubApp</b>.",
        hook: "What exactly do you need? A site for your business, a store, an internal system for your team…? Tell me in your own words and I'll point you the right way.",
        detail: "Specifically we build: <b>sites and landing pages</b> that load fast and rank on Google; <b>online stores</b> with payments and shipping; <b>custom web apps</b> (inventory, scheduling, routing, reporting); and <b>automation</b> of whatever is done by hand today in spreadsheets or WhatsApp. We work with Next.js, JavaScript, Python, Firebase and Supabase, and deploy to the cloud so you never manage a server.",
        wa: "Hi Henry, I come from your website. I'd like a quote for a web/software project: ",
      },
      maker: {
        name: "3D printing · Laser · CNC",
        pitch: "Love that territory. We turn ideas and drawings into <b>real parts</b>: 3D printing (FDM and resin), laser cutting and engraving, and CNC machining. From an impossible-to-find spare part to a product prototype.",
        hook: "What do you want to make? If you have a photo, the measurements or a file (STL, DXF, STEP), even better — describe it and we'll quote it.",
        detail: "With <b>FDM 3D printing</b> we make functional parts, spares and enclosures; with <b>resin</b>, high-detail pieces (miniatures, jewelry, dental models). The <b>laser</b> cuts and engraves MDF, acrylic, leather and cardboard: signage, souvenirs, panels, packaging. <b>CNC</b> is for parts that need more strength or a better finish. No file? We design it in CAD for you.",
        wa: "Hi Henry, I come from your website. I'd like a quote for digital fabrication (3D/laser/CNC): ",
      },
      iot: {
        name: "Electronics & IoT",
        pitch: "Great territory. We automate homes, farms and industry with <b>Arduino, ESP32 and Raspberry Pi</b>: sensors, phone monitoring, home automation and custom systems.",
        hook: "What would you like to automate or monitor? Temperature, irrigation, security, power usage, a machine…? Tell me the scenario.",
        detail: "We build complete <b>embedded systems</b>: we design the circuit, program the microcontroller and make the enclosure (printed right here). Typical jobs: soil-moisture irrigation, temperature control in greenhouses or incubators, door sensors and alarms, power metering, and dashboards to watch it all from your phone. When the project calls for it, we push the data to the cloud and put a web app on top.",
        wa: "Hi Henry, I come from your website. I'd like a quote for an electronics/IoT project: ",
      },
      consultoria: {
        name: "Design & consulting",
        pitch: "Of course. We offer <b>2D/3D CAD design, technical consulting and workshops</b>. If you have an idea but don't know where to start, we'll walk with you from the first sketch.",
        hook: "Are you after a part design, advice on your project, or training for your team? Tell me a bit more.",
        detail: "In <b>CAD design</b> we start from a sketch, a photo or a physical part and hand you a model ready to manufacture. In <b>consulting</b> we review your idea and tell you honestly what's feasible, what it costs and where to start — sometimes the best advice is to build less. And in <b>training</b> we run maker workshops: 3D printing, electronics and programming, for schools, companies and groups.",
        wa: "Hi Henry, I come from your website. I'm interested in CAD design / consulting / training: ",
      },
    },
    t: {
      greeting: [
        "I'm <b>Maker</b>, the CDH Maker advisor. Tell me — an idea, a project, or just browsing?",
        "I'm <b>Maker</b>. We build all sorts of things here: software, 3D parts, electronics… What's on your mind?",
        "I'm <b>Maker</b>, from the CDH Maker team. If you have an idea rattling around, this is the place to land it. How can I help?",
      ],
      re_greeting: ["Hello again! 😄 How can I help?", "Still here! What else would you like to know?", "Hey! Shall we pick up where we left off, or something new?"],
      good_morning: "Good morning! ☀️",
      good_afternoon: "Good afternoon!",
      good_evening: "Good evening! 🌙",
      comoestas: [
        "Doing great, thanks for asking! 😊 Ready to help you land an idea. How about you?",
        "Excellent — I never get tired of talking about projects. 😄 Tell me about yours.",
      ],
      bot: "Fair question, and I'll be straight with you: I'm a <b>virtual assistant</b> for CDH Maker, not a person. What is real is everything I tell you — the services, projects and timelines are the actual ones. And whenever you want to talk to <b>Henry</b>, who is very much flesh and blood, I'll hand you over in one click.",
      thanks: ["My pleasure! 😊 Anything else I can help with?", "Anytime! Want to see anything else?", "You're welcome! I'm here if anything else comes up."],
      bye: ["Take care! I'll be here whenever you want to pick your project back up. 👋", "Thanks for stopping by! When the idea is ready, you know where to find us. 👋"],
      yes: "Great! Tell me a bit more or pick an option:",
      no_worries: "No problem. Feel free to explore the services or ask me anything:",
      ayuda: "Here's what I know: I can walk you through our <b>four service lines</b> (web & software, digital fabrication, electronics & IoT, design & consulting), tell you about the <b>projects</b> we've built, answer questions on <b>pricing, timelines, payment, warranty or materials</b>, and prepare the message so Henry can quote you. Just ask in your own words — I'll follow.",
      queja: "I'm sorry you had a bad experience, and I want it sorted out. The best move is to tell <b>Henry directly</b>: he answers complaints personally and doesn't delegate them. Write to him and tell him what happened.",
      trabajo: "Glad you asked! CDH Maker is a small team and we don't have open positions posted, but we're always open to <b>working with good people</b> — developers, designers, makers. Write to Henry and tell him what you do and what you'd like to build.",

      quien: "We are <b>CDH Maker</b>, working out of <b>Medellín, Colombia</b> 🇨🇴 turning ideas into real solutions. We cover four fronts: <b>software development</b>, <b>digital fabrication</b> (3D, laser, CNC), <b>electronics & IoT</b> and <b>design & technical consulting</b>. <b>EvaIA</b>, <b>TaxiYa</b>, <b>IncubApp</b>, <b>A Tiempo Logística</b> and <b>PrivacyCheck</b> all came out of here. The philosophy is simple: <i>if you can imagine it, we can build it</i>.",
      henry: "Behind CDH Maker is <b>Henry Taborda</b>, an engineer based in Medellín. He designs, codes and builds — and he's also the person you'll be talking to: no call center, no middlemen. That's exactly the advantage of a small workshop: you talk directly to whoever builds your project.",
      equipo: "We're a <b>small team</b>, and that's deliberate. It means you talk directly to whoever builds your project, decisions happen fast, and you don't pay for a big agency's overhead. When a project needs it, we bring in trusted partners for that specific piece.",
      experiencia: "The projects answer that best: <b>PrivacyCheck</b> (Colombian data-protection compliance with AI), <b>IncubApp</b> (multi-tenant industrial SaaS), <b>TaxiYa</b> (real-time taxi dispatch), <b>A Tiempo Logística</b> (last-mile delivery) and <b>EvaIA</b> (local AI assistant). Several are in production with live demos — you can go try them right now, which beats any promise I could make.",
      proceso: "We work in <b>four steps</b>, always the same:<br><b>1. Listen</b> — we understand what you need, the context and where you want to get to.<br><b>2. Design</b> — a technical proposal: sketches, CAD or software architecture, with clear price and timing.<br><b>3. Build</b> — we develop and manufacture in stages, showing you progress and adjusting with your feedback.<br><b>4. Deliver</b> — a working product, documentation and follow-up support.",
      aliados: {
        a: "We work alongside <b>Galactic AIMA</b>, our partner. When a project calls for a specialty we don't have in house, we'd rather bring in someone good than improvise.",
        url: URL.aliado,
        cta: "Galactic AIMA →",
      },

      precio: [
        "Every project is different, so there's no price list: <b>the quote is personalized and free</b>. Henry reviews your case and replies with price and timing, usually <b>within 24 hours</b>.",
        "I'll be honest: it depends on scope. That's why <b>the quote is free and no-obligation</b> — you describe what you need and Henry gives you a clear price within 24 hours.",
      ],
      price_cta: "Tell me briefly what you need and I'll have the message ready to send:",
      caro: "I hear you — budget always matters, and I'd rather discuss it openly. The good news is we work <b>in stages</b>: we start with the essentials, you put it to work, and you grow once the project is already paying off. The quote is free, so you'll know exactly what we're talking about before deciding anything.",
      tiempo: "It depends on the project: a 3D part or a laser cut can be ready <b>in days</b>; a simple website, <b>in 1–2 weeks</b>; a larger system is delivered <b>in stages</b>, so you see progress from the start instead of waiting months in the dark.",
      time_cta: "Want a quote for yours? It's free:",
      pago: "Payment is agreed <b>in stages</b>: you set the scope with Henry in the quote and move by milestones, seeing results before each payment. No paying everything up front and waiting. Payment methods (and invoicing, if your company needs it) are coordinated directly with him, inside or outside Colombia.",
      garantia: "Every delivery includes testing, documentation and <b>follow-up support</b>: if something isn't as expected, we adjust it. The point is that the project works, not just that it ships. And if you already have something of ours that needs maintenance or an upgrade, write to us and we'll look at it.",
      materiales: "We work <b>FDM</b> 3D printing (PLA, PETG, ABS, flexible TPU) and <b>resin</b> for high-detail parts; <b>laser</b> cutting and engraving on MDF, acrylic, cardboard and leather; and <b>CNC</b> when a part needs more strength or a better finish. The right material depends on use: whether it sits in the sun, carries weight, needs flex, or is purely about looks. Tell me what the part is for and I'll guide you.",
      archivos: "We can work with whatever you have. Ideally an <b>STL or STEP</b> file (3D) or <b>DXF/SVG</b> (laser and CNC). But if you have none of that, a <b>photo with the measurements noted on it</b> works perfectly, as does a hand sketch or even the original part to copy. If needed, we design it in CAD and the file is yours to keep.",
      tecnologias: "On software: <b>JavaScript, Next.js, Python, Firebase and Supabase</b>, deployed to the cloud. On electronics: <b>Arduino, ESP32 and Raspberry Pi</b>. On fabrication: <b>FDM and resin 3D printing, laser and CNC</b>, with <b>2D/3D CAD</b> design. And we use <b>AI</b> where it genuinely helps, not because it's fashionable. We pick the tool to fit the problem, not the other way around.",
      ia: "We like AI when it solves something concrete. A couple of our own examples: <b>PrivacyCheck</b> analyses a company's compliance and generates an action plan with AI; <b>IncubApp</b> uses it to read a plant's operation and warn before things drift; and <b>EvaIA</b> is an assistant that runs <b>100% locally</b>, sending nothing to the cloud. If you have a repetitive process, or more information than anyone can read, there's usually a good opportunity there.",

      donde: "We're in <b>Medellín, Colombia</b> 🇨🇴, but we work with clients anywhere: software projects are delivered in the cloud and physical parts ship by courier.",
      envios: "Yes: <b>software</b> is delivered in the cloud, so it makes no difference where in the world you are. <b>Physical parts</b> (3D, laser, CNC) ship by courier anywhere in <b>Colombia</b>; if you're outside the country, tell Henry where it's going and he'll tell you whether shipping is worth it before you commit to anything.",
      horario: "With a client account you can write <b>at any hour</b> — Henry usually replies within 24 hours, Monday to Saturday. This chat, on the other hand, is available 24/7. 😉",

      portafolio: 'Gladly. In the <a href="#proyectos">Projects</a> section you can see real work: <b>EvaIA</b> (local AI assistant), <b>TaxiYa</b> (taxi dispatch), <b>IncubApp</b> (industrial SaaS), <b>A Tiempo Logística</b> (last mile) and <b>PrivacyCheck</b> (data protection), several with live demos. Does any of them look like what you need?',
      privacycheck: {
        a: "<b>PrivacyCheck</b> is our self-assessment platform for compliance with <b>Ley 1581</b>, Colombia's personal-data protection law: you register your company, query the national database registry, answer the questionnaire and get a <b>score, the gaps and an AI-generated action plan</b>. Built with Next.js, running in the cloud. You can go try it for free.",
        url: URL.privacycheck,
        cta: "Open PrivacyCheck →",
      },
      evaia: "<b>EvaIA</b> is an AI assistant that runs <b>100% locally</b>, on your own machine: it understands speech, answers out loud, sees through the camera, remembers conversations in a database and has its own animated avatar. That's exactly the interesting part — <b>no conversation ever leaves your computer</b>, no subscription and no server in the middle.",
      taxiya: {
        a: "<b>TaxiYa</b> is a platform that lets taxi companies operate <b>without phone calls or expensive data plans</b>: a passenger app, a driver app and a dispatch panel, with real-time dispatching. It's a CDH Maker product and has a live demo.",
        url: URL.taxiya,
        cta: "See TaxiYa →",
      },
      incubapp: {
        a: "<b>IncubApp</b> is a <b>multi-tenant</b> SaaS for hatcheries and farms: photo-logged rounds, work orders, sales, logistics, health tracking and a real-time management dashboard, with AI helping read the operation. It's one of the largest projects we've built.",
        url: URL.incubapp,
        cta: "See IncubApp →",
      },
      atiempo: {
        a: "<b>A Tiempo Logística</b> is a SaaS platform for <b>last-mile logistics</b> serving e-commerce in Medellín: shipment tracking, warehouse management, route building, cash-on-delivery collection and end-to-end traceability. Built with Next.js and Supabase.",
        url: URL.atiempo,
        cta: "See A Tiempo Logística →",
      },
      cavaltec: "The <b>CAVALTEC challenge</b> was a data-protection self-assessment challenge we worked on with the <b>Sintaxis TI</b> team. It produced a web platform where a company measures how well it protects the personal data it handles, under Colombia's Ley 1581. You can see it in the projects section of this page.",

      cuenta: "Let me explain why, because it's only fair: <b>we don't publish the phone number or email</b> on the site. That keeps the bots and spam away and, as a side effect, lets us know who we're talking to. Creating your account (free, under a minute) opens <b>direct contact with Henry</b> by WhatsApp and email. No subscriptions, no payments.",
      privacidad: "Good question, and it deserves a clear answer. Your data is used <b>only</b> so Henry can contact you and follow up on your project: <b>we don't sell it, don't share it and won't flood your inbox</b>. Passwords are stored hashed, never in plain text — and this very conversation <b>never leaves your browser</b>: it isn't sent to any server.",
      contacto: "If you already have a client account, here's direct WhatsApp access. Henry usually replies within 24 hours.",
      contact_guest: "To talk to Henry or ask for a quote, first <b>create your client account</b> — it's free and takes under a minute. That keeps our contact details away from spam and lets us know who we're talking to: we don't publish the phone or email on the site.",
      humano: "Of course! Nothing beats talking to a person. <b>Henry</b> will help you directly:",

      ack: ["Got it.", "Perfect, I see the picture.", "Right, I'm with you.", "Understood."],
      captured: [
        "Sounds great! 🙌 I've prepared the message with your description — one click and it goes straight to Henry for a free quote:",
        "That's doable! Here's the message ready with what you told me; send it and Henry will reply with price and timing:",
        "I like this project. 👌 I've put together the message from your description — you just need to send it:",
      ],
      ask_more: [
        "Tell me a little more so I can point you well: what's it for, and by when do you need it?",
        "Could you give me a couple more details? With that I can tell you where to start.",
      ],
      fallback: [
        "I don't know that one precisely, and I'd rather not invent an answer. Best to ask Henry directly — or tell me a bit more and I'll point you to the right service:",
        "Good question. For an exact answer Henry is your best bet; give me a bit more context and I'll place you in the meantime:",
      ],
      repeat: "As I was saying a moment ago:",
    },
  };

  // ═════════════════════════ PORTUGUÊS ════════════════════════════
  L.pt = {
    ui: { sub: "Consultor CDH Maker · online", placeholder: "Digite sua mensagem…", open: "Abrir chat de suporte", close: "Fechar chat", chat: "Conversa com Maker, consultor CDH Maker", quick: "Respostas rápidas", voice_on: "Ativar voz", voice_off: "Silenciar voz", voice_ready: "Pronto, você já pode me ouvir." },
    btn: { back: "Ver outros serviços", menu: "Ver os serviços", quote: "Solicitar orçamento no WhatsApp", how_long: "Quanto tempo demora?", how_much: "Quanto custa?", open_wa: "Abrir WhatsApp", create_account: "Criar conta gratuita", send_project: "Enviar meu projeto pelo WhatsApp", ask_direct: "Perguntar ao Henry", talk_henry: "Falar com Henry", more: "Conte-me mais", process: "Como trabalham?", projects: "Ver projetos", visit: "Abrir projeto" },
    wa: { generic: "Olá Henry, venho do seu site. Tenho uma dúvida: ", quote: "Olá Henry, venho do seu site e gostaria de um orçamento: ", contact: "Olá Henry, venho do seu site (cliente registrado) e gostaria de falar com você." },
    svc: {
      web: { name: "Web & Software", pitch: "Ótima escolha. Um site ou sistema bem feito trabalha para você 24 horas por dia. Criamos <b>sites, lojas virtuais e software sob medida</b>.", hook: "O que você precisa exatamente? Um site, loja ou sistema interno?", wa: "Olá Henry, quero cotar um projeto de desenvolvimento web/software: " },
      maker: { name: "Impressão 3D · Laser · CNC", pitch: "Transformamos ideias e projetos em <b>peças reais</b>: impressão 3D (FDM e resina), corte a laser e usinagem CNC.", hook: "O que você quer fabricar? Se tiver fotos ou arquivos (STL, DXF, STEP), descreva para cotarmos.", wa: "Olá Henry, quero cotar fabricação digital (3D/laser/CNC): " },
      iot: { name: "Eletrônica & IoT", pitch: "Automatizamos casas, lavouras e indústrias com <b>Arduino, ESP32 e Raspberry Pi</b>: sensores e sistemas sob medida.", hook: "O que gostaria de automatizar ou monitorar?", wa: "Olá Henry, quero cotar um projeto de eletrônica/IoT: " },
      consultoria: { name: "Design & Consultoria", pitch: "Oferecemos <b>design CAD 2D/3D, consultoria técnica e workshops</b>.", hook: "Procura design de peças, consultoria ou treinamento?", wa: "Olá Henry, tenho interesse em design CAD / consultoria: " }
    },
    t: {
      greeting: ["Sou o <b>Maker</b>, o consultor da <b>CDH Maker</b>. Como posso ajudar com seu projeto?"], re_greeting: ["Olá novamente! 😄 Como posso ajudar?"], good_morning: "Bom dia! ☀️", good_afternoon: "Boa tarde!", good_evening: "Boa noite! 🌙", comoestas: ["Muito bem, obrigado por perguntar! 😊 Pronto para te ajudar."], bot: "Sou o <b>assistente virtual</b> da CDH Maker. As informações são reais e você pode falar com o <b>Henry</b> a qualquer momento.", thanks: ["Com prazer! 😊 Algo mais?"], bye: ["Até logo! 👋"], yes: "Perfeito! Conte-me mais:", no_worries: "Sem problemas, explore nossos serviços:", quien: "Somos a <b>CDH Maker</b>, trabalhando de Medellín, Colômbia 🇨🇴 criando software, peças 3D e IoT.", henry: "Por trás da CDH Maker está o <b>Eng. Henry Taborda</b>, que projeta, programa e fabrica.", precio: ["O <b>orçamento é personalizado e gratuito</b> em menos de 24 horas."], price_cta: "Conte-me o que precisa e deixo a mensagem pronta:", tiempo: "Peças 3D em <b>dias</b>; sites em <b>1 a 2 semanas</b>.", time_cta: "Quer um orçamento grátis?", pago: "Pagamento <b>por etapas</b> segundo o progresso.", garantia: "Toda entrega inclui testes e suporte pós-venda.", materiales: "Impressão 3D FDM/resina, laser (MDF, acrílico) e CNC.", horario: "Com uma conta de cliente pode escrever a qualquer hora.", contacto: "Acesso direto ao WhatsApp do Henry para clientes cadastrados.", contact_guest: "Para falar com Henry, crie sua <b>conta de cliente gratuita</b>.", humano: "O <b>Henry</b> vai te atender diretamente:", captured: ["Deixei a mensagem pronta para você enviar ao Henry:"], fallback: ["Para uma resposta exata, pergunte diretamente ao Henry:"]
    }
  };

  // ═════════════════════════ FRANÇAIS ════════════════════════════
  L.fr = {
    ui: { sub: "Conseiller CDH Maker · en ligne", placeholder: "Écrivez votre message…", open: "Ouvrir le chat de support", close: "Fermer le chat", chat: "Discussion avec Maker", quick: "Réponses rapides", voice_on: "Activer la voix", voice_off: "Couper le son", voice_ready: "C'est bon, vous pouvez m'entendre." },
    btn: { back: "Voir les autres services", menu: "Voir les services", quote: "Demander un devis sur WhatsApp", how_long: "Combien de temps ça prend ?", how_much: "Combien ça coûte ?", open_wa: "Ouvrir WhatsApp", create_account: "Créer un compte gratuit", send_project: "Envoyer mon projet", ask_direct: "Demander à Henry", talk_henry: "Parler avec Henry", more: "En savoir plus", process: "Processus", projects: "Voir les projets", visit: "Ouvrir le projet" },
    wa: { generic: "Bonjour Henry, j'ai une question : ", quote: "Bonjour Henry, je souhaite un devis : ", contact: "Bonjour Henry, je suis client inscrit et souhaite vous parler." },
    svc: {
      web: { name: "Web & Logiciel", pitch: "Nous créons des <b>sites web, boutiques en ligne et logiciels sur mesure</b>.", hook: "De quoi avez-vous besoin exactement ?", wa: "Bonjour Henry, je souhaite un devis web/logiciel : " },
      maker: { name: "Impression 3D · Laser · CNC", pitch: "Nous transformons vos idées en <b>pièces réelles</b> : impression 3D, découpe laser et CNC.", hook: "Que souhaitez-vous fabriquer ?", wa: "Bonjour Henry, je souhaite un devis 3D/laser/CNC : " },
      iot: { name: "Électronique & IoT", pitch: "Nous automatisons avec <b>Arduino, ESP32 et Raspberry Pi</b>.", hook: "Que souhaitez-vous automatiser ?", wa: "Bonjour Henry, je souhaite un devis IoT : " },
      consultoria: { name: "Design & Conseil", pitch: "Nous proposons du <b>design CAD 2D/3D et du conseil technique</b>.", hook: "Recherchez-vous la conception d'une pièce ou du conseil ?", wa: "Bonjour Henry, je suis intéressé par du design CAD / conseil : " }
    },
    t: {
      greeting: ["Je suis <b>Maker</b>, le conseiller de <b>CDH Maker</b>. Parlez-moi de votre projet !"], re_greeting: ["Re-bonjour ! 😄 Comment puis-je vous aider ?"], good_morning: "Bonjour ! ☀️", good_afternoon: "Bon après-midi !", good_evening: "Bonsoir ! 🌙", comoestas: ["Très bien, merci ! 😊 Prêt à vous aider."], bot: "Je suis l'<b>assistant virtuel</b> de CDH Maker. Vous pouvez contacter <b>Henry</b> directement à tout moment.", thanks: ["Avec plaisir ! 😊"], bye: ["Au revoir ! 👋"], yes: "Parfait ! Dites-m'en plus :", no_worries: "Découvrez nos services :", quien: "Nous sommes <b>CDH Maker</b> (Medellín, Colombie 🇨🇴) : logiciels, fabrication numérique et IoT.", henry: "Derrière CDH Maker se trouve l'ingénieur <b>Henry Taborda</b>.", precio: ["Le <b>devis est personnalisé et gratuit</b> sous 24h."], price_cta: "Décrivez votre projet :", tiempo: "Pièces 3D en <b>quelques jours</b>, sites web en <b>1 à 2 semaines</b>.", time_cta: "Un devis gratuit ?", pago: "Paiement <b>par étapes</b>.", garantia: "Tests, documentation et suivi inclus.", materiales: "Impression 3D FDM/résine, découpe laser et CNC.", horario: "Écrivez à tout moment avec votre compte client.", contacto: "Accès WhatsApp direct pour les clients inscrits.", contact_guest: "Créez votre <b>compte client gratuit</b> pour contacter Henry.", humano: "<b>Henry</b> vous répondra directement :", captured: ["Voici votre message prêt pour Henry :"], fallback: ["Pour une réponse exacte, demandez à Henry :"]
    }
  };

  // ═════════════════════════ RUSSIAN ════════════════════════════
  L.ru = {
    ui: { sub: "Консультант CDH Maker · онлайн", placeholder: "Введите сообщение…", open: "Открыть чат", close: "Закрыть чат", chat: "Чат с Maker", quick: "Быстрые ответы", voice_on: "Включить голос", voice_off: "Выключить звук", voice_ready: "Отлично, теперь вы меня слышите." },
    btn: { back: "Другие услуги", menu: "Посмотреть услуги", quote: "Расчет в WhatsApp", how_long: "Сколько времени?", how_much: "Сколько стоит?", open_wa: "Открыть WhatsApp", create_account: "Создать аккаунт", send_project: "Отправить проект", ask_direct: "Спросить Генри", talk_henry: "Связаться с Генри", more: "Подробнее", process: "Как работаете?", projects: "Проекты", visit: "Открыть" },
    wa: { generic: "Здравствуйте, Генри! У меня вопрос: ", quote: "Здравствуйте, Генри! Хочу получить расчет: ", contact: "Здравствуйте, Генри! Я зарегистрированный клиент." },
    svc: {
      web: { name: "Веб и ПО", pitch: "Мы создаем <b>сайты, интернет-магазины и индивидуальное ПО</b>.", hook: "Что именно вам нужно?", wa: "Здравствуйте! Хочу рассчитать веб-проект: " },
      maker: { name: "3D-печать · Лазер · ЧПУ", pitch: "Превращаем идеи в <b>готовые детали</b>: 3D-печать, лазерная резка и ЧПУ.", hook: "Что вы хотите изготовить?", wa: "Здравствуйте! Хочу рассчитать 3D-печать/лазер/ЧПУ: " },
      iot: { name: "Электроника и IoT", pitch: "Автоматизируем процессы с <b>Arduino, ESP32 и Raspberry Pi</b>.", hook: "Что вы хотите автоматизировать?", wa: "Здравствуйте! Хочу рассчитать проект по IoT: " },
      consultoria: { name: "Дизайн и Консалтинг", pitch: "Предлагаем <b>2D/3D CAD проектирование и консультации</b>.", hook: "Вам нужно спроектировать деталь или нужна консультация?", wa: "Здравствуйте! Меня интересует CAD-дизайн: " }
    },
    t: {
      greeting: ["Я <b>Maker</b>, консультант <b>CDH Maker</b>. Расскажите о вашей идее!"], re_greeting: ["Здравствуйте снова! Чем могу помочь?"], good_morning: "Доброе утро! ☀️", good_afternoon: "Добрый день!", good_evening: "Добрый вечер! 🌙", comoestas: ["Отлично, готов помочь!"], bot: "Я <b>виртуальный ассистент</b>. Вы можете написат лично <b>Генри</b>.", thanks: ["С удовольствием! 😊"], bye: ["До свидания! 👋"], yes: "Отлично! Расскажите подробнее:", no_worries: "Изучайте наши услуги:", quien: "Мы <b>CDH Maker</b> из Колумбии 🇨🇴: ПО, 3D-печать и IoT.", henry: "Основатель — инженер <b>Генри Таборда</b>.", precio: ["Расчет <b>индивидуальный и бесплатный</b> за 24 часа."], price_cta: "Опишите проект:", tiempo: "3D-детали за <b>несколько дней</b>, сайты за <b>1-2 недели</b>.", time_cta: "Рассчитать бесплатно?", pago: "Оплата <b>поэтапно</b>.", garantia: "Тестирование, документация и поддержка.", materiales: "FDM/смола, лазер (МДФ, акрил) и ЧПУ.", horario: "Пишите в любое время с аккаунтом клиента.", contacto: "Прямой доступ в WhatsApp для клиентов.", contact_guest: "Создайте <b>бесплатный аккаунт</b> для связи с Генри.", humano: "<b>Генри</b> ответит вам лично:", captured: ["Сообщение для Генри готово:"], fallback: ["Лучше спросить напрямую у Генри:"]
    }
  };

  // ═════════════════════════ CHINESE ════════════════════════════
  L.zh = {
    ui: { sub: "CDH Maker 在线顾问", placeholder: "输入您的消息…", open: "打开客服聊天", close: "关闭聊天", chat: "与 Maker 聊天", quick: "快速回复", voice_on: "开启语音", voice_off: "静音", voice_ready: "好的，现在您可以听到我的声音了。" },
    btn: { back: "查看其他服务", menu: "查看所有服务", quote: "通过 WhatsApp 获取报价", how_long: "需要多长时间？", how_much: "需要多少费用？", open_wa: "打开 WhatsApp", create_account: "免费注册账号", send_project: "发送项目需求", ask_direct: "直接咨询 Henry", talk_henry: "与 Henry 交谈", more: "了解更多", process: "合作流程", projects: "查看案例", visit: "打开项目" },
    wa: { generic: "你好 Henry，我想咨询一个问题：", quote: "你好 Henry，希望获取项目报价：", contact: "你好 Henry，我是已注册客户，希望与你联系。" },
    svc: {
      web: { name: "网页与软件开发", pitch: "我们开发<b>网站、在线商城及定制化软件</b>。", hook: "您具体需要哪种类型的软件/网站？", wa: "你好 Henry，我想咨询网页/软件开发报价：" },
      maker: { name: "3D打印 · 激光切割 · CNC", pitch: "我们将您的想法转化为<b>实体零件</b>：3D打印、激光切割与CNC加工。", hook: "您想制作什么零件？", wa: "你好 Henry，我想咨询 3D打印/激光/CNC 报价：" },
      iot: { name: "电子工程与物联网", pitch: "基于 <b>Arduino、ESP32 和 Raspberry Pi</b> 的智能控制系统。", hook: "您希望实现什么自动化功能？", wa: "你好 Henry，我想咨询物联网项目报价：" },
      consultoria: { name: "CAD设计与技术咨询", pitch: "提供 <b>2D/3D CAD建模设计与技术咨询</b>。", hook: "您需要建模设计还是技术评估？", wa: "你好 Henry，我对 CAD设计/咨询 感兴趣：" }
    },
    t: {
      greeting: ["我是 <b>CDH Maker</b> 顾问 <b>Maker</b>。请问您有什么项目想法？"], re_greeting: ["您好！😄 有什么我可以帮您的？"], good_morning: "早上好！☀️", good_afternoon: "下午好！", good_evening: "晚上好！🌙", comoestas: ["我很好，随时为您服务！"], bot: "我是<b>虚拟助手</b>。您可以随时联系创始人 <b>Henry</b>。", thanks: ["不客气！😊"], bye: ["再见！👋"], yes: "太棒了！请告诉我更多细节：", no_worries: "欢迎浏览我们的服务：", quien: "我们是来自哥伦比亚麦德林的 <b>CDH Maker</b> 🇨🇴。", henry: "创始人是工程师 <b>Henry Taborda</b>。", precio: ["<b>项目报价完全免费</b>，24小时内答复。"], price_cta: "告诉我您的需求：", tiempo: "3D打印仅需<b>数天</b>，基础网站约 <b>1-2 周</b>。", time_cta: "评估工期（免费）：", pago: "按阶段与里程碑付款。", garantia: "包含测试、文档与售后支持。", materiales: "FDM/树脂3D打印、亚克力/木板激光切割及CNC。", horario: "注册客户可随时留言。", contacto: "已注册客户可直接在 WhatsApp 联系 Henry。", contact_guest: "请先<b>免费注册客户账号</b>。", humano: "<b>Henry</b> 将直接为您服务：", captured: ["已为您准备好发给 Henry 的消息："], fallback: ["建议直接咨询 Henry："]
    }
  };

  // ═════════════════════════ HINDI ════════════════════════════
  L.hi = {
    ui: { sub: "CDH Maker सलाहकार · ऑनलाइन", placeholder: "अपना संदेश लिखें…", open: "चैट खोलें", close: "चैट बंद करें", chat: "Maker के साथ चैट", quick: "त्वरित उत्तर", voice_on: "आवाज चालू करें", voice_off: "म्यूट करें", voice_ready: "अब आप मुझे सुन सकते हैं।" },
    btn: { back: "अन्य सेवाएं", menu: "सेवाएं देखें", quote: "WhatsApp पर कोटेशन पाएं", how_long: "कितना समय लगेगा?", how_much: "कितना खर्च आएगा?", open_wa: "WhatsApp खोलें", create_account: "मुफ्त खाता बनाएं", send_project: "प्रोजेक्ट भेजें", ask_direct: "Henry से पूछें", talk_henry: "Henry से बात करें", more: "और जानें", process: "प्रक्रिया", projects: "प्रोजेक्ट देखें", visit: "खोलें" },
    wa: { generic: "नमस्ते Henry, मेरा एक सवाल है: ", quote: "नमस्ते Henry, मुझे कोटेशन चाहिए: ", contact: "नमस्ते Henry, मैं एक पंजीकृत ग्राहक हूं।" },
    svc: {
      web: { name: "वेब और सॉफ्टवेयर", pitch: "हम <b>वेबसाइटें, ऑनलाइन स्टोर और कस्टम सॉफ्टवेयर</b> बनाते हैं।", hook: "आपको वास्तव में क्या चाहिए?", wa: "नमस्ते Henry, मुझे वेब/सॉफ्टवेयर प्रोजेक्ट का कोटेशन चाहिए: " },
      maker: { name: "3D प्रिंटिंग · लेजर · CNC", pitch: "हम विचारों को <b>असली पुर्जों</b> में बदलते हैं: 3D प्रिंटिंग, लेजर कटिंग और CNC।", hook: "आप क्या बनाना चाहते हैं?", wa: "नमस्ते Henry, मुझे 3D/लेजर/CNC का कोटेशन चाहिए: " },
      iot: { name: "इलेक्ट्रॉनिक्स और IoT", pitch: "हम <b>Arduino, ESP32 और Raspberry Pi</b> के साथ स्वचालन करते हैं।", hook: "आप क्या ऑटोमेट करना चाहते हैं?", wa: "नमस्ते Henry, मुझे IoT प्रोजेक्ट का कोटेशन चाहिए: " },
      consultoria: { name: "डिज़ाइन और परामर्श", pitch: "हम <b>2D/3D CAD डिज़ाइन और परामर्श</b> प्रदान करते हैं।", hook: "क्या आपको पुर्जे का डिज़ाइन चाहिए?", wa: "नमस्ते Henry, मुझे CAD डिज़ाइन/परामर्श में रुचि है: " }
    },
    t: {
      greeting: ["मैं <b>Maker</b> हूँ, <b>CDH Maker</b> का सलाहकार। आपका क्या विचार है?"], re_greeting: ["नमस्ते! 😄 मैं आपकी क्या मदद कर सकता हूँ?"], good_morning: "शुभ प्रभात! ☀️", good_afternoon: "शुभ दोपहर!", good_evening: "शुभ संध्या! 🌙", comoestas: ["मैं ठीक हूँ, धन्यवाद!"], bot: "मैं एक <b>वर्चुअल असिस्टेंट</b> हूँ। आप <b>Henry</b> से सीधे बात कर सकते हैं।", thanks: ["सहर्ष! 😊"], bye: ["अलविदा! 👋"], yes: "बहुत बढ़िया! विवरण बताएं:", no_worries: "हमारी सेवाएं देखें:", quien: "हम <b>CDH Maker</b> (कोलंबिया 🇨🇴) हैं: सॉफ्टवेयर, 3D प्रिंटिंग और IoT।", henry: "संस्थापक इंजीनियर <b>Henry Taborda</b> हैं।", precio: ["<b>कोटेशन पूरी तरह मुफ्त है</b> (24 घंटे के भीतर)।"], price_cta: "अपनी ज़रूरत बताएं:", tiempo: "3D पुर्जे <b>कुछ दिनों में</b>, वेबसाइट <b>1-2 हफ्तों में</b>।", time_cta: "मुफ्त कोटेशन चाहिए?", pago: "चरणों में भुगतान।", garantia: "परीक्षण, दस्तावेज और सहायता शामिल।", materiales: "FDM/रेजिन 3D प्रिंटिंग, लेजर और CNC।", horario: "ग्राहक खाते से कभी भी लिखें।", contacto: "पंजीकृत ग्राहकों के लिए सीधा WhatsApp संपर्क।", contact_guest: "Henry से बात करने के लिए <b>मुफ्त खाता बनाएं</b>।", humano: "<b>Henry</b> आपकी व्यक्तिगत रूप से मदद करेंगे:", captured: ["Henry के लिए संदेश तैयार है:"], fallback: ["सटीक उत्तर के लिए सीधे Henry से पूछें:"]
    }
  };

  // ═════════════════════════ ARABIC ════════════════════════════
  L.ar = {
    ui: { sub: "مستشار CDH Maker · متصل", placeholder: "اكتب رسالتك…", open: "فتح المحادثة", close: "إغلاق المحادثة", chat: "محادثة مع Maker", quick: "ردود سريعة", voice_on: "تفعيل الصوت", voice_off: "كتم الصوت", voice_ready: "رائع، يمكنك سماعي الآن." },
    btn: { back: "خدمات أخرى", menu: "عرض الخدمات", quote: "طلب عرض سعر عبر WhatsApp", how_long: "كم يستغرق من الوقت؟", how_much: "كم التكلفة؟", open_wa: "فتح WhatsApp", create_account: "إنشاء حساب مجاني", send_project: "إرسال مشروعي", ask_direct: "سؤال هنري", talk_henry: "التحدث مع هنري", more: "معرفة المزيد", process: "طريقة العمل", projects: "عرض المشاريع", visit: "فتح" },
    wa: { generic: "مرحباً هنري، لدي استفسار: ", quote: "مرحباً هنري، أرغب في الحصول على عرض سعر: ", contact: "مرحباً هنري، أنا عميل مسجل وأود التحدث معك." },
    svc: {
      web: { name: "الويب والبرمجيات", pitch: "نقوم بإنشاء <b>مواقع إلكترونية ومتاجر وبرمجيات مخصصة</b>.", hook: "ما الذي تحتاجه بالضبط؟", wa: "مرحباً هنري، أرغب في عرض سعر لمشروع برمجيات: " },
      maker: { name: "طباعة ثلاثية الأبعاد · ليزر · CNC", pitch: "نحول الأفكار إلى <b>قطع حقيقية</b>: طباعة ثلاثية الأبعاد، قص بالليزر و CNC.", hook: "ما الذي تريد تصنيعه؟", wa: "مرحباً هنري، أرغب في عرض سعر للتصنيع الرقمي: " },
      iot: { name: "الإلكترونيات والإنترنت الأشياء", pitch: "نقوم بأتمتة الأنظمة باستخدام <b>Arduino و ESP32 و Raspberry Pi</b>.", hook: "ما الذي ترغب في أتمتته؟", wa: "مرحباً هنري، أرغب في عرض سعر لمشروع إلكترونيات: " },
      consultoria: { name: "التصميم والاستشارات", pitch: "نقدم <b>تصميم CAD واستشارات تقنية</b>.", hook: "هل تطلب تصميم قطعة أم استشارة؟", wa: "مرحباً هنري، أنا مهتم بتصميم CAD/استشارات: " }
    },
    t: {
      greeting: ["أنا <b>Maker</b> مستشار <b>CDH Maker</b>. ما هي فكرتك أو مشروعك؟"], re_greeting: ["مرحباً مجدداً! 😄 كيف يمكنني مساعدتك؟"], good_morning: "صباح الخير! ☀️", good_afternoon: "مساء الخير!", good_evening: "مساء الخير! 🌙", comoestas: ["بخير والحمد لله! جاهز لمساعدتك."], bot: "أنا <b>مساعد افتراضي</b>. يمكنك التواصل مع المهندس <b>هنري</b> مباشرة.", thanks: ["بكل سرور! 😊"], bye: ["إلى اللقاء! 👋"], yes: "ممتاز! أخبرني بالمزيد:", no_worries: "تصفح خدماتنا براحتك:", quien: "نحن <b>CDH Maker</b> من كولومبيا 🇨🇴: برمجيات، تصنيع رقمي وإلكترونيات.", henry: "المؤسس هو المهندس <b>هنري تابوردا</b>.", precio: ["<b>عرض السعر مخصص ومجاني</b> خلال 24 ساعة."], price_cta: "صف مشروعك وسأجهز لك الرسالة:", tiempo: "قطع الطباعة خلال <b>أيام</b>، والمواقع خلال <b>1-2 أسابيع</b>.", time_cta: "هل تريد عرض سعر مجاني؟", pago: "الدفع <b>على مراحل</b>.", garantia: "اختبارات وتوثيق ودعم بعد التسليم.", materiales: "طباعة FDM/Resin، قص ليزر و CNC.", horario: "يمكنك الكتابة في أي وقت بحساب العميل.", contacto: "وصول مباشر إلى WhatsApp للعملاء المسجلين.", contact_guest: "للتحدث مع هنري، أنشئ <b>حساب عميل مجاني</b>.", humano: "<b>هنري</b> سيجيبك شخصياً:", captured: ["الرسالة جاهزة للإرسال إلى هنري:"], fallback: ["للإجابة الدقيقة يفضل سؤال هنري مباشرة:"]
    }
  };

  // ═════════════════════════ BENGALI ════════════════════════════
  L.bn = {
    ui: { sub: "CDH Maker পরামর্শদাতা · অনলাইন", placeholder: "আপনার বার্তা লিখুন…", open: "চ্যাট খুলুন", close: "চ্যাট বন্ধ করুন", chat: "Maker এর সাথে চ্যাট", quick: "দ্রুত উত্তর", voice_on: "ভয়েস চালু করুন", voice_off: "মিউট করুন", voice_ready: "এখন আপনি আমাকে শুনতে পাচ্ছেন।" },
    btn: { back: "অন্যান্য সেবা", menu: "সেবা দেখুন", quote: "WhatsApp এ মূল্য জানুন", how_long: "কত সময় লাগবে?", how_much: "কত খরচ হবে?", open_wa: "WhatsApp খুলুন", create_account: "বিনামূল্যে অ্যাকাউন্ট খুলুন", send_project: "প্রজেক্ট পাঠান", ask_direct: "Henry কে জিজ্ঞাসা করুন", talk_henry: "Henry এর সাথে কথা বলুন", more: "আরও জানুন", process: "পদ্ধতি", projects: "প্রজেক্ট দেখুন", visit: "খুলুন" },
    wa: { generic: "হ্যালো Henry, আমার একটি প্রশ্ন আছে: ", quote: "হ্যালো Henry, আমি মূল্য জানতে চাই: ", contact: "হ্যালো Henry, আমি একজন নিবন্ধিত ক্লায়েন্ট।" },
    svc: {
      web: { name: "ওয়েব ও সফটওয়্যার", pitch: "আমরা <b>ওয়েবসাইট, অনলাইন শপ এবং কাস্টম সফটওয়্যার</b> তৈরি করি।", hook: "আপনার ঠিক কী প্রয়োজন?", wa: "হ্যালো Henry, আমি ওয়েব/সফটওয়্যার প্রজেক্টের দাম জানতে চাই: " },
      maker: { name: "3D প্রিন্টিং · লেজার · CNC", pitch: "আমরা ব্লুপ্রিন্টকে <b>বাস্তব যন্ত্রাংশে</b> রূপান্তর করি।", hook: "আপনি কী তৈরি করতে চান?", wa: "হ্যালো Henry, আমি 3D/লেজার/CNC প্রজেক্টের দাম জানতে চাই: " },
      iot: { name: "ইলেকট্রনিক্স ও IoT", pitch: "আমরা <b>Arduino, ESP32 এবং Raspberry Pi</b> দিয়ে অটোমেশন করি।", hook: "আপনি কী অটোমেট করতে চান?", wa: "হ্যালো Henry, আমি IoT প্রজেক্টের দাম জানতে চাই: " },
      consultoria: { name: "ডিজাইন ও পরামর্শ", pitch: "আমরা <b>2D/3D CAD ডিজাইন ও কারিগরি পরামর্শ</b> প্রদান করি।", hook: "আপনার কি পার্টস ডিজাইন প্রয়োজন?", wa: "হ্যালো Henry, আমি CAD ডিজাইন/পরামর্শের জন্য আগ্রহী: " }
    },
    t: {
      greeting: ["আমি <b>Maker</b>, <b>CDH Maker</b> এর পরামর্শদাতা। আপনার প্রজেক্টটি কেমন?"], re_greeting: ["হ্যালো! 😄 কীভাবে সাহায্য করতে পারি?"], good_morning: "শুভ সকাল! ☀️", good_afternoon: "শুভ অপরাহ্ন!", good_evening: "শুভ সন্ধ্যা! 🌙", comoestas: ["আমি ভালো আছি! সাহায্য করতে প্রস্তুত।"], bot: "আমি একজন <b>ভার্চুয়াল সহকারী</b>। আপনি ইঞ্জিনিয়ার <b>Henry</b> এর সাথে সরাসরি কথা বলতে পারেন।", thanks: ["ধন্যবাদ! 😊"], bye: ["বিদায়! 👋"], yes: "দুর্দান্ত! আরও বিস্তারিত বলুন:", no_worries: "আমাদের সেবাগুলো দেখুন:", quien: "আমরা কোলম্বিয়ার <b>CDH Maker</b> 🇨🇴: সফটওয়্যার, 3D প্রিন্টিং ও IoT।", henry: "প্রতিষ্ঠাতা ইঞ্জিনিয়ার <b>Henry Taborda</b>।", precio: ["<b>মূল্য নির্ধারণ সম্পূর্ণ বিনামূল্যে</b> (২৪ ঘণ্টার মধ্যে)।"], price_cta: "আপনার প্রয়োজন জানান:", tiempo: "3D প্রিন্টিং <b>কয়েক দিনে</b>, ওয়েবসাইট <b>১-২ সপ্তাহে</b>।", time_cta: "বিনামূল্যে মূল্য জানতে চান?", pago: "ধাপে ধাপে পেমেন্ট।", garantia: "টেস্টিং, ডকুমেন্টেশন ও সাপোর্ট অন্তর্ভুক্ত।", materiales: "FDM/Resin 3D প্রিন্টিং, লেজার ও CNC।", horario: "ক্লায়েন্ট অ্যাকাউন্ট দিয়ে যেকোনো সময় লিখুন।", contacto: "নিবন্ধিত ক্লায়েন্টদের জন্য সরাসরি WhatsApp সংযোগ।", contact_guest: "Henry এর সাথে কথা বলতে <b>বিনামূল্যে অ্যাকাউন্ট খুলুন</b>।", humano: "<b>Henry</b> আপনাকে সরাসরি উত্তর দেবেন:", captured: ["Henry এর জন্য বার্তা প্রস্তুত:"], fallback: ["সঠিক উত্তরের জন্য Henry কে সরাসরি জিজ্ঞাসা করুন:"]
    }
  };

  // ═════════════════════════ INDONESIAN ════════════════════════════
  L.id = {
    ui: { sub: "Konsultan CDH Maker · online", placeholder: "Ketik pesan Anda…", open: "Buka obrolan", close: "Tutup obrolan", chat: "Obrolan dengan Maker", quick: "Balasan cepat", voice_on: "Aktifkan suara", voice_off: "Bisu", voice_ready: "Bagus, sekarang Anda bisa mendengar saya." },
    btn: { back: "Layanan lainnya", menu: "Lihat layanan", quote: "Minta penawaran di WhatsApp", how_long: "Berapa lama waktunya?", how_much: "Berapa biayanya?", open_wa: "Buka WhatsApp", create_account: "Buat akun gratis", send_project: "Kirim proyek saya", ask_direct: "Tanya Henry", talk_henry: "Bicara dengan Henry", more: "Pelajari lebih lanjut", process: "Proses kerja", projects: "Lihat proyek", visit: "Buka proyek" },
    wa: { generic: "Halo Henry, saya punya pertanyaan: ", quote: "Halo Henry, saya ingin minta penawaran harga: ", contact: "Halo Henry, saya klien terdaftar dan ingin berbicara." },
    svc: {
      web: { name: "Web & Perangkat Lunak", pitch: "Kami membuat <b>situs web, toko online, dan perangkat lunak kustom</b>.", hook: "Apa yang persisnya Anda butuhkan?", wa: "Halo Henry, saya ingin penawaran proyek web/software: " },
      maker: { name: "Cetak 3D · Laser · CNC", pitch: "Kami mengubah ide menjadi <b>suku cadang nyata</b>: cetak 3D, potong laser & CNC.", hook: "Apa yang ingin Anda buat?", wa: "Halo Henry, saya ingin penawaran manufaktur digital: " },
      iot: { name: "Elektronika & IoT", pitch: "Kami mengotomatiskan dengan <b>Arduino, ESP32, dan Raspberry Pi</b>.", hook: "Apa yang ingin Anda otomatisasi?", wa: "Halo Henry, saya ingin penawaran proyek IoT: " },
      consultoria: { name: "Desain & Konsultasi", pitch: "Kami menawarkan <b>desain CAD 2D/3D dan konsultasi teknis</b>.", hook: "Apakah Anda butuh desain komponen atau konsultasi?", wa: "Halo Henry, saya tertarik dengan desain CAD / konsultasi: " }
    },
    t: {
      greeting: ["Saya <b>Maker</b>, konsultan dari <b>CDH Maker</b>. Ada ide proyek apa hari ini?"], re_greeting: ["Halo lagi! 😄 Ada yang bisa dibantu?"], good_morning: "Selamat pagi! ☀️", good_afternoon: "Selamat siang!", good_evening: "Selamat malam! 🌙", comoestas: ["Sangat baik, terima kasih! Ready membantu."], bot: "Saya <b>asisten virtual</b>. Anda bisa berbicara dengan <b>Henry</b> kapan saja.", thanks: ["Dengan senang hati! 😊"], bye: ["Sampai jumpa! 👋"], yes: "Bagus! Ceritakan lebih lanjut:", no_worries: "Silakan jelajahi layanan kami:", quien: "Kami <b>CDH Maker</b> dari Kolombia 🇨🇴: perangkat lunak, cetak 3D & IoT.", henry: "Pendirinya adalah insinyur <b>Henry Taborda</b>.", precio: ["<b>Penawaran harga gratis</b> dalam waktu 24 jam."], price_cta: "Tuliskan kebutuhan Anda:", tiempo: "Komponen 3D dalam <b>beberapa hari</b>, situs web <b>1-2 minggu</b>.", time_cta: "Ingin penawaran harga gratis?", pago: "Pembayaran <b>bertahap</b>.", garantia: "Pengujian, dokumentasi & dukungan pasca-penjualan.", materiales: "Cetak 3D FDM/resin, potong laser & CNC.", horario: "Dengan akun klien Anda bisa menulis kapan saja.", contacto: "Akses WhatsApp langsung untuk klien terdaftar.", contact_guest: "Untuk berbicara dengan Henry, buat <b>akun klien gratis</b> terlebih dahulu.", humano: "<b>Henry</b> akan melayani Anda secara langsung:", captured: ["Pesan Anda siap dikirim ke Henry:"], fallback: ["Untuk jawaban tepat, sebaiknya langsung tanya ke Henry:"]
    }
  };

  return { intents, L, URL };
})();

