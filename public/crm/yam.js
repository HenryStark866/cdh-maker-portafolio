// YAM — SaaS estrella de CDH Maker. Consume la API privada https://yam.cdhmaker.com/api/cdh/*
// (la construye el repo de YAM; contrato en docs/panel-admin.md §YAM).
// La llave (Bearer) se pide una vez y vive SOLO en sessionStorage de esta pestaña: nunca en el código
// ni en Firestore. La URL base es configurable (p. ej. http://localhost:3000 para probar).
import { esc, cop, copCorto, fmtFecha, aviso, dialogo, opciones, num, RE_CODIGO, copiar } from './util.js?v=1';

const CLAVE_TOKEN = 'cdh_yam_token';
const CLAVE_BASE = 'cdh_yam_base';
const BASE_DEFECTO = 'https://yam.cdhmaker.com';

const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { } } };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };

export const yamBase = () => (ls.get(CLAVE_BASE) || BASE_DEFECTO).replace(/\/+$/, '');
export const yamToken = () => ss.get(CLAVE_TOKEN);
const baseValida = (u) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);

// Llamada a la API. Nunca lanza: devuelve { ok, datos } o { ok:false, tipo, mensaje }.
export async function yamApi(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = yamToken();
  if (!token) return { ok: false, tipo: 'sin_llave', mensaje: 'Falta la llave del panel.' };
  let r;
  try {
    r = await fetch(yamBase() + '/api/cdh' + ruta, {
      method: metodo, mode: 'cors', credentials: 'omit', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (e) {
    return { ok: false, tipo: 'red', mensaje: e.name === 'TimeoutError' ? 'YAM no respondió en 15 s.' : 'No hay conexión con YAM (red caída, URL equivocada o CORS no permite este origen).' };
  }
  let datos = null;
  try { datos = await r.json(); } catch { }
  if (r.status === 401 || r.status === 403) return { ok: false, tipo: 'llave', mensaje: 'YAM rechazó la llave (401). Revísala o pide una nueva.', status: r.status };
  if (r.status === 503) return { ok: false, tipo: 'sin_config', mensaje: 'YAM aún no tiene configurada la llave del panel (CDH_PANEL_TOKEN) — 503.', status: 503 };
  if (r.status === 404) return { ok: false, tipo: 'no_existe', mensaje: 'Esta función de la API todavía no existe en YAM (404). Puede que no se haya desplegado.', status: 404 };
  if (!r.ok) return { ok: false, tipo: 'http', mensaje: `YAM respondió ${r.status}${datos?.error ? ': ' + esc(datos.error) : ''}.`, status: r.status };
  return { ok: true, datos: datos || {}, pendiente: !!datos?.pendiente_migracion };
}

const PENDIENTE = '<div class="aviso warn">La base de YAM aún no tiene las tablas de esta función (<code>pendiente_migracion</code>). Henry decide cuándo aplicar las migraciones 0157+ en producción.</div>';
export function errorYam(res) {
  const extra = res.tipo === 'llave' ? ' <button class="mini" data-yam-llave>Cambiar llave</button>' : res.tipo === 'red' ? ` <span class="suave">URL: ${esc(yamBase())}</span>` : '';
  return `<div class="aviso ${res.tipo === 'sin_config' || res.tipo === 'no_existe' ? 'warn' : 'err'}">${res.mensaje}${extra}</div>`;
}

// ───────── vista ─────────
const ESTADOS_CAMP = [['borrador', 'Borrador'], ['activa', 'Activa'], ['pausada', 'Pausada'], ['terminada', 'Terminada']];
const TIPOS_CAMP = [['banner_vitrina', 'Banner en vitrina'], ['oferta_destacada', 'Oferta destacada'], ['cinta_cdh', 'Cinta en cdhmaker.com']];
let pestana = 'resumen';

export async function vistaYam({ nav }) {
  nav('yam');
  const $app = document.getElementById('app');
  if (!yamToken()) return pantallaLlave($app, () => vistaYam({ nav }));
  $app.innerHTML = `<div class="barra"><h1 style="margin:0">YAM <span class="suave">· ${esc(yamBase())}</span></h1>
    <div class="filtros"><button class="mini" id="yCfg">Configurar</button><button class="mini peligro" id="yOlvidar">Olvidar llave</button></div></div>
    <div class="pestanas">${[['resumen', 'Resumen'], ['comercios', 'Comercios'], ['campanas', 'Campañas'], ['afiliados', 'Afiliados YAM']]
      .map(([k, l]) => `<button data-p="${k}" class="${pestana === k ? 'act' : ''}">${l}</button>`).join('')}</div><div id="yCuerpo"><div class="card suave">Consultando YAM…</div></div>`;
  $app.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.p; vistaYam({ nav }); }));
  document.getElementById('yCfg').addEventListener('click', () => pantallaLlave($app, () => vistaYam({ nav })));
  document.getElementById('yOlvidar').addEventListener('click', () => { ss.set(CLAVE_TOKEN, null); vistaYam({ nav }); });
  const el = document.getElementById('yCuerpo');
  const rehacer = () => vistaYam({ nav });
  if (pestana === 'comercios') await comercios(el);
  else if (pestana === 'campanas') await campanas(el, rehacer);
  else if (pestana === 'afiliados') await afiliadosYam(el, rehacer);
  else await resumen(el);
  el.querySelectorAll('[data-yam-llave]').forEach((b) => b.addEventListener('click', () => pantallaLlave($app, rehacer)));
}

function pantallaLlave($app, listo) {
  $app.innerHTML = `<div class="card" style="max-width:520px;margin:24px auto"><h2>Conectar con YAM</h2>
    <p class="suave">La llave del panel es el valor de <code>CDH_PANEL_TOKEN</code> en el servidor de YAM. Se guarda solo en esta pestaña (sessionStorage) y se borra al cerrarla.</p>
    <form id="fLlave"><label>URL base de YAM</label><input name="base" value="${esc(yamBase())}" required placeholder="${BASE_DEFECTO}">
    <p class="suave">Producción: <code>${BASE_DEFECTO}</code> · pruebas locales: <code>http://localhost:3000</code></p>
    <label>Llave del panel</label><input name="token" type="password" autocomplete="off" ${yamToken() ? 'placeholder="(se mantiene la actual si la dejas vacía)"' : 'required'}>
    <div class="acciones"><button class="primario">Conectar</button></div></form><div id="mLlave"></div></div>`;
  document.getElementById('fLlave').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const base = String(f.get('base')).trim().replace(/\/+$/, '');
    if (!baseValida(base)) return aviso(document.getElementById('mLlave'), 'La URL debe ser https://… (o http://localhost:puerto para pruebas).', 'err');
    ls.set(CLAVE_BASE, base === BASE_DEFECTO ? null : base);
    const t = String(f.get('token') || '').trim();
    if (t) ss.set(CLAVE_TOKEN, t);
    const res = await yamApi('/resumen');
    if (!res.ok && res.tipo === 'llave') { ss.set(CLAVE_TOKEN, null); return aviso(document.getElementById('mLlave'), res.mensaje, 'err'); }
    if (!res.ok) aviso(document.getElementById('mLlave'), res.mensaje + ' La llave quedó guardada; puedes seguir.', 'warn');
    setTimeout(listo, res.ok ? 0 : 1800);
  });
}

// Tarjeta resumida para el tablero de Inicio
export async function tarjetaYam(el) {
  if (!yamToken()) { el.innerHTML = `<h2>YAM</h2><p class="suave">Conecta la API de YAM para ver comercios, guías y ventas.</p><a href="#yam">Conectar YAM →</a>`; return; }
  const res = await yamApi('/resumen');
  if (!res.ok) { el.innerHTML = `<h2>YAM</h2>${errorYam(res)}<p><a href="#yam">Abrir YAM →</a></p>`; return; }
  const r = res.datos;
  el.innerHTML = `<h2>YAM <span class="suave">· últimos 30 días</span></h2>${res.pendiente ? PENDIENTE : ''}
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin:0">
    ${kpi('Comercios', r.comercios, `${num(r.comercios_activos_30d)} activos`)}${kpi('Guías', r.guias_30d)}${kpi('Ventas', copCorto(r.ventas_30d_cop), 'COP')}
    ${kpi('Campañas activas', r.campanas_activas)}${kpi('Referidos', r.referidos_30d)}</div><p><a href="#yam">Abrir YAM →</a></p>`;
}
const kpi = (t, v, d = '') => `<div class="kpi"><div class="t">${esc(t)}</div><div class="v">${esc(v ?? '—')}</div>${d ? `<div class="d">${esc(d)}</div>` : ''}</div>`;

async function resumen(el) {
  const res = await yamApi('/resumen');
  if (!res.ok) { el.innerHTML = `<div class="card">${errorYam(res)}</div>`; return; }
  const r = res.datos;
  el.innerHTML = `${res.pendiente ? PENDIENTE : ''}<div class="kpis">
    ${kpi('Comercios', r.comercios, `${num(r.comercios_activos_30d)} activos en 30 días`)}${kpi('Guías (30 d)', r.guias_30d)}
    ${kpi('Ventas (30 d)', cop(r.ventas_30d_cop))}${kpi('Campañas activas', r.campanas_activas)}${kpi('Referidos (30 d)', r.referidos_30d)}</div>
    <p class="suave">Datos en vivo de ${esc(yamBase())}. Nada de esto se guarda en Firestore.</p>`;
}

let busca = '', pagina = 1, tamPag = 1;
async function comercios(el) {
  const res = await yamApi(`/comercios?buscar=${encodeURIComponent(busca)}&pagina=${pagina}`);
  const barra = `<form id="fBus" class="acciones" style="margin:0 0 12px"><input name="b" value="${esc(busca)}" placeholder="Buscar comercio" style="max-width:260px"><button class="mini">Buscar</button></form>`;
  if (!res.ok) { el.innerHTML = `<div class="card">${barra}${errorYam(res)}</div>`; }
  else {
    const { items = [], total = 0 } = res.datos;
    tamPag = Math.max(tamPag, items.length);
    el.innerHTML = `<div class="card">${barra}${res.pendiente ? PENDIENTE : ''}
      ${items.length ? `<div class="tabla"><table><tr><th>Comercio</th><th>Ciudad</th><th>Plan</th><th>Creado</th><th class="num">Guías 30 d</th><th class="num">Ventas 30 d</th><th>Estado</th></tr>
      ${items.map((c) => `<tr><td><b>${esc(c.nombre)}</b><br><small class="suave">${esc(c.slug || '')}</small></td><td>${esc(c.ciudad || '—')}</td><td>${esc(c.plan || '—')}</td>
        <td>${fmtFecha(c.creado)}</td><td class="num">${num(c.guias_30d)}</td><td class="num">${cop(c.ventas_30d_cop)}</td><td><span class="chip ${c.activo ? 'activo' : 'pausado'}">${c.activo ? 'activo' : 'inactivo'}</span></td></tr>`).join('')}
      </table></div>` : '<div class="vacio">Sin comercios para mostrar.</div>'}
      <div class="acciones"><span class="suave">${num(total)} en total · página ${pagina}</span>
      <button class="mini" id="pAnt" ${pagina <= 1 ? 'disabled' : ''}>Anterior</button><button class="mini" id="pSig" ${items.length === 0 || pagina * tamPag >= total ? 'disabled' : ''}>Siguiente</button></div></div>`;
    el.querySelector('#pAnt')?.addEventListener('click', () => { pagina--; comercios(el); });
    el.querySelector('#pSig')?.addEventListener('click', () => { pagina++; comercios(el); });
  }
  el.querySelector('#fBus').addEventListener('submit', (e) => { e.preventDefault(); busca = new FormData(e.target).get('b').trim(); pagina = 1; comercios(el); });
}

const formCampana = (c = {}) => `<div class="grid">
  <div><label>Nombre interno</label><input name="nombre" required maxlength="120" value="${esc(c.nombre || '')}"></div>
  <div><label>Tipo</label><select name="tipo">${opciones(TIPOS_CAMP, c.tipo)}</select></div>
  <div><label>Estado</label><select name="estado">${opciones(ESTADOS_CAMP, c.estado || 'borrador')}</select></div>
  <div><label>ID del comercio (vacío = campaña de CDH)</label><input name="comercio_id" value="${esc(c.comercio_id || '')}"></div></div>
  <label>Título</label><input name="titulo" required maxlength="120" value="${esc(c.titulo || '')}">
  <label>Texto</label><textarea class="txt" name="texto" maxlength="400">${esc(c.texto || '')}</textarea>
  <div class="grid"><div><label>Imagen (URL pública)</label><input name="imagen" type="url" value="${esc(c.imagen || '')}"></div>
  <div><label>URL de destino</label><input name="url_destino" type="url" required value="${esc(c.url_destino || '')}"></div>
  <div><label>Inicia</label><input name="inicia" type="date" value="${esc((c.inicia || '').slice(0, 10))}"></div>
  <div><label>Termina</label><input name="termina" type="date" value="${esc((c.termina || '').slice(0, 10))}"></div>
  <div><label>Presupuesto (COP)</label><input name="presupuesto_cop" type="number" min="0" step="1000" value="${esc(c.presupuesto_cop ?? '')}"></div></div>`;
const limpiarCampana = (f) => ({ ...f, comercio_id: f.comercio_id || null, imagen: f.imagen || null, inicia: f.inicia || null, termina: f.termina || null, presupuesto_cop: f.presupuesto_cop === '' ? null : num(f.presupuesto_cop) });

async function campanas(el, rehacer) {
  const res = await yamApi('/campanas');
  const nueva = '<button class="primario" id="cNueva">Nueva campaña</button>';
  if (!res.ok) { el.innerHTML = `<div class="card">${errorYam(res)}</div>`; return; }
  const items = res.datos.items || [];
  el.innerHTML = `<div class="card"><div class="barra"><h2 style="margin:0">Campañas publicitarias (${items.length})</h2>${res.pendiente ? '' : nueva}</div>${res.pendiente ? PENDIENTE : ''}
    ${items.length ? `<div class="tabla"><table><tr><th>Campaña</th><th>Tipo</th><th>Vigencia</th><th class="num">Impresiones</th><th class="num">Clics</th><th class="num">CTR</th><th class="num">Presupuesto</th><th>Estado</th><th></th></tr>
    ${items.map((c, i) => `<tr><td><b>${esc(c.nombre)}</b><br><small class="suave">${esc(c.titulo || '')}</small></td><td>${esc((TIPOS_CAMP.find((t) => t[0] === c.tipo) || [, c.tipo])[1])}</td>
      <td><small>${fmtFecha(c.inicia)} → ${fmtFecha(c.termina)}</small></td><td class="num">${num(c.impresiones).toLocaleString('es-CO')}</td><td class="num">${num(c.clics).toLocaleString('es-CO')}</td>
      <td class="num">${num(c.impresiones) ? (num(c.clics) / num(c.impresiones) * 100).toFixed(1) + ' %' : '—'}</td><td class="num">${c.presupuesto_cop != null ? cop(c.presupuesto_cop) : '—'}</td>
      <td><span class="chip ${esc(c.estado)}">${esc(c.estado)}</span></td>
      <td style="white-space:nowrap">${c.estado !== 'activa' && c.estado !== 'terminada' ? `<button class="mini primario" data-est="${i}:activa">Activar</button>` : ''}
        ${c.estado === 'activa' ? `<button class="mini" data-est="${i}:pausada">Pausar</button>` : ''}
        ${c.estado !== 'terminada' ? `<button class="mini" data-edit="${i}">Editar</button>` : ''}</td></tr>`).join('')}</table></div>`
    : `<div class="vacio">${res.pendiente ? 'Disponible cuando se apliquen las migraciones.' : 'Aún no hay campañas. Crea la primera.'}</div>`}<div id="mCamp"></div></div>`;
  const m = el.querySelector('#mCamp');
  el.querySelector('#cNueva')?.addEventListener('click', async () => {
    const f = await dialogo('Nueva campaña', formCampana(), { boton: 'Crear', ancho: 640 });
    if (!f) return;
    const r = await yamApi('/campanas', { metodo: 'POST', cuerpo: limpiarCampana(f) });
    if (!r.ok) return (m.innerHTML = errorYam(r));
    rehacer();
  });
  el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', async () => {
    const c = items[Number(b.dataset.edit)];
    const f = await dialogo('Editar campaña', formCampana(c), { ancho: 640 });
    if (!f) return;
    const r = await yamApi('/campanas/' + encodeURIComponent(c.id), { metodo: 'PATCH', cuerpo: limpiarCampana(f) });
    if (!r.ok) return (m.innerHTML = errorYam(r));
    rehacer();
  }));
  el.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', async () => {
    const [i, estado] = b.dataset.est.split(':');
    b.disabled = true;
    const r = await yamApi('/campanas/' + encodeURIComponent(items[Number(i)].id), { metodo: 'PATCH', cuerpo: { estado } });
    if (!r.ok) { b.disabled = false; return (m.innerHTML = errorYam(r)); }
    rehacer();
  }));
}

async function afiliadosYam(el, rehacer) {
  const res = await yamApi('/afiliados');
  if (!res.ok) { el.innerHTML = `<div class="card">${errorYam(res)}</div>`; return; }
  const items = res.datos.items || [];
  el.innerHTML = `<div class="card"><div class="barra"><h2 style="margin:0">Afiliados de YAM (${items.length})</h2>${res.pendiente ? '' : '<button class="primario" id="aNuevo">Nuevo afiliado YAM</button>'}</div>
    ${res.pendiente ? PENDIENTE : ''}
    <p class="suave">Comisión base YAM: 20 % de lo que YAM facture al comercio referido durante 6 meses, solo sobre lo cobrado. Enlace: <code>${esc(yamBase())}/registro?ref=&lt;código&gt;</code></p>
    ${items.length ? `<div class="tabla"><table><tr><th>Afiliado</th><th>Código</th><th class="num">%</th><th class="num">Referidos</th><th class="num">Comisiones pendientes</th><th>Estado</th><th></th></tr>
    ${items.map((a, i) => `<tr><td><b>${esc(a.nombre)}</b><br><small class="suave">${esc(a.email || '')} ${esc(a.telefono || '')}</small></td><td><code>${esc(a.codigo)}</code></td>
      <td class="num">${num(a.comision_pct)}</td><td class="num">${num(a.referidos)}</td><td class="num">${cop(a.comisiones_pendientes_cop)}</td><td><span class="chip ${esc(a.estado)}">${esc(a.estado)}</span></td>
      <td style="white-space:nowrap"><button class="mini" data-copiar="${i}">Copiar enlace</button> <button class="mini" data-ref="${i}">Referidos</button></td></tr>`).join('')}</table></div>`
    : `<div class="vacio">${res.pendiente ? 'Disponible cuando se apliquen las migraciones.' : 'Sin afiliados de YAM todavía.'}</div>`}
    <div id="yRef"></div></div>`;
  el.querySelector('#aNuevo')?.addEventListener('click', async () => {
    const f = await dialogo('Nuevo afiliado de YAM', `<label>Nombre</label><input name="nombre" required maxlength="120">
      <div class="grid"><div><label>Código (4–20, a-z 0-9 -)</label><input name="codigo" required pattern="[a-z0-9\\-]{4,20}"></div><div><label>Comisión %</label><input name="comision_pct" type="number" min="0" max="50" value="20"></div>
      <div><label>Correo</label><input name="email" type="email"></div><div><label>Teléfono</label><input name="telefono"></div></div>`, { boton: 'Crear' });
    if (!f) return;
    if (!RE_CODIGO.test(f.codigo)) return alert('Código inválido');
    const r = await yamApi('/afiliados', { metodo: 'POST', cuerpo: { ...f, comision_pct: num(f.comision_pct) } });
    if (!r.ok) return (el.querySelector('#yRef').innerHTML = errorYam(r));
    rehacer();
  });
  el.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiar(`${yamBase()}/registro?ref=${items[Number(b.dataset.copiar)].codigo}`, b)));
  el.querySelectorAll('[data-ref]').forEach((b) => b.addEventListener('click', async () => {
    const a = items[Number(b.dataset.ref)];
    const box = el.querySelector('#yRef');
    box.innerHTML = '<p class="suave">Consultando referidos…</p>';
    const r = await yamApi('/referidos?afiliado=' + encodeURIComponent(a.codigo));
    if (!r.ok) return (box.innerHTML = errorYam(r));
    const it = r.datos.items || [];
    box.innerHTML = `<h3>Referidos de ${esc(a.nombre)}</h3>${it.length ? `<div class="tabla"><table><tr><th>Comercio</th><th>Registrado</th><th>Primera venta</th><th class="num">Comisión</th><th>Estado</th></tr>
      ${it.map((x) => `<tr><td>${esc(x.comercio_nombre)}</td><td>${fmtFecha(x.registrado)}</td><td>${fmtFecha(x.primera_venta)}</td><td class="num">${cop(x.comision_cop)}</td><td><span class="chip ${esc(x.estado)}">${esc(x.estado)}</span></td></tr>`).join('')}</table></div>`
      : '<div class="vacio">Sin referidos todavía.</div>'}`;
  }));
}
