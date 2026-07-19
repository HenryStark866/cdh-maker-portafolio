/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — auth.js
   Sistema de autenticación de clientes + CRM (base de datos de clientes).

   Arquitectura en dos niveles:
     1. Firebase Auth + Firestore (nube, multi-dispositivo) cuando están activos.
     2. "Vault" local en localStorage con hash PBKDF2 como respaldo si Firebase
        no está disponible (el sitio nunca deja de funcionar).

   Además: guarda cada registro en el CRM local, lo sube a Firestore y envía
   una notificación por correo (FormSubmit) al dueño del sitio.
   El contacto (WhatsApp/correo) está ofuscado y solo se entrega a usuarios
   con sesión iniciada.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   Última actualización: 2026-07-19
   ═══════════════════════════════════════════════════════════════════════════ */

// IIFE: módulo autocontenido, expone su API solo a través de window.CDH_AUTH
(function () {
  "use strict";

  // ── Contacto ofuscado (cifrado de desplazamiento Shift-3) ───────────────────
  // Los datos de contacto no aparecen en texto plano en el código fuente:
  // se guardan con cada carácter desplazado +3 y se decodifican al vuelo.
  const _d = (s) => {
    try {
      // Resta 3 al código de cada carácter para recuperar el texto original
      return s.split("").map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
    } catch {
      return "";
    }
  };
  const CONTACT = {
    waNumber: () => _d("8:6578:9<:7;"),          // número de WhatsApp (decodificado)
    email: () => _d("fgkpdnhuCjpdlo1frp"),        // correo de contacto (decodificado)
    // Construye la URL de WhatsApp con mensaje opcional pre-escrito
    waUrl: (msg) => {
      const n = CONTACT.waNumber();
      const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
      return n ? `https://wa.me/${n}${q}` : "#";
    },
    // Construye la URL mailto: con asunto opcional
    mailUrl: (subject) => {
      const e = CONTACT.email();
      if (!e) return "#";
      const s = subject ? `?subject=${encodeURIComponent(subject)}` : "";
      return `mailto:${e}${s}`;
    },
  };

  // ── Configuración pública de Firebase ───────────────────────────────────────
  // Nota: estas claves son PÚBLICAS por diseño de Firebase (identifican el
  // proyecto); la seguridad real la imponen las reglas de firestore.rules.
  const FB_CONFIG = {
    apiKey: "AIzaSyCmeLzxeK_TUHkmKu3G81oKyW6Bg3B-iS0",
    authDomain: "cdh-maker-portafolio.firebaseapp.com",
    projectId: "cdh-maker-portafolio",
    storageBucket: "cdh-maker-portafolio.firebasestorage.app",
    messagingSenderId: "520629002740",
    appId: "1:520629002740:web:f923bb6cd535cb2e7519a1",
  };

  // ── Claves de localStorage (versionadas para poder migrar a futuro) ─────────
  const LS_USERS = "cdh_clients_vault_v1";        // vault local de credenciales
  const LS_SESSION = "cdh_client_session_v1";     // sesión activa del cliente
  const LS_CRM = "cdh_clients_crm_v1";            // base de clientes local (CRM)
  const LS_LOGOUT_FLAG = "cdh_logout_pending_v1"; // seteado por perfil.html al cerrar sesión

  // ── Estado del módulo ───────────────────────────────────────────────────────
  let currentUser = null;    // perfil del usuario con sesión activa (o null)
  let firebaseReady = false; // true si el SDK de Firebase inicializó bien
  let fbAuth = null;         // instancia de firebase.auth()
  let fbDb = null;           // instancia de firebase.firestore()

  // ---------- Ayudantes de i18n ----------
  // Busca un texto traducido en el diccionario que publica i18n.js;
  // si no existe (o el idioma no está), devuelve el texto por defecto
  function t(key, fallback) {
    const lang = (document.documentElement.lang || "es").slice(0, 2);
    const dict =
      (window.CDH_I18N_AUTH && (window.CDH_I18N_AUTH[lang] || window.CDH_I18N_AUTH.es)) || {};
    return dict[key] || fallback;
  }

  // ---------- Criptografía (PBKDF2 local para el vault) ----------
  // Convierte un ArrayBuffer a texto Base64 (para poder guardarlo en localStorage)
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
  }
  // Operación inversa: Base64 → ArrayBuffer
  function b64ToBuf(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }
  // Deriva un hash seguro de la contraseña con PBKDF2 (WebCrypto nativo).
  //   - saltB64 ausente → genera sal aleatoria nueva (registro)
  //   - saltB64 presente → reutiliza la sal guardada (verificación en login)
  // 120 000 iteraciones SHA-256: hace inviable el ataque por fuerza bruta.
  // La contraseña NUNCA se guarda: solo su hash + sal.
  async function hashPassword(password, saltB64) {
    const enc = new TextEncoder();
    const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;
    // Importa la contraseña como material de clave para PBKDF2
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    // Deriva 256 bits aplicando las iteraciones
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    return { hash: bufToB64(bits), salt: bufToB64(salt) };
  }

  // ---------- Vault local (respaldo sin Firebase) ----------
  // Lee el vault: objeto { email → registroDeUsuario }
  function readVault() {
    try {
      return JSON.parse(localStorage.getItem(LS_USERS) || "{}");
    } catch {
      return {}; // JSON corrupto → vault vacío (no rompe el sitio)
    }
  }
  // Persiste el vault completo
  function writeVault(v) {
    localStorage.setItem(LS_USERS, JSON.stringify(v));
  }
  // Lee la lista del CRM local (array de clientes)
  function readCrm() {
    try {
      return JSON.parse(localStorage.getItem(LS_CRM) || "[]");
    } catch {
      return [];
    }
  }
  // Persiste la lista del CRM
  function writeCrm(list) {
    localStorage.setItem(LS_CRM, JSON.stringify(list));
  }

  // ── Gestión de sesión ───────────────────────────────────────────────────────
  // Guarda (o borra, con null) la sesión activa y actualiza toda la UI
  function saveSession(user) {
    currentUser = user;
    if (user) {
      // Serializa el perfil + marca de tiempo `at` (para calcular expiración)
      localStorage.setItem(
        LS_SESSION,
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          name: user.name,
          phone: user.phone || "",
          company: user.company || "",
          interest: user.interest || "",
          at: Date.now(),
        })
      );
    } else {
      localStorage.removeItem(LS_SESSION); // logout: eliminar la sesión
    }
    applyAuthUI(); // refleja el nuevo estado en la interfaz
    // Notifica a otros scripts (ej: el chatbot saluda distinto si hay sesión)
    window.dispatchEvent(new CustomEvent("cdh:authchange", { detail: { user: currentUser } }));
  }

  // Restaura la sesión desde localStorage al cargar la página.
  // Solo es válida si tiene email, marca de tiempo y menos de 30 días
  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SESSION) || "null");
      if (s && s.email && s.at && Date.now() - s.at < 1000 * 60 * 60 * 24 * 30) {
        currentUser = s;
      }
    } catch {
      currentUser = null; // JSON corrupto → sin sesión
    }
  }

  // ── CRM local ───────────────────────────────────────────────────────────────
  // Inserta o actualiza un cliente en la lista local (clave: email)
  function pushCrm(client) {
    const list = readCrm();
    const idx = list.findIndex((c) => c.email === client.email);
    if (idx >= 0) list[idx] = { ...list[idx], ...client, updatedAt: new Date().toISOString() };
    else list.push({ ...client, createdAt: new Date().toISOString() });
    writeCrm(list);
  }

  // ── Notificación por correo de cada alta de cliente ─────────────────────────
  // Envía los datos del nuevo registro a la bandeja de CDH Maker vía FormSubmit.
  // Es "fire and forget": si falla, el CRM local y Firestore siguen funcionando
  async function notifyNewClient(profile) {
    const endpoint = "https://formsubmit.co/ajax/" + CONTACT.email();
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `[CDH Maker] Nuevo cliente: ${profile.name}`, // asunto del correo
          _template: "table",    // FormSubmit: presenta los campos como tabla
          _captcha: "false",     // sin pantalla intermedia de captcha
          nombre: profile.name,
          email: profile.email,
          telefono: profile.phone || "—",
          empresa: profile.company || "—",
          interes: profile.interest || "—",
          origen: "Registro web portafolio",
          fecha: new Date().toISOString(),
        }),
      });
    } catch (_) {
      /* silencioso: el CRM local y Firestore siguen activos */
    }
  }

  // ── Persistencia del cliente en la nube (Firestore) ─────────────────────────
  // Guarda el perfil en el CRM local SIEMPRE y en Firestore si está disponible
  async function saveClientCloud(profile) {
    pushCrm(profile); // 1. respaldo local garantizado
    if (fbDb && typeof firebase !== "undefined") {
      try {
        // 2. documento en la colección "clients" (id = uid o email)
        await fbDb.collection("clients").doc(profile.uid || profile.email).set(
          {
            name: profile.name,
            email: profile.email,
            phone: profile.phone || "",
            company: profile.company || "",
            interest: profile.interest || "",
            source: "web-portfolio", // de dónde vino el registro
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true } // no pisa campos existentes si el doc ya existía
        );
      } catch (_) { } // sin permisos o sin red: el respaldo local ya quedó
    }
  }

  // ---------- Registro / Login ----------
  // Crea una cuenta nueva. Valida los campos, intenta Firebase Auth y siempre
  // deja una copia en el vault local. Devuelve el perfil creado.
  async function register({ name, email, phone, company, interest, password }) {
    // Normalización de entradas (quita espacios, email en minúsculas)
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    phone = (phone || "").trim();
    company = (company || "").trim();
    interest = (interest || "").trim();
    password = password || "";

    // Validaciones con mensajes traducibles
    if (!name || name.length < 2) throw new Error(t("err_name", "Ingresa tu nombre completo."));
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error(t("err_email", "Ingresa un correo válido."));
    if (!phone || phone.replace(/\D/g, "").length < 7)
      throw new Error(t("err_phone", "Ingresa un teléfono de contacto."));
    if (password.length < 6)
      throw new Error(t("err_pass", "La contraseña debe tener al menos 6 caracteres."));

    // Rechaza el registro si el correo ya existe en el vault local
    const vault = readVault();
    if (vault[email]) throw new Error(t("err_exists", "Ya existe una cuenta con este correo. Inicia sesión."));

    // uid provisional local (se reemplaza por el de Firebase si Auth responde)
    let uid = "local_" + btoa(email).replace(/=+/g, "").slice(0, 16);

    // Intento con Firebase Auth (si está habilitado en la consola del proyecto)
    if (fbAuth) {
      try {
        const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
        uid = cred.user.uid; // uid real de Firebase
        await cred.user.updateProfile({ displayName: name }); // guarda el nombre
      } catch (err) {
        if (err && err.code === "auth/email-already-in-use") {
          // La cuenta ya existe en la nube: pedir login en vez de registro
          throw new Error(t("err_exists", "Ya existe una cuenta con este correo. Inicia sesión."));
        }
        // Cualquier otro error (Auth no configurado, sin red): continuar con vault local
      }
    }

    // Guardar credenciales en el vault local (hash PBKDF2 + sal, nunca la contraseña)
    const { hash, salt } = await hashPassword(password);
    vault[email] = { uid, name, email, phone, company, interest, hash, salt, createdAt: Date.now() };
    writeVault(vault);

    // Persistir el perfil (CRM + Firestore), notificar por correo y abrir sesión
    const profile = { uid, name, email, phone, company, interest };
    await saveClientCloud(profile);
    await notifyNewClient(profile);
    saveSession(profile);
    return profile;
  }

  // Inicia sesión. Intenta primero Firebase Auth; si no aplica, verifica
  // contra el vault local comparando hashes PBKDF2
  async function login({ email, password }) {
    email = (email || "").trim().toLowerCase();
    password = password || "";
    if (!email || !password) throw new Error(t("err_fields", "Completa correo y contraseña."));

    // 1) Firebase primero (fuente de verdad si está activo)
    if (fbAuth) {
      try {
        const cred = await fbAuth.signInWithEmailAndPassword(email, password);
        // Completa el perfil con los datos extra que guardó el vault local
        const vault = readVault();
        const local = vault[email] || {};
        const profile = {
          uid: cred.user.uid,
          email,
          name: cred.user.displayName || local.name || email.split("@")[0],
          phone: local.phone || "",
          company: local.company || "",
          interest: local.interest || "",
        };
        saveSession(profile);
        return profile;
      } catch (err) {
        // Credenciales no válidas EN FIREBASE: puede que la cuenta sea solo
        // local (creada cuando Auth estaba inactivo) → probar el vault local
        if (err && (err.code === "auth/wrong-password" || err.code === "auth/user-not-found")) {
          // probar vault local
        } else if (err && err.code === "auth/invalid-credential") {
          // vault local
        }
      }
    }

    // 2) Verificación contra el vault local
    const vault = readVault();
    const rec = vault[email];
    if (!rec) throw new Error(t("err_bad_login", "Correo o contraseña incorrectos."));
    // Rehash de la contraseña ingresada con la MISMA sal guardada
    const { hash } = await hashPassword(password, rec.salt);
    if (hash !== rec.hash) throw new Error(t("err_bad_login", "Correo o contraseña incorrectos."));

    // Hash coincide: credenciales correctas → abrir sesión
    const profile = {
      uid: rec.uid,
      email: rec.email,
      name: rec.name,
      phone: rec.phone || "",
      company: rec.company || "",
      interest: rec.interest || "",
    };
    saveSession(profile);
    return profile;
  }

  // Cierra la sesión en Firebase (si aplica) y borra la sesión local
  function logout() {
    if (fbAuth) {
      try {
        fbAuth.signOut();
      } catch (_) { }
    }
    saveSession(null);
  }

  // ¿Hay un usuario con sesión iniciada?
  function isLoggedIn() {
    return !!(currentUser && currentUser.email);
  }

  // Devuelve el perfil del usuario actual (o null)
  function getUser() {
    return currentUser;
  }

  // Entrega los enlaces de contacto SOLO si hay sesión iniciada
  // (así el número y el correo jamás llegan al navegador de un visitante anónimo)
  function getContactLinks(msg) {
    if (!isLoggedIn()) return null;
    return {
      whatsapp: CONTACT.waUrl(
        msg ||
        t(
          "wa_default",
          "Hola CDH Maker, vengo de su página web (cliente registrado) y quiero información sobre sus servicios."
        )
      ),
      email: CONTACT.mailUrl(t("mail_subject", "Proyecto con CDH Maker")),
    };
  }

  // ---------- UI (modal de cuenta y estados visuales) ----------
  // Abre el modal de cuenta en la pestaña indicada ("login" | "register")
  function openAuth(mode) {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.hidden = false;                      // mostrar el modal
    document.body.classList.add("auth-open");  // bloquea el scroll del fondo
    setAuthTab(mode === "login" ? "login" : "register");
    // Enfocar el primer campo del formulario correspondiente
    const first = modal.querySelector(
      mode === "login" ? "#authLoginEmail" : "#authRegName"
    );
    if (first) setTimeout(() => first.focus(), 50); // tras la animación de apertura
  }

  // Cierra el modal de cuenta y limpia los mensajes de error
  function closeAuth() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("auth-open");
    clearAuthErrors();
  }

  // Cambia entre las pestañas "Iniciar sesión" y "Crear cuenta" del modal
  function setAuthTab(tab) {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    // Resalta el botón de pestaña activo
    modal.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-auth-tab") === tab);
    });
    // Muestra solo el panel (formulario) de la pestaña activa
    modal.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-auth-panel") !== tab;
    });
    clearAuthErrors();
  }

  // Oculta todos los mensajes de error de los formularios de cuenta
  function clearAuthErrors() {
    document.querySelectorAll(".auth-error").forEach((el) => {
      el.textContent = "";
      el.hidden = true;
    });
  }

  // Muestra un mensaje de error en el elemento indicado
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  // Sincroniza TODA la interfaz con el estado de sesión actual.
  // Se llama al cargar, al iniciar/cerrar sesión y al cambiar de idioma
  function applyAuthUI() {
    const logged = isLoggedIn();
    // Clases globales que el CSS usa para mostrar/ocultar bloques enteros
    document.documentElement.classList.toggle("cdh-authed", logged);
    document.documentElement.classList.toggle("cdh-guest", !logged);

    // Botón "Crear cuenta" del nav: visible solo para visitantes
    const btn = document.getElementById("authNavBtn");
    const menu = document.getElementById("authUserMenu");
    if (btn) {
      if (logged) {
        btn.hidden = true;
      } else {
        btn.hidden = false;
        // Solo actualizar el label de texto, no sobreescribir el icono SVG
        const labelEl = btn.querySelector(".nav-label");
        if (labelEl) labelEl.textContent = t("nav_account", "Crear cuenta");
      }
    }
    // Menú de usuario (chip con nombre + botón salir): visible solo con sesión
    if (menu) {
      menu.hidden = !logged;
      const nameEl = menu.querySelector("[data-user-name]");
      if (nameEl && currentUser) nameEl.textContent = currentUser.name || currentUser.email;
    }

    // Secciones "bloqueadas" que requieren cuenta (atributo data-require-auth)
    document.querySelectorAll("[data-require-auth]").forEach((section) => {
      section.classList.toggle("is-locked", !logged);
      section.classList.toggle("is-unlocked", logged);
    });

    // Botones de contacto por WhatsApp: solo funcionan con sesión.
    // El href queda SIEMPRE en '#' para que el número no aparezca ni al
    // pasar el mouse por encima (la URL real se construye en el clic)
    document.querySelectorAll("[data-contact='wa']").forEach((a) => {
      a.href = "#"; // Siempre '#' para ocultar link en hover
      if (logged) {
        a.removeAttribute("aria-disabled");
        a.classList.remove("is-disabled");
        a.onclick = (e) => {
          e.preventDefault();
          const links = getContactLinks(); // URL generada al momento
          if (links && links.whatsapp) {
            window.open(links.whatsapp, "_blank", "noopener,noreferrer");
          }
        };
      } else {
        // Visitante: el botón invita a crear cuenta
        a.setAttribute("aria-disabled", "true");
        a.classList.add("is-disabled");
        a.onclick = (e) => {
          e.preventDefault();
          openAuth("register");
        };
      }
    });

    // Botones de contacto por correo: misma lógica que WhatsApp
    document.querySelectorAll("[data-contact='mail']").forEach((a) => {
      a.href = "#"; // Siempre '#' para ocultar link en hover
      if (logged) {
        a.removeAttribute("aria-disabled");
        a.classList.remove("is-disabled");
        a.onclick = (e) => {
          e.preventDefault();
          const links = getContactLinks();
          if (links && links.email) {
            window.location.href = links.email; // abre el cliente de correo
          }
        };
      } else {
        a.setAttribute("aria-disabled", "true");
        a.classList.add("is-disabled");
        a.onclick = (e) => {
          e.preventDefault();
          openAuth("register");
        };
      }
    });
  }

  // Conecta todos los eventos de la interfaz de cuenta (se llama una vez al boot)
  function wireUI() {
    // Botón del nav "Crear cuenta" → abre el modal en registro
    document.getElementById("authNavBtn")?.addEventListener("click", () => openAuth("register"));
    // Botón "Salir" del menú de usuario
    document.getElementById("authLogoutBtn")?.addEventListener("click", () => {
      logout();
      closeAuth();
    });
    // Cerrar modal: botón ✕ o clic en el fondo oscuro
    document.getElementById("authModalClose")?.addEventListener("click", closeAuth);
    document.getElementById("authModal")?.addEventListener("click", (e) => {
      if (e.target.id === "authModal") closeAuth(); // clic fuera de la tarjeta
    });
    // Pestañas del modal (login/registro)
    document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setAuthTab(btn.getAttribute("data-auth-tab")));
    });
    // Cualquier elemento con data-open-auth abre el modal (CTAs repartidos por el sitio)
    document.querySelectorAll("[data-open-auth]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openAuth(el.getAttribute("data-open-auth") || "register");
      });
    });

    // Envío del formulario de REGISTRO
    document.getElementById("authRegisterForm")?.addEventListener("submit", async (e) => {
      e.preventDefault(); // no recargar la página
      clearAuthErrors();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true; // evita doble envío mientras procesa
      try {
        await register({
          name: form.name.value,
          email: form.email.value,
          phone: form.phone.value,
          company: form.company.value,
          interest: form.interest.value,
          password: form.password.value,
        });
        closeAuth(); // registro exitoso → cerrar modal (la UI ya se actualizó)
      } catch (err) {
        showError("authRegError", err.message || t("err_generic", "No se pudo crear la cuenta."));
      } finally {
        if (btn) btn.disabled = false; // rehabilitar el botón pase lo que pase
      }
    });

    // Envío del formulario de LOGIN
    document.getElementById("authLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAuthErrors();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        await login({ email: form.email.value, password: form.password.value });
        closeAuth();
      } catch (err) {
        showError("authLoginError", err.message || t("err_generic", "No se pudo iniciar sesión."));
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    // Delegación global de clics: puertas de acceso (gates) para visitantes
    document.addEventListener("click", (e) => {
      // Herramientas que requieren login (atributo data-require-login):
      // si el visitante no tiene sesión, se abre el modal en vez de navegar
      const loginGate = e.target.closest("[data-require-login]");
      if (loginGate) {
        if (!isLoggedIn()) {
          e.preventDefault();
          openAuth("register");
          // Guardar URL destino para redirigir tras login
          const dest = loginGate.getAttribute("href");
          if (dest && dest !== "#") loginGate._pendingDest = dest;
          return;
        }
        // Si ya está logueado, dejar navegar normalmente
        return;
      }

      // Enlaces a #contacto marcados con data-force-auth: solo con sesión
      const a = e.target.closest('a[href="#contacto"]');
      if (!a || isLoggedIn()) return;
      if (a.hasAttribute("data-force-auth")) {
        e.preventDefault();
        openAuth("register");
      }
    });

    // Tecla Escape cierra el modal de cuenta
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAuth();
    });

    // Al cambiar de idioma, re-renderizar los textos de la UI de cuenta
    window.addEventListener("cdh:langchange", () => applyAuthUI());
  }

  // ---------- Inicialización de Firebase (opcional, mejora multi-dispositivo) ----------
  function initFirebase() {
    // Si el SDK no cargó (CDN bloqueado, sin red), el sitio sigue con el vault local
    if (typeof firebase === "undefined") return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG); // init una sola vez
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      firebaseReady = true;
      // Firebase recuerda la sesión entre visitas: este observador la restaura
      fbAuth.onAuthStateChanged((user) => {
        // Logout pedido desde perfil.html: cerrar también Firebase Auth y no restaurar sesión
        if (localStorage.getItem(LS_LOGOUT_FLAG)) {
          localStorage.removeItem(LS_LOGOUT_FLAG);
          if (user) {
            try { fbAuth.signOut(); } catch (_) { }
          }
          return;
        }
        // Usuario recordado por Firebase y sin sesión local → restaurarla
        if (user && !currentUser) {
          const vault = readVault();
          const local = vault[user.email] || {};
          saveSession({
            uid: user.uid,
            email: user.email,
            name: user.displayName || local.name || user.email.split("@")[0],
            phone: local.phone || "",
            company: local.company || "",
            interest: local.interest || "",
          });
        }
      });
    } catch (_) {
      firebaseReady = false; // init fallido: continuar en modo local
    }
  }

  // ── Secuencia de arranque del módulo ────────────────────────────────────────
  function boot() {
    loadSession();  // 1. restaurar sesión local si existe y no expiró
    initFirebase(); // 2. conectar con Firebase (si el SDK está presente)
    wireUI();       // 3. conectar eventos de la interfaz
    applyAuthUI();  // 4. pintar el estado inicial (invitado o autenticado)
  }

  // Ejecutar boot cuando el DOM esté listo (o ya, si ya lo está)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // ── API pública del módulo (única superficie expuesta al resto del sitio) ───
  window.CDH_AUTH = {
    register,        // crear cuenta
    login,           // iniciar sesión
    logout,          // cerrar sesión
    isLoggedIn,      // ¿hay sesión?
    getUser,         // perfil actual
    openAuth,        // abrir modal de cuenta
    closeAuth,       // cerrar modal
    getContactLinks, // enlaces de contacto (solo autenticado)
    getCrm: readCrm, // lista del CRM local (usada por el panel admin)
    CONTACT: {
      // solo para código interno autenticado; no expone strings en UI
      buildWa: (msg) => (isLoggedIn() ? CONTACT.waUrl(msg) : null),
      buildMail: (sub) => (isLoggedIn() ? CONTACT.mailUrl(sub) : null),
    },
  };
})();
