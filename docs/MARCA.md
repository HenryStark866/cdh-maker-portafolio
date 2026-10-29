# CDH Maker — Concepto de marca

**Posicionamiento.** CDH Maker es el estudio de ingeniería de Medellín donde una sola conversación,
con quien diseña y construye, lleva una idea a un sistema que funciona: software, IA, IoT y
piezas físicas, para clientes de cualquier parte del mundo.

**Personalidad.** Un ingeniero de confianza con taller propio: preciso, cercano y sin humo. Habla
claro, muestra trabajo real antes que promesas y tiene una chispa de curiosidad maker. El lobo
resume eso: instinto, método (geometría facetada) y una "C" de circuito que conecta lo digital
con lo físico.

## Tres principios visuales

1. **Plano técnico, no ciencia ficción.** La estética sale del dibujo de ingeniería: rejilla fina,
   líneas de cota, rótulos en monoespaciada, números de figura. Nada de partículas, neón ni HUD.
2. **El lobo y el cian son la firma, no el decorado.** El cian aparece en pocos puntos (la "C" del
   lobo, un enlace, un estado, el botón principal) para que cada aparición signifique algo.
3. **Aire y evidencia.** Mucho espacio, jerarquía de revista y trabajo real (capturas, demos,
   nombres de clientes) en primer plano. Las microinteracciones son breves y se apagan con
   *reducir movimiento*.

## Paleta

| Rol | Claro (papel) | Oscuro (noche) |
| --- | --- | --- |
| Fondo | `#F5F4F0` papel cálido | `#0A0F17` noche |
| Superficie | `#FFFFFF` | `#111823` |
| Línea | `#E3E1DA` | `#1F2A37` |
| Texto | `#0E1722` tinta | `#E9EDF2` hueso |
| Texto secundario | `#566273` | `#98A5B5` |
| Acento (marca) | `#0E7490` cian papel (AA sobre blanco) | `#22D3EE` cian eléctrico |
| Ojos del lobo | `#0891B2 → #1D6FB8` | `#22D3EE → #3BA4E6` |

El acento nunca se usa como fondo de secciones ni como resplandor; solo en trazos, estados y enlaces (el botón principal va en tinta o hueso).
WhatsApp conserva su verde únicamente en su propio ícono.

## Tipografía

- **Inter Tight** (600–700) para titulares: compacta, técnica, con tracking negativo.
- **Inter** (400–600) para texto corrido, 16–18 px, interlineado 1.6.
- **Instrument Serif** itálica para una sola palabra por titular ("*necesita*", "*empezar*"): el
  gesto humano dentro del plano técnico.
- **JetBrains Mono** (500) en rótulos, numeración de pasos y etiquetas: la voz del taller.

## Voz

Frases cortas en segunda persona, centradas en el problema del cliente ("¿Qué necesitas
construir?"), con pruebas concretas (proyecto, plazo, precio de referencia). Cierre de marca:
*"Tu proyecto no necesita empezar perfecto. Necesita empezar."*

Fuente del logo: `public/crm/marca.js` (lobo y letras); en el sitio se dibuja con `currentColor`
y `var(--accent)` para seguir el tema.
