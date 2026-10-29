// Leads: lo que capta el sitio (ref.js → crm_leads, sin datos personales), altas manuales,
// y los registros de cuenta de auth.js (colección clients, solo lectura).
import { db } from './fb.js';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, fecha, fmtFecha, aviso, dialogo, opciones, num, RE_CODIGO, ORIGENES, SERVICIOS, ETAPAS, etiqueta, formulario } from './util.js?v=1';
import { bitacora, registrar } from './actividades.js?v=1';

const ESTADOS = [['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['calificado', 'Calificado'], ['descartado', 'Descartado'], ['convertido', 'Convertido']];
const ORIGENES_MANUALES = ['manual', 'referido', 'redes', 'evento', 'yam', 'web_whatsapp', 'web_widget'].map((k) => [k, ORIGENES[k]]);
const origenTxt = (k) => ORIGENES[k] || k || '—';
let filtro = { estado: 'abiertos', origen: '', q: '', ref: '' };

const formLead = (l = {}) => `<div class="grid">
  <div><label>Nombre</label><input name="nombre" maxlength="120" value="${esc(l.nombre || '')}"></div>
  <div><label>Empresa</label><input name="empresa" maxlength="120" value="${esc(l.empresa || '')}"></div>
  <div><label>Correo</label><input name="email" type="email" value="${esc(l.email || '')}"></div>
  <div><label>Teléfono / WhatsApp</label><input name="telefono" value="${esc(l.telefono || '')}"></div>
  <div><label>Servicio</label><select name="servicio"><option value="">—</option>${opciones(l.servicio && !SERVICIOS.some((x) => x[0] === l.servicio) ? [[l.servicio, l.servicio], ...SERVICIOS] : SERVICIOS, l.servicio)}</select></div>
  <div><label>Origen</label><select name="origen">${opciones(l.origen && !ORIGENES_MANUALES.some((o) => o[0] === l.origen) ? [[l.origen, origenTxt(l.origen)], ...ORIGENES_MANUALES] : ORIGENES_MANUALES, l.origen || 'manual')}</select></div>
  <div><label>Código de afiliado (ref)</label><input name="ref" pattern="[a-z0-9\\-]{4,20}" value="${esc(l.ref || '')}"></div>
  <div><label>Estado</label><select name="estado">${opciones(ESTADOS, l.estado || 'nuevo')}</select></div></div>
  <label>Notas</label><textarea class="txt" name="notas" maxlength="5000">${esc(l.notas || '')}</textarea>`;
const limpiar = (f) => ({ ...f, ref: RE_CODIGO.test(f.ref || '') ? f.ref : null });

export async function vistaLeads({ nav, usuario }) {
  nav('leads');
  const $app = document.getElementById('app');
  const [snap, regs] = await Promise.all([getDocs(collection(db, 'crm_leads')), getDocs(collection(db, 'clients')).catch(() => null)]);
  const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0));
  const refs = [...new Set(leads.map((l) => l.ref).filter(Boolean))].sort();
  const origenes = [...new Set(leads.map((l) => l.origen).filter(Boolean))];
  const q = filtro.q.toLowerCase();
  const vis = leads.filter((l) => (filtro.estado === 'abiertos' ? !['descartado', 'convertido'].includes(l.estado) : !filtro.estado || l.estado === filtro.estado)
    && (!filtro.origen || l.origen === filtro.origen) && (!filtro.ref || l.ref === filtro.ref)
    && (!q || [l.nombre, l.email, l.telefono, l.empresa, l.notas, l.servicio, l.pagina].some((x) => String(x || '').toLowerCase().includes(q))));
  $app.innerHTML = `<div class="barra"><h1 style="margin:0">Leads (${vis.length}${vis.length !== leads.length ? ' de ' + leads.length : ''})</h1><button class="primario" id="lNuevo">Nuevo lead</button></div>
    <div class="card"><form class="barra" id="fFiltro" style="margin-bottom:8px"><div class="filtros">
      <select name="estado"><option value="abiertos">Abiertos</option><option value="">Todos</option>${opciones(ESTADOS, filtro.estado)}</select>
      <select name="origen"><option value="">Todo origen</option>${opciones(origenes.map((o) => [o, origenTxt(o)]), filtro.origen)}</select>
      <select name="ref"><option value="">Todo afiliado</option>${opciones(refs.map((r) => [r, r]), filtro.ref)}</select>
      <input name="q" value="${esc(filtro.q)}" placeholder="Buscar"></div></form>
    ${vis.length ? `<div class="tabla"><table><tr><th>Fecha</th><th>Lead</th><th>Origen</th><th>Servicio</th><th>Afiliado</th><th>Estado</th></tr>
      ${vis.map((l) => `<tr class="clic" data-id="${esc(l.id)}"><td style="white-space:nowrap">${fmtFecha(l.creado, true)}</td>
        <td>${l.nombre ? `<b>${esc(l.nombre)}</b>` : '<span class="suave">Anónimo (contacto por el sitio)</span>'}${l.empresa ? '<br><small class="suave">' + esc(l.empresa) + '</small>' : ''}</td>
        <td>${esc(origenTxt(l.origen))}${l.pagina ? `<br><small class="suave">${esc(l.pagina)}${l.idioma && l.idioma !== 'es' ? ' · ' + esc(l.idioma) : ''}</small>` : ''}</td>
        <td>${esc(l.servicio ? (SERVICIOS.find((s) => s[0] === l.servicio)?.[1] || l.servicio) : '—')}</td><td>${l.ref ? `<code>${esc(l.ref)}</code>` : '—'}</td>
        <td><span class="chip ${esc(l.estado)}">${esc(l.estado)}</span></td></tr>`).join('')}</table></div>`
    : '<div class="vacio">No hay leads con este filtro.</div>'}
    <p class="suave">Los contactos del sitio llegan sin nombre ni teléfono a propósito (el visitante escribe por WhatsApp). Al responderle, completa el lead con sus datos — el código de afiliado viene también al final del mensaje de WhatsApp («Ref: …»).</p></div>
    ${regs && regs.size ? `<div class="card"><h2>Registros de cuenta (auth.js) · ${regs.size}</h2><div class="tabla"><table><tr><th>Nombre</th><th>Correo</th><th>Interés</th><th>Afiliado</th><th></th></tr>
      ${regs.docs.map((d) => { const c = d.data(); return `<tr><td>${esc(c.name)}<br><small class="suave">${esc(c.company || '')}</small></td><td>${esc(c.email)}<br><small class="suave">${esc(c.phone || '')}</small></td>
        <td>${esc(c.interest || '—')}</td><td>${c.ref ? `<code>${esc(c.ref)}</code>` : '—'}</td><td><button class="mini" data-reg="${esc(d.id)}">Crear lead</button></td></tr>`; }).join('')}</table></div></div>` : ''}`;

  const f = document.getElementById('fFiltro');
  f.addEventListener('change', () => { filtro = { ...filtro, ...formulario(f) }; vistaLeads({ nav, usuario }); });
  f.addEventListener('submit', (e) => { e.preventDefault(); filtro = { ...filtro, ...formulario(f) }; vistaLeads({ nav, usuario }); });
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'lead/' + encodeURIComponent(tr.dataset.id))));
  document.getElementById('lNuevo').addEventListener('click', async () => {
    const d = await dialogo('Nuevo lead', formLead(), { boton: 'Crear', ancho: 640 });
    if (!d) return;
    const ref = await addDoc(collection(db, 'crm_leads'), { ...limpiar(d), creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'lead/' + ref.id;
  });
  $app.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', async () => {
    const c = regs.docs.find((d) => d.id === b.dataset.reg).data();
    const ref = await addDoc(collection(db, 'crm_leads'), { nombre: c.name || '', email: c.email || '', telefono: c.phone || '', empresa: c.company || '', notas: c.interest || '',
      origen: 'registro_cuenta', estado: 'nuevo', ref: RE_CODIGO.test(c.ref || '') ? c.ref : null, registro_id: b.dataset.reg, creado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'lead/' + ref.id;
  }));
}

export async function vistaLead(id, { nav, usuario }) {
  nav('leads');
  const $app = document.getElementById('app');
  const ref = doc(db, 'crm_leads', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { $app.innerHTML = '<p><a href="#leads">← Leads</a></p><div class="card"><div class="aviso err">Lead no encontrado.</div></div>'; return; }
  const l = snap.data();
  $app.innerHTML = `<p><a href="#leads">← Leads</a></p><div class="cols2"><div>
    <div class="card"><div class="barra"><h2 style="margin:0">${esc(l.nombre || 'Lead del sitio')}</h2><span class="chip ${esc(l.estado)}">${esc(l.estado)}</span></div>
      <p class="suave">Llegó ${fmtFecha(l.creado, true)} · ${esc(origenTxt(l.origen))}${l.pagina ? ' · página ' + esc(l.pagina) : ''}${l.idioma ? ' · idioma ' + esc(l.idioma) : ''}${l.ref_ts ? ' · clic de afiliado ' + fmtFecha(l.ref_ts) : ''}</p>
      <form id="fLead">${formLead(l)}<div class="acciones"><button class="primario">Guardar</button></div></form><div id="mLead"></div></div>
    <div class="card"><h2>Siguiente paso</h2>
      ${l.oportunidad_id ? `<p>Convertido en <a href="#op/${esc(l.oportunidad_id)}">oportunidad del pipeline</a>.</p>` : `<p class="suave">Pásalo al pipeline cuando haya una necesidad concreta.</p>
      <div class="acciones"><button class="primario" id="lConv">Convertir en oportunidad</button><button id="lDesc">Descartar</button><button class="peligro" id="lBorrar">Borrar (spam)</button></div>`}<div id="mSig"></div></div>
  </div><div class="card" id="bit"></div></div>`;
  bitacora(document.getElementById('bit'), usuario, 'lead', id);
  document.getElementById('fLead').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateDoc(ref, { ...limpiar(formulario(e.target)), actualizado: serverTimestamp(), actualizado_por: usuario.email });
    aviso(document.getElementById('mLead'), 'Guardado.', 'ok');
  });
  document.getElementById('lDesc')?.addEventListener('click', async () => {
    const motivo = prompt('Motivo (opcional):', '') ?? null;
    if (motivo === null) return;
    await updateDoc(ref, { estado: 'descartado', actualizado: serverTimestamp(), actualizado_por: usuario.email });
    if (motivo) await registrar(usuario, 'lead', id, 'Descartado: ' + motivo, 'nota');
    vistaLead(id, { nav, usuario });
  });
  document.getElementById('lBorrar')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar este lead definitivamente? Úsalo solo para spam.')) return;
    await deleteDoc(ref); location.hash = 'leads';
  });
  document.getElementById('lConv')?.addEventListener('click', async () => {
    const actual = { ...l, ...formulario(document.getElementById('fLead')) };
    const d = await dialogo('Nueva oportunidad', `<label>Título</label><input name="titulo" required maxlength="160" value="${esc([actual.nombre || actual.empresa, SERVICIOS.find((s) => s[0] === actual.servicio)?.[1]].filter(Boolean).join(' · '))}">
      <div class="grid"><div><label>Valor estimado (COP)</label><input name="valor_cop" type="number" min="0" step="10000" value="0"></div>
      <div><label>Etapa</label><select name="etapa">${opciones(ETAPAS.slice(0, 4), actual.estado === 'contactado' ? 'contactado' : 'nuevo')}</select></div>
      <div><label>Cierre estimado</label><input name="cierre_estimado" type="date"></div></div>`, { boton: 'Crear oportunidad' });
    if (!d) return;
    const op = await addDoc(collection(db, 'crm_oportunidades'), {
      titulo: d.titulo, etapa: d.etapa, valor_cop: num(d.valor_cop), cierre_estimado: d.cierre_estimado || '', servicio: actual.servicio || '',
      contacto: actual.nombre || '', email: actual.email || '', telefono: actual.telefono || '', empresa: actual.empresa || '',
      afiliado: RE_CODIGO.test(actual.ref || '') ? actual.ref : null, lead_id: id, cliente_id: null,
      creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email,
    });
    await updateDoc(ref, { ...limpiar(formulario(document.getElementById('fLead'))), estado: 'convertido', oportunidad_id: op.id, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    await registrar(usuario, 'oportunidad', op.id, 'Creada desde un lead (' + origenTxt(l.origen) + ').', 'cambio_etapa');
    location.hash = 'op/' + op.id;
  });
}
