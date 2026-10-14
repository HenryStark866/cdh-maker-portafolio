/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — viewer3d.js
   Visor 3D: arrastra un STL y lo revisa en el navegador, sin subir nada a
   ningún servidor (todo el procesamiento — parseo, medidas, render — pasa
   100% en el cliente). Three.js se descarga solo la primera vez que el
   visitante abre esta herramienta (no viaja en la carga inicial del sitio).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const THREE_VER = "0.128.0";
  const THREE_BASE = `https://unpkg.com/three@${THREE_VER}`;

  function L() {
    const l = (document.documentElement.lang || "es").slice(0, 2);
    return C[l] ? l : "es";
  }
  function tr(key) { return (C[L()] && C[L()][key]) || C.es[key] || key; }

  const C = {
    es: {
      title: "Visor 3D", subtitle: "Arrastra tu archivo STL: se revisa en tu navegador, nada se sube a internet.",
      drop_title: "Arrastra tu archivo STL aquí", drop_sub: "o haz clic para elegirlo",
      change_file: "Cambiar archivo", loading: "Cargando modelo…",
      s_x: "Largo (X)", s_y: "Ancho (Y)", s_z: "Alto (Z)", s_vol: "Volumen", s_tri: "Triángulos",
      btn_estimate: "Estimar impresión →", btn_wa: "Enviar por WhatsApp",
      wa_msg: "Hola Henry, tengo un archivo 3D que quiero imprimir. Te lo envío por acá:",
      err_format: "Ese archivo no parece un STL válido. Prueba con otro.",
    },
    en: {
      title: "3D Viewer", subtitle: "Drag your STL file: it's checked right in your browser, nothing gets uploaded.",
      drop_title: "Drag your STL file here", drop_sub: "or click to choose it",
      change_file: "Change file", loading: "Loading model…",
      s_x: "Length (X)", s_y: "Width (Y)", s_z: "Height (Z)", s_vol: "Volume", s_tri: "Triangles",
      btn_estimate: "Estimate printing →", btn_wa: "Send via WhatsApp",
      wa_msg: "Hi Henry, I have a 3D file I'd like printed. I'm sending it here:",
      err_format: "That file doesn't look like a valid STL. Try another one.",
    },
    zh: {
      title: "3D 查看器",
      subtitle: "拖入你的 STL 文件：直接在你的浏览器中检查，任何内容都不会上传到互联网。",
      drop_title: "将 STL 文件拖到这里",
      drop_sub: "或点击选择文件",
      change_file: "更换文件",
      loading: "正在加载模型…",
      s_x: "长度（X）",
      s_y: "宽度（Y）",
      s_z: "高度（Z）",
      s_vol: "体积",
      s_tri: "三角面数",
      btn_estimate: "打印估算 →",
      btn_wa: "通过 WhatsApp 发送",
      wa_msg: "你好 Henry，我有一个想打印的 3D 文件，现在发给你：",
      err_format: "这个文件似乎不是有效的 STL，请换一个试试。",
    },
    hi: {
      title: "3D व्यूअर",
      subtitle: "अपनी STL फ़ाइल यहाँ खींचकर लाएँ: इसकी जाँच आपके ब्राउज़र में ही होती है, इंटरनेट पर कुछ भी अपलोड नहीं होता।",
      drop_title: "अपनी STL फ़ाइल यहाँ खींचकर छोड़ें",
      drop_sub: "या चुनने के लिए क्लिक करें",
      change_file: "फ़ाइल बदलें",
      loading: "मॉडल लोड हो रहा है…",
      s_x: "लंबाई (X)",
      s_y: "चौड़ाई (Y)",
      s_z: "ऊँचाई (Z)",
      s_vol: "आयतन",
      s_tri: "त्रिभुज",
      btn_estimate: "प्रिंटिंग का अनुमान लगाएँ →",
      btn_wa: "WhatsApp पर भेजें",
      wa_msg: "नमस्ते Henry, मुझे एक 3D फ़ाइल प्रिंट करवानी है। फ़ाइल इसी चैट में भेजी जा रही है:",
      err_format: "यह फ़ाइल मान्य STL नहीं लगती। कोई दूसरी फ़ाइल आज़माएँ।",
    },
    ar: {
      title: "عارض ثلاثي الأبعاد",
      subtitle: "اسحب ملف STL الخاص بك: يُفحص داخل متصفحك، ولا يُرفع أي شيء إلى الإنترنت.",
      drop_title: "اسحب ملف STL هنا",
      drop_sub: "أو انقر لاختياره",
      change_file: "تغيير الملف",
      loading: "جارٍ تحميل النموذج…",
      s_x: "الطول (X)",
      s_y: "العرض (Y)",
      s_z: "الارتفاع (Z)",
      s_vol: "الحجم",
      s_tri: "المثلثات",
      btn_estimate: "تقدير الطباعة →",
      btn_wa: "إرسال عبر WhatsApp",
      wa_msg: "مرحبًا Henry، لديّ ملف ثلاثي الأبعاد أريد طباعته. سأرسله إليك هنا:",
      err_format: "لا يبدو أن هذا ملف STL صالح. جرّب ملفًا آخر.",
    },
    pt: {
      title: "Visualizador 3D",
      subtitle: "Arraste seu arquivo STL: ele é analisado no seu navegador, nada é enviado para a internet.",
      drop_title: "Arraste seu arquivo STL aqui",
      drop_sub: "ou clique para escolher",
      change_file: "Trocar arquivo",
      loading: "Carregando modelo…",
      s_x: "Comprimento (X)",
      s_y: "Largura (Y)",
      s_z: "Altura (Z)",
      s_vol: "Volume",
      s_tri: "Triângulos",
      btn_estimate: "Estimar impressão →",
      btn_wa: "Enviar pelo WhatsApp",
      wa_msg: "Olá, Henry! Tenho um arquivo 3D que quero imprimir. Envio por aqui:",
      err_format: "Esse arquivo não parece um STL válido. Tente outro.",
    },
    bn: {
      title: "3D ভিউয়ার",
      subtitle: "আপনার STL ফাইল টেনে আনুন: এটি আপনার ব্রাউজারেই পরীক্ষা করা হয়, ইন্টারনেটে কিছুই আপলোড হয় না।",
      drop_title: "আপনার STL ফাইল এখানে টেনে আনুন",
      drop_sub: "অথবা বেছে নিতে ক্লিক করুন",
      change_file: "ফাইল বদলান",
      loading: "মডেল লোড হচ্ছে…",
      s_x: "দৈর্ঘ্য (X)",
      s_y: "প্রস্থ (Y)",
      s_z: "উচ্চতা (Z)",
      s_vol: "আয়তন",
      s_tri: "ত্রিভুজ",
      btn_estimate: "প্রিন্টিংয়ের আনুমানিক হিসাব দেখুন →",
      btn_wa: "WhatsApp-এ পাঠান",
      wa_msg: "হ্যালো Henry, আমার কাছে একটি 3D ফাইল আছে যা প্রিন্ট করাতে চাই। এখানে পাঠাচ্ছি:",
      err_format: "এই ফাইলটি বৈধ STL বলে মনে হচ্ছে না। অন্য একটি ফাইল দিয়ে চেষ্টা করুন।",
    },
    ru: {
      title: "3D-просмотрщик",
      subtitle: "Перетащите файл STL: он проверяется прямо в вашем браузере, ничего не загружается в интернет.",
      drop_title: "Перетащите файл STL сюда",
      drop_sub: "или нажмите, чтобы выбрать файл",
      change_file: "Сменить файл",
      loading: "Загрузка модели…",
      s_x: "Длина (X)",
      s_y: "Ширина (Y)",
      s_z: "Высота (Z)",
      s_vol: "Объём",
      s_tri: "Треугольники",
      btn_estimate: "Оценить печать →",
      btn_wa: "Отправить в WhatsApp",
      wa_msg: "Здравствуйте, Henry! У меня есть 3D-файл, который я хочу напечатать. Отправляю его сюда:",
      err_format: "Этот файл не похож на корректный STL. Попробуйте другой.",
    },
    fr: {
      title: "Visionneuse 3D",
      subtitle: "Glissez-déposez votre fichier STL : il est analysé directement dans votre navigateur, rien n'est envoyé sur Internet.",
      drop_title: "Déposez votre fichier STL ici",
      drop_sub: "ou cliquez pour le choisir",
      change_file: "Changer de fichier",
      loading: "Chargement du modèle…",
      s_x: "Longueur (X)",
      s_y: "Largeur (Y)",
      s_z: "Hauteur (Z)",
      s_vol: "Volume",
      s_tri: "Triangles",
      btn_estimate: "Estimer l'impression →",
      btn_wa: "Envoyer par WhatsApp",
      wa_msg: "Bonjour Henry, j'ai un fichier 3D que je voudrais faire imprimer. Je vous l'envoie ici :",
      err_format: "Ce fichier ne semble pas être un STL valide. Essayez-en un autre.",
    },
    id: {
      title: "Penampil 3D",
      subtitle: "Seret file STL Anda: diperiksa langsung di browser Anda, tidak ada yang diunggah ke internet.",
      drop_title: "Seret file STL Anda ke sini",
      drop_sub: "atau klik untuk memilihnya",
      change_file: "Ganti file",
      loading: "Memuat model…",
      s_x: "Panjang (X)",
      s_y: "Lebar (Y)",
      s_z: "Tinggi (Z)",
      s_vol: "Volume",
      s_tri: "Segitiga",
      btn_estimate: "Estimasi pencetakan →",
      btn_wa: "Kirim lewat WhatsApp",
      wa_msg: "Halo Henry, saya punya file 3D yang ingin dicetak. Saya kirimkan di sini:",
      err_format: "File itu sepertinya bukan STL yang valid. Coba file lain.",
    },
  };

  let root, modal, body;
  let three = null;      // { THREE, scene, camera, renderer, controls, mesh, raf }
  let lastDims = null;   // { largo, ancho, alto } del último STL cargado (cm)
  let threePromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ensureThree() {
    if (threePromise) return threePromise;
    threePromise = loadScript(`${THREE_BASE}/build/three.min.js`)
      .then(() => loadScript(`${THREE_BASE}/examples/js/loaders/STLLoader.js`))
      .then(() => loadScript(`${THREE_BASE}/examples/js/controls/OrbitControls.js`));
    return threePromise;
  }

  function ensureDom() {
    if (root) return;
    root = document.createElement("div");
    root.id = "cdh-viewer3d";
    root.innerHTML = `
      <div class="tool-modal" id="viewer3dModal" hidden>
        <div class="tool-modal-card">
          <button type="button" class="tool-modal-close" aria-label="Cerrar">✕</button>
          <div class="tool-modal-body" id="viewer3dBody"></div>
        </div>
      </div>`;
    document.body.appendChild(root);
    modal = document.getElementById("viewer3dModal");
    body = document.getElementById("viewer3dBody");
    modal.querySelector(".tool-modal-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  }

  function renderShell() {
    body.innerHTML = `
      <h2>${tr("title")}</h2>
      <p class="tool-sub">${tr("subtitle")}</p>
      <div class="viewer-drop" id="viewerDrop" tabindex="0" role="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <strong>${tr("drop_title")}</strong>
        <span>${tr("drop_sub")}</span>
        <input type="file" accept=".stl" id="viewerFile" hidden>
      </div>
      <div id="viewerLoaded" hidden>
        <div class="viewer-filename"><span id="viewerName"></span><button type="button" id="viewerChange">${tr("change_file")}</button></div>
        <div class="viewer-canvas-wrap" id="viewerCanvasWrap">
          <div class="viewer-loading" id="viewerLoading">${tr("loading")}</div>
        </div>
        <div class="viewer-stats" id="viewerStats"></div>
        <div class="viewer-actions">
          <button type="button" class="btn btn-primary" id="viewerEstimateBtn">${tr("btn_estimate")}</button>
          <button type="button" class="btn btn-ghost" id="viewerWaBtn">${tr("btn_wa")}</button>
        </div>
        <p class="est-disclaimer" id="viewerErr" hidden></p>
      </div>`;

    const drop = document.getElementById("viewerDrop");
    const input = document.getElementById("viewerFile");
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") input.click(); });
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });
    ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

    document.getElementById("viewerChange").addEventListener("click", resetToDrop);
    document.getElementById("viewerWaBtn").addEventListener("click", () => {
      const href = (window.CDH_CONTACT && window.CDH_CONTACT.waUrl) ? window.CDH_CONTACT.waUrl(tr("wa_msg")) : "#";
      window.open(href, "_blank", "noopener,noreferrer");
    });
    document.getElementById("viewerEstimateBtn").addEventListener("click", () => {
      if (!lastDims) return;
      close();
      if (window.CDH_ESTIMATOR) window.CDH_ESTIMATOR.openMakerWithDimensions(lastDims);
    });
  }

  function resetToDrop() {
    document.getElementById("viewerDrop").hidden = false;
    document.getElementById("viewerLoaded").hidden = true;
    document.getElementById("viewerFile").value = "";
    stopThree();
  }

  function showError(msg) {
    const el = document.getElementById("viewerErr");
    el.textContent = msg; el.hidden = false;
  }

  function handleFile(file) {
    if (!/\.stl$/i.test(file.name)) { showError(tr("err_format")); return; }
    document.getElementById("viewerErr").hidden = true;
    document.getElementById("viewerDrop").hidden = true;
    document.getElementById("viewerLoaded").hidden = false;
    document.getElementById("viewerName").textContent = file.name;
    document.getElementById("viewerStats").innerHTML = "";
    document.getElementById("viewerCanvasWrap").innerHTML = `<div class="viewer-loading">${tr("loading")}</div>`;

    const reader = new FileReader();
    reader.onload = (e) => {
      ensureThree().then(() => initScene(e.target.result)).catch(() => showError(tr("err_format")));
    };
    reader.onerror = () => showError(tr("err_format"));
    reader.readAsArrayBuffer(file);
  }

  function stopThree() {
    if (three && three.raf) cancelAnimationFrame(three.raf);
    if (three && three.renderer) {
      try { three.renderer.dispose(); } catch (_) { }
      if (three.renderer.domElement && three.renderer.domElement.parentNode) {
        three.renderer.domElement.parentNode.removeChild(three.renderer.domElement);
      }
    }
    if (three && three.resizeObs) three.resizeObs.disconnect();
    three = null;
  }

  function initScene(arrayBuffer) {
    stopThree();
    const wrap = document.getElementById("viewerCanvasWrap");
    wrap.innerHTML = "";
    const THREE = window.THREE;

    let geometry;
    try {
      geometry = new THREE.STLLoader().parse(arrayBuffer);
    } catch (_) {
      showError(tr("err_format"));
      wrap.innerHTML = "";
      return;
    }
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04141c);

    const w = wrap.clientWidth || 480, h = wrap.clientHeight || 360;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    camera.position.set(maxDim * 1.3, maxDim * 1.1, maxDim * 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    wrap.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x0a0a12, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(maxDim, maxDim * 2, maxDim);
    scene.add(dir);

    const material = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.15, roughness: 0.55 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const grid = new THREE.GridHelper(maxDim * 3, 12, 0x22d3ee, 0x123241);
    grid.position.y = -size.y / 2;
    scene.add(grid);

    controls.target.set(0, 0, 0);
    controls.update();

    function tick() {
      three.raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    }
    three = { THREE, scene, camera, renderer, controls, mesh };
    tick();

    const resizeObs = new ResizeObserver(() => {
      const nw = wrap.clientWidth, nh = wrap.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh; camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObs.observe(wrap);
    three.resizeObs = resizeObs;

    // Dimensiones en cm (los STL suelen venir en mm; si el modelo es enorme
    // asumimos mm y convertimos, si es pequeño ya está en cm razonables)
    const looksLikeMM = Math.max(size.x, size.y, size.z) > 50;
    const toCm = looksLikeMM ? 0.1 : 1;
    const largo = size.x * toCm, ancho = size.y * toCm, alto = size.z * toCm;
    lastDims = { largo: +largo.toFixed(2), ancho: +ancho.toFixed(2), alto: +alto.toFixed(2) };
    const volCm3 = largo * ancho * alto;
    const triCount = geometry.attributes.position.count / 3;

    document.getElementById("viewerStats").innerHTML = `
      <div class="est-stat"><strong>${largo.toFixed(1)} cm</strong><span>${tr("s_x")}</span></div>
      <div class="est-stat"><strong>${ancho.toFixed(1)} cm</strong><span>${tr("s_y")}</span></div>
      <div class="est-stat"><strong>${alto.toFixed(1)} cm</strong><span>${tr("s_z")}</span></div>
      <div class="est-stat"><strong>${volCm3.toFixed(1)} cm³</strong><span>${tr("s_vol")}</span></div>
      <div class="est-stat"><strong>${Math.round(triCount).toLocaleString("es-CO")}</strong><span>${tr("s_tri")}</span></div>`;
  }

  function open() {
    ensureDom();
    renderShell();
    modal.hidden = false;
    document.body.classList.add("tool-modal-open");
  }
  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("tool-modal-open");
    stopThree();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("openViewer3d");
    if (btn) btn.addEventListener("click", open);
  });
  // Solo se re-pinta si el visitante sigue en la pantalla de "soltar archivo":
  // si ya cargó un modelo, cambiar de idioma no debe tirar la escena 3D.
  window.addEventListener("cdh:langchange", () => {
    if (modal && !modal.hidden && document.getElementById("viewerDrop") && !document.getElementById("viewerDrop").hidden) {
      renderShell();
    }
  });

  window.CDH_VIEWER3D = { open };
})();
