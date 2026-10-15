/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/servicios/es.mjs
   Textos de las páginas por servicio y ciudad, en español (idioma FUENTE).
   Los demás idiomas (en.mjs, pt.mjs…) repiten esta misma estructura: mismas
   claves y la misma cantidad de elementos en cada lista. tools/build-i18n.mjs
   avisa si a algún idioma le falta una clave o un elemento.

   Reglas del contenido (por qué la página existe):
     - Solo datos que ya están en el sitio: proyectos de index.html, tiempos
       del cotizador (public/estimator.js), preguntas frecuentes. Nada inventado.
     - Los tiempos NO se escriben a mano: {landing}, {app}, {auto}, {proto},
       {product}, {iotauto}, {cad}, {fdm} y {resin} se reemplazan en el build
       con los valores de TIME_WEB / TIME_IOT / TIME_DESIGN / PRICE de
       estimator.js. Si cambia el cotizador, cambian solas las páginas.
     - Los nombres de proyectos y tecnologías no se traducen.
   Rutas, íconos, proyectos y área de servicio: §SERVICES en build-i18n.mjs.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-10-14
   ═══════════════════════════════════════════════════════════════════════════ */

export default {
  // Textos compartidos por las cuatro páginas
  common: {
    crumb_home: "Inicio",
    crumb_aria: "Ruta de navegación",
    inc_k: "// Qué incluye",
    inc_t: "Qué incluye el servicio",
    times_k: "// Tiempos",
    times_t: "Tiempos de referencia",
    times_s: "Son los valores del cotizador de este sitio: estimados no vinculantes. El tiempo exacto de tu proyecto llega con la cotización, gratis y en menos de 24 horas.",
    proj_k: "// Proyectos relacionados",
    proj_t: "Trabajo real en esta línea",
    proj_s: "Proyectos que ya construimos y que puedes revisar.",
    faq_t: "Preguntas frecuentes sobre este servicio",
    more_k: "// Otros servicios",
    more_t: "También te puede interesar",
    estimate: "Calcular mi estimado",
    range: "{min}–{max} {u}",
    u_weeks: "semanas",
    u_days: "días",
  },

  print3d: {
    meta_title: "Impresión 3D en Medellín: FDM, resina, láser y CNC | CDH Maker",
    meta_desc: "Impresión 3D por encargo en Medellín (FDM y resina), corte láser, CNC y diseño CAD. Envíos a toda Colombia. Cotización gratis en menos de 24 horas.",
    name: "Impresión 3D en Medellín",
    kicker: "// Fabricación digital",
    h1: "Impresión 3D en Medellín",
    lead: "Imprimimos tus piezas en FDM o en resina, cortamos y grabamos en láser y mecanizamos en CNC a partir de un archivo STL, un plano o solo la idea. Taller en Medellín, con envíos por mensajería a toda Colombia.",
    inc: [
      ["Impresión 3D FDM", "Piezas funcionales y prototipos en PLA, PETG, ABS o TPU, con el relleno ajustado al uso que tendrá la pieza."],
      ["Impresión 3D en resina", "Para cuando la pieza necesita detalle fino y un acabado superficial liso."],
      ["Corte y grabado láser", "Piezas planas en MDF, acrílico o madera, calculadas según el espesor y el área."],
      ["Mecanizado CNC", "Madera, aluminio, acero o plástico: desde formas rectas hasta piezas detalladas con curvas y grabados."],
      ["Diseño CAD 2D/3D", "Si solo tienes la idea o un boceto, modelamos la pieza y la dejamos lista para fabricar."],
      ["Del prototipo a tu puerta", "Iteramos contigo hasta que la pieza funcione y la enviamos por mensajería a cualquier ciudad de Colombia."],
    ],
    times: [
      ["Diseño CAD de una pieza", "{cad}"],
      ["Velocidad de impresión FDM: cm³ efectivos por hora, en calidad estándar", "{fdm}"],
      ["Velocidad de impresión en resina: cm de altura por hora", "{resin}"],
    ],
    fdm: "≈ {n} cm³/h",
    resin: "≈ {n} cm/h",
    tools_t: "Calcula tu pieza antes de escribirnos",
    tools_p: "El cotizador estima al instante el tiempo, el peso y el material de tu pieza según sus medidas, el material y el relleno. El visor 3D abre tu archivo STL en el navegador, sin subirlo a ningún servidor, y lo pasa directo al cotizador.",
    faq: [
      ["¿Qué archivo necesito para imprimir en 3D?", "Lo ideal es un archivo STL. También sirve un plano o solo la idea: en ese caso diseñamos la pieza en CAD antes de fabricarla."],
      ["¿Hacen envíos fuera de Medellín?", "Sí. Las piezas físicas (impresión 3D, láser y CNC) se envían por mensajería a todo Colombia."],
      ["¿Cuánto cuesta imprimir una pieza en 3D?", "Depende del volumen, el material, el relleno y la cantidad de piezas. El cotizador del sitio te da al instante un estimado de tiempo, peso y material, y la cotización final llega gratis en menos de 24 horas, sin compromiso."],
      ["¿Qué materiales manejan?", "En impresión FDM: PLA, PETG, ABS y TPU. En impresión de detalle, resina estándar. Para corte láser, MDF, acrílico y madera; para CNC, madera, aluminio, acero o plástico."],
      ["¿Puedo revisar mi modelo antes de enviarlo?", "Sí. El visor 3D de este sitio abre tu STL directo en el navegador, sin subirlo a ningún servidor, para girarlo e inspeccionarlo, y lo pasa al cotizador para estimar cuánto tardaría imprimirlo."],
    ],
  },

  software: {
    meta_title: "Software y SaaS a la medida en Medellín | CDH Maker",
    meta_desc: "Aplicaciones web, plataformas SaaS, páginas web y automatización de procesos a la medida, desde Medellín para Colombia y el mundo. Cotización gratis en 24 h.",
    name: "Software y SaaS a la medida",
    kicker: "// Desarrollo de software",
    h1: "Software y SaaS a la medida en Medellín",
    lead: "Diseñamos y construimos aplicaciones web, plataformas SaaS y automatizaciones para operar tu empresa o lanzar tu propio producto. Hablas directamente con quien lo programa, y lo entregamos en la nube para clientes en Colombia y en cualquier país.",
    inc: [
      ["Aplicaciones web a la medida", "Software para operar tu empresa: logística, ventas, inventarios y órdenes de trabajo, con la lógica de tu negocio y no la de una plantilla."],
      ["Plataformas SaaS", "Tu propio producto en la nube, multi-empresa si lo necesitas, como TaxiYa, A Tiempo Logística o IncubApp."],
      ["Páginas web y tiendas en línea", "Sitios rápidos, adaptados a celular y listos para buscadores: desde una landing page hasta una plataforma completa."],
      ["Automatización de procesos", "Menos trabajo manual: formularios, reportes, notificaciones y flujos entre tus herramientas, conectados y sin errores de digitación."],
      ["Cumplimiento de la Ley 1581", "Herramientas de autodiagnóstico y cumplimiento en protección de datos para empresas en Colombia, como PrivacyCheck."],
      ["Despliegue y acompañamiento", "Código limpio, pruebas y despliegue en la nube; recibes documentación y acompañamiento después de la entrega."],
    ],
    times: [
      ["Landing page o sitio informativo", "{landing}"],
      ["Aplicación web a la medida", "{app}"],
      ["Automatización de procesos", "{auto}"],
    ],
    times_note: "Si la interfaz hay que diseñarla desde cero, el cotizador suma una semana. ¿Es urgente? Escríbenos y vemos cómo priorizarlo.",
    faq: [
      ["¿Cuánto tiempo toma desarrollar una aplicación web?", "Como referencia, una aplicación web a la medida toma {app}, una landing page {landing} y una automatización de procesos {auto}. Trabajamos por etapas, así que ves avances reales desde los primeros días."],
      ["¿Con qué tecnologías trabajan?", "JavaScript, Next.js, Python, FastAPI, Supabase y Firebase, y modelos de IA como Gemini cuando el proyecto lo necesita."],
      ["¿Pueden construir mi propio producto SaaS?", "Sí. TaxiYa e IncubApp son productos SaaS de CDH Maker, y A Tiempo Logística es una plataforma SaaS de última milla para e-commerce en Medellín. Las tres se pueden ver en vivo."],
      ["¿Atienden empresas fuera de Medellín o de Colombia?", "Sí. El software se entrega en la nube para cualquier parte del mundo, y atendemos en español y en inglés."],
      ["¿Cómo se paga el desarrollo?", "Por hitos: el proyecto avanza por etapas con entregas parciales y el pago se divide entre esas etapas. La cotización es gratuita y llega en menos de 24 horas, sin letra pequeña."],
    ],
  },

  ai: {
    meta_title: "Integración de inteligencia artificial en Medellín | CDH Maker",
    meta_desc: "Asistentes de IA, contenido generado con IA y revisión humana, y análisis con IA integrados a tu software. Desde Medellín, para Colombia y el mundo.",
    name: "Integración de inteligencia artificial",
    kicker: "// Inteligencia artificial",
    h1: "Integración de inteligencia artificial en Medellín",
    lead: "Integramos inteligencia artificial a sistemas reales: asistentes con voz y visión, contenido generado con IA que pasa por revisión humana antes de publicarse y análisis con IA dentro del software de tu operación. IA donde aporta, y una persona revisando donde hace falta.",
    inc: [
      ["Asistentes de IA", "Asistentes que conversan, responden por voz y entienden lo que ve una cámara. Pueden correr 100% en local, como EvaIA."],
      ["Contenido con IA y aprobación humana", "Ideas, guiones y piezas generadas con IA (Gemini) que quedan en cola de revisión: nada se publica sin aprobación, como en SIGI."],
      ["Análisis con IA dentro de tu software", "Diagnósticos y análisis integrados a la plataforma que ya usas, como el análisis con IA de PrivacyCheck."],
      ["IA en la operación de la empresa", "Inteligencia artificial al servicio de la operación diaria, como en IncubApp para plantas de incubación y granjas."],
    ],
    times: [
      ["Aplicación web a la medida con IA", "{app}"],
      ["Automatización de procesos con IA", "{auto}"],
    ],
    times_note: "La IA se integra dentro de una aplicación o de una automatización, por eso se toman los mismos tiempos de referencia del cotizador.",
    faq: [
      ["¿Pueden integrar inteligencia artificial en mi empresa o producto?", "Sí. Desarrollamos asistentes de IA, generación de contenido y análisis con IA integrados a sistemas reales: por ejemplo EvaIA (asistente local con voz y visión), SIGI (en construcción; contenido con IA y aprobación humana) e IncubApp (operación industrial con IA)."],
      ["¿La IA publica o decide sola?", "No tiene por qué. Donde hace falta, el flujo se diseña con revisión humana: en SIGI nada se publica sin una aprobación manual."],
      ["¿Se puede usar IA sin enviar los datos a la nube?", "Sí, según el caso. EvaIA corre 100% en local: voz, respuesta hablada, visión por cámara y memoria en base de datos en el mismo equipo."],
      ["¿Qué modelos de IA usan?", "Modelos como Gemini en proyectos en la nube, como SIGI, e IA que corre en local cuando el proyecto lo requiere, como EvaIA."],
      ["¿Cuánto tarda integrar IA?", "Depende de dónde se integre: dentro de una aplicación web a la medida, {app}; en una automatización de procesos, {auto}. La cotización gratuita llega en menos de 24 horas."],
    ],
  },

  iot: {
    meta_title: "Electrónica, IoT y automatización en Medellín | CDH Maker",
    meta_desc: "Prototipos electrónicos, monitoreo con sensores, domótica y automatización con Arduino, ESP32 y Raspberry Pi para hogares, industria y agro, en Medellín.",
    name: "Electrónica, IoT y automatización",
    kicker: "// Electrónica e IoT",
    h1: "IoT y automatización en Medellín",
    lead: "Diseñamos y construimos sistemas electrónicos conectados con Arduino, ESP32 y Raspberry Pi: sensores que miden, alertas que avisan y control remoto para hogares, industria y agro. Del prototipo al producto funcional, con la carcasa y el software hechos en el mismo estudio.",
    inc: [
      ["Sistemas embebidos", "Desarrollo con Arduino, ESP32 y Raspberry Pi, desde la prueba de concepto hasta el producto funcional completo."],
      ["Monitoreo con sensores", "Medición, alertas y monitoreo remoto para hogares, industria y agro."],
      ["Domótica y automatización", "Automatización del hogar o del negocio con control remoto, para depender menos del trabajo manual."],
      ["Carcasas y piezas a medida", "La electrónica necesita dónde vivir: la carcasa se diseña y se fabrica en el mismo taller con impresión 3D, láser o CNC."],
      ["El software que lo acompaña", "La aplicación o la nube que recibe los datos la construye el mismo estudio: no tienes que coordinar tres proveedores distintos."],
    ],
    times: [
      ["Prototipo o prueba de concepto", "{proto}"],
      ["Producto funcional completo", "{product}"],
      ["Automatización del hogar o negocio", "{iotauto}"],
    ],
    times_note: "Con más de 10 sensores o módulos, el cotizador suma hasta una semana.",
    faq: [
      ["¿Con qué plataformas trabajan?", "En hardware, Arduino, ESP32 y Raspberry Pi. En software, JavaScript, Python, Firebase o Supabase, según el proyecto."],
      ["¿Cuánto tarda un proyecto IoT?", "Como referencia, un prototipo o prueba de concepto toma {proto}, un producto funcional completo {product} y una automatización del hogar o negocio {iotauto}."],
      ["¿Trabajan para industria y agro, o solo hogares?", "Para los tres: los sistemas de sensórica, automatización y monitoreo remoto se diseñan para hogares, industria y agro."],
      ["¿Cuánto cuesta un proyecto de electrónica o IoT?", "Cada proyecto se cotiza a la medida y gratis: cuéntanos qué quieres medir o automatizar y recibes precio y tiempos en menos de 24 horas, sin compromiso."],
      ["¿Qué pasa después de la entrega?", "Recibes documentación y acompañamiento posterior: resolvemos dudas, ajustamos detalles y te dejamos todo funcionando. La relación no termina con la entrega."],
    ],
  },
};
