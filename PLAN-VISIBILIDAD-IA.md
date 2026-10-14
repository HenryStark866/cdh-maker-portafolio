# Plan para que las IA recomienden a CDH Maker

*Preparado el 2026-10-14 a partir de una auditoría del sitio en vivo, la presencia de la marca
en la web y la documentación vigente de cada buscador y asistente.*

## Lo que hay que saber primero

Ninguna IA tiene un formulario para "ser recomendado". Cada una responde con dos fuentes:

1. **Un índice de búsqueda.** ChatGPT y Copilot usan **Bing** (además de su propio rastreo).
   Gemini y los AI Overviews usan **Google**. Claude usa **Brave** y su propio bot. Perplexity
   tiene índice propio. Estar bien indexado en Google, Bing y Brave cubre casi todo.
2. **Lo que otros dicen de ti.** Las menciones en YouTube, Reddit, LinkedIn, directorios (Clutch,
   GoodFirms) y reseñas pesan mucho más que los enlaces. Según un estudio de Ahrefs sobre
   75.000 marcas, las menciones en YouTube son el factor con mayor correlación (0,74).

**Dónde estás hoy:** al buscar "CDH Maker", los buscadores devuelven a CDHPOWER (un fabricante
chino de motores) y una hernia congénita (CDH). La única fuente externa que te conecta con la
marca es tu repo de GitHub. El código ya quedó listo (ver al final). Lo que falta es que el
resto de internet sepa que existes, y eso **solo lo puedes hacer tú**. Nadie puede garantizar
que una IA te recomiende. Lo que sí está en tus manos es darles todas las razones para hacerlo.

## Semana 1 — publicar e indexar (≈ 2 horas)

- [ ] **Desplegar** los cambios (`firebase deploy --only hosting`) y luego correr `node tools/indexnow.mjs`.
- [ ] **Firebase → Hosting → Dominios:** deja `cdhmaker.com` como dominio principal y configura
      `www.cdhmaker.com` para que **redirija** a `cdhmaker.com`. Hoy los 4 dominios responden
      con la misma página. El código ya declara `cdhmaker.com` como el oficial (canonical).
- [ ] **Google Search Console** (search.google.com/search-console): agrega la propiedad de dominio
      `cdhmaker.com` (verificación por registro TXT en Cloudflare). Envía el sitemap
      `https://cdhmaker.com/sitemap.xml` y pide la indexación de `/` y `/en`.
- [ ] **Bing Webmaster Tools** (bing.com/webmasters): impórtalo desde Search Console y envía el
      mismo sitemap. Revisa el informe **AI Performance**: es el único que hoy muestra cuándo
      Copilot y Bing te citan, y con qué preguntas.
- [ ] **Brave** (search.brave.com/submit-url): envía `https://cdhmaker.com/` y `https://cdhmaker.com/en`.
      Claude busca con Brave.
- [ ] **GitHub** (la única fuente externa indexada hoy):
  - Cambia el nombre del perfil de "CDH Maker IT" a "Henry Taborda · CDH Maker".
  - Escribe una bio con tus servicios y "Medellín, Colombia".
  - Pon como web `https://cdhmaker.com`.
  - Crea un README de perfil (repo `HenryStark866/HenryStark866`).
  - En el repo `cdh-maker-portafolio`, agrega homepage y topics (`3d-printing`, `iot`, `saas`,
    `medellin`, `colombia`).
  - El repo `taxiya` es privado, pero DuckDuckGo lo muestra en 4 de sus 6 resultados para
    "CDH Maker" y lleva a un 404. Considera crear un repo público de vitrina para TaxiYa.

## Mes 1 — que existas fuera de tu sitio

- [ ] **Enlaces que ya controlas.** Cada uno es una mención de terceros gratis:
  - A Tiempo Logística: el pie dice "CDH Maker IT" y enlaza a web.app. Cámbialo por
    "CDH Maker" con enlace a `https://cdhmaker.com`.
  - TaxiYa e IncubApp: mencionan a CDH Maker solo dentro del JavaScript, que las IA no leen.
    Agrega al HTML estático un pie "Desarrollado por CDH Maker" con enlace y `<meta name="author">`.
  - PrivacyCheck: no te menciona en ninguna parte. Si el acuerdo con CAVALTEC lo permite,
    agrega "Desarrollado por CDH Maker para CAVALTEC".
  - Galactic AIMA: pídeles el enlace recíproco de aliado.
- [ ] **Google Business Profile** como *negocio de área de servicio* en Medellín. Es elegible
      si entregas piezas o atiendes en persona. Usa exactamente "CDH Maker" como nombre y oculta
      la dirección si trabajas desde casa. Después, importa el perfil a **Bing Places**
      (bing.com/forbusiness): ChatGPT ha usado Bing Places para recomendaciones locales.
- [ ] **Reseñas:** pide a 3–5 clientes reales una reseña en Google. En servicios digitales, las
      IA citan sobre todo a **Clutch** y **GoodFirms**: crea perfil en ambos y pide reseñas
      verificadas allí.
- [ ] **LinkedIn:** perfil personal ("Ingeniero · Fundador de CDH Maker") y página de empresa.
      Publica cada proyecto como caso.
- [ ] **YouTube:** sube el demo de PrivacyCheck, el video del anuncio y demos de TaxiYa e IncubApp,
      con "CDH Maker" en el título y el enlace a cdhmaker.com en la descripción.
- [ ] **Directorios del sector:** 3Dnatives (impresión 3D), TechBehemoths e iotcolombia.org
      (IoT), y Workana o Upwork (software).
- [ ] **Cada perfil nuevo** (su URL) va en `ENTITY.sameAs` de `tools/build-i18n.mjs`. Después:
      build y deploy. Así los datos estructurados le dicen a cada IA "este perfil también es CDH Maker".

## Continuo — autoridad

- [ ] **Casos con cifras.** El estudio académico de GEO (KDD 2024) midió que las citas textuales
      de clientes suben la visibilidad en respuestas de IA hasta +41 %, y las estadísticas
      alrededor de +33 %. Por cada proyecto: fecha, problema, resultado medible y una frase
      del cliente.
- [ ] **Reddit y comunidades:** participa de forma genuina, sin spam, en r/3Dprinting, r/esp32,
      r/webdev, r/Colombia y r/medellin. Reddit y YouTube son las únicas fuentes que citan
      todos los asistentes.
- [ ] **Prensa local** (ecosistema Ruta N, medios tech de Medellín) sobre TaxiYa o IncubApp.
- [ ] **Wikidata:** crea los ítems de CDH Maker y Henry Taborda solo cuando haya referencias
      públicas de terceros. Antes de eso los borran.
- [ ] **Medición mensual:**
  - Revisa el informe AI Performance de Bing y Search Console.
  - Hazle las mismas 5 preguntas a ChatGPT, Claude, Gemini y Perplexity, por ejemplo:
    "¿quién hace impresión 3D en Medellín?" o "¿quién desarrolla SaaS a la medida en Colombia?".
  - Anota quién aparece.

## Decisiones que quedan en tus manos

- **Un solo nombre de marca.** El logo dice "Maker IT", GitHub dice "CDH Maker IT" y el pie de
  A Tiempo también, pero el sitio dice "CDH Maker". Las IA confunden "CDH" con otras empresas,
  así que conviene usar siempre "CDH Maker" junto a tu nombre.
- **WhatsApp público.** Hoy el número va cifrado y una IA no puede decirle a nadie cómo
  contactarte. Para eso solo tiene el correo (ya está en los datos estructurados). Publicar el
  número en el JSON-LD (`telephone`) ayuda, pero puede traer spam.
- **Anti-copia (security.js).** Bloquear la selección y la copia impide que alguien copie tu
  nombre o un servicio para pegarlo en ChatGPT. También afecta la accesibilidad (lectores de
  pantalla, "leer en voz alta"). La trampa de `debugger` puede desenfocar el sitio para agentes
  de IA que navegan con herramientas de depuración.
- **Páginas por servicio.** Los competidores que salen en "impresión 3D Medellín" o "software a
  la medida Medellín" tienen una URL propia por servicio y ciudad. Es el siguiente paso grande
  en el código.

## Lo que ya quedó hecho en el código

- **Una página estática por idioma** (`/`, `/en`, `/zh`, `/hi`, `/ar`, `/pt`, `/bn`, `/ru`,
  `/fr`, `/id`), cada una con title, description, canonical y hreflang propios. Antes los
  rastreadores de IA solo veían el español, y Google podía indexar la portada mezclada en inglés.
- **JSON-LD completo en cada idioma:** organización, Henry Taborda como fundador, servicios,
  proyectos, área atendida (mundo y Colombia), idiomas de atención (español e inglés) y 9
  preguntas frecuentes.
- **Contenido nuevo pensado en cómo pregunta la gente:**
  - La sección "¿Qué necesitas resolver?", con 8 necesidades (varias con un proyecto real como prueba).
  - 5 preguntas frecuentes nuevas (tiempos, IA, tecnologías, fabricación por encargo y quién
    está detrás).
  - Tu nombre en "Sobre mí".
- **Dominio de marca:** `cdhmaker.com` como canonical en todo (antes era web.app), con
  `robots.txt` que nombra uno por uno a los bots de IA, sitemap con los 10 idiomas, `llms.txt`,
  IndexNow y una página 404 propia.
- **Lo que leen los bots sin JavaScript:** las cifras del hero ya no dicen "0 proyectos", y el
  video del anuncio (2,6 MB, más del 90 % del peso) ya no se descarga en cada visita.
