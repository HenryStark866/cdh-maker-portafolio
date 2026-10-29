# Contabilidad de CDH Maker — concepto y forma de trabajo

Concepto para Henry Taborda (persona natural, marca CDH Maker, Medellín, **no responsable de IVA**) y su equipo.
Es el criterio con el que se construyó el módulo **CRM → Contabilidad** (`public/crm/libro.js`). Las cifras están
en UVT; la **UVT 2026 es $52.374** (Resolución DIAN 000238 del 15-dic-2025).

> Este documento orienta y deja las cosas en orden. No reemplaza a un contador con la información completa:
> los puntos marcados **[confirmar]** dependen de hechos concretos (RUT, actividades inscritas, contratos, patrimonio).

---

## 1. Marco que aplica hoy

| Pregunta | Respuesta corta |
| --- | --- |
| ¿Es comerciante? | **Depende de la actividad.** El trabajo intelectual y profesional (software a la medida, consultoría) no es acto mercantil (art. 23 num. 5 C. Co.). La **fabricación y venta habitual de productos** (impresión 3D, láser, CNC, kits) sí lo es (art. 20 C. Co.). Si hace eso de forma habitual y organizada, es comerciante. **[confirmar]** |
| ¿Está obligado a llevar contabilidad? | Solo el comerciante (art. 19 C. Co.). Como no comerciante **no** está obligado, pero como no responsable de IVA debe llevar un **registro de operaciones diarias** de ingresos y egresos (art. 616 E.T.). El libro del CRM cumple ese papel si se mantiene al día y con soportes. |
| Si resulta comerciante, ¿qué marco NIIF? | **Grupo 3 – microempresas** (DUR 2420 de 2015, Anexo 3): contabilidad simplificada. Aplica a las personas naturales que cumplen los requisitos del antiguo régimen simplificado (hoy los no responsables de IVA) y a las microempresas pequeñas. No necesita NIIF para Pymes (Grupo 2). |
| ¿Qué pide la DIAN para la renta? | Que los ingresos, costos y gastos estén **soportados** (factura electrónica o documento soporte), y que el ingreso se reconozca **cuando se recibe** (art. 27 E.T., para quien no lleva contabilidad). |
| ¿Factura electrónica? | Hoy **no** está obligado: es no responsable de IVA y está por debajo de 3.500 UVT. **[confirmar]** que el RUT no tenga la responsabilidad 52 (facturador electrónico) ni actividades que lo obliguen. |

**Conclusión práctica:** llevar el libro del CRM como contabilidad simplificada (ingresos con cuenta de cobro,
egresos con factura a su nombre, sin efectivo sin soporte). Si en algún momento debe llevar contabilidad formal,
este libro, con el plan de cuentas PUC que trae, es la base que el contador pasa a libros oficiales.

## 2. Flujo de documentos: cotización → cuenta de cobro → ¿factura?

**Cuenta de cobro y factura NO son lo mismo:**

- **Cotización**: propuesta de precio. No es un documento contable ni cobra nada.
- **Cuenta de cobro**: documento con el que una persona **no obligada a facturar** pide un pago. Es el soporte de
  **su ingreso**. Al cliente no le sirve como soporte del costo: si el cliente es empresa, **el cliente** debe
  generar el **documento soporte en adquisiciones a no obligados a facturar** (Res. DIAN 000167 de 2021) para
  deducir el pago. Por eso las empresas piden RUT, cédula y certificación bancaria.
- **Factura electrónica de venta**: obligatoria solo cuando Henry quede obligado a facturar (responsable de IVA,
  más de 3.500 UVT o por inscripción voluntaria). Se valida ante la DIAN (con CUFE) y sirve al mismo tiempo como
  soporte de su ingreso y del costo del cliente. Con ella el cliente ya no hace documento soporte.

**Flujo recomendado hoy** (el que trae el CRM):

```
Cotización (COT) ──aceptada──► Cuenta de cobro (CC) ──pago──► Ingreso en el libro
   no es contable            consecutiva, se emite        bruto, retenciones y neto,
                             cuando hay que cobrar         con el comprobante
                             (anticipo, hito o final)
```

1. La cotización se convierte en **una cuenta de cobro por cada cobro** (anticipo 50 %, entrega 50 %). No se emite
   todo por adelantado: la cuenta de cobro emitida y no pagada queda en **Por cobrar**.
2. Al recibir el pago se registra con **Registrar pago**: valor bruto, retención en la fuente y ReteICA que
   practicó el cliente, medio, referencia y comprobante. El ingreso del libro es el **bruto**; las retenciones son
   un **anticipo** del impuesto de renta y del ICA.
3. **No unificar** cuenta de cobro y factura: son la misma etapa del flujo, pero con una **modalidad** distinta
   (en el CRM, «Emitir como»). Mientras no esté obligado se usa la cuenta de cobro; cuando pase a facturar, ese
   mismo paso emite factura electrónica (en el software de un proveedor tecnológico o en el facturador gratuito de
   la DIAN) y en el CRM se guarda el número DIAN y el CUFE.
4. **Cuándo pasar a factura electrónica**: al superar 3.500 UVT de ingresos brutos en el año ($183.309.000 en 2026)
   o en el año anterior, al firmar un contrato gravado de 3.500 UVT o más, o al volverse responsable de IVA por
   cualquier otra causa. Puede hacerlo antes de forma voluntaria si los clientes grandes lo exigen. **Qué cambia:**
   inscribir la responsabilidad en el RUT, habilitarse como facturador, numeración autorizada por la DIAN, cobrar
   IVA del 19 % en servicios gravados y declararlo (algunos servicios de software pueden estar excluidos o exentos:
   **[confirmar]** con el contador antes de facturar con IVA).

## 3. Soportes que debe exigir a los proveedores

Para que un costo o gasto sea **deducible** en la renta (arts. 771-2 y 616-1 E.T.):

| Proveedor | Soporte válido |
| --- | --- |
| Empresa o persona obligada a facturar (tiendas, Amazon con NIT colombiano, coworking, ISP) | **Factura electrónica a nombre de Henry Camilo Taborda Galeano, con su cédula o NIT.** Pedirla siempre, también cuando paga Isa. Un tiquete POS o factura a nombre de otra persona no sirve. |
| Persona natural no obligada a facturar (freelancer, taller pequeño) | **Documento soporte en adquisiciones a no obligados**, que genera Henry (no el proveedor) en el software de la DIAN. Pedir al proveedor su cuenta de cobro, RUT y cédula. **[confirmar]** desde qué volumen conviene habilitarlo. |
| Proveedores del exterior (GitHub, Figma, Meta Ads, Google, IA) | Factura o recibo del proveedor y el extracto de la tarjeta. Para deducirlos también se usa el documento soporte. Ojo: algunos servicios digitales del exterior cobran IVA en Colombia. |
| Gastos menores sin factura (taxi, parqueadero) | Recibo o pantallazo: sirven de prueba pero **no** son deducibles por sí solos. Úsese poco. |

Además: pagos en efectivo con topes (art. 771-5 E.T.: bancarizar); pagar a proveedores por transferencia.
Los **costos se asocian a un proyecto** (cliente) para ver cuánto deja cada uno.

> En la renta, las rentas de trabajo independiente pueden restar costos y gastos **o** tomar la renta exenta del
> 25 %, no ambas (art. 336 E.T.). Llevar los soportes permite al contador elegir lo que más convenga. **[confirmar]**
> en qué cédula quedan los ingresos de fabricación y SaaS (rentas no laborales).

## 4. Retenciones que le practican

Henry no es agente de retención: **no** retiene cuando paga. Las empresas que le pagan **sí** le retienen. Tarifas
usuales (bases con UVT 2026 y Decreto 572 de 2025, vigente de nuevo desde junio de 2026, cuando el Consejo de
Estado levantó su suspensión; el litigio de fondo sigue):

| Concepto | Tarifa | Base mínima |
| --- | --- | --- |
| Honorarios (trabajo intelectual) persona natural | 10 % (11 % si los contratos con ese pagador superan 3.300 UVT en el año) | sin base |
| Honorarios o servicios personales de quien **informa por escrito que no ha contratado 2 o más trabajadores** | **tabla del art. 383 E.T.** (la de asalariados): en pagos pequeños da **cero** | — |
| Licenciamiento o derecho de uso de software | 3,5 % | sin base |
| Servicios generales | 4 % declarante / 6 % no declarante | 2 UVT ($104.748) |
| Compras de bienes (venta de piezas o kits) | 2,5 % declarante / 3,5 % no declarante | 10 UVT ($523.740) |
| ReteICA (Medellín u otro municipio) | según la tarifa de la actividad (por mil) | según el municipio |

**Recomendación:** entregar a cada cliente empresa, junto con la cuenta de cobro, una **certificación de que no ha
contratado dos o más trabajadores** para que le apliquen la tabla del art. 383 (casi siempre cero retención en
cuentas pequeñas). Registrar siempre lo que efectivamente le retuvieron y **pedir el certificado de retención** en
marzo: esas retenciones se restan del impuesto de renta y del ICA. La pestaña **Impuestos** del libro lleva el
total por agente retenedor y guarda los certificados.

## 5. Tope de 3.500 UVT (no responsable de IVA)

Par. 3 del art. 437 E.T. Para seguir como no responsable debe cumplir **todo**:

- Ingresos brutos de la actividad **inferiores a 3.500 UVT** en el año anterior **o** en el año en curso
  (2026: $183.309.000; 2025: $174.296.500).
- Un solo establecimiento, sin franquicias, concesiones ni explotación de intangibles; no ser usuario aduanero.
- No celebrar en el año contratos de venta o servicios **gravados** de valor individual de 3.500 UVT o más.
- Consignaciones bancarias, depósitos o inversiones del año que no superen 3.500 UVT.

La pestaña **Impuestos** muestra lo acumulado, el % del tope, la proyección al ritmo actual y avisa al 80 %.
El día que se supere: inscribirse como responsable de IVA, facturar electrónicamente y cobrar IVA desde el
periodo siguiente. Planearlo con el contador **antes**, porque cambia precios y obligaciones.

## 6. Gastos que Henry o Isa pagan de su bolsillo

- **Henry**: el negocio y Henry son la misma persona jurídica. Pagar con la cuenta personal no cambia el
  impuesto, pero ensucia el control. Registrar el gasto con «Pagó: Henry» y marcarlo como **reembolsable** si se
  le va a devolver desde la cuenta del negocio; si no, queda como **aporte**. Recomendación: una cuenta bancaria
  solo para CDH Maker.
- **Isa**: si paga algo del negocio, el negocio le **debe** ese dinero (cuenta por pagar). Se registra con
  «Pagó: Isa» y **reembolsable**; en la pestaña **Reembolsos** se marca cuando se le devuelve, con medio y
  referencia. La **factura debe salir a nombre de Henry**, no de Isa, o no es deducible. Si Isa no quiere que se
  le devuelva, es un **aporte** y conviene dejarlo por escrito (no es socia de una persona natural: si van a
  compartir utilidades, evaluar una sociedad SAS o un contrato de colaboración). **[confirmar]** la relación
  contractual con Isa (prestadora de servicios, empleada o socia) porque cambia los pagos que recibe y las
  retenciones.

## 7. Cierre mensual (30 minutos, primeros 5 días del mes)

1. **Ingresos**: cada pago recibido está registrado con bruto, retenciones y comprobante; las cuotas pagadas en el
   CRM aparecen solas.
2. **Egresos**: revisar el extracto bancario y Nequi contra **Movimientos**; registrar lo que falte.
3. **Comprobantes**: la pestaña debe quedar sin «egresos sin comprobante»; pedir las facturas electrónicas que
   falten y hacer los documentos soporte del mes.
4. **Clasificación**: costos asociados a su proyecto; nada importante en «Otros».
5. **Por cobrar**: llamar las partidas de más de 30 días.
6. **Reembolsos**: pagar a Isa (y a Henry) lo pendiente.
7. **Impuestos**: mirar el % del tope de 3.500 UVT y las retenciones del mes.
8. **Exportar** el CSV del mes y guardarlo para el contador.

## 8. Calendario tributario de la persona natural

| Obligación | Cuándo |
| --- | --- |
| Declaración de renta del año anterior | Agosto a octubre, según los dos últimos dígitos del NIT (calendario DIAN del año). Obliga si en el año: ingresos brutos ≥ 1.400 UVT (2026: $73.323.600), patrimonio bruto ≥ 4.500 UVT, o compras, consumos con tarjeta o consignaciones ≥ 1.400 UVT. |
| Certificados de retención | Pedirlos en marzo a cada cliente que retuvo. |
| ICA Medellín | Declaración anual del año anterior a comienzos de año. **[confirmar]** inscripción en Industria y Comercio y la tarifa de cada actividad. |
| Planilla PILA (independiente) | Mensual, sobre el 40 % de los ingresos del mes. |
| RUT | Actualizar al cambiar actividades o responsabilidades. |
| UVT del año siguiente | La DIAN la publica en noviembre o diciembre: actualizar `UVT` en `public/crm/libro.js`. |

## 9. Cómo está modelado en el CRM

- `crm_libro/{id}`: `tipo` (ingreso/egreso), `clase` (ingreso/costo/gasto/inversion), `cuenta` y `cuenta_codigo`
  (PUC), `bruto`, `retenciones {fuente, ica, otras}`, `neto`, `pagado_por` (persona o `caja`), `reembolsable`,
  `reembolsado`, `proveedor_nit`, `soporte_tipo`, `cliente` (proyecto) y `soportes` (comprobantes en la
  subcolección `soportes/`). Los movimientos **no se borran: se anulan con motivo**.
- Plan de cuentas: ingresos 41 (operacionales) y 42 (no operacionales), costos 61, gastos 51 (administración),
  52 (ventas) y 53 (no operacionales), y 15 para las compras de equipo (inversión, que no van al resultado).
- Los nombres de cuentas del libro anterior se reclasifican solos al leerlos.
