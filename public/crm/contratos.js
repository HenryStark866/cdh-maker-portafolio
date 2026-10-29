// Contratos y documentos legales para firmar (CRM → Firmas → Nuevo contrato).
// Las plantillas viven en /crm/plantillas/<id>.html (autocontenidas, con <campo-k> y <firma-k>, generadas
// desde legal/servicios/). El editor las rellena con los datos del emisor, del cliente y de la cotización,
// deja marcados los campos que escribirá el cliente al firmar y crea la solicitud con crearSolicitudFirma.
// Borradores en crm_contratos/{id}: { cliente, cotizacion, titulo, horas, documentos: [{ plantilla, valores,
// clienteLlena }], estado: 'borrador'|'enviado', solicitud, enlaces, ...sello() }.
import { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, $app, esc, aviso, slug, descargar, hoyCO, sello, nav, fmtFecha } from './comun.js';
import { rellenar } from './rellenar.js';
import { htmlAPdf, cargarLibs } from './ensamblar.js?v=4';
import { enLetras, EMISOR_BASE } from './comercial.js?v=4';
import { crearSolicitudFirma, mostrarEnlaces, botonesEnvio, enlazarCopiar } from './firmas.js';
import { isotipo } from './marca.js';

// ───────── catálogo ─────────
// doc: id del documento dentro de la solicitud ([a-z]{2,20}); firmaCliente: el cliente también firma.
export const PLANTILLAS = [
  { id: 'contrato-prestacion-servicios', titulo: 'Contrato de prestación de servicios', grupo: 'Contratación', doc: 'contrato', firmaCliente: true,
    descripcion: 'Contrato marco con CDH Maker: objeto, valor y pagos por hitos, propiedad intelectual, datos personales, garantía y terminación. Cada proyecto se detalla en un anexo de alcance.' },
  { id: 'anexo-alcance-software', titulo: 'Anexo de alcance — Software a la medida', grupo: 'Anexos de alcance', doc: 'anexo', firmaCliente: true,
    descripcion: 'Aplicaciones web, SaaS, sitios y automatización: entregables y pagos por hito, especificaciones técnicas, supuestos, exclusiones y criterios de aceptación.' },
  { id: 'anexo-alcance-ia', titulo: 'Anexo de alcance — Inteligencia artificial', grupo: 'Anexos de alcance', doc: 'anexo', firmaCliente: true,
    descripcion: 'Asistentes y automatizaciones con IA: modo de ejecución, modelo, costos de consumo y conjunto de pruebas de aceptación.' },
  { id: 'anexo-alcance-iot', titulo: 'Anexo de alcance — IoT y automatización', grupo: 'Anexos de alcance', doc: 'anexo', firmaCliente: true,
    descripcion: 'Sistemas con sensores y control: hardware, conectividad, alertas, prueba de operación continua y garantía.' },
  { id: 'anexo-alcance-impresion-3d', titulo: 'Anexo de alcance — Impresión 3D y fabricación digital', grupo: 'Anexos de alcance', doc: 'anexo', firmaCliente: true,
    descripcion: 'Piezas FDM, resina, láser o CNC: especificaciones, tolerancias, propiedad del diseño y reposiciones.' },
  { id: 'plan-de-pago', titulo: 'Acuerdo de plan de pago', grupo: 'Contratación', doc: 'plan', firmaCliente: true,
    descripcion: 'Cuotas y fechas de pago con mérito ejecutivo: valor, cuenta de pago, mora y cláusula aceleratoria. Se prellena con las cuotas del cliente.' },
  { id: 'orden-de-cambio', titulo: 'Orden de cambio de alcance', grupo: 'Ejecución y entrega', doc: 'orden', firmaCliente: true,
    descripcion: 'Cambios sobre un proyecto en ejecución: qué cambia, impacto en plazo y valor, forma de pago y decisión del cliente.' },
  { id: 'acta-de-entrega', titulo: 'Acta de entrega formal', grupo: 'Ejecución y entrega', doc: 'acta', firmaCliente: true,
    descripcion: 'Constancia de lo entregado, accesos, capacitación, período de verificación, garantía y saldo pendiente.' },
  { id: 'paz-y-salvo', titulo: 'Paz y salvo', grupo: 'Cierre y relación', doc: 'paz', firmaCliente: false,
    descripcion: 'Certificación de pago total. La firma solo CDH Maker; se prellena con las cuotas pagadas.' },
  { id: 'carta-de-bienvenida', titulo: 'Carta de bienvenida', grupo: 'Cierre y relación', doc: 'bienvenida', firmaCliente: false,
    descripcion: 'Carta al cliente con el resumen de lo adquirido y el acompañamiento postventa. La firma solo CDH Maker.' },
];
const PAQUETES = [
  ['Proyecto de software', ['contrato-prestacion-servicios', 'anexo-alcance-software', 'plan-de-pago']],
  ['Proyecto de IoT', ['contrato-prestacion-servicios', 'anexo-alcance-iot', 'plan-de-pago']],
  ['Entrega y cierre', ['acta-de-entrega', 'carta-de-bienvenida']],
];
const info = (id) => PLANTILLAS.find((p) => p.id === id);

// ───────── campos ─────────
const AUTO = ['dia_firma', 'mes_firma', 'anio_firma']; // los pone ensamblar.js con la fecha de la última firma
// Campos del cliente que por defecto escribe él mismo al firmar (si el CRM no los tiene).
const CLIENTE_DEF = /^c_(cedula|firmante|cargo|interlocutor|interlocutor_correo|direccion|documento|correo)$/;
const LARGOS = /^(objetivo|cambio|situacion_actual|justificacion|condiciones|observaciones|validaciones|descripcion|agradecimiento|evolucion|objeto|riesgos|medidas_criticas|ambiente)/;
const grupoDe = (k) => (/^h_/.test(k) ? 'proveedor' : /^c_/.test(k) ? 'cliente' : /^(dia|mes|anio|ciudad)_firma$/.test(k) ? 'firma' : 'proyecto');
const GRUPOS = [['proveedor', 'Proveedor (CDH Maker)'], ['cliente', 'Cliente'], ['proyecto', 'Proyecto y valores'], ['firma', 'Firma']];
const RE_CAMPO = /<campo-k k="([^"]+)" ph="([^"]*)"><\/campo-k>/g;
const desAttr = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const LOGO_RESPALDO = '<svg viewBox="0 0 512 512" width="46" height="46" aria-hidden="true"><rect width="512" height="512" rx="104" fill="#06232e"/><g transform="translate(56.5,56.5) scale(5.7)"><path d="M55 15H25A15 15 0 0 0 10 30v10a15 15 0 0 0 15 15h30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="square"/><path d="M55 15H25A15 15 0 0 0 10 30v2h15V22" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/><circle cx="25" cy="22" r="3" fill="#22d3ee"/><path d="M10 45v-5a15 15 0 0 1 15 15h20V42" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/><circle cx="45" cy="42" r="3" fill="#22d3ee"/><circle cx="10" cy="45" r="3" fill="#22d3ee"/></g></svg>';
const logo = () => { try { return isotipo(46) || LOGO_RESPALDO; } catch { return LOGO_RESPALDO; } };

const cache = {};
// Descarga la plantilla, pone el logo y extrae sus campos (sin repetir, en orden de aparición).
export async function cargarPlantilla(id) {
  if (cache[id]) return cache[id];
  const p = info(id);
  if (!p) throw new Error('Plantilla desconocida: ' + id);
  const r = await fetch(new URL(`./plantillas/${id}.html`, import.meta.url));
  if (!r.ok) throw new Error('No se pudo cargar la plantilla ' + id);
  const html = (await r.text()).replace('<!--LOGO-->', logo());
  const campos = [], vistos = new Set();
  for (const m of html.matchAll(RE_CAMPO)) {
    const [, k, ph] = m;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const tipo = AUTO.includes(k) ? 'auto' : html.slice(Math.max(0, m.index - 23), m.index) === '<span class="casilla">' ? 'casilla' : 'texto';
    campos.push({ k, ph: desAttr(ph), grupo: grupoDe(k), tipo, cliente: p.firmaCliente && tipo === 'texto' && CLIENTE_DEF.test(k) });
  }
  return (cache[id] = { id, titulo: p.titulo, html, campos, firmaCliente: p.firmaCliente });
}

// HTML para la solicitud: los campos con valor quedan como texto; los que llena el cliente (o vacíos)
// siguen como <campo-k> para que /firmar y ensamblar.js los completen. Las <firma-k> no se tocan.
export function htmlFinal(plantilla, valores = {}, clienteLlena = []) {
  return plantilla.html.replace(RE_CAMPO, (todo, k) => {
    const v = String(valores[k] ?? '').trim();
    return !v || clienteLlena.includes(k) ? todo : `<span class="campo ok">${esc(v).replace(/\n/g, '<br>')}</span>`;
  });
}

// ───────── valores iniciales ─────────
const pesos = (n) => Math.round(Number(n || 0)).toLocaleString('es-CO');
const letras = (n) => (Number(n) ? enLetras(n).replace(/ PESOS? M\/CTE$/, '') : '');
const dmy = (f) => { const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f || ''); };
const fechaLarga = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' });
const num = (s) => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
const esEmpresa = (c) => /empresa|s\.?a\.?s|ltda|jur[ií]dica/i.test(`${c.tipo || ''} ${c.nombre || ''}`) || /^\d{9}-?\d$/.test(String(c.documento || '').replace(/\./g, ''));
const totalCot = (cot) => (cot?.items || []).reduce((s, it) => s + Number(it.cantidad || 0) * Number(it.precio || 0) * (1 - Number(it.descuento || 0) / 100), 0) * (1 + Number(cot?.iva || 0) / 100);
const PREFIJO = { contrato: 'CPS', anexo: 'AN', plan: 'PP', orden: 'OC', acta: 'AE', paz: 'PS', bienvenida: '' };
const DEFECTOS = {
  vigencia_meses: '12', anticipo_pct: '50', respuesta_cliente_dias: '3', verificacion_dias: '10', confidencialidad_anios: '5', subencargados: 'Supabase, Google Firebase, Vercel',
  incidente_horas: '48', supresion_dias: '30', garantia_meses: '3', soporte_desde: '8:00 a. m.', soporte_hasta: '6:00 p. m.', soporte_respuesta_dias: '1',
  pi_licencia: 'X', controversia_jueces: 'X', rondas_ajustes: '2', correccion_dias: '5', gracia_dias: '5', validez_dias: '15', dec_aprobado: 'X',
  revision_dias: '3', reposicion_dias: '5', archivos_meses: '6', cad_rondas: '2', pruebas_casos: '30', pruebas_umbral: '85', prueba_horas: '72', prueba_disponibilidad: '95',
  alerta_tiempo: '2 min', amb_produccion: 'X', alcance_todo: 'X', excluidos: 'ninguno', condiciones: 'ninguna', observaciones: 'ninguna', c_tratamiento: 'Señor(a)',
};

function valoresBase({ emisor: e, cliente: c = {}, cot, plantilla, otros = [] }) {
  const empresa = esEmpresa(c);
  const total = Number(c.valor_total) || totalCot(cot) || 0;
  const anio = hoyCO().slice(0, 4);
  const sufijo = String(cot?.numero || '').match(/(\d+)$/)?.[1] || hoyCO().slice(5).replace('-', '');
  const pagadas = (c.cuotas || []).filter((q) => q.estado === 'pagada');
  const cuotas = c.cuotas || [];
  const anticipo = String(cot?.condiciones || e.condiciones || '').match(/(\d{1,3})\s*%/)?.[1];
  const ivaCot = Number(cot?.iva || 0) > 0;
  const tieneAnexo = (s) => otros.some((d) => d.plantilla === 'anexo-alcance-' + s) || plantilla === 'anexo-alcance-' + s ? 'X' : '';
  const contrato = otros.find((d) => d.plantilla === 'contrato-prestacion-servicios');
  const v = {
    ...DEFECTOS,
    consecutivo: PREFIJO[info(plantilla)?.doc] ? `${PREFIJO[info(plantilla).doc]}-${anio}-${sufijo}` : '',
    contrato_numero: contrato?.valores?.consecutivo || '',
    h_nombre: e.nombre_legal || e.nombre || '', h_cedula: e.cedula || '', h_telefono: e.telefono || '',
    h_banco: e.banco || '', h_cuenta: e.cuenta || '', h_titular: [e.titular || e.nombre, e.cedula && 'C.C. ' + e.cedula].filter(Boolean).join(' — '),
    h_cuenta_ahorros: /ahorro/i.test(e.tipo_cuenta || '') ? 'X' : '', h_cuenta_corriente: /corriente/i.test(e.tipo_cuenta || '') ? 'X' : '',
    c_nombre: c.nombre || '', c_documento: c.documento || '', c_correo: c.correo || '', c_direccion: c.direccion || '',
    c_tipo_nit: empresa ? 'X' : '', c_tipo_cc: c.nombre && !empresa ? 'X' : '',
    c_firmante: c.representante || (!empresa ? c.nombre || '' : ''), c_cedula: c.cedula_representante || (!empresa ? c.documento || '' : ''),
    c_empresa: c.empresa || c.nombre || '', c_nombre_comercial: c.empresa || c.nombre || '', c_destinatario: c.representante || (!empresa ? c.nombre || '' : ''),
    c_razon_social: empresa ? c.nombre || '' : '—', c_nit: empresa ? c.documento || '' : '—', actua_propio: empresa ? '' : 'X', actua_representacion: empresa ? 'X' : '',
    proyecto_nombre: c.proyecto || cot?.titulo || '', objeto: cot?.titulo || c.proyecto || '', descripcion: cot?.titulo || c.proyecto || '', concepto: c.proyecto || cot?.titulo || '',
    valor_total: total ? pesos(total) : '', valor_letras: letras(total),
    cot_numero: cot?.numero || '', cot_fecha: cot ? dmy(cot.fecha) : '', seg_propuesta: cot ? 'X' : '',
    anticipo_pct: anticipo || DEFECTOS.anticipo_pct, plazo_pago_dias: String(e.plazo_pago || 5),
    iva_no_causa: ivaCot ? '' : 'X', iva_mas: ivaCot ? 'X' : '',
    anexo_software: tieneAnexo('software'), anexo_ia: tieneAnexo('ia'), anexo_iot: tieneAnexo('iot'), anexo_3d: tieneAnexo('impresion-3d'),
    ciudad_firma: e.ciudad || 'Medellín', fecha_orden: dmy(hoyCO()), fecha_solicitud: dmy(hoyCO()), fecha_carta: fechaLarga(hoyCO()),
    segun_documento: 'el contrato', pago_plan: cuotas.length > 1 ? 'X' : '', pago_contrato: cuotas.length > 1 ? '' : 'X',
  };
  // Plan de pago: hasta 4 cuotas del cliente.
  if (cuotas.length) {
    v.num_cuotas = String(cuotas.length);
    const suma = cuotas.reduce((s, q) => s + Number(q.valor || 0), 0) || 1;
    cuotas.slice(0, 4).forEach((q, i) => {
      const n = i + 1;
      v[`cuota${n}_valor`] = pesos(q.valor); v[`cuota${n}_fecha`] = dmy(q.fecha);
      v[`cuota${n}_pct`] = String(Math.round(Number(q.valor || 0) * 100 / suma));
      if (n > 1) v[`cuota${n}_concepto`] = `Cuota ${q.n || n}`;
    });
    v.cuotas_total = pesos(suma);
    if (cuotas.length > 4) v.fechas_ajustadas = cuotas.slice(4).map((q) => `cuota ${q.n}: $${pesos(q.valor)} el ${dmy(q.fecha)}`).join('; ');
  }
  // Paz y salvo: cuotas pagadas.
  pagadas.slice(0, 4).forEach((q, i) => {
    const n = i + 1;
    v[`pago${n}_concepto`] = `Cuota ${q.n || n}`; v[`pago${n}_fecha`] = dmy(q.fecha_pago || q.fecha);
    v[`pago${n}_referencia`] = q.referencia || ''; v[`pago${n}_valor`] = pesos(q.valor);
  });
  if (pagadas.length) v.total_pagado = pesos(pagadas.reduce((s, q) => s + Number(q.valor || 0), 0));
  // Filas que sobran en las tablas de 4 cuotas / 4 pagos: se marcan «—» en vez de quedar con la pista.
  for (let n = 1; n <= 4; n++) {
    if (cuotas.length && n > cuotas.length) for (const k of ['concepto', 'pct', 'valor', 'fecha']) v[`cuota${n}_${k}`] = '—';
    if (pagadas.length && n > pagadas.length) for (const k of ['concepto', 'fecha', 'referencia', 'valor']) v[`pago${n}_${k}`] = '—';
  }
  return v;
}

// Claves que comparten todos los documentos de la solicitud (al editarlas en uno, cambian en los demás).
const COMPARTIDA = (k) => /^(h_|c_)/.test(k) || ['proyecto_nombre', 'valor_total', 'valor_letras', 'cot_numero', 'cot_fecha', 'ciudad_firma', 'garantia_meses'].includes(k);

// El contrato marca las casillas de los anexos que se firman con él.
const MARCA_ANEXO = { 'anexo-alcance-software': 'anexo_software', 'anexo-alcance-ia': 'anexo_ia', 'anexo-alcance-iot': 'anexo_iot', 'anexo-alcance-impresion-3d': 'anexo_3d' };
function marcarAnexos(documentos) {
  const ct = documentos.find((d) => d.plantilla === 'contrato-prestacion-servicios');
  if (ct) for (const d of documentos) if (MARCA_ANEXO[d.plantilla]) ct.valores[MARCA_ANEXO[d.plantilla]] = 'X';
}

async function nuevoDocumento(plantilla, ctxDatos, otros) {
  const pl = await cargarPlantilla(plantilla);
  const base = valoresBase({ ...ctxDatos, plantilla, otros });
  for (const d of otros) for (const [k, x] of Object.entries(d.valores)) if (COMPARTIDA(k) && x) base[k] = x;
  const valores = {};
  for (const c of pl.campos) if (c.tipo !== 'auto') valores[c.k] = String(base[c.k] ?? '');
  const clienteLlena = pl.campos.filter((c) => c.cliente && !valores[c.k]).map((c) => c.k);
  return { plantilla, valores, clienteLlena };
}

// ───────── datos ─────────
const leerEmisor = async () => ({ ...EMISOR_BASE, ...((await getDoc(doc(db, 'crm_config', 'emisor'))).data() || {}) });
const leerCliente = async (id) => { if (!id) return null; const s = await getDoc(doc(db, 'crm_clientes', id)); return s.exists() ? { id, ...s.data() } : null; };
const leerCot = async (id) => { if (!id) return null; const s = await getDoc(doc(db, 'crm_documentos', id)); return s.exists() ? { id, ...s.data() } : null; };
const listaClientes = async () => (await getDocs(query(collection(db, 'crm_clientes'), orderBy('nombre')))).docs.map((d) => ({ id: d.id, ...d.data() }));
const cotizacionesDe = async (cliente) => (await getDocs(query(collection(db, 'crm_documentos'), where('cliente', '==', cliente)))).docs
  .map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.tipo === 'cotizacion' && d.estado !== 'anulada').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

// ───────── vista ─────────
// #contrato                         → galería
// #contrato/para/<cliente>[/<cot>]  → galería con el cliente (y la cotización) elegidos
// #contrato/b/<borrador>            → retomar un borrador
// #contrato/<plantilla>[+<plantilla>…]/<cliente>[/<cot>] → editor nuevo
export async function vistaContrato(partes = []) {
  nav('firmas');
  const p = partes.map((x) => { try { return decodeURIComponent(x || ''); } catch { return x || ''; } });
  try {
    if (!p[0] || p[0] === 'para') return await galeria(p[0] === 'para' ? p[1] : '', p[0] === 'para' ? p[2] : '');
    if (p[0] === 'b') return await editor({ borrador: p[1] });
    return await editor({ plantillas: p[0].split('+').filter(info), cliente: p[1], cot: p[2] });
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<p><a href="#firmas">← Firmas</a></p><div class="card"><div class="aviso err">${esc(e.message)}</div></div>`;
  }
}

async function galeria(clienteSel = '', cotSel = '') {
  const [clientes, borradores] = await Promise.all([
    listaClientes(),
    getDocs(query(collection(db, 'crm_contratos'), orderBy('actualizado', 'desc'), limit(30))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
  ]);
  const nombreCli = (id) => clientes.find((c) => c.id === id)?.nombre || id;
  const grupos = [...new Set(PLANTILLAS.map((x) => x.grupo))];
  $app.innerHTML = `<p><a href="#firmas">← Firmas</a></p>
  <h1 class="titulo">Contratos y documentos para firmar</h1>
  <p class="bajada">Elige el cliente y el documento: se llena con los datos del CRM, revisas, y lo envías a firmar por WhatsApp o correo.</p>
  <div class="card"><div class="grid">
    <div><label>Cliente</label><select id="gCli"><option value="">— Elige el cliente —</option>${clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === clienteSel ? 'selected' : ''}>${esc(c.nombre)}${c.proyecto ? ' · ' + esc(c.proyecto) : ''}</option>`).join('')}</select></div>
    <div><label>Cotización de referencia (opcional)</label><select id="gCot"><option value="">— Sin cotización —</option></select></div></div>
    <h3>Paquetes rápidos</h3><div class="acciones">${PAQUETES.map(([n, ids]) => `<button type="button" class="mini" data-usar="${ids.join('+')}">${esc(n)}</button>`).join('')}</div>
    <div id="mGal"></div></div>
  ${grupos.map((g) => `<h3>${esc(g)}</h3><div class="kpis">${PLANTILLAS.filter((x) => x.grupo === g).map((x) => `<div class="kpi" style="display:flex;flex-direction:column;gap:6px">
    <b style="font-size:15px">${esc(x.titulo)}</b><small style="font-size:12px;flex:1">${esc(x.descripcion)}</small>
    <div><span class="chip ${x.firmaCliente ? 'info' : 'neutro'}">${x.firmaCliente ? 'Firman ambos' : 'Firma CDH Maker'}</span></div>
    <div class="acciones" style="margin:0"><button type="button" class="primario mini" data-usar="${x.id}">Usar</button></div></div>`).join('')}</div>`).join('')}
  <div class="card"><h2>Borradores y enviados</h2>${borradores.length ? `<div class="tabla"><table><tr><th>Cliente</th><th>Documentos</th><th>Estado</th><th>Actualizado</th></tr>
    ${borradores.map((b) => `<tr class="fila" data-b="${esc(b.id)}"><td>${esc(nombreCli(b.cliente))}</td><td>${(b.documentos || []).map((d) => esc(info(d.plantilla)?.titulo || d.plantilla)).join('<br>')}</td>
      <td><span class="chip ${b.estado === 'enviado' ? 'ok' : 'pendiente'}">${esc(b.estado || 'borrador')}</span></td><td>${fmtFecha(b.actualizado, true)}</td></tr>`).join('')}</table></div>`
    : '<p class="vacio">Aún no hay borradores.</p>'}</div>`;

  const $cli = document.getElementById('gCli'), $cot = document.getElementById('gCot');
  const pintarCots = async () => {
    $cot.innerHTML = '<option value="">— Sin cotización —</option>';
    if (!$cli.value) return;
    const cots = await cotizacionesDe($cli.value);
    $cot.innerHTML += cots.map((d) => `<option value="${esc(d.id)}" ${d.id === cotSel || (!cotSel && d.estado === 'aceptada') ? 'selected' : ''}>${esc(d.numero || 'borrador')} · ${esc(d.titulo || '')} · ${esc(d.estado)}</option>`).join('');
  };
  $cli.addEventListener('change', pintarCots);
  await pintarCots();
  $app.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', () => {
    if (!$cli.value) return aviso(document.getElementById('mGal'), 'Elige primero el cliente.', 'warn');
    location.hash = ['contrato', b.dataset.usar, $cli.value, $cot.value].filter(Boolean).map((x, i) => (i ? encodeURIComponent(x) : x)).join('/');
  }));
  $app.querySelectorAll('[data-b]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'contrato/b/' + encodeURIComponent(tr.dataset.b))));
}

async function editor({ borrador, plantillas = [], cliente, cot }) {
  let st;
  if (borrador) {
    const s = await getDoc(doc(db, 'crm_contratos', borrador));
    if (!s.exists()) throw new Error('No se encontró el borrador.');
    st = { id: borrador, ...s.data() };
  } else {
    if (!plantillas.length) throw new Error('Plantilla desconocida.');
    st = { id: null, cliente: cliente || '', cotizacion: cot || '', horas: 72, documentos: [], estado: 'borrador' };
  }
  const [emisor, c, cotizacion, clientes] = await Promise.all([leerEmisor(), leerCliente(st.cliente), leerCot(st.cotizacion), listaClientes()]);
  if (st.cliente && !c) throw new Error('Cliente no encontrado: ' + st.cliente);
  const datos = { emisor, cliente: c || {}, cot: cotizacion };
  for (const id of plantillas) st.documentos.push(await nuevoDocumento(id, datos, st.documentos));
  if (plantillas.length) marcarAnexos(st.documentos);
  for (const d of st.documentos) await cargarPlantilla(d.plantilla);
  let activo = 0;
  const enviado = () => st.estado === 'enviado';

  const ids = () => { const usados = {}; return st.documentos.map((d) => { const b = info(d.plantilla).doc; usados[b] = (usados[b] || 0) + 1; return usados[b] === 1 ? b : b + 'abcdefghij'[usados[b] - 1]; }); };
  const titulo = () => {
    const t = st.documentos.map((d) => info(d.plantilla).titulo);
    return `${t[0]}${t.length > 1 ? ` y ${t.length - 1} documento${t.length > 2 ? 's' : ''} más` : ''} — ${c?.nombre || 'cliente'}`;
  };

  $app.innerHTML = `<p><a href="#contrato">← Contratos</a>${c ? ` · <a href="#cliente/${encodeURIComponent(c.id)}">${esc(c.nombre)}</a>` : ''}</p>
  <div class="card"><div class="cab"><h2 style="margin:0" id="eTit"></h2><span id="eEstado"></span></div>
    <div class="grid">
      <div><label>Cliente</label><select id="eCli" ${st.id ? 'disabled' : ''}><option value="">— Elige el cliente —</option>${clientes.map((x) => `<option value="${esc(x.id)}" ${x.id === st.cliente ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
      <div><label>Vigencia del enlace del cliente (horas)</label><input id="eHoras" type="number" min="1" max="720" value="${esc(st.horas || 72)}"></div>
      <div><label>Agregar otro documento a esta solicitud</label><div style="display:flex;gap:6px"><select id="eMas"><option value="">— Elige —</option>${PLANTILLAS.map((x) => `<option value="${x.id}">${esc(x.titulo)}</option>`).join('')}</select><button type="button" class="mini" id="eAgregar">Agregar</button></div></div>
    </div>
    <div class="acciones"><button type="button" id="eGuardar">Guardar borrador</button><button type="button" id="ePdf">Descargar PDF</button>
      <button type="button" class="primario" id="eEnviar">Enviar a firmar</button><span style="flex:1"></span><button type="button" class="mini oculto" id="eCopia">Crear una copia para editar</button></div>
    <div id="mEd"></div><div id="eEnlaces"></div></div>
  <div id="eTabs"></div>
  <div class="editor"><form id="eForm" class="card" autocomplete="off"></form>
    <div class="card vista"><div class="cab" style="margin:0 0 8px"><b>Vista previa</b><small class="suave">En amarillo, lo que falta o escribirá el cliente</small></div><iframe id="eVista" title="Vista previa del documento"></iframe></div></div>`;

  const $m = document.getElementById('mEd'), $form = document.getElementById('eForm'), $vista = document.getElementById('eVista');

  const cabecera = () => {
    document.getElementById('eTit').textContent = titulo();
    document.getElementById('eEstado').innerHTML = `<span class="chip ${enviado() ? 'ok' : 'pendiente'}">${enviado() ? 'enviado a firmar' : 'borrador'}</span>`;
    for (const id of ['eGuardar', 'eEnviar', 'eAgregar', 'eMas', 'eHoras']) document.getElementById(id).disabled = enviado();
    document.getElementById('eCopia').classList.toggle('oculto', !enviado());
    const $e = document.getElementById('eEnlaces');
    $e.innerHTML = enviado() ? `<div class="aviso ok">Enviado ${st.solicitud ? `(solicitud <code>${esc(st.solicitud)}</code>)` : ''}. El seguimiento y el PDF firmado están en <a href="#firmas">Firmas</a>${c ? ` y en la <a href="#cliente/${encodeURIComponent(c.id)}">ficha del cliente</a>` : ''}.</div>
      ${(st.enlaces || []).map((e) => `<div class="sol"><b>${esc(e.nombre)}</b> <small class="suave">${esc(e.rol)} · vence ${fmtFecha(e.expira, true)}</small><div class="acciones">${botonesEnvio(e, { telefono: c?.telefono, correo: c?.correo, titulo: st.titulo || titulo() })}</div></div>`).join('')}` : '';
    enlazarCopiar($e);
  };

  const pestanasDocs = () => {
    document.getElementById('eTabs').innerHTML = `<div class="tabs">${st.documentos.map((d, i) => `<a href="javascript:void 0" class="tab ${i === activo ? 'act' : ''}" data-tab="${i}">${esc(info(d.plantilla).titulo)}${st.documentos.length > 1 && !enviado() ? ` <small data-quitar="${i}" title="Quitar de la solicitud">✕</small>` : ''}</a>`).join('')}</div>`;
  };

  const vacios = (d) => cache[d.plantilla].campos.filter((x) => x.tipo === 'texto' && !d.clienteLlena.includes(x.k) && !String(d.valores[x.k] || '').trim());

  const formulario = () => {
    const d = st.documentos[activo], pl = cache[d.plantilla];
    const campo = (x) => {
      const v = d.valores[x.k] ?? '', cl = d.clienteLlena.includes(x.k);
      if (x.tipo === 'casilla') return `<div><label style="font-weight:500;display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="${x.k}" ${v ? 'checked' : ''}> ${esc(cap(x.ph))}</label></div>`;
      if (x.tipo === 'auto') return `<div><label>${esc(cap(x.ph))}</label><input disabled placeholder="Se pone al firmar"></div>`;
      const puede = pl.firmaCliente && x.grupo !== 'proveedor';
      const entrada = LARGOS.test(x.k) ? `<textarea class="texto" data-k="${x.k}" ${cl ? 'disabled' : ''}>${esc(v)}</textarea>` : `<input data-k="${x.k}" value="${esc(v)}" ${cl ? 'disabled' : ''}>`;
      return `<div style="${LARGOS.test(x.k) ? 'grid-column:1/-1' : ''}"><label>${esc(cap(x.ph))}</label>${entrada}
        ${puede ? `<label class="suave" style="font-weight:500;margin:2px 0 6px;display:flex;gap:5px;align-items:center"><input type="checkbox" data-cl="${x.k}" ${cl ? 'checked' : ''}> lo llena el cliente al firmar</label>` : ''}</div>`;
    };
    $form.innerHTML = `<fieldset ${enviado() ? 'disabled' : ''} style="border:0;padding:0;margin:0;min-width:0">
      ${!pl.firmaCliente ? '<div class="aviso info" style="margin-top:0">Este documento lo firma solo CDH Maker, con tu firma autorizada.</div>' : ''}
      ${GRUPOS.map(([g, n]) => { const cs = pl.campos.filter((x) => x.grupo === g); if (!cs.length) return ''; const f = cs.filter((x) => x.tipo === 'texto' && !d.clienteLlena.includes(x.k) && !String(d.valores[x.k] || '').trim()).length;
        return `<details ${f || g === 'cliente' ? 'open' : ''} style="margin-bottom:10px"><summary style="cursor:pointer"><b>${n}</b> <small class="suave">${cs.length} campo${cs.length > 1 ? 's' : ''}${f ? ` · <span style="color:var(--warn)">${f} sin llenar</span>` : ''}</small></summary>
          <div class="grid">${cs.map(campo).join('')}</div></details>`; }).join('')}</fieldset>`;
  };

  let tVista;
  const vista = () => { clearTimeout(tVista); tVista = setTimeout(() => { const d = st.documentos[activo]; $vista.srcdoc = rellenar(htmlFinal(cache[d.plantilla], d.valores, d.clienteLlena), {}, {}); }, 120); };
  const pintar = () => { cabecera(); pestanasDocs(); formulario(); vista(); };

  // Edición: los datos compartidos se copian a los demás documentos de la solicitud.
  const fijar = (k, v) => {
    const d = st.documentos[activo];
    d.valores[k] = v;
    if (COMPARTIDA(k)) for (const o of st.documentos) if (o !== d && k in o.valores) o.valores[k] = v;
    if (d.plantilla === 'contrato-prestacion-servicios' && k === 'consecutivo') for (const o of st.documentos) if ('contrato_numero' in o.valores) o.valores.contrato_numero = v;
  };
  $form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) {
      fijar(t.dataset.k, t.type === 'checkbox' ? (t.checked ? 'X' : '') : t.value);
      if (t.dataset.k === 'valor_total') { fijar('valor_letras', letras(num(t.value))); const l = $form.querySelector('[data-k="valor_letras"]'); if (l) l.value = st.documentos[activo].valores.valor_letras; }
      vista();
    }
  });
  $form.addEventListener('change', (e) => {
    const k = e.target.dataset.cl;
    if (!k) return;
    const d = st.documentos[activo];
    d.clienteLlena = e.target.checked ? [...new Set([...d.clienteLlena, k])] : d.clienteLlena.filter((x) => x !== k);
    formulario(); vista();
  });
  document.getElementById('eTabs').addEventListener('click', (e) => {
    const q = e.target.closest('[data-quitar]');
    if (q) { e.preventDefault(); st.documentos.splice(Number(q.dataset.quitar), 1); activo = 0; return pintar(); }
    const t = e.target.closest('[data-tab]');
    if (t) { e.preventDefault(); activo = Number(t.dataset.tab); pestanasDocs(); formulario(); vista(); }
  });
  document.getElementById('eCli').addEventListener('change', (e) => {
    location.hash = ['contrato', st.documentos.map((d) => d.plantilla).join('+'), encodeURIComponent(e.target.value)].join('/');
  });
  document.getElementById('eHoras').addEventListener('input', (e) => { st.horas = Math.max(1, Math.min(720, Number(e.target.value) || 72)); });
  document.getElementById('eAgregar').addEventListener('click', async () => {
    const id = document.getElementById('eMas').value;
    if (!id) return;
    const nd = await nuevoDocumento(id, datos, st.documentos);
    st.documentos.push(nd);
    marcarAnexos(st.documentos);
    activo = st.documentos.length - 1;
    pintar();
  });

  const guardar = async () => {
    if (!st.cliente) throw new Error('Elige el cliente antes de guardar.');
    const nuevo = !st.id;
    if (nuevo) st.id = `${slug(st.cliente).slice(0, 30)}-${Date.now().toString(36)}`;
    // JSON ida y vuelta: Firestore no acepta undefined.
    const datosDoc = JSON.parse(JSON.stringify({
      cliente: st.cliente, cotizacion: st.cotizacion || '', titulo: titulo(), horas: st.horas || 72, estado: st.estado || 'borrador',
      solicitud: st.solicitud || '', enlaces: st.enlaces || [], documentos: st.documentos.map(({ plantilla, valores, clienteLlena }) => ({ plantilla, valores, clienteLlena })),
    }));
    await setDoc(doc(db, 'crm_contratos', st.id), { ...datosDoc, ...sello(nuevo) }, { merge: true });
    if (nuevo) history.replaceState(null, '', '#contrato/b/' + encodeURIComponent(st.id));
  };
  const intentar = (fn) => async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await fn(); } catch (err) { console.error(err); aviso($m, esc(err.message), 'err'); } finally { b.disabled = enviado() && b.id !== 'ePdf' && b.id !== 'eCopia'; }
  };

  document.getElementById('eGuardar').addEventListener('click', intentar(async () => { await guardar(); aviso($m, 'Borrador guardado ✔', 'ok'); }));

  document.getElementById('ePdf').addEventListener('click', intentar(async () => {
    const d = st.documentos[activo];
    aviso($m, 'Generando PDF…');
    await cargarLibs();
    const bytes = await htmlAPdf(rellenar(htmlFinal(cache[d.plantilla], d.valores, d.clienteLlena), {}, {}));
    descargar(bytes, `${slug(info(d.plantilla).titulo)}-${slug(c?.nombre || 'cliente')}${enviado() ? '' : '-borrador'}.pdf`, 'application/pdf');
    aviso($m, 'PDF descargado. Los campos en amarillo los completa el cliente al firmar.', 'ok');
  }));

  document.getElementById('eCopia').addEventListener('click', () => {
    st = { ...st, id: null, estado: 'borrador', solicitud: '', enlaces: [] };
    history.replaceState(null, '', '#contrato');
    aviso($m, 'Copia lista: es un borrador nuevo. Guárdalo o envíalo cuando quieras.', 'info');
    pintar();
  });

  document.getElementById('eEnviar').addEventListener('click', intentar(async () => {
    if (!st.cliente || !c) throw new Error('Elige el cliente.');
    if (!st.documentos.length) throw new Error('Agrega al menos un documento.');
    const faltan = st.documentos.flatMap((d) => vacios(d).map((x) => `${info(d.plantilla).titulo}: ${x.ph}`));
    if (faltan.length && !confirm(`Hay ${faltan.length} campo(s) vacíos que saldrán en blanco en el documento firmado:\n\n• ${faltan.slice(0, 12).join('\n• ')}${faltan.length > 12 ? '\n…' : ''}\n\n¿Enviar de todas formas?`)) return;
    const idDocs = ids();
    const docs = st.documentos.map((d, i) => ({ id: idDocs[i], titulo: info(d.plantilla).titulo, html: htmlFinal(cache[d.plantilla], d.valores, d.clienteLlena) }));
    const todos = Object.assign({}, ...st.documentos.map((d) => d.valores));
    const firmantes = [{
      rol: 'contratista', nombre: todos.h_nombre || emisor.nombre, docs: idDocs, firma: 'firma_h', cedula: 'h_cedula',
      prefill: { h_nombre: todos.h_nombre || '', h_cedula: todos.h_cedula || '' }, campos: [], auto: true,
    }];
    const delCliente = st.documentos.map((d, i) => [d, idDocs[i]]).filter(([d]) => cache[d.plantilla].firmaCliente);
    if (delCliente.length) {
      const campos = [], vistos = new Set();
      for (const [d] of delCliente) for (const k of d.clienteLlena) {
        if (vistos.has(k)) continue;
        vistos.add(k);
        const x = cache[d.plantilla].campos.find((y) => y.k === k);
        campos.push({ k, label: cap(x?.ph || k), req: true, ph: x?.ph || '', ...(d.valores[k] ? { valor: d.valores[k] } : {}) });
      }
      const prefill = {};
      for (const k of ['c_nombre', 'c_documento', 'c_cedula', 'c_firmante', 'ciudad_firma']) if (todos[k] && !vistos.has(k)) prefill[k] = todos[k];
      firmantes.push({ rol: 'contratante', nombre: (!vistos.has('c_firmante') && todos.c_firmante) || c.nombre, docs: delCliente.map(([, id]) => id),
        firma: 'firma_c', cedula: 'c_cedula', prefill, campos });
    }
    aviso($m, 'Creando la solicitud y firmando la parte de CDH Maker…');
    const t = titulo();
    const { sid, enlaces } = await crearSolicitudFirma({ cliente: st.cliente, titulo: t, horas: st.horas || 72, docs, firmantes, nota: 'Creada desde Contratos', documento_id: st.cotizacion || '' });
    st.estado = 'enviado'; st.solicitud = sid; st.titulo = t;
    st.enlaces = enlaces.map(({ rol, nombre, url, expira }) => ({ rol, nombre, url, expira }));
    await guardar();
    $m.innerHTML = '';
    pintar();
    if (enlaces.length) mostrarEnlaces({ titulo: t, enlaces, telefono: c.telefono, correo: c.correo });
    else aviso($m, 'Listo: CDH Maker firmó el documento. Ármalo en PDF desde <a href="#firmas">Firmas</a>.', 'ok');
  }));

  pintar();
}
