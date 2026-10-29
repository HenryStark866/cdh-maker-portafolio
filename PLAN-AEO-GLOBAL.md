# Plan AEO global — que los motores de respuesta recomienden a CDH Maker

*2026-10-29. Sigue a [PLAN-VISIBILIDAD-IA.md](PLAN-VISIBILIDAD-IA.md) (2026-10-14), que
cubrió indexación, `robots.txt`, los 10 idiomas y las páginas por servicio. Este plan
apunta a otra cosa: **que ChatGPT, Gemini, Claude, Perplexity y Copilot puedan responder
con CDH Maker, con precio, a preguntas que nadie hace con el nombre de la marca.***

## La idea en una frase

Un motor de respuesta cita a quien tiene **la respuesta concreta** a la pregunta: "¿cuánto
cuesta un chatbot para WhatsApp?", "¿quién me ayuda a digitalizar mi negocio si no sé qué
necesito?". Hasta hoy el sitio decía "cotización personalizada" a todo. Sin precios ni
catálogo, ningún asistente tenía de dónde sacar una cifra ni un servicio para recomendar.

## Las preguntas que queremos ganar

| Pregunta (es / en) | Página que la responde |
| --- | --- |
| No sé qué necesita mi negocio, ¿por dónde empiezo? / *where do I start digitizing my business* | `/catalogo#consultoria`, FAQ 10 de la portada |
| ¿Cuánto cuesta una página web / tienda en línea en Colombia? / *website cost Colombia* | `/catalogo#software` |
| ¿Cuánto cuesta un chatbot con IA para WhatsApp? / *AI WhatsApp assistant price* | `/catalogo#ia` |
| Consultor de transformación digital para pymes en Medellín / *fractional CTO Latin America* | `/catalogo#consultoria` |
| Impresión 3D / corte láser por encargo en Medellín | `/servicios/impresion-3d-medellin`, `/catalogo#fabricacion` |
| Envíos de última milla y contraentrega para mi tienda en Medellín | YAM (`yam.cdhmaker.com`), `/catalogo#productos` |
| Clips / Shorts de mis videos largos, precio | `/catalogo#contenido` |

## Hecho en el código (rama `feat/aeo-cinta-catalogo`)

- **Catálogo con precios, fuente única** `tools/catalogo.mjs`: 17 productos y servicios en
  7 categorías, la **Consultoría primero** (orientación gratis, diagnóstico express, hoja de
  ruta, CTO por horas). Precios en COP y USD, **marcados como provisionales**
  (`PROVISIONAL = true`): Henry los ajusta ahí y regenera.
- **Páginas `/catalogo` (es) y `/en/catalog` (en)** generadas por `tools/build-i18n.mjs`,
  estáticas (los rastreadores no ejecutan JavaScript), con hreflang propio y entrada en el sitemap.
- **schema.org**: `OfferCatalog` por categoría con `Offer` + `UnitPriceSpecification`
  (`minPrice` cuando es "desde", COP y USD, `valueAddedTaxIncluded: false`); YAM e IncubApp
  como `SoftwareApplication`; `FAQPage` de 6 preguntas por idioma; `BreadcrumbList`. La
  `Organization` de la portada enlaza el catálogo desde `hasOfferCatalog`.
- **FAQ 10 en la portada, en los 10 idiomas**: "No sé qué necesito, ¿por dónde empiezo?" (va al
  `FAQPage` de cada idioma y a `llms.txt`).
- **`llms.txt`**: bloque "Catalog and indicative prices" (y su espejo en español) con cada
  servicio, su precio en ambas monedas, plazo y para quién es.
- **`/catalogo.json`** público: lo leen la cinta, el chat y el bot de Shorts. Un mismo dato
  en todas partes: la web, el chat y los videos nunca se contradicen.
- **Enlaces internos**: la tarjeta "Diseño y consultoría técnica" y el pie llevan al catálogo
  (en los otros 8 idiomas, a `/en/catalog`).

## Falta, y solo lo puede hacer Henry

1. **Fijar los precios** en `tools/catalogo.mjs` y, cuando estén firmes, `PROVISIONAL = false`.
   Un asistente que cita "desde 290.000 COP" y luego el cliente oye otra cifra es peor que no
   ser citado.
2. **Desplegar** (`firebase deploy --only hosting`) y luego `node tools/indexnow.mjs`.
3. **Search Console y Bing Webmaster**: pedir indexación de `/catalogo` y `/en/catalog`;
   revisar en Bing el informe *AI Performance* a las 2 semanas.
4. **Google Business Profile**: cargar los mismos servicios con su precio "desde" (Google
   cruza ambos; si coinciden, gana confianza).
5. **Menciones fuera del sitio** (lo que más pesa, ver el plan anterior): cada Short del canal
   enlaza al catálogo; publicar 2–3 casos con cifras; perfiles en Clutch/GoodFirms con
   reseñas; cada perfil nuevo va en `ENTITY.sameAs` de `tools/build-i18n.mjs`.

## Siguiente en el código (propuesto, no hecho)

- Traducir el catálogo a pt y fr (los mercados con más búsquedas después de es/en):
  `TEXTOS`, `PREGUNTAS` y los textos de cada ítem aceptan más idiomas; hace falta extender
  `CAT_LANGS` y `catLang()`.
- Una página por pregunta grande ("cuánto cuesta un chatbot en Colombia") solo si Search
  Console muestra impresiones para esa consulta. Antes no.

## Cómo medir (mensual)

Las mismas 6 preguntas de la tabla, en es y en, a ChatGPT, Gemini, Claude, Perplexity y
Copilot. Anotar: ¿aparece CDH Maker?, ¿cita el precio?, ¿enlaza a `/catalogo`? Y en Bing
Webmaster, las citas en *AI Performance*.
