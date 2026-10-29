// Documentos comerciales del CRM (cotizaciones, cuentas de cobro y facturas): totales, valor en letras
// y el HTML del documento. El mismo HTML sirve para la vista previa y para el PDF (htmlAPdf en
// ensamblar.js), con la identidad de legal/_base/documento.css.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const fechaLarga = (f) => (f ? new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { dateStyle: 'long' }) : '');
export const sumarDias = (f, dias) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + Number(dias || 0)); return d.toLocaleDateString('en-CA'); };

export const TIPOS = {
  cotizacion: { titulo: 'COTIZACIÓN', corto: 'Cotización', prefijo: 'COT' },
  cuenta_cobro: { titulo: 'CUENTA DE COBRO', corto: 'Cuenta de cobro', prefijo: 'CC' },
  factura_venta: { titulo: 'FACTURA DE VENTA', corto: 'Factura de venta', prefijo: 'FV' },
};
// Clase del documento: la cotización es una sola; la factura se emite como cuenta de cobro
// (persona natural no responsable de IVA) o como factura de venta.
export const claseDe = (d) => (d.tipo === 'cotizacion' ? 'cotizacion' : d.modalidad || 'cuenta_cobro');

export const EMISOR_BASE = {
  nombre: 'Henry Taborda', marca: 'CDH Maker', cedula: '', rut: '', direccion: '', ciudad: 'Medellín',
  correo: 'cdhmaker@gmail.com', telefono: '', web: 'cdhmaker.com',
  banco: '', tipo_cuenta: 'Ahorros', cuenta: '', titular: 'Henry Taborda',
  plazo_pago: 5,
  condiciones: 'Forma de pago: 50 % para iniciar y 50 % contra entrega.\nTiempo de entrega: se acuerda al aprobar la cotización.\nLos precios están en pesos colombianos. CDH Maker es persona natural no responsable de IVA.',
};

export function totales(d) {
  const filas = (d.items || []).map((it) => {
    const bruto = Number(it.cantidad || 0) * Number(it.precio || 0);
    const descuento = Math.round(bruto * Number(it.descuento || 0) / 100);
    return { ...it, bruto, valor_descuento: descuento, neto: bruto - descuento };
  });
  const subtotal = filas.reduce((s, f) => s + f.bruto, 0);
  const descuentos = filas.reduce((s, f) => s + f.valor_descuento, 0);
  const base = subtotal - descuentos;
  const iva = Math.round(base * Number(d.iva || 0) / 100);
  return { filas, subtotal, descuentos, base, iva, total: base + iva };
}

// ───────── valor en letras (pesos colombianos) ─────────
const U = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const hasta999 = (n) => {
  if (n === 100) return 'cien';
  const r = n % 100;
  const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '');
  return [C[Math.floor(n / 100)], dec].filter(Boolean).join(' ');
};
const hastaMillon = (n) => {
  const m = Math.floor(n / 1000), r = n % 1000;
  return [m === 0 ? '' : m === 1 ? 'mil' : hasta999(m) + ' mil', hasta999(r)].filter(Boolean).join(' ');
};
export function enLetras(valor) {
  const n = Math.round(Math.abs(Number(valor || 0)));
  if (n === 0) return 'CERO PESOS M/CTE';
  const mill = Math.floor(n / 1e6), r = n % 1e6;
  const txt = [mill === 0 ? '' : mill === 1 ? 'un millón' : hastaMillon(mill) + ' millones', hastaMillon(r)].filter(Boolean).join(' ');
  return (txt + (mill > 0 && r === 0 ? ' de' : '') + (n === 1 ? ' peso' : ' pesos') + ' M/CTE').toUpperCase();
}

// ───────── HTML del documento ─────────
const LOGO_BASE = '<svg viewBox="0 0 512 512" width="46" height="46" aria-hidden="true"><rect width="512" height="512" rx="104" fill="#06232e"/><g transform="translate(56.5,56.5) scale(5.7)"><path d="M55 15H25A15 15 0 0 0 10 30v10a15 15 0 0 0 15 15h30" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="square"/><path d="M55 15H25A15 15 0 0 0 10 30v2h15V22" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/><circle cx="25" cy="22" r="3" fill="#22d3ee"/><path d="M10 45v-5a15 15 0 0 1 15 15h20V42" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/><circle cx="45" cy="42" r="3" fill="#22d3ee"/><circle cx="10" cy="45" r="3" fill="#22d3ee"/></g></svg>';

const CSS = `@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap");
:root{--tinta:#0b1f27;--suave:#4a6470;--navy:#06232e;--cian:#0891b2;--cian-claro:#e0f7fb;--linea:#c9dbe0}
*{box-sizing:border-box}html{background:#eef3f5}
body{margin:0;padding:24px 12px;font:400 10pt/1.5 "Inter",system-ui,sans-serif;color:var(--tinta);background:#eef3f5}
.hoja{max-width:210mm;margin:0 auto;padding:16mm 16mm 14mm;background:#fff;box-shadow:0 2px 16px rgba(6,35,46,.12)}
html.pdf,.pdf body{background:#fff;padding:0}.pdf .hoja{padding:0;box-shadow:none;max-width:none}
.membrete{display:flex;align-items:center;gap:14px;padding-bottom:12px;border-bottom:3px solid var(--navy)}
.membrete svg{flex:none}.marca{font:700 15pt/1.1 "Space Grotesk",sans-serif;color:var(--navy)}
.marca small{display:block;font:500 8pt/1.4 "Inter",sans-serif;color:var(--suave)}
.ref{margin-left:auto;text-align:right;font-size:8.5pt;color:var(--suave);line-height:1.7}.ref b{color:var(--tinta);font-size:10pt}
h1{margin:18px 0 2px;font:700 16pt/1.2 "Space Grotesk",sans-serif;color:var(--navy);text-align:center;letter-spacing:.3px}
.subtitulo{margin:0 0 14px;text-align:center;color:var(--suave);font-size:9pt}
h2{margin:16px 0 6px;padding-bottom:3px;font:700 10.5pt/1.3 "Space Grotesk",sans-serif;color:var(--navy);border-bottom:1px solid var(--linea)}
p{margin:6px 0}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:9pt}
th,td{border:1px solid var(--linea);padding:5px 7px;text-align:left;vertical-align:top}
th{background:var(--navy);color:#fff;font-weight:600}
.num{text-align:right;white-space:nowrap}
table.datos th{width:30%;background:var(--cian-claro);color:var(--tinta)}
tr.total td{font-weight:700;background:var(--cian-claro);font-size:10pt}
tr.sub td{border-left:0;border-right:0}
.tipo{display:block;font-size:7.5pt;color:var(--suave);text-transform:uppercase;letter-spacing:.4px}
.letras{margin:8px 0 12px;padding:7px 10px;border:1px dashed var(--linea);font-size:9pt}
.nota{margin:10px 0;padding:7px 11px;background:var(--cian-claro);border-left:3px solid var(--cian);font-size:8.5pt}
ol{padding-left:18px;margin:4px 0}li{margin-bottom:3px;font-size:8.5pt;text-align:justify}
.pre{white-space:pre-line}
.firmas{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px}
.firma{padding-top:42px}.raya{border-top:1px solid var(--tinta);padding-top:5px;font-size:8.5pt}
.raya b{display:block;font-size:9pt}.raya span{display:block;color:var(--suave)}
.firma-img{display:block;max-height:64px;max-width:230px;margin:0 0 -6px}.firma{position:relative}.firma.con-img{padding-top:0}
.firma-vacia{display:block;height:58px}.campo.vacio{color:#8aa1aa}.campo.ok{font-weight:600}
.pagos{margin:14px 0 6px;padding:12px 14px;border:1px solid var(--linea);border-radius:10px;background:linear-gradient(180deg,#fff,#f6fbfc)}
.pagos h2{margin:0 0 10px;border:0;padding:0;display:flex;justify-content:space-between;align-items:baseline}.pagos h2 small{font:500 8pt/1 "Inter",sans-serif;color:var(--suave)}
.qrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(70mm,1fr));gap:10px}
.qr-t{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid var(--linea);border-radius:10px;background:#fff;break-inside:avoid}
.qr-t .qr{flex:none;width:34mm;height:34mm;padding:2px;border-radius:8px;border:1.5px solid var(--cian)}.qr-t .qr svg{width:100%;height:100%;display:block}
.qr-t .ent{display:block;font-size:7.5pt;color:var(--suave);text-transform:uppercase;letter-spacing:.5px}
.qr-t .llave{display:block;font:700 12pt/1.25 "Space Grotesk",sans-serif;color:var(--navy);word-break:break-all;margin:2px 0}
.qr-t small{display:block;font-size:7.5pt;color:var(--suave)}
.pie{margin-top:22px;padding-top:7px;border-top:1px solid var(--linea);font-size:7.5pt;color:var(--suave);text-align:center}
.sello{display:inline-block;margin-top:4px;padding:1px 8px;border:1.5px solid;border-radius:4px;font:700 8pt/1.5 "Space Grotesk",sans-serif;letter-spacing:.6px}
.sello.anulada{color:#b91c1c}.sello.pagada{color:#15803d}.sello.borrador{color:#a16207}
@media (max-width:640px){body{padding:0}.hoja{padding:18px 14px;box-shadow:none}.membrete{flex-wrap:wrap}.ref{margin-left:0;text-align:left}.firmas{grid-template-columns:1fr}}`;

// Opciones: pdf (sin márgenes de pantalla) y paraFirma (deja <campo-k>/<firma-k> para /firmar).
// emisor.logo (SVG de marca.js) y emisor.pagos (medios con su QR ya dibujado) los pone app.js.
export function htmlDocumento(d, emisor = {}, { pdf = false, paraFirma = false } = {}) {
  const e = { ...EMISOR_BASE, ...emisor };
  const LOGO = e.logo || LOGO_BASE;
  const clase = claseDe(d), T = TIPOS[clase];
  const t = totales(d);
  const r = d.receptor || {};
  const cotiz = clase === 'cotizacion', cobro = clase === 'cuenta_cobro';
  const conDesc = t.filas.some((f) => Number(f.descuento) > 0);
  const numero = d.numero || 'BORRADOR';
  const sello = d.estado === 'anulada' ? 'ANULADA' : d.estado === 'pagada' ? 'PAGADA' : !d.numero ? 'BORRADOR' : '';
  const ccEmisor = [e.cedula && 'C.C. ' + esc(e.cedula), e.rut && 'RUT ' + esc(e.rut)].filter(Boolean).join(' · ');
  const contacto = [e.direccion && esc(e.direccion) + ', ' + esc(e.ciudad), esc(e.correo), e.telefono && 'Tel. ' + esc(e.telefono)].filter(Boolean).join(' · ');

  const ref = cotiz
    ? `Cotización N.º <b>${esc(numero)}</b><br>Fecha: ${esc(fechaLarga(d.fecha))}<br>Válida hasta: ${esc(fechaLarga(sumarDias(d.fecha, d.validez_dias || 15)))}`
    : `${T.corto} N.º <b>${esc(numero)}</b><br>Fecha: ${esc(fechaLarga(d.fecha))}${d.vence ? '<br>Vence: ' + esc(fechaLarga(d.vence)) : ''}`;

  const receptor = `<table class="datos"><tr><th>${cotiz ? 'Cliente' : 'Cliente (pagador)'}</th><td><b>${esc(r.nombre || '—')}</b>${r.documento ? '<br>NIT/C.C.: ' + esc(r.documento) : ''}
    ${[r.direccion, r.correo, r.telefono].filter(Boolean).length ? '<br>' + [r.direccion, r.correo, r.telefono].filter(Boolean).map(esc).join(' · ') : ''}</td></tr>
    ${d.titulo ? `<tr><th>${cotiz ? 'Proyecto / asunto' : 'Concepto'}</th><td>${esc(d.titulo)}</td></tr>` : ''}</table>`;

  const prestador = `<p style="text-align:center;margin:12px 0"><b>DEBE A:</b></p>
    <table class="datos"><tr><th>Prestador del servicio</th><td><b>${esc(e.nombre.toUpperCase())}</b> — marca comercial ${esc(e.marca)}${ccEmisor ? '<br>' + ccEmisor : ''}<br>${contacto}</td></tr></table>`;

  const items = `<table><tr><th style="width:5%">N.º</th><th>Descripción</th><th class="num" style="width:8%">Cant.</th><th class="num" style="width:15%">Valor unitario</th>${conDesc ? '<th class="num" style="width:8%">Dto.</th>' : ''}<th class="num" style="width:16%">Valor total</th></tr>
    ${t.filas.map((f, i) => `<tr><td>${i + 1}</td><td><span class="tipo">${f.tipo === 'producto' ? 'Producto' : 'Servicio'}</span>${esc(f.descripcion).replace(/\n/g, '<br>')}</td>
      <td class="num">${esc(f.cantidad)}${f.unidad ? ' ' + esc(f.unidad) : ''}</td><td class="num">${pesos(f.precio)}</td>${conDesc ? `<td class="num">${Number(f.descuento) ? esc(f.descuento) + ' %' : ''}</td>` : ''}<td class="num">${pesos(f.neto)}</td></tr>`).join('')
      || `<tr><td colspan="${conDesc ? 6 : 5}" style="color:#8aa1aa;text-align:center">Sin ítems</td></tr>`}
    ${t.descuentos ? `<tr class="sub"><td colspan="${conDesc ? 5 : 4}">Subtotal</td><td class="num">${pesos(t.subtotal)}</td></tr><tr class="sub"><td colspan="${conDesc ? 5 : 4}">Descuentos</td><td class="num">− ${pesos(t.descuentos)}</td></tr>` : ''}
    <tr class="sub"><td colspan="${conDesc ? 5 : 4}">${t.descuentos ? 'Base' : 'Subtotal'}</td><td class="num">${pesos(t.base)}</td></tr>
    <tr class="sub"><td colspan="${conDesc ? 5 : 4}">IVA${Number(d.iva) ? ' ' + esc(d.iva) + ' %' : ''}</td><td class="num">${Number(d.iva) ? pesos(t.iva) : 'No causa'}</td></tr>
    <tr class="total"><td colspan="${conDesc ? 5 : 4}">${cotiz ? 'Total cotizado' : 'Total a pagar' + (cobro ? ' (antes de retenciones que practique el pagador)' : '')}</td><td class="num">${pesos(t.total)}</td></tr></table>
    <div class="letras"><b>Son:</b> ${enLetras(t.total)}</div>`;

  const qrs = cobro && (e.pagos || []).length ? `<section class="pagos"><h2>Paga fácil <small>Escanea el QR o copia la llave</small></h2><div class="qrs">${e.pagos.map((m) => `<div class="qr-t">${m.svg ? `<div class="qr">${m.svg}</div>` : ''}
      <div><span class="ent">${esc(m.titulo || m.entidad)}</span><b class="llave" data-copiable>${esc(m.llave)}</b><small>${esc(m.nota || '')}${m.titular ? '<br>Titular: ' + esc(m.titular) : ''}</small></div></div>`).join('')}</div></section>` : '';
  const pago = !cotiz && (e.banco || e.cuenta) ? `<h2>Forma de pago</h2><table class="datos">
    <tr><th>Banco / entidad</th><td>${esc(e.banco)}</td></tr><tr><th>Tipo y número de cuenta</th><td>${esc(e.tipo_cuenta)} ${esc(e.cuenta)}</td></tr>
    <tr><th>Titular</th><td>${esc(e.titular)}${e.cedula ? ' — C.C. ' + esc(e.cedula) : ''}</td></tr></table>
    <p>Plazo de pago: ${esc(e.plazo_pago)} días hábiles desde la recepción de este documento. Favor enviar el comprobante a ${esc(e.correo)}.</p>` : '';

  const declaraciones = cobro ? `<h2>Declaraciones del prestador</h2><p style="font-size:8.5pt">Bajo la gravedad del juramento, que se entiende prestado con la firma de este documento, declaro que:</p><ol>
    <li>Soy persona natural <b>no responsable del impuesto sobre las ventas (IVA)</b>, por cumplir las condiciones del parágrafo 3 del artículo 437 del Estatuto Tributario, y así consta en mi RUT. En consecuencia, este cobro no causa IVA.</li>
    <li>No estoy obligado a expedir factura de venta, conforme al artículo 616-2 del Estatuto Tributario y al artículo 1.6.1.4.3 del Decreto 1625 de 2016. El pagador, si es obligado a ello, expedirá el documento soporte en adquisiciones efectuadas a sujetos no obligados a facturar.</li>
    <li>El servicio cobrado se prestó con autonomía técnica y administrativa, en ejecución de un contrato civil o comercial, sin relación laboral con el pagador.</li></ol>` : '';

  const dian = clase === 'factura_venta' ? `<div class="nota">${d.dian?.numero
    ? `Esta operación se soporta con la <b>factura electrónica de venta N.º ${esc(d.dian.numero)}</b>${d.dian.cufe ? ' (CUFE ' + esc(d.dian.cufe) + ')' : ''}, validada por la DIAN, que es el documento válido para efectos tributarios.`
    : 'Representación del cobro. El documento válido para efectos tributarios es la factura electrónica de venta validada por la DIAN.'}</div>` : '';

  const condiciones = d.condiciones ? `<h2>${cotiz ? 'Condiciones' : 'Observaciones'}</h2><p class="pre">${esc(d.condiciones)}</p>` : '';
  const notas = d.notas ? `<p class="pre" style="font-size:9pt">${esc(d.notas)}</p>` : '';
  const origen = !cotiz && d.origen_numero ? `<p style="font-size:8.5pt;color:#4a6470">Según cotización N.º ${esc(d.origen_numero)}.</p>` : '';

  // Firma del emisor: la imagen autorizada (Equipo → Firma) o el marcador para que se firme en /firmar.
  const fe = d.firma_emisor?.imagen ? `<img class="firma-img" src="${d.firma_emisor.imagen}" alt="Firma">` : paraFirma ? '<firma-k k="firma_h"></firma-k>' : '';
  const firmaEmisor = `<div class="firma ${fe ? 'con-img' : ''}">${fe}<div class="raya"><b>${esc(e.nombre)}</b><span>${esc(e.marca)}</span>${!cotiz && e.cedula ? '<span>C.C. ' + esc(e.cedula) + '</span>' : ''}${d.firma_emisor?.en ? '<span>Firma autorizada ' + esc(fechaLarga(d.firma_emisor.en.slice(0, 10))) + '</span>' : ''}</div></div>`;
  const firmaCliente = (rotulo) => paraFirma
    ? `<div class="firma con-img"><firma-k k="firma_c"></firma-k><div class="raya"><b>${rotulo}</b><span>${esc(r.nombre || 'Nombre')}</span><span>C.C./NIT: <campo-k k="c_cedula" ph="cédula o NIT"></campo-k></span><span>Fecha: <campo-k k="dia_firma" ph="día"></campo-k> de <campo-k k="mes_firma" ph="mes"></campo-k> de <campo-k k="anio_firma" ph="año"></campo-k></span></div></div>`
    : `<div class="firma"><div class="raya"><b>${rotulo}</b><span>${esc(r.nombre || 'Nombre')}</span><span>Fecha: ____________________</span></div></div>`;
  const firmas = cotiz
    ? `<div class="firmas">${firmaEmisor}${firmaCliente('Aceptada por el cliente')}</div>`
    : paraFirma ? `<p style="margin-top:16px">Atentamente,</p><div class="firmas">${firmaEmisor}${firmaCliente('Recibida y aprobada por el cliente')}</div>`
    : `<p style="margin-top:16px">Atentamente,</p><div style="max-width:280px">${firmaEmisor}</div>`;

  return `<!doctype html><html lang="es"${pdf ? ' class="pdf"' : ''}><head><meta charset="utf-8"><title>${esc(T.corto)} ${esc(numero)} — ${esc(e.marca)}</title><style>${CSS}</style></head><body><main class="hoja">
  <header class="membrete">${LOGO}<div class="marca">${esc(e.marca)}<small>Software a la medida · IoT · Fabricación digital — ${esc(e.ciudad)}, Colombia</small></div>
    <div class="ref">${ref}${sello ? `<br><span class="sello ${sello.toLowerCase()}">${sello}</span>` : ''}</div></header>
  <h1>${T.titulo}</h1><p class="subtitulo">${cotiz ? 'Propuesta económica' : cobro ? 'Persona natural no responsable de IVA' : 'Relación del cobro'}</p>
  ${cobro ? receptor + prestador : receptor}
  ${notas}${items}${origen}${dian}${condiciones}${qrs}${pago}${declaraciones}${firmas}
  <footer class="pie">${esc(e.marca)} · ${esc(e.ciudad)}, Colombia · ${esc(e.correo)} · ${esc(e.web)}</footer></main></body></html>`;
}
