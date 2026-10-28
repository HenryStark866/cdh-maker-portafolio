// Arma los documentos firmados de una solicitud (PDF + registro.json) en el navegador del
// administrador. Reemplaza al antiguo ensamblar.mjs local: no hay secreto ni Chrome headless.
// Un documento se arma cuando firmaron todos los firmantes que lo tienen asignado, así que una
// cuenta de cobro que solo firma el contratista sale aunque falte la firma del contratante.
import { rellenar, sha256Hex } from './rellenar.js';

const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
];
let cargadas = null;
export const cargarLibs = () => cargadas ??= LIBS.reduce((p, src) => p.then(() => new Promise((ok, mal) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
  document.head.append(s);
})), Promise.resolve());

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const parte = (d, o) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', ...o }).format(d);
const cuando = (s) => `${parte(new Date(s), { dateStyle: 'long', timeStyle: 'medium' })} (hora de Colombia) · ${new Date(s).toISOString()}`;
const hashes = (X) => Object.fromEntries((X.hashDoc || []).map((x) => x.split(':')));
const fecha = (t) => (t?.toDate ? t.toDate() : new Date(t));
export const sha256Bytes = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
// Identificación del firmante: el campo que indique "cedula" en la solicitud o el primer campo suyo con "cedula" en el nombre.
const cedulaDe = (f, X) => {
  const v = { ...(X.prefill || {}), ...(X.datos || {}) };
  return v[f.cedula] || Object.entries(X.datos || {}).find(([k]) => /cedula/.test(k))?.[1] || '';
};
const etiqueta = (f) => f.etiqueta || f.rol.charAt(0).toUpperCase() + f.rol.slice(1);

// "{{campo}}" dentro de solicitud.registro se reemplaza por el valor que escribió el firmante.
const plantillaJSON = (x, v) => {
  if (typeof x === 'string') return x.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
  if (Array.isArray(x)) return x.map((y) => plantillaJSON(y, v));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, plantillaJSON(y, v)]));
  return x;
};

// Renderiza el HTML en un iframe fuera de pantalla con el ancho útil de una hoja A4 y lo pasa a PDF,
// una imagen por hoja. jsPDF.html() deformaba el texto y la posición de las firmas, así que se
// rasteriza con html2canvas (fiel al navegador) y se corta la página donde no parta un párrafo,
// una fila o una firma; los elementos con break-before: page abren hoja nueva.
export async function htmlAPdf(html) {
  const { jsPDF } = window.jspdf;
  const ANCHO = 673; // 178 mm (A4 menos 16 mm por lado) a 96 ppp
  const MM = 178 / ANCHO; // milímetros por píxel
  const ALTO = Math.floor(273 / MM); // alto útil de la hoja: 297 mm menos 12 mm arriba y abajo
  const ifr = document.createElement('iframe');
  ifr.style.cssText = `position:fixed;left:-20000px;top:0;width:${ANCHO}px;height:${ALTO}px;border:0`;
  document.body.append(ifr);
  try {
    await new Promise((ok) => { ifr.onload = ok; ifr.srcdoc = html; });
    const d = ifr.contentDocument;
    d.documentElement.style.background = '#fff';
    d.body.style.margin = '0';
    await d.fonts?.ready;
    await Promise.all([...d.images].map((i) => i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; })));
    const total = Math.ceil(d.documentElement.scrollHeight);
    ifr.style.height = total + 'px';

    // Cortes de página
    const caja = (e) => e.getBoundingClientRect();
    const atomos = [...d.body.querySelectorAll('p,li,tr,h1,h2,h3,h4,h5,h6,img,figure,pre,blockquote,dt,dd,.firma-img,.firma-vacia')]
      .map(caja).filter((r) => r.height > 0 && r.height < ALTO * 0.8).map((r) => [r.top, r.bottom]);
    const forzados = [...d.body.querySelectorAll('*')].filter((e) => /page|always/.test(getComputedStyle(e).breakBefore)).map((e) => caja(e).top);
    const seguro = (y) => atomos.every(([a, b]) => y <= a + 0.5 || y >= b - 0.5);
    const cortes = [0];
    while (cortes.at(-1) < total - 2) {
      const ini = cortes.at(-1);
      let fin = Math.min(ini + ALTO, total);
      const f = forzados.find((y) => y > ini + 2 && y < fin);
      if (f) fin = f;
      else if (fin < total) {
        let y = fin;
        while (y > ini + ALTO * 0.5 && !seguro(y)) y--;
        if (seguro(y)) fin = y;
      }
      cortes.push(fin);
    }

    const escala = Math.min(2, 32000 / total);
    const lienzo = await window.html2canvas(d.documentElement, { scale: escala, width: ANCHO, height: total, windowWidth: ANCHO, windowHeight: total, backgroundColor: '#ffffff', logging: false });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    for (let i = 1; i < cortes.length; i++) {
      const alto = cortes[i] - cortes[i - 1];
      if (alto < 2) continue;
      const hoja = document.createElement('canvas');
      hoja.width = lienzo.width; hoja.height = Math.round(alto * escala);
      const ctx = hoja.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, hoja.width, hoja.height);
      ctx.drawImage(lienzo, 0, Math.round(cortes[i - 1] * escala), hoja.width, hoja.height, 0, 0, hoja.width, hoja.height);
      if (i > 1) pdf.addPage();
      pdf.addImage(hoja.toDataURL('image/jpeg', 0.88), 'JPEG', 16, 12, 178, alto * MM);
    }
    return new Uint8Array(pdf.output('arraybuffer'));
  } finally { ifr.remove(); }
}

async function unirPdfs(partes, titulo) {
  const { PDFDocument } = window.PDFLib;
  const out = await PDFDocument.create();
  for (const p of partes) {
    const src = await PDFDocument.load(p);
    for (const pg of await out.copyPages(src, src.getPageIndices())) out.addPage(pg);
  }
  out.setTitle(titulo); out.setAuthor('CDH Maker'); out.setProducer('cdhmaker.com/crm'); out.setCreator('cdhmaker.com/crm');
  return new Uint8Array(await out.save());
}

function certificado({ titulo, solicitud, firmantes, id }) {
  const filas = firmantes.map(({ f, X }) => `<tr><td><b>${esc(X.nombre)}</b><br>${esc(etiqueta(f))}</td><td>${esc(cedulaDe(f, X))}</td><td>${esc(cuando(fecha(X.firmadoEn)))}</td><td style="word-break:break-all">${esc(hashes(X)[id] || '')}</td></tr>`).join('');
  const nav = firmantes.map(({ f, X }) => `${esc(etiqueta(f))} — navegador: ${esc(X.ua)} · zona horaria: ${esc(X.tz)}`).join('<br>');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0F2533;font-size:9.5pt;line-height:1.35}
    h1{font-size:15pt;color:#0B3C5D;margin:0 0 10px} table{width:100%;border-collapse:collapse;font-size:8.5pt}
    th{background:#EAF2F8;text-align:left} td,th{border:1px solid #9FB4C0;padding:5px;vertical-align:top} p{margin:8px 0}
  </style></head><body><h1>CERTIFICADO DE FIRMA ELECTRÓNICA</h1>
  <p>El documento “${esc(titulo)}” fue firmado electrónicamente por las Partes mediante enlaces temporales y personales emitidos desde cdhmaker.com (vigencia de ${esc(solicitud.horas || 24)} horas), con firma manuscrita digitalizada, de conformidad con la Ley 527 de 1999 y el Decreto 1074 de 2015 (artículos 2.2.2.47.1 y siguientes).</p>
  <table><tr><th>Firmante</th><th>Identificación</th><th>Fecha y hora de firma (servidor)</th><th>Huella SHA-256 del texto firmado</th></tr>${filas}</table>
  <p style="font-size:8.5pt">${nav}</p>
  <p style="font-size:8.5pt">La huella corresponde al texto del documento tal como lo vio cada firmante (con los campos en blanco); los datos que cada uno ingresó se muestran en el documento y se conservan en el registro de firma. Identificador de la solicitud: ${esc(solicitud.id)}.</p>
  </body></html>`;
}

// Estado de cada documento de la solicitud a partir de los enlaces leídos de Firestore.
export function estadoDocs(solicitud, enlaces) {
  const docs = {};
  solicitud.firmantes.forEach((f, i) => {
    for (const id of f.docs) (docs[id] ??= { id, titulo: solicitud.plantillas[id]?.titulo || id, firmantes: [] }).firmantes.push({ f, X: enlaces[i] });
  });
  for (const d of Object.values(docs)) d.listo = d.firmantes.every(({ X }) => X?.estado === 'firmado');
  return Object.values(docs);
}

const nombreArchivo = (id, titulo) => (id + '-' + titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) + '-firmado.pdf';

// Devuelve { archivos: [{ nombre, tipo, mime, bytes, sha256 }], registro, faltan }.
export async function ensamblar({ cliente, solicitud, enlaces, alAvanzar = () => {} }) {
  await cargarLibs();
  const docs = estadoDocs(solicitud, enlaces);
  const listos = docs.filter((d) => d.listo);
  const firmados = solicitud.firmantes.map((f, i) => ({ f, X: enlaces[i] })).filter(({ X }) => X?.estado === 'firmado');
  const archivos = [];
  for (const d of listos) {
    alAvanzar(`Generando ${d.titulo}…`);
    const valores = {};
    for (const { X } of d.firmantes) Object.assign(valores, X.prefill || {});
    for (const { X } of d.firmantes) Object.assign(valores, X.datos || {});
    const ultima = new Date(Math.max(...d.firmantes.map(({ X }) => fecha(X.firmadoEn).getTime())));
    valores.dia_firma = parte(ultima, { day: 'numeric' });
    valores.mes_firma = parte(ultima, { month: 'long' });
    valores.anio_firma = parte(ultima, { year: 'numeric' });
    const firmas = Object.fromEntries(d.firmantes.map(({ f, X }) => [f.firma, X.firma]));
    const html = rellenar(d.firmantes[0].X.docs.find((x) => x.id === d.id).html, valores, firmas);
    const pdf = await unirPdfs([await htmlAPdf(html), await htmlAPdf(certificado({ titulo: d.titulo, solicitud, firmantes: d.firmantes, id: d.id }))], d.titulo);
    archivos.push({ nombre: nombreArchivo(d.id, d.titulo), tipo: d.id, mime: 'application/pdf', bytes: pdf, sha256: await sha256Bytes(pdf) });
  }
  for (const { f, X } of firmados) {
    const bytes = Uint8Array.from(atob(X.firma.split(',')[1]), (c) => c.charCodeAt(0));
    archivos.push({ nombre: `firma-${f.rol}.png`, tipo: 'firma', mime: 'image/png', bytes, sha256: await sha256Bytes(bytes) });
  }

  const valores = {};
  for (const { X } of firmados) Object.assign(valores, X.prefill || {});
  for (const { X } of firmados) Object.assign(valores, X.datos || {});
  const ultima = firmados.length ? new Date(Math.max(...firmados.map(({ X }) => fecha(X.firmadoEn).getTime()))) : null;
  const extra = plantillaJSON(solicitud.registro || {}, valores);
  const registro = {
    esquema: 'cdhmaker.crm.contrato.v1',
    id: solicitud.id,
    cliente: { nombre: cliente.nombre, nit: cliente.nit || valores.nit || '', correo: cliente.correo || '', ...(extra.cliente || {}) },
    proveedor: { marca: 'CDH Maker', ...(extra.proveedor || {}) },
    contrato: {
      titulo: solicitud.titulo, ciudad: valores.ciudad_firma || '', fecha_firma: ultima?.toISOString() || null,
      estado: listos.length === docs.length ? 'firmado' : 'firmado parcialmente', ...(extra.contrato || {}),
    },
    valores: extra.valores || null,
    firmas: firmados.map(({ f, X }) => ({ rol: f.rol, nombre: X.nombre, firmado_en: fecha(X.firmadoEn).toISOString(), navegador: X.ua, zona_horaria: X.tz, hash_documentos: hashes(X), documentos: f.docs })),
    archivos: archivos.map(({ nombre, sha256, tipo }) => ({ nombre, sha256, tipo })),
    pendientes: docs.filter((d) => !d.listo).map((d) => d.id),
    origen: { sistema: 'cdhmaker.com/crm', proyecto_firebase: 'cdh-maker-portafolio', cliente: cliente.id, solicitud: solicitud.id, creado: new Date().toISOString() },
  };
  const json = new TextEncoder().encode(JSON.stringify(registro, null, 2));
  archivos.push({ nombre: 'registro.json', tipo: 'registro', mime: 'application/json', bytes: json, sha256: await sha256Bytes(json) });
  return { archivos, registro, faltan: docs.filter((d) => !d.listo) };
}

export { sha256Hex };
