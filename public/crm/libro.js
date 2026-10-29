// Contabilidad de CDH Maker (CRM → Contabilidad): libro de ingresos, costos y gastos con sus
// comprobantes, cartera por edades, reembolsos al equipo, retenciones y tope de no responsable de IVA.
// Datos: crm_libro/{mid} (+ soportes/{sid}/partes/{n}) y crm_certificados/{cid} (+ partes/{n}).
// Regla de oro: los movimientos no se borran, se anulan con motivo. Las cuotas pagadas sin asiento
// se registran solas al abrir el libro. Concepto contable completo en CONTABILIDAD.md.
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, orderBy, serverTimestamp, arrayUnion }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, ctx, $app, esc, cop, fmtFecha, aviso, slug, descargar, hoyCO, mesDe, csv, sello, nombreDe, opcionesEquipo,
  nav, pestanas, kpi, guardarAdjunto, leerAdjunto, bajarAdjunto, bytesDe } from './comun.js';
import { totales, claseDe, TIPOS } from './comercial.js?v=4';

// ───────── plan de cuentas (códigos de 6 dígitos con la codificación del PUC, Decreto 2650/93) ─────────
// Clase 4 ingresos (41 operacionales, 42 no operacionales), 6 costos de lo vendido, 51 administración,
// 52 ventas, 53 no operacionales, 15 propiedad planta y equipo (inversión: no va al resultado).
// Las subcuentas (dos últimos dígitos) son propias de CDH Maker.
export const PLAN = [
  { codigo: '415501', nombre: 'Desarrollo de software', clase: 'ingreso', ayuda: 'Software a la medida, apps y sitios web que se cobran por proyecto o por hitos.' },
  { codigo: '415502', nombre: 'SaaS y suscripciones', clase: 'ingreso', ayuda: 'Mensualidades o licencias de uso de un software de CDH Maker (IncubApp, bots…).' },
  { codigo: '415503', nombre: 'Electrónica e IoT', clase: 'ingreso', ayuda: 'Diseño e integración de dispositivos, sensores, tarjetas y firmware.' },
  { codigo: '412001', nombre: 'Fabricación digital', clase: 'ingreso', ayuda: 'Piezas y servicios de impresión 3D, corte láser y CNC.' },
  { codigo: '413501', nombre: 'Venta de productos y componentes', clase: 'ingreso', ayuda: 'Reventa de módulos, kits o repuestos que CDH Maker no fabricó.' },
  { codigo: '415504', nombre: 'Consultoría y capacitación', clase: 'ingreso', ayuda: 'Asesorías, talleres, cursos y soporte por horas.' },
  { codigo: '421005', nombre: 'Rendimientos financieros', clase: 'ingreso', ayuda: 'Intereses de cuentas de ahorro, Nequi o CDT.' },
  { codigo: '429595', nombre: 'Otros ingresos', clase: 'ingreso', ayuda: 'Lo que no sale de la actividad: reintegros, aprovechamientos, venta de un equipo usado.' },

  { codigo: '612001', nombre: 'Materiales de fabricación digital', clase: 'costo', ayuda: 'Filamento, resina, MDF, acrílico e insumos que se gastan en piezas para clientes.' },
  { codigo: '613501', nombre: 'Componentes electrónicos', clase: 'costo', ayuda: 'Microcontroladores, sensores, PCB y piezas que quedan dentro de lo que se entrega.' },
  { codigo: '615501', nombre: 'Servidores y nube de un cliente', clase: 'costo', ayuda: 'Hosting, base de datos, APIs o dominio que se pagan para el proyecto de un cliente concreto.' },
  { codigo: '615502', nombre: 'Subcontratistas del proyecto', clase: 'costo', ayuda: 'Freelancers o talleres que hacen una parte del trabajo de un cliente.' },
  { codigo: '615503', nombre: 'Licencias para un proyecto', clase: 'costo', ayuda: 'Plantillas, plugins o licencias compradas solo para entregar un proyecto.' },
  { codigo: '615595', nombre: 'Otros costos directos', clase: 'costo', ayuda: 'Envíos al cliente, empaques y todo gasto que existe solo por un proyecto.' },

  { codigo: '510595', nombre: 'Seguridad social del titular', clase: 'gasto', ayuda: 'Planilla PILA de Henry como independiente (salud, pensión, ARL). En la renta se trata aparte.' },
  { codigo: '511095', nombre: 'Honorarios', clase: 'gasto', ayuda: 'Contador, abogado, diseñador o asesor que trabaja para el negocio en general, no para un cliente.' },
  { codigo: '511505', nombre: 'Impuestos y tasas', clase: 'gasto', ayuda: 'ICA, 4×1000 (GMF), avisos y tableros, tasas. El impuesto de renta no va aquí.' },
  { codigo: '512010', nombre: 'Arrendamientos', clase: 'gasto', ayuda: 'Coworking, local, bodega o alquiler de equipos.' },
  { codigo: '513535', nombre: 'Internet y celular', clase: 'gasto', ayuda: 'Plan de datos, internet del taller y telefonía de trabajo.' },
  { codigo: '513530', nombre: 'Servicios públicos', clase: 'gasto', ayuda: 'Energía y agua del taller u oficina (solo la parte que usa el negocio).' },
  { codigo: '513595', nombre: 'Hosting y dominios propios', clase: 'gasto', ayuda: 'Servidores, dominios y correo de CDH Maker que no son de un cliente.' },
  { codigo: '514005', nombre: 'Gastos legales', clase: 'gasto', ayuda: 'Cámara de Comercio, notaría, registro de marca, certificados.' },
  { codigo: '514510', nombre: 'Mantenimiento y repuestos', clase: 'gasto', ayuda: 'Reparación de impresoras, láser, CNC, computadores y herramientas.' },
  { codigo: '519501', nombre: 'Software y suscripciones', clase: 'gasto', ayuda: 'Herramientas de trabajo: GitHub, Figma, Adobe, IA, Google Workspace, antivirus.' },
  { codigo: '519530', nombre: 'Papelería y útiles', clase: 'gasto', ayuda: 'Papelería, impresiones, útiles de oficina, aseo y cafetería.' },
  { codigo: '519545', nombre: 'Transporte y mensajería', clase: 'gasto', ayuda: 'Taxis, buses, parqueaderos y domicilios del día a día (no los envíos de un cliente).' },
  { codigo: '519565', nombre: 'Equipos y herramientas menores', clase: 'gasto', ayuda: 'Herramientas y accesorios de bajo valor (menos de 50 UVT) que se gastan de una vez.' },
  { codigo: '519595', nombre: 'Otros gastos de administración', clase: 'gasto', ayuda: 'Lo que no encaja en otra cuenta. Úsala poco y explica en el concepto.' },
  { codigo: '523560', nombre: 'Publicidad y propaganda', clase: 'gasto', ayuda: 'Pauta en Meta, Google o TikTok, impresos, ferias, muestras y patrocinios.' },
  { codigo: '525505', nombre: 'Viajes y viáticos', clase: 'gasto', ayuda: 'Pasajes, hotel y alimentación en viajes de trabajo.' },
  { codigo: '530505', nombre: 'Gastos bancarios y comisiones', clase: 'gasto', ayuda: 'Cuota de manejo y comisiones de Wompi, Bold, PayU o transferencias.' },
  { codigo: '530520', nombre: 'Intereses', clase: 'gasto', ayuda: 'Intereses de créditos o tarjetas usadas para el negocio.' },
  { codigo: '531520', nombre: 'Multas y sanciones', clase: 'gasto', ayuda: 'Sanciones, intereses de mora con la DIAN o multas. No son deducibles en la renta.' },

  { codigo: '152805', nombre: 'Equipo de cómputo y comunicación', clase: 'inversion', ayuda: 'Computadores, celulares o servidores propios que se usan varios años.' },
  { codigo: '152005', nombre: 'Maquinaria y equipo', clase: 'inversion', ayuda: 'Impresoras 3D, láser, CNC e instrumentos de más de 50 UVT.' },
];
export const CUENTAS_INGRESO = PLAN.filter((c) => c.clase === 'ingreso').map((c) => c.nombre);
// Nombres del libro anterior (app.js) → cuentas nuevas.
const LEGADO = { 'Infraestructura y licencias': 'Software y suscripciones', 'Materiales e insumos': 'Materiales de fabricación digital',
  'Equipos y herramientas': 'Equipos y herramientas menores', 'Transporte y envíos': 'Transporte y mensajería', Publicidad: 'Publicidad y propaganda',
  'Impuestos y seguridad social': 'Impuestos y tasas', 'Servicios profesionales': 'Honorarios', 'Otros gastos': 'Otros gastos de administración' };
const porCodigo = new Map(PLAN.map((c) => [c.codigo, c]));
const porNombre = new Map(PLAN.map((c) => [c.nombre.toLowerCase(), c]));
const CLASES = { ingreso: ['Ingreso', 'ok'], costo: ['Costo', 'parcial'], gasto: ['Gasto', 'pendiente'], inversion: ['Inversión', 'info'] };
const GRUPOS = [['41', 'ing_op'], ['42', 'ing_noop'], ['6', 'costo'], ['7', 'costo'], ['51', 'adm'], ['52', 'ventas'], ['53', 'noop'], ['15', 'inversion']];
const grupoDe = (codigo) => GRUPOS.find(([p]) => String(codigo).startsWith(p))?.[1] || 'adm';

export function cuentaDe(m) {
  const n = String(m.cuenta || '').trim().toLowerCase();
  return porCodigo.get(m.cuenta_codigo) || porNombre.get(n) || porNombre.get(String(LEGADO[String(m.cuenta || '').trim()] || '').toLowerCase())
    || porNombre.get(m.tipo === 'ingreso' ? 'otros ingresos' : 'otros gastos de administración');
}
const num = (v) => Math.max(0, Math.round(Number(v) || 0));
const limpiarRet = (r = {}) => ({ fuente: num(r?.fuente), ica: num(r?.ica), otras: num(r?.otras) });
const sumaRet = (r) => num(r?.fuente) + num(r?.ica) + num(r?.otras);
const sinIndefinidos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// Lleva cualquier movimiento (nuevo o del libro anterior) al modelo actual.
export function normalizar(m) {
  const c = cuentaDe(m);
  const retenciones = limpiarRet(m.retenciones);
  const bruto = Number(m.bruto ?? m.valor ?? 0);
  const egreso = m.tipo === 'egreso';
  return { ...m, cuenta_original: m.cuenta, cuenta: c.nombre, cuenta_codigo: c.codigo, clase: egreso ? (c.clase === 'ingreso' ? 'gasto' : c.clase) : 'ingreso',
    grupo: grupoDe(c.codigo), bruto, valor: Number(m.valor ?? bruto), retenciones, ret_total: sumaRet(retenciones), neto: Number(m.neto ?? bruto - sumaRet(retenciones)),
    pagado_por: m.pagado_por || (egreso ? 'caja' : ''), reembolsable: !!m.reembolsable, reembolsado: !!m.reembolsado,
    soportes: m.soportes || [], soporte_tipo: m.soporte_tipo || '', estado: m.estado || 'vigente' };
}

export function resumenLibro(movs) {
  const r = { ingresos: 0, costos: 0, gastos: 0, inversiones: 0, resultado: 0 };
  for (const m of movs.map(normalizar)) {
    if (m.estado === 'anulado') continue;
    if (m.tipo === 'ingreso') r.ingresos += m.bruto;
    else if (m.clase === 'costo') r.costos += m.valor;
    else if (m.clase === 'inversion') r.inversiones += m.valor;
    else r.gastos += m.valor;
  }
  r.resultado = r.ingresos - r.costos - r.gastos;
  return r;
}

// ───────── cartera por edades ─────────
export const EDADES = [['corriente', 'Corriente'], ['1-30', '1 a 30 días'], ['31-60', '31 a 60 días'], ['61-90', '61 a 90 días'], ['90+', 'Más de 90 días']];
export const diasVencida = (vence, hoy = hoyCO()) => (vence ? Math.round((Date.parse(hoy + 'T12:00:00Z') - Date.parse(String(vence).slice(0, 10) + 'T12:00:00Z')) / 864e5) || 0 : 0);
export function edadDe(vence, hoy = hoyCO()) { const d = diasVencida(vence, hoy); return d <= 0 ? 'corriente' : d <= 30 ? '1-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+'; }
export function cartera(items, hoy = hoyCO()) {
  const t = Object.fromEntries(EDADES.map(([k]) => [k, 0]));
  for (const x of items) t[edadDe(x.fecha, hoy)] += Number(x.valor || 0);
  return t;
}

// ───────── UVT, tope de no responsable de IVA y retenciones ─────────
// UVT por año gravable (Resolución DIAN 000238 de 2025 fija la de 2026). Agregar cada diciembre.
export const UVT = { 2023: 42412, 2024: 47065, 2025: 49799, 2026: 52374 };
export const uvtDe = (anio) => UVT[anio] || UVT[Math.max(...Object.keys(UVT).map(Number).filter((a) => a <= Number(anio)), 2023)];
export const TOPE_IVA_UVT = 3500; // par. 3 art. 437 E.T.
export const TOPE_RENTA_UVT = 1400; // ingresos brutos que obligan a declarar renta (art. 592 E.T.)
// Tabla del art. 383 E.T. (base en UVT): aplica a honorarios y servicios personales de quien informa que no
// ha contratado dos o más trabajadores. Aproximación: resta el 25 % exento (tope mensual 790/12 UVT), no los aportes.
export function retencion383(bruto, uvt) {
  const exento = Math.min(bruto * 0.25, (790 / 12) * uvt);
  const b = (bruto - exento) / uvt;
  for (const [desde, tarifa, mas] of [[2300, 0.39, 770], [945, 0.37, 268], [640, 0.35, 162], [360, 0.33, 69], [150, 0.28, 10], [95, 0.19, 0]])
    if (b > desde) return Math.round(((b - desde) * tarifa + mas) * uvt);
  return 0;
}
// [clave, etiqueta, tarifa, base mínima en UVT, explicación]. Bases del Decreto 572 de 2025 (vigente desde
// junio de 2026, cuando el Consejo de Estado levantó su suspensión): servicios 2 UVT, compras 10 UVT.
export const CONCEPTOS_RET = [
  ['ninguna', 'Sin retención', 0, 0, 'Personas naturales que no son agentes de retención (la mayoría de particulares) pagan el valor completo.'],
  ['art383', 'Honorarios o servicios personales — tabla art. 383 (aprox.)', null, 0, 'Si le informaste al pagador que no tienes 2 o más trabajadores, debe usar la tabla de asalariados: en pagos pequeños suele dar cero.'],
  ['honorarios10', 'Honorarios 10 %', 0.10, 0, 'Persona natural que cobra honorarios (trabajo intelectual) a una empresa. Sin base mínima.'],
  ['honorarios11', 'Honorarios 11 %', 0.11, 0, 'Cuando los contratos con ese pagador superan 3.300 UVT en el año.'],
  ['software', 'Licencias o uso de software 3,5 %', 0.035, 0, 'Licenciamiento o derecho de uso de software (p. ej. SaaS).'],
  ['servicios4', 'Servicios generales — declarante 4 %', 0.04, 2, 'Servicios no intelectuales (fabricación por encargo, instalación). Base mínima 2 UVT.'],
  ['servicios6', 'Servicios generales — no declarante 6 %', 0.06, 2, 'Igual que el anterior si no declaras renta.'],
  ['compras25', 'Compras de bienes — declarante 2,5 %', 0.025, 10, 'Venta de productos (piezas, kits, componentes). Base mínima 10 UVT.'],
  ['compras35', 'Compras de bienes — no declarante 3,5 %', 0.035, 10, 'Igual que el anterior si no declaras renta.'],
  ['otra', 'Otra (escribe el valor)', null, 0, 'Copia el valor exacto del comprobante de egreso o del certificado del pagador.'],
];
export function sugerirRetencion(concepto, bruto, uvt) {
  const c = CONCEPTOS_RET.find(([k]) => k === concepto);
  if (!c || concepto === 'otra') return null;
  if (concepto === 'art383') return retencion383(bruto, uvt);
  return bruto >= c[3] * uvt ? Math.round(bruto * c[2]) : 0;
}

const MEDIOS = ['Bancolombia', 'Nequi', 'Daviplata', 'Efectivo', 'Tarjeta de crédito', 'Otro'];
const SOPORTES = [['factura_electronica', 'Factura electrónica a nombre de Henry'], ['documento_soporte', 'Documento soporte (proveedor no obligado a facturar)'],
  ['cuenta_cobro', 'Cuenta de cobro del proveedor'], ['recibo', 'Recibo, tiquete POS o pantallazo'], ['sin_soporte', 'Sin soporte']];
const deducible = (t) => ['factura_electronica', 'documento_soporte'].includes(t);
const quien = (id) => (id === 'caja' ? 'Caja CDH Maker' : id ? nombreDe(id) : '—');
const opcionesCuentas = (clases, sel) => Object.entries(CLASES).filter(([k]) => clases.includes(k)).map(([k, [n]]) => `<optgroup label="${n}s">${PLAN.filter((c) => c.clase === k)
  .map((c) => `<option value="${c.codigo}" ${c.codigo === sel ? 'selected' : ''}>${c.codigo} · ${esc(c.nombre)}</option>`).join('')}</optgroup>`).join('');
const opciones = (lista, sel) => lista.map((x) => { const [v, n] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`; }).join('');
const chipClase = (m) => `<span class="chip ${CLASES[m.clase]?.[1] || 'neutro'}">${CLASES[m.clase]?.[0] || m.clase}</span>`;
const enPeriodo = (f, p) => !p || String(f || '').startsWith(p);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const barra = (p, cls) => `<div style="height:10px;background:var(--linea);border-radius:6px;overflow:hidden;margin:6px 0"><div style="width:${Math.min(100, p)}%;height:100%;background:var(--${cls})"></div></div>`;
// Botón «Subir» que abre el <input type=file> oculto que lo sigue.
const enlazarElegir = () => $app.querySelectorAll('[data-elegir]').forEach((b) => b.addEventListener('click', () => b.nextElementSibling.click()));
const csvDe = (filas, nombre) => descargar(new TextEncoder().encode('﻿' + csv(filas)), nombre, 'text/csv');

function modal(html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal'; dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

// ───────── escritura ─────────
export const idAsientoCuota = (cliente, n) => `cuota-${cliente}-${n}`;
const leerLibro = async () => (await getDocs(query(collection(db, 'crm_libro'), orderBy('fecha', 'desc')))).docs.map((d) => ({ id: d.id, ...d.data() }));
export async function cargarMovimientos() { return (await leerLibro()).map(normalizar); }

async function adjuntar(mid, file, tipo = 'comprobante') {
  const { bytes, mime, nombre } = await bytesDe(file);
  const sid = await guardarAdjunto(['crm_libro', mid, 'soportes'], { nombre, tipo, mime, bytes });
  await updateDoc(doc(db, 'crm_libro', mid), { soportes: arrayUnion({ id: sid, nombre, mime, tamano: bytes.length, tipo }), ...sello() });
  return sid;
}

export async function asientoCuota(clienteId, c, q, pago = null) {
  const p = pago || q.pago || null;
  const bruto = num(p?.bruto ?? q.valor);
  const retenciones = limpiarRet(p?.retenciones);
  const cta = cuentaDe({ cuenta: c.cuenta_contable || 'Desarrollo de software', tipo: 'ingreso' });
  const id = idAsientoCuota(clienteId, q.n);
  await setDoc(doc(db, 'crm_libro', id), {
    fecha: p?.fecha || q.fecha_pago, tipo: 'ingreso', clase: 'ingreso', cuenta: cta.nombre, cuenta_codigo: cta.codigo,
    concepto: `Cuota ${q.n} de ${(c.cuotas || []).length || q.n} — ${c.proyecto || c.nombre}`, tercero: c.nombre || '', documento: c.documento || '',
    cliente: clienteId, cuota: q.n, valor: bruto, bruto, retenciones, neto: bruto - sumaRet(retenciones), medio: p?.medio || q.medio || '',
    referencia: p?.referencia ?? q.referencia ?? '', soporte_tipo: 'cuenta_cobro', estado: 'vigente', origen: 'cuota', soportes: [], ...sello(true),
  });
  if (p?.archivo) await adjuntar(id, p.archivo, 'comprobante de pago');
  return id;
}

export async function registrarIngresoDocumento(docId, d, pago) {
  const id = 'factura-' + docId;
  const clase = claseDe(d);
  const bruto = num(pago.bruto ?? totales(d).total);
  const retenciones = limpiarRet(pago.retenciones);
  const neto = bruto - sumaRet(retenciones);
  const cta = cuentaDe({ cuenta: d.cuenta_contable || 'Desarrollo de software', tipo: 'ingreso' });
  await setDoc(doc(db, 'crm_libro', id), {
    fecha: pago.fecha, tipo: 'ingreso', clase: 'ingreso', cuenta: cta.nombre, cuenta_codigo: cta.codigo,
    concepto: `${TIPOS[clase].corto} ${d.numero || ''}${d.titulo ? ' — ' + d.titulo : ''}`, tercero: d.receptor?.nombre || '', documento: d.receptor?.documento || '',
    cliente: d.cliente || '', documento_id: docId, numero_soporte: d.numero || '', soporte_tipo: clase === 'factura_venta' ? 'factura_electronica' : 'cuenta_cobro',
    valor: bruto, bruto, retenciones, neto, medio: pago.medio || '', referencia: pago.referencia || '', estado: 'vigente', origen: 'factura', soportes: [], ...sello(true),
  });
  const soporte_id = pago.archivo ? await adjuntar(id, pago.archivo, 'comprobante de pago') : '';
  return { fecha: pago.fecha, bruto, retenciones, recibido: neto, medio: pago.medio || '', referencia: pago.referencia || '', asiento: id,
    ...(soporte_id ? { soporte_id } : {}), registrado_por: ctx.usuario.email };
}

export async function anularAsiento(aid, motivo) {
  const ref = doc(db, 'crm_libro', aid);
  if ((await getDoc(ref)).exists()) await updateDoc(ref, { estado: 'anulado', motivo_anulacion: motivo || '', anulado_en: serverTimestamp(), anulado_por: ctx.usuario.email, ...sello() });
}

// Para otros módulos (Marketing registra su pauta con cuenta 'Publicidad y propaganda').
export async function registrarMovimiento(datos) {
  const { archivo, archivos, ...resto } = datos;
  const tipo = resto.tipo === 'ingreso' ? 'ingreso' : 'egreso';
  const cta = cuentaDe({ ...resto, tipo });
  const valor = num(resto.valor ?? resto.bruto);
  if (!(valor > 0)) throw new Error('El valor debe ser mayor que cero.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resto.fecha || '')) throw new Error('La fecha debe tener el formato AAAA-MM-DD.');
  const retenciones = limpiarRet(resto.retenciones);
  const pagado_por = tipo === 'egreso' ? resto.pagado_por || 'caja' : '';
  const ref = await addDoc(collection(db, 'crm_libro'), sinIndefinidos({
    concepto: '', tercero: '', cliente: '', medio: '', referencia: '', proveedor_nit: '', numero_soporte: '', origen: 'manual', ...resto,
    documento: resto.documento ?? resto.proveedor_nit ?? '', tipo, clase: tipo === 'ingreso' ? 'ingreso' : cta.clase === 'ingreso' ? 'gasto' : cta.clase,
    cuenta: cta.nombre, cuenta_codigo: cta.codigo, valor, bruto: valor, retenciones, neto: valor - sumaRet(retenciones), pagado_por,
    reembolsable: tipo === 'egreso' && pagado_por !== 'caja' && resto.reembolsable !== false, reembolsado: false,
    soporte_tipo: resto.soporte_tipo || (tipo === 'egreso' ? 'sin_soporte' : ''), estado: 'vigente', soportes: [], ...sello(true),
  }));
  for (const f of [archivo, ...(archivos || [])].filter(Boolean)) await adjuntar(ref.id, f);
  return ref.id;
}

// ───────── diálogo de pago recibido (cuenta de cobro, factura o cuota) ─────────
export function dialogoPago({ titulo = 'Registrar pago', total = 0, tercero = '' } = {}) {
  return new Promise((resolver) => {
    const uvt = uvtDe(hoyCO().slice(0, 4));
    const dlg = modal(`<form id="fPago" novalidate>
      <h2 style="margin-top:0">${esc(titulo)}</h2>
      <p class="suave">${tercero ? `Paga <b>${esc(tercero)}</b> · ` : ''}total del documento <b>${cop(total)}</b></p>
      <div class="grid"><div><label>Fecha del pago</label><input name="fecha" type="date" value="${hoyCO()}" required></div>
        <div><label>Valor bruto (antes de retenciones)</label><input name="bruto" type="number" min="1" step="1" value="${num(total)}" required></div>
        <div><label>Medio</label><select name="medio">${opciones(['Bancolombia', 'Nequi', 'Efectivo', 'Otro'], 'Bancolombia')}</select></div>
        <div><label>Referencia</label><input name="referencia" placeholder="N.º de transferencia o comprobante"></div></div>
      <h3>Retenciones que practicó el pagador</h3>
      <p class="suave" style="margin-top:0">Las empresas y entidades que son agentes de retención te consignan menos que el bruto: la diferencia es un anticipo de tu renta (y de tu ICA) y se descuenta en tu declaración. Copia los valores del comprobante de egreso.</p>
      <label>Retención en la fuente — concepto</label><select name="concepto">${opciones(CONCEPTOS_RET.map(([k, n]) => [k, n]), 'ninguna')}</select>
      <small class="suave" id="explica"></small>
      <div class="grid"><div><label>Retención en la fuente</label><input name="fuente" type="number" min="0" step="1" value="0"></div>
        <div><label>ReteICA — tarifa por mil</label><input name="ica_tarifa" type="number" min="0" step="0.01" value="0" placeholder="Ej. 7 ó 9,66"></div>
        <div><label>ReteICA</label><input name="ica" type="number" min="0" step="1" value="0"></div>
        <div><label>Otras retenciones</label><input name="otras" type="number" min="0" step="1" value="0"></div></div>
      <small class="suave">ReteICA: la tarifa depende del municipio y de la actividad; está en el comprobante del pagador. UVT ${hoyCO().slice(0, 4)}: ${cop(uvt)}.</small>
      <div class="totales"><div class="gran"><span>Neto recibido</span><b id="neto"></b></div></div>
      <label>Comprobante del pago (opcional)</label><input name="archivo" type="file" accept="image/*,application/pdf">
      <div id="mPago"></div>
      <div class="acciones"><button class="primario" value="ok">Registrar pago</button><button type="button" id="cancelar">Cancelar</button></div></form>`);
    const f = dlg.querySelector('form'), $ = (n) => f.elements[n];
    const recalcular = (cual) => {
      const bruto = num($('bruto').value);
      const c = CONCEPTOS_RET.find(([k]) => k === $('concepto').value);
      dlg.querySelector('#explica').textContent = c?.[4] || '';
      if (cual !== 'fuente') { const s = sugerirRetencion($('concepto').value, bruto, uvt); if (s !== null) $('fuente').value = s; }
      if (cual === 'tarifa' || cual === 'bruto') $('ica').value = Math.round(bruto * (Number($('ica_tarifa').value) || 0) / 1000);
      const neto = bruto - num($('fuente').value) - num($('ica').value) - num($('otras').value);
      dlg.querySelector('#neto').textContent = cop(neto);
      return { bruto, neto };
    };
    f.addEventListener('input', (e) => recalcular({ bruto: 'bruto', concepto: 'concepto', ica_tarifa: 'tarifa' }[e.target.name] || 'fuente'));
    recalcular('concepto');
    dlg.querySelector('#cancelar').onclick = () => dlg.close();
    dlg.addEventListener('close', () => resolver(null));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const { bruto, neto } = recalcular('fuente');
      const m = dlg.querySelector('#mPago');
      if (!/^\d{4}-\d{2}-\d{2}$/.test($('fecha').value)) return aviso(m, 'Escribe la fecha del pago.', 'err');
      if (!(bruto > 0)) return aviso(m, 'El valor bruto debe ser mayor que cero.', 'err');
      if (neto < 0) return aviso(m, 'Las retenciones no pueden superar el valor bruto.', 'err');
      resolver({ fecha: $('fecha').value, bruto, retenciones: { fuente: num($('fuente').value), ica: num($('ica').value), otras: num($('otras').value) },
        recibido: neto, medio: $('medio').value, referencia: $('referencia').value.trim(), archivo: $('archivo').files[0] || null });
      dlg.close();
    });
  });
}

// ───────── vista principal ─────────
const SUB = [['', 'Resumen'], ['movimientos', 'Movimientos'], ['nuevo', '+ Gasto o costo'], ['comprobantes', 'Comprobantes'],
  ['cobrar', 'Por cobrar'], ['reembolsos', 'Reembolsos'], ['impuestos', 'Impuestos'], ['exportar', 'Exportar']];
const filtros = { clase: '', cuenta: '', persona: '', cliente: '', estado: 'vigente', texto: '' };
let ultimas = [];

export async function vistaLibro(partes = []) {
  nav('libro');
  ultimas = partes;
  const p = (Array.isArray(partes) ? partes : [partes]).map((x) => { try { return decodeURIComponent(x || ''); } catch { return x || ''; } });
  let [sub = '', periodo = ''] = p;
  if (sub === 'gastos' || sub === 'ingresos') { filtros.clase = sub === 'gastos' ? 'egreso' : 'ingreso'; sub = 'movimientos'; }
  if (/^\d{4}(-\d{2})?$/.test(sub)) { periodo = sub; sub = ''; }
  if (sub === 'resumen') sub = '';
  $app.innerHTML = '<div class="vacio">Cargando el libro…</div>';
  const D = await cargarTodo();
  const per = periodo === 'todo' ? '' : periodo || D.hoy.slice(0, 4);
  const vig = D.movs.filter((m) => m.estado !== 'anulado');
  const sinSoporte = vig.filter((m) => m.tipo === 'egreso' && !m.soportes.length).length;
  const pendReemb = vig.filter((m) => m.tipo === 'egreso' && m.reembolsable && !m.reembolsado).length;
  const tabs = SUB.map(([k, n]) => [k, n, { comprobantes: sinSoporte || undefined, cobrar: D.cxc.length || undefined, reembolsos: pendReemb || undefined }[k]]);
  D.cab = `<h1 class="titulo">Contabilidad</h1><p class="bajada">Libro de ingresos, costos y gastos de CDH Maker. Los movimientos no se borran: se anulan con su motivo.</p>
    ${pestanas('libro', tabs, sub)}${D.nuevos ? `<div class="aviso ok">Se registraron ${D.nuevos} pago(s) de cuotas que venían del CRM.</div>` : ''}`;
  D.periodo = periodo; D.per = per; D.sub = sub || 'resumen';
  await ({ '': vResumen, movimientos: vMovimientos, nuevo: vNuevo, comprobantes: vComprobantes, cobrar: vCobrar, reembolsos: vReembolsos,
    impuestos: vImpuestos, exportar: vExportar }[sub] || vResumen)(D);
}
const rehacer = () => vistaLibro(ultimas);

async function cargarTodo() {
  const [clientes, documentos] = await Promise.all([
    getDocs(collection(db, 'crm_clientes')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    getDocs(query(collection(db, 'crm_documentos'), where('estado', '==', 'emitida'))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ]);
  let crudos = await leerLibro();
  // Cuotas pagadas que aún no tienen asiento (p. ej. importadas): se registran una sola vez.
  const tienen = new Set(crudos.map((m) => m.id));
  let nuevos = 0;
  for (const c of clientes) for (const q of c.cuotas || []) {
    if (q.estado !== 'pagada' || !q.fecha_pago || !(Number(q.valor) > 0) || tienen.has(idAsientoCuota(c.id, q.n))) continue;
    try { await asientoCuota(c.id, c, q); nuevos++; } catch (e) { console.error('Cuota sin asiento', c.id, q.n, e); }
  }
  if (nuevos) crudos = await leerLibro();
  const hoy = hoyCO();
  // Por cobrar: cuotas pendientes de los clientes y cuentas de cobro / facturas emitidas sin pagar.
  const cxc = [
    ...clientes.flatMap((c) => (c.cuotas || []).filter((q) => q.estado !== 'pagada').map((q) => ({ fecha: q.fecha, href: '#cliente/' + encodeURIComponent(c.id),
      cliente: c.id, nombre: c.nombre, concepto: `Cuota ${q.n} de ${(c.cuotas || []).length}`, valor: Number(q.valor || 0) }))),
    ...documentos.map((f) => ({ fecha: f.vence || f.fecha, href: '#doc/' + f.id, cliente: f.cliente || '', nombre: f.receptor?.nombre || '',
      concepto: `${TIPOS[claseDe(f)].corto} ${f.numero || ''}`, valor: totales(f).total })),
  ].map((x) => ({ ...x, edad: edadDe(x.fecha, hoy), dias: diasVencida(x.fecha, hoy) })).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  return { clientes, documentos, movs: crudos.map(normalizar), nuevos, hoy, cxc, nombreCliente: Object.fromEntries(clientes.map((c) => [c.id, c.nombre])) };
}

function selPeriodo(D) {
  const anios = [...new Set([D.hoy.slice(0, 4), ...D.movs.map((m) => String(m.fecha).slice(0, 4))])].sort().reverse();
  const meses = [...new Set(D.movs.map((m) => mesDe(m.fecha)))].sort().reverse();
  const sel = D.periodo === 'todo' ? 'todo' : D.per;
  setTimeout(() => document.getElementById('periodo')?.addEventListener('change', (e) => (location.hash = `libro/${D.sub}/${e.target.value}`)));
  return `<select id="periodo" style="width:auto"><option value="todo" ${sel === 'todo' ? 'selected' : ''}>Todo el periodo</option>
    <optgroup label="Año">${anios.map((a) => `<option ${a === sel ? 'selected' : ''}>${a}</option>`).join('')}</optgroup>
    <optgroup label="Mes">${meses.map((x) => `<option ${x === sel ? 'selected' : ''}>${x}</option>`).join('')}</optgroup></select>`;
}
const barraHerr = (D, extra = '') => `<div class="acciones" style="margin:0 0 12px">${selPeriodo(D)}${extra}</div>`;

// ── resumen y estado de resultados ──
function vResumen(D) {
  const vig = D.movs.filter((m) => m.estado !== 'anulado' && enPeriodo(m.fecha, D.per));
  const r = resumenLibro(vig);
  const ret = vig.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.ret_total, 0);
  const cxc = D.cxc.reduce((s, x) => s + x.valor, 0), vencida = D.cxc.filter((x) => x.edad !== 'corriente').reduce((s, x) => s + x.valor, 0);
  const reemb = D.movs.filter((m) => m.estado !== 'anulado' && m.tipo === 'egreso' && m.reembolsable && !m.reembolsado).reduce((s, m) => s + m.valor, 0);
  const sinSop = vig.filter((m) => m.tipo === 'egreso' && !m.soportes.length);
  const suma = (g) => { const t = new Map(); for (const m of vig.filter((x) => x.grupo === g)) t.set(m.cuenta_codigo, (t.get(m.cuenta_codigo) || 0) + (m.tipo === 'ingreso' ? m.bruto : m.valor)); return [...t].sort(([a], [b]) => a.localeCompare(b)); };
  const T = (l) => l.reduce((s, [, v]) => s + v, 0);
  const bloque = (titulo, lista) => `<tr><td colspan="2"><b>${titulo}</b></td></tr>${lista.map(([k, v]) => `<tr><td><small class="suave">${k}</small> ${esc(porCodigo.get(k).nombre)}</td><td style="text-align:right">${cop(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="suave">—</td></tr>'}`;
  const total = (t, v, fuerte) => `<tr><td>${fuerte ? `<b>${t}</b>` : t}</td><td style="text-align:right">${fuerte ? `<b>${cop(v)}</b>` : cop(v)}</td></tr>`;
  const ingOp = suma('ing_op'), costos = suma('costo'), adm = suma('adm'), ven = suma('ventas'), ingNo = suma('ing_noop'), gNo = suma('noop'), inv = suma('inversion');
  const bruta = T(ingOp) - T(costos), oper = bruta - T(adm) - T(ven);
  // Rentabilidad por proyecto: ingresos y costos asociados a cada cliente.
  const proy = new Map();
  for (const m of vig.filter((x) => x.cliente && (x.tipo === 'ingreso' || x.clase === 'costo'))) {
    const p = proy.get(m.cliente) || { ing: 0, cos: 0 };
    if (m.tipo === 'ingreso') p.ing += m.bruto; else p.cos += m.valor;
    proy.set(m.cliente, p);
  }
  const meses = [...new Set(vig.map((m) => mesDe(m.fecha)))].sort().reverse();
  $app.innerHTML = `${D.cab}${barraHerr(D, `<a class="boton primario" href="#libro/nuevo">+ Registrar gasto o costo</a>`)}
  <div class="kpis">${kpi('Ingresos', cop(r.ingresos), 'ok', 'brutos, antes de retenciones')}${kpi('Costos', cop(r.costos), '', 'directos de proyectos')}${kpi('Gastos', cop(r.gastos))}
    ${kpi('Resultado', cop(r.resultado), r.resultado >= 0 ? 'ok' : 'err', r.ingresos ? `margen ${pct(r.resultado, r.ingresos)} %` : '')}
    ${kpi('Retenciones a favor', cop(ret), 'cian', 'anticipo de renta e ICA')}${kpi('Por cobrar', cop(cxc), vencida ? 'warn' : '', vencida ? `${cop(vencida)} vencido` : 'al día')}
    ${kpi('Reembolsos pendientes', cop(reemb), reemb ? 'warn' : '')}${kpi('Egresos sin soporte', sinSop.length, sinSop.length ? 'err' : 'ok', sinSop.length ? cop(sinSop.reduce((s, m) => s + m.valor, 0)) : 'todo soportado')}</div>
  <div class="cols mitad"><div class="card"><h2>Estado de resultados ${D.per ? esc(D.per) : ''}</h2><div class="tabla"><table>
      ${bloque('Ingresos operacionales', ingOp)}${total('Total ingresos operacionales', T(ingOp), true)}
      ${bloque('Costos de lo vendido', costos)}${total('Utilidad bruta', bruta, true)}
      ${bloque('Gastos de administración', adm)}${bloque('Gastos de ventas', ven)}${total('Utilidad operacional', oper, true)}
      ${bloque('Ingresos no operacionales', ingNo)}${bloque('Gastos no operacionales', gNo)}
      ${total('Resultado del periodo (antes de impuesto de renta)', oper + T(ingNo) - T(gNo), true)}</table></div>
      ${inv.length ? `<p class="suave">Compras de equipo (inversión, no afectan el resultado): ${inv.map(([k, v]) => `${esc(porCodigo.get(k).nombre)} ${cop(v)}`).join(' · ')}.</p>` : ''}</div>
    <div><div class="card"><h2>Rentabilidad por proyecto</h2>${proy.size ? `<div class="tabla"><table><tr><th>Cliente</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Costos</th><th style="text-align:right">Margen</th></tr>
      ${[...proy].sort((a, b) => b[1].ing - a[1].ing).map(([k, p]) => `<tr><td><a href="#cliente/${encodeURIComponent(k)}">${esc(D.nombreCliente[k] || k)}</a></td><td style="text-align:right">${cop(p.ing)}</td><td style="text-align:right">${cop(p.cos)}</td>
        <td style="text-align:right"><b>${cop(p.ing - p.cos)}</b><br><small class="suave">${p.ing ? pct(p.ing - p.cos, p.ing) + ' %' : '—'}</small></td></tr>`).join('')}</table></div>`
      : '<div class="vacio">Asocia los costos a un cliente al registrarlos para ver aquí lo que deja cada proyecto.</div>'}</div>
    <div class="card"><h2>Por mes</h2>${meses.length ? `<div class="tabla"><table><tr><th>Mes</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Costos y gastos</th><th style="text-align:right">Resultado</th></tr>
      ${meses.map((x) => { const s = resumenLibro(vig.filter((m) => mesDe(m.fecha) === x)); return `<tr class="fila" data-ir="libro/movimientos/${x}"><td>${x}</td><td style="text-align:right">${cop(s.ingresos)}</td><td style="text-align:right">${cop(s.costos + s.gastos)}</td>
        <td style="text-align:right;color:var(--${s.resultado >= 0 ? 'ok' : 'err'})">${cop(s.resultado)}</td></tr>`; }).join('')}</table></div>` : '<div class="vacio">Sin movimientos en este periodo.</div>'}</div></div></div>`;
  $app.querySelectorAll('[data-ir]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.ir)));
}

// ── movimientos ──
function vMovimientos(D) {
  const personas = [['caja', 'Caja CDH Maker'], ...ctx.equipo.map((p) => [p.id, p.nombre_corto || p.nombre])];
  const usadas = PLAN.filter((c) => D.movs.some((m) => m.cuenta_codigo === c.codigo));
  $app.innerHTML = `${D.cab}${barraHerr(D, `<a class="boton primario" href="#libro/nuevo">+ Gasto o costo</a>`)}
  <div class="card"><div class="grid">
    <div><label>Clase</label><select data-f="clase">${opciones([['', 'Todas'], ['ingreso', 'Ingresos'], ['egreso', 'Costos y gastos'], ['costo', 'Solo costos'], ['gasto', 'Solo gastos'], ['inversion', 'Inversión']], filtros.clase)}</select></div>
    <div><label>Cuenta</label><select data-f="cuenta"><option value="">Todas</option>${usadas.map((c) => `<option value="${c.codigo}" ${c.codigo === filtros.cuenta ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
    <div><label>Pagó</label><select data-f="persona">${opciones([['', 'Cualquiera'], ...personas], filtros.persona)}</select></div>
    <div><label>Cliente o proyecto</label><select data-f="cliente"><option value="">Todos</option>${D.clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === filtros.cliente ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
    <div><label>Estado</label><select data-f="estado">${opciones([['vigente', 'Vigentes'], ['anulado', 'Anulados'], ['', 'Todos']], filtros.estado)}</select></div>
    <div><label>Buscar</label><input data-f="texto" type="search" value="${esc(filtros.texto)}" placeholder="Concepto, tercero, referencia"></div></div></div>
  <div class="card" id="tMovs"></div>`;
  const pintar = () => {
    const t = filtros.texto.trim().toLowerCase();
    const lista = D.movs.filter((m) => enPeriodo(m.fecha, D.per) && (!filtros.estado || m.estado === filtros.estado)
      && (!filtros.clase || (filtros.clase === 'egreso' ? m.tipo === 'egreso' : m.clase === filtros.clase)) && (!filtros.cuenta || m.cuenta_codigo === filtros.cuenta)
      && (!filtros.persona || m.pagado_por === filtros.persona) && (!filtros.cliente || m.cliente === filtros.cliente)
      && (!t || `${m.concepto} ${m.tercero} ${m.referencia} ${m.numero_soporte || ''} ${m.cuenta}`.toLowerCase().includes(t)));
    const s = resumenLibro(lista.filter((m) => m.estado !== 'anulado'));
    document.getElementById('tMovs').innerHTML = `<h2>Movimientos ${D.per ? esc(D.per) : ''} (${lista.length})</h2>
      <p class="suave">Ingresos ${cop(s.ingresos)} · costos ${cop(s.costos)} · gastos ${cop(s.gastos)}${s.inversiones ? ' · inversión ' + cop(s.inversiones) : ''} · resultado <b>${cop(s.resultado)}</b></p>
      ${lista.length ? `<div class="tabla"><table><tr><th>Fecha</th><th>Cuenta / concepto</th><th>Tercero</th><th>Pagó</th><th>Soporte</th><th style="text-align:right">Valor</th></tr>
      ${lista.map((m) => `<tr class="fila" data-mov="${esc(m.id)}" style="${m.estado === 'anulado' ? 'opacity:.45;text-decoration:line-through' : ''}"><td style="white-space:nowrap">${esc(m.fecha)}</td>
        <td>${chipClase(m)} <b>${esc(m.cuenta)}</b><br><small>${esc(m.concepto)}${m.cliente ? ' · ' + esc(D.nombreCliente[m.cliente] || m.cliente) : ''}</small></td>
        <td>${esc(m.tercero || '')}</td><td>${m.tipo === 'egreso' ? esc(quien(m.pagado_por)) + (m.reembolsable ? `<br><span class="chip ${m.reembolsado ? 'ok' : 'pendiente'}">${m.reembolsado ? 'reembolsado' : 'por reembolsar'}</span>` : '') : '<span class="suave">—</span>'}</td>
        <td>${m.soportes.length ? `<span class="chip ok">${m.soportes.length} archivo(s)</span>` : m.tipo === 'egreso' ? '<span class="chip vencido">sin soporte</span>' : '<span class="chip neutro">—</span>'}</td>
        <td style="text-align:right;white-space:nowrap;font-weight:600;color:var(--${m.tipo === 'ingreso' ? 'ok' : 'err'})">${m.tipo === 'ingreso' ? '+' : '−'} ${cop(m.tipo === 'ingreso' ? m.bruto : m.valor)}${m.ret_total ? `<br><small class="suave">neto ${cop(m.neto)}</small>` : ''}</td></tr>`).join('')}</table></div>`
      : '<div class="vacio">Sin movimientos con estos filtros.</div>'}`;
    document.querySelectorAll('#tMovs [data-mov]').forEach((tr) => tr.addEventListener('click', () => detalle(D.movs.find((m) => m.id === tr.dataset.mov), D)));
  };
  $app.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => { filtros[el.dataset.f] = el.value; pintar(); }));
  pintar();
}

// Detalle de un movimiento: soportes, reclasificar, reembolso y anulación.
function detalle(m, D) {
  const ligado = ['cuota', 'factura'].includes(m.origen);
  const dlg = modal(`<div class="cab" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2 style="margin:0">${chipClase(m)} ${cop(m.tipo === 'ingreso' ? m.bruto : m.valor)}</h2><button class="mini" id="cerrar">Cerrar</button></div>
    <p><b>${esc(m.concepto)}</b><br><small class="suave">${esc(m.fecha)} · ${esc(m.cuenta_codigo)} ${esc(m.cuenta)}${m.cuenta_original && m.cuenta_original !== m.cuenta ? ` (antes «${esc(m.cuenta_original)}»)` : ''}</small></p>
    <div class="tabla"><table>
      <tr><td>Tercero</td><td>${esc(m.tercero || '—')}${m.documento || m.proveedor_nit ? ` · ${esc(m.proveedor_nit || m.documento)}` : ''}</td></tr>
      ${m.tipo === 'ingreso' ? `<tr><td>Retenciones</td><td>Fuente ${cop(m.retenciones.fuente)} · ICA ${cop(m.retenciones.ica)} · otras ${cop(m.retenciones.otras)} → neto <b>${cop(m.neto)}</b></td></tr>`
        : `<tr><td>Pagó</td><td>${esc(quien(m.pagado_por))}${m.reembolsable ? (m.reembolsado ? ` · reembolsado ${esc(m.reembolso?.fecha || '')}` : ' · <b>por reembolsar</b>') : m.pagado_por !== 'caja' ? ' · aporte (no se reembolsa)' : ''}</td></tr>
          <tr><td>Soporte</td><td>${esc(SOPORTES.find(([k]) => k === m.soporte_tipo)?.[1] || 'No indicado')}${m.numero_soporte ? ' N.º ' + esc(m.numero_soporte) : ''} ${deducible(m.soporte_tipo) ? '<span class="chip ok">deducible</span>' : '<span class="chip pendiente">revisar deducibilidad</span>'}</td></tr>`}
      <tr><td>Medio</td><td>${esc(m.medio || '—')}${m.referencia ? ' · ' + esc(m.referencia) : ''}</td></tr>
      <tr><td>Registro</td><td>${esc(m.creado_por || '')} · ${fmtFecha(m.creado, true)} · origen ${esc(m.origen || 'manual')}</td></tr>
      ${m.estado === 'anulado' ? `<tr><td>Anulado</td><td>${esc(m.motivo_anulacion || '')} · ${esc(m.anulado_por || '')}</td></tr>` : ''}</table></div>
    <h3>Comprobantes</h3><div id="sops">${m.soportes.length ? '' : '<p class="suave">Sin archivos.</p>'}</div>
    <div class="acciones"><input type="file" id="nuevoSop" accept="image/*,application/pdf" multiple style="width:auto"><button class="mini" id="subirSop">Adjuntar</button></div>
    ${m.estado !== 'anulado' ? `<details><summary class="suave" style="cursor:pointer">Reclasificar (cuenta o proyecto)</summary>
      <label>Cuenta</label><select id="rCuenta">${opcionesCuentas(m.tipo === 'ingreso' ? ['ingreso'] : ['costo', 'gasto', 'inversion'], m.cuenta_codigo)}</select>
      <label>Cliente o proyecto</label><select id="rCliente"><option value="">— General de CDH Maker —</option>${D.clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === m.cliente ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
      <div class="acciones"><button class="mini primario" id="reclasificar">Guardar clasificación</button></div></details>
      ${m.tipo === 'egreso' && m.reembolsable && !m.reembolsado ? '<div class="acciones"><button class="mini primario" id="reembolsar">Marcar reembolsado</button></div>' : ''}
      ${ligado ? `<p class="suave">Este ingreso viene de ${m.origen === 'cuota' ? `una cuota: para anularlo deshaz el pago en <a href="#cliente/${encodeURIComponent(m.cliente)}">el cliente</a>` : `un documento: para anularlo usa «Deshacer pago» en <a href="#doc/${esc(m.documento_id)}">el documento</a>`}.</p>`
        : `<details><summary class="suave" style="cursor:pointer">Anular movimiento</summary><label>Motivo de la anulación</label><textarea id="motivo" class="texto" placeholder="Ej. registrado dos veces"></textarea>
          <div class="acciones"><button class="mini peligro" id="anular">Anular</button></div></details>`}` : ''}<div id="mDet"></div>`);
  const $m = dlg.querySelector('#mDet');
  dlg.querySelector('#cerrar').onclick = () => dlg.close();
  const sops = dlg.querySelector('#sops');
  m.soportes.forEach((s) => {
    const div = document.createElement('div'); div.className = 'sol';
    div.innerHTML = `<div class="cab"><span>${esc(s.nombre)} <small class="suave">${Math.round((s.tamano || 0) / 1024)} KB</small></span><button class="mini">Descargar</button></div>`;
    div.querySelector('button').onclick = () => bajarAdjunto(['crm_libro', m.id, 'soportes'], s.id, s);
    if (/^image\//.test(s.mime)) leerAdjunto(['crm_libro', m.id, 'soportes'], s.id).then((b) => { const img = new Image(); img.src = URL.createObjectURL(new Blob([b], { type: s.mime })); img.alt = s.nombre; img.style.cssText = 'max-width:100%;border-radius:8px;margin-top:6px'; div.append(img); }).catch(() => {});
    sops.append(div);
  });
  const hacer = (fn) => async () => { try { aviso($m, 'Guardando…'); await fn(); dlg.close(); await rehacer(); } catch (e) { console.error(e); aviso($m, esc(e.code || e.message), 'err'); } };
  dlg.querySelector('#subirSop').onclick = hacer(async () => {
    const files = [...dlg.querySelector('#nuevoSop').files];
    if (!files.length) throw new Error('Elige uno o más archivos.');
    for (const f of files) await adjuntar(m.id, f);
    if (m.tipo === 'egreso' && (!m.soporte_tipo || m.soporte_tipo === 'sin_soporte')) await updateDoc(doc(db, 'crm_libro', m.id), { soporte_tipo: 'recibo', ...sello() });
  });
  dlg.querySelector('#reclasificar')?.addEventListener('click', hacer(async () => {
    const c = porCodigo.get(dlg.querySelector('#rCuenta').value);
    await updateDoc(doc(db, 'crm_libro', m.id), { cuenta: c.nombre, cuenta_codigo: c.codigo, clase: m.tipo === 'ingreso' ? 'ingreso' : c.clase, cliente: dlg.querySelector('#rCliente').value, ...sello() });
  }));
  dlg.querySelector('#reembolsar')?.addEventListener('click', async () => { dlg.close(); if (await dialogoReembolso([m])) await rehacer(); });
  dlg.querySelector('#anular')?.addEventListener('click', hacer(async () => {
    const motivo = dlg.querySelector('#motivo').value.trim();
    if (!motivo) throw new Error('Escribe el motivo de la anulación.');
    await anularAsiento(m.id, motivo);
  }));
}

// ── nuevo gasto, costo, compra de equipo o ingreso manual (pensado para el celular) ──
function vNuevo(D) {
  const proveedores = new Map(D.movs.filter((m) => m.tipo === 'egreso' && m.tercero).map((m) => [m.tercero, m.proveedor_nit || m.documento || '']));
  const yo = ctx.equipo.some((p) => p.id === ctx.perfil?.id) ? ctx.perfil.id : 'caja';
  $app.innerHTML = `${D.cab}<div class="card" style="max-width:620px"><h2>Registrar movimiento</h2>
  <form id="fNuevo" autocomplete="off">
    <label>¿Qué es?</label><select name="que">${opciones([['egreso', 'Gasto o costo'], ['inversion', 'Compra de equipo (dura varios años)'], ['ingreso', 'Ingreso sin cuenta de cobro en el CRM']], 'egreso')}</select>
    <div class="grid"><div><label>Valor total pagado (COP)</label><input name="valor" type="number" inputmode="numeric" min="1" step="1" required></div>
      <div><label>Fecha</label><input name="fecha" type="date" value="${D.hoy}" required></div></div>
    <label>Concepto</label><input name="concepto" required placeholder="Ej. Filamento PLA 1 kg para piezas de cliente">
    <label>Cuenta</label><select name="cuenta_codigo" id="nCuenta"></select><p class="suave" id="ayuda" style="margin:4px 0 0"></p>
    <label>Cliente o proyecto <small class="suave" id="nCliAyuda"></small></label><select name="cliente"><option value="">— General de CDH Maker —</option>${D.clientes.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</select>
    <div id="soloEgreso">
      <div class="grid"><div><label>¿Quién pagó?</label><select name="pagado_por"><option value="caja" ${yo === 'caja' ? 'selected' : ''}>Caja de CDH Maker</option>${opcionesEquipo(yo, '')}</select></div>
        <div><label>Medio de pago</label><select name="medio">${opciones(MEDIOS, 'Bancolombia')}</select></div></div>
      <label id="lReemb"><input type="checkbox" name="reembolsable" checked style="width:auto"> Lo pagó de su bolsillo y el negocio se lo debe devolver (si no, queda como aporte)</label>
      <div class="grid"><div><label>Proveedor</label><input name="tercero" list="provs" placeholder="Nombre o razón social"><datalist id="provs">${[...proveedores.keys()].map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
        <div><label>NIT o cédula del proveedor</label><input name="proveedor_nit" inputmode="numeric"></div></div>
      <div class="grid"><div><label>Soporte que entregó</label><select name="soporte_tipo">${opciones(SOPORTES, 'factura_electronica')}</select></div>
        <div><label>N.º de factura o documento</label><input name="numero_soporte"></div></div>
      <p class="suave" id="nDeduce" style="margin:4px 0 0"></p>
    </div>
    <div id="soloIngreso" class="oculto">
      <div class="grid"><div><label>Cliente o pagador</label><input name="tercero_ing" list="clis"><datalist id="clis">${D.clientes.map((c) => `<option value="${esc(c.nombre)}">`).join('')}</datalist></div>
        <div><label>Medio</label><select name="medio_ing">${opciones(MEDIOS, 'Bancolombia')}</select></div>
        <div><label>Retención en la fuente que te hicieron</label><input name="ret_fuente" type="number" min="0" step="1" value="0"></div>
        <div><label>ReteICA que te hicieron</label><input name="ret_ica" type="number" min="0" step="1" value="0"></div></div>
    </div>
    <label>Referencia (opcional)</label><input name="referencia" placeholder="N.º de transferencia, pedido…">
    <label>Comprobante — foto o PDF de la factura, recibo o pago</label><input name="archivos" type="file" accept="image/*,application/pdf" multiple>
    <div class="acciones"><button class="primario">Registrar</button></div></form><div id="mNuevo"></div></div>`;
  const f = document.getElementById('fNuevo'), $ = (n) => f.elements[n];
  const pintar = () => {
    const que = $('que').value, ing = que === 'ingreso';
    const prev = $('cuenta_codigo').value;
    $('cuenta_codigo').innerHTML = opcionesCuentas(ing ? ['ingreso'] : que === 'inversion' ? ['inversion'] : ['costo', 'gasto'], prev);
    if (!$('cuenta_codigo').value) $('cuenta_codigo').selectedIndex = 0;
    const c = porCodigo.get($('cuenta_codigo').value);
    document.getElementById('ayuda').textContent = c ? c.ayuda : '';
    document.getElementById('nCliAyuda').textContent = c?.clase === 'costo' ? '— recomendado: es un costo de proyecto' : '(opcional)';
    document.getElementById('soloEgreso').classList.toggle('oculto', ing);
    document.getElementById('soloIngreso').classList.toggle('oculto', !ing);
    document.getElementById('lReemb').classList.toggle('oculto', $('pagado_por').value === 'caja');
    const st = $('soporte_tipo').value;
    document.getElementById('nDeduce').textContent = deducible(st) ? 'Con este soporte el costo o gasto es deducible en la renta (si está a nombre de Henry, con su cédula o NIT).'
      : st === 'sin_soporte' ? 'Sin soporte este egreso no es deducible. Pide la factura electrónica a nombre de Henry o haz el documento soporte.'
      : 'Este soporte sirve como prueba del pago, pero para deducirlo en la renta se necesita factura electrónica o documento soporte.';
  };
  f.addEventListener('input', (e) => {
    if (e.target.name === 'tercero' && proveedores.get(e.target.value) && !$('proveedor_nit').value) $('proveedor_nit').value = proveedores.get(e.target.value);
    pintar();
  });
  pintar();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('mNuevo'), boton = f.querySelector('button.primario');
    const ing = $('que').value === 'ingreso';
    const archivos = [...$('archivos').files];
    try {
      boton.disabled = true; aviso(m, archivos.length ? 'Guardando y subiendo el comprobante…' : 'Guardando…');
      const base = { fecha: $('fecha').value, concepto: $('concepto').value.trim(), cuenta_codigo: $('cuenta_codigo').value, cliente: $('cliente').value, valor: num($('valor').value), referencia: $('referencia').value.trim(), archivos };
      const id = await registrarMovimiento(ing
        ? { ...base, tipo: 'ingreso', tercero: $('tercero_ing').value.trim(), medio: $('medio_ing').value, retenciones: { fuente: $('ret_fuente').value, ica: $('ret_ica').value } }
        : { ...base, tipo: 'egreso', pagado_por: $('pagado_por').value, medio: $('medio').value, reembolsable: $('pagado_por').value !== 'caja' && $('reembolsable').checked,
          tercero: $('tercero').value.trim(), proveedor_nit: $('proveedor_nit').value.trim(), soporte_tipo: $('soporte_tipo').value, numero_soporte: $('numero_soporte').value.trim() });
      const c = porCodigo.get(base.cuenta_codigo);
      aviso(m, `Registrado: ${esc(base.concepto)} · ${cop(base.valor)} en <b>${esc(c.nombre)}</b>${archivos.length ? ` con ${archivos.length} comprobante(s)` : ' <b>sin comprobante</b> (adjúntalo luego desde Comprobantes)'}. <a href="#libro/movimientos">Ver movimientos</a>`, archivos.length || ing ? 'ok' : 'warn');
      D.movs.unshift(normalizar({ id, ...base, tipo: ing ? 'ingreso' : 'egreso' }));
      for (const k of ['valor', 'concepto', 'tercero', 'proveedor_nit', 'numero_soporte', 'referencia', 'archivos', 'tercero_ing']) $(k).value = '';
      $('ret_fuente').value = 0; $('ret_ica').value = 0; $('valor').focus();
    } catch (err) { console.error(err); aviso(m, 'No se pudo registrar: ' + esc(err.code || err.message), 'err'); }
    boton.disabled = false;
  });
}

// ── comprobantes ──
function vComprobantes(D) {
  const egr = D.movs.filter((m) => m.estado !== 'anulado' && m.tipo === 'egreso' && enPeriodo(m.fecha, D.per));
  const sin = egr.filter((m) => !m.soportes.length), noDed = egr.filter((m) => !deducible(m.soporte_tipo));
  const con = D.movs.filter((m) => m.soportes.length && enPeriodo(m.fecha, D.per));
  const archivos = con.flatMap((m) => m.soportes.map((s) => ({ ...s, m })));
  $app.innerHTML = `${D.cab}${barraHerr(D)}
  <div class="kpis">${kpi('Archivos de soporte', archivos.length, 'cian')}${kpi('Egresos sin comprobante', sin.length, sin.length ? 'err' : 'ok', cop(sin.reduce((s, m) => s + m.valor, 0)))}
    ${kpi('Sin factura electrónica ni documento soporte', noDed.length, noDed.length ? 'warn' : 'ok', 'no deducibles en la renta: ' + cop(noDed.reduce((s, m) => s + m.valor, 0)))}</div>
  ${sin.length ? `<div class="card"><h2>Egresos sin comprobante</h2><div class="aviso warn">Sube la foto o el PDF de cada uno. Sin soporte no se pueden deducir ni justificar ante la DIAN.</div>
    <div class="tabla"><table><tr><th>Fecha</th><th>Concepto</th><th>Pagó</th><th style="text-align:right">Valor</th><th></th></tr>${sin.map((m) => `<tr><td>${esc(m.fecha)}</td><td><b>${esc(m.cuenta)}</b><br><small>${esc(m.concepto)}${m.tercero ? ' · ' + esc(m.tercero) : ''}</small></td>
      <td>${esc(quien(m.pagado_por))}</td><td style="text-align:right">${cop(m.valor)}</td><td><button class="mini" data-elegir>Subir</button><input type="file" data-subir="${esc(m.id)}" accept="image/*,application/pdf" class="oculto"></td></tr>`).join('')}</table></div></div>` : ''}
  <div class="card"><h2>Soportes ${D.per ? esc(D.per) : ''} (${archivos.length})</h2>${archivos.length ? `<div class="grid" style="gap:12px">${archivos.map((a, i) => `<div class="sol" style="margin:0">
      <div data-mini="${i}" style="height:140px;display:grid;place-items:center;background:var(--fondo);border-radius:8px;overflow:hidden"><small class="suave">${/^image\//.test(a.mime) ? 'Cargando…' : esc((a.mime || '').split('/').pop().toUpperCase())}</small></div>
      <small><b>${esc(a.nombre)}</b><br>${esc(a.m.fecha)} · ${esc(a.m.concepto)} · ${cop(a.m.tipo === 'ingreso' ? a.m.bruto : a.m.valor)}</small>
      <div class="acciones" style="margin-top:6px"><button class="mini" data-bajar="${i}">Descargar</button><button class="mini" data-ver="${esc(a.m.id)}">Movimiento</button></div></div>`).join('')}</div>`
    : '<div class="vacio">No hay comprobantes en este periodo.</div>'}</div>`;
  $app.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => { const a = archivos[b.dataset.bajar]; bajarAdjunto(['crm_libro', a.m.id, 'soportes'], a.id, a); }));
  $app.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => detalle(D.movs.find((m) => m.id === b.dataset.ver), D)));
  enlazarElegir();
  $app.querySelectorAll('[data-subir]').forEach((inp) => inp.addEventListener('change', async () => {
    if (!inp.files[0]) return;
    inp.closest('td').innerHTML = '<small class="suave">Subiendo…</small>';
    const m = D.movs.find((x) => x.id === inp.dataset.subir);
    await adjuntar(m.id, inp.files[0]);
    if (!m.soporte_tipo || m.soporte_tipo === 'sin_soporte') await updateDoc(doc(db, 'crm_libro', m.id), { soporte_tipo: 'recibo', ...sello() });
    await rehacer();
  }));
  // Miniaturas: se cargan una a una (cada imagen son una o más lecturas de Firestore), máximo 40.
  (async () => {
    for (const [i, a] of archivos.entries()) {
      if (i >= 40 || !/^image\//.test(a.mime)) continue;
      const el = $app.querySelector(`[data-mini="${i}"]`);
      if (!el) return;
      try { const b = await leerAdjunto(['crm_libro', a.m.id, 'soportes'], a.id); el.innerHTML = `<img alt="${esc(a.nombre)}" style="width:100%;height:100%;object-fit:cover" src="${URL.createObjectURL(new Blob([b], { type: a.mime }))}">`; }
      catch { el.innerHTML = '<small class="suave">No se pudo cargar</small>'; }
    }
  })();
}

// ── cuentas por cobrar por edades ──
function vCobrar(D) {
  const t = cartera(D.cxc, D.hoy), total = D.cxc.reduce((s, x) => s + x.valor, 0);
  const porCli = new Map();
  for (const x of D.cxc) { const k = x.nombre || '—'; const p = porCli.get(k) || { total: 0, vencido: 0 }; p.total += x.valor; if (x.edad !== 'corriente') p.vencido += x.valor; porCli.set(k, p); }
  const cls = { corriente: 'ok', '1-30': 'warn', '31-60': 'warn', '61-90': 'err', '90+': 'err' };
  $app.innerHTML = `${D.cab}<div class="kpis">${kpi('Total por cobrar', cop(total), 'cian', `${D.cxc.length} partida(s)`)}${EDADES.map(([k, n]) => kpi(n, cop(t[k]), t[k] ? cls[k] : '', total ? pct(t[k], total) + ' %' : '')).join('')}</div>
  <div class="cols"><div class="card"><h2>Por cliente</h2>${porCli.size ? `<ul class="lista">${[...porCli].sort((a, b) => b[1].total - a[1].total).map(([n, p]) => `<li><b>${esc(n)}</b> <small>${cop(p.total)}${p.vencido ? ` · <span style="color:var(--err)">${cop(p.vencido)} vencido</span>` : ''}</small></li>`).join('')}</ul>` : '<div class="vacio">Nada por cobrar.</div>'}</div>
  <div class="card"><h2>Detalle</h2>${D.cxc.length ? `<div class="tabla"><table><tr><th>Vence</th><th>Edad</th><th>Cliente</th><th>Concepto</th><th style="text-align:right">Valor</th></tr>
    ${D.cxc.map((x) => `<tr><td style="white-space:nowrap">${esc(x.fecha || '—')}</td><td><span class="chip ${x.edad === 'corriente' ? 'ok' : x.dias > 60 ? 'vencido' : 'pendiente'}">${x.edad === 'corriente' ? (x.dias < 0 ? `en ${-x.dias} días` : 'vence hoy') : `${x.dias} días`}</span></td>
      <td><a href="${esc(x.href)}">${esc(x.nombre)}</a></td><td>${esc(x.concepto)}</td><td style="text-align:right">${cop(x.valor)}</td></tr>`).join('')}</table></div>
    <p class="suave">Incluye las cuotas pendientes de los clientes y las cuentas de cobro o facturas emitidas sin pagar. Si una cuota y una cuenta de cobro son el mismo cobro, aparece dos veces: deja el plan de pagos o el documento, no ambos.</p>` : '<div class="vacio">No hay cuentas por cobrar.</div>'}</div></div>`;
}

// ── reembolsos al equipo ──
function dialogoReembolso(movs) {
  return new Promise((resolver) => {
    const total = movs.reduce((s, m) => s + m.valor, 0);
    const dlg = modal(`<form><h2 style="margin-top:0">Reembolsar ${cop(total)} a ${esc(quien(movs[0].pagado_por))}</h2><p class="suave">${movs.length} gasto(s). Registra cómo se le devolvió el dinero.</p>
      <div class="grid"><div><label>Fecha</label><input name="fecha" type="date" value="${hoyCO()}" required></div><div><label>Medio</label><select name="medio">${opciones(MEDIOS, 'Bancolombia')}</select></div></div>
      <label>Referencia</label><input name="referencia"><div id="mR"></div>
      <div class="acciones"><button class="primario">Marcar reembolsado</button><button type="button" id="cancelar">Cancelar</button></div></form>`);
    dlg.querySelector('#cancelar').onclick = () => dlg.close();
    dlg.addEventListener('close', () => resolver(false));
    dlg.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        aviso(dlg.querySelector('#mR'), 'Guardando…');
        for (const m of movs) await updateDoc(doc(db, 'crm_libro', m.id), { reembolsado: true, reembolso: { fecha: f.fecha, medio: f.medio, referencia: f.referencia, por: ctx.usuario.email }, ...sello() });
        resolver(true); dlg.close();
      } catch (err) { console.error(err); aviso(dlg.querySelector('#mR'), esc(err.code || err.message), 'err'); }
    });
  });
}
function vReembolsos(D) {
  const eg = D.movs.filter((m) => m.estado !== 'anulado' && m.tipo === 'egreso' && m.pagado_por && m.pagado_por !== 'caja');
  const pend = eg.filter((m) => m.reembolsable && !m.reembolsado), hechos = eg.filter((m) => m.reembolsado).slice(0, 60);
  const aportes = eg.filter((m) => !m.reembolsable && enPeriodo(m.fecha, D.per));
  const porPersona = new Map();
  for (const m of pend) porPersona.set(m.pagado_por, [...(porPersona.get(m.pagado_por) || []), m]);
  const fila = (m, boton) => `<tr><td>${esc(m.fecha)}</td><td>${esc(quien(m.pagado_por))}</td><td><b>${esc(m.cuenta)}</b><br><small>${esc(m.concepto)}</small></td>
    <td>${m.soportes.length ? '<span class="chip ok">con soporte</span>' : '<span class="chip vencido">sin soporte</span>'}</td><td style="text-align:right">${cop(m.valor)}</td><td>${boton}</td></tr>`;
  $app.innerHTML = `${D.cab}<p class="suave">Lo que el negocio le debe a cada persona por gastos que pagó de su bolsillo. Lo que se registra como «aporte» no se devuelve.</p>
  <div class="kpis">${porPersona.size ? [...porPersona].map(([p, l]) => kpi(`Se le debe a ${esc(quien(p))}`, cop(l.reduce((s, m) => s + m.valor, 0)), 'warn', `${l.length} gasto(s)`)).join('') : kpi('Reembolsos pendientes', cop(0), 'ok')}
    ${kpi('Aportes del periodo', cop(aportes.reduce((s, m) => s + m.valor, 0)), '', 'gastos pagados por el equipo que no se devuelven')}</div>
  <div class="card"><h2>Pendientes</h2>${pend.length ? `<div class="acciones">${[...porPersona].map(([p, l]) => `<button class="mini primario" data-todo="${esc(p)}">Reembolsar todo a ${esc(quien(p))} (${cop(l.reduce((s, m) => s + m.valor, 0))})</button>`).join('')}</div>
    <div class="tabla"><table><tr><th>Fecha</th><th>Pagó</th><th>Concepto</th><th>Soporte</th><th style="text-align:right">Valor</th><th></th></tr>${pend.map((m) => fila(m, `<button class="mini" data-uno="${esc(m.id)}">Reembolsado</button>`)).join('')}</table></div>`
    : '<div class="vacio">El negocio no le debe nada a nadie.</div>'}</div>
  ${hechos.length ? `<div class="card"><h2>Reembolsados recientes</h2><div class="tabla"><table><tr><th>Fecha</th><th>Pagó</th><th>Concepto</th><th>Soporte</th><th style="text-align:right">Valor</th><th>Reembolso</th></tr>
    ${hechos.map((m) => fila(m, `<small>${esc(m.reembolso?.fecha || '')} ${esc(m.reembolso?.medio || '')}</small>`)).join('')}</table></div></div>` : ''}`;
  $app.querySelectorAll('[data-uno]').forEach((b) => b.addEventListener('click', async () => { if (await dialogoReembolso([pend.find((m) => m.id === b.dataset.uno)])) await rehacer(); }));
  $app.querySelectorAll('[data-todo]').forEach((b) => b.addEventListener('click', async () => { if (await dialogoReembolso(porPersona.get(b.dataset.todo))) await rehacer(); }));
}

// ── impuestos: tope de 3.500 UVT, retenciones y certificados ──
export function controlTope(movs, anio) {
  const uvt = uvtDe(anio), tope = TOPE_IVA_UVT * uvt;
  const ing = movs.filter((m) => m.estado !== 'anulado' && m.tipo === 'ingreso' && String(m.fecha).startsWith(anio));
  const brutos = ing.filter((m) => m.grupo === 'ing_op').reduce((s, m) => s + m.bruto, 0);
  const todos = ing.reduce((s, m) => s + m.bruto, 0);
  return { anio, uvt, tope, brutos, totales: todos, pct: pct(brutos, tope), renta: TOPE_RENTA_UVT * uvt };
}
async function vImpuestos(D) {
  const anio = /^\d{4}/.test(D.per) ? D.per.slice(0, 4) : D.hoy.slice(0, 4);
  const act = controlTope(D.movs, anio), ant = controlTope(D.movs, String(Number(anio) - 1));
  const mesesCorridos = anio === D.hoy.slice(0, 4) ? Number(D.hoy.slice(5, 7)) : 12;
  const proyeccion = Math.round(act.brutos / mesesCorridos * 12);
  const ing = D.movs.filter((m) => m.estado !== 'anulado' && m.tipo === 'ingreso' && String(m.fecha).startsWith(anio));
  const ret = { fuente: 0, ica: 0, otras: 0 };
  const agentes = new Map();
  for (const m of ing) {
    for (const k of Object.keys(ret)) ret[k] += m.retenciones[k];
    if (!m.ret_total) continue;
    const k = slug(m.documento || m.tercero || 'sin-nombre');
    const a = agentes.get(k) || { tercero: m.tercero, nit: m.documento || '', bruto: 0, fuente: 0, ica: 0, otras: 0 };
    a.bruto += m.bruto; a.fuente += m.retenciones.fuente; a.ica += m.retenciones.ica; a.otras += m.retenciones.otras;
    agentes.set(k, a);
  }
  // Contratos individuales de 3.500 UVT o más (otro requisito del par. 3 art. 437): por cliente.
  const grandes = D.clientes.filter((c) => Number(c.valor_total || 0) >= act.tope);
  let certs = [], errCert = '';
  try { certs = (await getDocs(query(collection(db, 'crm_certificados'), where('anio', '==', anio)))).docs.map((d) => ({ id: d.id, ...d.data() })); }
  catch (e) { errCert = e.code || e.message; }
  const estado = (p) => (p >= 100 ? ['err', 'Superaste el tope'] : p >= 80 ? ['warn', 'Cerca del tope'] : ['ok', 'Dentro del tope']);
  const [cls, txt] = estado(act.pct);
  $app.innerHTML = `${D.cab}${barraHerr(D)}
  <div class="card"><h2>Tope para seguir como no responsable de IVA — ${esc(anio)}</h2>
    <p class="suave">Par. 3 del art. 437 del Estatuto Tributario: ingresos brutos de la actividad, en el año anterior <b>o</b> en el año en curso, inferiores a 3.500 UVT. UVT ${esc(anio)}: ${cop(act.uvt)} → tope <b>${cop(act.tope)}</b>.</p>
    <div class="kpis">${kpi(`Ingresos brutos ${esc(anio)}`, cop(act.brutos), cls, `${act.pct} % del tope · ${txt}`)}${kpi('Disponible antes del tope', cop(Math.max(0, act.tope - act.brutos)), cls)}
      ${kpi('Proyección del año', cop(proyeccion), proyeccion >= act.tope ? 'err' : proyeccion >= act.tope * 0.8 ? 'warn' : '', `al ritmo de ${mesesCorridos} mes(es)`)}
      ${kpi(`Año anterior (${esc(ant.anio)})`, cop(ant.brutos), ant.pct >= 100 ? 'err' : '', `${ant.pct} % de ${cop(ant.tope)}`)}</div>
    ${barra(act.pct, cls)}
    ${act.pct >= 100 || ant.pct >= 100 ? '<div class="aviso err">Superaste 3.500 UVT: debes inscribirte como responsable de IVA en el RUT, empezar a facturar electrónicamente y cobrar IVA (19 %) en los servicios gravados desde el periodo siguiente. Habla con el contador ya.</div>'
      : act.pct >= 80 || proyeccion >= act.tope ? '<div class="aviso warn">Vas camino al tope. Planea con el contador el paso a responsable de IVA y a factura electrónica antes de cruzarlo, y revisa precios: el IVA cambia lo que cobras a clientes que no lo descuentan.</div>' : ''}
    ${grandes.length ? `<div class="aviso warn">Contratos de 3.500 UVT o más (también te harían responsable de IVA si son gravados): ${grandes.map((c) => esc(c.nombre)).join(', ')}.</div>` : ''}
    <p class="suave">También cuentan: consignaciones e inversiones del año por debajo de 3.500 UVT, un solo establecimiento, no ser usuario aduanero ni tener franquicias o concesiones. Este cálculo usa solo los ingresos operacionales registrados en el libro.</p></div>
  <div class="cols mitad"><div class="card"><h2>Retenciones que te practicaron en ${esc(anio)}</h2>
    <div class="kpis">${kpi('Retención en la fuente', cop(ret.fuente), 'cian', 'se resta del impuesto de renta')}${kpi('ReteICA', cop(ret.ica), 'cian', 'se resta del ICA')}${ret.otras ? kpi('Otras', cop(ret.otras)) : ''}</div>
    ${agentes.size ? `<div class="tabla"><table><tr><th>Agente retenedor</th><th style="text-align:right">Pagos</th><th style="text-align:right">Fuente</th><th style="text-align:right">ICA</th><th>Certificado</th></tr>
      ${[...agentes].map(([k, a]) => { const c = certs.filter((x) => x.agente === k); return `<tr><td>${esc(a.tercero)}<br><small class="suave">${esc(a.nit || 'sin NIT')}</small></td><td style="text-align:right">${cop(a.bruto)}</td><td style="text-align:right">${cop(a.fuente)}</td><td style="text-align:right">${cop(a.ica)}</td>
        <td>${c.map((x) => `<button class="mini" data-cert="${esc(x.id)}">${esc(x.nombre)}</button>`).join(' ') || '<span class="chip pendiente">pedirlo</span>'}
          <button class="mini" data-elegir>Subir</button><input type="file" class="oculto" data-agente="${esc(k)}" accept="application/pdf,image/*"></td></tr>`; }).join('')}</table></div>
      <p class="suave">Pide a cada agente su certificado de retención (lo deben expedir a más tardar en marzo del año siguiente). Sin él, la retención se puede descontar con el comprobante de pago, pero el certificado es la prueba.</p>`
      : '<div class="vacio">No hay retenciones registradas este año. Se registran al recibir el pago de una cuenta de cobro.</div>'}
    ${errCert ? `<div class="aviso warn">No se pudieron leer los certificados (${esc(errCert)}). Falta publicar la regla de <code>crm_certificados</code>.</div>` : ''}</div>
  <div class="card"><h2>Declaración de renta</h2>
    <p>Ingresos brutos ${esc(anio)} (todos): <b>${cop(act.totales)}</b> · tope para declarar 1.400 UVT = <b>${cop(act.renta)}</b> ${act.totales >= act.renta ? '<span class="chip pendiente">debes declarar</span>' : '<span class="chip neutro">aún por debajo</span>'}</p>
    <p class="suave">También obligan a declarar: patrimonio bruto ≥ 4.500 UVT, o compras, consumos con tarjeta o consignaciones del año ≥ 1.400 UVT (suma de todas tus cuentas, no solo las del negocio). Estos datos no están todos en el libro: revísalos con el contador.</p>
    <h3>Calendario</h3><ul>
      <li><b>Renta persona natural</b> (año ${esc(anio)}): se declara entre agosto y octubre de ${Number(anio) + 1} según los dos últimos dígitos del NIT. Consulta la fecha exacta en el calendario DIAN.</li>
      <li><b>ICA Medellín</b>: declaración anual del año anterior (primer trimestre). Confirma tu fecha y si estás inscrito en Industria y Comercio.</li>
      <li><b>Certificados de retención</b>: pídelos en marzo a cada agente retenedor.</li>
      <li><b>RUT</b>: actualízalo si cambias de actividad o te vuelves responsable de IVA.</li></ul>
    <p class="suave">Concepto completo en <code>CONTABILIDAD.md</code> del repositorio.</p></div></div>`;
  $app.querySelectorAll('[data-cert]').forEach((b) => b.addEventListener('click', () => { const c = certs.find((x) => x.id === b.dataset.cert); bajarAdjunto(['crm_certificados'], c.id, c); }));
  enlazarElegir();
  $app.querySelectorAll('[data-agente]').forEach((inp) => inp.addEventListener('change', async () => {
    if (!inp.files[0]) return;
    const a = agentes.get(inp.dataset.agente);
    inp.closest('td').innerHTML = '<small class="suave">Subiendo…</small>';
    try {
      const { bytes, mime, nombre } = await bytesDe(inp.files[0]);
      await guardarAdjunto(['crm_certificados'], { nombre, tipo: 'certificado de retención', mime, bytes, extra: { anio, agente: inp.dataset.agente, tercero: a.tercero || '', nit: a.nit || '' } });
      await rehacer();
    } catch (e) { console.error(e); alert('No se pudo subir el certificado: ' + (e.code || e.message)); }
  }));
}

// ── exportar CSV ──
function vExportar(D) {
  const movs = D.movs.filter((m) => enPeriodo(m.fecha, D.per));
  const sufijo = D.per ? '-' + D.per : '';
  $app.innerHTML = `${D.cab}${barraHerr(D)}<div class="card" style="max-width:640px"><h2>Exportar ${D.per ? esc(D.per) : 'todo el periodo'}</h2>
    <p class="suave">Archivos CSV separados por punto y coma, listos para Excel o para el contador.</p>
    <ul class="lista"><li data-x="movs"><b>Libro de movimientos</b><small>${movs.length} movimientos con cuenta, clase, retenciones, quién pagó y soporte</small></li>
      <li data-x="cuentas"><b>Saldos por cuenta</b><small>Total por cuenta del PUC (base para el estado de resultados)</small></li>
      <li data-x="cxc"><b>Cartera por edades</b><small>${D.cxc.length} partidas por cobrar a hoy</small></li>
      <li data-x="reemb"><b>Reembolsos y aportes del equipo</b><small>Gastos pagados por Henry, Isa u otros</small></li></ul></div>`;
  const vig = movs.filter((m) => m.estado !== 'anulado');
  const X = {
    movs: () => csvDe([['Fecha', 'Tipo', 'Clase', 'Código', 'Cuenta', 'Concepto', 'Tercero', 'NIT/CC', 'Cliente', 'Bruto', 'Ret. fuente', 'ReteICA', 'Otras ret.', 'Neto', 'Pagó', 'Reembolsable', 'Reembolsado', 'Soporte', 'N.º soporte', 'Archivos', 'Medio', 'Referencia', 'Origen', 'Estado', 'Motivo anulación', 'Registrado por'],
      ...movs.map((m) => [m.fecha, m.tipo, m.clase, m.cuenta_codigo, m.cuenta, m.concepto, m.tercero, m.proveedor_nit || m.documento, D.nombreCliente[m.cliente] || m.cliente,
        m.tipo === 'egreso' ? -m.valor : m.bruto, m.retenciones.fuente, m.retenciones.ica, m.retenciones.otras, m.tipo === 'egreso' ? -m.valor : m.neto, m.tipo === 'egreso' ? quien(m.pagado_por) : '',
        m.reembolsable ? 'sí' : '', m.reembolsado ? 'sí' : '', m.soporte_tipo, m.numero_soporte || '', m.soportes.length, m.medio, m.referencia, m.origen, m.estado, m.motivo_anulacion || '', m.creado_por])], `libro-cdh-maker${sufijo}.csv`),
    cuentas: () => csvDe([['Código', 'Cuenta', 'Clase', 'Total'], ...PLAN.map((c) => [c.codigo, c.nombre, c.clase, vig.filter((m) => m.cuenta_codigo === c.codigo).reduce((s, m) => s + (m.tipo === 'ingreso' ? m.bruto : m.valor), 0)]).filter((r) => r[3])], `cuentas-cdh-maker${sufijo}.csv`),
    cxc: () => csvDe([['Vence', 'Días vencida', 'Edad', 'Cliente', 'Concepto', 'Valor'], ...D.cxc.map((x) => [x.fecha, Math.max(0, x.dias), x.edad, x.nombre, x.concepto, x.valor])], `cartera-cdh-maker-${D.hoy}.csv`),
    reemb: () => csvDe([['Fecha', 'Pagó', 'Concepto', 'Cuenta', 'Valor', 'Tratamiento', 'Reembolsado el', 'Medio reembolso'],
      ...vig.filter((m) => m.tipo === 'egreso' && m.pagado_por !== 'caja').map((m) => [m.fecha, quien(m.pagado_por), m.concepto, m.cuenta, m.valor, m.reembolsable ? 'reembolso' : 'aporte', m.reembolso?.fecha || '', m.reembolso?.medio || ''])], `reembolsos-cdh-maker${sufijo}.csv`),
  };
  $app.querySelectorAll('[data-x]').forEach((li) => li.addEventListener('click', () => X[li.dataset.x]()));
}
