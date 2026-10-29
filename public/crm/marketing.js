// CRM → Marketing y bots: campañas de pauta (con métricas, UTM y paso de la inversión al libro contable),
// redes sociales, calendario editorial, bots y automatizaciones, y el inventario de plataformas y negocios.
// Colecciones (solo administradores): crm_campanas, crm_redes, crm_publicaciones (+ archivos/{aid}/partes/{n}),
// crm_bots, crm_plataformas. Nada de esto es contable, así que se puede borrar (con confirmación); lo
// contable (la inversión en pauta) vive en crm_libro y se registra una sola vez por métrica.
// Nunca se guardan contraseñas ni tokens: el campo "dónde está el acceso" es solo una pista (p. ej. "Bitwarden → Meta").
import { db, ctx, $app, esc, cop, aviso, slug, hoyCO, mesDe, sello, nombreDe, opcionesEquipo, nav, pestanas, kpi,
  guardarAdjunto, bajarAdjunto, borrarAdjunto, bytesDe } from './comun.js';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { registrarMovimiento } from './libro.js';

// ── puras (sin DOM ni Firestore; se prueban con Node) ──
const PLATAFORMAS_ADS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'YouTube', 'Email', 'WhatsApp', 'Orgánico', 'Otro'];
const OBJETIVOS = ['alcance', 'tráfico', 'mensajes', 'leads', 'ventas'];
const ESTADOS_CAMPANA = ['planeada', 'activa', 'pausada', 'terminada'];
const REDES = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'X', 'WhatsApp Business', 'Google Business Profile', 'Pinterest', 'Otro'];
const FORMATOS = ['post', 'carrusel', 'reel', 'historia', 'video', 'artículo', 'email'];
const ESTADOS_PUB = ['idea', 'en diseño', 'aprobado', 'programado', 'publicado'];
const TIPOS_BOT = ['WhatsApp', 'Chatbot web', 'Instagram/Messenger', 'Telegram', 'Agente IA', 'Voz', 'Automatización (n8n/Make/Zapier)', 'Otro'];
const ESTADOS_BOT = ['activo', 'pausado', 'en desarrollo', 'caído'];
const SALUD = [['responde', 'Responde'], ['deriva', 'Deriva a un humano'], ['lead', 'Captura el lead'], ['mensajes', 'Mensajes actualizados']];
const TIPOS_PLAT = ['sitio', 'SaaS', 'app', 'tienda', 'servicio'];
const ESTADOS_PLAT = ['activo', 'en desarrollo', 'pausado', 'retirado'];
// utm_source / utm_medium sugeridos y administrador de anuncios de cada plataforma.
const UTM_DE = {
  'Meta Ads': ['facebook', 'paid_social', 'https://adsmanager.facebook.com/'], 'Google Ads': ['google', 'cpc', 'https://ads.google.com/'],
  'TikTok Ads': ['tiktok', 'paid_social', 'https://ads.tiktok.com/'], 'LinkedIn Ads': ['linkedin', 'paid_social', 'https://www.linkedin.com/campaignmanager/'],
  YouTube: ['youtube', 'video', 'https://studio.youtube.com/'], Email: ['newsletter', 'email', ''], WhatsApp: ['whatsapp', 'mensajeria', ''], 'Orgánico': ['organico', 'social', ''],
};

const num = (x) => { const n = Number(String(x ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const div0 = (a, b) => (b ? a / b : null);
// Fechas 'AAAA-MM-DD' tratadas en UTC para que el huso horario no corra el día.
const aUTC = (f) => { const [a, m, d] = String(f).split('-').map(Number); return Date.UTC(a, m - 1, d || 1); };
const deUTC = (t) => new Date(t).toISOString().slice(0, 10);
const sumarDias = (f, n) => deUTC(aUTC(f) + n * 864e5);
const diasEntre = (a, b) => Math.round((aUTC(b) - aUTC(a)) / 864e5);
const moverMes = (ym, n) => { const [a, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

// Indicadores de un conjunto de registros {inversion, impresiones, clics, leads, ventas, ingresos}.
function indicadores(regs = []) {
  const t = { inversion: 0, impresiones: 0, clics: 0, leads: 0, ventas: 0, ingresos: 0 };
  for (const r of regs) for (const k in t) t[k] += num(r[k]);
  return { ...t, ctr: div0(t.clics, t.impresiones), cpc: div0(t.inversion, t.clics), cpl: div0(t.inversion, t.leads), cpm: div0(t.inversion * 1000, t.impresiones),
    roas: div0(t.ingresos, t.inversion), cpa: div0(t.inversion, t.ventas) };
}
// Compara contra la meta: 'ok' si cumple, 'vencido' si no, '' si falta el dato. CTR y ROAS: mayor es mejor.
const MAYOR_MEJOR = { ctr: true, roas: true, cpc: false, cpl: false };
function contraMeta(clave, valor, meta) {
  if (valor === null || valor === undefined || !num(meta)) return '';
  const m = clave === 'ctr' ? num(meta) / 100 : num(meta);
  return (MAYOR_MEJOR[clave] ? valor >= m : valor <= m) ? 'ok' : 'vencido';
}
function enlaceUtm(base, p = {}) {
  const b = String(base || '').trim();
  if (!b) return '';
  let u;
  try { u = new URL(/^https?:\/\//i.test(b) ? b : 'https://' + b); } catch { return ''; }
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
    const v = String(p[k] ?? '').trim().replace(/\s+/g, '_');
    if (v) u.searchParams.set('utm_' + k, v); else u.searchParams.delete('utm_' + k);
  }
  return u.toString();
}
// Cuadrícula de lunes a domingo que cubre el mes 'AAAA-MM': semanas × 7 días { fecha, dia, delMes }.
function cuadriculaMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  const primero = Date.UTC(a, m - 1, 1);
  const antes = (new Date(primero).getUTCDay() + 6) % 7; // días de la semana anterior (lunes = 0)
  const diasMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celdas = Math.ceil((antes + diasMes) / 7) * 7;
  const semanas = [];
  for (let i = 0; i < celdas; i++) {
    const f = deUTC(primero + (i - antes) * 864e5);
    if (i % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push({ fecha: f, dia: Number(f.slice(8)), delMes: f.slice(0, 7) === ym });
  }
  return semanas;
}
// Historial [{fecha, n}] → seguidores actuales y crecimiento frente al registro anterior y a hace ~30 días.
function crecimiento(hist = []) {
  const h = [...hist].filter((x) => x?.fecha).sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
  if (!h.length) return { actual: null, delta: null, pct: null, delta30: null };
  const u = h[h.length - 1], p = h[h.length - 2];
  const ref30 = [...h].reverse().find((x) => diasEntre(x.fecha, u.fecha) >= 30);
  return { actual: num(u.n), fecha: u.fecha, delta: p ? num(u.n) - num(p.n) : null, pct: p && num(p.n) ? (num(u.n) - num(p.n)) / num(p.n) : null,
    delta30: ref30 ? num(u.n) - num(ref30.n) : null };
}
const ultimaFecha = (lista = []) => lista.map((x) => x.fecha).filter(Boolean).sort().pop() || '';
// Pendientes accionables del área. Todas las listas son [{id, ...datos}].
function calcularPendientes({ campanas = [], publicaciones = [], bots = [], redes = [], hoy }) {
  const p = [];
  const nom = (c) => c.nombre || 'sin nombre';
  for (const c of campanas) {
    const h = '#marketing/campanas/' + c.id;
    if (c.estado === 'activa') {
      const ult = ultimaFecha(c.metricas);
      const desde = ult || c.inicio || '';
      if (!desde || diasEntre(desde, hoy) > 7) p.push({ texto: `Campaña «${nom(c)}»: ${ult ? 'sin métricas desde ' + ult : 'aún no tiene métricas'}`, href: h, tipo: 'campana' });
      if (c.fin && c.fin < hoy) p.push({ texto: `Campaña «${nom(c)}» terminó el ${c.fin} y sigue activa`, href: h, tipo: 'campana' });
    }
    const sinLibro = (c.metricas || []).filter((m) => num(m.inversion) > 0 && !m.movimiento_id);
    if (sinLibro.length) p.push({ texto: `Campaña «${nom(c)}»: ${sinLibro.length} inversión(es) sin registrar en contabilidad (${cop(sinLibro.reduce((s, m) => s + num(m.inversion), 0))})`, href: h, tipo: 'contabilidad' });
  }
  for (const x of publicaciones) if (x.fecha && x.fecha < hoy && x.estado !== 'publicado')
    p.push({ texto: `Publicación atrasada del ${x.fecha} (${x.estado || 'idea'}): ${String(x.copy || x.formato || '').slice(0, 60) || 'sin texto'}`, href: '#marketing/calendario/p/' + x.id, tipo: 'publicacion' });
  for (const b of bots) {
    const h = '#marketing/bots/' + b.id;
    if (b.estado === 'caído') p.push({ texto: `Bot «${b.nombre}» está caído`, href: h, tipo: 'bot' });
    else if (b.estado !== 'pausado' && (!b.ultima_revision || diasEntre(b.ultima_revision, hoy) > 14))
      p.push({ texto: `Bot «${b.nombre}»: ${b.ultima_revision ? 'sin revisar desde ' + b.ultima_revision : 'nunca se ha revisado'}`, href: h, tipo: 'bot' });
  }
  const desde = sumarDias(hoy, -6);
  for (const r of redes) {
    const meta = num(r.frecuencia);
    if (!meta || r.estado === 'inactiva') continue;
    const hechas = publicaciones.filter((x) => x.estado === 'publicado' && (x.redes || []).includes(r.id) && x.fecha >= desde && x.fecha <= hoy).length;
    if (hechas < meta) p.push({ texto: `${r.plataforma} ${r.usuario || ''}: ${hechas} de ${meta} publicaciones en los últimos 7 días`, href: '#marketing/redes/' + r.id, tipo: 'red' });
  }
  return p;
}
// ── fin puras ──

// ───────── datos ─────────
const COL = { campanas: 'crm_campanas', redes: 'crm_redes', publicaciones: 'crm_publicaciones', bots: 'crm_bots', plataformas: 'crm_plataformas' };
const leer = async (col) => (await getDocs(collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() }));
const leerUno = async (col, id) => { const s = await getDoc(doc(db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; };
const leerTodo = async () => { const [campanas, redes, publicaciones, bots, plataformas] = await Promise.all(Object.values(COL).map(leer)); return { campanas, redes, publicaciones, bots, plataformas }; };
const rid = () => Math.random().toString(36).slice(2, 10);
const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

export async function listaNegocios() {
  return (await leer(COL.plataformas)).sort(porNombre).map((p) => ({ id: p.id, nombre: p.nombre }));
}

export async function resumenMarketing() {
  const d = await leerTodo();
  const hoy = hoyCO();
  const mes = indicadores(d.campanas.flatMap((c) => (c.metricas || []).filter((m) => mesDe(m.fecha) === mesDe(hoy))));
  return {
    inversionMes: mes.inversion, leadsMes: mes.leads, cpl: mes.cpl || 0,
    campanasActivas: d.campanas.filter((c) => c.estado === 'activa').length,
    publicacionesProximas: proximas(d.publicaciones, hoy).length,
    botsActivos: d.bots.filter((b) => b.estado === 'activo').length,
    botsCaidos: d.bots.filter((b) => b.estado === 'caído').length,
    pendientes: calcularPendientes({ ...d, hoy }).map(({ texto, href }) => ({ texto, href })),
  };
}
const proximas = (pubs, hoy) => pubs.filter((x) => x.fecha >= hoy && x.fecha <= sumarDias(hoy, 7) && x.estado !== 'publicado')
  .sort((a, b) => `${a.fecha} ${a.hora || ''}`.localeCompare(`${b.fecha} ${b.hora || ''}`));

// ───────── piezas de interfaz ─────────
function estilos() {
  if (document.getElementById('estilo-marketing')) return;
  const s = document.createElement('style');
  s.id = 'estilo-marketing';
  s.textContent = `
  .mk-cal { display:grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap:4px; }
  .mk-cal .mk-cab { font-size:11px; font-weight:600; color:var(--suave); text-align:center; padding:2px 0; }
  .mk-dia { min-height:96px; border:1px solid var(--linea); border-radius:9px; padding:4px; background:#fff; cursor:pointer; min-width:0; }
  .mk-dia:hover { border-color:var(--cian-osc); } .mk-dia.mk-fuera { background:#F6F8FA; opacity:.6; } .mk-dia.mk-hoy { box-shadow: inset 0 0 0 2px var(--cian); }
  .mk-dia > b { font-size:12px; color:var(--marca); }
  .mk-pub { display:block; font-size:11px; line-height:1.25; margin-top:3px; padding:2px 5px; border-radius:6px; border-left:3px solid var(--c, var(--suave)); background:#F3F6F9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--txt); }
  .mk-pub.mk-atrasada { background:#FDECEC; }
  .mk-check { display:flex; gap:8px; flex-wrap:wrap; } .mk-check label { display:flex; gap:5px; align-items:center; font-weight:500; margin:2px 0; color:var(--txt); }
  @media (max-width: 640px) { .mk-dia { min-height:58px; padding:3px; } .mk-pub { font-size:0; padding:0; height:6px; margin-top:2px; border-left-width:0; background:var(--c, var(--suave)); } }`;
  document.head.append(s);
}
const opc = (lista, sel = '', vacio = '') => `${vacio ? `<option value="">${esc(vacio)}</option>` : ''}${lista.map((x) => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}`;
const inp = (name, label, v = '', extra = '') => `<div><label>${label}</label><input name="${name}" value="${esc(v ?? '')}" ${extra}></div>`;
const sel = (name, label, lista, v = '', vacio = '') => `<div><label>${label}</label><select name="${name}">${opc(lista, v, vacio)}</select></div>`;
const area = (name, label, v = '', extra = '') => `<label>${label}</label><textarea class="texto" name="${name}" ${extra}>${esc(v ?? '')}</textarea>`;
const resp = (v) => `<div><label>Responsable</label><select name="responsable">${opcionesEquipo(v || '')}</select></div>`;
const pct = (x) => (x === null || x === undefined ? '—' : (x * 100).toFixed(2) + ' %');
const veces = (x) => (x === null || x === undefined ? '—' : x.toFixed(2) + 'x');
const pesos = (x) => (x === null || x === undefined ? '—' : cop(x));
const miles = (x) => Math.round(num(x)).toLocaleString('es-CO');
const CHIP = { activa: 'ok', planeada: 'info', pausada: 'pendiente', terminada: 'neutro', idea: 'neutro', 'en diseño': 'pendiente', aprobado: 'info', programado: 'info', publicado: 'ok',
  activo: 'ok', pausado: 'neutro', 'en desarrollo': 'info', 'caído': 'vencido', retirado: 'anulado', inactiva: 'neutro' };
const chip = (e) => `<span class="chip ${CHIP[e] || 'neutro'}">${esc(e || '—')}</span>`;
const COLOR_RED = { Instagram: '#C13584', Facebook: '#1877F2', TikTok: '#111', LinkedIn: '#0A66C2', YouTube: '#E00', X: '#333', 'WhatsApp Business': '#25D366', 'Google Business Profile': '#F4B400', Pinterest: '#E60023' };
const enlace = (u, t) => (u ? `<a href="${esc(/^https?:\/\//i.test(u) ? u : 'https://' + u)}" target="_blank" rel="noopener">${esc(t || u)}</a>` : '—');
const ir = (h) => { if (location.hash.slice(1) === h) vistaMarketing(h.split('/').slice(1)); else location.hash = h; };
const fallo = (el, e) => { console.error(e); aviso(el, 'No se pudo guardar: ' + esc(e.code || e.message), 'err'); };
const datos = (form) => Object.fromEntries(new FormData(form));
const nombreNegocio = (plats, id) => plats.find((p) => p.id === id)?.nombre || id || '—';
const opcNegocios = (plats, v) => opc([...plats].sort(porNombre).map((p) => [p.id, p.nombre]), v, plats.length ? '— Sin negocio —' : '— Siembra las plataformas primero —');

// ───────── vista principal ─────────
export async function vistaMarketing(partes = []) {
  nav('marketing');
  estilos();
  const [sec = '', a, b] = partes.map((x) => decodeURIComponent(x || ''));
  $app.innerHTML = '<div class="card centro"><p class="suave">Cargando…</p></div>';
  const d = await leerTodo();
  const tabs = pestanas('marketing', [['', 'Resumen'], ['campanas', 'Campañas', d.campanas.length], ['redes', 'Redes', d.redes.length], ['calendario', 'Calendario', d.publicaciones.length],
    ['bots', 'Bots y automatizaciones', d.bots.length], ['plataformas', 'Plataformas y negocios', d.plataformas.length]], sec);
  const cabeza = `<h1 class="titulo">Marketing y bots</h1><p class="bajada">Pauta, redes, calendario editorial, bots y todo lo que opera CDH Maker.</p>${tabs}`;
  const pinta = (html) => { $app.innerHTML = cabeza + html; };
  if (sec === 'campanas') return a ? vistaCampana(pinta, d, a) : vistaCampanas(pinta, d);
  if (sec === 'redes') return a ? vistaRed(pinta, d, a) : vistaRedes(pinta, d);
  if (sec === 'calendario') {
    if (a === 'p' && b) return vistaPublicacion(pinta, d, b);
    if (a === 'nueva') return vistaPublicacion(pinta, d, '', b);
    return vistaCalendario(pinta, d, a);
  }
  if (sec === 'bots') return a ? vistaBot(pinta, d, a) : vistaBots(pinta, d);
  if (sec === 'plataformas') return a ? vistaPlataforma(pinta, d, a) : vistaPlataformas(pinta, d);
  return vistaResumen(pinta, d);
}

// ───────── resumen ─────────
function vistaResumen(pinta, d) {
  const hoy = hoyCO();
  const mes = indicadores(d.campanas.flatMap((c) => (c.metricas || []).filter((m) => mesDe(m.fecha) === mesDe(hoy))));
  const prox = proximas(d.publicaciones, hoy);
  const pend = calcularPendientes({ ...d, hoy });
  const activos = d.bots.filter((x) => x.estado === 'activo').length, caidos = d.bots.filter((x) => x.estado === 'caído').length;
  const porCampana = d.campanas.map((c) => ({ c, i: indicadores((c.metricas || []).filter((m) => mesDe(m.fecha) === mesDe(hoy))) })).filter((x) => x.i.inversion || x.i.leads)
    .sort((x, y) => y.i.inversion - x.i.inversion);
  const redPorId = Object.fromEntries(d.redes.map((r) => [r.id, r]));
  pinta(`<div class="kpis">
      ${kpi('Inversión del mes', cop(mes.inversion), 'cian', mesDe(hoy))}
      ${kpi('Leads del mes', miles(mes.leads), '', `CPL ${pesos(mes.cpl)}`)}
      ${kpi('Ventas del mes', miles(mes.ventas), 'ok', `ingresos ${cop(mes.ingresos)}`)}
      ${kpi('ROAS', veces(mes.roas), mes.roas === null ? '' : mes.roas >= 1 ? 'ok' : 'err', 'ingresos / inversión')}
      ${kpi('Campañas activas', d.campanas.filter((c) => c.estado === 'activa').length)}
      ${kpi('Publicaciones 7 días', prox.length, '', 'pendientes de publicar')}
      ${kpi('Bots', `${activos} activos`, caidos ? 'err' : 'ok', caidos ? `${caidos} caído(s)` : 'ninguno caído')}
    </div>
    <div class="cols mitad">
      <div class="card"><h2>Pendientes (${pend.length})</h2>${pend.length ? `<ul class="lista">${pend.map((p) => `<li data-href="${esc(p.href)}">${esc(p.texto)}<small>${esc({ campana: 'Campañas', contabilidad: 'Contabilidad', publicacion: 'Calendario', bot: 'Bots', red: 'Redes' }[p.tipo])}</small></li>`).join('')}</ul>`
        : '<div class="vacio">Todo al día.</div>'}</div>
      <div>
        <div class="card"><h2>Próximos 7 días</h2>${prox.length ? `<div class="tabla"><table><tr><th>Fecha</th><th>Redes</th><th>Pieza</th><th>Estado</th></tr>${prox.map((x) => `<tr class="fila" data-href="#marketing/calendario/p/${esc(x.id)}">
          <td>${esc(x.fecha)} ${esc(x.hora || '')}</td><td>${(x.redes || []).map((r) => esc(redPorId[r]?.plataforma || '?')).join(', ') || '—'}</td><td>${esc(x.formato || '')}<br><small class="suave">${esc(String(x.copy || '').slice(0, 70))}</small></td><td>${chip(x.estado)}</td></tr>`).join('')}</table></div>`
          : '<div class="vacio">Nada programado. <a href="#marketing/calendario">Abrir el calendario</a></div>'}</div>
        <div class="card"><h2>Pauta del mes por campaña</h2>${porCampana.length ? `<div class="tabla"><table><tr><th>Campaña</th><th style="text-align:right">Inversión</th><th style="text-align:right">Leads</th><th style="text-align:right">CPL</th><th style="text-align:right">ROAS</th></tr>
          ${porCampana.map(({ c, i }) => `<tr class="fila" data-href="#marketing/campanas/${esc(c.id)}"><td>${esc(c.nombre)}<br><small class="suave">${esc(c.plataforma || '')}</small></td><td style="text-align:right">${cop(i.inversion)}</td><td style="text-align:right">${miles(i.leads)}</td><td style="text-align:right">${pesos(i.cpl)}</td><td style="text-align:right">${veces(i.roas)}</td></tr>`).join('')}</table></div>`
          : '<div class="vacio">Sin métricas este mes.</div>'}</div>
      </div></div>`);
  $app.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => (location.hash = el.dataset.href.slice(1))));
}

// ───────── campañas ─────────
function vistaCampanas(pinta, d) {
  const lista = [...d.campanas].sort((a, b) => ESTADOS_CAMPANA.indexOf(a.estado) - ESTADOS_CAMPANA.indexOf(b.estado) || String(b.inicio || '').localeCompare(String(a.inicio || '')));
  const tot = indicadores(d.campanas.flatMap((c) => c.metricas || []));
  pinta(`<div class="kpis">${kpi('Inversión histórica', cop(tot.inversion), 'cian')}${kpi('Leads', miles(tot.leads), '', 'CPL ' + pesos(tot.cpl))}${kpi('CTR', pct(tot.ctr))}${kpi('ROAS', veces(tot.roas), tot.roas !== null && tot.roas >= 1 ? 'ok' : '')}</div>
    <div class="card"><div class="cab"><h2 style="margin:0">Campañas</h2><a class="boton primario" href="#marketing/campanas/nueva">Nueva campaña</a></div>
    ${lista.length ? `<div class="tabla"><table><tr><th>Campaña</th><th>Negocio</th><th>Estado</th><th>Fechas</th><th style="text-align:right">Invertido / presupuesto</th><th style="text-align:right">Leads</th><th style="text-align:right">CPL</th><th style="text-align:right">ROAS</th></tr>
      ${lista.map((c) => { const i = indicadores(c.metricas); return `<tr class="fila" data-id="${esc(c.id)}"><td><b>${esc(c.nombre)}</b><br><small class="suave">${esc(c.plataforma || '')} · ${esc(c.objetivo || '')}</small></td>
        <td>${esc(nombreNegocio(d.plataformas, c.negocio))}</td><td>${chip(c.estado)}</td><td><small>${esc(c.inicio || '—')} → ${esc(c.fin || '—')}</small></td>
        <td style="text-align:right;white-space:nowrap">${cop(i.inversion)}<br><small class="suave">de ${c.presupuesto_total ? cop(c.presupuesto_total) : '—'}</small></td>
        <td style="text-align:right">${miles(i.leads)}</td><td style="text-align:right">${pesos(i.cpl)}</td><td style="text-align:right">${veces(i.roas)}</td></tr>`; }).join('')}</table></div>`
      : '<div class="vacio" style="margin-top:12px">Aún no hay campañas.</div>'}</div>`);
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'marketing/campanas/' + tr.dataset.id)));
}

function formCampana(c, d) {
  return `<form id="fCamp"><div class="grid">
    ${inp('nombre', 'Nombre', c.nombre, 'required')}
    ${sel('plataforma', 'Plataforma', PLATAFORMAS_ADS, c.plataforma || 'Meta Ads')}
    <div><label>Negocio / producto</label><select name="negocio">${opcNegocios(d.plataformas, c.negocio)}</select></div>
    ${sel('objetivo', 'Objetivo', OBJETIVOS, c.objetivo || 'leads')}
    ${sel('estado', 'Estado', ESTADOS_CAMPANA, c.estado || 'planeada')}
    ${resp(c.responsable)}
    ${inp('inicio', 'Inicio', c.inicio, 'type="date"')}${inp('fin', 'Fin', c.fin, 'type="date"')}
    ${inp('presupuesto_total', 'Presupuesto total (COP)', c.presupuesto_total, 'type="number" min="0" step="1"')}
    ${inp('presupuesto_diario', 'Presupuesto diario (COP)', c.presupuesto_diario, 'type="number" min="0" step="1"')}
  </div>
  ${area('publico', 'Público objetivo', c.publico, 'placeholder="Edad, ubicación, intereses, audiencias personalizadas…"')}
  ${area('creativos', 'Creativos y notas', c.creativos)}
  <h3>Metas</h3><div class="grid">
    ${inp('meta_ctr', 'CTR mínimo (%)', c.meta_ctr, 'type="number" min="0" step="0.01"')}${inp('meta_cpc', 'CPC máximo (COP)', c.meta_cpc, 'type="number" min="0" step="1"')}
    ${inp('meta_cpl', 'CPL máximo (COP)', c.meta_cpl, 'type="number" min="0" step="1"')}${inp('meta_roas', 'ROAS mínimo (x)', c.meta_roas, 'type="number" min="0" step="0.01"')}
  </div>
  <div class="acciones"><button class="primario">${c.id ? 'Guardar' : 'Crear campaña'}</button>${c.id ? '<button type="button" class="peligro" id="borrarCamp">Borrar campaña</button>' : ''}</div></form><div id="mCamp"></div>`;
}
const NUMS_CAMP = ['presupuesto_total', 'presupuesto_diario', 'meta_ctr', 'meta_cpc', 'meta_cpl', 'meta_roas'];

async function vistaCampana(pinta, d, id) {
  const nueva = id === 'nueva';
  const c = nueva ? { metricas: [] } : d.campanas.find((x) => x.id === id);
  if (!c) return pinta('<div class="card"><div class="aviso err">Campaña no encontrada.</div><p><a href="#marketing/campanas">← Campañas</a></p></div>');
  const [src, med, panel] = UTM_DE[c.plataforma] || ['', '', ''];
  const mets = [...(c.metricas || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const i = indicadores(c.metricas);
  const fila = (k, etiqueta, valor, fmt) => { const e = contraMeta(k, valor, c['meta_' + k]); return kpi(etiqueta, fmt(valor), e === 'ok' ? 'ok' : e ? 'err' : '', c['meta_' + k] ? `meta ${k === 'ctr' ? c.meta_ctr + ' %' : k === 'roas' ? c.meta_roas + 'x' : cop(c['meta_' + k])}` : 'sin meta'); };
  pinta(`<p><a href="#marketing/campanas">← Campañas</a></p>
  ${nueva ? '' : `<div class="kpis">${kpi('Invertido', cop(i.inversion), 'cian', c.presupuesto_total ? `${Math.round(i.inversion / num(c.presupuesto_total) * 100)} % del presupuesto` : '')}
    ${fila('ctr', 'CTR', i.ctr, pct)}${fila('cpc', 'CPC', i.cpc, pesos)}${fila('cpl', 'CPL', i.cpl, pesos)}${fila('roas', 'ROAS', i.roas, veces)}
    ${kpi('Leads / ventas', `${miles(i.leads)} / ${miles(i.ventas)}`, '', `ingresos ${cop(i.ingresos)}`)}</div>`}
  <div class="cols mitad"><div>
    <div class="card"><div class="cab"><h2 style="margin:0">${nueva ? 'Nueva campaña' : esc(c.nombre)}</h2>${nueva ? '' : chip(c.estado)}</div>
      ${panel ? `<p class="suave">Administrador de anuncios: ${enlace(panel)}</p>` : ''}${formCampana(c, d)}</div>
  </div><div>
    ${nueva ? '<div class="card"><div class="vacio">Crea la campaña para registrar métricas y armar su enlace UTM.</div></div>' : `
    <div class="card"><h2>Enlace con UTM</h2><form id="fUtm">
      <label>URL de destino</label><input name="url_base" value="${esc(c.url_base || '')}" placeholder="https://cdhmaker.com/…">
      <div class="grid">${inp('utm_source', 'utm_source', c.utm_source ?? src)}${inp('utm_medium', 'utm_medium', c.utm_medium ?? med)}
        ${inp('utm_campaign', 'utm_campaign', c.utm_campaign ?? slug(c.nombre || ''))}${inp('utm_content', 'utm_content', c.utm_content, 'placeholder="anuncio o creativo"')}
        ${inp('utm_term', 'utm_term (opcional)', c.utm_term)}</div>
      <label>Enlace final</label><input id="utmFinal" readonly>
      <div class="acciones"><button type="button" id="copiarUtm">Copiar enlace</button><button class="primario">Guardar UTM</button></div></form><div id="mUtm"></div></div>
    <div class="card"><h2>Métricas por fecha</h2>
      <form id="fMet"><div class="grid">${inp('fecha', 'Fecha (o fin del periodo)', hoyCO(), 'type="date" required')}${inp('inversion', 'Inversión (COP)', '', 'type="number" min="0" step="1"')}
        ${inp('impresiones', 'Impresiones', '', 'type="number" min="0" step="1"')}${inp('clics', 'Clics', '', 'type="number" min="0" step="1"')}
        ${inp('leads', 'Leads', '', 'type="number" min="0" step="1"')}${inp('ventas', 'Ventas', '', 'type="number" min="0" step="1"')}
        ${inp('ingresos', 'Ingresos (COP)', '', 'type="number" min="0" step="1"')}${inp('nota', 'Nota', '')}</div>
        <div class="acciones"><button class="primario">Agregar registro</button></div></form><div id="mMet"></div>
      ${mets.length ? `<div class="tabla" style="margin-top:12px"><table><tr><th>Fecha</th><th style="text-align:right">Inversión</th><th style="text-align:right">Impr. / clics</th><th style="text-align:right">CTR</th><th style="text-align:right">CPC</th><th style="text-align:right">Leads · CPL</th><th style="text-align:right">Ventas · ROAS</th><th>Contabilidad</th><th></th></tr>
        ${mets.map((m) => { const x = indicadores([m]); return `<tr><td>${esc(m.fecha)}${m.nota ? `<br><small class="suave">${esc(m.nota)}</small>` : ''}</td><td style="text-align:right">${cop(m.inversion)}</td>
          <td style="text-align:right">${miles(m.impresiones)}<br><small class="suave">${miles(m.clics)}</small></td>
          <td style="text-align:right"><span class="chip ${contraMeta('ctr', x.ctr, c.meta_ctr) || 'neutro'}">${pct(x.ctr)}</span></td>
          <td style="text-align:right"><span class="chip ${contraMeta('cpc', x.cpc, c.meta_cpc) || 'neutro'}">${pesos(x.cpc)}</span></td>
          <td style="text-align:right">${miles(m.leads)}<br><span class="chip ${contraMeta('cpl', x.cpl, c.meta_cpl) || 'neutro'}">${pesos(x.cpl)}</span></td>
          <td style="text-align:right">${miles(m.ventas)}<br><span class="chip ${contraMeta('roas', x.roas, c.meta_roas) || 'neutro'}">${veces(x.roas)}</span></td>
          <td>${m.movimiento_id ? '<span class="chip ok">registrada</span>' : num(m.inversion) > 0 ? `<button class="mini primario" data-libro="${esc(m.id)}">Registrar inversión en contabilidad</button>` : '—'}</td>
          <td>${m.movimiento_id ? '' : `<button class="mini peligro" data-quitar="${esc(m.id)}" title="Quitar registro">✕</button>`}</td></tr>`; }).join('')}</table></div>`
        : '<div class="vacio" style="margin-top:12px">Sin métricas todavía.</div>'}</div>`}
  </div></div>
  <dialog class="modal" id="dLibro"><form id="fLibro"><h2>Registrar inversión en contabilidad</h2>
    <p class="suave">Crea un egreso en el libro (cuenta «Publicidad y propaganda»). Se registra una sola vez por registro de métricas.</p>
    <div class="grid">${inp('fecha', 'Fecha del pago', '', 'type="date" required')}${inp('valor', 'Valor (COP)', '', 'type="number" min="1" step="1" required')}</div>
    ${inp('concepto', 'Concepto', '', 'required')}
    <div class="grid"><div><label>Pagado por</label><select name="pagado_por" required>${opcionesEquipo(ctx.perfil?.id || '', '')}<option value="caja">Caja de la empresa</option></select></div>
      ${inp('medio', 'Medio de pago', 'Tarjeta de crédito', 'list="mkMedios" required')}</div>
    <datalist id="mkMedios"><option value="Tarjeta de crédito"><option value="Tarjeta débito"><option value="PSE"><option value="Transferencia Bancolombia"><option value="Nequi"><option value="Efectivo"></datalist>
    <div class="acciones"><button class="primario">Registrar egreso</button><button type="button" id="cerrarLibro">Cancelar</button></div><div id="mLibro"></div></form></dialog>`);

  const ref = nueva ? null : doc(db, COL.campanas, id);
  document.getElementById('fCamp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target);
    for (const k of NUMS_CAMP) f[k] = f[k] === '' ? '' : num(f[k]);
    try {
      if (nueva) { const r = await addDoc(collection(db, COL.campanas), { ...f, metricas: [], ...sello(true) }); ir('marketing/campanas/' + r.id); }
      else { await updateDoc(ref, { ...f, ...sello() }); ir('marketing/campanas/' + id); }
    } catch (err) { fallo(document.getElementById('mCamp'), err); }
  });
  document.getElementById('borrarCamp')?.addEventListener('click', async () => {
    if ((c.metricas || []).some((m) => m.movimiento_id) && !confirm('Esta campaña tiene inversiones registradas en contabilidad. Los egresos del libro NO se borran. ¿Continuar?')) return;
    if (!confirm(`¿Borrar la campaña «${c.nombre}» y sus métricas? No se puede deshacer.`)) return;
    await deleteDoc(ref); ir('marketing/campanas');
  });
  if (nueva) return;

  // UTM en vivo
  const fUtm = document.getElementById('fUtm'), $final = document.getElementById('utmFinal');
  const armar = () => { const f = datos(fUtm); $final.value = enlaceUtm(f.url_base, { source: f.utm_source, medium: f.utm_medium, campaign: f.utm_campaign, content: f.utm_content, term: f.utm_term }); };
  fUtm.addEventListener('input', armar); armar();
  document.getElementById('copiarUtm').addEventListener('click', async (e) => {
    if (!$final.value) return aviso(document.getElementById('mUtm'), 'Escribe una URL de destino válida.', 'err');
    try { await navigator.clipboard.writeText($final.value); e.target.textContent = 'Copiado ✔'; } catch { $final.select(); document.execCommand('copy'); }
  });
  fUtm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await updateDoc(ref, { ...datos(fUtm), utm_final: $final.value, ...sello() }); aviso(document.getElementById('mUtm'), 'UTM guardado.', 'ok'); } catch (err) { fallo(document.getElementById('mUtm'), err); }
  });

  // métricas (se relee el documento antes de escribir para no pisar cambios de otra pestaña)
  const metricasActuales = async () => (await getDoc(ref)).data()?.metricas || [];
  document.getElementById('fMet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target);
    const m = { id: rid(), fecha: f.fecha, nota: f.nota || '', registrado_por: ctx.usuario.email };
    for (const k of ['inversion', 'impresiones', 'clics', 'leads', 'ventas', 'ingresos']) m[k] = num(f[k]);
    try { await updateDoc(ref, { metricas: [...await metricasActuales(), m], ...sello() }); ir('marketing/campanas/' + id); } catch (err) { fallo(document.getElementById('mMet'), err); }
  });
  $app.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Quitar este registro de métricas?')) return;
    await updateDoc(ref, { metricas: (await metricasActuales()).filter((m) => m.id !== b.dataset.quitar || m.movimiento_id), ...sello() });
    ir('marketing/campanas/' + id);
  }));
  const dlg = document.getElementById('dLibro'), fL = document.getElementById('fLibro');
  let actual = null;
  document.getElementById('cerrarLibro').addEventListener('click', () => dlg.close());
  $app.querySelectorAll('[data-libro]').forEach((b) => b.addEventListener('click', () => {
    actual = (c.metricas || []).find((m) => m.id === b.dataset.libro);
    fL.fecha.value = actual.fecha; fL.valor.value = num(actual.inversion);
    fL.concepto.value = `Pauta ${c.plataforma || ''} — ${c.nombre} (${actual.fecha})`;
    document.getElementById('mLibro').innerHTML = '';
    dlg.showModal();
  }));
  fL.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = fL.querySelector('button.primario'); btn.disabled = true;
    const m = document.getElementById('mLibro');
    try {
      const lista = await metricasActuales();
      const reg = lista.find((x) => x.id === actual.id);
      if (!reg) throw new Error('El registro ya no existe.');
      if (reg.movimiento_id) { aviso(m, 'Esta inversión ya estaba registrada.', 'warn'); return ir('marketing/campanas/' + id); }
      const f = datos(fL);
      const movimiento_id = await registrarMovimiento({ tipo: 'egreso', clase: 'gasto', cuenta: 'Publicidad y propaganda', fecha: f.fecha, concepto: f.concepto, valor: num(f.valor),
        tercero: c.plataforma || 'Plataforma de pauta', pagado_por: f.pagado_por, medio: f.medio, origen: 'campana', origen_id: id });
      await updateDoc(ref, { metricas: lista.map((x) => (x.id === reg.id ? { ...x, movimiento_id, pagado_por: f.pagado_por } : x)), ...sello() });
      dlg.close(); ir('marketing/campanas/' + id);
    } catch (err) { btn.disabled = false; fallo(m, err); }
  });
}

// ───────── redes ─────────
function vistaRedes(pinta, d) {
  const lista = [...d.redes].sort((a, b) => String(a.plataforma).localeCompare(String(b.plataforma)) || String(a.usuario || '').localeCompare(String(b.usuario || '')));
  const hoy = hoyCO(), desde = sumarDias(hoy, -6);
  pinta(`<div class="card"><div class="cab"><h2 style="margin:0">Redes sociales</h2><a class="boton primario" href="#marketing/redes/nueva">Agregar red</a></div>
    ${lista.length ? `<div class="tabla"><table><tr><th>Red</th><th>Negocio</th><th>Responsable</th><th style="text-align:right">Seguidores</th><th style="text-align:right">Crecimiento</th><th>Esta semana</th></tr>
      ${lista.map((r) => { const g = crecimiento(r.seguidores); const hechas = d.publicaciones.filter((x) => x.estado === 'publicado' && (x.redes || []).includes(r.id) && x.fecha >= desde && x.fecha <= hoy).length;
        return `<tr class="fila" data-id="${esc(r.id)}"><td><b style="color:${COLOR_RED[r.plataforma] || 'inherit'}">${esc(r.plataforma)}</b> ${esc(r.usuario || '')}${r.estado === 'inactiva' ? ' ' + chip('inactiva') : ''}</td>
        <td>${esc(nombreNegocio(d.plataformas, r.negocio))}</td><td>${esc(nombreDe(r.responsable))}</td><td style="text-align:right">${g.actual === null ? '—' : miles(g.actual)}</td>
        <td style="text-align:right">${g.delta === null ? '—' : `${g.delta >= 0 ? '+' : ''}${miles(g.delta)}`}${g.pct !== null ? `<br><small class="suave">${(g.pct * 100).toFixed(1)} %</small>` : ''}</td>
        <td>${num(r.frecuencia) ? `<span class="chip ${hechas >= num(r.frecuencia) ? 'ok' : 'pendiente'}">${hechas} / ${num(r.frecuencia)}</span>` : '<small class="suave">sin meta</small>'}</td></tr>`; }).join('')}</table></div>`
      : '<div class="vacio" style="margin-top:12px">Aún no hay redes registradas.</div>'}</div>`);
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'marketing/redes/' + tr.dataset.id)));
}

function vistaRed(pinta, d, id) {
  const nueva = id === 'nueva';
  const r = nueva ? { seguidores: [] } : d.redes.find((x) => x.id === id);
  if (!r) return pinta('<div class="card"><div class="aviso err">Red no encontrada.</div></div>');
  const g = crecimiento(r.seguidores);
  const hist = [...(r.seguidores || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const pubs = d.publicaciones.filter((x) => (x.redes || []).includes(id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 8);
  pinta(`<p><a href="#marketing/redes">← Redes</a></p><div class="cols mitad"><div class="card"><h2>${nueva ? 'Nueva red' : esc(`${r.plataforma} ${r.usuario || ''}`)}</h2>
    <form id="fRed"><div class="grid">${sel('plataforma', 'Plataforma', REDES, r.plataforma || 'Instagram')}${inp('usuario', 'Usuario / @', r.usuario, 'required')}
      ${inp('url', 'URL del perfil', r.url, 'type="url" placeholder="https://"')}<div><label>Negocio</label><select name="negocio">${opcNegocios(d.plataformas, r.negocio)}</select></div>
      ${resp(r.responsable)}${inp('frecuencia', 'Meta (publicaciones / semana)', r.frecuencia, 'type="number" min="0" step="1"')}
      ${sel('estado', 'Estado', ['activa', 'inactiva'], r.estado || 'activa')}</div>
      <div class="aviso warn"><b>Nunca guardes contraseñas aquí.</b> Usa un gestor de contraseñas (Bitwarden, 1Password…) y escribe solo dónde está el acceso.</div>
      ${inp('acceso', 'Dónde está el acceso', r.acceso, 'placeholder="Bitwarden → carpeta CDH Maker → Instagram" autocomplete="off"')}
      ${area('notas', 'Notas', r.notas)}
      <div class="acciones"><button class="primario">${nueva ? 'Agregar red' : 'Guardar'}</button>${nueva ? '' : '<button type="button" class="peligro" id="borrarRed">Borrar</button>'}${r.url ? enlace(r.url, 'Abrir perfil') : ''}</div></form><div id="mRed"></div></div>
  ${nueva ? '' : `<div><div class="kpis">${kpi('Seguidores', g.actual === null ? '—' : miles(g.actual), 'cian', g.fecha || '')}${kpi('Vs. registro anterior', g.delta === null ? '—' : (g.delta >= 0 ? '+' : '') + miles(g.delta), g.delta > 0 ? 'ok' : g.delta < 0 ? 'err' : '', g.pct !== null ? (g.pct * 100).toFixed(1) + ' %' : '')}${kpi('Últimos 30 días', g.delta30 === null ? '—' : (g.delta30 >= 0 ? '+' : '') + miles(g.delta30))}</div>
    <div class="card"><h2>Historial de seguidores</h2><form id="fSeg" class="acciones"><input name="fecha" type="date" value="${hoyCO()}" required style="width:auto"><input name="n" type="number" min="0" step="1" placeholder="Seguidores" required style="width:150px"><button class="mini primario">Agregar</button></form>
      ${hist.length ? `<div class="tabla"><table><tr><th>Fecha</th><th style="text-align:right">Seguidores</th><th></th></tr>${hist.map((h, i) => `<tr><td>${esc(h.fecha)}</td><td style="text-align:right">${miles(h.n)}</td><td><button class="mini peligro" data-quitar="${i}">✕</button></td></tr>`).join('')}</table></div>` : '<p class="suave">Sin registros.</p>'}</div>
    <div class="card"><h2>Publicaciones recientes</h2>${pubs.length ? `<ul class="lista">${pubs.map((x) => `<li data-href="marketing/calendario/p/${esc(x.id)}">${esc(x.fecha)} · ${esc(x.formato || '')} ${chip(x.estado)}<small>${esc(String(x.copy || '').slice(0, 80))}</small></li>`).join('')}</ul>` : '<p class="suave">Ninguna en el calendario.</p>'}</div></div>`}</div>`);
  const ref = nueva ? null : doc(db, COL.redes, id);
  document.getElementById('fRed').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target); f.frecuencia = num(f.frecuencia);
    try {
      if (nueva) { const x = await addDoc(collection(db, COL.redes), { ...f, seguidores: [], ...sello(true) }); ir('marketing/redes/' + x.id); }
      else { await updateDoc(ref, { ...f, ...sello() }); ir('marketing/redes/' + id); }
    } catch (err) { fallo(document.getElementById('mRed'), err); }
  });
  if (nueva) return;
  document.getElementById('borrarRed').addEventListener('click', async () => { if (confirm('¿Borrar esta red y su historial de seguidores?')) { await deleteDoc(ref); ir('marketing/redes'); } });
  document.getElementById('fSeg').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target);
    const actual = (await getDoc(ref)).data()?.seguidores || [];
    await updateDoc(ref, { seguidores: [...actual.filter((h) => h.fecha !== f.fecha), { fecha: f.fecha, n: num(f.n) }], ...sello() });
    ir('marketing/redes/' + id);
  });
  $app.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    const h = hist[Number(b.dataset.quitar)];
    if (!confirm(`¿Quitar el registro del ${h.fecha}?`)) return;
    const actual = (await getDoc(ref)).data()?.seguidores || [];
    await updateDoc(ref, { seguidores: actual.filter((x) => !(x.fecha === h.fecha && num(x.n) === num(h.n))), ...sello() });
    ir('marketing/redes/' + id);
  }));
  $app.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => (location.hash = el.dataset.href)));
}

// ───────── calendario editorial ─────────
function vistaCalendario(pinta, d, modo) {
  const hoy = hoyCO();
  const lista = modo === 'lista';
  const ym = /^\d{4}-\d{2}$/.test(modo || '') ? modo : mesDe(hoy);
  const redPorId = Object.fromEntries(d.redes.map((r) => [r.id, r]));
  const color = (x) => COLOR_RED[redPorId[(x.redes || [])[0]]?.plataforma] || 'var(--suave)';
  const porDia = {};
  for (const x of d.publicaciones) (porDia[x.fecha] ||= []).push(x);
  for (const k in porDia) porDia[k].sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
  const nombreMes = new Date(aUTC(ym + '-01')).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const cab = `<div class="cab" style="margin-bottom:10px"><div class="acciones" style="margin:0">
      ${lista ? '' : `<a class="boton" href="#marketing/calendario/${moverMes(ym, -1)}">‹</a><b style="min-width:150px;text-align:center;text-transform:capitalize">${esc(nombreMes)}</b><a class="boton" href="#marketing/calendario/${moverMes(ym, 1)}">›</a>
      ${ym !== mesDe(hoy) ? '<a class="boton" href="#marketing/calendario">Hoy</a>' : ''}`}</div>
    <div class="acciones" style="margin:0"><a class="boton ${lista ? '' : 'primario'}" href="#marketing/calendario">Mes</a><a class="boton ${lista ? 'primario' : ''}" href="#marketing/calendario/lista">Lista</a>
      <a class="boton" href="#marketing/calendario/nueva/${hoy}">Nueva publicación</a></div></div>`;
  if (lista) {
    const todas = [...d.publicaciones].sort((a, b) => `${b.fecha} ${b.hora || ''}`.localeCompare(`${a.fecha} ${a.hora || ''}`));
    pinta(`<div class="card">${cab}${todas.length ? `<div class="tabla"><table><tr><th>Fecha</th><th>Redes</th><th>Formato</th><th>Copy</th><th>Negocio</th><th>Responsable</th><th>Estado</th></tr>
      ${todas.map((x) => `<tr class="fila" data-pub="${esc(x.id)}"><td style="white-space:nowrap">${esc(x.fecha)} ${esc(x.hora || '')}</td><td>${(x.redes || []).map((r) => esc(redPorId[r] ? `${redPorId[r].plataforma} ${redPorId[r].usuario || ''}` : '?')).join('<br>') || '—'}</td>
        <td>${esc(x.formato || '')}</td><td><small>${esc(String(x.copy || '').slice(0, 90))}</small></td><td>${esc(nombreNegocio(d.plataformas, x.negocio))}</td><td>${esc(nombreDe(x.responsable))}</td>
        <td>${x.fecha < hoy && x.estado !== 'publicado' ? '<span class="chip vencido">atrasada</span> ' : ''}${chip(x.estado)}</td></tr>`).join('')}</table></div>` : '<div class="vacio">Aún no hay publicaciones.</div>'}</div>`);
  } else {
    const sem = cuadriculaMes(ym);
    pinta(`<div class="card">${cab}<div class="mk-cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((x) => `<div class="mk-cab">${x}</div>`).join('')}
      ${sem.flat().map((c) => `<div class="mk-dia ${c.delMes ? '' : 'mk-fuera'} ${c.fecha === hoy ? 'mk-hoy' : ''}" data-dia="${c.fecha}" title="Nueva publicación el ${c.fecha}"><b>${c.dia}</b>
        ${(porDia[c.fecha] || []).map((x) => `<a class="mk-pub ${x.fecha < hoy && x.estado !== 'publicado' ? 'mk-atrasada' : ''}" style="--c:${color(x)}" data-pub="${esc(x.id)}" title="${esc(`${x.hora || ''} ${x.formato || ''} · ${x.estado || ''} · ${String(x.copy || '').slice(0, 80)}`)}">${esc(x.hora || '')} ${esc(x.formato || '')} ${esc(String(x.copy || '').slice(0, 30))}</a>`).join('')}</div>`).join('')}
      </div><p class="suave">Clic en un día para crear una publicación; clic en una pieza para abrirla. El color es el de la primera red.</p></div>`);
  }
  $app.querySelector('.card').addEventListener('click', (e) => {
    const p = e.target.closest('[data-pub]');
    if (p) return (location.hash = 'marketing/calendario/p/' + p.dataset.pub);
    const dia = e.target.closest('[data-dia]');
    if (dia) location.hash = 'marketing/calendario/nueva/' + dia.dataset.dia;
  });
}

async function vistaPublicacion(pinta, d, id, fechaNueva) {
  const nueva = !id;
  const x = nueva ? { fecha: /^\d{4}-\d{2}-\d{2}$/.test(fechaNueva || '') ? fechaNueva : hoyCO(), estado: 'idea', redes: [], responsable: ctx.perfil?.id || '' } : d.publicaciones.find((p) => p.id === id);
  if (!x) return pinta('<div class="card"><div class="aviso err">Publicación no encontrada.</div><p><a href="#marketing/calendario">← Calendario</a></p></div>');
  const destino = nueva ? null : [COL.publicaciones, id, 'archivos'];
  const archivos = nueva ? [] : (await getDocs(collection(db, ...destino))).docs.map((a) => ({ id: a.id, ...a.data() }));
  const redes = [...d.redes].sort((a, b) => String(a.plataforma).localeCompare(String(b.plataforma)));
  pinta(`<p><a href="#marketing/calendario/${esc(mesDe(x.fecha))}">← Calendario</a></p><div class="cols mitad"><div class="card">
    <div class="cab"><h2 style="margin:0">${nueva ? 'Nueva publicación' : 'Publicación del ' + esc(x.fecha)}</h2>${nueva ? '' : chip(x.estado)}</div>
    <form id="fPub"><div class="grid">${inp('fecha', 'Fecha', x.fecha, 'type="date" required')}${inp('hora', 'Hora', x.hora, 'type="time"')}
      ${sel('formato', 'Formato', FORMATOS, x.formato || 'post')}${sel('estado', 'Estado', ESTADOS_PUB, x.estado || 'idea')}
      <div><label>Negocio</label><select name="negocio">${opcNegocios(d.plataformas, x.negocio)}</select></div>${resp(x.responsable)}
      <div><label>Campaña (opcional)</label><select name="campana">${opc(d.campanas.map((c) => [c.id, c.nombre]), x.campana, '— Ninguna —')}</select></div></div>
      <label>Redes</label>${redes.length ? `<div class="mk-check">${redes.map((r) => `<label><input type="checkbox" name="redes" value="${esc(r.id)}" ${(x.redes || []).includes(r.id) ? 'checked' : ''}> ${esc(r.plataforma)} ${esc(r.usuario || '')}</label>`).join('')}</div>`
        : '<p class="suave">No hay redes registradas. <a href="#marketing/redes/nueva">Agrega una</a>.</p>'}
      ${area('copy', 'Texto / copy', x.copy, 'style="min-height:120px"')}
      ${area('hashtags', 'Hashtags', x.hashtags, 'style="min-height:50px" placeholder="#CDHMaker #Medellin"')}
      <div class="grid">${inp('enlace', 'Enlace de la pieza (destino)', x.enlace, 'type="url" placeholder="https://"')}${inp('enlace_publicado', 'Enlace de la publicación ya publicada', x.enlace_publicado, 'type="url" placeholder="https://"')}</div>
      ${area('notas', 'Notas', x.notas, 'style="min-height:50px"')}
      <div class="acciones"><button class="primario">${nueva ? 'Crear publicación' : 'Guardar'}</button>${nueva ? '' : '<button type="button" id="duplicar">Duplicar</button><button type="button" class="peligro" id="borrarPub">Borrar</button>'}
        ${x.enlace_publicado ? enlace(x.enlace_publicado, 'Ver publicada') : ''}</div></form><div id="mPub"></div></div>
    <div><div class="card"><h2>Piezas (${archivos.length})</h2>${nueva ? '<div class="vacio">Crea la publicación para subir sus piezas.</div>' : `
      ${archivos.length ? `<div class="tabla"><table><tr><th>Archivo</th><th></th></tr>${archivos.map((a) => `<tr><td>${esc(a.nombre)}<br><small class="suave">${(num(a.tamano) / 1024).toFixed(0)} KB · ${esc(a.mime || '')}</small></td>
        <td style="white-space:nowrap"><button class="mini" data-bajar="${esc(a.id)}">Descargar</button> <button class="mini peligro" data-borrar="${esc(a.id)}">Borrar</button></td></tr>`).join('')}</table></div>` : '<p class="suave">Sin piezas todavía.</p>'}
      <div class="acciones"><input type="file" id="piezas" multiple accept="image/*,video/*,application/pdf" style="width:auto"><button class="mini primario" id="subir">Subir piezas</button></div>
      <p class="suave">Las imágenes grandes se reducen a 1600 px. Para videos pesados, guarda el enlace a la carpeta compartida en las notas.</p><div id="mArch"></div>`}</div>
      ${x.copy ? `<div class="card"><h2>Vista rápida del texto</h2><p style="white-space:pre-wrap">${esc(x.copy)}</p>${x.hashtags ? `<p class="suave">${esc(x.hashtags)}</p>` : ''}<p class="suave">${String(x.copy || '').length + (x.hashtags ? String(x.hashtags).length + 2 : 0)} caracteres</p><button type="button" class="mini" id="copiarCopy">Copiar texto + hashtags</button></div>` : ''}</div></div>`);
  const ref = nueva ? null : doc(db, COL.publicaciones, id);
  const leerForm = (form) => { const f = datos(form); f.redes = new FormData(form).getAll('redes'); return f; };
  document.getElementById('fPub').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = leerForm(e.target);
    try {
      if (nueva) { const r = await addDoc(collection(db, COL.publicaciones), { ...f, ...sello(true) }); ir('marketing/calendario/p/' + r.id); }
      else { await updateDoc(ref, { ...f, ...sello() }); ir('marketing/calendario/p/' + id); }
    } catch (err) { fallo(document.getElementById('mPub'), err); }
  });
  if (nueva) return;
  document.getElementById('copiarCopy')?.addEventListener('click', async (e) => { await navigator.clipboard.writeText([x.copy, x.hashtags].filter(Boolean).join('\n\n')); e.target.textContent = 'Copiado ✔'; });
  document.getElementById('duplicar').addEventListener('click', async () => {
    const { id: _i, creado, creado_por, actualizado, actualizado_por, enlace_publicado, ...resto } = x;
    const r = await addDoc(collection(db, COL.publicaciones), { ...resto, estado: 'idea', enlace_publicado: '', ...sello(true) });
    ir('marketing/calendario/p/' + r.id);
  });
  document.getElementById('borrarPub').addEventListener('click', async () => {
    if (!confirm(`¿Borrar esta publicación${archivos.length ? ` y sus ${archivos.length} pieza(s)` : ''}? No se puede deshacer.`)) return;
    for (const a of archivos) await borrarAdjunto(destino, a.id);
    await deleteDoc(ref); ir('marketing/calendario/' + mesDe(x.fecha));
  });
  document.getElementById('subir').addEventListener('click', async () => {
    const m = document.getElementById('mArch');
    const files = [...document.getElementById('piezas').files];
    if (!files.length) return aviso(m, 'Elige uno o más archivos.', 'err');
    try {
      for (const file of files) {
        aviso(m, 'Subiendo ' + esc(file.name) + '…');
        const { bytes, mime, nombre } = await bytesDe(file);
        await guardarAdjunto(destino, { nombre, tipo: 'pieza', mime, bytes });
      }
      ir('marketing/calendario/p/' + id);
    } catch (err) { fallo(m, err); }
  });
  $app.querySelectorAll('[data-bajar]').forEach((b) => b.addEventListener('click', () => bajarAdjunto(destino, b.dataset.bajar, archivos.find((a) => a.id === b.dataset.bajar))));
  $app.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('¿Borrar esta pieza?')) return;
    await borrarAdjunto(destino, b.dataset.borrar); ir('marketing/calendario/p/' + id);
  }));
}

// ───────── bots y automatizaciones ─────────
// Semillas: lo que ya existe en el sitio y propuestas a partir de los proyectos de Henry (quedan "en desarrollo"
// para que él confirme proveedor, canal y estado). Ids fijos: sembrar dos veces no duplica ni pisa ediciones.
const BOTS_SEMILLA = [
  { id: 'asesor-maker-sitio', nombre: 'Asesor «Maker» del sitio', tipo: 'Agente IA', proveedor: 'Propio (cdhmaker.com, con voz en el navegador)', negocio: 'sitio-cdhmaker',
    proposito: 'Responder dudas de los visitantes de cdhmaker.com sobre servicios y productos, y llevarlos a contacto.', url_panel: 'https://cdhmaker.com', canal: 'cdhmaker.com', estado: 'activo' },
  { id: 'widget-whatsapp-sitio', nombre: 'Widget de WhatsApp del sitio', tipo: 'WhatsApp', proveedor: 'Propio (chat-widget.js → WhatsApp)', negocio: 'sitio-cdhmaker',
    proposito: 'El visitante escribe su mensaje y se abre su WhatsApp con el texto listo para enviarlo a CDH Maker.', url_panel: 'https://cdhmaker.com', canal: 'WhatsApp de CDH Maker', estado: 'activo' },
  { id: 'asistente-wall-e', nombre: 'Asistente WALL-E', tipo: 'Agente IA', proveedor: 'Por definir', negocio: 'cdh-maker-servicios', proposito: 'Propuesta: asistente interno de CDH Maker (confirmar alcance y canal).', estado: 'en desarrollo' },
  { id: 'automatizaciones-n8n', nombre: 'Automatizaciones n8n', tipo: 'Automatización (n8n/Make/Zapier)', proveedor: 'n8n', negocio: 'cdh-maker-servicios', proposito: 'Propuesta: flujos automáticos (leads del sitio → CRM, avisos, reportes). Inventariar cada flujo.', estado: 'en desarrollo' },
  { id: 'evaia-agente', nombre: 'EVAIA', tipo: 'Agente IA', proveedor: 'Por definir', negocio: 'evaia', proposito: 'Propuesta: agente de EVAIA (confirmar canal y métricas).', estado: 'en desarrollo' },
  { id: 'yam-a-tiempo', nombre: 'YAM — mensajería de A Tiempo Logística', tipo: 'Otro', proveedor: 'Propio', negocio: 'a-tiempo-logistica', proposito: 'Propuesta: red de mensajería de A Tiempo Logística (confirmar si incluye bot o respuestas automáticas).', estado: 'en desarrollo' },
];

function vistaBots(pinta, d) {
  const hoy = hoyCO();
  const orden = [...d.bots].sort((a, b) => (a.estado === 'caído' ? -1 : 0) - (b.estado === 'caído' ? -1 : 0) || ESTADOS_BOT.indexOf(a.estado) - ESTADOS_BOT.indexOf(b.estado) || porNombre(a, b));
  pinta(`<div class="kpis">${ESTADOS_BOT.map((e) => kpi(e[0].toUpperCase() + e.slice(1), d.bots.filter((b) => b.estado === e).length, e === 'caído' ? (d.bots.some((b) => b.estado === e) ? 'err' : '') : e === 'activo' ? 'ok' : '')).join('')}</div>
    <div class="card"><div class="cab"><h2 style="margin:0">Bots y automatizaciones</h2><div class="acciones" style="margin:0"><button id="sembrarBots">Sembrar bots conocidos</button><a class="boton primario" href="#marketing/bots/nuevo">Nuevo bot</a></div></div><div id="mBots"></div>
    ${orden.length ? `<div class="tabla"><table><tr><th>Bot</th><th>Negocio</th><th>Canal</th><th>Estado</th><th>Salud</th><th>Última revisión</th><th>Responsable</th></tr>
      ${orden.map((b) => { const ok = SALUD.filter(([k]) => b.salud?.[k]).length; const vieja = !b.ultima_revision || diasEntre(b.ultima_revision, hoy) > 14;
        return `<tr class="fila" data-id="${esc(b.id)}"><td><b>${esc(b.nombre)}</b><br><small class="suave">${esc(b.tipo || '')} · ${esc(b.proveedor || '')}</small></td><td>${esc(nombreNegocio(d.plataformas, b.negocio))}</td>
        <td>${esc(b.canal || '—')}</td><td>${chip(b.estado)}</td><td><span class="chip ${ok === SALUD.length ? 'ok' : ok ? 'parcial' : 'neutro'}">${ok}/${SALUD.length}</span></td>
        <td>${esc(b.ultima_revision || 'nunca')}${vieja && b.estado !== 'pausado' ? ' <span class="chip pendiente">revisar</span>' : ''}</td><td>${esc(nombreDe(b.responsable))}</td></tr>`; }).join('')}</table></div>`
      : '<div class="vacio" style="margin-top:12px">Aún no hay bots. Usa «Sembrar bots conocidos» para empezar.</div>'}</div>`);
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'marketing/bots/' + tr.dataset.id)));
  document.getElementById('sembrarBots').addEventListener('click', async () => {
    const m = document.getElementById('mBots');
    try {
      let n = 0;
      for (const { id, ...b } of BOTS_SEMILLA) {
        const ref = doc(db, COL.bots, id);
        if ((await getDoc(ref)).exists()) continue;
        await setDoc(ref, { ...b, responsable: 'henry', salud: {}, metricas: [], ultima_revision: '', url_docs: '', notas: '', ...sello(true) }); n++;
      }
      if (!d.plataformas.length) aviso(m, 'Sembrados. Siembra también las plataformas para que se vea el negocio de cada bot.', 'warn');
      if (n) ir('marketing/bots'); else aviso(m, 'Los bots conocidos ya estaban registrados.', 'info');
    } catch (err) { fallo(m, err); }
  });
}

function vistaBot(pinta, d, id) {
  const nuevo = id === 'nuevo';
  const b = nuevo ? { estado: 'en desarrollo', salud: {}, metricas: [] } : d.bots.find((x) => x.id === id);
  if (!b) return pinta('<div class="card"><div class="aviso err">Bot no encontrado.</div></div>');
  const mets = [...(b.metricas || [])].sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  const t = mets.reduce((s, m) => ({ c: s.c + num(m.conversaciones), l: s.l + num(m.leads), r: s.r + num(m.resueltas) }), { c: 0, l: 0, r: 0 });
  pinta(`<p><a href="#marketing/bots">← Bots</a></p><div class="cols mitad"><div class="card">
    <div class="cab"><h2 style="margin:0">${nuevo ? 'Nuevo bot' : esc(b.nombre)}</h2>${nuevo ? '' : chip(b.estado)}</div>
    <form id="fBot"><div class="grid">${inp('nombre', 'Nombre', b.nombre, 'required')}${sel('tipo', 'Tipo', TIPOS_BOT, b.tipo || 'WhatsApp')}
      ${inp('proveedor', 'Proveedor / plataforma', b.proveedor, 'placeholder="n8n, ManyChat, Twilio, propio…"')}<div><label>Negocio</label><select name="negocio">${opcNegocios(d.plataformas, b.negocio)}</select></div>
      ${inp('canal', 'Número / canal', b.canal)}${sel('estado', 'Estado', ESTADOS_BOT, b.estado)}${resp(b.responsable)}${inp('ultima_revision', 'Última revisión', b.ultima_revision, 'type="date"')}
      ${inp('url_panel', 'URL del panel', b.url_panel, 'type="url" placeholder="https://"')}${inp('url_docs', 'URL de documentación', b.url_docs, 'type="url" placeholder="https://"')}</div>
      ${area('proposito', 'Propósito', b.proposito, 'style="min-height:60px"')}
      <label>Checklist de salud</label><div class="mk-check">${SALUD.map(([k, l]) => `<label><input type="checkbox" name="salud_${k}" ${b.salud?.[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      ${area('notas', 'Notas', b.notas, 'style="min-height:60px"')}
      <p class="suave">No guardes aquí tokens, claves de API ni contraseñas: escribe dónde están en el gestor de contraseñas.</p>
      <div class="acciones"><button class="primario">${nuevo ? 'Crear bot' : 'Guardar'}</button>${nuevo ? '' : '<button type="button" id="revisado">Guardar y marcar revisado hoy</button><button type="button" class="peligro" id="borrarBot">Borrar</button>'}
        ${b.url_panel ? enlace(b.url_panel, 'Panel') : ''} ${b.url_docs ? enlace(b.url_docs, 'Documentación') : ''}</div></form><div id="mBot"></div></div>
  ${nuevo ? '' : `<div><div class="kpis">${kpi('Conversaciones', miles(t.c), 'cian')}${kpi('Leads', miles(t.l), 'ok', t.c ? `${(t.l / t.c * 100).toFixed(1)} % de conversión` : '')}${kpi('Resueltas sin humano', miles(t.r), '', t.c ? `${(t.r / t.c * 100).toFixed(1)} %` : '')}</div>
    <div class="card"><h2>Métricas por fecha</h2><form id="fBm"><div class="grid">${inp('fecha', 'Fecha', hoyCO(), 'type="date" required')}${inp('conversaciones', 'Conversaciones', '', 'type="number" min="0" step="1" required')}
      ${inp('leads', 'Leads', '', 'type="number" min="0" step="1"')}${inp('resueltas', 'Resueltas', '', 'type="number" min="0" step="1"')}</div><div class="acciones"><button class="mini primario">Agregar</button></div></form>
      ${mets.length ? `<div class="tabla"><table><tr><th>Fecha</th><th style="text-align:right">Conversaciones</th><th style="text-align:right">Leads</th><th style="text-align:right">Resueltas</th><th></th></tr>
        ${mets.map((m) => `<tr><td>${esc(m.fecha)}</td><td style="text-align:right">${miles(m.conversaciones)}</td><td style="text-align:right">${miles(m.leads)}</td><td style="text-align:right">${miles(m.resueltas)}</td><td><button class="mini peligro" data-quitar="${esc(m.id)}">✕</button></td></tr>`).join('')}</table></div>` : '<p class="suave">Sin métricas.</p>'}</div></div>`}</div>`);
  const ref = nuevo ? null : doc(db, COL.bots, id);
  const leerBot = (form) => {
    const f = datos(form);
    const salud = Object.fromEntries(SALUD.map(([k]) => [k, f['salud_' + k] === 'on']));
    for (const [k] of SALUD) delete f['salud_' + k];
    return { ...f, salud };
  };
  const form = document.getElementById('fBot');
  const guardar = async (extra = {}) => {
    try {
      if (nuevo) { const r = await addDoc(collection(db, COL.bots), { ...leerBot(form), metricas: [], ...extra, ...sello(true) }); ir('marketing/bots/' + r.id); }
      else { await updateDoc(ref, { ...leerBot(form), ...extra, ...sello() }); ir('marketing/bots/' + id); }
    } catch (err) { fallo(document.getElementById('mBot'), err); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  if (nuevo) return;
  document.getElementById('revisado').addEventListener('click', () => { if (form.reportValidity()) guardar({ ultima_revision: hoyCO(), revisado_por: ctx.usuario.email }); });
  document.getElementById('borrarBot').addEventListener('click', async () => { if (confirm(`¿Borrar «${b.nombre}» y sus métricas?`)) { await deleteDoc(ref); ir('marketing/bots'); } });
  document.getElementById('fBm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target);
    const actual = (await getDoc(ref)).data()?.metricas || [];
    await updateDoc(ref, { metricas: [...actual, { id: rid(), fecha: f.fecha, conversaciones: num(f.conversaciones), leads: num(f.leads), resueltas: num(f.resueltas) }], ...sello() });
    ir('marketing/bots/' + id);
  });
  $app.querySelectorAll('[data-quitar]').forEach((x) => x.addEventListener('click', async () => {
    if (!confirm('¿Quitar este registro?')) return;
    const actual = (await getDoc(ref)).data()?.metricas || [];
    await updateDoc(ref, { metricas: actual.filter((m) => m.id !== x.dataset.quitar), ...sello() });
    ir('marketing/bots/' + id);
  }));
}

// ───────── plataformas y negocios ─────────
// Paneles genéricos (sin ids de proyecto): cada quien entra con su sesión.
const PLATAFORMAS_SEMILLA = [
  { id: 'sitio-cdhmaker', nombre: 'Sitio cdhmaker.com', tipo: 'sitio', url: 'https://cdhmaker.com', estado: 'activo',
    paneles: [{ nombre: 'Firebase', url: 'https://console.firebase.google.com/' }, { nombre: 'Search Console', url: 'https://search.google.com/search-console' }, { nombre: 'Meta Business Suite', url: 'https://business.facebook.com/' }],
    notas: 'Portafolio, asesor «Maker», widget de WhatsApp, firma electrónica y este CRM.' },
  { id: 'incubapp', nombre: 'IncubApp', tipo: 'SaaS', url: 'https://incubapp.cdhmaker.com', estado: 'activo',
    paneles: [{ nombre: 'Vercel', url: 'https://vercel.com/dashboard' }, { nombre: 'Supabase', url: 'https://supabase.com/dashboard/projects' }],
    notas: 'SaaS multi-tenant de incubadoras. Cliente ancla white-label: Incubant (Antioqueña de Incubación).' },
  { id: 'taxiya', nombre: 'TaxiYa', tipo: 'app', url: '', estado: 'activo', paneles: [{ nombre: 'Supabase', url: 'https://supabase.com/dashboard/projects' }], notas: '' },
  { id: 'a-tiempo-logistica', nombre: 'A Tiempo Logística', tipo: 'SaaS', url: '', estado: 'activo', paneles: [{ nombre: 'Supabase', url: 'https://supabase.com/dashboard/projects' }], notas: '' },
  { id: 'evaia', nombre: 'EVAIA', tipo: 'SaaS', url: '', estado: 'en desarrollo', paneles: [], notas: '' },
  { id: 'privacycheck', nombre: 'PrivacyCheck', tipo: 'SaaS', url: '', estado: 'en desarrollo', paneles: [], notas: '' },
  { id: 'tienda-medellin', nombre: 'Tienda Medellín', tipo: 'tienda', url: '', estado: 'activo', paneles: [], notas: '' },
  { id: 'cdh-maker-servicios', nombre: 'CDH Maker (servicios)', tipo: 'servicio', url: 'https://cdhmaker.com', estado: 'activo', paneles: [],
    notas: 'Software a la medida, IoT, fabricación digital (impresión 3D, láser, CNC) y consultoría.' },
];
const panelesATexto = (p = []) => p.map((x) => `${x.nombre} | ${x.url}`).join('\n');
const textoAPaneles = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [n, ...u] = l.split('|'); const url = u.join('|').trim(); return url ? { nombre: n.trim(), url } : { nombre: '', url: n.trim() }; });

function vistaPlataformas(pinta, d) {
  const lista = [...d.plataformas].sort(porNombre);
  const cuenta = (col, pid) => d[col].filter((x) => x.negocio === pid).length;
  pinta(`<div class="card"><div class="cab"><h2 style="margin:0">Plataformas y negocios</h2><div class="acciones" style="margin:0"><button id="sembrarPlat">Sembrar la lista de CDH Maker</button><a class="boton primario" href="#marketing/plataformas/nueva">Nueva</a></div></div>
    <p class="suave">Todo lo que opera la empresa. Esta lista alimenta el selector «negocio» de campañas, redes, calendario y bots.</p><div id="mPlat"></div>
    ${lista.length ? `<div class="tabla"><table><tr><th>Nombre</th><th>Tipo</th><th>URL pública</th><th>Paneles</th><th>Estado</th><th>Responsable</th><th style="text-align:right">Campañas · redes · bots</th></tr>
      ${lista.map((p) => `<tr class="fila" data-id="${esc(p.id)}"><td><b>${esc(p.nombre)}</b></td><td>${esc(p.tipo || '')}</td><td>${p.url ? enlace(p.url, p.url.replace(/^https?:\/\//, '')) : '—'}</td>
        <td>${(p.paneles || []).map((x) => enlace(x.url, x.nombre || 'panel')).join(' · ') || '—'}</td><td>${chip(p.estado)}</td><td>${esc(nombreDe(p.responsable))}</td>
        <td style="text-align:right">${cuenta('campanas', p.id)} · ${cuenta('redes', p.id)} · ${cuenta('bots', p.id)}</td></tr>`).join('')}</table></div>`
      : '<div class="vacio" style="margin-top:12px">Vacío. Usa «Sembrar la lista de CDH Maker».</div>'}</div>`);
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = 'marketing/plataformas/' + tr.dataset.id; }));
  document.getElementById('sembrarPlat').addEventListener('click', async () => {
    const m = document.getElementById('mPlat');
    try {
      let n = 0;
      for (const { id, ...p } of PLATAFORMAS_SEMILLA) {
        const ref = doc(db, COL.plataformas, id);
        if ((await getDoc(ref)).exists()) continue;
        await setDoc(ref, { ...p, responsable: 'henry', ...sello(true) }); n++;
      }
      if (n) ir('marketing/plataformas'); else aviso(m, 'La lista ya estaba sembrada.', 'info');
    } catch (err) { fallo(m, err); }
  });
}

function vistaPlataforma(pinta, d, id) {
  const nueva = id === 'nueva';
  const p = nueva ? { estado: 'activo', paneles: [] } : d.plataformas.find((x) => x.id === id);
  if (!p) return pinta('<div class="card"><div class="aviso err">Plataforma no encontrada.</div></div>');
  const de = (col) => d[col].filter((x) => x.negocio === id);
  pinta(`<p><a href="#marketing/plataformas">← Plataformas</a></p><div class="cols mitad"><div class="card"><h2>${nueva ? 'Nueva plataforma o negocio' : esc(p.nombre)}</h2>
    <form id="fPlat"><div class="grid">${inp('nombre', 'Nombre', p.nombre, 'required')}${sel('tipo', 'Tipo', TIPOS_PLAT, p.tipo || 'SaaS')}${inp('url', 'URL pública', p.url, 'placeholder="https://"')}
      ${sel('estado', 'Estado', ESTADOS_PLAT, p.estado)}${resp(p.responsable)}</div>
      ${area('paneles', 'Paneles (uno por línea: Nombre | URL)', panelesATexto(p.paneles), 'style="min-height:90px" placeholder="Vercel | https://vercel.com/dashboard"')}
      ${area('notas', 'Notas', p.notas, 'style="min-height:70px"')}
      <p class="suave">Solo enlaces: las claves quedan en el gestor de contraseñas.</p>
      <div class="acciones"><button class="primario">${nueva ? 'Crear' : 'Guardar'}</button>${nueva ? '' : '<button type="button" class="peligro" id="borrarPlat">Borrar</button>'}</div></form><div id="mPlat"></div></div>
  ${nueva ? '' : `<div class="card"><h2>Lo que depende de ${esc(p.nombre)}</h2>
    ${[['campanas', 'Campañas', (x) => x.nombre], ['redes', 'Redes', (x) => `${x.plataforma} ${x.usuario || ''}`], ['bots', 'Bots', (x) => x.nombre], ['publicaciones', 'Publicaciones', (x) => `${x.fecha} · ${x.formato || ''}`]].map(([col, t, f]) => {
      const l = de(col); const ruta = col === 'publicaciones' ? 'calendario/p' : col;
      return `<h3>${t} (${l.length})</h3>${l.length ? `<ul class="lista">${l.slice(0, 12).map((x) => `<li data-href="marketing/${ruta}/${esc(x.id)}">${esc(f(x))} ${chip(x.estado)}</li>`).join('')}</ul>` : '<p class="suave">Ninguno.</p>'}`; }).join('')}
    ${(p.paneles || []).length ? `<h3>Paneles</h3><div class="acciones">${p.paneles.map((x) => `<a class="boton" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.nombre || x.url)}</a>`).join('')}</div>` : ''}</div>`}</div>`);
  const ref = nueva ? null : doc(db, COL.plataformas, id);
  document.getElementById('fPlat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = datos(e.target); f.paneles = textoAPaneles(f.paneles);
    try {
      if (nueva) {
        const nid = slug(f.nombre) || rid();
        if ((await getDoc(doc(db, COL.plataformas, nid))).exists()) return aviso(document.getElementById('mPlat'), 'Ya existe una plataforma con ese nombre.', 'err');
        await setDoc(doc(db, COL.plataformas, nid), { ...f, ...sello(true) }); ir('marketing/plataformas/' + nid);
      } else { await updateDoc(ref, { ...f, ...sello() }); ir('marketing/plataformas/' + id); }
    } catch (err) { fallo(document.getElementById('mPlat'), err); }
  });
  $app.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => (location.hash = el.dataset.href)));
  if (nueva) return;
  document.getElementById('borrarPlat').addEventListener('click', async () => {
    const usos = ['campanas', 'redes', 'bots', 'publicaciones'].reduce((s, c) => s + de(c).length, 0);
    if (!confirm(`¿Borrar «${p.nombre}»?${usos ? ` ${usos} registro(s) quedarán sin negocio.` : ''}`)) return;
    await deleteDoc(ref); ir('marketing/plataformas');
  });
}
