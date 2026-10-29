// CRM de CDH Maker (cdhmaker.com/crm): la consola de la empresa. Este archivo tiene el acceso, el enrutador,
// Inicio, Clientes (software y servicios con seguimiento / productos), el cotizador, Docs e Importar; el
// resto vive en su módulo: equipo.js, firmas.js, contratos.js, pagos.js, libro.js (contabilidad),
// marketing.js. Acceso sin clave: el administrador entra con el enlace que le llega al correo (Firebase
// Auth). La seguridad real está en firestore.rules (esAdmin).
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { db, auth, EMULADOR, ctx, $app, esc, cop, fecha, fmtFecha, aviso, slug, token, descargar, hoyCO, mesDe, sello, nav, pestanas, kpi, nombreDe, opcionesEquipo,
  guardarAdjunto, bajarAdjunto, borrarAdjunto, deB64 } from './comun.js';
import { sha256Bytes, htmlAPdf, cargarLibs } from './ensamblar.js?v=4';
import { htmlDocumento, totales, claseDe, sumarDias, TIPOS, EMISOR_BASE } from './comercial.js?v=4';
import { ADMINS, cargarEquipo, vistaEquipo, firmaAutorizada } from './equipo.js';
import { vistaFirmas, pintarSolicitudes, crearSolicitudFirma, mostrarEnlaces, marcarEnviado, estadoSolicitud } from './firmas.js';
import { vistaPagos, mediosParaCobro } from './pagos.js';
// Módulos grandes o que pueden faltar en un despliegue parcial: se cargan al usarlos.
const libro = () => import('./libro.js');
const marca = () => import('./marca.js').catch(() => null);
const CLAVE_CORREO = 'cdh_crm_correo';

// ───────── acceso ─────────
async function completarEnlace() {
  if (!isSignInWithEmailLink(auth, location.href)) return;
  let correo = localStorage.getItem(CLAVE_CORREO);
  if (!correo) correo = prompt('Confirma tu correo para entrar al CRM:') || '';
  try {
    await signInWithEmailLink(auth, correo.trim().toLowerCase(), location.href);
    localStorage.removeItem(CLAVE_CORREO);
  } catch (e) { console.error(e); alert('El enlace de acceso no es válido o ya se usó. Pide uno nuevo.'); }
  history.replaceState(null, '', location.pathname + (EMULADOR ? '?emu' : ''));
}

function pantallaAcceso(msg = '') {
  document.getElementById('nav').innerHTML = ''; document.getElementById('yo').innerHTML = '';
  $app.innerHTML = `<div class="card" style="max-width:440px;margin:40px auto">
    <h2>Entrar a la consola</h2>
    <p class="suave">Escribe tu correo de administrador. Te llegará un enlace para entrar; no necesitas clave.</p>
    <form id="fAcceso"><label for="correo">Correo</label><input id="correo" type="email" required autocomplete="email">
    <div class="acciones"><button class="primario">Enviarme el enlace</button></div></form><div id="msg">${msg}</div></div>`;
  document.getElementById('fAcceso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('correo').value.trim().toLowerCase();
    const m = document.getElementById('msg');
    if (!ADMINS.includes(correo)) return aviso(m, 'Este correo no tiene acceso al CRM.', 'err');
    try {
      await sendSignInLinkToEmail(auth, correo, { url: location.origin + '/crm' + (EMULADOR ? '?emu' : ''), handleCodeInApp: true });
      localStorage.setItem(CLAVE_CORREO, correo);
      aviso(m, `Listo. Revisa <b>${esc(correo)}</b> (también la carpeta de spam) y abre el enlace en este mismo navegador.`, 'ok');
    } catch (err) { console.error(err); aviso(m, 'No se pudo enviar el enlace: ' + esc(err.code || err.message), 'err'); }
  });
}

// ───────── enrutador ─────────
const RUTAS = {
  inicio: () => vistaInicio(),
  clientes: ([seg]) => vistaClientes(seg),
  cliente: ([id]) => vistaCliente(id),
  cotizador: ([f]) => vistaCotizador(f || 'cotizacion'),
  catalogo: async (p) => (await import('./catalogo.js')).vistaCatalogo(p),
  doc: ([id, extra]) => vistaDocumento(id, extra || ''),
  docs: ([c]) => vistaDocs(c || ''),
  firmas: (p) => vistaFirmas(p),
  contrato: async (p) => (await import('./contratos.js')).vistaContrato(p),
  libro: async (p) => (await libro()).vistaLibro(p),
  pagos: (p) => vistaPagos(p),
  marketing: async (p) => (await import('./marketing.js')).vistaMarketing(p),
  equipo: (p) => vistaEquipo(p),
  importar: () => vistaImportar(),
};
async function enrutar() {
  if (!ctx.usuario) return;
  const [ruta, ...resto] = location.hash.slice(1).split('/');
  try { await (RUTAS[ruta] || RUTAS.inicio)(resto.map(decodeURIComponent)); window.scrollTo(0, 0); }
  catch (e) { console.error(e); $app.innerHTML = `<div class="card"><div class="aviso err">Error: ${esc(e.code || e.message)}</div></div>`; }
}

// ───────── clientes ─────────
// Software y servicios: proyectos y suscripciones que exigen seguimiento (etapa, responsable, próximo
// contacto, bitácora). Productos: compras puntuales; basta saber cuándo compró por última vez.
const SEGMENTOS = { proyecto: 'Software y servicios', producto: 'Productos' };
const segmentoDe = (c) => c.segmento || ((c.cuotas || []).length || c.proyecto ? 'proyecto' : 'producto');
const ETAPAS = ['prospecto', 'propuesta enviada', 'negociación', 'contrato firmado', 'en desarrollo', 'entregado', 'soporte y mantenimiento', 'cerrado'];
const TIPOS_SEG = ['WhatsApp', 'llamada', 'reunión', 'correo', 'visita', 'soporte', 'entrega'];
const resumenPagos = (c) => {
  const cuotas = c.cuotas || [];
  const pagado = cuotas.filter((q) => q.estado === 'pagada').reduce((s, q) => s + Number(q.valor || 0), 0);
  const total = Number(c.valor_total || cuotas.reduce((s, q) => s + Number(q.valor || 0), 0));
  return { pagado, total, saldo: total - pagado, pagadas: cuotas.filter((q) => q.estado === 'pagada').length, n: cuotas.length };
};
const chipSeguimiento = (f, hoy = hoyCO()) => !f ? '<span class="chip neutro">sin fecha</span>' : `<span class="chip ${f < hoy ? 'vencido' : f === hoy ? 'pendiente' : 'info'}">${esc(f)}</span>`;
const leerClientes = () => getDocs(query(collection(db, 'crm_clientes'), orderBy('nombre'))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

async function vistaClientes(seg = 'proyecto') {
  nav('clientes');
  const [clientes, docs] = await Promise.all([leerClientes(), getDocs(collection(db, 'crm_documentos')).then((s) => s.docs.map((d) => d.data()))]);
  const de = (s) => clientes.filter((c) => s === 'todos' || segmentoDe(c) === s);
  const ultima = (id) => docs.filter((d) => d.cliente === id && d.tipo === 'factura' && d.estado !== 'anulada').map((d) => d.fecha).sort().at(-1) || '';
  const hoy = hoyCO(), lista = de(seg);
  const vencidos = de('proyecto').filter((c) => c.proximo_seguimiento && c.proximo_seguimiento <= hoy && c.etapa !== 'cerrado');
  $app.innerHTML = `<h1 class="titulo">Clientes</h1><p class="bajada">Los de software y servicios llevan seguimiento especial; los de productos compran de vez en cuando.</p>
    <div class="kpis">${kpi('Software y servicios', de('proyecto').length, 'cian')}${kpi('Productos', de('producto').length)}${kpi('Seguimientos para hoy o vencidos', vencidos.length, vencidos.length ? 'err' : 'ok')}
      ${kpi('Saldo por cobrar en cuotas', cop(clientes.reduce((s, c) => s + Math.max(0, resumenPagos(c).saldo), 0)), 'warn')}</div>
    ${pestanas('clientes', [['proyecto', SEGMENTOS.proyecto, de('proyecto').length], ['producto', SEGMENTOS.producto, de('producto').length], ['todos', 'Todos', clientes.length]], seg)}
    <div class="cols"><div class="card"><h2>Nuevo cliente</h2>
      <form id="fNuevo"><label>Nombre o razón social</label><input name="nombre" required>
      <label>Tipo de cliente</label><select name="segmento">${Object.entries(SEGMENTOS).map(([k, v]) => `<option value="${k}" ${k === (seg === 'producto' ? 'producto' : 'proyecto') ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label>Proyecto o producto de interés</label><input name="proyecto"><label>Correo</label><input name="correo" type="email"><label>Teléfono / WhatsApp</label><input name="telefono">
      <label>Responsable</label><select name="responsable">${opcionesEquipo(ctx.perfil?.id || '')}</select>
      <div class="acciones"><button class="primario">Crear</button></div></form><div id="mNuevo"></div></div>
    <div class="card"><h2>${seg === 'todos' ? 'Todos los clientes' : SEGMENTOS[seg]} (${lista.length})</h2>${lista.length ? `<div class="tabla"><table>
      <tr><th>Cliente</th>${seg === 'producto' ? '<th>Última compra</th>' : '<th>Etapa</th><th>Próximo seguimiento</th>'}<th>Responsable</th><th style="text-align:right">Pagado / total</th></tr>
      ${lista.map((c) => { const r = resumenPagos(c); return `<tr class="fila" data-id="${esc(c.id)}"><td><b>${esc(c.nombre)}</b>${c.empresa ? '<br><small class="suave">' + esc(c.empresa) + '</small>' : ''}<br><small class="suave">${esc(c.proyecto || '')}</small></td>
        ${seg === 'producto' ? `<td>${esc(ultima(c.id) || '—')}</td>` : `<td>${segmentoDe(c) === 'proyecto' ? `<span class="chip info">${esc(c.etapa || 'prospecto')}</span>` : '<span class="chip neutro">producto</span>'}</td><td>${segmentoDe(c) === 'proyecto' ? chipSeguimiento(c.proximo_seguimiento, hoy) : ''}</td>`}
        <td>${esc(nombreDe(c.responsable))}</td><td style="text-align:right;white-space:nowrap">${r.total ? `${cop(r.pagado)}<br><small class="suave">de ${cop(r.total)}</small>` : '—'}</td></tr>`; }).join('')}</table></div>`
      : '<div class="vacio">Aún no hay clientes aquí.</div>'}</div></div>`;
  $app.querySelectorAll('[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'cliente/' + encodeURIComponent(tr.dataset.id))));
  document.getElementById('fNuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const id = slug(f.nombre) || token().slice(0, 12);
    const ref = doc(db, 'crm_clientes', id);
    if ((await getDoc(ref)).exists()) return aviso(document.getElementById('mNuevo'), 'Ya existe un cliente con ese identificador.', 'err');
    await setDoc(ref, { ...f, estado: 'activo', etapa: f.segmento === 'proyecto' ? 'prospecto' : '', proximo_seguimiento: f.segmento === 'proyecto' ? sumarDias(hoyCO(), 2) : '', cuotas: [], ...sello(true) });
    location.hash = 'cliente/' + encodeURIComponent(id);
  });
}

const CAMPOS = [['nombre', 'Nombre o razón social'], ['tipo', 'Tipo (persona natural / empresa)'], ['documento', 'Cédula o NIT'], ['empresa', 'Empresa relacionada'],
  ['correo', 'Correo'], ['telefono', 'Teléfono / WhatsApp'], ['direccion', 'Ciudad y dirección'], ['proyecto', 'Proyecto o producto'], ['valor_total', 'Valor total (COP)'], ['estado', 'Estado (activo, pagado, cerrado)']];

async function vistaCliente(id) {
  nav('clientes');
  const ref = doc(db, 'crm_clientes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { $app.innerHTML = '<div class="card"><div class="aviso err">Cliente no encontrado.</div></div>'; return; }
  const c = snap.data(), r = resumenPagos(c), seg = segmentoDe(c), hoy = hoyCO();
  $app.innerHTML = `<p><a href="#clientes/${seg}">← ${SEGMENTOS[seg]}</a></p>
  <div class="cab"><div><h1 class="titulo">${esc(c.nombre)}</h1><p class="bajada">${esc(c.proyecto || '')} · <span class="chip ${seg === 'proyecto' ? 'info' : 'neutro'}">${SEGMENTOS[seg]}</span>${seg === 'proyecto' ? ' <span class="chip info">' + esc(c.etapa || 'prospecto') + '</span>' : ''}</p></div>
    <div class="acciones"><a class="boton primario" href="#doc/nuevo/${encodeURIComponent(id)}">Nueva cotización</a><a class="boton" href="#contrato/para/${encodeURIComponent(id)}">Nuevo contrato</a></div></div>
  <div class="cols"><div>
    <div class="card"><h2>Datos</h2><form id="fDatos">
      <label>Tipo de cliente</label><select name="segmento">${Object.entries(SEGMENTOS).map(([k, v]) => `<option value="${k}" ${k === seg ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label>Responsable</label><select name="responsable">${opcionesEquipo(c.responsable || '')}</select>
      ${seg === 'proyecto' ? `<label>Etapa</label><select name="etapa">${ETAPAS.map((x) => `<option ${x === (c.etapa || 'prospecto') ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <label>Próximo seguimiento</label><input name="proximo_seguimiento" type="date" value="${esc(c.proximo_seguimiento || '')}">
        <label>Seguimiento cada (días)</label><input name="frecuencia_dias" type="number" min="1" value="${esc(c.frecuencia_dias || 15)}">
        <label>Servicio recurrente (COP / mes, si aplica)</label><input name="mensualidad" type="number" min="0" value="${esc(c.mensualidad || '')}">` : ''}
      ${CAMPOS.map(([k, l]) => `<label>${l}</label><input name="${k}" value="${esc(c[k] ?? '')}">`).join('')}
      <label>Notas</label><textarea name="notas" class="texto">${esc(c.notas || '')}</textarea>
      <div class="acciones"><button class="primario">Guardar</button></div></form><div id="mDatos"></div>
      <p class="suave">Actualizado ${fmtFecha(c.actualizado, true)}${c.actualizado_por ? ' por ' + esc(nombreDe(c.actualizado_por)) : ''}</p></div>
  </div><div>
    ${seg === 'proyecto' ? `<div class="card"><div class="cab"><h2 style="margin:0">Seguimiento</h2><span>Próximo: ${chipSeguimiento(c.proximo_seguimiento, hoy)}</span></div>
      <form id="fSeg" class="grid" style="margin-top:6px"><div><label>Fecha</label><input name="fecha" type="date" value="${hoy}" required></div>
        <div><label>Medio</label><select name="tipo">${TIPOS_SEG.map((x) => `<option>${x}</option>`).join('')}</select></div>
        <div><label>Próximo contacto</label><input name="proximo" type="date" value="${sumarDias(hoy, c.frecuencia_dias || 15)}"></div>
        <div style="grid-column:1/-1"><label>Qué se habló / acordó</label><textarea name="nota" class="texto" required></textarea></div>
        <div><button class="primario">Registrar seguimiento</button></div></form><div id="bitacora"><p class="suave">Cargando…</p></div></div>` : ''}
    <div class="card"><h2>Plan de pagos</h2>
      <p>Pagado <b>${cop(r.pagado)}</b> de <b>${cop(r.total)}</b> · saldo <b>${cop(r.saldo)}</b> · ${r.pagadas}/${r.n} cuotas</p>
      <div class="tabla"><table><tr><th>#</th><th>Vence</th><th>Valor</th><th>Estado</th><th>Pago</th><th></th></tr>
      ${(c.cuotas || []).map((q, i) => `<tr><td>${esc(q.n)}</td><td>${esc(q.fecha)}</td><td>${cop(q.valor)}</td><td><span class="chip ${q.estado === 'pagada' ? 'firmado' : q.fecha < hoy ? 'vencido' : 'pendiente'}">${esc(q.estado === 'pagada' ? 'pagada' : q.fecha < hoy ? 'vencida' : 'pendiente')}</span></td>
        <td>${q.estado === 'pagada' ? esc(q.fecha_pago || '') + (q.referencia ? '<br><small class="suave">' + esc(q.referencia) + '</small>' : '') : ''}</td>
        <td>${q.estado === 'pagada' ? `<button class="mini" data-desmarcar="${i}">Deshacer</button>` : `<button class="mini primario" data-pagar="${i}">Registrar pago</button>`}</td></tr>`).join('')}
      </table></div>
      <form id="fCuota" class="acciones"><input name="fecha" type="date" required style="width:auto"><input name="valor" type="number" min="0" placeholder="Valor" required style="width:140px"><button class="mini">Agregar cuota</button></form>
    </div>
    <div class="card"><div class="cab" style="margin:0 0 6px"><h2 style="margin:0">Cotizaciones y cuentas de cobro</h2>
      <a class="boton" href="#doc/nuevo/${encodeURIComponent(id)}">Nueva cotización</a></div><div id="comerciales"><p class="suave">Cargando…</p></div></div>
    <div class="card"><div class="cab" style="margin:0 0 6px"><h2 style="margin:0">Firmas</h2><a class="boton" href="#contrato/para/${encodeURIComponent(id)}">Enviar contrato a firmar</a></div><div id="solicitudes"><p class="suave">Cargando…</p></div></div>
    <div class="card"><h2>Expediente</h2><div id="archivos"><p class="suave">Cargando…</p></div>
      <div class="acciones"><input type="file" id="fArchivo" multiple style="width:auto"><select id="fCarpeta" style="width:auto">${opcionesCarpeta('')}</select><button class="mini" id="subir">Subir al expediente</button></div><div id="mArchivo"></div></div>
  </div></div>`;

  const guardar = async (cambios) => { await updateDoc(ref, { ...cambios, ...sello() }); await vistaCliente(id); };
  document.getElementById('fDatos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.valor_total !== '') f.valor_total = Number(f.valor_total) || 0;
    if ('frecuencia_dias' in f) f.frecuencia_dias = Number(f.frecuencia_dias) || 15;
    if ('mensualidad' in f) f.mensualidad = Number(f.mensualidad) || 0;
    await guardar(f);
  });
  document.getElementById('fSeg')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await addDoc(collection(db, 'crm_clientes', id, 'seguimientos'), { ...f, por: ctx.perfil?.id || ctx.usuario.email, ...sello(true) });
    await guardar({ proximo_seguimiento: f.proximo || '', ultimo_seguimiento: f.fecha });
  });
  if (seg === 'proyecto') getDocs(query(collection(db, 'crm_clientes', id, 'seguimientos'), orderBy('fecha', 'desc'))).then((s) => {
    document.getElementById('bitacora').innerHTML = s.size ? `<div class="tabla"><table style="margin-top:10px">${s.docs.map((d) => { const x = d.data(); return `<tr><td style="white-space:nowrap">${esc(x.fecha)}<br><small class="suave">${esc(x.tipo)} · ${esc(nombreDe(x.por))}</small></td><td style="white-space:pre-line">${esc(x.nota)}</td></tr>`; }).join('')}</table></div>`
      : '<p class="suave">Sin seguimientos registrados.</p>';
  });
  $app.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
    const L = await libro();
    const i = Number(b.dataset.pagar), q = c.cuotas[i];
    const pago = await L.dialogoPago({ titulo: `Pago de la cuota ${q.n} — ${c.nombre}`, total: Number(q.valor || 0), tercero: c.nombre });
    if (!pago) return;
    const cuotas = [...c.cuotas];
    cuotas[i] = { ...q, estado: 'pagada', fecha_pago: pago.fecha, referencia: pago.referencia || pago.medio || '', medio: pago.medio || '', recibido: pago.recibido ?? Number(q.valor || 0), registrado_por: ctx.usuario.email };
    await L.asientoCuota(id, c, cuotas[i], pago);
    await guardar({ cuotas });
  }));
  $app.querySelectorAll('[data-desmarcar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Marcar esta cuota como pendiente otra vez? El ingreso del libro contable quedará anulado.')) return;
    const L = await libro();
    const cuotas = [...c.cuotas]; const { fecha_pago, referencia, registrado_por, medio, recibido, ...resto } = cuotas[Number(b.dataset.desmarcar)];
    cuotas[Number(b.dataset.desmarcar)] = { ...resto, estado: 'pendiente' };
    await L.anularAsiento(L.idAsientoCuota(id, resto.n), 'Pago de cuota deshecho');
    await guardar({ cuotas });
  }));
  document.getElementById('fCuota').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await guardar({ cuotas: [...(c.cuotas || []), { n: (c.cuotas || []).length + 1, fecha: f.fecha, valor: Number(f.valor), estado: 'pendiente' }] });
  });
  document.getElementById('subir').addEventListener('click', async () => {
    const m = document.getElementById('mArchivo');
    const files = [...document.getElementById('fArchivo').files];
    if (!files.length) return aviso(m, 'Elige uno o más archivos.', 'err');
    const carpeta = document.getElementById('fCarpeta').value;
    for (const f of files) { aviso(m, 'Subiendo ' + esc(f.name) + '…'); await guardarAdjunto(id, { nombre: f.name, tipo: 'documento', carpeta: carpeta || carpetaDe({ nombre: f.name }), mime: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) }); }
    await vistaCliente(id);
  });
  pintarSolicitudes(document.getElementById('solicitudes'), id, c, () => vistaCliente(id));
  pintarArchivos(id);
  pintarComerciales(id);
}

async function pintarComerciales(cliente) {
  const el = document.getElementById('comerciales');
  const docs = (await getDocs(query(collection(db, 'crm_documentos'), where('cliente', '==', cliente)))).docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  el.innerHTML = docs.length ? tablaComerciales(docs, false) : '<p class="suave">Sin cotizaciones ni cuentas de cobro.</p>';
  enlazarFilas(el);
}

// ───────── Inicio: lo que hay que hacer hoy ─────────
async function vistaInicio() {
  nav('inicio');
  const p = ctx.perfil;
  $app.innerHTML = `<h1 class="titulo">Hola, ${esc(p?.nombre_corto || 'equipo')}</h1><p class="bajada">${new Date().toLocaleDateString('es-CO', { dateStyle: 'full', timeZone: 'America/Bogota' })}</p><div id="tablero"><p class="suave">Cargando el tablero…</p></div>`;
  const hoy = hoyCO(), mes = hoy.slice(0, 7);
  const [clientes, docs, movs, mk, L] = await Promise.all([leerClientes(), getDocs(collection(db, 'crm_documentos')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    libro().then((m) => m.cargarMovimientos()).catch(() => []), import('./marketing.js').then((m) => m.resumenMarketing()).catch(() => null), libro().catch(() => null)]);
  const res = L ? L.resumenLibro(movs.filter((m) => mesDe(m.fecha) === mes)) : { ingresos: 0, costos: 0, gastos: 0, resultado: 0 };
  const cuotasPend = clientes.flatMap((c) => (c.cuotas || []).filter((q) => q.estado !== 'pagada').map((q) => ({ c, q })));
  const cobros = docs.filter((d) => d.tipo === 'factura' && d.estado === 'emitida');
  const porCobrar = cuotasPend.reduce((s, x) => s + Number(x.q.valor || 0), 0) + cobros.reduce((s, d) => s + totales(d).total, 0);
  const seguir = clientes.filter((c) => segmentoDe(c) === 'proyecto' && c.etapa !== 'cerrado' && c.proximo_seguimiento && c.proximo_seguimiento <= hoy);
  const vencidas = cuotasPend.filter((x) => x.q.fecha && x.q.fecha < hoy);
  const negociacion = docs.filter((d) => d.tipo === 'cotizacion' && d.estado === 'enviada');
  const tareas = [
    ...seguir.map((c) => ({ t: `Seguimiento a <b>${esc(c.nombre)}</b> (${esc(c.etapa || 'prospecto')})${c.responsable ? ' · ' + esc(nombreDe(c.responsable)) : ''}`, f: c.proximo_seguimiento, href: '#cliente/' + encodeURIComponent(c.id) })),
    ...vencidas.map(({ c, q }) => ({ t: `Cobrar la cuota ${esc(q.n)} de <b>${esc(c.nombre)}</b> · ${cop(q.valor)}`, f: q.fecha, href: '#cliente/' + encodeURIComponent(c.id) })),
    ...cobros.filter((d) => d.vence && d.vence < hoy).map((d) => ({ t: `${esc(TIPOS[claseDe(d)].corto)} ${esc(d.numero)} vencida · <b>${esc(d.receptor?.nombre || '')}</b> · ${cop(totales(d).total)}`, f: d.vence, href: '#doc/' + d.id })),
    ...(mk?.pendientes || []).map((x) => ({ t: esc(x.texto), f: '', href: x.href })),
  ].sort((a, b) => String(a.f).localeCompare(String(b.f)));
  document.getElementById('tablero').innerHTML = `<div class="kpis">${kpi('Por cobrar', cop(porCobrar), 'warn', `${cuotasPend.length} cuotas · ${cobros.length} cuentas de cobro`)}
      ${kpi('Ingresos del mes', cop(res.ingresos), 'ok')}${kpi('Costos y gastos del mes', cop(res.costos + res.gastos), 'err')}${kpi('Resultado del mes', cop(res.resultado), res.resultado < 0 ? 'err' : '')}
      ${kpi('En negociación', cop(negociacion.reduce((s, d) => s + totales(d).total, 0)), 'cian', `${negociacion.length} cotizaciones enviadas`)}
      ${mk ? kpi('Inversión en pauta (mes)', cop(mk.inversionMes), '', `${mk.leadsMes} leads${mk.cpl ? ' · CPL ' + cop(mk.cpl) : ''}`) : ''}</div>
    <div class="cols mitad"><div class="card"><h2>Pendientes (${tareas.length})</h2>${tareas.length ? `<ul class="lista">${tareas.slice(0, 25).map((x) => `<li onclick="location.hash='${esc(x.href.replace(/^#/, ''))}'">${x.t}${x.f ? `<small>${x.f < hoy ? 'venció ' : ''}${esc(x.f)}</small>` : ''}</li>`).join('')}</ul>` : '<div class="vacio">Todo al día ✔</div>'}</div>
      <div><div class="card"><h2>Accesos rápidos</h2><div class="acciones" style="margin:0">
        <a class="boton primario" href="#doc/nuevo">Nueva cotización</a><a class="boton" href="#libro">Registrar gasto o comprobante</a><a class="boton" href="#contrato">Contrato para firmar</a>
        <a class="boton" href="#clientes">Nuevo cliente</a><a class="boton" href="#pagos">QR de pago</a><a class="boton" href="#marketing">Marketing</a></div></div>
        <div class="card"><h2>Clientes de software y servicios</h2>${(() => { const ps = clientes.filter((c) => segmentoDe(c) === 'proyecto' && c.etapa !== 'cerrado');
          return ps.length ? `<div class="tabla"><table><tr><th>Cliente</th><th>Etapa</th><th>Seguimiento</th></tr>${ps.map((c) => `<tr class="fila" onclick="location.hash='cliente/${encodeURIComponent(c.id)}'"><td>${esc(c.nombre)}</td><td>${esc(c.etapa || 'prospecto')}</td><td>${chipSeguimiento(c.proximo_seguimiento, hoy)}</td></tr>`).join('')}</table></div>` : '<p class="suave">Sin proyectos activos.</p>'; })()}</div></div></div>`;
}

// ───────── Docs: archivos de expedientes y documentos generales, por carpeta ─────────
const CARPETAS = [['contratos', 'Contratos'], ['cuentas_cobro', 'Cuentas de cobro'], ['facturas', 'Facturas'], ['cotizaciones', 'Cotizaciones'],
  ['actas', 'Actas, anexos y órdenes'], ['firmas', 'Evidencia de firma'], ['otros', 'Otros']];
const nombreCarpeta = (k) => CARPETAS.find(([x]) => x === k)?.[1] || 'Otros';
function carpetaDe(a) {
  if (a.carpeta) return a.carpeta;
  const t = `${a.tipo || ''} ${a.nombre || ''}`.toLowerCase();
  if (/registro|firma-|\.png|\.json|certificado/.test(t)) return 'firmas';
  if (/cuenta|cobro/.test(t)) return 'cuentas_cobro';
  if (/factura/.test(t)) return 'facturas';
  if (/cotiza|propuesta/.test(t)) return 'cotizaciones';
  if (/acta|anexo|orden|paz-y-salvo|bienvenida|plan-de-pago/.test(t)) return 'actas';
  if (/contrato|acuerdo/.test(t)) return 'contratos';
  return 'otros';
}
const opcionesCarpeta = (sel) => `<option value="">Clasificar automáticamente</option>${CARPETAS.map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}</option>`).join('')}`;
async function pintarArchivos(cliente) {
  const el = document.getElementById('archivos');
  const snap = await getDocs(query(collection(db, 'crm_clientes', cliente, 'archivos'), orderBy('creado', 'desc')));
  if (!snap.size) { el.innerHTML = '<p class="suave">Sin archivos todavía.</p>'; return; }
  el.innerHTML = `<div class="tabla"><table><tr><th>Archivo</th><th>Carpeta</th><th>Fecha</th><th></th></tr>${snap.docs.map((d) => { const a = d.data(); return `<tr><td>${esc(a.nombre)}<br><small class="suave">${(a.tamano / 1024).toFixed(0)} KB · SHA-256 ${esc((a.sha256 || '').slice(0, 12))}…</small></td><td><a href="#docs/${carpetaDe(a)}">${esc(nombreCarpeta(carpetaDe(a)))}</a></td><td>${fmtFecha(a.creado, true)}</td>
    <td style="white-space:nowrap"><button class="mini" data-bajar="${d.id}">Descargar</button> <button class="mini peligro" data-borrar="${d.id}">Borrar</button></td></tr>`; }).join('')}</table></div>`;
  el.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => bajarAdjunto(cliente, b.dataset.bajar, snap.docs.find((d) => d.id === b.dataset.bajar).data())));
  el.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar este archivo del expediente? No se puede deshacer.')) return;
    await borrarAdjunto(cliente, b.dataset.borrar);
    pintarArchivos(cliente);
  }));
}

async function vistaDocs(carpeta) {
  nav('docs');
  const [deClientes, generales, clientes] = await Promise.all([
    getDocs(collectionGroup(db, 'archivos')).then((s) => s.docs.filter((d) => d.ref.path.startsWith('crm_clientes/')).map((d) => ({ id: d.id, cliente: d.ref.parent.parent.id, ...d.data() }))),
    getDocs(collection(db, 'crm_docs')).then((s) => s.docs.map((d) => ({ id: d.id, cliente: '', ...d.data() }))),
    getDocs(collection(db, 'crm_clientes')).then((s) => Object.fromEntries(s.docs.map((d) => [d.id, d.data().nombre]))),
  ]);
  const todos = [...deClientes, ...generales].map((a) => ({ ...a, carpeta: carpetaDe(a) })).sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0));
  const cuenta = (k) => todos.filter((a) => a.carpeta === k).length;
  const vista = carpeta ? todos.filter((a) => a.carpeta === carpeta) : todos;
  $app.innerHTML = `<h1 class="titulo">Docs</h1><p class="bajada">Todos los archivos de los expedientes y los documentos generales de CDH Maker. Los comprobantes de gastos están en Contabilidad.</p><div class="cols"><div>
    <div class="card"><ul class="lista carpetas">
      <li data-carpeta="" class="${carpeta ? '' : 'act'}"><b>📁 Todos</b> <small>${todos.length} archivos</small></li>
      ${CARPETAS.map(([k, n]) => `<li data-carpeta="${k}" class="${k === carpeta ? 'act' : ''}"><b>📁 ${n}</b> <small>${cuenta(k)} archivos</small></li>`).join('')}</ul></div>
    <div class="card"><h2>Subir a Docs</h2><form id="fDocs"><input type="file" name="archivos" multiple required>
      <label>Carpeta</label><select name="carpeta">${opcionesCarpeta(carpeta)}</select>
      <label>Cliente</label><select name="cliente"><option value="">— Documento general de CDH Maker —</option>${Object.entries(clientes).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select>
      <div class="acciones"><button class="primario">Subir</button></div></form><div id="mDocs"></div></div></div>
    <div class="card"><div class="cab" style="margin:0 0 8px"><h2 style="margin:0">${carpeta ? esc(nombreCarpeta(carpeta)) : 'Todos los documentos'} (${vista.length})</h2>
      <input id="buscar" type="search" placeholder="Buscar por nombre o cliente" style="width:auto;min-width:220px"></div>
      ${vista.length ? `<div class="tabla"><table id="tDocs"><tr><th>Archivo</th><th>Cliente</th>${carpeta ? '' : '<th>Carpeta</th>'}<th>Fecha</th><th></th></tr>
      ${vista.map((a, i) => `<tr data-buscar="${esc((a.nombre + ' ' + (clientes[a.cliente] || '')).toLowerCase())}"><td>${esc(a.nombre)}<br><small class="suave">${(a.tamano / 1024).toFixed(0)} KB</small></td>
        <td>${a.cliente ? `<a href="#cliente/${encodeURIComponent(a.cliente)}">${esc(clientes[a.cliente] || a.cliente)}</a>` : '<span class="suave">CDH Maker</span>'}</td>
        ${carpeta ? '' : `<td>${esc(nombreCarpeta(a.carpeta))}</td>`}<td style="white-space:nowrap">${fmtFecha(a.creado)}</td>
        <td style="white-space:nowrap"><button class="mini" data-bajar="${i}">Descargar</button> <select class="mini" data-mover="${i}" style="width:auto" title="Mover a otra carpeta">${CARPETAS.map(([k, n]) => `<option value="${k}" ${k === a.carpeta ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button class="mini peligro" data-borrar="${i}">Borrar</button></td></tr>`).join('')}</table></div>` : '<div class="vacio">Esta carpeta está vacía.</div>'}</div></div>`;
  $app.querySelectorAll('[data-carpeta]').forEach((li) => li.addEventListener('click', () => (location.hash = 'docs' + (li.dataset.carpeta ? '/' + li.dataset.carpeta : ''))));
  document.getElementById('buscar').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#tDocs [data-buscar]').forEach((tr) => tr.classList.toggle('oculto', !!q && !tr.dataset.buscar.includes(q)));
  });
  $app.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => { const a = vista[b.dataset.bajar]; bajarAdjunto(a.cliente, a.id, a); }));
  $app.querySelectorAll('[data-mover]').forEach((s) => s.addEventListener('change', async () => {
    const a = vista[s.dataset.mover];
    await updateDoc(doc(db, ...(a.cliente ? ['crm_clientes', a.cliente, 'archivos', a.id] : ['crm_docs', a.id])), { carpeta: s.value });
    await vistaDocs(carpeta);
  }));
  $app.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    const a = vista[b.dataset.borrar];
    if (!confirm(`¿Borrar «${a.nombre}»? No se puede deshacer.`)) return;
    await borrarAdjunto(a.cliente, a.id);
    await vistaDocs(carpeta);
  }));
  document.getElementById('fDocs').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), m = document.getElementById('mDocs');
    try {
      for (const file of f.getAll('archivos')) {
        aviso(m, 'Subiendo ' + esc(file.name) + '…');
        await guardarAdjunto(f.get('cliente'), { nombre: file.name, tipo: 'documento', carpeta: f.get('carpeta') || carpetaDe({ nombre: file.name }), mime: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) });
      }
      await vistaDocs(carpeta);
    } catch (err) { console.error(err); aviso(m, 'No se pudo subir: ' + esc(err.code || err.message), 'err'); }
  });
}

// ───────── cotizador (crm_documentos): cotización → cuenta de cobro (o factura de venta) ─────────
// Una cotización recibe su número al guardarse por primera vez; la cuenta de cobro nace como borrador y
// recibe el consecutivo al emitirse, para que la numeración no tenga saltos. Las emitidas no se editan:
// se anulan. Estados — cotización: borrador, enviada, aceptada, rechazada, facturada; cobro: borrador,
// emitida, pagada, anulada. "factura" en los datos es el documento de cobro (modalidad cuenta_cobro o
// factura_venta); CDH Maker, no responsable de IVA, cobra con cuenta de cobro (ver CONTABILIDAD.md).
const ESTADOS_COT = ['borrador', 'enviada', 'aceptada', 'rechazada'];
const CHIP = { borrador: 'pendiente', enviada: 'parcial', aceptada: 'firmado', facturada: 'firmado', emitida: 'parcial', pagada: 'firmado', rechazada: 'anulado', anulada: 'anulado' };
const CUENTAS_RESPALDO = ['Desarrollo de software', 'Fabricación digital', 'Electrónica e IoT', 'Consultoría y capacitación', 'Otros ingresos'];
// Datos del emisor, con el logo de la marca y los QR de pago para las cuentas de cobro.
async function leerEmisor({ pagos = false } = {}) {
  const [conf, m, medios] = await Promise.all([getDoc(doc(db, 'crm_config', 'emisor')).then((s) => s.data() || {}), marca(), pagos ? mediosParaCobro().catch((e) => { console.error(e); return []; }) : []]);
  return { ...EMISOR_BASE, firmante: 'henry', ...conf, logo: m?.isotipo ? m.isotipo(46) : '', pagos: medios };
}

async function consecutivo(clase, fechaDoc) {
  const anio = String(fechaDoc || hoyCO()).slice(0, 4);
  const ref = doc(db, 'crm_consecutivos', `${clase}-${anio}`);
  const n = await runTransaction(db, async (tx) => { const s = await tx.get(ref); const n = (s.data()?.n || 0) + 1; tx.set(ref, { n, actualizado: serverTimestamp() }); return n; });
  return `${TIPOS[clase].prefijo}-${anio}-${String(n).padStart(4, '0')}`;
}

function tablaComerciales(docs, conCliente = true) {
  return `<div class="tabla"><table><tr><th>N.º</th><th>Fecha</th>${conCliente ? '<th>Cliente</th>' : ''}<th>Asunto</th><th style="text-align:right">Total</th><th>Estado</th></tr>
    ${docs.map((d) => `<tr class="fila" data-doc="${esc(d.id)}"><td><b>${esc(d.numero || 'borrador')}</b><br><small class="suave">${esc(TIPOS[claseDe(d)].corto)}</small></td><td>${esc(d.fecha)}</td>
      ${conCliente ? `<td>${esc(d.receptor?.nombre || '')}</td>` : ''}<td>${esc(d.titulo || '')}</td><td style="text-align:right;white-space:nowrap">${cop(totales(d).total)}</td>
      <td><span class="chip ${CHIP[d.estado] || 'pendiente'}">${esc(d.estado)}</span>${d.firma_emisor ? ' <span class="chip ok" title="Firma autorizada">✍</span>' : ''}</td></tr>`).join('')}</table></div>`;
}
const enlazarFilas = (el) => el.querySelectorAll('[data-doc]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'doc/' + tr.dataset.doc)));

async function vistaCotizador(filtro) {
  nav('cotizador');
  const [todos, catalogo, emisor] = await Promise.all([
    getDocs(query(collection(db, 'crm_documentos'), orderBy('fecha', 'desc'))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    getDocs(query(collection(db, 'crm_catalogo'), orderBy('nombre'))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    leerEmisor(),
  ]);
  const cots = todos.filter((d) => d.tipo === 'cotizacion'), facs = todos.filter((d) => d.tipo === 'factura');
  const suma = (l) => l.reduce((s, d) => s + totales(d).total, 0);
  const lista = filtro === 'factura' ? facs : cots;
  $app.innerHTML = `<div class="cab"><div><h1 class="titulo">Cotizador y cobros</h1><p class="bajada">Cotización → el cliente la acepta (o la firma) → cuenta de cobro o factura con tu firma y los QR de pago → pago registrado en contabilidad.</p></div>
    <a class="boton primario" href="#doc/nuevo">Nueva cotización</a></div>
    <div class="kpis">${kpi('En negociación (enviadas)', cop(suma(cots.filter((d) => d.estado === 'enviada'))), 'cian')}${kpi('Aceptadas sin cobrar', cop(suma(cots.filter((d) => d.estado === 'aceptada'))), 'ok')}
      ${kpi('Cobrado por recibir', cop(suma(facs.filter((d) => d.estado === 'emitida'))), 'warn')}${kpi('Cobrado y pagado', cop(suma(facs.filter((d) => d.estado === 'pagada'))))}</div>
    ${pestanas('cotizador', [['cotizacion', 'Cotizaciones', cots.length], ['factura', 'Cuentas de cobro y facturas', facs.length]], filtro === 'factura' ? 'factura' : 'cotizacion')}
    <div class="card" id="lista">${lista.length ? tablaComerciales(lista) : `<div class="vacio">${filtro === 'factura' ? 'Aún no hay cuentas de cobro. Se crean desde una cotización con «Convertir en cuenta de cobro».' : 'Aún no hay cotizaciones.'}</div>`}</div>
  <div class="cols">
    <div class="card"><h2>Catálogo</h2><p class="suave">Servicios y productos con precio de referencia. Al escribir la descripción de un ítem, el cotizador los sugiere.</p>
      <form id="fCat"><label>Tipo</label><select name="tipo"><option value="servicio">Servicio</option><option value="producto">Producto</option></select>
        <label>Nombre</label><input name="nombre" required><label>Unidad</label><input name="unidad" list="unidades" placeholder="unidad, hora, mes…"><datalist id="unidades"><option value="unidad"><option value="hora"><option value="mes"><option value="proyecto"><option value="gramo"></datalist>
        <label>Precio (COP)</label><input name="precio" type="number" min="0" step="1" required>
        <div class="acciones"><button class="primario">Agregar al catálogo</button></div></form></div>
    <div class="card"><h2>Ítems del catálogo (${catalogo.length})</h2>${catalogo.length ? `<div class="tabla"><table><tr><th>Ítem</th><th>Unidad</th><th style="text-align:right">Precio</th><th></th></tr>
      ${catalogo.map((x) => `<tr><td>${esc(x.nombre)}<br><small class="suave">${x.tipo === 'producto' ? 'Producto' : 'Servicio'}</small></td><td>${esc(x.unidad || '')}</td><td style="text-align:right">${cop(x.precio)}</td>
        <td><button class="mini peligro" data-quitar="${esc(x.id)}">Quitar</button></td></tr>`).join('')}</table></div>` : '<p class="suave">El catálogo está vacío.</p>'}
      <details style="margin-top:14px"><summary class="suave" style="cursor:pointer">Datos del emisor que salen en los documentos</summary>
        <form id="fEmisor"><div class="grid">${[['nombre', 'Nombre'], ['marca', 'Marca'], ['cedula', 'Cédula'], ['rut', 'RUT (NIT con DV)'], ['direccion', 'Dirección'], ['ciudad', 'Ciudad'], ['correo', 'Correo'], ['telefono', 'Teléfono'],
          ['banco', 'Banco / entidad'], ['tipo_cuenta', 'Tipo de cuenta'], ['cuenta', 'Número de cuenta'], ['titular', 'Titular'], ['plazo_pago', 'Plazo de pago (días hábiles)']].map(([k, l]) => `<div><label>${l}</label><input name="${k}" value="${esc(emisor[k] ?? '')}"></div>`).join('')}
          <div><label>Quién firma como emisor</label><select name="firmante">${opcionesEquipo(emisor.firmante, '')}</select></div></div>
          <label>Condiciones por defecto de las cotizaciones</label><textarea name="condiciones" class="texto">${esc(emisor.condiciones)}</textarea>
          <p class="suave">Los QR de pago de las cuentas de cobro se configuran en <a href="#pagos">Medios de pago</a>.</p>
          <div class="acciones"><button class="primario">Guardar datos del emisor</button></div></form><div id="mEmisor"></div></details></div></div>`;
  enlazarFilas(document.getElementById('lista'));
  document.getElementById('fCat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await addDoc(collection(db, 'crm_catalogo'), { ...f, precio: Number(f.precio) || 0, creado: serverTimestamp(), creado_por: ctx.usuario.email });
    await vistaCotizador(filtro);
  });
  $app.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Quitar este ítem del catálogo? Las cotizaciones que ya lo usan no cambian.')) return;
    await deleteDoc(doc(db, 'crm_catalogo', b.dataset.quitar));
    await vistaCotizador(filtro);
  }));
  document.getElementById('fEmisor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await setDoc(doc(db, 'crm_config', 'emisor'), { ...f, plazo_pago: Number(f.plazo_pago) || 5, actualizado: serverTimestamp(), actualizado_por: ctx.usuario.email });
    aviso(document.getElementById('mEmisor'), 'Datos guardados. Se usan en los documentos que exportes de aquí en adelante.', 'ok');
  });
}

const ID_FIRMA = { cotizacion: 'cotizacion', cuenta_cobro: 'cuenta', factura_venta: 'factura' };

async function vistaDocumento(id, clienteInicial) {
  nav('cotizador');
  const nuevo = id === 'nuevo';
  const previo = nuevo ? null : await getDoc(doc(db, 'crm_documentos', id));
  if (!nuevo && !previo.exists()) { $app.innerHTML = '<div class="card"><div class="aviso err">Documento no encontrado.</div></div>'; return; }
  const esCobro = previo?.data().tipo === 'factura';
  const [clientes, catalogo, emisor, CUENTAS_INGRESO] = await Promise.all([
    leerClientes(),
    // Ítems del cotizador + productos y servicios del catálogo público (CRM → Catálogo)
    Promise.all([getDocs(query(collection(db, 'crm_catalogo'), orderBy('nombre'))).then((s) => s.docs.map((d) => d.data())),
      import('./catalogo.js').then((m) => m.itemsParaCotizar()).catch(() => [])]).then(([a, b]) => [...a, ...b.filter((x) => !a.some((y) => y.nombre === x.nombre))]),
    leerEmisor({ pagos: esCobro }),
    libro().then((m) => m.CUENTAS_INGRESO).catch(() => CUENTAS_RESPALDO),
  ]);
  let d;
  if (nuevo) {
    const c = clientes.find((x) => x.id === clienteInicial);
    d = { tipo: 'cotizacion', estado: 'borrador', numero: '', fecha: hoyCO(), validez_dias: 15, cliente: c?.id || '', receptor: receptorDe(c), titulo: c?.proyecto || '',
      items: [{ tipo: 'servicio', descripcion: '', cantidad: 1, unidad: '', precio: 0, descuento: 0 }], iva: 0, notas: '', condiciones: emisor.condiciones };
  } else d = previo.data();
  const cotiz = d.tipo === 'cotizacion';
  const bloqueado = cotiz ? ['facturada'].includes(d.estado) : d.estado !== 'borrador';
  const clase = claseDe(d);
  const soyFirmante = !!ctx.perfil && ctx.perfil.id === (emisor.firmante || 'henry');
  const firmante = ctx.equipo.find((p) => p.id === (emisor.firmante || 'henry'));

  $app.innerHTML = `<p><a href="#cotizador/${cotiz ? 'cotizacion' : 'factura'}">← Cotizador</a>${d.cliente ? ` · <a href="#cliente/${encodeURIComponent(d.cliente)}">${esc(d.receptor?.nombre || 'Cliente')}</a>` : ''}</p>
  <div class="card"><div class="cab"><h2 style="margin:0">${esc(TIPOS[clase].corto)} ${esc(d.numero || (nuevo ? 'nueva' : 'borrador'))} <span class="chip ${CHIP[d.estado] || 'pendiente'}">${esc(d.estado)}</span>
      ${d.firma_emisor ? `<span class="chip ok" title="${esc(fmtFecha(d.firma_emisor.en, true))}">✍ firmada por ${esc(d.firma_emisor.nombre.split(' ')[0])}</span>` : ''}</h2>
    <div class="acciones" style="margin:0" id="acciones"></div></div><div id="mDoc"></div><div id="estadoFirma"></div>
    ${d.origen ? `<p class="suave" style="margin:6px 0 0">Viene de la cotización <a href="#doc/${esc(d.origen)}">${esc(d.origen_numero)}</a>.</p>` : ''}
    ${d.factura ? `<p class="suave" style="margin:6px 0 0">Cobrada con <a href="#doc/${esc(d.factura)}">${esc(d.factura_numero || 'la cuenta de cobro')}</a>.</p>` : ''}
    ${d.pago ? `<p class="suave" style="margin:6px 0 0">Pagada el ${esc(d.pago.fecha)}${d.pago.referencia ? ' · ' + esc(d.pago.referencia) : ''}${d.pago.recibido !== undefined ? ' · recibido ' + cop(d.pago.recibido) : ''} — registrada en <a href="#libro">contabilidad</a>.</p>` : ''}
    ${d.estado === 'anulada' && d.motivo_anulacion ? `<p class="suave" style="margin:6px 0 0">Anulada: ${esc(d.motivo_anulacion)}</p>` : ''}
    ${!cotiz && d.incluir_qr !== false && !(emisor.pagos || []).some((x) => (clase === 'cuenta_cobro' ? x.en_cobros : x.en_facturas)) ? '<p class="aviso warn">Este documento no lleva QR de pago: márcalos para este tipo de documento en <a href="#pagos">Medios de pago</a>.</p>' : ''}</div>
  <div class="editor"><form id="fDoc" class="card" autocomplete="off"><fieldset ${bloqueado ? 'disabled' : ''} style="border:0;padding:0;margin:0;min-width:0">
    <h3 style="margin-top:0">Cliente</h3>
    <select name="cliente"><option value="">— Cliente sin ficha en el CRM —</option>${clientes.map((c) => `<option value="${esc(c.id)}" ${c.id === d.cliente ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
    <div class="grid">${[['nombre', 'Nombre o razón social'], ['documento', 'NIT o C.C.'], ['correo', 'Correo'], ['telefono', 'Teléfono'], ['direccion', 'Ciudad y dirección']]
      .map(([k, l]) => `<div><label>${l}</label><input name="r_${k}" value="${esc(d.receptor?.[k] ?? '')}"></div>`).join('')}</div>
    <h3>Documento</h3>
    <label>${cotiz ? 'Proyecto o asunto' : 'Concepto'}</label><input name="titulo" value="${esc(d.titulo || '')}">
    <div class="grid"><div><label>Fecha</label><input name="fecha" type="date" value="${esc(d.fecha)}" required></div>
      ${cotiz ? `<div><label>Validez (días)</label><input name="validez_dias" type="number" min="1" value="${esc(d.validez_dias ?? 15)}"></div>`
        : `<div><label>Vence</label><input name="vence" type="date" value="${esc(d.vence || '')}"></div>
           <div><label>Emitir como</label><select name="modalidad"><option value="cuenta_cobro" ${clase === 'cuenta_cobro' ? 'selected' : ''}>Cuenta de cobro (no responsable de IVA)</option><option value="factura_venta" ${clase === 'factura_venta' ? 'selected' : ''}>Factura de venta</option></select></div>
           <div><label>Cuenta contable del ingreso</label><input name="cuenta_contable" list="ctasIng" value="${esc(d.cuenta_contable || CUENTAS_INGRESO[0])}"><datalist id="ctasIng">${CUENTAS_INGRESO.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>`}
      ${cotiz ? '' : `<div style="align-self:end"><label style="display:flex;gap:8px;align-items:center;font-weight:500;margin-bottom:9px"><input type="checkbox" name="incluir_qr" ${d.incluir_qr === false ? '' : 'checked'}> Incluir QR de pago (Bancolombia, Nequi)</label></div>`}
      <div><label>IVA</label><select name="iva"><option value="0">No causa</option><option value="19" ${Number(d.iva) === 19 ? 'selected' : ''}>19 %</option></select></div></div>
    <div id="dian" class="grid ${clase === 'factura_venta' ? '' : 'oculto'}"><div><label>N.º factura electrónica DIAN</label><input name="dian_numero" value="${esc(d.dian?.numero || '')}"></div><div><label>CUFE (opcional)</label><input name="dian_cufe" value="${esc(d.dian?.cufe || '')}"></div></div>
    <label>Introducción (opcional)</label><textarea name="notas" class="texto">${esc(d.notas || '')}</textarea>
    <h3>Ítems</h3>
    <div style="overflow-x:auto"><table class="items"><thead><tr><th style="width:96px">Tipo</th><th>Descripción</th><th style="width:64px">Cant.</th><th style="width:76px">Unidad</th><th style="width:110px">Valor unit.</th><th style="width:58px">Dto. %</th><th style="width:100px;text-align:right">Total</th><th></th></tr></thead><tbody id="items"></tbody></table></div>
    <datalist id="catalogo">${catalogo.map((x) => `<option value="${esc(x.nombre)}">${cop(x.precio)}${x.unidad ? ' / ' + esc(x.unidad) : ''}</option>`).join('')}</datalist>
    <div class="acciones"><button type="button" class="mini" id="masItem">+ Agregar ítem</button></div>
    <div id="totales" class="totales"></div>
    <label>${cotiz ? 'Condiciones' : 'Observaciones'}</label><textarea name="condiciones" class="texto">${esc(d.condiciones || '')}</textarea>
  </fieldset></form>
  <div class="card vista"><div class="cab" style="margin:0 0 8px"><b>Vista previa</b><small class="suave">Así sale el PDF</small></div><iframe id="vista" title="Vista previa del documento"></iframe></div></div>`;

  const $f = document.getElementById('fDoc'), $items = document.getElementById('items'), $vista = document.getElementById('vista'), m = document.getElementById('mDoc');
  const fila = (it) => `<tr><td><select data-k="tipo"><option value="servicio">Servicio</option><option value="producto" ${it.tipo === 'producto' ? 'selected' : ''}>Producto</option></select></td>
    <td><input data-k="descripcion" list="catalogo" value="${esc(it.descripcion)}" placeholder="Descripción"></td><td><input data-k="cantidad" type="number" min="0" step="any" value="${esc(it.cantidad)}"></td>
    <td><input data-k="unidad" value="${esc(it.unidad || '')}"></td><td><input data-k="precio" type="number" min="0" step="1" value="${esc(it.precio)}"></td>
    <td><input data-k="descuento" type="number" min="0" max="100" step="any" value="${esc(it.descuento || 0)}"></td><td class="tot" style="text-align:right;white-space:nowrap"></td>
    <td>${bloqueado ? '' : '<button type="button" class="mini peligro" data-menos title="Quitar ítem">×</button>'}</td></tr>`;
  const pintarItems = () => { $items.innerHTML = d.items.map(fila).join(''); };

  // Lee el formulario sobre d (los campos de cabecera y cada fila de ítems).
  const leer = () => {
    const f = Object.fromEntries(new FormData($f));
    if (bloqueado) return;
    d.cliente = f.cliente; d.titulo = f.titulo; d.fecha = f.fecha; d.iva = Number(f.iva) || 0; d.notas = f.notas; d.condiciones = f.condiciones;
    d.receptor = Object.fromEntries(['nombre', 'documento', 'correo', 'telefono', 'direccion'].map((k) => [k, (f['r_' + k] || '').trim()]));
    if (cotiz) d.validez_dias = Number(f.validez_dias) || 15;
    else { d.incluir_qr = !!f.incluir_qr; d.vence = f.vence; d.modalidad = f.modalidad; d.cuenta_contable = f.cuenta_contable; d.dian = { numero: f.dian_numero || '', cufe: f.dian_cufe || '' }; }
    d.items = [...$items.rows].map((tr) => {
      const v = Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((x) => [x.dataset.k, x.value]));
      return { tipo: v.tipo, descripcion: v.descripcion.trim(), cantidad: Number(v.cantidad) || 0, unidad: v.unidad.trim(), precio: Number(v.precio) || 0, descuento: Number(v.descuento) || 0 };
    });
  };
  let espera = 0;
  const refrescar = () => {
    const t = totales(d);
    [...$items.rows].forEach((tr, i) => { tr.querySelector('.tot').textContent = cop(t.filas[i]?.neto); });
    document.getElementById('totales').innerHTML = `<div><span>Subtotal</span><b>${cop(t.subtotal)}</b></div>${t.descuentos ? `<div><span>Descuentos</span><b>− ${cop(t.descuentos)}</b></div>` : ''}
      <div><span>IVA</span><b>${d.iva ? cop(t.iva) : 'No causa'}</b></div><div class="gran"><span>Total</span><b>${cop(t.total)}</b></div>`;
    clearTimeout(espera);
    espera = setTimeout(() => {
      const w = $vista.contentWindow, y = w?.scrollY || 0;
      $vista.srcdoc = htmlDocumento(d, emisor);
      $vista.onload = () => $vista.contentWindow.scrollTo(0, y);
    }, 250);
  };
  pintarItems(); refrescar();

  $f.addEventListener('input', (e) => {
    leer();
    if (e.target.name === 'modalidad') document.getElementById('dian').classList.toggle('oculto', e.target.value !== 'factura_venta');
    // Elegir un ítem del catálogo llena tipo, unidad y precio si aún no tiene precio.
    if (e.target.dataset?.k === 'descripcion') {
      const x = catalogo.find((c) => c.nombre === e.target.value), tr = e.target.closest('tr');
      if (x && !Number(tr.querySelector('[data-k=precio]').value)) {
        tr.querySelector('[data-k=precio]').value = x.precio; tr.querySelector('[data-k=unidad]').value = x.unidad || ''; tr.querySelector('[data-k=tipo]').value = x.tipo || 'servicio';
        leer();
      }
    }
    refrescar();
  });
  $f.querySelector('[name=cliente]').addEventListener('change', (e) => {
    const c = clientes.find((x) => x.id === e.target.value);
    if (!c) return;
    for (const [k, v] of Object.entries(receptorDe(c))) $f.querySelector(`[name=r_${k}]`).value = v;
    if (!$f.titulo.value) $f.titulo.value = c.proyecto || '';
    leer(); refrescar();
  });
  document.getElementById('masItem').addEventListener('click', () => { leer(); d.items.push({ tipo: 'servicio', descripcion: '', cantidad: 1, unidad: '', precio: 0, descuento: 0 }); pintarItems(); refrescar(); });
  $items.addEventListener('click', (e) => {
    if (!e.target.matches('[data-menos]')) return;
    leer(); d.items.splice(e.target.closest('tr').rowIndex - 1, 1); pintarItems(); refrescar();
  });

  // ── acciones ──
  const ref = nuevo ? null : doc(db, 'crm_documentos', id);
  const validar = () => {
    if (!d.receptor.nombre) throw new Error('Escribe el nombre del cliente.');
    d.items = d.items.filter((it) => it.descripcion || it.precio);
    if (!d.items.length) throw new Error('Agrega al menos un ítem.');
    if (d.items.some((it) => !it.descripcion)) throw new Error('Hay ítems sin descripción.');
  };
  const datos = () => ({ ...d, total: totales(d).total, ...sello() });
  const guardar = async () => {
    leer(); validar();
    if (nuevo) {
      const numero = await consecutivo('cotizacion', d.fecha);
      const nRef = await addDoc(collection(db, 'crm_documentos'), { ...datos(), numero, ...sello(true) });
      location.hash = 'doc/' + nRef.id;
      return null;
    }
    await setDoc(ref, datos(), { merge: true });
    return ref;
  };
  const accion = (fn) => async () => {
    try { await fn(); } catch (e) { console.error(e); aviso(m, esc(e.message || e.code), 'err'); }
  };
  const exportar = async () => {
    if (!bloqueado && (await guardar()) === null) return;
    aviso(m, 'Generando PDF…');
    await cargarLibs();
    const pdf = await htmlAPdf(htmlDocumento(d, emisor, { pdf: true }));
    const nombre = `${d.numero || 'borrador'}-${slug(d.receptor?.nombre || 'cliente')}.pdf`;
    descargar(pdf, nombre, 'application/pdf');
    // Copia en Docs (y en el expediente del cliente): solo de documentos numerados y si cambió.
    if (!d.numero) return aviso(m, 'PDF descargado. Es un borrador: no se guarda en Docs hasta emitirlo.', 'info');
    const sha = await sha256Bytes(pdf);
    if (sha === d.pdf_sha256) return aviso(m, 'PDF descargado. Ya estaba guardado en Docs.', 'ok');
    const carpeta = { cotizacion: 'cotizaciones', cuenta_cobro: 'cuentas_cobro', factura_venta: 'facturas' }[clase];
    await guardarAdjunto(d.cliente, { nombre, tipo: clase, carpeta, mime: 'application/pdf', bytes: pdf, sha256: sha });
    await updateDoc(ref, { pdf_sha256: sha, pdf_en: serverTimestamp() });
    d.pdf_sha256 = sha;
    aviso(m, `PDF descargado y guardado en <a href="#docs/${carpeta}">Docs</a>${d.cliente ? ' y en el expediente del cliente' : ''}.`, 'ok');
  };
  // Firma autorizada: copia en el documento la firma preestablecida de quien firma como emisor.
  const autorizarFirma = async () => {
    const f = firmaAutorizada();
    if (!f) throw new Error('Aún no tienes firma preestablecida: configúrala en Equipo → tu perfil.');
    if (!bloqueado) leer();
    d.firma_emisor = f;
    await setDoc(ref, { ...(bloqueado ? {} : datos()), firma_emisor: f, ...sello() }, { merge: true });
  };
  const enviarAFirmar = async () => {
    if (!d.numero) throw new Error('Guarda el documento antes de enviarlo a firmar.');
    if (!d.cliente) throw new Error('Asocia el documento a un cliente del CRM (selector «Cliente») para guardar la firma en su expediente.');
    if (!bloqueado) await guardar();
    const idDoc = ID_FIRMA[clase];
    const html = htmlDocumento(d, emisor, { paraFirma: true });
    const titulo = `${TIPOS[clase].corto} ${d.numero}${d.titulo ? ' — ' + d.titulo : ''}`;
    const cliente = { rol: 'cliente', nombre: d.receptor.nombre, docs: [idDoc], firma: 'firma_c', cedula: 'c_cedula', prefill: { c_cedula: d.receptor.documento || '' },
      campos: [{ k: 'c_cedula', label: 'Tu cédula o NIT', req: true, valor: d.receptor.documento || '' }] };
    const firmantes = d.firma_emisor ? [cliente] : [{ rol: 'contratista', nombre: emisor.nombre, docs: [idDoc], firma: 'firma_h', auto: true }, cliente];
    const horas = Number(prompt('¿Cuántas horas tendrá el cliente para firmar?', '72'));
    if (!horas) return;
    const { sid, enlaces } = await crearSolicitudFirma({ cliente: d.cliente, titulo, horas, docs: [{ id: idDoc, titulo, html }], firmantes, documento_id: id });
    await marcarEnviado(id, sid, d.cliente);
    if (cotiz && d.estado === 'borrador') await updateDoc(ref, { estado: 'enviada', ...sello() });
    const c = clientes.find((x) => x.id === d.cliente) || {};
    mostrarEnlaces({ titulo, enlaces, telefono: d.receptor.telefono || c.telefono, correo: d.receptor.correo || c.correo, alCerrar: () => vistaDocumento(id) });
  };
  const $acc = document.getElementById('acciones');
  const boton = (txt, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.className = 'mini ' + cls; b.addEventListener('click', accion(fn)); $acc.append(b); return b; };

  if (!bloqueado) boton(nuevo ? 'Guardar cotización' : 'Guardar', async () => { if (await guardar()) await vistaDocumento(id); }, 'primario');
  if (!nuevo) boton('Exportar PDF', exportar);
  if (!nuevo && d.estado !== 'anulada') {
    if (!d.firma_emisor) {
      const b = boton('✍ Autorizar firma', async () => {
        if (!confirm(`Se agregará tu firma preestablecida a ${TIPOS[clase].corto.toLowerCase()} ${d.numero || ''}. ¿Autorizas?`)) return;
        await autorizarFirma(); await vistaDocumento(id);
      });
      if (!soyFirmante) { b.disabled = true; b.title = `Solo ${firmante?.nombre_corto || 'el emisor'} puede autorizar su firma.`; }
    } else if (!bloqueado && soyFirmante) boton('Quitar firma', async () => { d.firma_emisor = null; await setDoc(ref, { firma_emisor: null, ...sello() }, { merge: true }); await vistaDocumento(id); });
    if (d.numero && !['pagada', 'rechazada'].includes(d.estado)) boton('Enviar a firmar', enviarAFirmar);
  }
  if (cotiz && !nuevo && !bloqueado) {
    const sel = document.createElement('select'); sel.style.width = 'auto'; sel.className = 'mini';
    sel.innerHTML = ESTADOS_COT.map((x) => `<option ${x === d.estado ? 'selected' : ''}>${x}</option>`).join('');
    sel.addEventListener('change', accion(async () => { await updateDoc(ref, { estado: sel.value, ...sello() }); await vistaDocumento(id); }));
    $acc.append(sel);
    if (d.estado === 'aceptada' && d.cliente) boton('Generar contrato', async () => { location.hash = `contrato/contrato-prestacion-servicios+anexo-alcance-software+plan-de-pago/${encodeURIComponent(d.cliente)}/${id}`; });
    if (d.estado !== 'rechazada') boton(Number(d.iva) ? 'Convertir en factura' : 'Convertir en cuenta de cobro', async () => {
      await guardar();
      const f = { ...d, tipo: 'factura', modalidad: Number(d.iva) ? 'factura_venta' : 'cuenta_cobro', estado: 'borrador', numero: '', fecha: hoyCO(), vence: sumarDias(hoyCO(), 15),
        cuenta_contable: CUENTAS_INGRESO[0], condiciones: '', incluir_qr: true, origen: id, origen_numero: d.numero, dian: { numero: '', cufe: '' }, total: totales(d).total, firma_emisor: null, ...sello(true) };
      delete f.validez_dias; delete f.pdf_sha256; delete f.pdf_en; delete f.firma_solicitud;
      const fRef = await addDoc(collection(db, 'crm_documentos'), f);
      await updateDoc(ref, { estado: 'facturada', factura: fRef.id, ...sello() });
      location.hash = 'doc/' + fRef.id;
    }, 'primario');
  }
  if (!cotiz && d.estado === 'borrador') boton('Emitir', async () => {
    leer(); validar();
    const firmar = soyFirmante && !d.firma_emisor && !!firmaAutorizada();
    if (!confirm(`¿Emitir esta ${TIPOS[claseDe(d)].corto.toLowerCase()}? Recibe su consecutivo y ya no se podrá editar (solo anular).${firmar ? '\n\nSe emite con tu firma autorizada.' : ''}`)) return;
    await setDoc(ref, datos(), { merge: true });
    const numero = await consecutivo(claseDe(d), d.fecha);
    await updateDoc(ref, { numero, estado: 'emitida', emitida_en: serverTimestamp(), ...(firmar ? { firma_emisor: firmaAutorizada() } : {}) });
    if (d.origen) await updateDoc(doc(db, 'crm_documentos', d.origen), { factura_numero: numero });
    await vistaDocumento(id);
  }, 'primario');
  if (!cotiz && d.estado === 'emitida') boton('Registrar pago', async () => {
    const L = await libro();
    const pago = await L.dialogoPago({ titulo: `Pago de ${TIPOS[claseDe(d)].corto.toLowerCase()} ${d.numero}`, total: totales(d).total, tercero: d.receptor?.nombre || '' });
    if (!pago) return;
    const reg = await L.registrarIngresoDocumento(id, d, pago);
    const { archivo, ...guardable } = reg || pago;
    await updateDoc(ref, { estado: 'pagada', pago: JSON.parse(JSON.stringify({ ...guardable, registrado_por: ctx.usuario.email })), ...sello() });
    await vistaDocumento(id);
  }, 'primario');
  if (!cotiz && d.estado === 'pagada') boton('Deshacer pago', async () => {
    if (!confirm('¿Volver a dejar este cobro pendiente? El ingreso del libro contable quedará anulado.')) return;
    await (await libro()).anularAsiento('factura-' + id, 'Pago deshecho');
    await updateDoc(ref, { estado: 'emitida', pago: null, ...sello() });
    await vistaDocumento(id);
  });
  if (!cotiz && ['borrador', 'emitida'].includes(d.estado)) boton('Anular', async () => {
    const motivo = prompt('Motivo de la anulación:');
    if (!motivo) return;
    await updateDoc(ref, { estado: 'anulada', motivo_anulacion: motivo, anulada_en: serverTimestamp(), ...sello() });
    // La cotización de origen vuelve a quedar aceptada para poder cobrarla de nuevo.
    if (d.origen) await updateDoc(doc(db, 'crm_documentos', d.origen), { estado: 'aceptada', factura: '', factura_numero: '', ...sello() });
    await vistaDocumento(id);
  }, 'peligro');

  // Estado de la firma del cliente; una cotización enviada que el cliente firmó queda aceptada.
  if (d.firma_solicitud?.sid) {
    const sRef = doc(db, 'crm_clientes', d.firma_solicitud.cliente, 'solicitudes', d.firma_solicitud.sid);
    getDoc(sRef).then(async (s) => {
      if (!s.exists()) return;
      const e = await estadoSolicitud(s.data());
      document.getElementById('estadoFirma').innerHTML = `<p class="aviso ${e.todos ? 'ok' : 'info'}">Firma del cliente: <b>${e.todos ? 'firmado ✔' : e.general}</b> · <a href="#cliente/${encodeURIComponent(d.firma_solicitud.cliente)}">ver en el expediente</a>${e.todos && !s.data().ensamblada ? ' (arma ahí el PDF firmado)' : ''}</p>`;
      if (e.todos && cotiz && d.estado === 'enviada') { await updateDoc(ref, { estado: 'aceptada', aceptada_por_firma: true, ...sello() }); await vistaDocumento(id); }
    }).catch(console.error);
  }
}
const receptorDe = (c) => ({ nombre: c?.nombre || '', documento: c?.documento || '', correo: c?.correo || '', telefono: c?.telefono || '', direccion: c?.direccion || '' });

// ───────── importar expediente (.json preparado fuera del sitio, p. ej. con crm-expediente.mjs) ─────────
function vistaImportar() {
  nav('importar');
  $app.innerHTML = `<div class="card" style="max-width:640px"><h2>Importar expediente</h2>
    <p class="suave">Carga un archivo <code>.json</code> con el esquema <code>cdhmaker.crm.importacion.v1</code>: cliente, cuotas, solicitudes de firma y archivos adjuntos (en base64). Si el cliente ya existe, se actualizan sus datos y se agregan los archivos.</p>
    <input type="file" id="fImp" accept=".json,application/json"><div class="acciones"><button class="primario" id="imp">Importar</button></div><div id="mImp"></div></div>`;
  document.getElementById('imp').addEventListener('click', async () => {
    const m = document.getElementById('mImp');
    try {
      const file = document.getElementById('fImp').files[0];
      if (!file) return aviso(m, 'Elige el archivo.', 'err');
      const x = JSON.parse(await file.text());
      if (x.esquema !== 'cdhmaker.crm.importacion.v1') throw new Error('Esquema no reconocido');
      const id = x.id || slug(x.cliente.nombre);
      aviso(m, 'Guardando cliente…');
      await setDoc(doc(db, 'crm_clientes', id), { ...x.cliente, actualizado: serverTimestamp(), actualizado_por: ctx.usuario.email, ...(x.nuevo ? { creado: serverTimestamp() } : {}) }, { merge: true });
      for (const s of x.solicitudes || []) await setDoc(doc(db, 'crm_clientes', id, 'solicitudes', s.id), { ...s, creado: Timestamp.fromDate(new Date(s.creado || Date.now())) }, { merge: true });
      const previos = new Set((await getDocs(collection(db, 'crm_clientes', id, 'archivos'))).docs.map((d) => d.data().sha256));
      for (const a of x.archivos || []) {
        if (previos.has(a.sha256)) continue;
        aviso(m, 'Subiendo ' + esc(a.nombre) + '…');
        await guardarAdjunto(id, { ...a, carpeta: carpetaDe(a), bytes: deB64(a.base64) });
      }
      location.hash = 'cliente/' + encodeURIComponent(id);
    } catch (e) { console.error(e); aviso(m, 'No se pudo importar: ' + esc(e.message), 'err'); }
  });
}

// ───────── arranque ─────────
marca().then((m) => { if (m?.isotipo) document.getElementById('marcaCrm').insertAdjacentHTML('afterbegin', m.isotipo(38)); });
await completarEnlace();
onAuthStateChanged(auth, async (u) => {
  if (!u) { ctx.usuario = null; return pantallaAcceso(); }
  if (!ADMINS.includes((u.email || '').toLowerCase())) { await signOut(auth); return pantallaAcceso('<div class="aviso err">Esta cuenta no tiene acceso al CRM.</div>'); }
  ctx.usuario = u;
  try { await cargarEquipo(); } catch (e) { console.error(e); }
  enrutar();
});
window.addEventListener('hashchange', enrutar);
