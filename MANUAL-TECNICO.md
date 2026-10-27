# Manual Técnico — Plataforma CDH Maker

**Autor:** Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
**Contacto:** cdhmaker@gmail.com
**Sitio en producción:** https://cdh-maker-portafolio.web.app/
**Última actualización:** 2026-07-19

---

## 1. Visión general

La plataforma es un **sitio estático** (HTML + CSS + JavaScript puro, sin frameworks ni build) alojado en **Firebase Hosting**, con **Firebase Auth + Firestore** como capa opcional de nube. Todo el código corre en el navegador del visitante; no hay servidor propio que mantener.

Funcionalidades principales:

| Funcionalidad | Archivo responsable |
|---|---|
| Página principal del portafolio | `public/index.html` |
| Estilos y sistema de temas claro/oscuro | `public/styles.css` + `public/theme.js` |
| Fondo animado: construcción LEGO de los productos | `public/metaverse.js` |
| Interacciones (scroll, animaciones, FAQ…) | `public/script.js` |
| Internacionalización (10 idiomas) | `public/i18n.js` |
| Cuentas de cliente + CRM + contacto protegido | `public/auth.js` |
| Chatbot asesor "Maker" (ES/EN) | `public/chatbot.js` |
| Protección anti-inspección/copia | `public/security.js` |
| Panel del cliente (Mi Perfil) | `public/perfil.html` |
| Panel admin de clientes (CRM) | `public/admin-clientes.html` |
| Reglas de seguridad de la base de datos | `firestore.rules` |
| Configuración de hosting y cabeceras | `firebase.json` |

## 2. Estructura del repositorio

```
PORTAFOLIO HCT/
├── firebase.json          # Hosting: carpeta pública, cleanUrls, cabeceras de caché/seguridad
├── .firebaserc            # Proyecto Firebase asociado (cdh-maker-portafolio)
├── firestore.rules        # Reglas de acceso a Firestore (colección clients)
├── README.md              # Resumen del proyecto
├── MANUAL-TECNICO.md      # Este documento
├── _originales-media/     # Copias sin comprimir (NO se publican: fuera de public/)
├── tools/                 # Scripts de build (NO se publican)
│   ├── build-i18n.mjs     # Genera las páginas por idioma y por servicio, sitemap.xml y llms.txt (§8.3, §8.4)
│   └── servicios/         # Textos de las páginas por servicio: es.mjs (fuente) + un archivo por idioma (§8.4)
│   └── indexnow.mjs       # Avisa a Bing/IndexNow tras cada deploy (§11)
└── public/                # TODO lo que se publica en el hosting
    ├── index.html         # Página principal en español (FUENTE de las demás)
    ├── en.html … id.html  # GENERADAS: una por idioma (/en, /zh, /hi, /ar, /pt, /bn, /ru, /fr, /id)
    ├── 404.html           # Página de "no encontrado" (Firebase la sirve sola)
    ├── llms.txt           # GENERADO: resumen del negocio para modelos de lenguaje
    ├── <clave>.txt        # Clave de verificación de IndexNow (32 caracteres hex)
    ├── perfil.html        # Panel del cliente autenticado
    ├── admin-clientes.html# Panel admin (protegido por clave con hash SHA-256)
    ├── styles.css         # Estilos completos (temas con variables CSS)
    ├── theme.js           # Alternancia claro/oscuro (localStorage: cdh-theme)
    ├── security.js        # Capa anti-inspección (solo en producción)
    ├── metaverse.js       # Canvas de fondo animado (núcleo tecnológico)
    ├── script.js          # Interacciones de index.html
    ├── i18n.js            # Motor de idiomas (los diccionarios van aparte)
    ├── i18n/              # Un diccionario por idioma, cargado bajo demanda
    │   ├── es.js  en.js  zh.js  hi.js  ar.js
    │   └── pt.js  bn.js  ru.js  fr.js  id.js
    ├── auth.js            # Autenticación, sesión, CRM y contacto ofuscado
    ├── voice.js           # Voz del asesor (Web Speech API) → window.CDH_VOICE
    ├── chatbot.js         # Chatbot de reglas "Maker" (motor conversacional)
    ├── chatbot-kb.js      # Base de conocimiento del chatbot (cargada bajo demanda)
    ├── ads.js             # Cinta de Shorts + ofertas tras el hero (media/shorts.json)
    ├── icon.svg           # Ícono del sitio (favicon + PWA)
    ├── manifest.json      # Manifiesto PWA
    ├── robots.txt         # Reglas de rastreo (bots de IA bienvenidos; excluye perfil y admin)
    ├── sitemap.xml        # GENERADO: portada + páginas de servicio, cada una en 10 idiomas con hreflang
    ├── servicios/         # GENERADO: páginas por servicio en español (/servicios/…)
    ├── <código>/services/ # GENERADO: las mismas páginas en los otros 9 idiomas (/en/services/…)
    └── media/             # Imágenes (WebP + original) y video de proyectos
```

> **Nota:** `firebase.json`, `.firebaserc` y `manifest.json` son JSON puro y **no admiten comentarios**; su documentación vive en este manual.

## 3. Orden de carga de scripts (index.html)

El orden **importa** y no debe cambiarse sin revisar dependencias:

1. `theme.js` (en `<head>`) — aplica el tema antes del primer render (evita parpadeo).
2. `security.js` (en `<head>`) — activa la protección lo antes posible.
3. `metaverse.js` — fondo animado "núcleo tecnológico": seis capas compuestas en un
   canvas 2D (atmósfera con halo, malla en perspectiva hacia el horizonte, campo de
   partículas 3D con paralaje, red neuronal de nodos, paquetes de datos que viajan por
   las aristas y HUD holográfico con barrido de escaneo). Respeta ambos temas,
   `prefers-reduced-motion`, DPR y se pausa con la pestaña oculta.
4. `i18n.js` — idiomas (publica `window.CDH_I18N` y `window.CDH_TYPED`).
5. `auth.js` — cuentas (publica `window.CDH_AUTH`). **Ya no requiere que Firebase esté
   cargado de antemano**: el SDK se descarga bajo demanda (ver §4.5).
6. `script.js` — interacciones generales.
7. `chatbot.js` — chatbot 100% texto con memoria conversacional avanzada (mantiene el contexto del proyecto y la sesión, conectando a `chatbot-kb.js`).
8. `ads.js` — cinta animada de Shorts (ClipFactory) y ofertas, en la banda `#cinta` tras el hero.
   `tools/sync-shorts.mjs` (predeploy) escribe `media/shorts.json` desde el RSS del canal.
9. `/ref.js` (defer) — afiliados `?ref=` (lo mantiene el Frente B del panel).

> El SDK de Firebase **ya no se carga desde el HTML**. Eran ~300 KB en cada visita y la
> mayoría de visitantes nunca crea cuenta.

### Comunicación entre módulos (eventos personalizados)

| Evento | Lo emite | Lo escuchan |
|---|---|---|
| `cdh:themechange` | theme.js | metaverse.js (re-colorea el canvas) |
| `cdh:langchange` | i18n.js | script.js (texto rotativo), auth.js (UI), chatbot.js (textos) |
| `cdh:authchange` | auth.js | chatbot.js y cualquier interesado en la sesión |

### APIs globales publicadas

- `window.CDH_AUTH` — register, login, logout, isLoggedIn, getUser, openAuth, getContactLinks, getCrm.
- `window.CDH_I18N` — apply(lang), LANGS.
- `window.CDH_SECURITY` — enabled, flashGuard.
- `window.CDH_TYPED` — palabras traducidas del texto rotativo del hero.

## 4. Sistema de autenticación y sesión

### 4.1 Arquitectura de dos niveles

1. **Firebase Auth (nube):** si está habilitado en la consola, las cuentas se crean/inician ahí (multi-dispositivo).
2. **Vault local (respaldo):** si Firebase no responde, la cuenta vive en `localStorage` con hash **PBKDF2** (120 000 iteraciones SHA-256 + sal aleatoria). La contraseña **nunca** se guarda en claro.

### 4.2 Claves de localStorage

| Clave | Contenido |
|---|---|
| `cdh_client_session_v1` | Sesión activa: `{uid, email, name, phone, company, interest, at}` |
| `cdh_clients_vault_v1` | Credenciales locales: `{email: {uid, name, …, hash, salt}}` |
| `cdh_clients_crm_v1` | CRM local: array de clientes registrados en ese navegador |
| `cdh_logout_pending_v1` | Flag que deja perfil.html para que auth.js cierre también Firebase |
| `cdh-theme` / `cdh-lang` | Preferencias de tema e idioma |

- La sesión **expira a los 30 días** (campo `at`). perfil.html usa exactamente la misma clave y expiración.
- El **flujo de logout desde perfil.html**: borra la sesión, deja el flag `cdh_logout_pending_v1` y redirige; al cargar index.html, `auth.js` ve el flag y hace `signOut()` de Firebase para que la sesión no "resucite".

### 4.3 Registro de un cliente (qué pasa al enviar el formulario)

1. Validación de campos (mensajes traducidos por i18n).
2. Intento de alta en Firebase Auth (si falla por falta de configuración, continúa).
3. Alta en el vault local (hash PBKDF2).
4. `saveClientCloud()`: guarda en el CRM local **y** en Firestore (`clients/{uid}`).
5. `notifyNewClient()`: correo de aviso vía FormSubmit a la bandeja de CDH Maker.
6. Se abre la sesión y toda la UI se actualiza (`applyAuthUI`).

### 4.4 Contacto protegido (anti-scraping)

El número de WhatsApp y el correo están **ofuscados con Shift-3** (cada carácter desplazado +3) y solo se decodifican al hacer clic **con sesión iniciada**. Los `href` visibles siempre son `#` para que el dato no aparezca ni al pasar el mouse. Un bot que rastree el HTML nunca ve el número ni el correo en claro.

### 4.5 Carga diferida del SDK de Firebase

El SDK compat (app + auth + firestore) pesa unos **300 KB** y solo hace falta para quien
tiene cuenta. Desde julio de 2026 no viaja en el HTML: lo inyecta `auth.js` mediante
`ensureFirebase()`, que garantiza una sola descarga por sesión.

Se dispara en tres momentos:

| Momento | Motivo |
|---|---|
| `openAuth()` | El visitante abrió el área de clientes: va a registrarse o entrar |
| `register()` / `login()` | Ambas son `async` y hacen `await ensureFirebase()` antes de operar |
| `boot()`, en tiempo libre | Solo si `cdh_fb_used_v1` o `cdh_client_session_v1` existen |

`cdh_fb_used_v1` se escribe la primera vez que Firebase reporta un usuario, para que en
las visitas siguientes el SDK se precargue con `requestIdleCallback` y la sesión
multi-dispositivo se restaure sola.

**Si el CDN falla o no hay red**, `firebaseReady` queda en `false` y todo el flujo sigue
funcionando contra el vault local, igual que antes.

## 5. Panel del cliente (perfil.html)

- Lee la sesión de `cdh_client_session_v1`; si no existe o expiró → redirige a index.
- Muestra: nombre, email, empresa, teléfono + herramientas del cliente.
- **Panel de administrador**: solo visible si el email de la sesión está en la lista exacta `ADMIN_EMAILS` (`henrytaborda57@gmail.com`, `cdhmaker@gmail.com`). Para autorizar otro correo, añádelo a ese array en perfil.html.

## 6. Panel admin (admin-clientes.html)

- Protegido por clave. En el código **solo existe el hash SHA-256** de la clave, nunca la clave en claro.
- Para **cambiar la clave**: genera el hash nuevo y reemplaza `ADMIN_KEY_HASH`:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('TU_NUEVA_CLAVE').digest('hex'))"
```

- Muestra los clientes del CRM **de ese navegador** (localStorage). La vista global multi-dispositivo está en la Consola de Firebase → Firestore → colección `clients`.
- Exporta CSV con todos los registros.
- No indexable: `noindex` + cabecera `X-Robots-Tag` + `Cache-Control: no-store` (ver firebase.json).

## 7. Seguridad

### 7.1 Capa cliente (security.js) — disuasoria

- Bloquea clic derecho, F12, Ctrl+Shift+I/J/C/K, Ctrl+U/S/P y Ctrl+A (fuera de formularios).
- Bloquea arrastre de imágenes, selección y copia fuera de formularios/chat.
- Detecta DevTools por **pausa del debugger** (sin heurísticas de tamaño de ventana, que daban falsos positivos con zoom) y difumina el sitio mientras estén abiertas.
- Anula los métodos de `console` en producción.
- **Desactivada** en localhost y con `?bypass_security=cdh2026` (para poder desarrollar).
- ⚠️ Es una capa **disuasoria**: ningún bloqueo de cliente es infranqueable. La seguridad real está en el punto 7.2.

### 7.2 Capa servidor — real

- **firestore.rules**: cada usuario solo lee/edita su propio documento; nadie borra; crear requiere autenticación y campos válidos.
- **Cabeceras HTTP** (firebase.json): `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` (cámara/micrófono/geolocalización deshabilitados).
- Las claves de `FB_CONFIG` en auth.js son **públicas por diseño** de Firebase; no son un secreto (la protección la dan las reglas).

## 8. Internacionalización (i18n.js + i18n/)

- 10 idiomas: es, en, zh, hi, ar, pt, bn, ru, fr, id. El árabe activa `dir="rtl"`.
- **Cada idioma tiene su propia URL y su propio HTML estático**: `/` (español), `/en`,
  `/zh`, `/hi`, `/ar`, `/pt`, `/bn`, `/ru`, `/fr`, `/id`. Los generan `tools/build-i18n.mjs`
  a partir de `index.html` + `i18n/<código>.js` (§8.3). Así los rastreadores de IA, que no
  ejecutan JavaScript, leen el sitio completo en todos los idiomas.
- Todo texto traducible lleva `data-i18n="clave"` en el HTML (o `data-i18n-aria` para
  aria-labels, `data-i18n-alt` para el texto alternativo de imágenes y `data-i18n-html` si
  la traducción contiene etiquetas).
- **El idioma lo decide la URL.** El selector del menú lleva a la URL del idioma elegido y
  guarda la elección (`localStorage: cdh-lang-v2`; cerrar el aviso solo lo silencia). Los enlaces viejos `?lang=xx` se convierten
  en `/xx`. Si el navegador está en otro idioma disponible aparece un aviso discreto con el
  enlace (solo tras la primera interacción del visitante): **nunca se redirige solo**, porque
  Google y los rastreadores de IA lo penalizan. La portada `/` sí lleva a la URL del idioma
  que el visitante eligió explícitamente antes.
- El cotizador, el visor 3D, la cinta de la portada y el chat de WhatsApp tienen sus textos en
  los 10 idiomas dentro de su propio archivo (objetos `C` / `T`).

### 8.1 Diccionarios separados y carga bajo demanda

`i18n.js` es **solo el motor** (8,8 KB). Los diccionarios viven uno por archivo en
`public/i18n/<código>.js` y se descargan únicamente cuando alguien usa ese idioma.

| Escenario | Se descarga | Antes |
|---|---|---|
| Visita en español (lo habitual) | **nada** — 8,8 KB de motor | 103,4 KB |
| Visita en inglés | en.js (9,9 KB) → 18,7 KB | 103,4 KB |
| Peor caso (bengalí, 15,3 KB) | 24,1 KB | 103,4 KB |

**Por qué el español no descarga nada:** el HTML ya está escrito en español, así que no
hay nada que reemplazar. El motor lleva incrustado `ES_MINIMO`, que solo contiene
`hero_typed` (las palabras del texto rotativo, que no existen en el DOM). En cuanto el
visitante cambia a otro idioma se marca `domTraducido = true`; a partir de ahí volver al
español **sí** descarga `es.js`, porque hace falta el diccionario completo para restaurar
los textos que se sobrescribieron.

Cada archivo se registra solo:

```js
window.CDH_I18N_DICT = window.CDH_I18N_DICT || {};
window.CDH_I18N_DICT["fr"] = { …claves… };
```

`apply(lang)` **devuelve una promesa** (antes era síncrona). Si la descarga falla —sin red
o archivo caído— se conserva el idioma que el visitante ya está viendo, el selector vuelve
a su valor anterior y se avisa por consola; la página nunca queda a medio traducir.

> Con las páginas estáticas, en cada página solo se descarga el diccionario de SU idioma
> (para el texto rotativo del hero); el español sigue sin descargar nada.

### 8.2 Editar o añadir traducciones

- **Cambiar un texto en español:** edítalo directamente en `public/index.html` y corre
  `node tools/build-i18n.mjs`. El HTML manda: el script copia el texto a `i18n/es.js`.
- **Corregir otro idioma:** abre `public/i18n/<código>.js`, busca la clave, edítala, sube
  `DICT_V` en `i18n.js` y corre `node tools/build-i18n.mjs`.
- **Añadir un texto nuevo:** márcalo en `index.html` con `data-i18n="clave_nueva"` y agrega
  `clave_nueva` a los 9 diccionarios restantes. El build avisa con `⚠ <idioma>: N clave(s)
  sin traducir` si alguno falta (en esa página el texto queda en español).
- **Añadir un idioma:** agrégalo a `LANGS` en `i18n.js` **y** en `tools/build-i18n.mjs`,
  crea `public/i18n/<código>.js` copiando la estructura de otro, agrega su enlace a la fila
  de idiomas del footer de `index.html` y a la regla de `firebase.json` que le pone
  cabeceras a `/@(en|zh|…)`.

### 8.3 Páginas por idioma, SEO y visibilidad en asistentes de IA (tools/build-i18n.mjs)

`node tools/build-i18n.mjs` (Node ≥ 18, sin dependencias) hace, en orden:

1. Sincroniza `i18n/es.js` con los textos de `index.html`.
2. Rellena el bloque `seo:start … seo:end` del `<head>` de cada página: title, description,
   canonical, los 11 `hreflang` (10 idiomas + `x-default`), Open Graph, Twitter y el JSON-LD.
   **Ese bloque no se edita a mano**: se regenera en cada build.
3. Escribe `public/<código>.html` para los 9 idiomas restantes, con el `<body>` traducido.
4. Regenera `sitemap.xml` y `llms.txt`.

Lo que no depende del idioma vive en el bloque `§CONFIG` del script:

| Constante | Qué es |
|---|---|
| `SITE` | Dominio canónico (`https://cdhmaker.com`). Todo apunta aquí aunque el sitio también responda en `cdh-maker-portafolio.web.app`. |
| `ENTITY` | Nombre, correo, ciudad, idiomas de atención (es, en), fundador y **`sameAs`**: cada perfil público que se cree (Google Business Profile, LinkedIn, Clutch, YouTube…) se agrega aquí para que buscadores e IA lo asocien a la marca. |
| `PROJECTS` | Proyectos que aparecen en el JSON-LD con su URL. |

Claves de diccionario que solo usa la cabecera: `meta_title`, `meta_desc` (≤ 160
caracteres) y `person_job`.

**Por qué importa:** ChatGPT, Claude, Perplexity y Copilot no ejecutan JavaScript al leer
una página: antes de esto solo veían el español. El JSON-LD declara la organización
(`ProfessionalService`), a Henry Taborda como fundador (`Person`), los servicios
(`OfferCatalog`), los proyectos y las preguntas frecuentes, en el idioma de cada página.
`llms.txt` es un resumen en Markdown para modelos de lenguaje (convención de
llmstxt.org; es barato y opcional, pocos bots lo piden todavía).

`firebase.json` lo corre solo antes de cada deploy (`hosting.predeploy`). Aun así, conviene
correrlo y **hacer commit** de los archivos generados para que el repo refleje lo publicado.

### 8.4 Páginas por servicio y ciudad

Quien busca "impresión 3D Medellín" o "software a la medida Medellín" (en Google o
preguntándole a una IA) encuentra páginas con una URL propia por servicio y ciudad; una
portada con anclas compite peor. Por eso el mismo build genera, para cada servicio de
`SERVICES` en `tools/build-i18n.mjs`, una página en cada idioma:

| Servicio (`id`) | Español | Otros idiomas |
|---|---|---|
| `print3d` | `/servicios/impresion-3d-medellin` | `/<código>/services/3d-printing-medellin` |
| `software` | `/servicios/software-a-la-medida-medellin` | `/<código>/services/custom-software-medellin` |
| `ai` | `/servicios/inteligencia-artificial-medellin` | `/<código>/services/ai-integration-medellin` |
| `iot` | `/servicios/iot-automatizacion-medellin` | `/<código>/services/iot-automation-medellin` |

Cada página reutiliza el menú, el footer, los scripts y las secciones de **proceso** y
**contacto** de la portada ya traducida, y agrega: héroe con ruta de navegación, "qué
incluye", **tiempos de referencia**, proyectos relacionados (solo los que existen en
`#proyectos`), preguntas frecuentes del servicio y enlaces a los otros servicios. En el
`<head>`: title, description, canonical, hreflang de las 10 versiones y JSON-LD `Service`
(con `provider` = `https://cdhmaker.com/#org`), `BreadcrumbList`, `FAQPage` y `WebPage`
(que menciona los proyectos). También entran al `sitemap.xml` y a `llms.txt`.

- **Textos:** `tools/servicios/<código>.mjs`. `es.mjs` es la fuente; los demás repiten su
  estructura (mismas claves y mismo número de elementos en cada lista). Si a un idioma le
  falta algo, el build lo avisa como `servicios:<ruta>` y usa el español en ese hueco; con
  `--strict` falla. Un idioma **sin** archivo no genera páginas de servicio.
- **Tiempos:** nunca se escriben a mano. `{landing}`, `{app}`, `{auto}`, `{proto}`,
  `{product}`, `{iotauto}`, `{cad}`, `{fdm}` y `{resin}` se reemplazan con `TIME_WEB`,
  `TIME_IOT`, `TIME_DESIGN` y `PRICE` de `public/estimator.js`: si cambia el cotizador,
  cambian solas las páginas en el próximo build.
- **Regla del contenido:** solo datos que ya están en el sitio. No hay proyectos de
  impresión 3D ni de IoT en el portafolio, así que esas páginas no muestran proyectos
  relacionados; al agregar uno al portafolio, se suma su clave en `PROJECT_CARDS` y en
  `projects` del servicio.
- **Enlaces desde la portada:** tarjetas de `#servicios` (`card-link`), necesidades de
  `#soluciones` (`need-link`) y columna "Servicios" del footer, con las claves `fs_3d`,
  `fs_sw`, `fs_ai`, `fs_iot`. Los `href` se escriben en español en `index.html`; el build
  los cambia por la ruta de cada idioma.
- **Agregar un servicio:** una entrada en `SERVICES` (slug `es` y `en`, área, proyectos),
  su ícono en `SVC_ICON`, su bloque en los 10 `tools/servicios/<código>.mjs` y, si se quiere
  enlazar desde la portada, el enlace en `index.html` con `href="/servicios/<slug.es>"`
  (el build lo cambia solo por la ruta de cada idioma).
- **Hosting:** `firebase.json` aplica las cabeceras de seguridad también a `/servicios/**`
  y `/<código>/services/**`. Con `cleanUrls`, `/en` sigue sirviendo `en.html` aunque exista
  la carpeta `en/` (comprobado con `firebase serve`).

## 9. Chatbot "Maker" (chatbot.js)

- **Motor de reglas 100% en el navegador** — sin APIs externas, las conversaciones no salen del equipo del visitante.
- `INTENTS`: lista de intenciones con palabras clave ES+EN. `detectIntent()` puntúa coincidencias (claves largas ×2; claves cortas exigen palabra completa).
- **Tolerancia a erratas**: si ninguna clave coincide literalmente, `detectIntent()` compara
  cada palabra del mensaje con las claves usando el coeficiente de Dice sobre bigramas
  (umbral 0.82). Así "cuanto vale una *pagian* web" o "tienen *garantiaa*" se entienden.
- **Naturalidad**: `humanize()` antepone conectores variados ("Claro,", "Mira,", "Te
  cuento:") a parte de las respuestas, nunca dos veces el mismo seguido, nunca sobre frases
  que ya arrancan con un conector ni sobre respuestas cortas o que empiezan con un botón.
- Si el visitante tiene sesión, el saludo usa su **nombre de pila** (`nombreCliente()`).
- `TEXT`: todas las respuestas en es/en. Para cambiar cualquier texto del bot, se edita ahí.
- Los botones de "Cotizar por WhatsApp" pasan por `CDH_AUTH` → solo funcionan con sesión.

### 9.1 Voz del asesor (voice.js)

Cada respuesta se lee en voz alta con la **Web Speech API**: el audio se sintetiza en el
dispositivo del visitante, suena al instante, no cuesta nada y no viaja ningún dato.

- `botSay()` llama a `CDH_VOICE.speak(html)` justo después de pintar el mensaje.
- **Selección de voz**: `pickVoice()` puntúa las voces del sistema por cercanía regional
  (es-CO → es-MX → … → es-ES) y por calidad, premiando las neuronales (nombres con
  *Natural*, *Neural*, *Online*, *Premium*…).
- **Limpieza**: `toPlainText()` quita etiquetas, botones, URLs, correos y emojis.
- **Troceo**: `splitSentences()` parte en frases de ≤180 caracteres, porque varios motores
  cortan el audio si reciben todo de una vez.
- **Watchdog**: Chrome suspende la síntesis a los ~14 s; un `pause()/resume()` cada 9 s lo evita.
- **Preferencia**: botón de altavoz en la cabecera del chat; el estado se guarda en
  `cdh_voice_on` (por defecto **encendido**). La voz se corta al cerrar el chat, al cambiar
  de idioma, al ocultar la pestaña y cuando el visitante escribe.

> **Calidad de la voz:** depende de las voces instaladas en el sistema del visitante, no del
> código. Windows trae por defecto voces SAPI antiguas (Sabina, Raul) que suenan robóticas.
> Microsoft Edge expone voces neuronales *Online (Natural)* que el selector detecta y
> prefiere automáticamente. En Windows 11 se instalan más desde
> *Configuración → Accesibilidad → Narrador → Agregar voces naturales*.

## 10. Caché y versionado de archivos

`firebase.json` define: HTML sin caché (`no-cache`), CSS/JS con caché de 1 hora, imágenes
y videos de `media/` con caché de 7 días (si reemplazas un archivo de `media/` conservando
el nombre, súbele `?v=` donde se use o cámbiale el nombre).
Por eso **cada vez que edites un .js o .css debes subir su versión** en las etiquetas de los HTML:

```html
<script src="auth.js?v=6"></script>   <!-- v=5 → v=6 al editar auth.js -->
<link rel="stylesheet" href="styles.css?v=19" />
```

Si no lo haces, los visitantes recientes verán la versión vieja hasta 1 hora.

**Excepción — los diccionarios de idioma.** Los archivos de `public/i18n/` no se enlazan
desde el HTML: los pide `i18n.js` en tiempo de ejecución. Su versión se controla con la
constante `DICT_V` dentro de `i18n.js`; súbela cuando corrijas cualquier traducción.

## 11. Desarrollo local y despliegue

```bash
# Servir en local (la capa de seguridad se desactiva sola en localhost)
firebase serve

# Desplegar todo (hosting + reglas de Firestore)
firebase deploy --only hosting,firestore:rules

# Solo hosting
firebase deploy --only hosting

# Después de desplegar: avisar a Bing (ChatGPT, Copilot y DuckDuckGo usan su índice)
node tools/indexnow.mjs
```

Requisitos: Node.js + Firebase CLI (`npm i -g firebase-tools`) con sesión de la cuenta cdhmaker@gmail.com (`firebase login`).

El deploy corre primero `node tools/build-i18n.mjs` (predeploy). En local, `npx serve public`
sirve `/en`, `/pt`… igual que Firebase (ambos con *clean URLs*); `firebase serve` también.
Una URL con barra final (`/en/`) se redirige con 301 a `/en`.

## 12. Aliados del footer ("Nuestros aliados")

La columna **Nuestros aliados** del footer se mantiene directamente en el código. Para agregar uno nuevo:

1. Abre `public/index.html` y busca el comentario `<!-- Aliados: ... -->` (es la columna cuyo título lleva `data-i18n="foot_allies_h"`).
2. Debajo del último aliado, duplica la línea `<a>` y cambia la URL y el nombre:

   ```html
   <a href="https://www.galacticaima.com" target="_blank" rel="noopener">Galactic AIMA</a>
   <a href="https://sitio-del-aliado.com" target="_blank" rel="noopener">Nombre del Aliado</a>
   ```

   Conserva siempre `target="_blank" rel="noopener"` (abre en pestaña nueva de forma segura).
3. El nombre del aliado es una marca propia: **no se traduce** (por eso el `<a>` no lleva `data-i18n`). El título de la columna sí está traducido a los 10 idiomas en `i18n.js`, bajo la clave `foot_allies_h`.
4. Guarda y despliega: `firebase deploy --only hosting`. Como `index.html` se sirve sin caché (§10), el cambio se ve de inmediato y **no** hace falta subir versiones de `.js`/`.css` si solo tocaste esta lista.

Nota: si algún día prefieres logos en vez de texto, sube la imagen a `public/media/` y sustituye el texto del `<a>` por `<img src="media/logo-aliado.png" alt="Nombre del Aliado" />`.

## 13. Guías rápidas de mantenimiento

| Quiero… | Dónde |
|---|---|
| Cambiar un texto del sitio | Español: `index.html`. Otro idioma: `i18n/<código>.js`. Luego `node tools/build-i18n.mjs` (§8.2) |
| Cambiar title / description de Google | `i18n/<código>.js` → `meta_title`, `meta_desc` + build |
| Agregar un perfil (LinkedIn, Google Business…) a los datos para IA | `tools/build-i18n.mjs` → `ENTITY.sameAs` + build |
| Cambiar textos del chatbot | `chatbot.js` → objeto `TEXT` (bloques es/en) |
| Enseñar un tema nuevo al chatbot | `chatbot.js` → `INTENTS` + respuesta en `TEXT` |
| Cambiar el texto de una página de servicio | `tools/servicios/<código>.mjs` (español: `es.mjs`) + build (§8.4) |
| Añadir un proyecto al portafolio | `index.html` sección Proyectos + imagen en `media/` + claves en los 9 `i18n/<código>.js` + entrada en `PROJECTS` de `tools/build-i18n.mjs` + build |
| Agregar un aliado al footer | `index.html` columna "Nuestros aliados" (pasos completos en §12) |
| Cambiar colores / tema | `styles.css` → variables `:root` (dark y light) |
| Autorizar otro email como admin | `perfil.html` → array `ADMIN_EMAILS` |
| Cambiar la clave del panel CRM | `admin-clientes.html` → `ADMIN_KEY_HASH` (ver §6) |
| Cambiar número o correo de contacto | `auth.js` → funciones de `CONTACT` (recuerda ofuscar con Shift+3) |
| Ver todos los clientes registrados | Consola Firebase → Firestore → `clients` (o `/admin-clientes` local) |

## 14. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| No entra al perfil (vuelve al home) | Sesión expirada (>30 días) o no iniciada | Iniciar sesión de nuevo |
| No aparece el panel admin en el perfil | El correo de la sesión no está en `ADMIN_EMAILS` | Añadirlo en perfil.html |
| Cambié un .js y no se ve el cambio | Caché de 1 h del hosting | Subir `?v=` en el HTML y redesplegar |
| El sitio se ve difuminado | security.js detectó DevTools abiertas | Cerrarlas, o usar `?bypass_security=cdh2026` |
| Registro no llega al correo | FormSubmit caído o correo en spam | El registro igual queda en CRM local y Firestore |
| Login falla con cuenta antigua | Cuenta creada solo en vault local de OTRO navegador | El vault es por navegador; registrar de nuevo o activar Firebase Auth |

---
*Documento generado como parte de la documentación oficial de la plataforma CDH Maker.*
