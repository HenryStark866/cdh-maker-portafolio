# Campaña de afiliados de CDH Maker — diseño

Programa para que personas de confianza traigan clientes a CDH Maker (desarrollo web y software, SaaS,
fabricación digital, IoT y consultoría) a cambio de una comisión sobre lo que de verdad se cobra.
Es hermano del programa de YAM (`docs/campanas-y-afiliados.md` en el repo de YAM): mismo formato de código,
misma regla de «solo sobre plata cobrada», distinta base de comisión. Un afiliado puede estar en los dos.

> Estado: propuesta. Los porcentajes y bonos son el punto de partida sugerido; Henry decide. Los valores en
> COP son ilustrativos (proyectos típicos), no una lista de precios.

## 1. Perfil del afiliado ideal

Gente que **ya habla con dueños de negocio** y a la que le preguntan «¿conoces a alguien que me haga…?»:

1. **Contadores y asesores tributarios** de pymes — ven a diario el negocio que necesita facturación,
   inventario o una web. Alta confianza, ciclo largo.
2. **Agencias de marketing y community managers** sin equipo de desarrollo — venden la pauta, CDH hace la
   tienda, la landing o la automatización.
3. **Freelancers de diseño gráfico / audiovisual** — sus clientes piden «y la página web».
4. **Profesores, mentores de emprendimiento e incubadoras** (cuidado: Incubant/IncubApp es otra marca; ahí
   no se mezcla).
5. **Clientes actuales satisfechos** (Refricom y siguientes) — el referido más barato y que mejor cierra.
6. **Creadores de contenido de tecnología/emprendimiento en Medellín** — alcance, pero menos conversión.

No buscamos: compradores de pauta que solo quieren poner el enlace en anuncios con la marca CDH (ver §8).

## 2. Propuesta de valor

- **Para el afiliado**: «Recomienda a CDH Maker y gana el 10 % del primer pago de cada cliente, sin vender
  ni cotizar: tú presentas, Henry cierra y entrega». Dinero claro, pagado en 15 días tras el cobro, panel de
  seguimiento por WhatsApp/correo cada mes.
- **Para su referido**: atención directa del ingeniero (sin bots), cotización inmediata en la web
  (cotizador), primera llamada de diagnóstico gratis. Opcional: «Llega por un afiliado y recibe el
  diagnóstico técnico + 1 mes de soporte sin costo» (no descuento en precio, para no erosionar margen).

## 3. Modelo de comisiones

**Base: 10 % del primer pago cobrado** del cliente referido (anticipo o primera cuota). Configurable por
afiliado en el panel (0–50 %). Se causa solo cuando ese pago entra a la cuenta de CDH; si el cliente no
paga, no hay comisión.

| Proyecto (ejemplo) | Valor total | Primer pago cobrado | Comisión 10 % |
|---|---|---|---|
| Landing + WhatsApp para un negocio local | 1.200.000 | 600.000 (50 %) | **60.000** |
| Tienda en línea pequeña | 4.000.000 | 2.000.000 (50 %) | **200.000** |
| Plataforma SaaS a la medida | 18.000.000 | 5.400.000 (30 %) | **540.000** |
| Lote de piezas en impresión 3D | 800.000 | 800.000 (contado) | **80.000** |
| Sensores IoT para una finca | 6.500.000 | 3.250.000 (50 %) | **325.000** |

¿Por qué el primer pago y no el total? Es simple de calcular, se paga rápido (el afiliado ve su plata en
semanas, no al final del proyecto) y CDH no queda endeudado con comisiones de proyectos que se caen a mitad.

**Comparado con YAM**: allá el afiliado gana el 20 % de lo que YAM facture al comercio durante 6 meses
(ingreso recurrente). Ejemplo: comercio con plan de 89.000/mes → 17.800/mes × 6 = **106.800**.

## 4. Niveles y bonos (propuesta)

Se cuentan **clientes con primer pago cobrado** en los últimos 12 meses móviles.

| Nivel | Requisito | Comisión | Extra |
|---|---|---|---|
| Aliado | registro | 10 % | kit de materiales |
| Aliado Plata | 3 clientes cobrados | 12 % | mención en redes de CDH |
| Aliado Oro | 6 clientes cobrados | 15 % | bono de 300.000 al llegar + prioridad de agenda para sus referidos |

- **Bono de arranque**: 100.000 extra por el primer cliente cobrado dentro de los 60 días del registro
  (activa al afiliado temprano). Costo máximo acotado: solo se paga si hubo venta.
- **Recurrente opcional** (decisión de Henry): 5 % del mantenimiento mensual del cliente durante 6 meses, si
  el proyecto tiene plan de soporte.
- En el panel, los bonos se registran como «Comisión manual» con base = valor del bono y % = 100.

Ejemplo de un año de una agencia en nivel Oro: 7 tiendas de 4.000.000 → 2 a 10 % (200.000 c/u) mientras sube,
después 12 % y 15 %… Total aproximado: 2×200.000 + 3×240.000 + 2×300.000 + bono 300.000 + arranque 100.000
= **2.120.000 COP**, sobre 28.000.000 vendidos (≈ 7,6 % del valor total vendido).

## 5. Enlaces y tracking

- Código: 4–20 caracteres `[a-z0-9-]` (p. ej. `laura-mkt`, `contador-pao`). Se crea en el panel
  (`/crm#afiliados`); el código es el id del afiliado.
- Enlace: `https://cdhmaker.com/?ref=<codigo>`. También funciona en cualquier página, p. ej.
  `https://cdhmaker.com/servicios/impresion-3d-medellin?ref=<codigo>` o con idioma `/en?ref=<codigo>`.
- `ref.js` guarda el código 60 días en el navegador del visitante; **primer clic gana** (si ya tenía otro
  código vigente, se respeta el primero).
- Al escribir por WhatsApp/correo se crea el lead en el panel con el código, y el mensaje de WhatsApp termina
  en `Ref: <codigo>`. Si el referido llega «de palabra» (sin enlace), Henry asigna el código a mano en el lead,
  oportunidad o cliente: **también cuenta**, siempre que el afiliado lo haya avisado antes del primer pago.
- Para medir canales del mismo afiliado se pueden usar códigos derivados (`laura-ig`, `laura-wa`).
- Desde el cliente en el CRM («Código de afiliado») se calculan las comisiones; el panel avisa cuando un
  cliente referido ya pagó y no tiene comisión registrada.

## 6. Materiales para afiliados

1. **Mensaje corto de presentación** (WhatsApp) — plantilla:
   «Te presento a Henry de CDH Maker: hace páginas, software y prototipos (impresión 3D, IoT) en Medellín.
   Cotizas en línea en 2 minutos: https://cdhmaker.com/?ref=CODIGO».
2. **Una página por servicio** ya existe en 10 idiomas (`/servicios/…`): el afiliado comparte la del
   servicio que su contacto necesita, con su `?ref=`.
3. **Shorts del canal de YouTube de CDH (ClipFactory, canal `UCrVy83mH6KNwWZpF5OjPibg`)**: son el material
   principal. Cada Short muestra un proyecto o una pieza fabricada en menos de un minuto — el afiliado lo
   reenvía por WhatsApp o lo comparte en sus historias con su enlace en el texto. Lista sugerida para el kit:
   un Short por servicio (web, 3D, IoT, SaaS/YAM) y uno de «cómo trabajamos». El feed RSS público del canal
   (`https://www.youtube.com/feeds/videos.xml?channel_id=UCrVy83mH6KNwWZpF5OjPibg`) permite mandar cada mes
   «los Shorts nuevos» en el boletín de afiliados sin trabajo extra.
4. **Casos con permiso del cliente** (Refricom y siguientes): antes/después y una frase del cliente.
5. **Guía de una página** (PDF o doc): qué vende CDH, para quién no es, rangos de tiempos (los del
   cotizador), preguntas frecuentes y cómo funciona la comisión.

## 7. Proceso y liquidación

1. El afiliado se registra (formulario simple o mensaje a Henry) y acepta los términos (§9). Henry lo crea en
   el panel con su % y le envía su enlace.
2. El referido escribe → lead con código → oportunidad en el pipeline (con afiliado) → cliente.
3. El cliente paga su primera cuota → Henry la registra en el CRM → en Afiliados aparece «Generar
   comisiones» → la comisión nace **pendiente**.
4. **Ventana de 15 días** (retracto o reversos) → Henry la pasa a **aprobada**.
5. Pago el **día 5 de cada mes** de todo lo aprobado, por transferencia o Nequi a la cuenta que dejó el
   afiliado → se marca **pagada** con fecha y referencia del pago. Una pagada ya no se puede editar.
6. Mínimo de pago: 50.000 (lo menor se acumula al mes siguiente).
7. Tributario: el afiliado es un tercero independiente; si CDH debe practicar retención en la fuente o
   pedir cuenta de cobro/RUT, se le solicita antes del primer pago. (Revisar con el contador.)

## 8. Anti-fraude

- **Solo plata cobrada**: sin pago confirmado no hay comisión; si el pago se revierte, se anula.
- **Primer clic gana** y vigencia de 60 días; no hay auto-referidos (un afiliado no cobra por sí mismo ni por
  su propia empresa) ni referidos de clientes que ya estaban en el CRM o en conversación con Henry antes del
  clic (se ve en la fecha del lead y la bitácora).
- Prohibido: pauta pagada con la marca «CDH Maker» o palabras clave de la marca, dominios parecidos, spam,
  ofrecer descuentos que CDH no autorizó, o prometer plazos y precios.
- Los leads anónimos del sitio no traen datos personales; ante un pico raro de leads con el mismo código sin
  conversaciones reales, se pausa el afiliado (estado «pausado») y se revisa. Los leads basura se borran.
- Henry tiene la última palabra en atribuciones dudosas; queda escrito en la bitácora del afiliado.

## 9. Términos básicos (borrador para revisar)

1. La relación es de referido independiente; no hay subordinación ni exclusividad.
2. Comisión: % vigente del afiliado sobre el primer pago efectivamente recibido por CDH del cliente referido;
   bonos según §4 vigente al momento del pago del cliente.
3. Atribución: enlace con código (60 días, primer clic) o aviso previo por escrito antes del primer pago.
4. Liquidación mensual según §7; CDH puede retener comisiones en revisión por fraude o reverso.
5. Datos: el afiliado no recibe datos personales de los clientes más allá de lo que el cliente autorice
   (Ley 1581 de 2012); CDH trata los datos del afiliado solo para gestionar el programa y pagarle.
6. CDH puede cambiar porcentajes con 30 días de aviso; lo ya causado se respeta.
7. Cualquiera de las partes puede terminar; las comisiones causadas antes del retiro se pagan.

## 10. Métricas

En el panel (Inicio y Afiliados) o calculadas desde él:

- Afiliados activos (con ≥ 1 lead en 30 días) / registrados.
- Clics no se miden (el sitio no tiene analítica); se miden **leads atribuidos** por código y por origen.
- Tasa lead → oportunidad → ganado por afiliado; valor del pipeline atribuido.
- Clientes con primer pago y **costo de adquisición** = comisiones + bonos pagados / clientes cobrados.
- Comisiones pendientes vs. pagadas; días promedio de pago.
- Meta de los primeros 90 días: 10 afiliados activos, 15 leads atribuidos, 3 clientes cobrados.

## 11. Plan de lanzamiento (30 días)

| Semana | Acciones |
|---|---|
| 1 — Preparar | Desplegar panel y reglas; Frente A publica `ref.js` en todas las páginas. Henry fija %, bonos y términos. Armar el kit: plantilla de mensaje, 4 Shorts seleccionados, guía de una página. Crear 3 afiliados de prueba (incluido uno propio) y validar el flujo completo en producción con un lead real de prueba. |
| 2 — Círculo cercano | Invitar 10–15 personas a mano: 3 contadores, 3 agencias/freelancers, clientes actuales y amigos con red de negocios. Llamada de 15 min con cada uno; crearlos en el panel y enviar su enlace. |
| 3 — Contenido | Publicar 2 Shorts nuevos pensados para reenviar (caso real + «cómo cotizar en 2 minutos»). Primer boletín a afiliados con los Shorts y un recordatorio del bono de arranque. Revisar leads atribuidos y responder en < 2 h hábiles. |
| 4 — Medir y ajustar | Revisar métricas: ¿quién trajo leads, quién no? Llamar a los inactivos; pausar lo que no funciona. Primera liquidación (si hubo cobros) para generar confianza. Decidir si se abre convocatoria pública (página «Afiliados» en el sitio — tarea para Frente A) o se mantiene por invitación. |

Presupuesto: **0 COP fijos**. El programa solo cuesta cuando hay ventas cobradas (comisiones y bonos).
