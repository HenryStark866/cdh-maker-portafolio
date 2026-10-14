/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — estimator.js
   Cotizador instantáneo: preguntas rápidas → estimado de tiempos al instante.

   No hay backend ni base de datos: todo el cálculo corre en el navegador.
   Los números de fabricación digital (peso, tiempo, costo de material) salen
   de una formula real a partir de volumen/material — los rangos de tiempo de
   las otras líneas de servicio son estimaciones generales de experiencia.
   Ambos casos son "no vinculantes": el precio final siempre lo confirma
   Henry por WhatsApp.

   ── Constantes ajustables (§CONFIG) ──────────────────────────────────────
   Si cambian tus costos de filamento/resina o la velocidad de tu impresora,
   solo hay que tocar los números de PRICE/DENSITY más abajo.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ═════════════════════════ §CONFIG — ajustar aquí ═════════════════════════
  const DENSITY = { PLA: 1.24, PETG: 1.27, ABS: 1.04, TPU: 1.21, RESINA: 1.1 };
  const PRICE = {
    fdm_cop_por_g: { PLA: 90, PETG: 95, ABS: 90, TPU: 140 },
    resina_cop_por_ml: 250,
    fdm_cm3_por_hora: 15,      // volumen efectivo impreso por hora (calidad estándar)
    resina_cm_alto_por_hora: 3, // cm de altura curados por hora (SLA/DLP)
    laser_min_por_100cm2: { fina: 6, media: 10, gruesa: 18 }, // según espesor
    cnc_min_por_cm3: { simple: 1.4, detallada: 2.6 },
  };
  const TIME_WEB = {
    landing: { min: 1, max: 2 }, app: { min: 4, max: 10 }, auto: { min: 2, max: 5 },
  };
  const TIME_IOT = {
    proto: { min: 1, max: 2 }, product: { min: 3, max: 6 }, auto: { min: 2, max: 5 },
  };
  const TIME_DESIGN = {
    cad: { min: 2, max: 5 }, advice: { min: 1, max: 2 }, workshop: { min: 3, max: 7 },
  };
  // ════════════════════════════════════════════════════════════════════════

  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmtCOP = (n) => "$" + Math.round(n).toLocaleString("es-CO") + " COP";
  const fmtHoras = (h) => (h < 1 ? Math.round(h * 60) + " min" : h.toFixed(1).replace(/\.0$/, "") + " h");

  function L() {
    const l = (document.documentElement.lang || "es").slice(0, 2);
    return C[l] ? l : "es";
  }
  function tr(key) { return (C[L()] && C[L()][key]) || C.es[key] || key; }

  // ── Copys en los 10 idiomas del sitio (un idioma sin bloque cae a ES) ──────
  const C = {
    es: {
      title: "Cotizador instantáneo", subtitle: "Estimado automático de tiempos — no vinculante. La cotización final te la confirmo por WhatsApp en menos de 24 horas.",
      q_service: "¿Qué necesitas?",
      svc_web: "Web y software", svc_maker: "Fabricación digital", svc_iot: "Electrónica e IoT", svc_design: "Diseño y consultoría",
      q_web_type: "¿Qué tipo de proyecto es?",
      web_type_landing: "Landing page / sitio informativo", web_type_app: "Aplicación web a la medida", web_type_auto: "Automatización de procesos",
      q_web_design: "¿Ya tienes el diseño (UI) listo?",
      web_design_yes: "Sí, tengo diseño o referencia clara", web_design_no: "No, hay que diseñarlo desde cero",
      q_web_urgency: "¿Qué tan urgente es?",
      urgency_normal: "Sin afán", urgency_fast: "Lo necesito pronto",
      q_iot_type: "¿Qué tipo de proyecto?",
      iot_type_proto: "Prototipo / prueba de concepto", iot_type_product: "Producto funcional completo", iot_type_auto: "Automatización del hogar o negocio",
      q_iot_modules: "¿Cuántos sensores o módulos aprox.?",
      iot_modules_low: "1 a 3", iot_modules_mid: "4 a 10", iot_modules_high: "Más de 10",
      q_design_type: "¿Qué necesitas?",
      design_type_cad: "Diseño CAD de una pieza", design_type_advice: "Asesoría técnica puntual", design_type_workshop: "Capacitación o taller",
      q_maker_process: "¿Qué proceso necesitas?",
      proc_fdm: "Impresión 3D (FDM)", proc_resin: "Impresión 3D (Resina)", proc_laser: "Corte láser", proc_cnc: "Mecanizado CNC",
      f_largo: "Largo (cm)", f_ancho: "Ancho (cm)", f_alto: "Alto (cm)", f_material: "Material",
      f_relleno: "Relleno", f_cantidad: "Cantidad de piezas", f_espesor: "Espesor (mm)", f_area: "Área aproximada (cm²)",
      f_complejidad: "Complejidad",
      comp_simple: "Simple (formas rectas)", comp_detail: "Detallada (curvas, grabados)",
      back: "← Volver", restart: "↺ Empezar de nuevo", send_wa: "Enviar estos datos por WhatsApp",
      r_time: "Tiempo estimado", r_weight: "Peso estimado", r_cost: "Material estimado", r_units: "Piezas",
      result_lead: "Esto es lo que te puedo adelantar:",
      disclaimer_general: "Estimado automático a partir de respuestas generales — no incluye diseño, acabados ni mano de obra. Te confirmo el valor real por WhatsApp.",
      disclaimer_maker: "Cálculo automático a partir del volumen y material declarados — el valor final puede variar según acabado, soportes y post-procesado.",
      cta_urgent: "Cuéntame por WhatsApp que es urgente y vemos cómo priorizarlo.",
      u_weeks: "semanas", u_days: "días",
    },
    en: {
      title: "Instant estimate", subtitle: "Automatic time estimate — not binding. I confirm the final quote over WhatsApp within 24 hours.",
      q_service: "What do you need?",
      svc_web: "Web & software", svc_maker: "Digital fabrication", svc_iot: "Electronics & IoT", svc_design: "Design & consulting",
      q_web_type: "What type of project is it?",
      web_type_landing: "Landing page / informational site", web_type_app: "Custom web application", web_type_auto: "Process automation",
      q_web_design: "Do you already have the UI design ready?",
      web_design_yes: "Yes, I have a design or clear reference", web_design_no: "No, it needs to be designed from scratch",
      q_web_urgency: "How urgent is it?",
      urgency_normal: "No rush", urgency_fast: "I need it soon",
      q_iot_type: "What type of project?",
      iot_type_proto: "Prototype / proof of concept", iot_type_product: "Full working product", iot_type_auto: "Home or business automation",
      q_iot_modules: "Roughly how many sensors or modules?",
      iot_modules_low: "1 to 3", iot_modules_mid: "4 to 10", iot_modules_high: "More than 10",
      q_design_type: "What do you need?",
      design_type_cad: "CAD design of a part", design_type_advice: "One-off technical advice", design_type_workshop: "Training or workshop",
      q_maker_process: "Which process do you need?",
      proc_fdm: "3D printing (FDM)", proc_resin: "3D printing (Resin)", proc_laser: "Laser cutting", proc_cnc: "CNC machining",
      f_largo: "Length (cm)", f_ancho: "Width (cm)", f_alto: "Height (cm)", f_material: "Material",
      f_relleno: "Infill", f_cantidad: "Number of pieces", f_espesor: "Thickness (mm)", f_area: "Approx. area (cm²)",
      f_complejidad: "Complexity",
      comp_simple: "Simple (straight shapes)", comp_detail: "Detailed (curves, engraving)",
      back: "← Back", restart: "↺ Start over", send_wa: "Send this via WhatsApp",
      r_time: "Estimated time", r_weight: "Estimated weight", r_cost: "Estimated material", r_units: "Pieces",
      result_lead: "Here's what I can tell you right away:",
      disclaimer_general: "Automatic estimate from general answers — doesn't include design, finishing or labor. I'll confirm the real value over WhatsApp.",
      disclaimer_maker: "Automatic calculation from the declared volume and material — the final value may vary with finish, supports and post-processing.",
      cta_urgent: "Tell me on WhatsApp that it's urgent and we'll see how to prioritize it.",
      u_weeks: "weeks", u_days: "days",
    },
    zh: {
      title: "即时报价",
      subtitle: "自动估算工期——不具约束力。最终报价我会在 24 小时内通过 WhatsApp 向你确认。",
      q_service: "你需要什么？",
      svc_web: "网站与软件",
      svc_maker: "数字制造",
      svc_iot: "电子与物联网",
      svc_design: "设计与咨询",
      q_web_type: "这是什么类型的项目？",
      web_type_landing: "落地页 / 展示型网站",
      web_type_app: "定制网页应用",
      web_type_auto: "流程自动化",
      q_web_design: "你已经有现成的设计（UI）了吗？",
      web_design_yes: "有，我有设计稿或明确的参考",
      web_design_no: "没有，需要从零开始设计",
      q_web_urgency: "有多紧急？",
      urgency_normal: "不着急",
      urgency_fast: "我需要尽快完成",
      q_iot_type: "什么类型的项目？",
      iot_type_proto: "原型 / 概念验证",
      iot_type_product: "完整可用的产品",
      iot_type_auto: "家庭或企业自动化",
      q_iot_modules: "大约需要多少个传感器或模块？",
      iot_modules_low: "1 到 3 个",
      iot_modules_mid: "4 到 10 个",
      iot_modules_high: "超过 10 个",
      q_design_type: "你需要什么？",
      design_type_cad: "零件 CAD 设计",
      design_type_advice: "单次技术咨询",
      design_type_workshop: "培训或工作坊",
      q_maker_process: "你需要哪种工艺？",
      proc_fdm: "3D 打印（FDM）",
      proc_resin: "3D 打印（树脂）",
      proc_laser: "激光切割",
      proc_cnc: "CNC 加工",
      f_largo: "长度（cm）",
      f_ancho: "宽度（cm）",
      f_alto: "高度（cm）",
      f_material: "材料",
      f_relleno: "填充率",
      f_cantidad: "零件数量",
      f_espesor: "厚度（mm）",
      f_area: "大致面积（cm²）",
      f_complejidad: "复杂度",
      comp_simple: "简单（直线形状）",
      comp_detail: "精细（曲线、雕刻）",
      back: "← 返回",
      restart: "↺ 重新开始",
      send_wa: "通过 WhatsApp 发送这些信息",
      r_time: "预计时间",
      r_weight: "预计重量",
      r_cost: "预计材料费",
      r_units: "零件数",
      result_lead: "以下是我现在就能告诉你的：",
      disclaimer_general: "根据一般性回答自动估算——不包括设计、表面处理和人工费用。实际价格我会通过 WhatsApp 向你确认。",
      disclaimer_maker: "根据所填体积与材料自动计算——最终价格可能因表面处理、支撑和后处理而有所不同。",
      cta_urgent: "在 WhatsApp 上告诉我这很紧急，我们一起看看如何优先安排。",
      u_weeks: "周",
      u_days: "天",
    },
    hi: {
      title: "तुरंत अनुमान",
      subtitle: "समय का स्वचालित अनुमान — बाध्यकारी नहीं। अंतिम कोटेशन की पुष्टि मैं 24 घंटे से कम समय में WhatsApp पर करता हूँ।",
      q_service: "आपको क्या चाहिए?",
      svc_web: "वेब और सॉफ़्टवेयर",
      svc_maker: "डिजिटल निर्माण",
      svc_iot: "इलेक्ट्रॉनिक्स और IoT",
      svc_design: "डिज़ाइन और सलाह",
      q_web_type: "यह किस तरह का प्रोजेक्ट है?",
      web_type_landing: "लैंडिंग पेज / सूचनात्मक साइट",
      web_type_app: "कस्टम वेब ऐप्लिकेशन",
      web_type_auto: "प्रक्रिया स्वचालन",
      q_web_design: "क्या आपका डिज़ाइन (UI) पहले से तैयार है?",
      web_design_yes: "हाँ, मेरे पास डिज़ाइन या स्पष्ट संदर्भ है",
      web_design_no: "नहीं, इसे शुरू से डिज़ाइन करना होगा",
      q_web_urgency: "आपको यह कितनी जल्दी चाहिए?",
      urgency_normal: "कोई जल्दी नहीं",
      urgency_fast: "मुझे यह जल्द चाहिए",
      q_iot_type: "किस तरह का प्रोजेक्ट?",
      iot_type_proto: "प्रोटोटाइप / प्रूफ़ ऑफ़ कॉन्सेप्ट",
      iot_type_product: "पूरी तरह काम करने वाला उत्पाद",
      iot_type_auto: "घर या व्यवसाय का स्वचालन",
      q_iot_modules: "लगभग कितने सेंसर या मॉड्यूल?",
      iot_modules_low: "1 से 3",
      iot_modules_mid: "4 से 10",
      iot_modules_high: "10 से ज़्यादा",
      q_design_type: "आपको क्या चाहिए?",
      design_type_cad: "किसी पुर्ज़े का CAD डिज़ाइन",
      design_type_advice: "एक बार की तकनीकी सलाह",
      design_type_workshop: "प्रशिक्षण या कार्यशाला",
      q_maker_process: "आपको कौन-सी प्रक्रिया चाहिए?",
      proc_fdm: "3D प्रिंटिंग (FDM)",
      proc_resin: "3D प्रिंटिंग (रेज़िन)",
      proc_laser: "लेज़र कटिंग",
      proc_cnc: "CNC मशीनिंग",
      f_largo: "लंबाई (cm)",
      f_ancho: "चौड़ाई (cm)",
      f_alto: "ऊँचाई (cm)",
      f_material: "सामग्री",
      f_relleno: "इनफ़िल",
      f_cantidad: "पुर्ज़ों की संख्या",
      f_espesor: "मोटाई (mm)",
      f_area: "अनुमानित क्षेत्रफल (cm²)",
      f_complejidad: "जटिलता",
      comp_simple: "सरल (सीधी आकृतियाँ)",
      comp_detail: "विस्तृत (वक्र, उत्कीर्णन)",
      back: "← वापस",
      restart: "↺ फिर से शुरू करें",
      send_wa: "यह जानकारी WhatsApp पर भेजें",
      r_time: "अनुमानित समय",
      r_weight: "अनुमानित वज़न",
      r_cost: "अनुमानित सामग्री",
      r_units: "पुर्ज़े",
      result_lead: "अभी मैं आपको इतना बता सकता हूँ:",
      disclaimer_general: "सामान्य जवाबों पर आधारित स्वचालित अनुमान — इसमें डिज़ाइन, फ़िनिशिंग या श्रम शामिल नहीं है। वास्तविक मूल्य की पुष्टि मैं WhatsApp पर करूँगा।",
      disclaimer_maker: "बताए गए आयतन और सामग्री से स्वचालित गणना — अंतिम मूल्य फ़िनिशिंग, सपोर्ट और पोस्ट-प्रोसेसिंग के अनुसार बदल सकता है।",
      cta_urgent: "WhatsApp पर बताइए कि आपको जल्दी है, और हम देखेंगे कि इसे प्राथमिकता कैसे दी जाए।",
      u_weeks: "हफ़्ते",
      u_days: "दिन",
    },
    ar: {
      title: "عرض سعر فوري",
      subtitle: "تقدير تلقائي للمدة — غير ملزم. أؤكد لك عرض السعر النهائي عبر WhatsApp خلال أقل من 24 ساعة.",
      q_service: "ماذا تحتاج؟",
      svc_web: "الويب والبرمجيات",
      svc_maker: "التصنيع الرقمي",
      svc_iot: "الإلكترونيات وإنترنت الأشياء",
      svc_design: "التصميم والاستشارات",
      q_web_type: "ما نوع المشروع؟",
      web_type_landing: "صفحة هبوط / موقع تعريفي",
      web_type_app: "تطبيق ويب مخصّص",
      web_type_auto: "أتمتة العمليات",
      q_web_design: "هل لديك تصميم الواجهة (UI) جاهزًا؟",
      web_design_yes: "نعم، لديّ تصميم أو مرجع واضح",
      web_design_no: "لا، يجب تصميمه من الصفر",
      q_web_urgency: "ما مدى الاستعجال؟",
      urgency_normal: "دون استعجال",
      urgency_fast: "أحتاجه قريبًا",
      q_iot_type: "ما نوع المشروع؟",
      iot_type_proto: "نموذج أولي / إثبات مفهوم",
      iot_type_product: "منتج متكامل وجاهز للعمل",
      iot_type_auto: "أتمتة المنزل أو النشاط التجاري",
      q_iot_modules: "كم عدد المستشعرات أو الوحدات تقريبًا؟",
      iot_modules_low: "من 1 إلى 3",
      iot_modules_mid: "من 4 إلى 10",
      iot_modules_high: "أكثر من 10",
      q_design_type: "ماذا تحتاج؟",
      design_type_cad: "تصميم CAD لقطعة",
      design_type_advice: "استشارة تقنية محددة",
      design_type_workshop: "تدريب أو ورشة عمل",
      q_maker_process: "ما العملية التي تحتاجها؟",
      proc_fdm: "طباعة ثلاثية الأبعاد (FDM)",
      proc_resin: "طباعة ثلاثية الأبعاد (راتنج)",
      proc_laser: "القطع بالليزر",
      proc_cnc: "تصنيع CNC",
      f_largo: "الطول (cm)",
      f_ancho: "العرض (cm)",
      f_alto: "الارتفاع (cm)",
      f_material: "المادة",
      f_relleno: "نسبة الحشو",
      f_cantidad: "عدد القطع",
      f_espesor: "السُّمك (mm)",
      f_area: "المساحة التقريبية (cm²)",
      f_complejidad: "درجة التعقيد",
      comp_simple: "بسيط (أشكال مستقيمة)",
      comp_detail: "مفصّل (منحنيات، نقوش)",
      back: "← رجوع",
      restart: "↺ البدء من جديد",
      send_wa: "إرسال هذه البيانات عبر WhatsApp",
      r_time: "الوقت المقدّر",
      r_weight: "الوزن المقدّر",
      r_cost: "تكلفة المواد التقديرية",
      r_units: "القطع",
      result_lead: "هذا ما يمكنني أن أخبرك به مسبقًا:",
      disclaimer_general: "تقدير تلقائي بناءً على إجابات عامة — لا يشمل التصميم ولا التشطيبات ولا اليد العاملة. أؤكد لك القيمة الفعلية عبر WhatsApp.",
      disclaimer_maker: "حساب تلقائي بناءً على الحجم والمادة اللذين أدخلتهما — قد تختلف القيمة النهائية حسب التشطيب والدعامات والمعالجة اللاحقة.",
      cta_urgent: "أخبرني عبر WhatsApp أن الأمر عاجل وسنرى كيف نمنحه الأولوية.",
      u_weeks: "أسابيع",
      u_days: "أيام",
    },
    pt: {
      title: "Cotação instantânea",
      subtitle: "Estimativa automática de prazos — não vinculante. Confirmo a cotação final pelo WhatsApp em menos de 24 horas.",
      q_service: "Do que você precisa?",
      svc_web: "Web e software",
      svc_maker: "Fabricação digital",
      svc_iot: "Eletrônica e IoT",
      svc_design: "Design e consultoria",
      q_web_type: "Que tipo de projeto é?",
      web_type_landing: "Landing page / site institucional",
      web_type_app: "Aplicação web sob medida",
      web_type_auto: "Automação de processos",
      q_web_design: "Você já tem o design (UI) pronto?",
      web_design_yes: "Sim, tenho o design ou uma referência clara",
      web_design_no: "Não, precisa ser criado do zero",
      q_web_urgency: "Qual é a urgência?",
      urgency_normal: "Sem pressa",
      urgency_fast: "Preciso logo",
      q_iot_type: "Que tipo de projeto?",
      iot_type_proto: "Protótipo / prova de conceito",
      iot_type_product: "Produto funcional completo",
      iot_type_auto: "Automação residencial ou comercial",
      q_iot_modules: "Quantos sensores ou módulos, aproximadamente?",
      iot_modules_low: "1 a 3",
      iot_modules_mid: "4 a 10",
      iot_modules_high: "Mais de 10",
      q_design_type: "Do que você precisa?",
      design_type_cad: "Design CAD de uma peça",
      design_type_advice: "Assessoria técnica pontual",
      design_type_workshop: "Formação ou oficina",
      q_maker_process: "De qual processo você precisa?",
      proc_fdm: "Impressão 3D (FDM)",
      proc_resin: "Impressão 3D (Resina)",
      proc_laser: "Corte a laser",
      proc_cnc: "Usinagem CNC",
      f_largo: "Comprimento (cm)",
      f_ancho: "Largura (cm)",
      f_alto: "Altura (cm)",
      f_material: "Material",
      f_relleno: "Preenchimento",
      f_cantidad: "Quantidade de peças",
      f_espesor: "Espessura (mm)",
      f_area: "Área aproximada (cm²)",
      f_complejidad: "Complexidade",
      comp_simple: "Simples (formas retas)",
      comp_detail: "Detalhada (curvas, gravações)",
      back: "← Voltar",
      restart: "↺ Começar de novo",
      send_wa: "Enviar estes dados pelo WhatsApp",
      r_time: "Tempo estimado",
      r_weight: "Peso estimado",
      r_cost: "Material estimado",
      r_units: "Peças",
      result_lead: "Veja o que já posso adiantar:",
      disclaimer_general: "Estimativa automática a partir de respostas gerais — não inclui design, acabamentos nem mão de obra. Confirmo o valor real pelo WhatsApp.",
      disclaimer_maker: "Cálculo automático a partir do volume e do material informados — o valor final pode variar conforme o acabamento, os suportes e o pós-processamento.",
      cta_urgent: "Conte-me pelo WhatsApp que é urgente e vemos como priorizá-lo.",
      u_weeks: "semanas",
      u_days: "dias",
    },
    bn: {
      title: "তাৎক্ষণিক কোটেশন",
      subtitle: "সময়ের স্বয়ংক্রিয় আনুমানিক হিসাব — কোনো বাধ্যবাধকতা নেই। চূড়ান্ত কোটেশন আমি 24 ঘণ্টার মধ্যে WhatsApp-এ নিশ্চিত করব।",
      q_service: "আপনার কী দরকার?",
      svc_web: "ওয়েব ও সফটওয়্যার",
      svc_maker: "ডিজিটাল নির্মাণ",
      svc_iot: "ইলেকট্রনিক্স ও IoT",
      svc_design: "ডিজাইন ও পরামর্শ",
      q_web_type: "এটি কোন ধরনের প্রকল্প?",
      web_type_landing: "ল্যান্ডিং পেজ / তথ্যমূলক সাইট",
      web_type_app: "কাস্টম ওয়েব অ্যাপ্লিকেশন",
      web_type_auto: "প্রক্রিয়া স্বয়ংক্রিয়করণ",
      q_web_design: "আপনার কি ডিজাইন (UI) আগে থেকেই তৈরি আছে?",
      web_design_yes: "হ্যাঁ, আমার কাছে ডিজাইন বা স্পষ্ট রেফারেন্স আছে",
      web_design_no: "না, শূন্য থেকে ডিজাইন করতে হবে",
      q_web_urgency: "এটি কতটা জরুরি?",
      urgency_normal: "তাড়া নেই",
      urgency_fast: "আমার শিগগিরই দরকার",
      q_iot_type: "কোন ধরনের প্রকল্প?",
      iot_type_proto: "প্রোটোটাইপ / প্রুফ অব কনসেপ্ট",
      iot_type_product: "সম্পূর্ণ কার্যকর পণ্য",
      iot_type_auto: "বাড়ি বা ব্যবসার স্বয়ংক্রিয়করণ",
      q_iot_modules: "আনুমানিক কতগুলো সেন্সর বা মডিউল?",
      iot_modules_low: "1 থেকে 3",
      iot_modules_mid: "4 থেকে 10",
      iot_modules_high: "10-এর বেশি",
      q_design_type: "আপনার কী দরকার?",
      design_type_cad: "একটি যন্ত্রাংশের CAD ডিজাইন",
      design_type_advice: "নির্দিষ্ট বিষয়ে প্রযুক্তিগত পরামর্শ",
      design_type_workshop: "প্রশিক্ষণ বা কর্মশালা",
      q_maker_process: "আপনার কোন প্রক্রিয়া দরকার?",
      proc_fdm: "3D প্রিন্টিং (FDM)",
      proc_resin: "3D প্রিন্টিং (রেজিন)",
      proc_laser: "লেজার কাটিং",
      proc_cnc: "CNC মেশিনিং",
      f_largo: "দৈর্ঘ্য (cm)",
      f_ancho: "প্রস্থ (cm)",
      f_alto: "উচ্চতা (cm)",
      f_material: "উপাদান",
      f_relleno: "ইনফিল",
      f_cantidad: "যন্ত্রাংশের সংখ্যা",
      f_espesor: "পুরুত্ব (mm)",
      f_area: "আনুমানিক ক্ষেত্রফল (cm²)",
      f_complejidad: "জটিলতা",
      comp_simple: "সরল (সোজা আকৃতি)",
      comp_detail: "সূক্ষ্ম নকশা (বক্ররেখা, খোদাই)",
      back: "← ফিরে যান",
      restart: "↺ আবার শুরু করুন",
      send_wa: "এই তথ্য WhatsApp-এ পাঠান",
      r_time: "আনুমানিক সময়",
      r_weight: "আনুমানিক ওজন",
      r_cost: "আনুমানিক উপাদান খরচ",
      r_units: "যন্ত্রাংশ",
      result_lead: "এখনই আমি আপনাকে যা জানাতে পারি:",
      disclaimer_general: "সাধারণ উত্তরের ভিত্তিতে স্বয়ংক্রিয় আনুমানিক হিসাব — এতে ডিজাইন, ফিনিশিং বা শ্রমের খরচ অন্তর্ভুক্ত নয়। প্রকৃত মূল্য আমি WhatsApp-এ নিশ্চিত করব।",
      disclaimer_maker: "আপনার দেওয়া আয়তন ও উপাদানের ভিত্তিতে স্বয়ংক্রিয় হিসাব — ফিনিশিং, সাপোর্ট ও পোস্ট-প্রসেসিং অনুযায়ী চূড়ান্ত মূল্য বদলাতে পারে।",
      cta_urgent: "WhatsApp-এ আমাকে জানান যে এটি জরুরি, আমরা দেখব কীভাবে অগ্রাধিকার দেওয়া যায়।",
      u_weeks: "সপ্তাহ",
      u_days: "দিন",
    },
    ru: {
      title: "Мгновенный расчёт",
      subtitle: "Автоматическая оценка сроков — ни к чему не обязывает. Окончательную смету я подтвержу в WhatsApp в течение 24 часов.",
      q_service: "Что вам нужно?",
      svc_web: "Веб и ПО",
      svc_maker: "Цифровое производство",
      svc_iot: "Электроника и IoT",
      svc_design: "Дизайн и консультации",
      q_web_type: "Какой у вас проект?",
      web_type_landing: "Лендинг / информационный сайт",
      web_type_app: "Веб-приложение под заказ",
      web_type_auto: "Автоматизация процессов",
      q_web_design: "У вас уже есть готовый дизайн (UI)?",
      web_design_yes: "Да, есть дизайн или чёткий референс",
      web_design_no: "Нет, нужно разработать с нуля",
      q_web_urgency: "Насколько это срочно?",
      urgency_normal: "Не спешу",
      urgency_fast: "Нужно в ближайшее время",
      q_iot_type: "Какой тип проекта?",
      iot_type_proto: "Прототип / проверка концепции",
      iot_type_product: "Полнофункциональный продукт",
      iot_type_auto: "Автоматизация дома или бизнеса",
      q_iot_modules: "Сколько примерно датчиков или модулей?",
      iot_modules_low: "От 1 до 3",
      iot_modules_mid: "От 4 до 10",
      iot_modules_high: "Больше 10",
      q_design_type: "Что вам нужно?",
      design_type_cad: "CAD-дизайн детали",
      design_type_advice: "Разовая техническая консультация",
      design_type_workshop: "Обучение или воркшоп",
      q_maker_process: "Какой процесс вам нужен?",
      proc_fdm: "3D-печать (FDM)",
      proc_resin: "3D-печать (смола)",
      proc_laser: "Лазерная резка",
      proc_cnc: "Обработка на ЧПУ (CNC)",
      f_largo: "Длина (cm)",
      f_ancho: "Ширина (cm)",
      f_alto: "Высота (cm)",
      f_material: "Материал",
      f_relleno: "Заполнение",
      f_cantidad: "Количество деталей",
      f_espesor: "Толщина (mm)",
      f_area: "Примерная площадь (cm²)",
      f_complejidad: "Сложность",
      comp_simple: "Простая (прямые линии)",
      comp_detail: "Детализированная (кривые, гравировка)",
      back: "← Назад",
      restart: "↺ Начать заново",
      send_wa: "Отправить эти данные в WhatsApp",
      r_time: "Расчётное время",
      r_weight: "Расчётный вес",
      r_cost: "Расчётная стоимость материала",
      r_units: "Кол-во деталей",
      result_lead: "Вот что я могу сказать уже сейчас:",
      disclaimer_general: "Автоматическая оценка на основе общих ответов — не включает дизайн, финишную обработку и стоимость работ. Реальную стоимость подтвержу в WhatsApp.",
      disclaimer_maker: "Автоматический расчёт по указанным объёму и материалу — итоговое значение может меняться в зависимости от отделки, поддержек и постобработки.",
      cta_urgent: "Напишите мне в WhatsApp, что дело срочное, — и мы решим, как взять его в работу в приоритетном порядке.",
      u_weeks: "нед.",
      u_days: "дн.",
    },
    fr: {
      title: "Devis instantané",
      subtitle: "Estimation automatique des délais — non contractuelle. Je vous confirme le devis final par WhatsApp en moins de 24 heures.",
      q_service: "De quoi avez-vous besoin ?",
      svc_web: "Web et logiciel",
      svc_maker: "Fabrication numérique",
      svc_iot: "Électronique et IoT",
      svc_design: "Design et conseil",
      q_web_type: "De quel type de projet s'agit-il ?",
      web_type_landing: "Landing page / site vitrine",
      web_type_app: "Application web sur mesure",
      web_type_auto: "Automatisation des processus",
      q_web_design: "Votre design (UI) est-il déjà prêt ?",
      web_design_yes: "Oui, j'ai un design ou une référence claire",
      web_design_no: "Non, il faut le concevoir de zéro",
      q_web_urgency: "Quelle est l'urgence ?",
      urgency_normal: "Sans urgence",
      urgency_fast: "J'en ai besoin rapidement",
      q_iot_type: "Quel type de projet ?",
      iot_type_proto: "Prototype / preuve de concept",
      iot_type_product: "Produit fonctionnel complet",
      iot_type_auto: "Automatisation de la maison ou de l'entreprise",
      q_iot_modules: "Combien de capteurs ou de modules, environ ?",
      iot_modules_low: "1 à 3",
      iot_modules_mid: "4 à 10",
      iot_modules_high: "Plus de 10",
      q_design_type: "De quoi avez-vous besoin ?",
      design_type_cad: "Conception CAO d'une pièce",
      design_type_advice: "Conseil technique ponctuel",
      design_type_workshop: "Formation ou atelier",
      q_maker_process: "De quel procédé avez-vous besoin ?",
      proc_fdm: "Impression 3D (FDM)",
      proc_resin: "Impression 3D (résine)",
      proc_laser: "Découpe laser",
      proc_cnc: "Usinage CNC",
      f_largo: "Longueur (cm)",
      f_ancho: "Largeur (cm)",
      f_alto: "Hauteur (cm)",
      f_material: "Matériau",
      f_relleno: "Remplissage",
      f_cantidad: "Nombre de pièces",
      f_espesor: "Épaisseur (mm)",
      f_area: "Surface approximative (cm²)",
      f_complejidad: "Complexité",
      comp_simple: "Simple (formes rectilignes)",
      comp_detail: "Détaillée (courbes, gravures)",
      back: "← Retour",
      restart: "↺ Recommencer",
      send_wa: "Envoyer ces informations par WhatsApp",
      r_time: "Temps estimé",
      r_weight: "Poids estimé",
      r_cost: "Coût matière estimé",
      r_units: "Pièces",
      result_lead: "Voici ce que je peux déjà vous indiquer :",
      disclaimer_general: "Estimation automatique à partir de réponses générales — n'inclut ni la conception, ni les finitions, ni la main-d'œuvre. Je vous confirme le montant réel par WhatsApp.",
      disclaimer_maker: "Calcul automatique à partir du volume et du matériau indiqués — le montant final peut varier selon la finition, les supports et le post-traitement.",
      cta_urgent: "Dites-moi sur WhatsApp que c'est urgent et nous verrons comment le prioriser.",
      u_weeks: "semaines",
      u_days: "jours",
    },
    id: {
      title: "Estimasi instan",
      subtitle: "Estimasi waktu otomatis — tidak mengikat. Penawaran final akan saya konfirmasi lewat WhatsApp dalam waktu kurang dari 24 jam.",
      q_service: "Apa yang Anda butuhkan?",
      svc_web: "Web & perangkat lunak",
      svc_maker: "Fabrikasi digital",
      svc_iot: "Elektronika & IoT",
      svc_design: "Desain & konsultasi",
      q_web_type: "Jenis proyek apa ini?",
      web_type_landing: "Landing page / situs informasi",
      web_type_app: "Aplikasi web khusus",
      web_type_auto: "Otomatisasi proses",
      q_web_design: "Apakah desain (UI) Anda sudah siap?",
      web_design_yes: "Ya, saya punya desain atau referensi yang jelas",
      web_design_no: "Belum, perlu didesain dari nol",
      q_web_urgency: "Seberapa mendesak?",
      urgency_normal: "Tidak terburu-buru",
      urgency_fast: "Saya butuh segera",
      q_iot_type: "Jenis proyek apa?",
      iot_type_proto: "Prototipe / bukti konsep",
      iot_type_product: "Produk fungsional lengkap",
      iot_type_auto: "Otomatisasi rumah atau bisnis",
      q_iot_modules: "Kira-kira berapa sensor atau modul?",
      iot_modules_low: "1 sampai 3",
      iot_modules_mid: "4 sampai 10",
      iot_modules_high: "Lebih dari 10",
      q_design_type: "Apa yang Anda butuhkan?",
      design_type_cad: "Desain CAD untuk satu komponen",
      design_type_advice: "Konsultasi teknis satu kali",
      design_type_workshop: "Pelatihan atau workshop",
      q_maker_process: "Proses apa yang Anda butuhkan?",
      proc_fdm: "Cetak 3D (FDM)",
      proc_resin: "Cetak 3D (Resin)",
      proc_laser: "Potong laser",
      proc_cnc: "Pemesinan CNC",
      f_largo: "Panjang (cm)",
      f_ancho: "Lebar (cm)",
      f_alto: "Tinggi (cm)",
      f_material: "Material",
      f_relleno: "Infill",
      f_cantidad: "Jumlah unit",
      f_espesor: "Ketebalan (mm)",
      f_area: "Perkiraan luas (cm²)",
      f_complejidad: "Kompleksitas",
      comp_simple: "Sederhana (bentuk lurus)",
      comp_detail: "Detail (lengkungan, ukiran)",
      back: "← Kembali",
      restart: "↺ Mulai ulang",
      send_wa: "Kirim data ini lewat WhatsApp",
      r_time: "Perkiraan waktu",
      r_weight: "Perkiraan berat",
      r_cost: "Perkiraan material",
      r_units: "Unit",
      result_lead: "Ini yang bisa saya sampaikan sekarang:",
      disclaimer_general: "Estimasi otomatis berdasarkan jawaban umum — belum termasuk desain, finishing, dan tenaga kerja. Harga sebenarnya akan saya konfirmasi lewat WhatsApp.",
      disclaimer_maker: "Perhitungan otomatis berdasarkan volume dan material yang dimasukkan — nilai akhir bisa berbeda tergantung finishing, support, dan pascaproses.",
      cta_urgent: "Beri tahu saya lewat WhatsApp bahwa ini mendesak, dan kita lihat cara memprioritaskannya.",
      u_weeks: "minggu",
      u_days: "hari",
    },
  };

  // ── Estado del asistente ───────────────────────────────────────────────
  let state = { screen: "service", service: null, answers: {} };
  let root, modal, body;

  function ensureDom() {
    if (root) return;
    root = document.createElement("div");
    root.id = "cdh-estimator";
    root.innerHTML = `
      <div class="tool-modal" id="estimatorModal" hidden>
        <div class="tool-modal-card">
          <button type="button" class="tool-modal-close" aria-label="Cerrar">✕</button>
          <div class="tool-modal-body" id="estimatorBody"></div>
        </div>
      </div>`;
    document.body.appendChild(root);
    modal = document.getElementById("estimatorModal");
    body = document.getElementById("estimatorBody");
    modal.querySelector(".tool-modal-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  }

  function open() {
    ensureDom();
    state = { screen: "service", service: null, answers: {} };
    modal.hidden = false;
    document.body.classList.add("tool-modal-open");
    render();
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove("tool-modal-open");
  }

  // Abre directo en el formulario de impresión 3D con dimensiones precargadas
  // (lo usa el Visor 3D cuando el visitante quiere cotizar la pieza que subió)
  function openMakerWithDimensions(dims) {
    ensureDom();
    state = {
      screen: "maker-form", service: "maker",
      answers: { proceso: "fdm", largo: dims.largo, ancho: dims.ancho, alto: dims.alto, material: "PLA", relleno: 20, cantidad: 1 },
    };
    modal.hidden = false;
    document.body.classList.add("tool-modal-open");
    render();
  }

  // ── Construcción de una pantalla de pregunta única (estilo quiz) ────────
  function progressDots(n, of) {
    let html = '<div class="est-progress">';
    for (let i = 0; i < of; i++) html += `<span class="${i < n ? "done" : ""}"></span>`;
    return html + "</div>";
  }

  function optionButton(label, icon, onClick) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "est-option";
    b.innerHTML = (icon || "") + `<span>${esc(label)}</span>`;
    b.addEventListener("click", onClick);
    return b;
  }

  function backButton(to) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "est-back";
    b.textContent = tr("back");
    b.addEventListener("click", () => { state.screen = to; render(); });
    return b;
  }

  // ── Pantallas ────────────────────────────────────────────────────────────
  function screenService() {
    body.innerHTML = `<h2>${esc(tr("title"))}</h2><p class="tool-sub">${esc(tr("subtitle"))}</p>${progressDots(0, 4)}<div class="est-q">${esc(tr("q_service"))}</div><div class="est-options" id="estOpts"></div>`;
    const wrap = document.getElementById("estOpts");
    const svcs = [
      ["web", "svc_web", ICON.web], ["maker", "svc_maker", ICON.maker],
      ["iot", "svc_iot", ICON.iot], ["design", "svc_design", ICON.design],
    ];
    svcs.forEach(([key, labelKey, icon]) => {
      wrap.appendChild(optionButton(tr(labelKey), icon, () => {
        state.service = key; state.answers = {};
        state.screen = key === "maker" ? "maker-process" : key + "-q1";
        render();
      }));
    });
  }

  // Genera una pantalla de pregunta simple con opciones (para web/iot/design)
  function quizScreen(cfg) {
    body.innerHTML = `<h2>${esc(tr("title"))}</h2>${progressDots(cfg.step, cfg.of)}<div class="est-q">${esc(tr(cfg.qKey))}</div><div class="est-options" id="estOpts"></div>`;
    body.insertBefore(backButton(cfg.backTo), body.children[1]);
    const wrap = document.getElementById("estOpts");
    cfg.options.forEach(([key, labelKey]) => {
      wrap.appendChild(optionButton(tr(labelKey), "", () => {
        state.answers[cfg.field] = key;
        cfg.onPick(key);
        render();
      }));
    });
  }

  function screenWeb1() {
    quizScreen({
      step: 1, of: 4, qKey: "q_web_type", field: "tipo", backTo: "service",
      options: [["landing", "web_type_landing"], ["app", "web_type_app"], ["auto", "web_type_auto"]],
      onPick: () => { state.screen = "web-q2"; },
    });
  }
  function screenWeb2() {
    quizScreen({
      step: 2, of: 4, qKey: "q_web_design", field: "diseno", backTo: "web-q1",
      options: [["si", "web_design_yes"], ["no", "web_design_no"]],
      onPick: () => { state.screen = "web-q3"; },
    });
  }
  function screenWeb3() {
    quizScreen({
      step: 3, of: 4, qKey: "q_web_urgency", field: "urgencia", backTo: "web-q2",
      options: [["normal", "urgency_normal"], ["rapido", "urgency_fast"]],
      onPick: () => { state.screen = "result"; },
    });
  }

  function screenIot1() {
    quizScreen({
      step: 1, of: 3, qKey: "q_iot_type", field: "tipo", backTo: "service",
      options: [["proto", "iot_type_proto"], ["product", "iot_type_product"], ["auto", "iot_type_auto"]],
      onPick: () => { state.screen = "iot-q2"; },
    });
  }
  function screenIot2() {
    quizScreen({
      step: 2, of: 3, qKey: "q_iot_modules", field: "modulos", backTo: "iot-q1",
      options: [["low", "iot_modules_low"], ["mid", "iot_modules_mid"], ["high", "iot_modules_high"]],
      onPick: () => { state.screen = "result"; },
    });
  }

  function screenDesign1() {
    quizScreen({
      step: 1, of: 2, qKey: "q_design_type", field: "tipo", backTo: "service",
      options: [["cad", "design_type_cad"], ["advice", "design_type_advice"], ["workshop", "design_type_workshop"]],
      onPick: () => { state.screen = "result"; },
    });
  }

  function screenMakerProcess() {
    quizScreen({
      step: 1, of: 2, qKey: "q_maker_process", field: "proceso", backTo: "service",
      options: [["fdm", "proc_fdm"], ["resin", "proc_resin"], ["laser", "proc_laser"], ["cnc", "proc_cnc"]],
      onPick: () => { state.screen = "maker-form"; },
    });
  }

  // ── Formulario de fabricación digital (con cálculo en vivo) ────────────
  function screenMakerForm() {
    const proc = state.answers.proceso;
    const a = state.answers;
    let fieldsHtml = "";

    if (proc === "fdm" || proc === "resin") {
      const materials = proc === "fdm" ? ["PLA", "PETG", "ABS", "TPU"] : ["RESINA"];
      fieldsHtml = `
        <div class="est-row">
          <div class="est-field"><label>${esc(tr("f_largo"))}</label><input type="number" min="0.1" step="0.1" id="fLargo" value="${a.largo ?? 10}"></div>
          <div class="est-field"><label>${esc(tr("f_ancho"))}</label><input type="number" min="0.1" step="0.1" id="fAncho" value="${a.ancho ?? 10}"></div>
          <div class="est-field"><label>${esc(tr("f_alto"))}</label><input type="number" min="0.1" step="0.1" id="fAlto" value="${a.alto ?? 10}"></div>
        </div>
        <div class="est-field"><label>${esc(tr("f_material"))}</label>
          <select id="fMaterial">${materials.map((m) => `<option value="${m}" ${a.material === m ? "selected" : ""}>${m === "RESINA" ? "Resina estándar" : m}</option>`).join("")}</select>
        </div>
        ${proc === "fdm" ? `<div class="est-field"><label>${esc(tr("f_relleno"))}: <strong id="fRellenoVal">${a.relleno ?? 20}%</strong></label><input type="range" min="5" max="100" step="5" id="fRelleno" value="${a.relleno ?? 20}"></div>` : ""}
        <div class="est-field"><label>${esc(tr("f_cantidad"))}</label><input type="number" min="1" step="1" id="fCantidad" value="${a.cantidad ?? 1}"></div>`;
    } else if (proc === "laser") {
      fieldsHtml = `
        <div class="est-field"><label>${esc(tr("f_material"))}</label>
          <select id="fMaterial"><option>MDF</option><option>Acrílico</option><option>Madera</option><option>Acero</option></select></div>
        <div class="est-row">
          <div class="est-field"><label>${esc(tr("f_espesor"))}</label><input type="number" min="0.5" step="0.5" id="fEspesor" value="${a.espesor ?? 3}"></div>
          <div class="est-field"><label>${esc(tr("f_area"))}</label><input type="number" min="1" step="1" id="fArea" value="${a.area ?? 900}"></div>
          <div class="est-field"><label>${esc(tr("f_cantidad"))}</label><input type="number" min="1" step="1" id="fCantidad" value="${a.cantidad ?? 1}"></div>
        </div>`;
    } else if (proc === "cnc") {
      fieldsHtml = `
        <div class="est-field"><label>${esc(tr("f_material"))}</label>
          <select id="fMaterial"><option>Madera</option><option>Aluminio</option><option>Acero</option><option>Plástico</option></select></div>
        <div class="est-row">
          <div class="est-field"><label>${esc(tr("f_largo"))}</label><input type="number" min="0.1" step="0.1" id="fLargo" value="${a.largo ?? 10}"></div>
          <div class="est-field"><label>${esc(tr("f_ancho"))}</label><input type="number" min="0.1" step="0.1" id="fAncho" value="${a.ancho ?? 10}"></div>
          <div class="est-field"><label>${esc(tr("f_alto"))}</label><input type="number" min="0.1" step="0.1" id="fAlto" value="${a.alto ?? 10}"></div>
        </div>
        <div class="est-field"><label>${esc(tr("f_complejidad"))}</label>
          <select id="fComplejidad"><option value="simple">${esc(tr("comp_simple"))}</option><option value="detallada">${esc(tr("comp_detail"))}</option></select></div>
        <div class="est-field"><label>${esc(tr("f_cantidad"))}</label><input type="number" min="1" step="1" id="fCantidad" value="${a.cantidad ?? 1}"></div>`;
    }

    body.innerHTML = `<h2>${esc(tr("title"))}</h2>${progressDots(2, 2)}<div class="est-q">${esc(tr("q_maker_process"))}: ${esc(tr("proc_" + proc))}</div>${fieldsHtml}<div id="estMakerResult"></div>`;
    body.insertBefore(backButton("maker-process"), body.children[1]);

    const recompute = () => renderMakerResult(proc);
    body.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", recompute));
    const relleno = document.getElementById("fRelleno");
    if (relleno) relleno.addEventListener("input", () => { document.getElementById("fRellenoVal").textContent = relleno.value + "%"; });
    recompute();
  }

  function num(id, def) { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) || v <= 0 ? def : v; }

  function renderMakerResult(proc) {
    const out = document.getElementById("estMakerResult");
    if (!out) return;
    let horas = 0, peso = null, costo = null, cantidad = 1;

    if (proc === "fdm" || proc === "resin") {
      const largo = num("fLargo", 10), ancho = num("fAncho", 10), alto = num("fAlto", 10);
      cantidad = num("fCantidad", 1);
      const material = document.getElementById("fMaterial").value;
      const volTotal = largo * ancho * alto;
      if (proc === "fdm") {
        const relleno = num("fRelleno", 20);
        const volEfectivo = volTotal * (0.15 + 0.85 * (relleno / 100));
        peso = volEfectivo * DENSITY[material];
        horas = volEfectivo / PRICE.fdm_cm3_por_hora;
        costo = peso * (PRICE.fdm_cop_por_g[material] || 90);
      } else {
        peso = volTotal * DENSITY.RESINA;
        horas = alto / PRICE.resina_cm_alto_por_hora;
        costo = volTotal * PRICE.resina_cop_por_ml;
      }
      state.answers = { ...state.answers, largo, ancho, alto, material, cantidad, relleno: num("fRelleno", state.answers.relleno) };
    } else if (proc === "laser") {
      const espesor = num("fEspesor", 3), area = num("fArea", 900);
      cantidad = num("fCantidad", 1);
      const material = document.getElementById("fMaterial").value;
      const cat = espesor <= 3 ? "fina" : espesor <= 8 ? "media" : "gruesa";
      horas = (area / 100) * (PRICE.laser_min_por_100cm2[cat] / 60);
      state.answers = { ...state.answers, espesor, area, material, cantidad };
    } else if (proc === "cnc") {
      const largo = num("fLargo", 10), ancho = num("fAncho", 10), alto = num("fAlto", 10);
      cantidad = num("fCantidad", 1);
      const material = document.getElementById("fMaterial").value;
      const complejidad = document.getElementById("fComplejidad").value;
      const vol = largo * ancho * alto;
      horas = vol * (PRICE.cnc_min_por_cm3[complejidad] / 60);
      state.answers = { ...state.answers, largo, ancho, alto, material, complejidad, cantidad };
    }

    const horasTotal = horas * cantidad;
    let statsHtml = `<div class="est-stat"><strong>${esc(fmtHoras(horasTotal))}</strong><span>${esc(tr("r_time"))}</span></div>`;
    if (peso !== null) statsHtml += `<div class="est-stat"><strong>${Math.round(peso * cantidad)} g</strong><span>${esc(tr("r_weight"))}</span></div>`;
    if (costo !== null) statsHtml += `<div class="est-stat"><strong>${esc(fmtCOP(costo * cantidad))}</strong><span>${esc(tr("r_cost"))}</span></div>`;
    statsHtml += `<div class="est-stat"><strong>${cantidad}</strong><span>${esc(tr("r_units"))}</span></div>`;

    out.innerHTML = `
      <div class="est-result">
        <div class="est-result-grid">${statsHtml}</div>
      </div>
      <p class="est-disclaimer">${esc(tr("disclaimer_maker"))}</p>
      <button type="button" class="btn btn-primary" id="estSendWa">${esc(tr("send_wa"))}</button>`;
    document.getElementById("estSendWa").addEventListener("click", () => sendWhatsApp());
  }

  // ── Pantalla de resultado (ramas de una sola pregunta: web/iot/design) ──
  function screenResult() {
    const svc = state.service;
    let range, label;
    if (svc === "web") {
      range = { ...TIME_WEB[state.answers.tipo] };
      if (state.answers.diseno === "no") { range.min += 1; range.max += 1; }
      label = "u_weeks";
    } else if (svc === "iot") {
      range = { ...TIME_IOT[state.answers.tipo] };
      if (state.answers.modulos === "high") range.max += 1;
      label = "u_weeks";
    } else if (svc === "design") {
      range = { ...TIME_DESIGN[state.answers.tipo] };
      label = "u_days";
    }
    const rangoTxt = `${range.min}–${range.max} ${tr(label)}`;

    let extra = "";
    if (svc === "web" && state.answers.urgencia === "rapido") extra = `<p class="est-disclaimer">${esc(tr("cta_urgent"))}</p>`;

    body.innerHTML = `
      <h2>${esc(tr("title"))}</h2>
      <div class="est-q">${esc(tr("result_lead"))}</div>
      <div class="est-result">
        <div class="est-result-num">${esc(rangoTxt)}</div>
        <p>${esc(tr("r_time"))}</p>
      </div>
      ${extra}
      <p class="est-disclaimer">${esc(tr("disclaimer_general"))}</p>
      <button type="button" class="btn btn-primary" id="estSendWa">${esc(tr("send_wa"))}</button>`;
    body.insertBefore(backButton(svc + "-q" + ({ web: 3, iot: 2, design: 1 }[svc])), body.children[1]);
    document.getElementById("estSendWa").addEventListener("click", () => sendWhatsApp());
  }

  // ── Construye el resumen estructurado y abre WhatsApp ───────────────────
  function sendWhatsApp() {
    const svc = state.service, a = state.answers;
    const lines = ["Hola Henry, usé el cotizador de tu web y esto fue lo que respondí:", ""];
    lines.push("Servicio: " + tr("svc_" + svc));
    Object.keys(a).forEach((k) => { lines.push("- " + k + ": " + a[k]); });
    const href = (window.CDH_CONTACT && window.CDH_CONTACT.waUrl) ? window.CDH_CONTACT.waUrl(lines.join("\n")) : "#";
    window.open(href, "_blank", "noopener,noreferrer");
  }

  // ── Íconos usados en la pantalla de selección de servicio ───────────────
  const ICON = {
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/><path d="m14 4-4 16"/></svg>',
    maker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>',
    iot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>',
    design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  };

  function render() {
    const map = {
      service: screenService,
      "web-q1": screenWeb1, "web-q2": screenWeb2, "web-q3": screenWeb3,
      "iot-q1": screenIot1, "iot-q2": screenIot2,
      "design-q1": screenDesign1,
      "maker-process": screenMakerProcess, "maker-form": screenMakerForm,
      result: screenResult,
    };
    (map[state.screen] || screenService)();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("openEstimator");
    if (btn) btn.addEventListener("click", open);
  });
  window.addEventListener("cdh:langchange", () => { if (modal && !modal.hidden) render(); });

  window.CDH_ESTIMATOR = { open, openMakerWithDimensions };
})();
