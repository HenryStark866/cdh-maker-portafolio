// Proyectos: cliente, servicio, estado, URL de producción, fechas. Las cuotas, firmas y el
// expediente NO se duplican: viven en el cliente (crm_clientes) y aquí se resumen y enlazan.
import { db } from './fb.js';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, cop, fmtFecha, aviso, dialogo, opciones, num, SERVICIOS, ESTADOS_PROYECTO, etiqueta, formulario, resumenPagos } from './util.js?v=1';
import { bitacora } from './actividades.js?v=1';

const listar = async (col) => (await getDocs(collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() }));
const formProy = (p = {}, clientes = []) => `<label>Nombre</label><input name="nombre" required maxlength="160" value="${esc(p.nombre || '')}">
  <div class="grid">
  <div><label>Cliente</label><select name="cliente_id"><option value="">— interno / sin cliente</option>${opciones(clientes.map((c) => [c.id, c.nombre]), p.cliente_id)}</select></div>
  <div><label>Servicio</label><select name="servicio"><option value="">—</option>${opciones(SERVICIOS, p.servicio)}</select></div>
  <div><label>Estado</label><select name="estado">${opciones(ESTADOS_PROYECTO, p.estado || 'planeacion')}</select></div>
  <div><label>Valor (COP)</label><input name="valor_cop" type="number" min="0" step="10000" value="${esc(p.valor_cop ?? '')}"></div>
  <div><label>URL de producción</label><input name="url_produccion" type="url" placeholder="https://…" value="${esc(p.url_produccion || '')}"></div>
  <div><label>Repositorio</label><input name="repo" placeholder="github.com/…" value="${esc(p.repo || '')}"></div>
  <div><label>Inicio</label><input name="inicio" type="date" value="${esc(p.inicio || '')}"></div>
  <div><label>Entrega estimada</label><input name="entrega_estimada" type="date" value="${esc(p.entrega_estimada || '')}"></div>
  <div><label>Entregado</label><input name="entregado" type="date" value="${esc(p.entregado || '')}"></div></div>
  <label>Notas</label><textarea class="txt" name="notas" maxlength="5000">${esc(p.notas || '')}</textarea>`;
const limpiar = (f) => ({ ...f, cliente_id: f.cliente_id || null, valor_cop: f.valor_cop === '' ? null : num(f.valor_cop) });
const enlace = (u) => (/^https?:\/\//.test(u || '') ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//, ''))}</a>` : '—');
let ver = 'activos';

export async function vistaProyectos({ nav, usuario }) {
  nav('proyectos');
  const $app = document.getElementById('app');
  const [proyectos, clientes] = await Promise.all([listar('crm_proyectos'), listar('crm_clientes')]);
  const cli = Object.fromEntries(clientes.map((c) => [c.id, c]));
  const vis = proyectos.filter((p) => ver === 'todos' || ['planeacion', 'en_curso', 'soporte', 'pausado'].includes(p.estado))
    .sort((a, b) => ESTADOS_PROYECTO.findIndex((e) => e[0] === a.estado) - ESTADOS_PROYECTO.findIndex((e) => e[0] === b.estado) || String(a.nombre).localeCompare(b.nombre));
  $app.innerHTML = `<div class="barra"><h1 style="margin:0">Proyectos (${vis.length})</h1><div class="filtros">
    <select id="pVer"><option value="activos">En marcha</option><option value="todos"${ver === 'todos' ? ' selected' : ''}>Todos</option></select><button class="primario" id="pNuevo">Nuevo proyecto</button></div></div>
    <div class="card">${vis.length ? `<div class="tabla"><table><tr><th>Proyecto</th><th>Cliente</th><th>Estado</th><th>Producción</th><th>Entrega</th><th class="num">Cobrado</th></tr>
    ${vis.map((p) => { const c = cli[p.cliente_id]; const r = c ? resumenPagos(c) : null; return `<tr class="clic" data-id="${esc(p.id)}"><td><b>${esc(p.nombre)}</b><br><small class="suave">${esc(etiqueta(SERVICIOS, p.servicio))}</small></td>
      <td>${c ? esc(c.nombre) : '<span class="suave">—</span>'}</td><td><span class="chip ${esc(p.estado)}">${esc(etiqueta(ESTADOS_PROYECTO, p.estado))}</span></td><td>${enlace(p.url_produccion)}</td>
      <td style="white-space:nowrap">${esc(p.entregado || p.entrega_estimada || '—')}</td>
      <td class="num">${r ? `${cop(r.pagado)}<br><small class="suave">de ${cop(r.total)}${r.vencidas.length ? ` · <span style="color:var(--err)">${r.vencidas.length} vencida(s)</span>` : ''}</small>` : '—'}</td></tr>`; }).join('')}</table></div>`
    : '<div class="vacio">No hay proyectos en esta vista.</div>'}</div>`;
  document.getElementById('pVer').addEventListener('change', (e) => { ver = e.target.value; vistaProyectos({ nav, usuario }); });
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('a')) return; location.hash = 'proyecto/' + encodeURIComponent(tr.dataset.id); }));
  document.getElementById('pNuevo').addEventListener('click', async () => {
    const d = await dialogo('Nuevo proyecto', formProy({}, clientes), { boton: 'Crear', ancho: 640 });
    if (!d) return;
    const r = await addDoc(collection(db, 'crm_proyectos'), { ...limpiar(d), oportunidad_id: null, creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'proyecto/' + r.id;
  });
}

export async function vistaProyecto(id, { nav, usuario }) {
  nav('proyectos');
  const $app = document.getElementById('app');
  const ref = doc(db, 'crm_proyectos', id);
  const [snap, clientes] = await Promise.all([getDoc(ref), listar('crm_clientes')]);
  if (!snap.exists()) { $app.innerHTML = '<p><a href="#proyectos">← Proyectos</a></p><div class="card"><div class="aviso err">Proyecto no encontrado.</div></div>'; return; }
  const p = snap.data();
  const c = clientes.find((x) => x.id === p.cliente_id);
  const r = c ? resumenPagos(c) : null;
  $app.innerHTML = `<p><a href="#proyectos">← Proyectos</a></p><div class="cols2"><div>
    <div class="card"><div class="barra"><h2 style="margin:0">${esc(p.nombre)}</h2><span class="chip ${esc(p.estado)}">${esc(etiqueta(ESTADOS_PROYECTO, p.estado))}</span></div>
      <p class="suave">Producción: ${enlace(p.url_produccion)}${p.oportunidad_id ? ` · <a href="#op/${esc(p.oportunidad_id)}">oportunidad de origen</a>` : ''}</p>
      <form id="fProy">${formProy(p, clientes)}<div class="acciones"><button class="primario">Guardar</button></div></form><div id="mProy"></div></div></div>
    <div><div class="card"><h2>Cobros</h2>${c ? `<p>Cliente <a href="#cliente/${esc(c.id)}">${esc(c.nombre)}</a>: pagado <b>${cop(r.pagado)}</b> de <b>${cop(r.total)}</b> · saldo <b>${cop(r.saldo)}</b> · ${r.pagadas}/${r.n} cuotas
      ${r.vencidas.length ? `<br><span class="chip vencido">${r.vencidas.length} cuota(s) vencida(s)</span>` : ''}</p>
      <p class="suave">Las cuotas, las firmas y el expediente se manejan en la ficha del cliente.</p><a href="#cliente/${esc(c.id)}">Abrir cuotas, firmas y expediente →</a>`
      : '<p class="suave">Asigna un cliente para ver sus cuotas, firmas y expediente.</p>'}</div>
    <div class="card" id="bit"></div></div></div>`;
  bitacora(document.getElementById('bit'), usuario, 'proyecto', id);
  document.getElementById('fProy').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateDoc(ref, { ...limpiar(formulario(e.target)), actualizado: serverTimestamp(), actualizado_por: usuario.email });
    vistaProyecto(id, { nav, usuario });
  });
}
