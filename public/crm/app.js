// Panel de administración de CDH Maker (cdhmaker.com/crm): Inicio, Leads, Pipeline, Clientes (plan de pagos,
// solicitudes de firma y expediente), Proyectos, Afiliados y YAM. Este archivo es el punto de entrada:
// acceso, navegación y el módulo de Clientes; el resto vive en un archivo por módulo (ver docs/panel-admin.md).
// Acceso sin clave: el administrador escribe su correo y entra con el enlace que le llega (Firebase Auth,
// "vínculo de correo electrónico"). La seguridad real está en firestore.rules (esAdmin).
// Datos: crm_clientes/{id} (+ solicitudes/, archivos/{aid}/partes/{n}); enlaces/{token} para firmar.
import { db, auth, EMULADOR } from './fb.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ensamblar, estadoDocs, sha256Bytes } from './ensamblar.js';
import { esc, cop, fecha, fmtFecha, aviso, slug, resumenPagos, RE_CODIGO } from './util.js?v=1';
import { vistaInicio } from './inicio.js?v=1';
import { vistaLeads, vistaLead } from './leads.js?v=1';
import { vistaPipeline, vistaOportunidad } from './pipeline.js?v=1';
import { vistaProyectos, vistaProyecto } from './proyectos.js?v=1';
import { vistaAfiliados, vistaAfiliado } from './afiliados.js?v=1';
import { vistaYam } from './yam.js?v=1';
import { bitacora } from './actividades.js?v=1';

// Deben coincidir con esAdmin() de firestore.rules.
const ADMINS = ['cdhmaker@gmail.com', 'henrytaborda57@gmail.com', 'isarias09@gmail.com'];
// Proyecto de firma anterior (enlaces creados con firmas/crear.mjs): lectura pública por token.
const FIRMAS_LEGADO = { api: 'AIzaSyCeHUBzJpRbaSHHnvR7vwSUKyXqO0e1JGk', base: 'https://firestore.googleapis.com/v1/projects/cdhmaker-firmas/databases/(default)/documents/firmas/' };
const CLAVE_CORREO = 'cdh_crm_correo';
const PARTE = 700000; // caracteres base64 por documento de Firestore (límite 1 MiB)

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
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
    <h2>Entrar al panel</h2>
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
const MODULOS = [['inicio', 'Inicio'], ['leads', 'Leads'], ['pipeline', 'Pipeline'], ['clientes', 'Clientes'], ['proyectos', 'Proyectos'], ['afiliados', 'Afiliados'], ['yam', 'YAM'], ['importar', 'Importar']];
function tema() {
  const r = document.documentElement;
  const oscuroAhora = r.dataset.tema ? r.dataset.tema === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.tema = oscuroAhora ? 'claro' : 'oscuro';
  try { localStorage.setItem('cdh_crm_tema', r.dataset.tema); } catch { }
}
function nav(actual) {
  $nav.innerHTML = MODULOS.map(([k, l]) => `<button data-ir="${k}" class="${actual === k ? 'act' : ''}">${l}</button>`).join('')
    + `<button id="tema" title="Cambiar tema claro/oscuro" aria-label="Cambiar tema">◐</button><span class="quien">${esc(usuario.email)}</span><button id="salir">Salir</button>`;
  $nav.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => (location.hash = b.dataset.ir)));
  document.getElementById('salir').addEventListener('click', () => signOut(auth));
  document.getElementById('tema').addEventListener('click', tema);
}
async function enrutar() {
  if (!usuario) return;
  const [ruta, crudo] = location.hash.slice(1).split('/');
  const id = crudo ? decodeURIComponent(crudo) : '';
  const ctx = { nav, usuario };
  try {
    if (ruta === 'cliente' && id) return await vistaCliente(id);
    if (ruta === 'clientes') return await vistaClientes();
    if (ruta === 'importar') return vistaImportar();
    if (ruta === 'leads') return await vistaLeads(ctx);
    if (ruta === 'lead' && id) return await vistaLead(id, ctx);
    if (ruta === 'pipeline') return await vistaPipeline(ctx);
    if (ruta === 'op' && id) return await vistaOportunidad(id, ctx);
    if (ruta === 'proyectos') return await vistaProyectos(ctx);
    if (ruta === 'proyecto' && id) return await vistaProyecto(id, ctx);
    if (ruta === 'afiliados') return await vistaAfiliados(ctx);
    if (ruta === 'afiliado' && id) return await vistaAfiliado(id, ctx);
    if (ruta === 'yam') return await vistaYam(ctx);
    return await vistaInicio(ctx);
  } catch (e) { console.error(e); $app.innerHTML = `<div class="card"><div class="aviso err">Error: ${esc(e.code || e.message)}</div></div>`; }
}

// ───────── clientes ─────────

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
  ['correo', 'Correo'], ['telefono', 'Teléfono'], ['direccion', 'Ciudad y dirección'], ['proyecto', 'Proyecto'], ['valor_total', 'Valor total (COP)'], ['estado', 'Estado (activo, pagado, cerrado)'],
  ['afiliado', 'Código de afiliado que lo refirió (comisión)']];

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
    <div class="card"><h2>Firmas</h2><div id="solicitudes"><p class="suave">Cargando…</p></div>
      <details><summary class="suave" style="cursor:pointer">Nueva solicitud de firma</summary>${formSolicitud()}</details></div>
    <div class="card"><h2>Expediente</h2><div id="archivos"><p class="suave">Cargando…</p></div>
      <div class="acciones"><input type="file" id="fArchivo" multiple style="width:auto"><button class="mini" id="subir">Subir al expediente</button></div><div id="mArchivo"></div></div>
    <div class="card"><h2>Proyectos</h2><div id="proyCli"><p class="suave">Cargando…</p></div></div>
    <div class="card" id="bitCli"></div>
  </div></div>`;
  bitacora(document.getElementById('bitCli'), usuario, 'cliente', id);
  getDocs(collection(db, 'crm_proyectos')).then((s) => {
    const el = document.getElementById('proyCli');
    const ps = s.docs.filter((d) => d.data().cliente_id === id);
    el.innerHTML = ps.length ? `<ul class="lista">${ps.map((d) => `<li data-p="${esc(d.id)}"><b>${esc(d.data().nombre)}</b><small>${esc(d.data().estado)}${d.data().url_produccion ? ' · ' + esc(d.data().url_produccion) : ''}</small></li>`).join('')}</ul>`
      : '<p class="suave">Sin proyectos. <a href="#proyectos">Crear uno en Proyectos</a>.</p>';
    el.querySelectorAll('[data-p]').forEach((li) => li.addEventListener('click', () => (location.hash = 'proyecto/' + encodeURIComponent(li.dataset.p))));
  }).catch(() => { document.getElementById('proyCli').innerHTML = '<p class="suave">No se pudieron leer los proyectos.</p>'; });

  const guardar = async (cambios) => { await updateDoc(ref, { ...cambios, actualizado: serverTimestamp(), actualizado_por: usuario.email }); await vistaCliente(id); };
  document.getElementById('fDatos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.valor_total !== '') f.valor_total = Number(f.valor_total) || 0;
    f.afiliado = String(f.afiliado || '').trim().toLowerCase();
    if (f.afiliado && !RE_CODIGO.test(f.afiliado)) return aviso(document.getElementById('mDatos'), 'El código de afiliado debe tener 4–20 caracteres: a-z, 0-9 o guiones.', 'err');
    await guardar(f);
  });
  $app.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.pagar);
    const fp = prompt('Fecha del pago (AAAA-MM-DD):', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
    if (!fp) return;
    const ref2 = prompt('Referencia o nota del pago (opcional):', 'Transferencia') ?? '';
    const cuotas = [...c.cuotas]; cuotas[i] = { ...cuotas[i], estado: 'pagada', fecha_pago: fp, referencia: ref2, registrado_por: usuario.email };
    await guardar({ cuotas });
  }));
  $app.querySelectorAll('[data-desmarcar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Marcar esta cuota como pendiente otra vez?')) return;
    const cuotas = [...c.cuotas]; const { fecha_pago, referencia, registrado_por, ...resto } = cuotas[Number(b.dataset.desmarcar)];
    cuotas[Number(b.dataset.desmarcar)] = { ...resto, estado: 'pendiente' };
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
    for (const f of files) { aviso(m, 'Subiendo ' + esc(f.name) + '…'); await guardarArchivo(id, { nombre: f.name, tipo: 'documento', mime: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) }); }
    await vistaCliente(id);
  });
  enlazarSolicitud(id, c);
  pintarSolicitudes(id, c);
  pintarArchivos(id);
}

// ───────── expediente (archivos en partes base64: Cloud Storage exige plan Blaze) ─────────
async function guardarArchivo(cliente, { nombre, tipo, mime, bytes, sha256 }) {
  const texto = b64(bytes);
  const partes = Math.ceil(texto.length / PARTE) || 1;
  const aRef = await addDoc(collection(db, 'crm_clientes', cliente, 'archivos'), {
    nombre, tipo, mime, tamano: bytes.length, sha256: sha256 || await sha256Bytes(bytes), partes, creado: serverTimestamp(), creado_por: usuario.email,
  });
  for (let n = 0; n < partes; n++) await setDoc(doc(db, 'crm_clientes', cliente, 'archivos', aRef.id, 'partes', String(n)), { d: texto.slice(n * PARTE, (n + 1) * PARTE) });
  return aRef.id;
}
async function pintarArchivos(cliente) {
  const el = document.getElementById('archivos');
  const snap = await getDocs(query(collection(db, 'crm_clientes', cliente, 'archivos'), orderBy('creado', 'desc')));
  if (!snap.size) { el.innerHTML = '<p class="suave">Sin archivos todavía.</p>'; return; }
  el.innerHTML = `<table><tr><th>Archivo</th><th>Tipo</th><th>Fecha</th><th></th></tr>${snap.docs.map((d) => { const a = d.data(); return `<tr><td>${esc(a.nombre)}<br><small class="suave">${(a.tamano / 1024).toFixed(0)} KB · SHA-256 ${esc((a.sha256 || '').slice(0, 12))}…</small></td><td>${esc(a.tipo)}</td><td>${fmtFecha(a.creado, true)}</td>
    <td><button class="mini" data-bajar="${d.id}">Descargar</button> <button class="mini peligro" data-borrar="${d.id}">Borrar</button></td></tr>`; }).join('')}</table>`;
  el.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', async () => {
    const a = snap.docs.find((d) => d.id === b.dataset.bajar).data();
    const partes = await getDocs(collection(db, 'crm_clientes', cliente, 'archivos', b.dataset.bajar, 'partes'));
    const texto = partes.docs.sort((x, y) => Number(x.id) - Number(y.id)).map((p) => p.data().d).join('');
    descargar(deB64(texto), a.nombre, a.mime);
  }));
  el.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar este archivo del expediente? No se puede deshacer.')) return;
    const partes = await getDocs(collection(db, 'crm_clientes', cliente, 'archivos', b.dataset.borrar, 'partes'));
    for (const p of partes.docs) await deleteDoc(p.ref);
    await deleteDoc(doc(db, 'crm_clientes', cliente, 'archivos', b.dataset.borrar));
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
