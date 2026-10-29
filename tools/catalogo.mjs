/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/catalogo.mjs
   Catálogo de productos y servicios: FUENTE ÚNICA. De aquí salen
     · /catalogo (es) y /en/catalog (en)          ← tools/build-i18n.mjs
     · el JSON-LD OfferCatalog con precios        ← tools/build-i18n.mjs
     · el bloque de precios de llms.txt           ← tools/build-i18n.mjs
     · public/catalogo.json, que leen la cinta (ads.js), el chat
       (chat-widget.js) y el bot de Shorts (ClipFactory, guiones de oferta)

   ★ DESDE 2026-10-29 EL CATÁLOGO SE ADMINISTRA EN EL CRM (/crm → Catálogo):
   productos, servicios, precios, imágenes y descripciones viven en Firestore
   (catalogo/{id}, catalogo_imagenes/{id} y catalogo_config/general, lectura
   pública). Este archivo es la SEMILLA (botón «Cargar el catálogo inicial»
   del CRM) y el RESPALDO del build: si Firestore no responde al desplegar,
   la web sale con estos datos. cargarRemoto() reemplaza CATALOGO, CATEGORIAS
   y PROVISIONAL por lo del CRM (los importadores ven el cambio: son enlaces
   vivos de los módulos ES).

   Precios: Henry los aprobó el 2026-10-29 (PROVISIONAL = false). El aviso
   «orientativos, antes de impuestos» se vuelve a encender desde el CRM.

   Reglas:
   - cop y usd son el precio DESDE (o el precio fijo si desde = false).
     null = «a consultar». gratis = true para lo que no se cobra.
   - usd es para clientes fuera de Colombia (no una conversión exacta; TRM de
     referencia ~3.200 COP/USD, octubre de 2026).
   - claves: palabras con las que el chat reconoce el servicio (sin tildes,
     en minúscula; es y en mezcladas).
   - La Consultoría va primero: la mayoría llega sin saber qué necesita.
   - Campos opcionales que usa la vitrina de la portada (vitrina.js) y el
     catálogo (desde 2026-10-29, ver docs/INVENTARIO.md):
       estado: "produccion" | "demo" | "desarrollo"  (sin estado = servicio
               que se contrata; los productos propios siempre lo llevan)
       demo:   enlace a una demo o video público (https:// o /media/…)
       pagina: página de servicio en español (/servicios/…); la vitrina la
               cambia por la del idioma de la página
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */

export let PROVISIONAL = false;
export const ACTUALIZADO = "2026-10-29";
export const TRM_REFERENCIA = 3200;

export let CATEGORIAS = [
  { id: "consultoria", nombre: { es: "Consultoría", en: "Consulting" },
    lema: { es: "Para cuando sabes que algo tiene que mejorar, pero no qué comprar ni por dónde empezar.",
      en: "For when you know something has to improve but not what to buy or where to start." } },
  { id: "software", nombre: { es: "Software y SaaS a la medida", en: "Custom software and SaaS" },
    lema: { es: "Páginas, aplicaciones y plataformas que trabajan por tu negocio.",
      en: "Websites, apps and platforms that work for your business." } },
  { id: "ia", nombre: { es: "Inteligencia artificial y automatización", en: "AI and automation" },
    lema: { es: "Tareas repetitivas que se hacen solas y asistentes que responden por ti.",
      en: "Repetitive tasks that run themselves and assistants that answer for you." } },
  { id: "contenido", nombre: { es: "Contenido en video (Shorts)", en: "Short-form video content" },
    lema: { es: "Tus videos largos convertidos en clips verticales cada semana, sin editar nada.",
      en: "Your long videos turned into vertical clips every week, with no editing on your side." } },
  { id: "fabricacion", nombre: { es: "Fabricación digital", en: "Digital fabrication" },
    lema: { es: "Impresión 3D, corte láser, CNC y diseño CAD en Medellín, con envíos a toda Colombia.",
      en: "3D printing, laser cutting, CNC and CAD design in Medellín, shipping across Colombia." } },
  { id: "iot", nombre: { es: "Electrónica e IoT", en: "Electronics and IoT" },
    lema: { es: "De la idea a un prototipo conectado que mide, avisa y controla.",
      en: "From idea to a connected prototype that measures, alerts and controls." } },
  { id: "productos", nombre: { es: "Productos propios (SaaS)", en: "Our own products (SaaS)" },
    lema: { es: "Plataformas de CDH Maker listas para usar.",
      en: "CDH Maker platforms, ready to use." } },
];

export let CATALOGO = [
  // ── Consultoría ───────────────────────────────────────────────────────
  {
    id: "orientacion", cat: "consultoria", destacado: true,
    nombre: { es: "Sesión de orientación (30 min)", en: "Orientation call (30 min)" },
    para: { es: "Cuentas tu situación y sales sabiendo si te podemos ayudar, qué tipo de solución te sirve y cuánto costaría más o menos.",
      en: "You describe your situation and leave knowing whether we can help, what kind of solution fits and roughly what it would cost." },
    incluye: { es: ["Videollamada o WhatsApp de 30 minutos", "Qué sí y qué no vale la pena hacer", "Siguiente paso concreto, sin compromiso"],
      en: ["30-minute video call or WhatsApp chat", "What is and isn't worth doing", "A concrete next step, no commitment"] },
    precio: { gratis: true }, plazo: { es: "Agenda en 1–2 días hábiles", en: "Booked within 1–2 business days" },
    claves: ["orientacion", "no se que necesito", "asesoria", "gratis", "por donde empiezo", "ayuda", "free call", "advice"],
  },
  {
    id: "diagnostico", cat: "consultoria", destacado: true,
    nombre: { es: "Diagnóstico digital express", en: "Express digital diagnosis" },
    para: { es: "Revisamos cómo trabaja hoy tu negocio (ventas, inventario, atención, procesos) y te decimos qué arreglar primero y qué cuesta.",
      en: "We review how your business works today (sales, inventory, customer service, processes) and tell you what to fix first and what it costs." },
    incluye: { es: ["Reunión de 90 minutos con quien conoce la operación", "Informe con las 3 prioridades y su impacto", "Presupuesto estimado de cada prioridad", "El valor se descuenta si contratas el proyecto"],
      en: ["90-minute meeting with whoever runs the operation", "Report with the top 3 priorities and their impact", "Estimated budget for each priority", "Fee credited if you hire the project"] },
    precio: { cop: 290000, usd: 90 }, plazo: { es: "Informe en 3 días hábiles", en: "Report in 3 business days" },
    claves: ["diagnostico", "consultoria", "consultor", "auditoria", "revisar mi negocio", "que me recomiendas", "consulting", "assessment", "audit"],
  },
  {
    id: "hoja-de-ruta", cat: "consultoria", destacado: true,
    nombre: { es: "Hoja de ruta tecnológica", en: "Technology roadmap" },
    para: { es: "Para empresas que van a invertir en tecnología y quieren hacerlo en orden: qué construir, qué comprar, qué automatizar y en qué fases.",
      en: "For companies about to invest in technology that want to do it in order: what to build, what to buy, what to automate, and in which phases." },
    incluye: { es: ["Levantamiento de procesos con tu equipo", "Mapa de herramientas actuales y brechas", "Comparativo construir vs. comprar (con proveedores reales)", "Cronograma y presupuesto por fases", "Presentación final a la gerencia"],
      en: ["Process mapping with your team", "Map of current tools and gaps", "Build vs. buy comparison (with real vendors)", "Phased timeline and budget", "Final presentation to management"] },
    precio: { cop: 1200000, usd: 375, desde: true }, plazo: { es: "1 a 2 semanas", en: "1 to 2 weeks" },
    claves: ["hoja de ruta", "plan", "transformacion digital", "estrategia", "estrategia digital", "roadmap", "digital transformation", "strategy"],
  },
  {
    id: "cto-por-horas", cat: "consultoria",
    nombre: { es: "Acompañamiento técnico mensual (CTO por horas)", en: "Monthly technical advisory (fractional CTO)" },
    para: { es: "Un ingeniero de tu lado para decidir, revisar proveedores y cotizaciones, y que no te vendan lo que no necesitas.",
      en: "An engineer on your side to make decisions, review vendors and quotes, and keep you from buying what you don't need." },
    incluye: { es: ["8 horas al mes (reuniones, revisiones, respuestas)", "Revisión de cotizaciones y contratos técnicos", "Seguimiento de proveedores y proyectos", "Sin permanencia: aviso de 15 días"],
      en: ["8 hours a month (meetings, reviews, answers)", "Review of technical quotes and contracts", "Vendor and project follow-up", "No lock-in: 15 days' notice"] },
    precio: { cop: 950000, usd: 300, desde: true, unidad: { es: "al mes", en: "per month" } }, plazo: { es: "Mensual", en: "Monthly" },
    claves: ["cto", "acompanamiento", "asesor tecnico", "proveedor", "revisar cotizacion", "fractional cto", "advisor"],
  },

  {
    id: "talleres", cat: "consultoria",
    nombre: { es: "Talleres y capacitaciones maker", en: "Maker workshops and training" },
    para: { es: "Formación práctica para tu equipo, colegio o comunidad: impresión 3D, electrónica con Arduino y ESP32, automatización e IA aplicada, aprendiendo haciendo.",
      en: "Hands-on training for your team, school or community: 3D printing, electronics with Arduino and ESP32, automation and applied AI, learning by doing." },
    incluye: { es: ["Temario a la medida del grupo", "Práctica con equipos y proyectos reales", "Material de apoyo para seguir solos"],
      en: ["Syllabus tailored to the group", "Practice with real equipment and projects", "Support material to keep going on your own"] },
    precio: {}, plazo: { es: "Según el temario", en: "Depends on the syllabus" },
    claves: ["taller", "talleres", "capacitacion", "curso", "formacion", "clases", "workshop", "training", "course"],
  },
  {
    id: "auditoria-web", cat: "consultoria",
    nombre: { es: "Auditoría de tu sitio web", en: "Website audit" },
    para: { es: "Revisamos tu página actual (velocidad, SEO, celular, seguridad y cómo convierte visitas en clientes) y te entregamos un informe con lo que hay que corregir primero.",
      en: "We review your current website (speed, SEO, mobile, security and how it turns visits into customers) and hand you a report with what to fix first." },
    incluye: { es: ["Revisión técnica, de contenido y de SEO", "Informe con hallazgos priorizados", "Recomendaciones que puede ejecutar cualquier proveedor"],
      en: ["Technical, content and SEO review", "Report with prioritized findings", "Recommendations any vendor can carry out"] },
    precio: {}, plazo: { es: "Informe en pocos días", en: "Report within a few days" },
    claves: ["auditoria", "auditoria web", "seo", "revisar mi pagina", "mi pagina no vende", "velocidad", "website audit", "seo audit"],
  },

  // ── Software ──────────────────────────────────────────────────────────
  {
    id: "landing", cat: "software", pagina: "/servicios/software-a-la-medida-medellin",
    nombre: { es: "Página web / landing page", en: "Website / landing page" },
    para: { es: "Tu negocio en internet con una página rápida, que se ve bien en el celular y lleva clientes a tu WhatsApp.",
      en: "Your business online with a fast, mobile-friendly page that sends customers to your WhatsApp." },
    incluye: { es: ["Diseño a la medida y textos orientados a vender", "Botón de WhatsApp y formulario", "Optimizada para Google y asistentes de IA", "Dominio y hosting configurados"],
      en: ["Custom design and sales-oriented copy", "WhatsApp button and form", "Optimized for Google and AI assistants", "Domain and hosting set up"] },
    precio: { cop: 1500000, usd: 470, desde: true }, plazo: { es: "1 a 2 semanas", en: "1 to 2 weeks" },
    claves: ["pagina web", "landing", "sitio web", "web", "pagina", "website", "site"],
  },
  {
    id: "tienda", cat: "software", pagina: "/servicios/software-a-la-medida-medellin",
    nombre: { es: "Tienda en línea (e-commerce)", en: "Online store (e-commerce)" },
    para: { es: "Vende por internet con catálogo, carrito, pagos y envíos. Si estás en Medellín, con domicilios y contraentrega por YAM.",
      en: "Sell online with catalog, cart, payments and shipping. In Medellín, with delivery and cash on delivery through YAM." },
    incluye: { es: ["Catálogo y carrito", "Pagos en línea y contraentrega", "Envíos integrados con YAM (Medellín)", "Panel para ver y despachar pedidos"],
      en: ["Catalog and cart", "Online payments and cash on delivery", "Shipping integrated with YAM (Medellín)", "Dashboard to see and dispatch orders"] },
    precio: { cop: 2800000, usd: 875, desde: true }, plazo: { es: "2 a 4 semanas", en: "2 to 4 weeks" },
    claves: ["tienda", "ecommerce", "e-commerce", "vender en linea", "carrito", "shopify", "online store", "shop"],
  },
  {
    id: "app-medida", cat: "software", destacado: true, pagina: "/servicios/software-a-la-medida-medellin",
    nombre: { es: "Aplicación web o SaaS a la medida", en: "Custom web app or SaaS" },
    para: { es: "Cuando Excel y WhatsApp ya no alcanzan: un sistema propio para tu operación (inventario, pedidos, mantenimiento, clientes, facturación).",
      en: "When spreadsheets and WhatsApp are no longer enough: your own system for operations (inventory, orders, maintenance, customers, billing)." },
    incluye: { es: ["Usuarios, roles y permisos", "Base de datos en la nube y respaldos", "Entregas por etapas con avances desde la primera semana", "Documentación y acompañamiento posterior"],
      en: ["Users, roles and permissions", "Cloud database and backups", "Staged delivery with progress from week one", "Documentation and post-launch support"] },
    precio: { cop: 6000000, usd: 1900, desde: true }, plazo: { es: "4 a 10 semanas", en: "4 to 10 weeks" },
    claves: ["aplicacion", "app", "software", "saas", "sistema", "plataforma", "inventario", "crm", "erp", "a la medida", "custom software", "platform"],
  },

  {
    id: "mantenimiento", cat: "software", estado: "produccion", demo: "/media/refricom-demo.mp4", pagina: "/servicios/software-a-la-medida-medellin",
    nombre: { es: "Sistema de mantenimiento preventivo", en: "Preventive maintenance system" },
    para: { es: "Para empresas de mantenimiento y refrigeración: clientes, equipos, cronograma anual, servicios con checklist desde el celular (también sin señal) y reportes que tu cliente consulta en línea. Es el sistema que usa Refricom.",
      en: "For maintenance and refrigeration companies: customers, equipment, yearly schedule, checklist-based service visits from the phone (even offline) and reports your customer checks online. It's the system Refricom runs on." },
    incluye: { es: ["Roles de administrador, técnico y cliente", "Cronograma anual con reprogramación de visitas", "Checklist en el celular, sin señal", "Hoja de vida de cada equipo y reportes"],
      en: ["Admin, technician and customer roles", "Yearly schedule with visit rescheduling", "Offline checklist on the phone", "Equipment history and reports"] },
    precio: {}, plazo: { es: "Según tus equipos y procesos", en: "Depends on your equipment and processes" },
    claves: ["mantenimiento", "mantenimiento preventivo", "cronograma", "equipos", "refrigeracion", "checklist", "orden de trabajo", "maintenance", "cmms"],
  },

  // ── IA y automatización ──────────────────────────────────────────────
  {
    id: "asistente-ia", cat: "ia", destacado: true, pagina: "/servicios/inteligencia-artificial-medellin",
    nombre: { es: "Asistente con IA para WhatsApp o tu web", en: "AI assistant for WhatsApp or your website" },
    para: { es: "Responde preguntas frecuentes, toma pedidos y agenda citas a cualquier hora, y te pasa la conversación cuando hace falta una persona.",
      en: "Answers FAQs, takes orders and books appointments around the clock, and hands the chat to a person when needed." },
    incluye: { es: ["Entrenado con la información de tu negocio", "Conexión a WhatsApp Business o a tu web", "Paso a humano y reporte de conversaciones", "Ajustes durante el primer mes"],
      en: ["Trained on your business information", "Connected to WhatsApp Business or your website", "Human handoff and conversation reports", "Tuning during the first month"] },
    precio: { cop: 2500000, usd: 780, desde: true }, plazo: { es: "2 a 4 semanas", en: "2 to 4 weeks" },
    claves: ["chatbot", "bot", "asistente", "ia", "inteligencia artificial", "whatsapp", "responder clientes", "ai", "assistant", "gpt", "claude", "gemini"],
  },
  {
    id: "automatizacion", cat: "ia", pagina: "/servicios/inteligencia-artificial-medellin",
    nombre: { es: "Automatización de procesos", en: "Process automation" },
    para: { es: "Lo que hoy se copia y pega a mano (facturas, reportes, recordatorios, inventario) pasa a hacerse solo.",
      en: "What you copy and paste by hand today (invoices, reports, reminders, inventory) starts running on its own." },
    incluye: { es: ["Mapa del proceso actual", "Automatización con n8n, scripts o integraciones", "Alertas cuando algo falla", "Manual corto para tu equipo"],
      en: ["Map of the current process", "Automation with n8n, scripts or integrations", "Alerts when something fails", "Short manual for your team"] },
    precio: { cop: 1800000, usd: 560, desde: true }, plazo: { es: "2 a 5 semanas", en: "2 to 5 weeks" },
    claves: ["automatizar", "automatizacion", "n8n", "zapier", "proceso", "reportes", "excel", "automation", "workflow"],
  },

  // ── Contenido (ClipFactory) ───────────────────────────────────────────
  {
    id: "shorts-piloto", cat: "contenido",
    nombre: { es: "Piloto de Shorts (2 semanas)", en: "Shorts pilot (2 weeks)" },
    para: { es: "Prueba sin riesgo: 6 clips verticales de un video largo tuyo, con subtítulos y textos listos para publicar.",
      en: "Risk-free trial: 6 vertical clips from one of your long videos, with captions and copy ready to post." },
    incluye: { es: ["6 clips 9:16 con subtítulos", "Título, descripción y hashtags por clip", "Archivos para YouTube, TikTok y Reels", "Se descuenta del primer mes si sigues"],
      en: ["6 vertical 9:16 clips with captions", "Title, description and hashtags per clip", "Files for YouTube, TikTok and Reels", "Credited to month one if you continue"] },
    precio: { cop: 290000, usd: 95 }, plazo: { es: "72 h hábiles", en: "72 business hours" },
    claves: ["shorts", "clips", "reels", "tiktok", "video", "videos cortos", "piloto", "short-form"],
  },
  {
    id: "shorts-arranque", cat: "contenido",
    nombre: { es: "Shorts cada mes (plan Arranque)", en: "Monthly Shorts (Starter plan)" },
    para: { es: "12 clips al mes de hasta 4 videos largos tuyos (uno por semana), con subtítulos y textos listos para publicar.",
      en: "12 clips a month from up to 4 of your long videos (one a week), with captions and copy ready to post." },
    incluye: { es: ["12 clips 9:16 al mes", "Subtítulos con el estilo de tu marca", "Título, descripción y hashtags por clip", "Archivos para YouTube, TikTok y Reels"],
      en: ["12 vertical 9:16 clips a month", "Captions in your brand style", "Title, description and hashtags per clip", "Files for YouTube, TikTok and Reels"] },
    precio: { cop: 690000, usd: 250, unidad: { es: "al mes", en: "per month" } }, plazo: { es: "72 h hábiles por video", en: "72 business hours per video" },
    claves: ["shorts", "clips", "reels", "tiktok", "plan arranque", "starter", "short-form"],
  },
  {
    id: "shorts-mensual", cat: "contenido",
    nombre: { es: "Shorts cada mes (plan Constante)", en: "Monthly Shorts (Steady plan)" },
    para: { es: "30 clips al mes de tus podcasts, clases o lives, publicados de forma programada. Hay plan desde 12 clips.",
      en: "30 clips a month from your podcasts, classes or lives, scheduled for you. Plans start at 12 clips." },
    incluye: { es: ["30 clips 9:16 al mes (hasta 8 videos largos)", "Gancho de apertura con IA en 4 clips", "Publicación programada en tu canal", "Reporte mensual de qué funcionó"],
      en: ["30 vertical clips a month (up to 8 long videos)", "AI opening hook on 4 clips", "Scheduled publishing on your channel", "Monthly report of what worked"] },
    precio: { cop: 1490000, usd: 520, unidad: { es: "al mes", en: "per month" } }, plazo: { es: "48 h hábiles por video", en: "48 business hours per video" },
    claves: ["shorts", "clipping", "contenido", "redes sociales", "youtube", "community manager", "content", "social media"],
  },

  {
    id: "shorts-presencia", cat: "contenido",
    nombre: { es: "Shorts cada mes (plan Presencia)", en: "Monthly Shorts (Presence plan)" },
    para: { es: "60 clips al mes de hasta 12 videos largos, con prioridad de entrega, publicación programada y una llamada mensual de resultados.",
      en: "60 clips a month from up to 12 long videos, with priority delivery, scheduled publishing and a monthly results call." },
    incluye: { es: ["60 clips 9:16 al mes (20 a 90 s)", "Gancho de apertura con IA en 12 clips", "Publicación programada en tu canal", "Reporte y llamada mensual de 30 min"],
      en: ["60 vertical clips a month (20 to 90 s)", "AI opening hook on 12 clips", "Scheduled publishing on your channel", "Monthly report and 30-min call"] },
    precio: { cop: 2490000, usd: 850, unidad: { es: "al mes", en: "per month" } }, plazo: { es: "48 h hábiles, con prioridad", en: "48 business hours, priority" },
    claves: ["shorts", "clipping", "contenido", "plan presencia", "agencia", "podcast", "content"],
  },

  // ── Fabricación digital ───────────────────────────────────────────────
  {
    id: "impresion-3d", cat: "fabricacion", pagina: "/servicios/impresion-3d-medellin",
    nombre: { es: "Impresión 3D por encargo", en: "3D printing on demand" },
    para: { es: "Piezas, repuestos, prototipos y maquetas en FDM o resina, desde tu archivo STL o desde la idea.",
      en: "Parts, spare parts, prototypes and models in FDM or resin, from your STL file or just the idea." },
    incluye: { es: ["Revisión del archivo y del material adecuado", "Impresión en PLA, PETG, TPU o resina", "Envío a toda Colombia"],
      en: ["File and material review", "Printing in PLA, PETG, TPU or resin", "Shipping across Colombia"] },
    precio: { cop: 25000, usd: null, desde: true, unidad: { es: "por pieza", en: "per part" } }, plazo: { es: "1 a 5 días", en: "1 to 5 days" },
    claves: ["impresion 3d", "3d", "stl", "prototipo", "pieza", "repuesto", "resina", "3d printing", "print"],
  },
  {
    id: "laser-cnc", cat: "fabricacion", pagina: "/servicios/impresion-3d-medellin",
    nombre: { es: "Corte láser y CNC", en: "Laser cutting and CNC" },
    para: { es: "Corte y grabado en MDF, acrílico, madera y más: señalética, empaques, piezas y regalos corporativos.",
      en: "Cutting and engraving in MDF, acrylic, wood and more: signage, packaging, parts and corporate gifts." },
    incluye: { es: ["Preparación del archivo vectorial", "Corte o grabado", "Envío a toda Colombia"],
      en: ["Vector file preparation", "Cutting or engraving", "Shipping across Colombia"] },
    precio: { cop: 30000, usd: null, desde: true }, plazo: { es: "1 a 5 días", en: "1 to 5 days" },
    claves: ["laser", "corte laser", "cnc", "grabado", "acrilico", "mdf", "laser cutting", "engraving"],
  },
  {
    id: "cad", cat: "fabricacion", pagina: "/servicios/impresion-3d-medellin",
    nombre: { es: "Diseño CAD 2D/3D", en: "2D/3D CAD design" },
    para: { es: "Llevamos tu idea, boceto o pieza física a un modelo listo para fabricar.",
      en: "We turn your idea, sketch or physical part into a model ready to manufacture." },
    incluye: { es: ["Modelo 3D o plano 2D", "Archivos STL, STEP o DXF", "Una ronda de ajustes"],
      en: ["3D model or 2D drawing", "STL, STEP or DXF files", "One round of changes"] },
    precio: { cop: 180000, usd: 60, desde: true }, plazo: { es: "2 a 5 días", en: "2 to 5 days" },
    claves: ["cad", "diseno", "plano", "modelo 3d", "solidworks", "fusion", "design", "drawing"],
  },

  // ── Electrónica e IoT ─────────────────────────────────────────────────
  {
    id: "iot", cat: "iot", pagina: "/servicios/iot-automatizacion-medellin",
    nombre: { es: "Prototipo electrónico o IoT", en: "Electronics or IoT prototype" },
    para: { es: "Sensores que miden y avisan al celular, control remoto de equipos, domótica y monitoreo de máquinas.",
      en: "Sensors that measure and alert your phone, remote equipment control, home automation and machine monitoring." },
    incluye: { es: ["Diseño del circuito (ESP32, Arduino o Raspberry Pi)", "Programación y tablero en la nube", "Caja impresa en 3D", "Documentación"],
      en: ["Circuit design (ESP32, Arduino or Raspberry Pi)", "Firmware and cloud dashboard", "3D-printed enclosure", "Documentation"] },
    precio: { cop: 1400000, usd: 440, desde: true }, plazo: { es: "1 a 3 semanas", en: "1 to 3 weeks" },
    claves: ["iot", "sensor", "esp32", "arduino", "raspberry", "domotica", "electronica", "monitoreo", "electronics", "home automation"],
  },

  // ── Productos propios ─────────────────────────────────────────────────
  {
    id: "yam", cat: "productos", destacado: true, estado: "produccion", url: "https://yam.cdhmaker.com",
    nombre: { es: "YAM — tienda en línea y envíos de última milla", en: "YAM — online store and last-mile delivery" },
    para: { es: "La plataforma de CDH Maker para que los comercios vendan en línea, despachen con mensajeros y cobren contraentrega en Medellín.",
      en: "CDH Maker's platform for merchants to sell online, dispatch with couriers and collect cash on delivery in Medellín." },
    incluye: { es: ["Tienda propia con catálogo", "Pedidos, rutas y seguimiento en vivo", "Recaudo contraentrega", "Sin mensualidad fija"],
      en: ["Your own storefront and catalog", "Orders, routes and live tracking", "Cash-on-delivery collection", "No fixed monthly fee"] },
    precio: { texto: { es: "2,5 % de las ventas pagadas, facturado al mes", en: "2.5% of paid sales, billed monthly" } },
    plazo: { es: "Abres tu tienda el mismo día", en: "Open your store the same day" },
    claves: ["yam", "envios", "domicilios", "mensajeria", "ultima milla", "contraentrega", "logistica", "delivery", "shipping"],
  },
  {
    id: "incubapp", cat: "productos", estado: "produccion", url: "https://incubapp.cdhmaker.com",
    nombre: { es: "IncubApp — operación de incubación con IA", en: "IncubApp — AI-assisted hatchery operations" },
    para: { es: "SaaS para plantas de incubación: lotes, máquinas, mantenimiento e indicadores en un solo lugar.",
      en: "SaaS for hatcheries: batches, machines, maintenance and KPIs in one place." },
    incluye: { es: ["Multiempresa con tu marca", "Tableros e indicadores", "Asistente con IA"],
      en: ["Multi-tenant with your brand", "Dashboards and KPIs", "AI assistant"] },
    precio: {}, plazo: { es: "Implementación según la planta", en: "Rollout depends on the plant" },
    claves: ["incubapp", "incubadora", "incubacion", "avicola", "pollos", "hatchery", "poultry"],
  },
  {
    id: "taxiya", cat: "productos", estado: "demo", url: "https://taxiya.vercel.app",
    nombre: { es: "TaxiYa — plataforma para centrales de taxis", en: "TaxiYa — platform for taxi dispatch companies" },
    para: { es: "Para que las empresas de taxis operen sin llamadas ni planes de datos costosos: apps para pasajero, conductor y central, con despacho en tiempo real.",
      en: "So taxi companies can run without phone calls or expensive data plans: passenger, driver and dispatch apps with real-time dispatching." },
    incluye: { es: ["App del pasajero", "App del conductor", "Consola de la central con despacho en vivo"],
      en: ["Passenger app", "Driver app", "Dispatch console with live assignment"] },
    precio: {}, plazo: { es: "Implementación según la flota", en: "Rollout depends on the fleet" },
    claves: ["taxiya", "taxi", "taxis", "central de taxis", "despacho", "conductores", "flota", "dispatch", "ride hailing"],
  },
  {
    id: "privacycheck", cat: "productos", estado: "demo", url: "https://privacycheck-co.vercel.app", demo: "/media/privacycheck-demo.mp4",
    nombre: { es: "PrivacyCheck — cumplimiento de la Ley 1581", en: "PrivacyCheck — Colombian data-protection compliance" },
    para: { es: "Autodiagnóstico de protección de datos personales para empresas en Colombia: registro de entidades, consulta al RNBD, puntaje, simulador y análisis con IA.",
      en: "Personal-data protection self-assessment for companies in Colombia (Law 1581): entity registry, RNBD lookup, score, simulator and AI analysis." },
    incluye: { es: ["Autodiagnóstico con puntaje", "Consulta al RNBD", "Simulador y análisis con IA"],
      en: ["Self-assessment with a score", "RNBD registry lookup", "Simulator and AI analysis"] },
    precio: {}, plazo: { es: "Úsalo hoy en la demo", en: "Try the demo today" },
    claves: ["privacycheck", "ley 1581", "habeas data", "proteccion de datos", "datos personales", "rnbd", "sic", "cumplimiento", "data protection", "compliance"],
  },
  {
    id: "evaia", cat: "productos", estado: "desarrollo",
    nombre: { es: "EvaIA — asistente de IA que corre en tu equipo", en: "EvaIA — an AI assistant that runs on your own computer" },
    para: { es: "Asistente con voz, respuesta hablada, visión por cámara, memoria y avatar animado propio que funciona 100 % en local: tus datos no salen del equipo.",
      en: "Assistant with voice, spoken answers, camera vision, memory and its own animated avatar that runs 100% locally: your data never leaves the machine." },
    incluye: { es: ["Voz y respuesta hablada", "Visión por cámara", "Memoria en base de datos local", "Avatar animado"],
      en: ["Voice and spoken answers", "Camera vision", "Local database memory", "Animated avatar"] },
    precio: {}, plazo: { es: "En desarrollo: escríbenos si te interesa", en: "In development: write to us if interested" },
    claves: ["evaia", "eva", "asistente local", "ia local", "privacidad", "voz", "avatar", "local ai", "offline ai"],
  },
];

// ── Textos de la página /catalogo (es) y /en/catalog (en) ──────────────
export const TEXTOS = {
  es: {
    meta_title: "Catálogo y precios de CDH Maker — consultoría, software, IA y fabricación en Medellín",
    meta_desc: "Precios orientativos de CDH Maker: consultoría y diagnóstico digital, páginas web, tiendas en línea, apps y SaaS a la medida, asistentes con IA, Shorts, impresión 3D, láser, CNC e IoT. Cotización gratis en menos de 24 h.",
    crumb_home: "Inicio", crumb: "Catálogo y precios", crumb_aria: "Ruta de navegación",
    kicker: "// Catálogo de productos y servicios",
    h1: "Qué hacemos y cuánto cuesta, más o menos",
    lead: "Si no sabes qué necesitas, empieza por la consultoría: en 30 minutos gratis te decimos si te podemos ayudar y por dónde empezar. Los precios son el punto de partida; la cotización final es gratis.",
    cta1: "Agendar orientación gratis", cta2: "Ver la consultoría",
    provisional: "Precios orientativos y provisionales, en pesos colombianos (COP) antes de impuestos, sujetos a ajuste. Fuera de Colombia se cotiza en dólares (USD).",
    incluye: "Incluye", plazo: "Tiempo", precio: "Precio", pedir: "Cotizar esto", ver: "Ver producto",
    destacado: "Recomendado", dudas_t: "Preguntas sobre precios y consultoría",
    usd: "Fuera de Colombia",
  },
  en: {
    meta_title: "CDH Maker catalog and pricing — consulting, software, AI and fabrication",
    meta_desc: "Indicative CDH Maker pricing: consulting and digital diagnosis, websites, online stores, custom apps and SaaS, AI assistants, Shorts, 3D printing, laser, CNC and IoT. Free quote within 24 hours.",
    crumb_home: "Home", crumb: "Catalog and pricing", crumb_aria: "Breadcrumb",
    kicker: "// Products and services catalog",
    h1: "What we do and roughly what it costs",
    lead: "If you are not sure what you need, start with consulting: a free 30-minute call tells you whether we can help and where to begin. Prices are a starting point; the final quote is free.",
    cta1: "Book a free orientation call", cta2: "See consulting",
    provisional: "Indicative, provisional prices before taxes, subject to change. Clients outside Colombia are quoted in US dollars (USD); Colombian clients in pesos (COP).",
    incluye: "Includes", plazo: "Timeline", precio: "Price", pedir: "Get a quote", ver: "See product",
    destacado: "Recommended", dudas_t: "Questions about pricing and consulting",
    usd: "Outside Colombia",
  },
};

// Preguntas frecuentes del catálogo (también van en FAQPage y en llms.txt).
// Escritas como las haría alguien que no sabe qué necesita.
export const PREGUNTAS = {
  es: [
    ["No sé qué necesito para mi negocio, ¿por dónde empiezo?", "Por la sesión de orientación gratuita de 30 minutos: nos cuentas cómo trabajas hoy y qué te duele, y te decimos qué tipo de solución te sirve, si vale la pena y cuánto costaría más o menos. Si hace falta más detalle, el diagnóstico digital express cuesta 290.000 COP (USD 90) y se descuenta si contratas el proyecto."],
    ["¿Qué es la consultoría de CDH Maker y para quién es?", "Es acompañamiento de un ingeniero para decidir antes de gastar: diagnóstico del negocio, hoja de ruta tecnológica (qué construir, qué comprar y en qué orden) y acompañamiento mensual tipo CTO por horas. Es para pymes, comercios y emprendedores en Colombia y en cualquier país, en español o inglés."],
    ["¿Cuánto cuesta una página web, una tienda en línea o una app a la medida?", "Como referencia: una landing page desde 1.500.000 COP, una tienda en línea desde 2.800.000 COP y una aplicación web o SaaS a la medida desde 6.000.000 COP. Son precios orientativos; el precio final depende del alcance y la cotización es gratis."],
    ["¿Cuánto cuesta un chatbot o asistente con IA para WhatsApp?", "Desde 2.500.000 COP (USD 780), entrenado con la información de tu negocio, conectado a WhatsApp Business o a tu web, con paso a una persona cuando hace falta."],
    ["¿Los precios incluyen IVA?", "No: son precios antes de impuestos y son orientativos. La cotización formal detalla impuestos, etapas y forma de pago por hitos."],
    ["¿Qué es YAM?", "YAM es la plataforma propia de CDH Maker para que los comercios vendan en línea y despachen con envíos de última milla y recaudo contraentrega en Medellín. Cobra el 2,5 % de las ventas pagadas, facturado cada mes, sin mensualidad fija."],
    ["¿Cómo se paga?", "Por hitos, según la cotización. En Colombia puedes pagar desde cualquier banco con Bre-B: escaneas el QR o transfieres a la llave de Bancolombia @henry9866 o de Nequi Negocios 0089443902 (en la portada, sección Medios de pago). Si pagas desde fuera de Colombia, escríbenos y acordamos el medio."],
  ],
  en: [
    ["I don't know what my business needs. Where do I start?", "With the free 30-minute orientation call: you tell us how you work today and what hurts, and we tell you what kind of solution fits, whether it's worth it and roughly what it would cost. If more detail is needed, the express digital diagnosis costs USD 90 (290,000 COP) and is credited if you hire the project."],
    ["What is CDH Maker's consulting and who is it for?", "It is an engineer helping you decide before you spend: a business diagnosis, a technology roadmap (what to build, what to buy and in which order) and monthly fractional-CTO advisory. It is for small businesses, merchants and founders in Colombia and worldwide, in Spanish or English."],
    ["How much does a website, online store or custom app cost?", "As a reference: a landing page from USD 470, an online store from USD 875 and a custom web app or SaaS from USD 1,900. Prices are indicative; the final price depends on scope and the quote is free."],
    ["How much does an AI assistant for WhatsApp cost?", "From USD 780 (2,500,000 COP), trained on your business information, connected to WhatsApp Business or your website, with handoff to a person when needed."],
    ["Do prices include taxes?", "No: prices are before taxes and indicative. The formal quote details taxes, stages and milestone payments."],
    ["What is YAM?", "YAM is CDH Maker's own platform for merchants to sell online with last-mile delivery and cash on delivery in Medellín. It charges 2.5% of paid sales, billed monthly, with no fixed monthly fee."],
    ["How do I pay?", "By milestones, as set in the quote. In Colombia you can pay from any bank with Bre-B: scan the QR or transfer to the Bancolombia key @henry9866 or the Nequi Negocios key 0089443902 (Payment methods section on the home page). If you pay from outside Colombia, write to us and we'll agree on the method."],
  ],
};

// ── Ayudas para quien consume el catálogo ──────────────────────────────
const LOCALE = { es: "es-CO", en: "en-US" };
export function precioTexto(item, lang) {
  const p = item.precio || {};
  const L = lang === "en" ? "en" : "es";
  if (p.gratis) return L === "en" ? "Free" : "Gratis";
  if (p.texto) return p.texto[L];
  // En inglés se muestra USD si existe; si no, COP
  const usar = L === "en" && typeof p.usd === "number" ? { n: p.usd, cur: "USD" }
    : typeof p.cop === "number" ? { n: p.cop, cur: "COP" } : null;
  if (!usar) return L === "en" ? "Quote on request" : "A consultar";
  // En inglés con el código (USD 90, COP 25,000): "$" solo confunde fuera de Colombia
  const monto = new Intl.NumberFormat(LOCALE[L], { style: "currency", currency: usar.cur, currencyDisplay: L === "en" ? "code" : "symbol", maximumFractionDigits: 0 }).format(usar.n);
  const desde = p.desde ? (L === "en" ? "From " : "Desde ") : "";
  const unidad = p.unidad ? ` ${p.unidad[L]}` : "";
  return `${desde}${monto}${unidad}`;
}

// ── El catálogo del CRM (Firestore) ────────────────────────────────────
// Con FIRESTORE_EMULATOR_HOST (la variable estándar de Firebase) lee el emulador local
const FIRESTORE = `${process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : "https://firestore.googleapis.com"}/v1/projects/cdh-maker-portafolio/databases/(default)/documents`;
function valor(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("mapValue" in v) return campos(v.mapValue.fields);
  return null;
}
const campos = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, valor(v)]));
async function leer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Trae el catálogo del CRM. Devuelve las imágenes para que el build las
// escriba como archivos ({ id, v, d: dataUri }). Sin red o vacío: queda la semilla.
export async function cargarRemoto(base = FIRESTORE) {
  let docs, conf, imgs;
  try {
    [docs, conf, imgs] = await Promise.all([
      leer(`${base}/catalogo?pageSize=300`),
      leer(`${base}/catalogo_config/general`).catch(() => null),
      leer(`${base}/catalogo_imagenes?pageSize=300`).catch(() => ({})),
    ]);
  } catch (e) {
    return { origen: `semilla (Firestore no respondió: ${e.message})`, imagenes: [] };
  }
  const items = (docs.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...campos(d.fields) }))
    .filter((x) => x.activo !== false && x.nombre?.es && x.para?.es && x.cat);
  if (!items.length) return { origen: "semilla (el catálogo del CRM está vacío)", imagenes: [] };
  const c = conf?.fields ? campos(conf.fields) : {};
  if (Array.isArray(c.categorias) && c.categorias.length) CATEGORIAS = c.categorias;
  if (typeof c.provisional === "boolean") PROVISIONAL = c.provisional;
  const orden = Object.fromEntries(CATEGORIAS.map((x, i) => [x.id, i]));
  // Lo que falte en inglés sale en español: mejor un texto que un "undefined"
  CATALOGO = items
    .map((x) => ({ ...x, nombre: { en: x.nombre.es, ...x.nombre }, para: { en: x.para.es, ...x.para },
      incluye: { es: x.incluye?.es || [], en: x.incluye?.en?.length ? x.incluye.en : x.incluye?.es || [] },
      plazo: { es: x.plazo?.es || "", en: x.plazo?.en || x.plazo?.es || "" }, claves: x.claves || [] }))
    .sort((a, b) => (orden[a.cat] ?? 99) - (orden[b.cat] ?? 99) || (a.orden ?? 999) - (b.orden ?? 999));
  const imagenes = (imgs.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...campos(d.fields) }))
    .filter((x) => /^data:image\/(webp|jpeg|png);base64,/.test(x.d || ""));
  return { origen: `CRM (${CATALOGO.length} ítems)`, imagenes };
}

// Lo que se publica en public/catalogo.json (sin las claves internas que no
// necesita nadie de afuera, pero con las palabras para el chat)
export function catalogoPublico() {
  return {
    generado: ACTUALIZADO,
    provisional: PROVISIONAL,
    aviso: PROVISIONAL
      ? { es: "Precios orientativos y provisionales, antes de impuestos; sujetos a ajuste. La cotización final es gratis y llega en menos de 24 h.",
        en: "Indicative, provisional prices before taxes; subject to change. The final quote is free and arrives within 24 hours." }
      : null,
    paginas: { es: "https://cdhmaker.com/catalogo", en: "https://cdhmaker.com/en/catalog" },
    categorias: CATEGORIAS,
    preguntas: PREGUNTAS,
    items: CATALOGO.map(({ actualizado, actualizado_por, creado, creado_por, ...x }) => ({ ...x, precio_texto: { es: precioTexto(x, "es"), en: precioTexto(x, "en") } })),
  };
}
