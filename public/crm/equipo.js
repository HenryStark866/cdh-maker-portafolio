// Equipo de CDH Maker (crm_equipo/{id}): perfiles de los administradores y asesores, a quién se asignan
// clientes, campañas y gastos, y la firma preestablecida de cada persona. La firma solo la cambia su
// dueño (firestore.rules lo exige: el correo de la sesión debe estar en sus correos).
import { collection, collectionGroup, doc, getDocs, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, ctx, $app, esc, aviso, fmtFecha, nav, sello, persona } from './comun.js';
import { sha256Bytes } from './ensamblar.js?v=4';
import { leerEnlace } from './firmas.js';

// Deben coincidir con esAdmin() de firestore.rules: dar acceso a otra persona exige desplegar las reglas.
export const ADMINS = ['cdhmaker@gmail.com', 'henrytaborda57@gmail.com', 'isarias09@gmail.com'];
const BASE = [
  { id: 'henry', nombre: 'Henry Camilo Taborda Galeano', nombre_corto: 'Henry', correos: ['henrytaborda57@gmail.com', 'cdhmaker@gmail.com'], cargo: 'Fundador · Director de proyectos', rol: 'administrador', color: '#22D3EE' },
  { id: 'isa', nombre: 'Isa', nombre_corto: 'Isa', correos: ['isarias09@gmail.com'], cargo: 'Administradora', rol: 'administrador', color: '#F5B841' },
];
const ROLES = { administrador: 'Administrador (acceso total)', asesor: 'Asesor comercial' };
const COLORES = ['#22D3EE', '#F5B841', '#A78BFA', '#34D399', '#F472B6', '#60A5FA'];

// Al entrar: lee el equipo (crea los perfiles base que falten) y ubica el perfil de la sesión.
export async function cargarEquipo() {
  const snap = await getDocs(collection(db, 'crm_equipo'));
  const hay = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  for (const p of BASE) if (!hay.has(p.id)) { await setDoc(doc(db, 'crm_equipo', p.id), { ...p, activo: true, ...sello(true) }); hay.set(p.id, { ...p, activo: true }); }
  ctx.equipo = [...hay.values()].filter((p) => p.activo !== false).sort((a, b) => (a.orden ?? 9) - (b.orden ?? 9) || a.nombre.localeCompare(b.nombre));
  ctx.perfil = persona(ctx.usuario.email) || null;
}

export async function vistaEquipo([id] = []) {
  nav('equipo');
  if (id) return vistaPersona(decodeURIComponent(id));
  const clientes = (await getDocs(collection(db, 'crm_clientes'))).docs.map((d) => d.data());
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  $app.innerHTML = `<h1 class="titulo">Equipo</h1><p class="bajada">Quién atiende cada cliente, campaña y gasto. La firma preestablecida de cada persona se aplica al autorizar documentos.</p>
    <div class="grid" style="gap:16px">${ctx.equipo.map((p) => {
      const mios = clientes.filter((c) => c.responsable === p.id);
      const vencidos = mios.filter((c) => c.proximo_seguimiento && c.proximo_seguimiento <= hoy).length;
      const acceso = (p.correos || []).some((c) => ADMINS.includes(c));
      return `<a class="card" href="#equipo/${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit;display:block">
        <div style="display:flex;gap:12px;align-items:center"><span class="avatar" style="--c:${esc(p.color || '#22D3EE')};width:46px;height:46px;font-size:18px">${esc((p.nombre_corto || p.nombre).slice(0, 1))}</span>
        <div><h2 style="margin:0">${esc(p.nombre)}</h2><span class="suave">${esc(p.cargo || '')}</span></div></div>
        <p style="margin:12px 0 6px"><span class="chip ${p.rol === 'administrador' ? 'info' : 'neutro'}">${esc(ROLES[p.rol] || p.rol)}</span> ${acceso ? '<span class="chip ok">entra al CRM</span>' : '<span class="chip pendiente">sin acceso al CRM</span>'} ${p.firma?.imagen ? '<span class="chip ok">firma lista</span>' : '<span class="chip neutro">sin firma</span>'}</p>
        <p class="suave" style="margin:0">${mios.length} cliente(s) a cargo${vencidos ? ` · <b style="color:var(--err)">${vencidos} seguimiento(s) vencido(s)</b>` : ''}</p></a>`;
    }).join('')}</div>
    <div class="card" style="max-width:640px"><h2>Agregar persona</h2>
      <form id="fPersona" class="grid"><div><label>Nombre completo</label><input name="nombre" required></div><div><label>Nombre corto</label><input name="nombre_corto" required></div>
        <div><label>Correo</label><input name="correo" type="email" required></div><div><label>Cargo</label><input name="cargo" placeholder="Asesor comercial"></div>
        <div><label>Rol</label><select name="rol">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === 'asesor' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div style="align-self:end"><button class="primario">Agregar</button></div></form>
      <p class="suave">Para que una persona nueva entre al CRM, su correo debe estar en <code>esAdmin()</code> de <code>firestore.rules</code> y en <code>ADMINS</code> de <code>public/crm/equipo.js</code>, y desplegar las reglas. Mientras tanto queda como perfil para asignarle clientes y campañas.</p><div id="mPersona"></div></div>`;
  document.getElementById('fPersona').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const pid = f.nombre_corto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    if (persona(pid) || persona(f.correo.toLowerCase())) return aviso(document.getElementById('mPersona'), 'Esa persona ya está en el equipo.', 'err');
    await setDoc(doc(db, 'crm_equipo', pid), { id: pid, nombre: f.nombre, nombre_corto: f.nombre_corto, correos: [f.correo.trim().toLowerCase()], cargo: f.cargo, rol: f.rol,
      color: COLORES[ctx.equipo.length % COLORES.length], activo: true, orden: ctx.equipo.length, ...sello(true) });
    await cargarEquipo();
    location.hash = 'equipo/' + pid;
  });
}

async function vistaPersona(id) {
  const p = persona(id);
  if (!p) { $app.innerHTML = '<div class="card"><div class="aviso err">Persona no encontrada.</div></div>'; return; }
  const soyYo = ctx.perfil?.id === p.id;
  const ref = doc(db, 'crm_equipo', p.id);
  $app.innerHTML = `<p><a href="#equipo">← Equipo</a></p><h1 class="titulo">${esc(p.nombre)}</h1><p class="bajada">${esc(p.cargo || '')}</p>
  <div class="cols mitad"><div class="card"><h2>Datos</h2><form id="fDatos">
      <div class="grid"><div><label>Nombre completo</label><input name="nombre" value="${esc(p.nombre)}" required></div><div><label>Nombre corto</label><input name="nombre_corto" value="${esc(p.nombre_corto || '')}"></div>
      <div><label>Cargo</label><input name="cargo" value="${esc(p.cargo || '')}"></div><div><label>Rol</label><select name="rol">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === p.rol ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Teléfono / WhatsApp</label><input name="telefono" value="${esc(p.telefono || '')}"></div><div><label>Cédula (para contratos)</label><input name="cedula" value="${esc(p.cedula || '')}"></div>
      <div><label>Color</label><input name="color" type="color" value="${esc(p.color || '#22D3EE')}" style="height:38px;padding:3px"></div></div>
      <label>Correos (separados por coma)</label><input name="correos" value="${esc((p.correos || []).join(', '))}" ${soyYo ? 'readonly title="Tus correos de acceso no se cambian aquí"' : ''}>
      <div class="acciones"><button class="primario">Guardar</button>${!soyYo && p.rol !== 'administrador' ? '<button type="button" class="peligro" id="retirar">Retirar del equipo</button>' : ''}</div></form><div id="mDatos"></div></div>
    <div class="card"><h2>Firma preestablecida</h2>
      <p class="suave">Se agrega sola a las cotizaciones, cuentas de cobro y contratos cuando ${soyYo ? 'das' : 'esta persona da'} <b>Autorizar firma</b>, y firma automáticamente su parte de los contratos que se envían a firmar.</p>
      <div class="firma-pre">${p.firma?.imagen ? `<img src="${p.firma.imagen}" alt="Firma de ${esc(p.nombre)}">` : '<span class="suave">Sin firma</span>'}</div>
      ${p.firma?.imagen ? `<p class="suave">Origen: ${esc(p.firma.origen || '—')} · ${fmtFecha(p.firma.fecha, true)}</p>` : ''}
      ${soyYo ? `<div class="acciones"><button type="button" class="primario" id="buscar">Usar la firma de mi último contrato firmado</button><button type="button" id="dibujar">Dibujarla</button>
        <label class="boton" style="margin:0;display:inline-block;border:1px solid var(--marca);border-radius:9px;padding:6px 13px;cursor:pointer;font-size:13px">Subir imagen<input type="file" id="subir" accept="image/png,image/jpeg" class="oculto"></label></div>
        <div id="candidatas"></div>` : '<p class="aviso info">Solo la persona dueña de la firma puede cambiarla, desde su propia sesión.</p>'}
      <div id="mFirma"></div></div></div>`;

  document.getElementById('fDatos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const cambios = { nombre: f.nombre, nombre_corto: f.nombre_corto, cargo: f.cargo, rol: f.rol, telefono: f.telefono, cedula: f.cedula, color: f.color, ...sello() };
    if (!soyYo) cambios.correos = f.correos.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    await updateDoc(ref, cambios);
    await cargarEquipo();
    await vistaEquipo([p.id]);
  });
  document.getElementById('retirar')?.addEventListener('click', async () => {
    if (!confirm(`¿Retirar a ${p.nombre} del equipo? Sus registros quedan como están.`)) return;
    await updateDoc(ref, { activo: false, ...sello() });
    await cargarEquipo();
    location.hash = 'equipo';
  });
  if (!soyYo) return;

  const m = document.getElementById('mFirma');
  const guardarFirma = async (imagen, origen) => {
    const bytes = Uint8Array.from(atob(imagen.split(',')[1]), (c) => c.charCodeAt(0));
    await updateDoc(ref, { firma: { imagen, origen, fecha: new Date().toISOString(), sha256: await sha256Bytes(bytes) }, ...sello() });
    await cargarEquipo();
    await vistaEquipo([p.id]);
  };
  // Busca, en las solicitudes de firma de todos los clientes, los enlaces que esta persona ya firmó.
  document.getElementById('buscar').addEventListener('click', async () => {
    aviso(m, 'Buscando tus firmas en los expedientes…');
    const sols = (await getDocs(collectionGroup(db, 'solicitudes'))).docs.map((d) => ({ cliente: d.ref.parent.parent.id, ...d.data() }));
    const nombre = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const mias = [];
    for (const s of sols) for (const e of s.enlaces || []) {
      if (!['contratista', 'proveedor'].includes(e.rol) && !nombre(e.nombre).includes(nombre(p.nombre_corto || p.nombre))) continue;
      const X = await leerEnlace(s, e).catch(() => null);
      if (X?.estado === 'firmado' && X.firma) mias.push({ s, X });
    }
    if (!mias.length) return aviso(m, 'No encontré documentos firmados por ti. Dibuja o sube tu firma.', 'err');
    m.innerHTML = '';
    document.getElementById('candidatas').innerHTML = `<p class="suave">Elige la firma que quieres dejar preestablecida:</p>${mias.map(({ s, X }, i) => `<div class="sol cab"><div class="firma-pre" style="min-width:0"><img src="${X.firma}" alt="Firma"></div>
      <div><b>${esc(s.titulo)}</b><br><small class="suave">${fmtFecha(X.firmadoEn, true)}</small><div class="acciones"><button type="button" class="mini primario" data-usar="${i}">Usar esta</button></div></div></div>`).join('')}`;
    document.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', async () => {
      const { s, X } = mias[Number(b.dataset.usar)];
      await guardarFirma(await recortar(X.firma), `Firmada en «${s.titulo}» (${fmtFecha(X.firmadoEn)})`);
    }));
  });
  document.getElementById('subir').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    await guardarFirma(await recortar(url, { blanco: true }), 'Imagen subida');
  });
  document.getElementById('dibujar').addEventListener('click', async () => {
    const imagen = await dibujarFirma();
    if (imagen) await guardarFirma(await recortar(imagen), 'Dibujada en el CRM');
  });
}

// Recorta la firma al trazo (sin márgenes) y, si es una foto o escaneo, vuelve transparente el fondo claro.
async function recortar(url, { blanco = false } = {}) {
  const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
  const cv = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, cv.width, cv.height), d = px.data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const i = (y * cv.width + x) * 4;
    if (blanco && d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 0;
    if (d[i + 3] > 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return url;
  g.putImageData(px, 0, 0);
  const m = 6, w = x1 - x0 + 1 + 2 * m, h = y1 - y0 + 1 + 2 * m;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  out.getContext('2d').drawImage(cv, x0 - m, y0 - m, w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

function dibujarFirma() {
  return new Promise((listo) => {
    const dlg = document.createElement('dialog'); dlg.className = 'modal';
    dlg.innerHTML = `<h2>Dibuja tu firma</h2><div style="border:2px dashed #9FB4C0;border-radius:12px;background:#FBFDFE;touch-action:none"><canvas style="display:block;width:100%;height:200px;touch-action:none;cursor:crosshair"></canvas></div>
      <div class="acciones"><button type="button" data-a="borrar">Borrar</button><span style="flex:1"></span><button type="button" data-a="cancelar">Cancelar</button><button type="button" class="primario" data-a="ok">Guardar firma</button></div>`;
    document.body.append(dlg); dlg.showModal();
    const cv = dlg.querySelector('canvas'), g = cv.getContext('2d');
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); g.scale(dpr, dpr);
    Object.assign(g, { lineWidth: 2.4, lineCap: 'round', lineJoin: 'round', strokeStyle: '#0a1a33' });
    let dib = false, trazos = 0;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); dib = true; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); });
    cv.addEventListener('pointermove', (e) => { if (!dib) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); trazos++; });
    cv.addEventListener('pointerup', () => { dib = false; });
    const cerrar = (v) => { dlg.close(); dlg.remove(); listo(v); };
    dlg.addEventListener('click', (e) => {
      const a = e.target.dataset?.a;
      if (a === 'borrar') { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.restore(); trazos = 0; }
      if (a === 'cancelar') cerrar(null);
      if (a === 'ok') { if (trazos < 12) return alert('Dibuja tu firma completa.'); cerrar(cv.toDataURL('image/png')); }
    });
    dlg.addEventListener('cancel', () => cerrar(null));
  });
}

// Firma del documento: copia la imagen en el documento (si la persona cambia su firma después, lo ya
// firmado conserva la que se autorizó).
export function firmaAutorizada() {
  const p = ctx.perfil;
  if (!p?.firma?.imagen) return null;
  return { persona: p.id, nombre: p.nombre, imagen: p.firma.imagen, sha256: p.firma.sha256 || '', en: new Date().toISOString(), por: ctx.usuario.email };
}
