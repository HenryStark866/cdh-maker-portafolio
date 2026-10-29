// Firmas: solicitudes de firma con enlaces temporales (enlaces/{token} → /firmar#token), en un solo lugar
// para todos los clientes. CDH Maker firma su parte sola con la firma preestablecida de quien envía
// (Equipo → Firma): el enlace del proveedor se crea y se firma en el mismo paso, con hora del servidor y
// huella del documento, igual que si lo hubiera firmado desde /firmar.
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, ctx, $app, esc, aviso, fmtFecha, fecha, slug, token, nav, pestanas, kpi, guardarAdjunto } from './comun.js';
import { ensamblar } from './ensamblar.js?v=4';
import { sha256Hex } from './rellenar.js';
import { firmaAutorizada } from './equipo.js';

// Proyecto de firma anterior (enlaces creados con firmas/crear.mjs): lectura pública por token.
const FIRMAS_LEGADO = { api: 'AIzaSyCeHUBzJpRbaSHHnvR7vwSUKyXqO0e1JGk', base: 'https://firestore.googleapis.com/v1/projects/cdhmaker-firmas/databases/(default)/documents/firmas/' };

export async function leerEnlace(s, e) {
  if (s.sistema === 'cdhmaker-firmas') {
    const r = await fetch(FIRMAS_LEGADO.base + e.token + '?key=' + FIRMAS_LEGADO.api);
    if (!r.ok) return null;
    const dec = (v) => 'stringValue' in v ? v.stringValue : 'timestampValue' in v ? v.timestampValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec)
      : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : 'integerValue' in v ? Number(v.integerValue) : 'booleanValue' in v ? v.booleanValue : null;
    return Object.fromEntries(Object.entries((await r.json()).fields).map(([k, x]) => [k, dec(x)]));
  }
  const d = await getDoc(doc(db, 'enlaces', e.token));
  return d.exists() ? d.data() : null;
}
export const estadoEnlace = (X) => !X ? 'no encontrado' : X.estado === 'pendiente' && fecha(X.expira) < new Date() ? 'vencido' : X.estado;

// Crea la solicitud y un enlace por firmante. Los firmantes con auto:true (CDH Maker) quedan firmados con
// la firma preestablecida de la sesión. Devuelve { sid, enlaces } con los enlaces que hay que enviar.
export async function crearSolicitudFirma({ cliente, titulo, horas = 72, docs, firmantes, nota = '', documento_id = '' }) {
  if (!cliente) throw new Error('La solicitud necesita un cliente del CRM.');
  if (!docs?.length) throw new Error('No hay documentos para firmar.');
  for (const x of docs) if (!/^[a-z]{2,20}$/.test(x.id)) throw new Error(`Id de documento no válido: «${x.id}» (solo letras minúsculas).`);
  for (const f of firmantes) for (const id of f.docs) if (!docs.some((x) => x.id === id)) throw new Error(`El firmante ${f.nombre} tiene un documento que no existe: ${id}`);
  const firma = firmantes.some((f) => f.auto) ? firmaAutorizada() : null;
  if (firmantes.some((f) => f.auto) && !firma) throw new Error('Autoriza tu firma antes de enviar: Equipo → tu perfil → Firma preestablecida.');
  horas = Math.max(1, Math.min(720, Number(horas) || 72));
  const expira = Timestamp.fromMillis(Date.now() + horas * 3600e3);
  const sid = slug(titulo).slice(0, 50) + '-' + new Date().toISOString().slice(0, 10) + '-' + token().slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  const lote = writeBatch(db), enlaces = [], autos = [];
  for (const f of firmantes) {
    const t = token();
    lote.set(doc(db, 'enlaces', t), { estado: 'pendiente', solicitud: sid, cliente, rol: f.rol, nombre: f.nombre, expira, creado: serverTimestamp(), prefill: JSON.parse(JSON.stringify(f.prefill || {})), campos: JSON.parse(JSON.stringify(f.campos || [])),
      docs: f.docs.map((id) => { const x = docs.find((y) => y.id === id); return { id, titulo: x.titulo, html: x.html }; }) });
    const e = { rol: f.rol, nombre: f.nombre, token: t, url: location.origin + '/firmar#' + t, expira: expira.toDate().toISOString(), ...(f.auto ? { auto: true } : {}) };
    enlaces.push(e);
    if (f.auto) autos.push({ t, f });
  }
  lote.set(doc(db, 'crm_clientes', cliente, 'solicitudes', sid), { id: sid, titulo, horas, sistema: 'crm', nota, documento_id, firmantes: JSON.parse(JSON.stringify(firmantes)), enlaces,
    plantillas: Object.fromEntries(docs.map((x) => [x.id, { titulo: x.titulo }])), creado: serverTimestamp(), creado_por: ctx.usuario.email });
  await lote.commit();
  // Firma automática de CDH Maker (mismas reglas que /firmar: hora del servidor y huella de cada documento).
  for (const { t, f } of autos) {
    const hashDoc = [];
    for (const id of f.docs) hashDoc.push(id + ':' + await sha256Hex(docs.find((x) => x.id === id).html));
    await updateDoc(doc(db, 'enlaces', t), { estado: 'firmado', datos: {}, firma: firma.imagen, firmadoEn: serverTimestamp(), ua: ('CRM · autorizada por ' + ctx.usuario.email + ' · ' + navigator.userAgent).slice(0, 300),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', hashDoc });
  }
  return { sid, enlaces: enlaces.filter((e) => !e.auto) };
}

// Botones para hacer llegar un enlace: copiar, WhatsApp y correo. Solo abren la app; no envían nada solos.
export function botonesEnvio(e, { telefono = '', correo = '', titulo = '' } = {}) {
  const msg = `Hola ${e.nombre.split(' ')[0]}, te comparto el enlace para firmar electrónicamente «${titulo}» de CDH Maker. Es personal y vence el ${fmtFecha(e.expira, true)}:\n${e.url}`;
  const tel = String(telefono).replace(/\D/g, '');
  return `<button type="button" class="mini" data-copiar="${esc(e.url)}">Copiar enlace</button>
    <a class="boton" style="padding:3px 10px;font-size:12px" target="_blank" rel="noopener" href="https://wa.me/${tel.length === 10 ? '57' + tel : tel}?text=${encodeURIComponent(msg)}">WhatsApp</a>
    <a class="boton" style="padding:3px 10px;font-size:12px" href="mailto:${esc(correo)}?subject=${encodeURIComponent('Documento para firmar — ' + titulo)}&body=${encodeURIComponent(msg)}">Correo</a>`;
}
export const enlazarCopiar = (el) => el.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiado ✔'; }));

// Muestra en un diálogo los enlaces recién creados, listos para enviar.
export function mostrarEnlaces({ titulo, enlaces, telefono, correo, alCerrar }) {
  const dlg = document.createElement('dialog'); dlg.className = 'modal';
  dlg.innerHTML = `<h2>Listo para firmar ✔</h2><p class="suave">CDH Maker ya firmó su parte con tu firma autorizada. Envía ${enlaces.length > 1 ? 'cada enlace a su firmante' : 'este enlace'}:</p>
    ${enlaces.map((e) => `<div class="sol"><b>${esc(e.nombre)}</b> <small class="suave">${esc(e.rol)} · vence ${fmtFecha(e.expira, true)}</small><div class="acciones">${botonesEnvio(e, { telefono, correo, titulo })}</div></div>`).join('')}
    <div class="acciones"><span style="flex:1"></span><button type="button" class="primario" data-cerrar>Cerrar</button></div>`;
  document.body.append(dlg); dlg.showModal(); enlazarCopiar(dlg);
  const cerrar = () => { dlg.close(); dlg.remove(); alCerrar?.(); };
  dlg.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  dlg.addEventListener('cancel', cerrar);
}

// Estado de una solicitud a partir de sus enlaces (lee cada enlace).
export async function estadoSolicitud(s) {
  const enlaces = await Promise.all((s.enlaces || []).map((e) => leerEnlace(s, e).catch(() => null)));
  const estados = enlaces.map(estadoEnlace);
  const todos = estados.length > 0 && estados.every((x) => x === 'firmado');
  const general = s.anulada ? 'anulada' : todos ? 'firmada' : estados.some((x) => x === 'vencido') && !estados.some((x) => x === 'pendiente') ? 'vencida' : estados.some((x) => x === 'firmado') ? 'parcial' : 'pendiente';
  return { enlaces, estados, todos, general };
}
const CHIP_SOL = { anulada: ['anulada', 'anulada'], firmada: ['firmada', 'firmada'], vencida: ['vencido', 'vencida'], parcial: ['parcial', 'firma parcial'], pendiente: ['pendiente', 'pendiente'] };

// Tarjeta de una solicitud con sus firmantes y acciones (armar PDF firmados, anular, enviar enlaces).
export async function tarjetaSolicitud(cliente, c, ref, s, alCambiar) {
  const { enlaces, estados, todos, general } = await estadoSolicitud(s);
  const div = document.createElement('div'); div.className = 'sol';
  div.innerHTML = `<div class="cab"><b>${esc(s.titulo)}</b><span class="chip ${CHIP_SOL[general][0]}">${CHIP_SOL[general][1]}</span></div>
    <small class="suave">${c ? `<a href="#cliente/${encodeURIComponent(cliente)}">${esc(c.nombre)}</a> · ` : ''}${esc(s.sistema === 'cdhmaker-firmas' ? 'cdhmaker-firmas.web.app' : 'cdhmaker.com/firmar')} · creada ${fmtFecha(s.creado, true)}${s.nota ? ' · ' + esc(s.nota) : ''}${s.ensamblada ? ' · PDF armados ' + fmtFecha(s.ensamblada) : ''}</small>
    <div class="tabla"><table><tr><th>Firmante</th><th>Estado</th><th>Firmó / vence</th><th></th></tr>${(s.enlaces || []).map((e, i) => `<tr><td>${esc(e.nombre)}<br><small class="suave">${esc(e.rol)}${e.auto ? ' · firma autorizada' : ''}</small></td>
      <td><span class="chip ${esc(estados[i])}">${esc(estados[i])}</span></td><td>${estados[i] === 'firmado' ? fmtFecha(enlaces[i].firmadoEn, true) : 'vence ' + fmtFecha(e.expira, true)}</td>
      <td style="white-space:nowrap">${estados[i] === 'pendiente' ? botonesEnvio(e, { telefono: c?.telefono, correo: c?.correo, titulo: s.titulo }) : ''}</td></tr>`).join('')}</table></div>
    <div class="acciones">${s.sistema !== 'cdhmaker-firmas' && estados.some((x) => x === 'firmado') && !(s.enlaces || []).every((e, i) => e.auto || estados[i] !== 'firmado') ? `<button class="mini primario" data-ensamblar>${s.ensamblada ? 'Volver a armar' : 'Armar PDF firmados'}</button>` : ''}
      ${s.documento_id ? `<a class="boton" style="padding:3px 10px;font-size:12px" href="#doc/${esc(s.documento_id)}">Ver documento</a>` : ''}
      ${s.sistema !== 'cdhmaker-firmas' && !todos && !s.anulada ? '<button class="mini peligro" data-anular>Anular pendientes</button>' : ''}</div><div class="m"></div>`;
  enlazarCopiar(div);
  div.querySelector('[data-ensamblar]')?.addEventListener('click', async () => {
    const m = div.querySelector('.m');
    try {
      const { archivos, faltan } = await ensamblar({ cliente: { id: cliente, ...c }, solicitud: s, enlaces, alAvanzar: (t) => aviso(m, esc(t)) });
      const previos = new Set((await getDocs(collection(db, 'crm_clientes', cliente, 'archivos'))).docs.map((d) => d.data().sha256));
      for (const a of archivos) { if (previos.has(a.sha256)) continue; aviso(m, 'Guardando ' + esc(a.nombre) + '…'); await guardarAdjunto(cliente, { ...a, carpeta: a.tipo === 'firma' || a.tipo === 'registro' ? 'firmas' : undefined }); }
      await updateDoc(ref, { ensamblada: serverTimestamp(), pendientes: faltan.map((x) => x.id) });
      alCambiar?.();
    } catch (e) { console.error(e); aviso(m, 'No se pudo armar: ' + esc(e.message), 'err'); }
  });
  div.querySelector('[data-anular]')?.addEventListener('click', async () => {
    if (!confirm('¿Anular los enlaces que aún no se han firmado?')) return;
    for (const [i, e] of (s.enlaces || []).entries()) if (estados[i] === 'pendiente') await updateDoc(doc(db, 'enlaces', e.token), { estado: 'anulado', anuladoEn: serverTimestamp() });
    await updateDoc(ref, { anulada: true });
    alCambiar?.();
  });
  return { div, general };
}

// Solicitudes de un cliente (ficha del cliente).
export async function pintarSolicitudes(el, cliente, c, alCambiar) {
  const snap = await getDocs(query(collection(db, 'crm_clientes', cliente, 'solicitudes'), orderBy('creado', 'desc')));
  if (!snap.size) { el.innerHTML = '<p class="suave">Sin solicitudes de firma.</p>'; return; }
  el.innerHTML = '';
  for (const d of snap.docs) el.append((await tarjetaSolicitud(cliente, c, d.ref, d.data(), alCambiar)).div);
}

// ───────── vista Firmas: todas las solicitudes y cómo enviar algo a firmar ─────────
export async function vistaFirmas([filtro = 'pendientes'] = []) {
  nav('firmas');
  if (filtro === 'avanzado') return vistaAvanzada();
  const [sols, clientes, docs] = await Promise.all([
    getDocs(collectionGroup(db, 'solicitudes')).then((s) => s.docs.map((d) => ({ ref: d.ref, cliente: d.ref.parent.parent.id, s: d.data() }))),
    getDocs(collection(db, 'crm_clientes')).then((s) => Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
    getDocs(collection(db, 'crm_documentos')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ]);
  sols.sort((a, b) => (fecha(b.s.creado) || 0) - (fecha(a.s.creado) || 0));
  $app.innerHTML = `<h1 class="titulo">Firmas</h1><p class="bajada">Envía contratos, cotizaciones y cuentas de cobro para firma electrónica (Ley 527 de 1999). Tu parte se firma sola con tu firma autorizada.</p>
    <div class="cols mitad">
      <div class="card"><h2>Enviar a firmar</h2>
        <div class="acciones" style="margin-top:0"><a class="boton primario" href="#contrato">Nuevo contrato o documento legal</a></div>
        <h3>Una cotización o cuenta de cobro del CRM</h3>
        <select id="selDoc"><option value="">— Elige el documento —</option>${docs.filter((d) => d.numero && !['anulada', 'rechazada'].includes(d.estado)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
          .map((d) => `<option value="${esc(d.id)}">${esc(d.numero)} · ${esc(d.receptor?.nombre || '')} · ${esc(d.titulo || '')}</option>`).join('')}</select>
        <div class="acciones"><button type="button" id="irDoc">Abrir para enviar</button></div>
        <p class="suave">En el documento usa <b>Enviar a firmar</b>. ¿Tienes tu propia plantilla HTML? <a href="#firmas/avanzado">Modo avanzado</a>.</p></div>
      <div id="kpisFirmas" class="kpis" style="align-content:start"></div></div>
    ${pestanas('firmas', [['pendientes', 'Por firmar'], ['firmadas', 'Firmadas'], ['todas', 'Todas']], filtro)}
    <div id="lista"><p class="suave">Leyendo el estado de cada firma…</p></div>`;
  document.getElementById('irDoc').addEventListener('click', () => { const v = document.getElementById('selDoc').value; if (v) location.hash = 'doc/' + v; });
  const el = document.getElementById('lista');
  const tarjetas = await Promise.all(sols.map(({ ref, cliente, s }) => tarjetaSolicitud(cliente, clientes[cliente], ref, s, () => vistaFirmas([filtro]))));
  const cuenta = (g) => tarjetas.filter((t) => g.includes(t.general)).length;
  document.getElementById('kpisFirmas').innerHTML = kpi('Esperando firma', cuenta(['pendiente', 'parcial']), 'warn') + kpi('Firmadas', cuenta(['firmada']), 'ok') + kpi('Vencidas o anuladas', cuenta(['vencida', 'anulada']));
  const vista = tarjetas.filter((t) => filtro === 'todas' || (filtro === 'firmadas' ? t.general === 'firmada' : ['pendiente', 'parcial'].includes(t.general)));
  el.innerHTML = vista.length ? '' : `<div class="vacio">${filtro === 'pendientes' ? 'No hay documentos esperando firma.' : 'Nada por aquí.'}</div>`;
  for (const t of vista) el.append(t.div);
}

// Modo avanzado: plantillas HTML propias (con <campo-k> y <firma-k>) y firmantes en JSON.
function vistaAvanzada() {
  $app.innerHTML = `<p><a href="#firmas">← Firmas</a></p><div class="card" style="max-width:760px"><h2>Solicitud con plantillas propias</h2>
    <form id="fSol"><label>Cliente</label><select name="cliente" required id="selCli"></select>
    <label>Título</label><input name="titulo" required placeholder="Contrato de prestación de servicios">
    <label>Vigencia del enlace (horas)</label><input name="horas" type="number" min="1" max="720" value="72">
    <label>Plantillas HTML (una por documento; el nombre del archivo sin .html es su id, p. ej. contrato.html)</label><input name="plantillas" type="file" accept=".html,text/html" multiple required>
    <label>Firmantes (JSON: rol, nombre, docs, campos, prefill, firma, cedula, auto)</label>
    <textarea name="firmantes" required>[\n  { "rol": "contratista", "nombre": "Henry Camilo Taborda Galeano", "docs": ["contrato"], "firma": "firma_h", "auto": true },\n  { "rol": "contratante", "nombre": "Nombre del cliente", "docs": ["contrato"], "firma": "firma_c", "cedula": "c_cedula",\n    "campos": [ { "k": "c_cedula", "label": "Tu número de cédula", "req": true } ] }\n]</textarea>
    <p class="suave">Con <code>"auto": true</code> ese firmante firma solo con tu firma autorizada.</p>
    <div class="acciones"><button class="primario">Crear enlaces</button></div></form><div id="mSol"></div></div>`;
  getDocs(query(collection(db, 'crm_clientes'), orderBy('nombre'))).then((s) => { document.getElementById('selCli').innerHTML = s.docs.map((d) => `<option value="${esc(d.id)}">${esc(d.data().nombre)}</option>`).join(''); });
  document.getElementById('fSol').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('mSol');
    try {
      const f = new FormData(e.target);
      const docs = [];
      for (const file of f.getAll('plantillas')) {
        const html = await file.text();
        docs.push({ id: file.name.replace(/\.html?$/i, '').toLowerCase(), titulo: (html.match(/<title>([^<]*)<\/title>/i)?.[1] || file.name).trim(), html });
      }
      const cliente = f.get('cliente');
      const c = (await getDoc(doc(db, 'crm_clientes', cliente))).data() || {};
      const { enlaces } = await crearSolicitudFirma({ cliente, titulo: f.get('titulo'), horas: f.get('horas'), docs, firmantes: JSON.parse(f.get('firmantes')) });
      mostrarEnlaces({ titulo: f.get('titulo'), enlaces, telefono: c.telefono, correo: c.correo, alCerrar: () => (location.hash = 'firmas') });
    } catch (err) { console.error(err); aviso(m, 'No se pudo crear: ' + esc(err.message), 'err'); }
  });
}

// Guarda en Firestore el id de la solicitud dentro del documento comercial que se envió a firmar.
export async function marcarEnviado(docId, sid, cliente) {
  await setDoc(doc(db, 'crm_documentos', docId), { firma_solicitud: { sid, cliente, en: new Date().toISOString() } }, { merge: true });
}
