// Inicio: tablero con los números del negocio. Cada bloque se carga por separado para que
// un error (p. ej. YAM caído) no tumbe el resto.
import { db } from './fb.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, cop, copCorto, fecha, fmtFecha, hoyISO, ETAPAS, ORIGENES, resumenPagos, etiqueta } from './util.js?v=1';
import { tarjetaYam } from './yam.js?v=1';

const todos = async (col) => (await getDocs(collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() }));
const kpi = (t, v, d = '', cls = '') => `<div class="kpi ${cls}"><div class="t">${esc(t)}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
export const ABIERTAS = ['nuevo', 'contactado', 'propuesta', 'negociacion'];
export const PROB = { nuevo: 0.1, contactado: 0.2, propuesta: 0.4, negociacion: 0.7, ganado: 1, perdido: 0 };

export async function vistaInicio({ nav }) {
  nav('inicio');
  const $app = document.getElementById('app');
  $app.innerHTML = `<h1>Inicio</h1><div class="kpis" id="kpis"><div class="kpi"><div class="t">Cargando…</div></div></div>
    <div class="cols2"><div class="card" id="cEmbudo"><h2>Pipeline</h2><p class="suave">Cargando…</p></div><div class="card" id="cYam"><h2>YAM</h2><p class="suave">Cargando…</p></div></div>
    <div class="cols2"><div class="card" id="cCobros"><h2>Próximos cobros</h2></div><div class="card" id="cLeads"><h2>Leads recientes</h2></div></div>`;
  tarjetaYam(document.getElementById('cYam')).catch((e) => { document.getElementById('cYam').innerHTML = `<h2>YAM</h2><div class="aviso err">${esc(e.message)}</div>`; });

  const [leads, ops, proyectos, clientes, comisiones] = await Promise.all(
    ['crm_leads', 'crm_oportunidades', 'crm_proyectos', 'crm_clientes', 'crm_comisiones'].map((c) => todos(c).catch((e) => { console.warn(c, e); return null; })));

  const ahora = Date.now(), dia = 864e5;
  const recientes = (leads || []).filter((l) => fecha(l.creado) && ahora - fecha(l.creado) < 30 * dia);
  const semana = recientes.filter((l) => ahora - fecha(l.creado) < 7 * dia);
  const sinAtender = (leads || []).filter((l) => l.estado === 'nuevo');
  const abiertas = (ops || []).filter((o) => ABIERTAS.includes(o.etapa));
  const valorAbierto = abiertas.reduce((s, o) => s + Number(o.valor_cop || 0), 0);
  const ponderado = abiertas.reduce((s, o) => s + Number(o.valor_cop || 0) * (PROB[o.etapa] || 0), 0);
  const ganadas30 = (ops || []).filter((o) => o.etapa === 'ganado' && fecha(o.cerrado || o.actualizado) && ahora - fecha(o.cerrado || o.actualizado) < 30 * dia);
  const activos = (proyectos || []).filter((p) => ['planeacion', 'en_curso', 'soporte'].includes(p.estado));
  const hoy = hoyISO();
  const pend = [];
  for (const c of clientes || []) for (const q of c.cuotas || []) if (q.estado !== 'pagada') pend.push({ cliente: c, ...q });
  const saldo = pend.reduce((s, q) => s + Number(q.valor || 0), 0);
  const vencidas = pend.filter((q) => q.fecha && q.fecha < hoy);
  const comPend = (comisiones || []).filter((c) => c.estado === 'pendiente' || c.estado === 'aprobada');
  const nd = (x, v) => (x === null ? '<span class="suave" style="font-size:14px">sin acceso</span>' : v);

  document.getElementById('kpis').innerHTML =
    kpi('Leads nuevos (7 d)', nd(leads, semana.length), `${recientes.length} en 30 días · ${sinAtender.length} sin atender`, sinAtender.length > 5 ? 'alerta' : '')
    + kpi('Pipeline abierto', nd(ops, copCorto(valorAbierto)), `${abiertas.length} oportunidades · ponderado ${copCorto(ponderado)}`)
    + kpi('Ganado (30 d)', nd(ops, copCorto(ganadas30.reduce((s, o) => s + Number(o.valor_cop || 0), 0))), `${ganadas30.length} negocios`)
    + kpi('Proyectos activos', nd(proyectos, activos.length), `${(proyectos || []).length} en total`)
    + kpi('Por cobrar', nd(clientes, copCorto(saldo)), `${pend.length} cuotas pendientes`)
    + kpi('Cuotas vencidas', nd(clientes, vencidas.length), copCorto(vencidas.reduce((s, q) => s + Number(q.valor || 0), 0)) + ' COP', vencidas.length ? 'alerta' : '')
    + kpi('Comisiones por pagar', nd(comisiones, copCorto(comPend.reduce((s, c) => s + Number(c.valor_cop || 0), 0))), `${comPend.length} a afiliados`);

  // Embudo por etapa (cantidad y valor)
  const eEl = document.getElementById('cEmbudo');
  if (!ops) eEl.innerHTML = '<h2>Pipeline</h2><div class="aviso err">No se pudo leer el pipeline.</div>';
  else {
    const porEtapa = ETAPAS.map(([k, l]) => { const xs = ops.filter((o) => o.etapa === k); return { k, l, n: xs.length, v: xs.reduce((s, o) => s + Number(o.valor_cop || 0), 0) }; });
    const max = Math.max(1, ...porEtapa.map((x) => x.v));
    eEl.innerHTML = `<h2>Pipeline por etapa</h2>${ops.length ? `<div class="embudo">${porEtapa.map((x) => `<div class="fila"><span>${esc(x.l)} <span class="suave">(${x.n})</span></span>
      <div class="pista" title="${esc(cop(x.v))}"><div class="relleno" style="width:${(x.v / max * 100).toFixed(1)}%"></div></div><span class="num">${copCorto(x.v)}</span></div>`).join('')}</div>`
      : '<div class="vacio">Sin oportunidades. <a href="#pipeline">Crear la primera</a></div>'}<p><a href="#pipeline">Abrir pipeline →</a></p>`;
  }

  const cEl = document.getElementById('cCobros');
  const prox = pend.filter((q) => q.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 8);
  cEl.innerHTML = `<h2>Próximos cobros</h2>${clientes === null ? '<div class="aviso err">No se pudieron leer los clientes.</div>' : prox.length ? `<div class="tabla"><table><tr><th>Vence</th><th>Cliente</th><th class="num">Valor</th></tr>
    ${prox.map((q) => `<tr class="clic" data-c="${esc(q.cliente.id)}"><td>${esc(q.fecha)} ${q.fecha < hoy ? '<span class="chip vencido">vencida</span>' : ''}</td><td>${esc(q.cliente.nombre)}</td><td class="num">${cop(q.valor)}</td></tr>`).join('')}</table></div>`
    : '<div class="vacio">No hay cuotas pendientes.</div>'}`;
  cEl.querySelectorAll('[data-c]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'cliente/' + encodeURIComponent(tr.dataset.c))));

  const lEl = document.getElementById('cLeads');
  const ult = [...(leads || [])].sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0)).slice(0, 6);
  lEl.innerHTML = `<h2>Leads recientes</h2>${leads === null ? '<div class="aviso err">No se pudieron leer los leads.</div>' : ult.length ? `<div class="tabla"><table><tr><th>Fecha</th><th>Lead</th><th>Afiliado</th><th>Estado</th></tr>
    ${ult.map((l) => `<tr class="clic" data-l="${esc(l.id)}"><td>${fmtFecha(l.creado, true)}</td><td>${esc(l.nombre || etiqueta(Object.entries(ORIGENES), l.origen))}</td><td>${l.ref ? `<code>${esc(l.ref)}</code>` : '—'}</td><td><span class="chip ${esc(l.estado)}">${esc(l.estado)}</span></td></tr>`).join('')}</table></div>`
    : '<div class="vacio">Aún no hay leads.</div>'}<p><a href="#leads">Ver todos →</a></p>`;
  lEl.querySelectorAll('[data-l]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'lead/' + encodeURIComponent(tr.dataset.l))));
}
