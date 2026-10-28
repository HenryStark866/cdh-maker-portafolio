// CRM de CDH Maker (cdhmaker.com/crm): clientes, plan de pagos, solicitudes de firma y expediente.
// Acceso sin clave: el administrador escribe su correo y entra con el enlace que le llega (Firebase Auth,
// "vínculo de correo electrónico"). La seguridad real está en firestore.rules (esAdmin).
// Datos: crm_clientes/{id} (+ solicitudes/, archivos/{aid}/partes/{n}); enlaces/{token} para firmar.
import { db, auth, EMULADOR } from './fb.js';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, serverTimestamp, Timestamp, writeBatch, runTransaction }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ensamblar, estadoDocs, sha256Bytes, htmlAPdf, cargarLibs } from './ensamblar.js?v=3';
import { htmlDocumento, totales, claseDe, sumarDias, TIPOS, EMISOR_BASE } from './comercial.js?v=2';

// Deben coincidir con esAdmin() de firestore.rules.
const ADMINS = ['cdhmaker@gmail.com', 'henrytaborda57@gmail.com', 'isarias09@gmail.com'];
// Proyecto de firma anterior (enlaces creados con firmas/crear.mjs): lectura pública por token.
const FIRMAS_LEGADO = { api: 'AIzaSyCeHUBzJpRbaSHHnvR7vwSUKyXqO0e1JGk', base: 'https://firestore.googleapis.com/v1/projects/cdhmaker-firmas/databases/(default)/documents/firmas/' };
const CLAVE_CORREO = 'cdh_crm_correo';
const PARTE = 700000; // caracteres base64 por documento de Firestore (límite 1 MiB)

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cop = (n) => 'COP ' + Number(n || 0).toLocaleString('es-CO');
const fecha = (t) => (t?.toDate ? t.toDate() : t ? new Date(t) : null);
const fmtFecha = (t, hora = false) => { const d = fecha(t); return d && !isNaN(d) ? d.toLocaleString('es-CO', hora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—'; };
const aviso = (el, txt, cls = 'info') => { el.innerHTML = `<div class="aviso ${cls}">${txt}</div>`; };
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const token = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const descargar = (bytes, nombre, mime) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

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
  $nav.innerHTML = '';
  $app.innerHTML = `<div class="card" style="max-width:440px;margin:40px auto">
    <h2>Entrar al CRM</h2>
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

// ───────── navegación ─────────
let usuario = null;
function nav(actual) {
  $nav.innerHTML = `<button data-ir="clientes" class="${actual === 'clientes' ? 'act' : ''}">Clientes</button>
    <button data-ir="cotizador" class="${actual === 'cotizador' ? 'act' : ''}">Cotizador</button>
    <button data-ir="docs" class="${actual === 'docs' ? 'act' : ''}">Docs</button>
    <button data-ir="libro" class="${actual === 'libro' ? 'act' : ''}">Libro contable</button>
    <button data-ir="importar" class="${actual === 'importar' ? 'act' : ''}">Importar</button>
    <span style="color:#BFE3EE;font-size:12px">${esc(usuario.email)}</span><button id="salir">Salir</button>`;
  $nav.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => (location.hash = b.dataset.ir)));
  document.getElementById('salir').addEventListener('click', () => signOut(auth));
}
async function enrutar() {
  if (!usuario) return;
  const [ruta, id, extra] = location.hash.slice(1).split('/');
  try {
    if (ruta === 'cliente' && id) return await vistaCliente(decodeURIComponent(id));
    if (ruta === 'cotizador') return await vistaCotizador(id || 'cotizacion');
    if (ruta === 'doc' && id) return await vistaDocumento(decodeURIComponent(id), extra ? decodeURIComponent(extra) : '');
    if (ruta === 'docs') return await vistaDocs(id || '');
    if (ruta === 'importar') return vistaImportar();
    if (ruta === 'libro') return await vistaLibro(id ? decodeURIComponent(id) : '');
    return await vistaClientes();
  } catch (e) { console.error(e); $app.innerHTML = `<div class="card"><div class="aviso err">Error: ${esc(e.code || e.message)}</div></div>`; }
}

// ───────── clientes ─────────
const resumenPagos = (c) => {
  const cuotas = c.cuotas || [];
  const pagado = cuotas.filter((q) => q.estado === 'pagada').reduce((s, q) => s + Number(q.valor || 0), 0);
  const total = Number(c.valor_total || cuotas.reduce((s, q) => s + Number(q.valor || 0), 0));
  return { pagado, total, saldo: total - pagado, pagadas: cuotas.filter((q) => q.estado === 'pagada').length, n: cuotas.length };
};

async function vistaClientes() {
  nav('clientes');
  const snap = await getDocs(query(collection(db, 'crm_clientes'), orderBy('nombre')));
  const filas = snap.docs.map((d) => { const c = d.data(), r = resumenPagos(c); return `<li data-id="${esc(d.id)}"><b>${esc(c.nombre)}</b> ${c.empresa ? '· ' + esc(c.empresa) : ''}
    <small>${esc(c.proyecto || '')} · pagado ${cop(r.pagado)} de ${cop(r.total)} (${r.pagadas}/${r.n} cuotas) · <span class="chip ${esc(c.estado || 'pendiente')}">${esc(c.estado || 'activo')}</span></small></li>`; }).join('');
  $app.innerHTML = `<div class="cols"><div class="card"><h2>Nuevo cliente</h2>
      <form id="fNuevo"><label>Nombre o razón social</label><input name="nombre" required>
      <label>Proyecto</label><input name="proyecto"><label>Correo</label><input name="correo" type="email">
      <div class="acciones"><button class="primario">Crear</button></div></form><div id="mNuevo"></div></div>
    <div class="card"><h2>Clientes (${snap.size})</h2>${snap.size ? `<ul class="lista">${filas}</ul>` : '<p class="suave">Aún no hay clientes. Usa «Importar» para cargar un expediente.</p>'}</div></div>`;
  $app.querySelectorAll('.lista li').forEach((li) => li.addEventListener('click', () => (location.hash = 'cliente/' + encodeURIComponent(li.dataset.id))));
  document.getElementById('fNuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const id = slug(f.nombre) || token().slice(0, 12);
    const ref = doc(db, 'crm_clientes', id);
    if ((await getDoc(ref)).exists()) return aviso(document.getElementById('mNuevo'), 'Ya existe un cliente con ese identificador.', 'err');
    await setDoc(ref, { ...f, estado: 'activo', cuotas: [], creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'cliente/' + encodeURIComponent(id);
  });
}

const CAMPOS = [['nombre', 'Nombre o razón social'], ['tipo', 'Tipo (persona natural / empresa)'], ['documento', 'Cédula o NIT'], ['empresa', 'Empresa relacionada'],
  ['correo', 'Correo'], ['telefono', 'Teléfono'], ['direccion', 'Ciudad y dirección'], ['proyecto', 'Proyecto'], ['valor_total', 'Valor total (COP)'], ['estado', 'Estado (activo, pagado, cerrado)']];

async function vistaCliente(id) {
  nav('clientes');
  const ref = doc(db, 'crm_clientes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { $app.innerHTML = '<div class="card"><div class="aviso err">Cliente no encontrado.</div></div>'; return; }
  const c = snap.data(), r = resumenPagos(c);
  $app.innerHTML = `<p><a href="#clientes">← Clientes</a></p>
  <div class="cols"><div>
    <div class="card"><h2>${esc(c.nombre)}</h2><form id="fDatos">${CAMPOS.map(([k, l]) => `<label>${l}</label><input name="${k}" value="${esc(c[k] ?? '')}">`).join('')}
      <label>Notas</label><textarea name="notas" style="font-family:inherit;font-size:13px;min-height:80px">${esc(c.notas || '')}</textarea>
      <div class="acciones"><button class="primario">Guardar</button></div></form><div id="mDatos"></div>
      <p class="suave">Actualizado ${fmtFecha(c.actualizado, true)}${c.actualizado_por ? ' por ' + esc(c.actualizado_por) : ''}</p></div>
  </div><div>
    <div class="card"><h2>Plan de pagos</h2>
      <p>Pagado <b>${cop(r.pagado)}</b> de <b>${cop(r.total)}</b> · saldo <b>${cop(r.saldo)}</b> · ${r.pagadas}/${r.n} cuotas</p>
      <table><tr><th>#</th><th>Vence</th><th>Valor</th><th>Estado</th><th>Pago</th><th></th></tr>
      ${(c.cuotas || []).map((q, i) => `<tr><td>${esc(q.n)}</td><td>${esc(q.fecha)}</td><td>${cop(q.valor)}</td><td><span class="chip ${q.estado === 'pagada' ? 'firmado' : 'pendiente'}">${esc(q.estado || 'pendiente')}</span></td>
        <td>${q.estado === 'pagada' ? esc(q.fecha_pago || '') + (q.referencia ? '<br><small class="suave">' + esc(q.referencia) + '</small>' : '') : ''}</td>
        <td>${q.estado === 'pagada' ? `<button class="mini" data-desmarcar="${i}">Deshacer</button>` : `<button class="mini primario" data-pagar="${i}">Registrar pago</button>`}</td></tr>`).join('')}
      </table>
      <form id="fCuota" class="acciones"><input name="fecha" type="date" required style="width:auto"><input name="valor" type="number" min="0" placeholder="Valor" required style="width:140px"><button class="mini">Agregar cuota</button></form>
    </div>
    <div class="card"><div class="sol cab" style="border:0;padding:0;margin:0 0 6px"><h2 style="margin:0">Cotizaciones y facturas</h2>
      <a class="boton" href="#doc/nuevo/${encodeURIComponent(id)}">Nueva cotización</a></div><div id="comerciales"><p class="suave">Cargando…</p></div></div>
    <div class="card"><h2>Firmas</h2><div id="solicitudes"><p class="suave">Cargando…</p></div>
      <details><summary class="suave" style="cursor:pointer">Nueva solicitud de firma</summary>${formSolicitud()}</details></div>
    <div class="card"><h2>Expediente</h2><div id="archivos"><p class="suave">Cargando…</p></div>
      <div class="acciones"><input type="file" id="fArchivo" multiple style="width:auto"><select id="fCarpeta" style="width:auto">${opcionesCarpeta('')}</select><button class="mini" id="subir">Subir al expediente</button></div><div id="mArchivo"></div></div>
  </div></div>`;

  const guardar = async (cambios) => { await updateDoc(ref, { ...cambios, actualizado: serverTimestamp(), actualizado_por: usuario.email }); await vistaCliente(id); };
  document.getElementById('fDatos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.valor_total !== '') f.valor_total = Number(f.valor_total) || 0;
    await guardar(f);
  });
  $app.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.pagar);
    const fp = prompt('Fecha del pago (AAAA-MM-DD):', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
    if (!fp) return;
    const ref2 = prompt('Referencia o nota del pago (opcional):', 'Transferencia') ?? '';
    const cuotas = [...c.cuotas]; cuotas[i] = { ...cuotas[i], estado: 'pagada', fecha_pago: fp, referencia: ref2, registrado_por: usuario.email };
    await asientoCuota(id, c, cuotas[i]);
    await guardar({ cuotas });
  }));
  $app.querySelectorAll('[data-desmarcar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Marcar esta cuota como pendiente otra vez? El ingreso del libro contable quedará anulado.')) return;
    const cuotas = [...c.cuotas]; const { fecha_pago, referencia, registrado_por, ...resto } = cuotas[Number(b.dataset.desmarcar)];
    cuotas[Number(b.dataset.desmarcar)] = { ...resto, estado: 'pendiente' };
    const aRef = doc(db, 'crm_libro', idAsientoCuota(id, resto.n));
    if ((await getDoc(aRef)).exists()) await updateDoc(aRef, { estado: 'anulado', anulado_en: serverTimestamp(), anulado_por: usuario.email, actualizado: serverTimestamp() });
    await guardar({ cuotas });
  }));
  document.getElementById('fCuota').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const cuotas = [...(c.cuotas || []), { n: (c.cuotas || []).length + 1, fecha: f.fecha, valor: Number(f.valor), estado: 'pendiente' }];
    await guardar({ cuotas });
  });
  document.getElementById('subir').addEventListener('click', async () => {
    const m = document.getElementById('mArchivo');
    const files = [...document.getElementById('fArchivo').files];
    if (!files.length) return aviso(m, 'Elige uno o más archivos.', 'err');
    const carpeta = document.getElementById('fCarpeta').value;
    for (const f of files) { aviso(m, 'Subiendo ' + esc(f.name) + '…'); await guardarArchivo(id, { nombre: f.name, tipo: 'documento', carpeta, mime: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) }); }
    await vistaCliente(id);
  });
  enlazarSolicitud(id, c);
  pintarSolicitudes(id, c);
  pintarArchivos(id);
  pintarComerciales(id);
}

async function pintarComerciales(cliente) {
  const el = document.getElementById('comerciales');
  const docs = (await getDocs(query(collection(db, 'crm_documentos'), where('cliente', '==', cliente)))).docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  el.innerHTML = docs.length ? tablaComerciales(docs, false) : '<p class="suave">Sin cotizaciones ni facturas.</p>';
  enlazarFilas(el);
}

// ───────── expediente (archivos en partes base64: Cloud Storage exige plan Blaze) ─────────
// cliente vacío = documento general de CDH Maker (crm_docs), que no pertenece a un expediente.
const rutaArchivo = (cliente, aid) => (cliente ? ['crm_clientes', cliente, 'archivos', aid] : ['crm_docs', aid]);
async function guardarArchivo(cliente, { nombre, tipo, carpeta, mime, bytes, sha256 }) {
  const texto = b64(bytes);
  const partes = Math.ceil(texto.length / PARTE) || 1;
  const aRef = await addDoc(cliente ? collection(db, 'crm_clientes', cliente, 'archivos') : collection(db, 'crm_docs'), {
    nombre, tipo, carpeta: carpeta || carpetaDe({ nombre, tipo }), mime, tamano: bytes.length, sha256: sha256 || await sha256Bytes(bytes), partes, creado: serverTimestamp(), creado_por: usuario.email,
  });
  for (let n = 0; n < partes; n++) await setDoc(doc(db, ...rutaArchivo(cliente, aRef.id), 'partes', String(n)), { d: texto.slice(n * PARTE, (n + 1) * PARTE) });
  return aRef.id;
}
async function bajarArchivo(cliente, aid, a) {
  const partes = await getDocs(collection(db, ...rutaArchivo(cliente, aid), 'partes'));
  descargar(deB64(partes.docs.sort((x, y) => Number(x.id) - Number(y.id)).map((p) => p.data().d).join('')), a.nombre, a.mime);
}
async function borrarArchivo(cliente, aid) {
  for (const p of (await getDocs(collection(db, ...rutaArchivo(cliente, aid), 'partes'))).docs) await deleteDoc(p.ref);
  await deleteDoc(doc(db, ...rutaArchivo(cliente, aid)));
}

// Carpetas de Docs. Los archivos anteriores a las carpetas se clasifican por su tipo y nombre.
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
  el.innerHTML = `<table><tr><th>Archivo</th><th>Carpeta</th><th>Fecha</th><th></th></tr>${snap.docs.map((d) => { const a = d.data(); return `<tr><td>${esc(a.nombre)}<br><small class="suave">${(a.tamano / 1024).toFixed(0)} KB · SHA-256 ${esc((a.sha256 || '').slice(0, 12))}…</small></td><td><a href="#docs/${carpetaDe(a)}">${esc(nombreCarpeta(carpetaDe(a)))}</a></td><td>${fmtFecha(a.creado, true)}</td>
    <td><button class="mini" data-bajar="${d.id}">Descargar</button> <button class="mini peligro" data-borrar="${d.id}">Borrar</button></td></tr>`; }).join('')}</table>`;
  el.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => bajarArchivo(cliente, b.dataset.bajar, snap.docs.find((d) => d.id === b.dataset.bajar).data())));
  el.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar este archivo del expediente? No se puede deshacer.')) return;
    await borrarArchivo(cliente, b.dataset.borrar);
    pintarArchivos(cliente);
  }));
}

// ───────── solicitudes de firma ─────────
async function leerEnlace(s, e) {
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
const estadoEnlace = (X) => !X ? 'no encontrado' : X.estado === 'pendiente' && fecha(X.expira) < new Date() ? 'vencido' : X.estado;

async function pintarSolicitudes(cliente, c) {
  const el = document.getElementById('solicitudes');
  const snap = await getDocs(query(collection(db, 'crm_clientes', cliente, 'solicitudes'), orderBy('creado', 'desc')));
  if (!snap.size) { el.innerHTML = '<p class="suave">Sin solicitudes de firma.</p>'; return; }
  el.innerHTML = '';
  for (const d of snap.docs) {
    const s = d.data();
    const enlaces = await Promise.all((s.enlaces || []).map((e) => leerEnlace(s, e).catch(() => null)));
    const estados = enlaces.map(estadoEnlace);
    const todos = estados.every((x) => x === 'firmado');
    const div = document.createElement('div'); div.className = 'sol';
    div.innerHTML = `<div class="cab"><b>${esc(s.titulo)}</b><span class="chip ${s.anulada ? 'anulada' : todos ? 'firmada' : estados.some((x) => x === 'firmado') ? 'parcial' : 'pendiente'}">${s.anulada ? 'anulada' : todos ? 'firmada' : estados.some((x) => x === 'firmado') ? 'firma parcial' : 'pendiente'}</span></div>
      <small class="suave">${esc(s.sistema === 'cdhmaker-firmas' ? 'cdhmaker-firmas.web.app' : 'cdhmaker.com/firmar')} · creada ${fmtFecha(s.creado, true)}${s.nota ? ' · ' + esc(s.nota) : ''}</small>
      <table><tr><th>Firmante</th><th>Estado</th><th>Firmó / vence</th><th></th></tr>${(s.enlaces || []).map((e, i) => `<tr><td>${esc(e.nombre)}<br><small class="suave">${esc(e.rol)}</small></td>
        <td><span class="chip ${esc(estados[i])}">${esc(estados[i])}</span></td><td>${estados[i] === 'firmado' ? fmtFecha(enlaces[i].firmadoEn, true) : 'vence ' + fmtFecha(e.expira, true)}</td>
        <td>${estados[i] === 'pendiente' ? `<button class="mini" data-copiar="${esc(e.url)}">Copiar enlace</button>` : ''}</td></tr>`).join('')}</table>
      <div class="acciones">${s.sistema !== 'cdhmaker-firmas' && estados.some((x) => x === 'firmado') ? '<button class="mini primario" data-ensamblar>Armar PDF firmados</button>' : ''}
        ${s.sistema !== 'cdhmaker-firmas' && !todos && !s.anulada ? '<button class="mini peligro" data-anular>Anular pendientes</button>' : ''}</div><div class="m"></div>`;
    div.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiado ✔'; }));
    div.querySelector('[data-ensamblar]')?.addEventListener('click', async () => {
      const m = div.querySelector('.m');
      try {
        const { archivos, faltan } = await ensamblar({ cliente: { id: cliente, ...c }, solicitud: s, enlaces, alAvanzar: (t) => aviso(m, esc(t)) });
        for (const a of archivos) { aviso(m, 'Guardando ' + esc(a.nombre) + '…'); await guardarArchivo(cliente, a); }
        await updateDoc(d.ref, { ensamblada: serverTimestamp(), pendientes: faltan.map((x) => x.id) });
        await vistaCliente(cliente);
      } catch (e) { console.error(e); aviso(m, 'No se pudo armar: ' + esc(e.message), 'err'); }
    });
    div.querySelector('[data-anular]')?.addEventListener('click', async () => {
      if (!confirm('¿Anular los enlaces que aún no se han firmado?')) return;
      for (const [i, e] of (s.enlaces || []).entries()) if (estados[i] === 'pendiente') await updateDoc(doc(db, 'enlaces', e.token), { estado: 'anulado', anuladoEn: serverTimestamp() });
      await updateDoc(d.ref, { anulada: true });
      await vistaCliente(cliente);
    });
    el.append(div);
  }
}

function formSolicitud() {
  return `<form id="fSol"><label>Título</label><input name="titulo" required placeholder="Contrato de prestación de servicios">
    <label>Vigencia del enlace (horas)</label><input name="horas" type="number" min="1" max="720" value="48">
    <label>Plantillas HTML (una por documento; el nombre del archivo sin .html es su id, p. ej. contrato.html)</label><input name="plantillas" type="file" accept=".html,text/html" multiple required>
    <label>Firmantes (JSON: rol, nombre, docs, campos, prefill, firma, cedula)</label>
    <textarea name="firmantes" required>[\n  { "rol": "contratista", "nombre": "Henry Camilo Taborda Galeano", "docs": ["contrato"], "firma": "firma_h", "cedula": "h_cedula",\n    "campos": [ { "k": "ciudad_firma", "label": "Ciudad donde firmas", "req": true } ] }\n]</textarea>
    <div class="acciones"><button class="primario">Crear enlaces</button></div></form><div id="mSol"></div>`;
}
function enlazarSolicitud(cliente) {
  document.getElementById('fSol').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('mSol');
    try {
      const f = new FormData(e.target);
      const firmantes = JSON.parse(f.get('firmantes'));
      const plantillas = {};
      for (const file of f.getAll('plantillas')) {
        const html = await file.text();
        plantillas[file.name.replace(/\.html?$/i, '')] = { titulo: (html.match(/<title>([^<]*)<\/title>/i)?.[1] || file.name).trim(), html };
      }
      for (const x of firmantes) for (const idDoc of x.docs) if (!plantillas[idDoc]) throw new Error('Falta la plantilla «' + idDoc + '.html»');
      const horas = Math.min(720, Number(f.get('horas')) || 48);
      const expira = Timestamp.fromMillis(Date.now() + horas * 3600e3);
      const sid = slug(f.get('titulo')) + '-' + new Date().toISOString().slice(0, 10);
      const enlaces = [];
      const lote = writeBatch(db);
      for (const x of firmantes) {
        const t = token();
        lote.set(doc(db, 'enlaces', t), { estado: 'pendiente', solicitud: sid, cliente, rol: x.rol, nombre: x.nombre, expira, creado: serverTimestamp(), prefill: x.prefill || {}, campos: x.campos || [],
          docs: x.docs.map((idDoc) => ({ id: idDoc, titulo: plantillas[idDoc].titulo, html: plantillas[idDoc].html })) });
        enlaces.push({ rol: x.rol, nombre: x.nombre, token: t, url: location.origin + '/firmar#' + t, expira: expira.toDate().toISOString() });
      }
      lote.set(doc(db, 'crm_clientes', cliente, 'solicitudes', sid), { id: sid, titulo: f.get('titulo'), horas, sistema: 'crm', firmantes, enlaces,
        plantillas: Object.fromEntries(Object.entries(plantillas).map(([k, p]) => [k, { titulo: p.titulo }])), creado: serverTimestamp(), creado_por: usuario.email });
      await lote.commit();
      await vistaCliente(cliente);
    } catch (err) { console.error(err); aviso(m, 'No se pudo crear: ' + esc(err.message), 'err'); }
  });
}

// ───────── libro contable (crm_libro): ingresos y egresos de CDH Maker, con cuentas por cobrar ─────────
// Cada cuota pagada de un cliente genera su ingreso con id fijo (no se duplica). Los movimientos no se
// borran: se anulan, para conservar la trazabilidad.
const CUENTAS = {
  ingreso: ['Desarrollo de software', 'Fabricación digital', 'Electrónica e IoT', 'Consultoría y capacitación', 'Otros ingresos'],
  egreso: ['Infraestructura y licencias', 'Materiales e insumos', 'Equipos y herramientas', 'Transporte y envíos', 'Publicidad', 'Impuestos y seguridad social', 'Servicios profesionales', 'Otros gastos'],
};
const idAsientoCuota = (cliente, n) => `cuota-${cliente}-${n}`;
async function asientoCuota(cliente, c, q) {
  await setDoc(doc(db, 'crm_libro', idAsientoCuota(cliente, q.n)), {
    fecha: q.fecha_pago, tipo: 'ingreso', cuenta: c.cuenta_contable || 'Desarrollo de software',
    concepto: `Cuota ${q.n} de ${(c.cuotas || []).length || q.n} — ${c.proyecto || c.nombre}`, tercero: c.nombre, documento: c.documento || '',
    cliente, cuota: q.n, valor: Number(q.valor || 0), medio: q.referencia || '', referencia: q.referencia || '', estado: 'vigente', origen: 'cuota',
    creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email,
  });
}
const mesDe = (f) => String(f || '').slice(0, 7);
const csv = (filas) => filas.map((r) => r.map((x) => { const s = String(x ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');

async function vistaLibro(mes) {
  nav('libro');
  const clientes = (await getDocs(collection(db, 'crm_clientes'))).docs.map((d) => ({ id: d.id, ...d.data() }));
  let movs = (await getDocs(query(collection(db, 'crm_libro'), orderBy('fecha', 'desc')))).docs.map((d) => ({ id: d.id, ...d.data() }));
  // Cuotas pagadas que aún no tienen asiento (p. ej. importadas): se registran una sola vez.
  const tienen = new Set(movs.map((m) => m.id));
  let nuevos = 0;
  for (const c of clientes) for (const q of c.cuotas || []) if (q.estado === 'pagada' && q.fecha_pago && !tienen.has(idAsientoCuota(c.id, q.n))) { await asientoCuota(c.id, c, q); nuevos++; }
  if (nuevos) movs = (await getDocs(query(collection(db, 'crm_libro'), orderBy('fecha', 'desc')))).docs.map((d) => ({ id: d.id, ...d.data() }));

  const meses = [...new Set(movs.map((m) => mesDe(m.fecha)))].sort().reverse();
  const vista = movs.filter((m) => !mes || mesDe(m.fecha) === mes);
  const vig = vista.filter((m) => m.estado !== 'anulado');
  const suma = (t) => vig.filter((m) => m.tipo === t).reduce((s, m) => s + Number(m.valor || 0), 0);
  const ing = suma('ingreso'), egr = suma('egreso');
  // Por cobrar: cuotas pendientes de los clientes y facturas / cuentas de cobro emitidas sin pagar.
  const facturas = (await getDocs(query(collection(db, 'crm_documentos'), where('estado', '==', 'emitida')))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const cxc = [
    ...clientes.flatMap((c) => (c.cuotas || []).filter((q) => q.estado !== 'pagada').map((q) => ({ fecha: q.fecha, href: '#cliente/' + encodeURIComponent(c.id), nombre: c.nombre, concepto: `Cuota ${q.n} de ${(c.cuotas || []).length}`, valor: Number(q.valor || 0) }))),
    ...facturas.map((f) => ({ fecha: f.vence || f.fecha, href: '#doc/' + f.id, nombre: f.receptor?.nombre || '', concepto: `${TIPOS[claseDe(f)].corto} ${f.numero}`, valor: totales(f).total })),
  ].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const totalCxc = cxc.reduce((s, x) => s + x.valor, 0);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  $app.innerHTML = `
  <div class="card"><div class="cab" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
    <h2 style="margin:0">Libro contable — CDH Maker</h2>
    <div class="acciones" style="margin:0"><select id="mes" style="width:auto"><option value="">Todo el periodo</option>${meses.map((x) => `<option ${x === mes ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <button class="mini" id="exportar">Exportar CSV</button></div></div>
    <div class="grid" style="margin-top:12px">
      <div><span class="suave">Ingresos</span><h2 style="color:var(--ok)">${cop(ing)}</h2></div>
      <div><span class="suave">Egresos</span><h2 style="color:var(--err)">${cop(egr)}</h2></div>
      <div><span class="suave">Resultado</span><h2>${cop(ing - egr)}</h2></div>
      <div><span class="suave">Por cobrar (cuotas y facturas pendientes)</span><h2 style="color:var(--warn)">${cop(totalCxc)}</h2></div>
    </div>${nuevos ? `<div class="aviso ok">Se registraron ${nuevos} pago(s) de cuotas que venían del CRM.</div>` : ''}</div>
  <div class="cols"><div class="card"><h2>Nuevo movimiento</h2>
    <form id="fMov"><label>Tipo</label><select name="tipo" id="tipo"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select>
      <label>Fecha</label><input name="fecha" type="date" value="${hoy}" required>
      <label>Cuenta</label><input name="cuenta" list="cuentas" required><datalist id="cuentas"></datalist>
      <label>Concepto</label><input name="concepto" required>
      <label>Tercero (cliente o proveedor)</label><input name="tercero" list="terceros"><datalist id="terceros">${clientes.map((c) => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
      <label>Valor (COP)</label><input name="valor" type="number" min="1" step="1" required>
      <label>Medio de pago</label><input name="medio" list="medios" placeholder="Transferencia Bancolombia"><datalist id="medios"><option value="Transferencia Bancolombia"><option value="Efectivo"><option value="Nequi"><option value="Tarjeta"></datalist>
      <label>Referencia / soporte</label><input name="referencia">
      <div class="acciones"><button class="primario">Registrar</button></div></form><div id="mMov"></div></div>
  <div><div class="card"><h2>Movimientos${mes ? ' · ' + esc(mes) : ''} (${vista.length})</h2>
    ${vista.length ? `<table><tr><th>Fecha</th><th>Cuenta / concepto</th><th>Tercero</th><th style="text-align:right">Valor</th><th></th></tr>
    ${vista.map((m) => `<tr style="${m.estado === 'anulado' ? 'opacity:.45;text-decoration:line-through' : ''}"><td>${esc(m.fecha)}</td>
      <td><b>${esc(m.cuenta)}</b><br><small>${esc(m.concepto)}${m.referencia ? ' · ' + esc(m.referencia) : ''}</small></td>
      <td>${m.cliente ? `<a href="#cliente/${encodeURIComponent(m.cliente)}">${esc(m.tercero)}</a>` : esc(m.tercero || '')}</td>
      <td style="text-align:right;white-space:nowrap;font-weight:600;color:${m.tipo === 'ingreso' ? 'var(--ok)' : 'var(--err)'}">${m.tipo === 'ingreso' ? '+' : '−'} ${cop(m.valor)}</td>
      <td>${m.estado === 'anulado' ? '<small>anulado</small>' : m.origen === 'cuota' ? '<small class="suave">cuota</small>' : m.origen === 'factura' ? `<a class="suave" href="#doc/${esc(m.documento_id)}">factura</a>` : `<button class="mini peligro" data-anular="${esc(m.id)}">Anular</button>`}</td></tr>`).join('')}</table>`
      : '<p class="suave">Sin movimientos en este periodo.</p>'}</div>
    <div class="card"><h2>Cuentas por cobrar</h2>
    ${cxc.length ? `<table><tr><th>Vence</th><th>Cliente</th><th>Concepto</th><th style="text-align:right">Valor</th></tr>${cxc.map((x) => `<tr><td>${esc(x.fecha)}${x.fecha < hoy ? ' <span class="chip vencido">vencida</span>' : ''}</td>
      <td><a href="${esc(x.href)}">${esc(x.nombre)}</a></td><td>${esc(x.concepto)}</td><td style="text-align:right">${cop(x.valor)}</td></tr>`).join('')}</table>`
      : '<p class="suave">No hay cuentas por cobrar.</p>'}</div></div></div>`;

  const tipo = document.getElementById('tipo'), dl = document.getElementById('cuentas');
  const pintarCuentas = () => { dl.innerHTML = CUENTAS[tipo.value].map((x) => `<option value="${x}">`).join(''); };
  tipo.addEventListener('change', pintarCuentas); pintarCuentas();
  document.getElementById('mes').addEventListener('change', (e) => (location.hash = 'libro' + (e.target.value ? '/' + e.target.value : '')));
  document.getElementById('fMov').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const cli = clientes.find((c) => c.nombre === f.tercero);
    await addDoc(collection(db, 'crm_libro'), { ...f, valor: Number(f.valor), cliente: cli?.id || '', estado: 'vigente', origen: 'manual',
      creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    await vistaLibro(mes);
  });
  $app.querySelectorAll('[data-anular]').forEach((b) => b.addEventListener('click', async () => {
    const motivo = prompt('Motivo de la anulación:');
    if (!motivo) return;
    await updateDoc(doc(db, 'crm_libro', b.dataset.anular), { estado: 'anulado', motivo_anulacion: motivo, anulado_en: serverTimestamp(), anulado_por: usuario.email, actualizado: serverTimestamp() });
    await vistaLibro(mes);
  }));
  document.getElementById('exportar').addEventListener('click', () => {
    const filas = [['Fecha', 'Tipo', 'Cuenta', 'Concepto', 'Tercero', 'Documento', 'Valor', 'Medio', 'Referencia', 'Estado', 'Registrado por'],
      ...vista.map((m) => [m.fecha, m.tipo, m.cuenta, m.concepto, m.tercero, m.documento, m.tipo === 'egreso' ? -m.valor : m.valor, m.medio, m.referencia, m.estado, m.creado_por])];
    descargar(new TextEncoder().encode('﻿' + csv(filas)), `libro-cdh-maker${mes ? '-' + mes : ''}.csv`, 'text/csv');
  });
}

// ───────── cotizador (crm_documentos): cotizaciones que se convierten en factura o cuenta de cobro ─────────
// Una cotización recibe su número al guardarse por primera vez; una factura nace como borrador y recibe
// el consecutivo al emitirse, para que la numeración no tenga saltos. Las emitidas no se editan: se anulan.
// Estados — cotización: borrador, enviada, aceptada, rechazada, facturada; factura: borrador, emitida, pagada, anulada.
const ESTADOS_COT = ['borrador', 'enviada', 'aceptada', 'rechazada'];
const CHIP = { borrador: 'pendiente', enviada: 'parcial', aceptada: 'firmado', facturada: 'firmado', emitida: 'parcial', pagada: 'firmado', rechazada: 'anulado', anulada: 'anulado' };
const hoyCO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const leerEmisor = async () => ({ ...EMISOR_BASE, ...((await getDoc(doc(db, 'crm_config', 'emisor'))).data() || {}) });

async function consecutivo(clase, fechaDoc) {
  const anio = String(fechaDoc || hoyCO()).slice(0, 4);
  const ref = doc(db, 'crm_consecutivos', `${clase}-${anio}`);
  const n = await runTransaction(db, async (tx) => { const s = await tx.get(ref); const n = (s.data()?.n || 0) + 1; tx.set(ref, { n, actualizado: serverTimestamp() }); return n; });
  return `${TIPOS[clase].prefijo}-${anio}-${String(n).padStart(4, '0')}`;
}

function tablaComerciales(docs, conCliente = true) {
  return `<table><tr><th>N.º</th><th>Fecha</th>${conCliente ? '<th>Cliente</th>' : ''}<th>Asunto</th><th style="text-align:right">Total</th><th>Estado</th></tr>
    ${docs.map((d) => `<tr class="fila" data-doc="${esc(d.id)}"><td><b>${esc(d.numero || 'borrador')}</b><br><small class="suave">${esc(TIPOS[claseDe(d)].corto)}</small></td><td>${esc(d.fecha)}</td>
      ${conCliente ? `<td>${esc(d.receptor?.nombre || '')}</td>` : ''}<td>${esc(d.titulo || '')}</td><td style="text-align:right;white-space:nowrap">${cop(totales(d).total)}</td>
      <td><span class="chip ${CHIP[d.estado] || 'pendiente'}">${esc(d.estado)}</span></td></tr>`).join('')}</table>`;
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
  $app.innerHTML = `
  <div class="card"><div class="sol cab" style="border:0;padding:0;margin:0"><h2 style="margin:0">Cotizador</h2>
    <a class="boton primario" href="#doc/nuevo">Nueva cotización</a></div>
    <div class="grid" style="margin-top:12px">
      <div><span class="suave">En negociación (enviadas)</span><h2>${cop(suma(cots.filter((d) => d.estado === 'enviada')))}</h2></div>
      <div><span class="suave">Aceptadas sin facturar</span><h2 style="color:var(--ok)">${cop(suma(cots.filter((d) => d.estado === 'aceptada')))}</h2></div>
      <div><span class="suave">Facturado por cobrar</span><h2 style="color:var(--warn)">${cop(suma(facs.filter((d) => d.estado === 'emitida')))}</h2></div>
      <div><span class="suave">Facturado y pagado</span><h2>${cop(suma(facs.filter((d) => d.estado === 'pagada')))}</h2></div>
    </div></div>
  <div class="card"><div class="acciones" style="margin:0 0 10px">
      <button data-filtro="cotizacion" class="${filtro !== 'factura' ? 'primario' : ''}">Cotizaciones (${cots.length})</button>
      <button data-filtro="factura" class="${filtro === 'factura' ? 'primario' : ''}">Facturas y cuentas de cobro (${facs.length})</button></div>
    <div id="lista">${lista.length ? tablaComerciales(lista) : `<p class="suave">${filtro === 'factura' ? 'Aún no hay facturas. Se crean desde una cotización con «Convertir en factura».' : 'Aún no hay cotizaciones.'}</p>`}</div></div>
  <div class="cols">
    <div class="card"><h2>Catálogo</h2><p class="suave">Servicios y productos con precio de referencia. Al escribir la descripción de un ítem, el cotizador los sugiere.</p>
      <form id="fCat"><label>Tipo</label><select name="tipo"><option value="servicio">Servicio</option><option value="producto">Producto</option></select>
        <label>Nombre</label><input name="nombre" required><label>Unidad</label><input name="unidad" list="unidades" placeholder="unidad, hora, mes…"><datalist id="unidades"><option value="unidad"><option value="hora"><option value="mes"><option value="proyecto"><option value="gramo"></datalist>
        <label>Precio (COP)</label><input name="precio" type="number" min="0" step="1" required>
        <div class="acciones"><button class="primario">Agregar al catálogo</button></div></form></div>
    <div class="card"><h2>Ítems del catálogo (${catalogo.length})</h2>${catalogo.length ? `<table><tr><th>Ítem</th><th>Unidad</th><th style="text-align:right">Precio</th><th></th></tr>
      ${catalogo.map((x) => `<tr><td>${esc(x.nombre)}<br><small class="suave">${x.tipo === 'producto' ? 'Producto' : 'Servicio'}</small></td><td>${esc(x.unidad || '')}</td><td style="text-align:right">${cop(x.precio)}</td>
        <td><button class="mini peligro" data-quitar="${esc(x.id)}">Quitar</button></td></tr>`).join('')}</table>` : '<p class="suave">El catálogo está vacío.</p>'}
      <details style="margin-top:14px"><summary class="suave" style="cursor:pointer">Datos del emisor que salen en los documentos</summary>
        <form id="fEmisor"><div class="grid">${[['nombre', 'Nombre'], ['marca', 'Marca'], ['cedula', 'Cédula'], ['rut', 'RUT (NIT con DV)'], ['direccion', 'Dirección'], ['ciudad', 'Ciudad'], ['correo', 'Correo'], ['telefono', 'Teléfono'],
          ['banco', 'Banco / entidad'], ['tipo_cuenta', 'Tipo de cuenta'], ['cuenta', 'Número de cuenta'], ['titular', 'Titular'], ['plazo_pago', 'Plazo de pago (días hábiles)']].map(([k, l]) => `<div><label>${l}</label><input name="${k}" value="${esc(emisor[k] ?? '')}"></div>`).join('')}</div>
          <label>Condiciones por defecto de las cotizaciones</label><textarea name="condiciones" style="font-family:inherit;font-size:13px">${esc(emisor.condiciones)}</textarea>
          <div class="acciones"><button class="primario">Guardar datos del emisor</button></div></form><div id="mEmisor"></div></details></div></div>`;
  $app.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => (location.hash = 'cotizador/' + b.dataset.filtro)));
  enlazarFilas(document.getElementById('lista'));
  document.getElementById('fCat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await addDoc(collection(db, 'crm_catalogo'), { ...f, precio: Number(f.precio) || 0, creado: serverTimestamp(), creado_por: usuario.email });
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
    await setDoc(doc(db, 'crm_config', 'emisor'), { ...f, plazo_pago: Number(f.plazo_pago) || 5, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    aviso(document.getElementById('mEmisor'), 'Datos guardados. Se usan en los documentos que exportes de aquí en adelante.', 'ok');
  });
}

async function vistaDocumento(id, clienteInicial) {
  nav('cotizador');
  const [clientes, catalogo, emisor] = await Promise.all([
    getDocs(query(collection(db, 'crm_clientes'), orderBy('nombre'))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    getDocs(query(collection(db, 'crm_catalogo'), orderBy('nombre'))).then((s) => s.docs.map((d) => d.data())),
    leerEmisor(),
  ]);
  const nuevo = id === 'nuevo';
  let d;
  if (nuevo) {
    const c = clientes.find((x) => x.id === clienteInicial);
    d = { tipo: 'cotizacion', estado: 'borrador', numero: '', fecha: hoyCO(), validez_dias: 15, cliente: c?.id || '', receptor: receptorDe(c), titulo: c?.proyecto || '',
      items: [{ tipo: 'servicio', descripcion: '', cantidad: 1, unidad: '', precio: 0, descuento: 0 }], iva: 0, notas: '', condiciones: emisor.condiciones };
  } else {
    const s = await getDoc(doc(db, 'crm_documentos', id));
    if (!s.exists()) { $app.innerHTML = '<div class="card"><div class="aviso err">Documento no encontrado.</div></div>'; return; }
    d = s.data();
  }
  const cotiz = d.tipo === 'cotizacion';
  const bloqueado = cotiz ? ['facturada'].includes(d.estado) : d.estado !== 'borrador';
  const clase = claseDe(d);

  $app.innerHTML = `<p><a href="#cotizador/${cotiz ? 'cotizacion' : 'factura'}">← Cotizador</a>${d.cliente ? ` · <a href="#cliente/${encodeURIComponent(d.cliente)}">${esc(d.receptor?.nombre || 'Cliente')}</a>` : ''}</p>
  <div class="card"><div class="sol cab" style="border:0;padding:0;margin:0"><h2 style="margin:0">${esc(TIPOS[clase].corto)} ${esc(d.numero || (nuevo ? 'nueva' : 'borrador'))} <span class="chip ${CHIP[d.estado] || 'pendiente'}">${esc(d.estado)}</span></h2>
    <div class="acciones" style="margin:0" id="acciones"></div></div><div id="mDoc"></div>
    ${d.origen ? `<p class="suave" style="margin:6px 0 0">Viene de la cotización <a href="#doc/${esc(d.origen)}">${esc(d.origen_numero)}</a>.</p>` : ''}
    ${d.factura ? `<p class="suave" style="margin:6px 0 0">Facturada en <a href="#doc/${esc(d.factura)}">${esc(d.factura_numero || 'la factura')}</a>.</p>` : ''}
    ${d.pago ? `<p class="suave" style="margin:6px 0 0">Pagada el ${esc(d.pago.fecha)}${d.pago.referencia ? ' · ' + esc(d.pago.referencia) : ''} — registrada en el <a href="#libro">libro contable</a>.</p>` : ''}
    ${d.estado === 'anulada' && d.motivo_anulacion ? `<p class="suave" style="margin:6px 0 0">Anulada: ${esc(d.motivo_anulacion)}</p>` : ''}</div>
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
           <div><label>Cuenta contable del ingreso</label><input name="cuenta_contable" list="ctasIng" value="${esc(d.cuenta_contable || CUENTAS.ingreso[0])}"><datalist id="ctasIng">${CUENTAS.ingreso.map((x) => `<option value="${x}">`).join('')}</datalist></div>`}
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
  <div class="card vista"><div class="sol cab" style="border:0;padding:0;margin:0 0 8px"><b>Vista previa</b><small class="suave">Así sale el PDF</small></div><iframe id="vista" title="Vista previa del documento"></iframe></div></div>`;

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
    else { d.vence = f.vence; d.modalidad = f.modalidad; d.cuenta_contable = f.cuenta_contable; d.dian = { numero: f.dian_numero || '', cufe: f.dian_cufe || '' }; }
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
  const datos = () => ({ ...d, total: totales(d).total, actualizado: serverTimestamp(), actualizado_por: usuario.email });
  const guardar = async () => {
    leer(); validar();
    if (nuevo) {
      const numero = await consecutivo('cotizacion', d.fecha);
      const nRef = await addDoc(collection(db, 'crm_documentos'), { ...datos(), numero, creado: serverTimestamp(), creado_por: usuario.email });
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
    await guardarArchivo(d.cliente, { nombre, tipo: clase, carpeta: { cotizacion: 'cotizaciones', cuenta_cobro: 'cuentas_cobro', factura_venta: 'facturas' }[clase], mime: 'application/pdf', bytes: pdf, sha256: sha });
    await updateDoc(ref, { pdf_sha256: sha, pdf_en: serverTimestamp() });
    d.pdf_sha256 = sha;
    aviso(m, `PDF descargado y guardado en <a href="#docs/${clase === 'cotizacion' ? 'cotizaciones' : clase === 'cuenta_cobro' ? 'cuentas_cobro' : 'facturas'}">Docs</a>${d.cliente ? ' y en el expediente del cliente' : ''}.`, 'ok');
  };
  const $acc = document.getElementById('acciones');
  const boton = (txt, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.className = 'mini ' + cls; b.addEventListener('click', accion(fn)); $acc.append(b); return b; };

  if (!bloqueado) boton(nuevo ? 'Guardar cotización' : 'Guardar', async () => { if (await guardar()) await vistaDocumento(id); }, 'primario');
  if (!nuevo) boton('Exportar PDF', exportar);
  if (cotiz && !nuevo && !bloqueado) {
    const sel = document.createElement('select'); sel.style.width = 'auto'; sel.className = 'mini';
    sel.innerHTML = ESTADOS_COT.map((x) => `<option ${x === d.estado ? 'selected' : ''}>${x}</option>`).join('');
    sel.addEventListener('change', accion(async () => { await updateDoc(ref, { estado: sel.value, actualizado: serverTimestamp(), actualizado_por: usuario.email }); await vistaDocumento(id); }));
    $acc.append(sel);
    if (d.estado !== 'rechazada') boton('Convertir en factura', async () => {
      await guardar();
      const f = { ...d, tipo: 'factura', modalidad: Number(d.iva) ? 'factura_venta' : 'cuenta_cobro', estado: 'borrador', numero: '', fecha: hoyCO(), vence: sumarDias(hoyCO(), 15),
        cuenta_contable: CUENTAS.ingreso[0], condiciones: '', origen: id, origen_numero: d.numero, dian: { numero: '', cufe: '' }, total: totales(d).total,
        creado: serverTimestamp(), creado_por: usuario.email, actualizado: serverTimestamp(), actualizado_por: usuario.email };
      delete f.validez_dias; delete f.pdf_sha256; delete f.pdf_en;
      const fRef = await addDoc(collection(db, 'crm_documentos'), f);
      await updateDoc(ref, { estado: 'facturada', factura: fRef.id, actualizado: serverTimestamp(), actualizado_por: usuario.email });
      location.hash = 'doc/' + fRef.id;
    }, 'primario');
  }
  if (!cotiz && d.estado === 'borrador') boton('Emitir', async () => {
    leer(); validar();
    if (!confirm(`¿Emitir esta ${TIPOS[claseDe(d)].corto.toLowerCase()}? Recibe su consecutivo y ya no se podrá editar (solo anular).`)) return;
    await setDoc(ref, datos(), { merge: true });
    const numero = await consecutivo(claseDe(d), d.fecha);
    await updateDoc(ref, { numero, estado: 'emitida', emitida_en: serverTimestamp() });
    if (d.origen) await updateDoc(doc(db, 'crm_documentos', d.origen), { factura_numero: numero });
    await vistaDocumento(id);
  }, 'primario');
  if (!cotiz && d.estado === 'emitida') boton('Registrar pago', async () => {
    const fp = prompt('Fecha del pago (AAAA-MM-DD):', hoyCO());
    if (!fp) return;
    const referencia = prompt('Referencia o medio del pago (opcional):', 'Transferencia') ?? '';
    await setDoc(doc(db, 'crm_libro', 'factura-' + id), {
      fecha: fp, tipo: 'ingreso', cuenta: d.cuenta_contable || CUENTAS.ingreso[0], concepto: `${TIPOS[claseDe(d)].corto} ${d.numero}${d.titulo ? ' — ' + d.titulo : ''}`,
      tercero: d.receptor?.nombre || '', documento: d.receptor?.documento || '', cliente: d.cliente || '', documento_id: id, valor: totales(d).total,
      medio: referencia, referencia, estado: 'vigente', origen: 'factura', creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email,
    });
    await updateDoc(ref, { estado: 'pagada', pago: { fecha: fp, referencia, registrado_por: usuario.email }, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    await vistaDocumento(id);
  }, 'primario');
  if (!cotiz && d.estado === 'pagada') boton('Deshacer pago', async () => {
    if (!confirm('¿Volver a dejar esta factura por cobrar? El ingreso del libro contable quedará anulado.')) return;
    await anularAsiento('factura-' + id, 'Pago deshecho');
    await updateDoc(ref, { estado: 'emitida', pago: null, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    await vistaDocumento(id);
  });
  if (!cotiz && ['borrador', 'emitida'].includes(d.estado)) boton('Anular', async () => {
    const motivo = prompt('Motivo de la anulación:');
    if (!motivo) return;
    await updateDoc(ref, { estado: 'anulada', motivo_anulacion: motivo, anulada_en: serverTimestamp(), actualizado: serverTimestamp(), actualizado_por: usuario.email });
    // La cotización de origen vuelve a quedar aceptada para poder facturarla de nuevo.
    if (d.origen) await updateDoc(doc(db, 'crm_documentos', d.origen), { estado: 'aceptada', factura: '', factura_numero: '', actualizado: serverTimestamp(), actualizado_por: usuario.email });
    await vistaDocumento(id);
  }, 'peligro');
}
const receptorDe = (c) => ({ nombre: c?.nombre || '', documento: c?.documento || '', correo: c?.correo || '', telefono: c?.telefono || '', direccion: c?.direccion || '' });
async function anularAsiento(aid, motivo) {
  const aRef = doc(db, 'crm_libro', aid);
  if ((await getDoc(aRef)).exists()) await updateDoc(aRef, { estado: 'anulado', motivo_anulacion: motivo, anulado_en: serverTimestamp(), anulado_por: usuario.email, actualizado: serverTimestamp() });
}

// ───────── Docs: todos los archivos del CRM por carpeta (expedientes de clientes + documentos generales) ─────────
async function vistaDocs(carpeta) {
  nav('docs');
  const [deClientes, generales, clientes] = await Promise.all([
    getDocs(collectionGroup(db, 'archivos')).then((s) => s.docs.map((d) => ({ id: d.id, cliente: d.ref.parent.parent.id, ...d.data() }))),
    getDocs(collection(db, 'crm_docs')).then((s) => s.docs.map((d) => ({ id: d.id, cliente: '', ...d.data() }))),
    getDocs(collection(db, 'crm_clientes')).then((s) => Object.fromEntries(s.docs.map((d) => [d.id, d.data().nombre]))),
  ]);
  const todos = [...deClientes, ...generales].map((a) => ({ ...a, carpeta: carpetaDe(a) })).sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0));
  const cuenta = (k) => todos.filter((a) => a.carpeta === k).length;
  const vista = carpeta ? todos.filter((a) => a.carpeta === carpeta) : todos;
  $app.innerHTML = `<div class="cols"><div>
    <div class="card"><h2>Docs</h2><ul class="lista carpetas">
      <li data-carpeta="" class="${carpeta ? '' : 'act'}"><b>📁 Todos</b> <small>${todos.length} archivos</small></li>
      ${CARPETAS.map(([k, n]) => `<li data-carpeta="${k}" class="${k === carpeta ? 'act' : ''}"><b>📁 ${n}</b> <small>${cuenta(k)} archivos</small></li>`).join('')}</ul></div>
    <div class="card"><h2>Subir a Docs</h2><form id="fDocs"><input type="file" name="archivos" multiple required>
      <label>Carpeta</label><select name="carpeta">${opcionesCarpeta(carpeta)}</select>
      <label>Cliente</label><select name="cliente"><option value="">— Documento general de CDH Maker —</option>${Object.entries(clientes).map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select>
      <div class="acciones"><button class="primario">Subir</button></div></form><div id="mDocs"></div></div></div>
    <div class="card"><div class="sol cab" style="border:0;padding:0;margin:0 0 8px"><h2 style="margin:0">${carpeta ? esc(nombreCarpeta(carpeta)) : 'Todos los documentos'} (${vista.length})</h2>
      <input id="buscar" type="search" placeholder="Buscar por nombre o cliente" style="width:auto;min-width:220px"></div>
      ${vista.length ? `<div style="overflow-x:auto"><table id="tDocs"><tr><th>Archivo</th><th>Cliente</th>${carpeta ? '' : '<th>Carpeta</th>'}<th>Fecha</th><th></th></tr>
      ${vista.map((a, i) => `<tr data-buscar="${esc((a.nombre + ' ' + (clientes[a.cliente] || '')).toLowerCase())}"><td>${esc(a.nombre)}<br><small class="suave">${(a.tamano / 1024).toFixed(0)} KB</small></td>
        <td>${a.cliente ? `<a href="#cliente/${encodeURIComponent(a.cliente)}">${esc(clientes[a.cliente] || a.cliente)}</a>` : '<span class="suave">CDH Maker</span>'}</td>
        ${carpeta ? '' : `<td>${esc(nombreCarpeta(a.carpeta))}</td>`}<td style="white-space:nowrap">${fmtFecha(a.creado)}</td>
        <td style="white-space:nowrap"><button class="mini" data-bajar="${i}">Descargar</button> <select class="mini" data-mover="${i}" style="width:auto" title="Mover a otra carpeta">${CARPETAS.map(([k, n]) => `<option value="${k}" ${k === a.carpeta ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button class="mini peligro" data-borrar="${i}">Borrar</button></td></tr>`).join('')}</table></div>` : '<p class="suave">Esta carpeta está vacía.</p>'}</div></div>`;
  $app.querySelectorAll('[data-carpeta]').forEach((li) => li.addEventListener('click', () => (location.hash = 'docs' + (li.dataset.carpeta ? '/' + li.dataset.carpeta : ''))));
  document.getElementById('buscar').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#tDocs [data-buscar]').forEach((tr) => tr.classList.toggle('oculto', !!q && !tr.dataset.buscar.includes(q)));
  });
  $app.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => { const a = vista[b.dataset.bajar]; bajarArchivo(a.cliente, a.id, a); }));
  $app.querySelectorAll('[data-mover]').forEach((s) => s.addEventListener('change', async () => {
    const a = vista[s.dataset.mover];
    await updateDoc(doc(db, ...rutaArchivo(a.cliente, a.id)), { carpeta: s.value });
    await vistaDocs(carpeta);
  }));
  $app.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    const a = vista[b.dataset.borrar];
    if (!confirm(`¿Borrar «${a.nombre}»? No se puede deshacer.`)) return;
    await borrarArchivo(a.cliente, a.id);
    await vistaDocs(carpeta);
  }));
  document.getElementById('fDocs').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), m = document.getElementById('mDocs');
    try {
      for (const file of f.getAll('archivos')) {
        aviso(m, 'Subiendo ' + esc(file.name) + '…');
        await guardarArchivo(f.get('cliente'), { nombre: file.name, tipo: 'documento', carpeta: f.get('carpeta'), mime: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) });
      }
      await vistaDocs(carpeta);
    } catch (err) { console.error(err); aviso(m, 'No se pudo subir: ' + esc(err.code || err.message), 'err'); }
  });
}

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
      await setDoc(doc(db, 'crm_clientes', id), { ...x.cliente, actualizado: serverTimestamp(), actualizado_por: usuario.email, ...(x.nuevo ? { creado: serverTimestamp() } : {}) }, { merge: true });
      for (const s of x.solicitudes || []) await setDoc(doc(db, 'crm_clientes', id, 'solicitudes', s.id), { ...s, creado: Timestamp.fromDate(new Date(s.creado || Date.now())) }, { merge: true });
      const previos = new Set((await getDocs(collection(db, 'crm_clientes', id, 'archivos'))).docs.map((d) => d.data().sha256));
      for (const a of x.archivos || []) {
        if (previos.has(a.sha256)) continue;
        aviso(m, 'Subiendo ' + esc(a.nombre) + '…');
        await guardarArchivo(id, { ...a, bytes: deB64(a.base64) });
      }
      location.hash = 'cliente/' + encodeURIComponent(id);
    } catch (e) { console.error(e); aviso(m, 'No se pudo importar: ' + esc(e.message), 'err'); }
  });
}

// ───────── arranque ─────────
await completarEnlace();
onAuthStateChanged(auth, async (u) => {
  if (!u) { usuario = null; return pantallaAcceso(); }
  if (!ADMINS.includes((u.email || '').toLowerCase())) { await signOut(auth); return pantallaAcceso('<div class="aviso err">Esta cuenta no tiene acceso al CRM.</div>'); }
  usuario = u;
  enrutar();
});
window.addEventListener('hashchange', enrutar);
