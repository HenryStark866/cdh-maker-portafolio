// Utilidades compartidas por los módulos del panel (/crm). Sin dependencias.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cop = (n) => 'COP ' + Math.round(Number(n || 0)).toLocaleString('es-CO');
// Abreviado para tarjetas: 4,5 M · 850 mil
export const copCorto = (n) => { n = Number(n || 0); return n >= 1e6 ? (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(Math.round(n)); };
// AAAA-MM-DD se toma como fecha local (new Date('2026-10-01') sería medianoche UTC = 30 sep en Colombia)
export const fecha = (t) => (t?.toDate ? t.toDate() : typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(t + 'T00:00:00') : t ? new Date(t) : null);
export const fmtFecha = (t, hora = false) => { const d = fecha(t); return d && !isNaN(d) ? d.toLocaleString('es-CO', hora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) : '—'; };
export const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
export const aviso = (el, txt, cls = 'info') => { if (el) el.innerHTML = `<div class="aviso ${cls}">${txt}</div>`; };
export const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export const RE_CODIGO = /^[a-z0-9-]{4,20}$/;
export const formulario = (form) => Object.fromEntries(new FormData(form));
export const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export const ETAPAS = [
  ['nuevo', 'Nuevo'], ['contactado', 'Contactado'], ['propuesta', 'Propuesta'],
  ['negociacion', 'Negociación'], ['ganado', 'Ganado'], ['perdido', 'Perdido'],
];
export const SERVICIOS = [
  ['web', 'Desarrollo web y software'], ['saas', 'SaaS / plataforma'], ['fabricacion', 'Fabricación digital (3D, láser, CNC)'],
  ['iot', 'Electrónica e IoT'], ['consultoria', 'Diseño y consultoría técnica'], ['yam', 'YAM (comercio en YAM)'], ['otro', 'Otro'],
];
export const ESTADOS_PROYECTO = [
  ['planeacion', 'Planeación'], ['en_curso', 'En curso'], ['pausado', 'Pausado'], ['entregado', 'Entregado'], ['soporte', 'Soporte'], ['cancelado', 'Cancelado'],
];
export const ORIGENES = {
  web_widget: 'Sitio · caja de mensaje', web_whatsapp: 'Sitio · botón WhatsApp', web_correo: 'Sitio · correo', web_cotizador: 'Sitio · cotizador',
  web_visor3d: 'Sitio · visor 3D', registro_cuenta: 'Registro de cuenta (auth.js)', manual: 'Alta manual', referido: 'Referido', redes: 'Redes sociales',
  evento: 'Evento / feria', yam: 'Desde YAM',
};
export const etiqueta = (lista, k) => (lista.find((x) => x[0] === k) || [k, k || '—'])[1];
export const opciones = (lista, actual) => lista.map(([k, l]) => `<option value="${esc(k)}"${k === actual ? ' selected' : ''}>${esc(l)}</option>`).join('');

// Lista de cuotas de un cliente → cifras (lo usan Clientes, Inicio y Afiliados)
export const resumenPagos = (c) => {
  const cuotas = c.cuotas || [];
  const pagadas = cuotas.filter((q) => q.estado === 'pagada');
  const pagado = pagadas.reduce((s, q) => s + Number(q.valor || 0), 0);
  const total = Number(c.valor_total || cuotas.reduce((s, q) => s + Number(q.valor || 0), 0));
  const hoy = hoyISO();
  const vencidas = cuotas.filter((q) => q.estado !== 'pagada' && q.fecha && q.fecha < hoy);
  const primerPago = [...pagadas].sort((a, b) => String(a.fecha_pago || a.fecha).localeCompare(String(b.fecha_pago || b.fecha)))[0] || null;
  return { pagado, total, saldo: total - pagado, pagadas: pagadas.length, n: cuotas.length, vencidas, primerPago };
};

// Diálogo modal sencillo con <dialog>. Devuelve el formulario (o null si cancelan).
export function dialogo(titulo, cuerpoHTML, { boton = 'Guardar', ancho = 520 } = {}) {
  return new Promise((resolver) => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.style.maxWidth = ancho + 'px';
    d.innerHTML = `<form method="dialog"><h2>${esc(titulo)}</h2>${cuerpoHTML}
      <div class="acciones"><button value="ok" class="primario">${esc(boton)}</button><button value="no" formnovalidate>Cancelar</button></div></form>`;
    document.body.append(d);
    const f = d.querySelector('form');
    d.addEventListener('close', () => { const ok = d.returnValue === 'ok'; const datos = ok ? formulario(f) : null; d.remove(); resolver(datos); });
    d.showModal();
    d.querySelector('input,select,textarea')?.focus();
  });
}

export async function copiar(texto, boton) {
  try { await navigator.clipboard.writeText(texto); } catch { const t = document.createElement('textarea'); t.value = texto; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  if (boton) { const o = boton.textContent; boton.textContent = 'Copiado ✔'; setTimeout(() => (boton.textContent = o), 1600); }
}
