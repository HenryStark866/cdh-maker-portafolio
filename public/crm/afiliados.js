// Afiliados de CDH Maker: código + enlace https://cdhmaker.com/?ref=<codigo> (lo captura public/ref.js),
// leads/oportunidades/clientes atribuidos y comisiones (base: 10 % del primer pago cobrado, configurable).
// Una comisión solo nace cuando hay plata cobrada: se calcula desde las cuotas pagadas del cliente.
import { db } from './fb.js';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, cop, fecha, fmtFecha, aviso, dialogo, opciones, num, slug, hoyISO, RE_CODIGO, copiar, formulario, resumenPagos, ETAPAS, etiqueta } from './util.js?v=1';
import { bitacora, registrar } from './actividades.js?v=1';

export const SITIO = 'https://cdhmaker.com';
export const PCT_DEFECTO = 10;
const enlaceRef = (c) => `${SITIO}/?ref=${c}`;
const ESTADOS = [['activo', 'Activo'], ['pausado', 'Pausado'], ['retirado', 'Retirado']];
const CANALES = [['red_personal', 'Red personal'], ['agencia', 'Agencia / freelancer'], ['contador', 'Contador / asesor'], ['creador', 'Creador de contenido'], ['cliente', 'Cliente actual'], ['otro', 'Otro']];
const listar = async (col) => (await getDocs(collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() }));

const formAf = (a = {}, nuevo = false) => `<label>Nombre</label><input name="nombre" required maxlength="120" value="${esc(a.nombre || '')}">
  <div class="grid">
  ${nuevo ? '<div><label>Código del enlace (4–20: a-z, 0-9, -)</label><input name="codigo" required pattern="[a-z0-9\\-]{4,20}" maxlength="20" id="afCodigo"></div>' : ''}
  <div><label>Comisión % (primer pago cobrado)</label><input name="comision_pct" type="number" min="0" max="50" step="0.5" value="${esc(a.comision_pct ?? PCT_DEFECTO)}"></div>
  <div><label>Estado</label><select name="estado">${opciones(ESTADOS, a.estado || 'activo')}</select></div>
  <div><label>Canal</label><select name="canal">${opciones(CANALES, a.canal || 'red_personal')}</select></div>
  <div><label>Correo</label><input name="email" type="email" value="${esc(a.email || '')}"></div>
  <div><label>Teléfono / WhatsApp</label><input name="telefono" value="${esc(a.telefono || '')}"></div>
  <div><label>Cuenta para pagos (banco, Nequi…)</label><input name="cuenta_pago" maxlength="160" value="${esc(a.cuenta_pago || '')}" placeholder="Solo referencia; nada de claves"></div></div>
  <label>Notas</label><textarea class="txt" name="notas" maxlength="3000">${esc(a.notas || '')}</textarea>`;
const limpiarAf = (f) => ({ ...f, comision_pct: Math.min(50, Math.max(0, num(f.comision_pct))) });

// Comisiones propuestas: clientes atribuidos con al menos un pago y sin comisión registrada.
function propuestas(afiliado, clientes, comisiones) {
  const conCom = new Set(comisiones.filter((c) => c.afiliado === afiliado.id && c.estado !== 'anulada').map((c) => c.cliente_id));
  return clientes.filter((c) => c.afiliado === afiliado.id && !conCom.has(c.id)).map((c) => ({ c, r: resumenPagos(c) })).filter((x) => x.r.primerPago);
}

export async function vistaAfiliados({ nav, usuario }) {
  nav('afiliados');
  const $app = document.getElementById('app');
  const [afs, leads, ops, clientes, comisiones] = await Promise.all(['crm_afiliados', 'crm_leads', 'crm_oportunidades', 'crm_clientes', 'crm_comisiones'].map(listar));
  const n = (xs, campo, cod) => xs.filter((x) => x[campo] === cod).length;
  const suma = (cod, ests) => comisiones.filter((c) => c.afiliado === cod && ests.includes(c.estado)).reduce((s, c) => s + Number(c.valor_cop || 0), 0);
  const pendGlobal = comisiones.filter((c) => ['pendiente', 'aprobada'].includes(c.estado));
  const porGenerar = afs.flatMap((a) => propuestas(a, clientes, comisiones));
  $app.innerHTML = `<div class="barra"><h1 style="margin:0">Afiliados CDH (${afs.length})</h1><button class="primario" id="aNuevo">Nuevo afiliado</button></div>
    <div class="kpis">
      <div class="kpi"><div class="t">Leads atribuidos</div><div class="v">${leads.filter((l) => l.ref).length}</div><div class="d">de ${leads.length} leads</div></div>
      <div class="kpi"><div class="t">Clientes referidos</div><div class="v">${clientes.filter((c) => c.afiliado).length}</div></div>
      <div class="kpi"><div class="t">Comisiones por pagar</div><div class="v">${cop(pendGlobal.reduce((s, c) => s + Number(c.valor_cop || 0), 0))}</div><div class="d">${pendGlobal.length} pendientes o aprobadas</div></div>
      <div class="kpi"><div class="t">Pagado a afiliados</div><div class="v">${cop(comisiones.filter((c) => c.estado === 'pagada').reduce((s, c) => s + Number(c.valor_cop || 0), 0))}</div></div></div>
    ${porGenerar.length ? `<div class="aviso warn">${porGenerar.length} cliente(s) referido(s) ya pagaron y no tienen comisión registrada. Ábrelos en cada afiliado → «Generar comisiones».</div>` : ''}
    <div class="card">${afs.length ? `<div class="tabla"><table><tr><th>Afiliado</th><th>Enlace</th><th class="num">%</th><th class="num">Leads</th><th class="num">Oport.</th><th class="num">Clientes</th><th class="num">Por pagar</th><th class="num">Pagado</th><th>Estado</th></tr>
    ${afs.sort((a, b) => String(a.nombre).localeCompare(b.nombre)).map((a) => `<tr class="clic" data-id="${esc(a.id)}"><td><b>${esc(a.nombre)}</b><br><small class="suave">${esc(etiqueta(CANALES, a.canal))}</small></td>
      <td><div class="enlace-ref"><code>?ref=${esc(a.id)}</code><button class="mini" data-copiar="${esc(a.id)}">Copiar</button></div></td><td class="num">${num(a.comision_pct)}</td>
      <td class="num">${n(leads, 'ref', a.id)}</td><td class="num">${n(ops, 'afiliado', a.id)}</td><td class="num">${n(clientes, 'afiliado', a.id)}</td>
      <td class="num">${cop(suma(a.id, ['pendiente', 'aprobada']))}</td><td class="num">${cop(suma(a.id, ['pagada']))}</td><td><span class="chip ${esc(a.estado)}">${esc(a.estado)}</span></td></tr>`).join('')}</table></div>`
    : '<div class="vacio">Aún no hay afiliados. Crea el primero y compártele su enlace.</div>'}
    <p class="suave">Enlace: <code>${SITIO}/?ref=&lt;código&gt;</code> — el primer clic gana y dura 60 días en el navegador del visitante. El código llega en el lead y al final del WhatsApp («Ref: …»). Los afiliados de YAM se manejan en la pestaña YAM.</p></div>`;
  $app.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); copiar(enlaceRef(b.dataset.copiar), b); }));
  $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'afiliado/' + encodeURIComponent(tr.dataset.id))));
  document.getElementById('aNuevo').addEventListener('click', async () => {
    const espera = dialogo('Nuevo afiliado', formAf({}, true), { boton: 'Crear', ancho: 640 });
    const dlg = document.querySelector('dialog.dlg:last-of-type');
    const nom = dlg.querySelector('[name=nombre]'), cod = dlg.querySelector('#afCodigo');
    nom.addEventListener('input', () => { if (!cod.dataset.tocado) cod.value = slug(nom.value).slice(0, 20).replace(/-$/, ''); });
    cod.addEventListener('input', () => { cod.dataset.tocado = '1'; cod.value = cod.value.toLowerCase(); });
    const d = await espera;
    if (!d) return;
    const codigo = String(d.codigo).toLowerCase();
    if (!RE_CODIGO.test(codigo)) return alert('El código debe tener 4–20 caracteres: letras minúsculas, números o guiones.');
    if ((await getDoc(doc(db, 'crm_afiliados', codigo))).exists()) return alert('Ese código ya existe. Elige otro.');
    const { codigo: _, ...resto } = d;
    await setDoc(doc(db, 'crm_afiliados', codigo), { ...limpiarAf(resto), codigo, creado: serverTimestamp(), actualizado: serverTimestamp(), creado_por: usuario.email });
    location.hash = 'afiliado/' + codigo;
  });
}

export async function vistaAfiliado(codigo, { nav, usuario }) {
  nav('afiliados');
  const $app = document.getElementById('app');
  const ref = doc(db, 'crm_afiliados', codigo);
  const [snap, leads, ops, clientes, comisiones] = await Promise.all([getDoc(ref), ...['crm_leads', 'crm_oportunidades', 'crm_clientes', 'crm_comisiones'].map(listar)]);
  if (!snap.exists()) { $app.innerHTML = '<p><a href="#afiliados">← Afiliados</a></p><div class="card"><div class="aviso err">Afiliado no encontrado.</div></div>'; return; }
  const a = { id: codigo, ...snap.data() };
  const misLeads = leads.filter((l) => l.ref === codigo).sort((x, y) => (fecha(y.creado) || 0) - (fecha(x.creado) || 0));
  const misOps = ops.filter((o) => o.afiliado === codigo);
  const misCli = clientes.filter((c) => c.afiliado === codigo);
  const misCom = comisiones.filter((c) => c.afiliado === codigo).sort((x, y) => (fecha(y.creado) || 0) - (fecha(x.creado) || 0));
  const props = propuestas(a, clientes, comisiones);
  const nomCli = Object.fromEntries(clientes.map((c) => [c.id, c.nombre]));
  $app.innerHTML = `<p><a href="#afiliados">← Afiliados</a></p><div class="cols2"><div>
    <div class="card"><div class="barra"><h2 style="margin:0">${esc(a.nombre)}</h2><span class="chip ${esc(a.estado)}">${esc(a.estado)}</span></div>
      <label>Enlace de referido</label><div class="enlace-ref"><code>${esc(enlaceRef(codigo))}</code><button class="mini primario" id="cp">Copiar</button></div>
      <p class="suave">También sirve en cualquier página del sitio: <code>${SITIO}/servicios/…?ref=${esc(codigo)}</code></p>
      <form id="fAf">${formAf(a)}<div class="acciones"><button class="primario">Guardar</button></div></form><div id="mAf"></div></div>
    <div class="card"><div class="barra"><h2 style="margin:0">Comisiones</h2><div class="filtros">${props.length ? `<button class="primario mini" id="gen">Generar comisiones (${props.length})</button>` : ''}<button class="mini" id="manual">Comisión manual</button></div></div>
      ${props.length ? `<div class="aviso warn">Por generar: ${props.map((x) => `${esc(x.c.nombre)} — primer pago ${cop(x.r.primerPago.valor)} → ${cop(Math.round(x.r.primerPago.valor * num(a.comision_pct) / 100))}`).join('; ')}</div>` : ''}
      ${misCom.length ? `<div class="tabla"><table><tr><th>Concepto</th><th class="num">Base</th><th class="num">%</th><th class="num">Comisión</th><th>Estado</th><th></th></tr>
      ${misCom.map((c) => `<tr><td>${esc(c.concepto || '')}${c.cliente_id ? `<br><small class="suave"><a href="#cliente/${esc(c.cliente_id)}">${esc(nomCli[c.cliente_id] || c.cliente_id)}</a></small>` : ''}<br><small class="suave">${fmtFecha(c.creado)}${c.pagada_fecha ? ' · pagada ' + esc(c.pagada_fecha) : ''}${c.referencia_pago ? ' · ' + esc(c.referencia_pago) : ''}</small></td>
        <td class="num">${cop(c.base_cop)}</td><td class="num">${num(c.pct)}</td><td class="num"><b>${cop(c.valor_cop)}</b></td><td><span class="chip ${esc(c.estado)}">${esc(c.estado)}</span></td>
        <td style="white-space:nowrap">${c.estado === 'pendiente' ? `<button class="mini primario" data-com="${esc(c.id)}:aprobada">Aprobar</button> ` : ''}${c.estado === 'aprobada' ? `<button class="mini primario" data-com="${esc(c.id)}:pagada">Marcar pagada</button> ` : ''}
          ${['pendiente', 'aprobada'].includes(c.estado) ? `<button class="mini peligro" data-com="${esc(c.id)}:anulada">Anular</button>` : ''}</td></tr>`).join('')}</table></div>`
      : '<div class="vacio">Sin comisiones todavía.</div>'}<div id="mCom"></div></div>
  </div><div>
    <div class="card"><h2>Atribución</h2>
      <h3>Clientes (${misCli.length})</h3>${misCli.length ? `<ul class="lista">${misCli.map((c) => { const r = resumenPagos(c); return `<li data-ir="cliente/${esc(c.id)}"><b>${esc(c.nombre)}</b><small>pagado ${cop(r.pagado)} de ${cop(r.total)}${r.primerPago ? ' · primer pago ' + esc(r.primerPago.fecha_pago || r.primerPago.fecha) : ' · sin pagos aún'}</small></li>`; }).join('')}</ul>` : '<p class="suave">Ninguno. Asigna el código en la ficha del cliente («Código de afiliado»).</p>'}
      <h3>Oportunidades (${misOps.length})</h3>${misOps.length ? `<ul class="lista">${misOps.map((o) => `<li data-ir="op/${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc(etiqueta(ETAPAS, o.etapa))} · ${cop(o.valor_cop)}</small></li>`).join('')}</ul>` : '<p class="suave">Ninguna.</p>'}
      <h3>Leads (${misLeads.length})</h3>${misLeads.length ? `<ul class="lista">${misLeads.slice(0, 30).map((l) => `<li data-ir="lead/${esc(l.id)}"><b>${esc(l.nombre || 'Contacto del sitio')}</b><small>${fmtFecha(l.creado, true)} · ${esc(l.estado)}</small></li>`).join('')}</ul>` : '<p class="suave">Ninguno todavía.</p>'}
    </div><div class="card" id="bit"></div></div></div>`;
  bitacora(document.getElementById('bit'), usuario, 'afiliado', codigo);
  const rehacer = () => vistaAfiliado(codigo, { nav, usuario });
  $app.querySelectorAll('[data-ir]').forEach((li) => li.addEventListener('click', () => (location.hash = li.dataset.ir)));
  document.getElementById('cp').addEventListener('click', (e) => copiar(enlaceRef(codigo), e.target));
  document.getElementById('fAf').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateDoc(ref, { ...limpiarAf(formulario(e.target)), codigo, actualizado: serverTimestamp(), actualizado_por: usuario.email });
    rehacer();
  });
  document.getElementById('gen')?.addEventListener('click', async () => {
    for (const { c, r } of props) {
      const base = Number(r.primerPago.valor || 0), pct = num(a.comision_pct);
      await addDoc(collection(db, 'crm_comisiones'), { afiliado: codigo, cliente_id: c.id, oportunidad_id: c.oportunidad_id || null,
        concepto: `Primer pago de ${c.nombre} (${r.primerPago.fecha_pago || r.primerPago.fecha})`, base_cop: base, pct, valor_cop: Math.round(base * pct / 100),
        estado: 'pendiente', creado: serverTimestamp(), creado_por: usuario.email });
      await registrar(usuario, 'afiliado', codigo, `Comisión generada: ${cop(Math.round(base * pct / 100))} por ${c.nombre}`, 'nota');
    }
    rehacer();
  });
  document.getElementById('manual').addEventListener('click', async () => {
    const d = await dialogo('Comisión manual', `<label>Concepto</label><input name="concepto" required maxlength="200" placeholder="Bono por 3 clientes en el trimestre">
      <div class="grid"><div><label>Cliente (opcional)</label><select name="cliente_id"><option value="">—</option>${opciones(clientes.map((c) => [c.id, c.nombre]))}</select></div>
      <div><label>Base (COP)</label><input name="base_cop" type="number" min="0" required></div><div><label>%</label><input name="pct" type="number" min="0" max="100" step="0.5" value="${esc(a.comision_pct ?? PCT_DEFECTO)}"></div></div>
      <p class="suave">Para un bono fijo usa base = valor del bono y % = 100.</p>`, { boton: 'Registrar' });
    if (!d) return;
    const base = num(d.base_cop), pct = Math.min(100, num(d.pct));
    await addDoc(collection(db, 'crm_comisiones'), { afiliado: codigo, cliente_id: d.cliente_id || null, oportunidad_id: null, concepto: d.concepto, base_cop: base, pct,
      valor_cop: Math.round(base * pct / 100), estado: 'pendiente', creado: serverTimestamp(), creado_por: usuario.email });
    rehacer();
  });
  $app.querySelectorAll('[data-com]').forEach((b) => b.addEventListener('click', async () => {
    const [cid, estado] = b.dataset.com.split(':');
    const c = misCom.find((x) => x.id === cid);
    const extra = {};
    if (estado === 'pagada') {
      const f = prompt('Fecha del pago (AAAA-MM-DD):', hoyISO()); if (!f) return;
      const r = prompt('Referencia del pago (transferencia, Nequi…):', '') ?? '';
      Object.assign(extra, { pagada_fecha: f, referencia_pago: r, pagada: serverTimestamp() });
    } else if (estado === 'anulada') {
      const m = prompt('Motivo de la anulación:', ''); if (m === null) return; extra.motivo_anulacion = m;
    } else extra.aprobada = serverTimestamp();
    try {
      await updateDoc(doc(db, 'crm_comisiones', cid), { estado, ...extra, actualizado: serverTimestamp(), actualizado_por: usuario.email });
      await registrar(usuario, 'afiliado', codigo, `Comisión ${cop(c.valor_cop)} → ${estado}`, 'nota');
      rehacer();
    } catch (e) { aviso(document.getElementById('mCom'), 'No se pudo: ' + esc(e.code || e.message), 'err'); }
  }));
}
