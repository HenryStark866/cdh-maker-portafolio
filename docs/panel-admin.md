# Panel de administración de CDH Maker (`/crm`)

El CRM que ya existía en `cdhmaker.com/crm` (clientes, cuotas, firmas y expediente) se amplió hasta ser el
panel general del negocio. Misma URL, mismo acceso y misma identidad visual; `/admin` y `/panel` redirigen
ahí (302). Sin framework ni librerías: módulos ES nativos y Firebase 10.12.2 desde gstatic, como antes.

> Estado: rama `feat/panel-admin-crm`, **sin desplegar**. Ni el hosting ni las reglas nuevas están en
> producción hasta que Henry corra `firebase deploy --only firestore:rules,hosting`.

## 1. Módulos

| Pestaña | Ruta (`#…`) | Archivo | Qué hace |
|---|---|---|---|
| Inicio | `#inicio` | `public/crm/inicio.js` | KPIs: leads nuevos (7 / 30 días, sin atender), pipeline abierto y ponderado, ganado en 30 días, proyectos activos, por cobrar y cuotas vencidas (de las cuotas de cada cliente), comisiones por pagar, tarjeta de YAM. Embudo por etapa, próximos cobros, leads recientes. Cada bloque falla por separado. |
| Leads | `#leads`, `#lead/<id>` | `public/crm/leads.js` | Leads del sitio (ver §4), alta manual, filtros por estado/origen/afiliado y búsqueda, ficha con bitácora, «Convertir en oportunidad», «Descartar», «Borrar (spam)». Muestra también los registros de cuenta de `auth.js` (colección `clients`) con botón «Crear lead». |
| Pipeline | `#pipeline`, `#op/<id>` | `public/crm/pipeline.js` | Kanban nuevo → contactado → propuesta → negociación → ganado / perdido, con valor, servicio y afiliado. Arrastrar y soltar en escritorio; en móvil, el selector de etapa de cada tarjeta. Cada cambio de etapa queda en la bitácora. Al ganar: «Crear cliente» (hereda el afiliado) y «Crear proyecto». Probabilidades del ponderado: 10 / 20 / 40 / 70 %. |
| Clientes | `#clientes`, `#cliente/<id>` | `public/crm/app.js` | Lo de siempre (datos, plan de cuotas, firmas con enlace temporal, expediente) + campo «Código de afiliado», lista de proyectos del cliente y bitácora. |
| Proyectos | `#proyectos`, `#proyecto/<id>` | `public/crm/proyectos.js` | Cliente, servicio, estado, URL de producción, repo, fechas, valor. **No duplica cuotas**: resume las del cliente y enlaza a su ficha para cuotas, firmas y expediente. |
| Afiliados | `#afiliados`, `#afiliado/<codigo>` | `public/crm/afiliados.js` | Alta con código, enlace `https://cdhmaker.com/?ref=<codigo>` con botón copiar, leads/oportunidades/clientes atribuidos, comisiones (generar, aprobar, pagar, anular), bitácora. |
| YAM | `#yam` | `public/crm/yam.js` | Consume la API privada de YAM: resumen, comercios (búsqueda y páginas), campañas (crear, editar, activar/pausar, CTR), afiliados de YAM y sus referidos. |
| Importar | `#importar` | `public/crm/app.js` | Sin cambios (esquema `cdhmaker.crm.importacion.v1`). |

Compartidos: `util.js` (formato, listas de etapas/servicios/estados, diálogo `<dialog>`, `resumenPagos`),
`actividades.js` (bitácora), `panel.css` (estilos con tokens y modo oscuro), `fb.js` (conexión, sin cambios).
El tema sigue al sistema; el botón ◐ lo fija (`localStorage` `cdh_crm_tema`).

## 2. Acceso: cómo dar acceso a un administrador

Igual que el CRM: correo + enlace mágico de Firebase Auth, sin clave. La lista vive en **dos sitios que
deben coincidir**:

1. `firestore.rules` → función `esAdmin()` (la que de verdad protege los datos).
2. `public/crm/app.js` → constante `ADMINS` (solo decide qué pantalla mostrar).

Pasos: agregar el correo en ambos, `firebase deploy --only firestore:rules,hosting`, y que la persona entre a
`cdhmaker.com/crm` con ese correo. `esAdmin()` exige además `email_verified == true` (el enlace mágico lo
verifica). Para quitar el acceso, sacarlo de las dos listas y desplegar.

## 3. Modelo de datos (Firestore, proyecto `cdh-maker-portafolio`)

Colecciones nuevas (todas con prefijo `crm_` como las existentes):

| Colección | Id | Campos principales |
|---|---|---|
| `crm_leads` | automático | `origen` (`web_widget`, `web_whatsapp`, `web_correo`, `web_cotizador`, `web_visor3d`, `manual`, `referido`, `redes`, `evento`, `yam`, `registro_cuenta`), `estado` (`nuevo`, `contactado`, `calificado`, `descartado`, `convertido`), `ref` (código de afiliado o null), `ref_ts` (ms del primer clic), `pagina`, `idioma`, `servicio`, `creado`; si es manual: `nombre`, `email`, `telefono`, `empresa`, `notas`; `oportunidad_id` al convertir. |
| `crm_oportunidades` | automático | `titulo`, `etapa` (`nuevo` … `perdido`), `valor_cop`, `servicio`, `contacto`, `telefono`, `email`, `empresa`, `cierre_estimado`, `afiliado`, `lead_id`, `cliente_id`, `cerrado`, `motivo_perdida`. |
| `crm_proyectos` | automático | `nombre`, `cliente_id`, `oportunidad_id`, `servicio`, `estado` (`planeacion`, `en_curso`, `pausado`, `entregado`, `soporte`, `cancelado`), `url_produccion`, `repo`, `inicio`, `entrega_estimada`, `entregado`, `valor_cop`, `notas`. |
| `crm_actividades` | automático | `entidad` (`lead`, `oportunidad`, `cliente`, `proyecto`, `afiliado`), `entidad_id`, `tipo` (`nota`, `llamada`, `whatsapp`, `correo`, `reunion`, `cambio_etapa`), `texto`, `creado`, `creado_por`. |
| `crm_afiliados` | **el código** (`[a-z0-9-]{4,20}`) | `codigo`, `nombre`, `comision_pct` (0–50, por defecto 10), `estado` (`activo`, `pausado`, `retirado`), `canal`, `email`, `telefono`, `cuenta_pago` (solo referencia), `notas`. |
| `crm_comisiones` | automático | `afiliado`, `cliente_id`, `oportunidad_id`, `concepto`, `base_cop`, `pct` (0–100; 100 = bono fijo), `valor_cop`, `estado` (`pendiente`, `aprobada`, `pagada`, `anulada`), `aprobada`, `pagada`, `pagada_fecha`, `referencia_pago`, `motivo_anulacion`. |

Campo nuevo en `crm_clientes`: `afiliado` (código) y, si viene del pipeline, `oportunidad_id`.

**Comisiones.** «Generar comisiones» busca clientes con ese `afiliado`, con al menos una cuota `pagada` y sin
comisión no anulada; la base es la **primera cuota pagada** (por `fecha_pago`) y el % es el del afiliado.
Nunca nace una comisión sin plata cobrada.

Las consultas leen colecciones completas y filtran en el navegador (volumen de un negocio pequeño; no exige
índices compuestos). Si algún día pasan de unos miles de documentos, conviene paginar y crear índices.

## 4. Captura en el sitio: `public/ref.js`

- `?ref=<codigo>` en cualquier página → `localStorage` `cdh-ref` = `{codigo, ts}`, 60 días, **primer clic
  gana**; luego se borra `?ref=` de la barra de direcciones.
- Al pulsar WhatsApp o correo (todos los botones pasan por `CDH_CONTACT.waUrl` de `contact.js`), se crea un
  lead mínimo en `crm_leads` por la API REST de Firestore (sin SDK) con origen, código, página, idioma y
  servicio (si el mensaje del cotizador trae «Servicio: …»). **Ningún dato personal**: el texto y el número
  del visitante solo viajan a WhatsApp, como dice ARQUITECTURA §4. Si hay código, el WhatsApp termina en
  `Ref: <codigo>` para que Henry lo vea al responder.
- `auth.js` (latente) también guarda `ref` en `clients` y en el correo de FormSubmit.
- En `localhost` no escribe nada salvo que la URL lleve `?emu` (emulador).
- **Frente A** pone `<script src="/ref.js" defer></script>` en `index.html` y las plantillas de `build-i18n`;
  al desplegar hay que subir `contact.js?v=1` → `?v=2` en esas páginas (cambió `contact.js`).

## 5. Reglas (`firestore.rules`)

Mínimo privilegio. Todo lo nuevo es solo para `esAdmin()`, con estas precisiones:

- `crm_leads`: el anónimo **solo crea**, con lista cerrada de campos (`origen`, `estado == 'nuevo'`, `ref`,
  `ref_ts`, `pagina` ≤ 200, `idioma` de 2 letras, `servicio` ≤ 60, `creado == request.time`); nunca lee,
  edita ni borra. El admin edita validando estado y origen, y puede borrar (spam).
- `crm_oportunidades`: etapa en la lista, `valor_cop` ≥ 0, `afiliado` con formato de código.
- `crm_proyectos`: no se borran (se cancelan).
- `crm_actividades`: `creado_por` debe ser el correo del token; solo el autor edita o borra su nota.
- `crm_afiliados`: id = código, % entre 0 y 50; no se borran (se retiran).
- `crm_comisiones`: no se borran (se anulan); no pueden nacer pagadas; una pagada ya no cambia; no se
  puede cambiar de afiliado.
- `clients`: además del dueño, ahora el admin puede leer (para mostrarlos en Leads).

Riesgo aceptado: como el lead anónimo no tiene autenticación, alguien podría crear leads basura; no expone
datos y se limpian con «Borrar (spam)». Si se vuelve un problema: App Check (gratis) o un límite por IP en
una Cloud Function (requiere plan Blaze).

## 6. YAM (API privada)

Contrato acordado con el repo de YAM (`C:\dev\wt-yam-cdh`, rama `feat/panel-cdh-campanas-afiliados`):
base `https://yam.cdhmaker.com/api/cdh/*`, `Authorization: Bearer <CDH_PANEL_TOKEN>`.

- `GET /resumen` → `{ comercios, comercios_activos_30d, guias_30d, ventas_30d_cop, campanas_activas, referidos_30d }`
- `GET /comercios?buscar=&pagina=` → `{ items, total }`
- `GET|POST /campanas`, `PATCH /campanas/:id`
- `GET|POST /afiliados`, `GET /referidos?afiliado=`

La llave se pide una vez (YAM → Configurar) y queda **solo en `sessionStorage`** de la pestaña; la URL base es
configurable (se guarda en `localStorage`, no es secreta) para probar contra `http://localhost:3000`.
Mensajes claros para: red caída / CORS, 401 (llave mala, con botón para cambiarla), 503 (YAM sin
`CDH_PANEL_TOKEN`), 404 (función aún no desplegada) y `pendiente_migracion` (tablas 0157+ sin aplicar).
Nada de YAM se guarda en Firestore.

## 7. Pruebas en local

Requisitos: Node 20+, Firebase CLI y Java (el emulador de Firestore lo exige). Si no hay Java instalado,
sirve un JRE portable sin tocar el sistema, p. ej. Temurin 21 descomprimido en `C:\dev\jdk`:

```bat
set "JAVA_HOME=C:\dev\jdk\jdk-21.0.12.1+1-jre" && set "PATH=%JAVA_HOME%\bin;%PATH%"
firebase emulators:start --project cdh-maker-portafolio
```

```bash
node --test tools/test-reglas.mjs        # 12 pruebas de reglas (vacían el emulador)
node tools/sembrar-emulador.mjs          # datos de demostración («Demo …»)
node tools/yam-api-simulada.mjs          # YAM falsa en :3999, llave demo-llave (--pendiente, --sin-llave)
```

Abrir `http://127.0.0.1:5055/crm?emu`, escribir un correo admin y tomar el enlace de
`http://127.0.0.1:9099/emulator/v1/projects/cdh-maker-portafolio/oobCodes` (campo `oobLink`; basta con
abrir `/crm?emu&mode=signIn&oobCode=…&apiKey=fake-api-key`). Para probar `ref.js` en el sitio:
`http://127.0.0.1:5055/?ref=codigo&emu` (cuando Frente A haya puesto la etiqueta).

## 8. Pendiente / ideas

- `admin-clientes.html` (panel viejo con clave y `localStorage`) sigue publicado sin uso; se puede retirar.
- Pago de comisiones: el panel solo registra; el giro lo hace Henry por fuera.
- Si se activa App Check, añadir el token a la llamada REST de `ref.js`.
