// Bitácora (notas, llamadas, reuniones, cambios de etapa) para cualquier entidad del panel.
// Colección crm_actividades: { entidad, entidad_id, tipo, texto, creado, creado_por }.
import { db } from './fb.js';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc, fmtFecha, fecha } from './util.js?v=1';

const TIPOS = [['nota', 'Nota'], ['llamada', 'Llamada'], ['whatsapp', 'WhatsApp'], ['correo', 'Correo'], ['reunion', 'Reunión']];

export async function registrar(usuario, entidad, entidad_id, texto, tipo = 'nota') {
  return addDoc(collection(db, 'crm_actividades'), { entidad, entidad_id, tipo, texto: String(texto).slice(0, 5000), creado: serverTimestamp(), creado_por: usuario.email });
}

// Pinta la bitácora dentro de `el` (una tarjeta) con formulario para agregar.
export async function bitacora(el, usuario, entidad, entidad_id) {
  el.innerHTML = `<h2>Bitácora</h2>
    <form class="fAct"><div class="grid" style="grid-template-columns:140px 1fr"><select name="tipo">${TIPOS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <input name="texto" required maxlength="5000" placeholder="Qué pasó, qué sigue…"></div>
    <div class="acciones"><button class="mini primario">Agregar</button></div></form><ul class="bitacora"><li class="suave">Cargando…</li></ul>`;
  const ul = el.querySelector('.bitacora');
  const pintar = async () => {
    // Sin orderBy en la consulta: evita exigir un índice compuesto; se ordena aquí.
    const snap = await getDocs(query(collection(db, 'crm_actividades'), where('entidad', '==', entidad), where('entidad_id', '==', entidad_id)));
    const docs = snap.docs.sort((a, b) => (fecha(b.data().creado) || 0) - (fecha(a.data().creado) || 0));
    ul.innerHTML = docs.length ? docs.map((d) => { const a = d.data(); return `<li>${esc(a.texto)}
      <small>${esc(a.tipo)} · ${fmtFecha(a.creado, true)} · ${esc(a.creado_por)}${a.creado_por === usuario.email && a.tipo !== 'cambio_etapa' ? ` · <a href="#" data-borrar="${d.id}">borrar</a>` : ''}</small></li>`; }).join('')
      : '<li class="suave" style="border:0">Sin registros todavía.</li>';
    ul.querySelectorAll('[data-borrar]').forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm('¿Borrar esta nota?')) return;
      await deleteDoc(doc(db, 'crm_actividades', a.dataset.borrar)); pintar();
    }));
  };
  el.querySelector('.fAct').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await registrar(usuario, entidad, entidad_id, f.get('texto'), f.get('tipo'));
    e.target.reset(); pintar();
  });
  try { await pintar(); } catch (e) { ul.innerHTML = `<li class="suave">No se pudo leer la bitácora: ${esc(e.code || e.message)}</li>`; }
}
