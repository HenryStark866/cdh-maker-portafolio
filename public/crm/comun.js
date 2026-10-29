// Utilidades compartidas por los módulos del CRM (app.js, equipo.js, pagos.js, firmas.js, libro.js,
// marketing.js…): estado de la sesión, formato, navegación y archivos en partes base64.
// Cada módulo exporta sus vistas y app.js las enruta; ninguno escribe en el DOM fuera de #app.
import { db, auth, EMULADOR } from './fb.js';
import { collection, doc, getDocs, setDoc, addDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { sha256Bytes } from './ensamblar.js?v=4';

export { db, auth, EMULADOR };

// Sesión: usuario de Firebase Auth, su perfil en crm_equipo y todo el equipo (lo llena app.js al entrar).
// Cada persona del equipo: { id: 'henry', nombre, nombre_corto, correos: [...], cargo, rol, color, firma }.
// Los campos "responsable", "pagado_por", "asesor"… guardan el id de la persona, no el correo.
export const ctx = { usuario: null, perfil: null, equipo: [] };

export const $app = document.getElementById('app');
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cop = (n) => 'COP ' + Math.round(Number(n || 0)).toLocaleString('es-CO');
export const fecha = (t) => (t?.toDate ? t.toDate() : t ? new Date(t) : null);
export const fmtFecha = (t, hora = false) => { const d = fecha(t); return d && !isNaN(d) ? d.toLocaleString('es-CO', hora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—'; };
export const aviso = (el, txt, cls = 'info') => { el.innerHTML = `<div class="aviso ${cls}">${txt}</div>`; };
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const token = () => { const b = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
export const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const descargar = (bytes, nombre, mime) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
export const hoyCO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
export const mesDe = (f) => String(f || '').slice(0, 7);
export const csv = (filas) => filas.map((r) => r.map((x) => { const s = String(x ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
// Campos de auditoría que llevan todos los documentos del CRM.
export const sello = (nuevo = false) => ({ actualizado: serverTimestamp(), actualizado_por: ctx.usuario.email, ...(nuevo ? { creado: serverTimestamp(), creado_por: ctx.usuario.email } : {}) });
// Persona del equipo por id o por cualquiera de sus correos; nombre corto para "responsable", "pagado por"…
export const persona = (id) => ctx.equipo.find((p) => p.id === id || (p.correos || []).includes(id));
export const nombreDe = (id) => { const p = persona(id); return p ? p.nombre_corto || p.nombre : id || '—'; };
export const opcionesEquipo = (sel = '', vacio = '— Sin asignar —') => `${vacio ? `<option value="">${vacio}</option>` : ''}${ctx.equipo.map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.nombre_corto || p.nombre)}</option>`).join('')}`;

// ───────── navegación (barra lateral) ─────────
// [clave, etiqueta, icono]. app.js enruta '#clave/...' a la vista de cada módulo.
export const SECCIONES = [
  ['inicio', 'Inicio', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['clientes', 'Clientes', 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8'],
  ['cotizador', 'Cotizador y cobros', 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6'],
  ['firmas', 'Firmas', 'M3 17c3-3 5-9 8-9s1 6 4 6 3-3 6-3M3 21h18'],
  ['docs', 'Docs', 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],
  ['libro', 'Contabilidad', 'M4 19V5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM8 14l3-3 2 2 3-4'],
  ['pagos', 'Medios de pago', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14h1'],
  ['marketing', 'Marketing y bots', 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14'],
  ['equipo', 'Equipo', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'],
  ['importar', 'Importar', 'M12 3v12M7 10l5 5 5-5M4 21h16'],
];
export const icono = (d, t = 18) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export function nav(actual) {
  const $nav = document.getElementById('nav');
  const p = ctx.perfil;
  $nav.innerHTML = SECCIONES.map(([k, n, d]) => `<a href="#${k}" class="${k === actual ? 'act' : ''}">${icono(d)}<span>${n}</span></a>`).join('');
  const $yo = document.getElementById('yo');
  $yo.innerHTML = `<a href="#equipo/${encodeURIComponent(p?.id || '')}" class="yo" title="${esc(ctx.usuario.email)}"><span class="avatar" style="--c:${esc(p?.color || '#22d3ee')}">${esc((p?.nombre_corto || p?.nombre || ctx.usuario.email).slice(0, 1).toUpperCase())}</span>
    <span><b>${esc(p?.nombre_corto || p?.nombre || ctx.usuario.email)}</b><small>${esc(p?.cargo || 'Administrador')}</small></span></a><button id="salir" class="mini" title="Cerrar sesión">Salir</button>`;
  document.getElementById('salir').onclick = () => signOut(auth);
  document.body.classList.remove('menu-abierto');
}

// Pestañas dentro de una vista: [[clave, etiqueta, conteo?]] → enlaces a '#base/clave'.
export const pestanas = (base, lista, actual) => `<div class="tabs">${lista.map(([k, n, c]) => `<a href="#${base}${k ? '/' + k : ''}" class="tab ${k === actual ? 'act' : ''}">${n}${c !== undefined ? ` <small>${c}</small>` : ''}</a>`).join('')}</div>`;
// Tarjeta de indicador para las cabeceras: kpi('Ingresos', cop(x), 'ok').
export const kpi = (etiqueta, valor, cls = '', nota = '') => `<div class="kpi ${cls}"><span>${etiqueta}</span><b>${valor}</b>${nota ? `<small>${nota}</small>` : ''}</div>`;

// ───────── archivos en partes base64 (Cloud Storage exige el plan Blaze) ─────────
export const PARTE = 700000; // caracteres base64 por documento de Firestore (límite 1 MiB)
// Ruta de la colección de archivos: un expediente (cliente), Docs generales ('') o cualquier ruta
// explícita como ['crm_libro', mid, 'soportes'].
const coleccionDe = (destino) => (Array.isArray(destino) ? destino : destino ? ['crm_clientes', destino, 'archivos'] : ['crm_docs']);
export async function guardarAdjunto(destino, { nombre, tipo, carpeta, mime, bytes, sha256, extra = {} }) {
  const texto = b64(bytes);
  const partes = Math.ceil(texto.length / PARTE) || 1;
  const col = coleccionDe(destino);
  const aRef = await addDoc(collection(db, ...col), {
    nombre, tipo: tipo || 'documento', ...(carpeta !== undefined ? { carpeta } : {}), mime, tamano: bytes.length, sha256: sha256 || await sha256Bytes(bytes), partes,
    creado: serverTimestamp(), creado_por: ctx.usuario.email, ...extra,
  });
  for (let n = 0; n < partes; n++) await setDoc(doc(db, ...col, aRef.id, 'partes', String(n)), { d: texto.slice(n * PARTE, (n + 1) * PARTE) });
  return aRef.id;
}
export async function leerAdjunto(destino, aid) {
  const partes = await getDocs(collection(db, ...coleccionDe(destino), aid, 'partes'));
  return deB64(partes.docs.sort((x, y) => Number(x.id) - Number(y.id)).map((p) => p.data().d).join(''));
}
export async function bajarAdjunto(destino, aid, a) { descargar(await leerAdjunto(destino, aid), a.nombre, a.mime); }
export async function borrarAdjunto(destino, aid) {
  for (const p of (await getDocs(collection(db, ...coleccionDe(destino), aid, 'partes'))).docs) await deleteDoc(p.ref);
  await deleteDoc(doc(db, ...coleccionDe(destino), aid));
}
// Lee un File del navegador como bytes; las imágenes grandes se reducen a JPEG de 1600 px para que
// un comprobante fotografiado con el celular no ocupe varias partes.
export async function bytesDe(file, { maxLado = 1600 } = {}) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400000) return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || 'application/octet-stream', nombre: file.name };
  const img = await createImageBitmap(file);
  const k = Math.min(1, maxLado / Math.max(img.width, img.height));
  const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg', nombre: file.name.replace(/\.\w+$/, '') + '.jpg' };
}
