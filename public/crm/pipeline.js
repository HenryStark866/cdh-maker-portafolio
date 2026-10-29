// Pipeline tipo kanban: nuevo → contactado → propuesta → negociación → ganado / perdido.
// Escritorio: arrastrar y soltar. Móvil (o teclado): el selector de etapa de cada tarjeta.
import { db } from './fb.js';
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, cop, copCorto, fmtFecha, aviso, dialogo, opciones, num, slug, RE_CODIGO, ETAPAS, SERVICIOS, ESTADOS_PROYECTO, etiqueta, formulario } from './util.js?v=1';
import { bitacora, registrar } from './actividades.js?v=1';
import { PROB } from './inicio.js?v=1';

const formOp = (o = {}, clientes = [], afiliados = []) => `<label>Título</label><input name="titulo" required maxlength="160" value="${esc(o.titulo || '')}">
  <div class="grid">
  <div><label>Servicio</label><select name="servicio"><option value="">—</option>${opciones(SERVICIOS, o.servicio)}</select></div>
  <div><label>Valor estimado (COP)</label><input name="valor_cop" type="number" min="0" step="10000" value="${esc(o.valor_cop ?? 0)}"></div>
  <div><label>Etapa</label><select name="etapa">${opciones(ETAPAS, o.etapa || 'nuevo')}</select></div>
  <div><label>Cierre estimado</label><input name="cierre_estimado" type="date" value="${esc(o.cierre_estimado || '')}"></div>
  <div><label>Contacto</label><input name="contacto" maxlength="120" value="${esc(o.contacto || '')}"></div>
  <div><label>Teléfono / correo</label><input name="telefono" maxlength="120" value="${esc(o.telefono || o.email || '')}"></div>
  <div><label>Cliente existente</label><select name="cliente_id"><option value="">— (aún no es cliente)</option>${opciones(clientes.map((c) => [c.id, c.nombre]), o.cliente_id)}</select></div>
  <div><label>Afiliado que lo refirió</label><select name="afiliado"><option value="">— ninguno</option>${opciones(afiliados.map((a) => [a.id, `${a.nombre} (${a.id})`]).concat(o.afiliado && !afiliados.some((a) => a.id === o.afiliado) ? [[o.afiliado, o.afiliado]] : []), o.afiliado)}</select></div></div>
  ${o.etapa === 'perdido' ? `<label>Motivo de pérdida</label><input name="motivo_perdida" maxlength="300" value="${esc(o.motivo_perdida || '')}">` : ''}`;
const limpiar = (f) => ({ ...f, valor_cop: num(f.valor_cop), cliente_id: f.cliente_id || null, afiliado: RE_CODIGO.test(f.afiliado || '') ? f.afiliado : null });
const listar = async (col) => (await getDocs(collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() }));

async function moverEtapa(usuario, id, o, etapa) {
  if (o.etapa === etapa) return;
  const extra = etapa === 'ganado' || etapa === 'perdido' ? { cerrado: serverTimestamp() } : {};
  if (etapa === 'perdido') { const m = prompt('¿Por qué se perdió? (opcional)', ''); if (m === null) return false; extra.motivo_perdida = m; }
  await updateDoc(doc(db, 'crm_oportunidades', id), { etapa, ...extra, actualizado: serverTimestamp(), actualizado_por: usuario.email });
  await registrar(usuario, 'oportunidad', id, `Etapa: ${etiqueta(ETAPAS, o.etapa)} → ${etiqueta(ETAPAS, etapa)}`, 'cambio_etapa');
  return true;
}

export async function vistaPipeline({ nav, usuario }) {
  nav('pipeline');
  const $app = document.getElementById('app');
  const [ops, clientes, afiliados] = await Promise.all([listar('crm_oportunidades'), listar('crm_clientes'), listar('crm_afiliados').catch(() => [])]);
  const abiertas = ops.filter((o) => !['ganado', 'perdido'].includes(o.etapa));
  const total = abiertas.reduce((s, o) => s + Number(o.valor_cop || 0), 0);
  const pond = abiertas.reduce((s, o) => s + Number(o.valor_cop || 0) * (PROB[o.etapa] || 0), 0);
  $app.innerHTML = `<div class="barra"><div><h1 style="margin:0">Pipeline</h1><span class="suave">${abiertas.length} abiertas · ${cop(total)} · ponderado ${cop(pond)}</span></div>
    <button class="primario" id="oNueva">Nueva oportunidad</button></div>
    <div class="kanban">${ETAPAS.map(([k, l]) => { const xs = ops.filter((o) => o.etapa === k).sort((a, b) => Number(b.valor_cop || 0) - Number(a.valor_cop || 0));
      return `<section class="col" data-etapa="${k}"><h3>${esc(l)} <span>${xs.length} · ${copCorto(xs.reduce((s, o) => s + Number(o.valor_cop || 0), 0))}</span></h3>
      ${xs.map((o) => `<article class="tarjeta" draggable="true" data-id="${esc(o.id)}"><b>${esc(o.titulo)}</b>
        <div class="v">${cop(o.valor_cop)}</div><div class="m">${esc(o.contacto || '')}${o.servicio ? ' · ' + esc(etiqueta(SERVICIOS, o.servicio)) : ''}${o.afiliado ? ` · ref <code>${esc(o.afiliado)}</code>` : ''}</div>
        ${o.cierre_estimado && !['ganado', 'perdido'].includes(k) ? `<div class="m">cierre ${esc(o.cierre_estimado)}</div>` : ''}
        <select aria-label="Mover a etapa" data-mover="${esc(o.id)}">${opciones(ETAPAS, k)}</select></article>`).join('') || '<div class="suave" style="padding:6px">—</div>'}</section>`; }).join('')}</div>`;
  const porId = Object.fromEntries(ops.map((o) => [o.id, o]));
  const rehacer = () => vistaPipeline({ nav, usuario });
  $app.querySelectorAll('.tarjeta').forEach((t) => {
    t.addEventListener('click', (e) => { if (e.target.closest('select')) return; location.hash = 'op/' + encodeURIComponent(t.dataset.id); });
    t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', t.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  });
  $app.querySelectorAll('.col').forEach((c) => {
    c.addEventListener('dragover', (e) => { e.preventDefault(); c.classList.add('sobre'); });
    c.addEventListener('dragleave', () => c.classList.remove('sobre'));
    c.addEventListener('drop', async (e) => {
      e.preventDefault(); c.classList.remove('sobre');
      const id = e.dataTransfer.getData('text/plain');
      if (porId[id] && await moverEtapa(usuario, id, porId[id], c.dataset.etapa)) rehacer();
    });
  });
  $app.querySelectorAll('[data-mover]').forEach((s) => s.addEventListener('change', async () => {
    const id = s.dataset.mover;
    if (await moverEtapa(usuario, id, porId[id], s.value)) rehacer(); else s.value = porId[id].etapa;
  }));
  document.getElementById('oNueva').addEventListener('click', async () => {
    const d = await dialogo('Nueva oportunidad', formOp({}, clientes, afiliados.filter((a) => a.estado !== 'retirado')), { boton: 'Crear', ancho: 640 });
    if (!d) return;
    const ref = await addDoc(collection(db, 'crm_oportunidades'), { ...limpiar(d), lead_id: null, creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    await registrar(usuario, 'oportunidad', ref.id, 'Oportunidad creada en etapa ' + etiqueta(ETAPAS, d.etapa), 'cambio_etapa');
    rehacer();
  });
}

export async function vistaOportunidad(id, { nav, usuario }) {
  nav('pipeline');
  const $app = document.getElementById('app');
  const ref = doc(db, 'crm_oportunidades', id);
  const [snap, clientes, afiliados, proyectos] = await Promise.all([getDoc(ref), listar('crm_clientes'), listar('crm_afiliados').catch(() => []), listar('crm_proyectos')]);
  if (!snap.exists()) { $app.innerHTML = '<p><a href="#pipeline">← Pipeline</a></p><div class="card"><div class="aviso err">Oportunidad no encontrada.</div></div>'; return; }
  const o = snap.data();
  const proy = proyectos.filter((p) => p.oportunidad_id === id);
  const cli = clientes.find((c) => c.id === o.cliente_id);
  $app.innerHTML = `<p><a href="#pipeline">← Pipeline</a></p><div class="cols2"><div>
    <div class="card"><div class="barra"><h2 style="margin:0">${esc(o.titulo)}</h2><span class="chip ${esc(o.etapa)}">${esc(etiqueta(ETAPAS, o.etapa))}</span></div>
      <p class="suave">Creada ${fmtFecha(o.creado, true)}${o.lead_id ? ` · desde <a href="#lead/${esc(o.lead_id)}">un lead</a>` : ''}${cli ? ` · cliente <a href="#cliente/${esc(cli.id)}">${esc(cli.nombre)}</a>` : ''}</p>
      <form id="fOp">${formOp(o, clientes, afiliados)}<div class="acciones"><button class="primario">Guardar</button><button type="button" class="peligro" id="oBorrar">Borrar</button></div></form><div id="mOp"></div></div>
    ${o.etapa === 'ganado' ? `<div class="card"><h2>Ganada: ponla en marcha</h2>
      ${cli ? `<p>Cliente: <a href="#cliente/${esc(cli.id)}">${esc(cli.nombre)}</a> (cuotas, firmas y expediente).</p>` : '<p class="suave">Crea el cliente en el CRM (hereda el afiliado para su comisión) y su proyecto.</p>'}
      ${proy.length ? `<p>Proyecto: ${proy.map((p) => `<a href="#proyecto/${esc(p.id)}">${esc(p.nombre)}</a>`).join(', ')}</p>` : ''}
      <div class="acciones">${cli ? '' : '<button class="primario" id="oCliente">Crear cliente</button>'}${proy.length ? '' : '<button id="oProyecto">Crear proyecto</button>'}</div><div id="mGan"></div></div>` : ''}
  </div><div class="card" id="bit"></div></div>`;
  bitacora(document.getElementById('bit'), usuario, 'oportunidad', id);
  const rehacer = () => vistaOportunidad(id, { nav, usuario });
  document.getElementById('fOp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = limpiar(formulario(e.target));
    if (f.etapa !== o.etapa) { if (!(await moverEtapa(usuario, id, o, f.etapa))) return; }
    delete f.etapa;
    await updateDoc(ref, { ...f, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    rehacer();
  });
  document.getElementById('oBorrar').addEventListener('click', async () => {
    if (!confirm('¿Borrar esta oportunidad? (Para negocios caídos usa la etapa «Perdido».)')) return;
    await deleteDoc(ref); location.hash = 'pipeline';
  });
  document.getElementById('oCliente')?.addEventListener('click', async () => {
    const nombre = o.empresa || o.contacto || o.titulo;
    let cid = slug(nombre) || 'cliente-' + Date.now();
    if ((await getDoc(doc(db, 'crm_clientes', cid))).exists()) cid += '-' + Date.now().toString(36).slice(-4);
    await setDoc(doc(db, 'crm_clientes', cid), {
      nombre, correo: o.email || (String(o.telefono || '').includes('@') ? o.telefono : ''), telefono: String(o.telefono || '').includes('@') ? '' : (o.telefono || ''),
      proyecto: o.titulo, valor_total: Number(o.valor_cop || 0), estado: 'activo', cuotas: [], afiliado: o.afiliado || '', oportunidad_id: id,
      creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email,
    });
    await updateDoc(ref, { cliente_id: cid, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    await registrar(usuario, 'oportunidad', id, 'Cliente creado en el CRM: ' + nombre, 'nota');
    rehacer();
  });
  document.getElementById('oProyecto')?.addEventListener('click', async () => {
    const d = await dialogo('Nuevo proyecto', `<label>Nombre</label><input name="nombre" required maxlength="160" value="${esc(o.titulo)}">
      <div class="grid"><div><label>Estado</label><select name="estado">${opciones(ESTADOS_PROYECTO, 'planeacion')}</select></div>
      <div><label>Inicio</label><input name="inicio" type="date"></div><div><label>Entrega estimada</label><input name="entrega_estimada" type="date"></div></div>`, { boton: 'Crear' });
    if (!d) return;
    const p = await addDoc(collection(db, 'crm_proyectos'), { ...d, cliente_id: o.cliente_id || null, oportunidad_id: id, servicio: o.servicio || '', valor_cop: Number(o.valor_cop || 0),
      url_produccion: '', repo: '', creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'proyecto/' + p.id;
  });
}
