// Medios de pago (crm_config/pagos): llaves y QR Bre-B (Bancolombia, Nequi…), wallets y enlaces de pago de
// CDH Maker y de la Tienda Medellín. Los QR se redibujan con la identidad de la marca a partir del contenido
// exacto del QR original (cadena EMVCo con su CRC), así que pagan a la misma cuenta. Salen en las cuentas de
// cobro y como cartel imprimible. Los datos viven en Firestore, no en el repo (es público).
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, $app, esc, aviso, nav, sello, descargar, slug } from './comun.js';

const LIBS = { qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js', lector: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js' };
const cargadas = {};
const cargar = (k) => cargadas[k] ??= new Promise((ok, mal) => { const s = document.createElement('script'); s.src = LIBS[k]; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + LIBS[k])); document.head.append(s); });

export const TIPOS_PAGO = {
  breb: { n: 'Llave Bre-B (cualquier banco)', nota: 'Escanea desde la app de tu banco o paga a la llave con Bre-B' },
  wallet: { n: 'Wallet / billetera digital', nota: 'Escanea para pagar desde tu billetera' },
  cripto: { n: 'Criptomoneda', nota: 'Envía solo por la red indicada' },
  enlace: { n: 'Enlace de pago (Wompi, Bold, PayU…)', nota: 'Escanea para pagar en línea con tarjeta o PSE' },
  cuenta: { n: 'Cuenta bancaria (sin QR)', nota: 'Transferencia o consignación' },
};
const ENTIDADES = ['Bancolombia', 'Nequi', 'Nequi Negocios', 'Daviplata', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Interledger (Open Payments)', 'Wompi', 'Bold', 'Binance', 'Otra'];
const NEGOCIOS = ['CDH Maker', 'Tienda Medellín', 'Henry Taborda (personal)'];

// ───────── EMVCo / Bre-B ─────────
const crc16 = (s) => { let c = 0xFFFF; for (const b of new TextEncoder().encode(s)) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); };
const tlv = (t) => { const o = {}; let i = 0; while (i + 4 <= t.length) { const n = Number(t.slice(i + 2, i + 4)); if (!Number.isInteger(n)) break; o[t.slice(i, i + 2)] = t.slice(i + 4, i + 4 + n); i += 4 + n; } return o; };
// Lee un QR de pago EMVCo (el de Bre-B): llave, nombre del comercio, ciudad y si el CRC cuadra.
export function leerEMV(s) {
  s = String(s || '').trim();
  if (!/^000201/.test(s)) return null;
  const raiz = tlv(s);
  let llave = '';
  for (const [k, v] of Object.entries(raiz)) if (+k >= 26 && +k <= 51) { const sub = tlv(v); if (/LLA$/.test(sub['00'] || '')) llave = Object.entries(sub).find(([x]) => x !== '00')?.[1] || ''; }
  const comercio = (raiz['59'] || '').trim();
  return { llave, comercio: comercio.length > 1 ? comercio : '', crcOk: s.length > 8 && crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase(), breb: /CO\.COM\.RBM/.test(s) };
}
// Contenido del QR de un medio: el payload EMVCo, o la URL/dirección.
export function contenidoQR(m) {
  if (m.payload) return m.payload;
  if (m.tipo === 'wallet' && m.llave) return m.llave.replace(/^\$/, 'https://');
  return m.llave || '';
}

// ───────── QR con la identidad de CDH Maker ─────────
// Módulos cuadrados (en un QR de pago la lectura manda: los redondeados fallaban en algunos tamaños),
// ojos con esquina suave en los colores de la marca y el isotipo al centro. Corrección de errores M: el
// logo tapa menos del 2 % del código.
let nQR = 0;
export async function qrSVG(texto, { tinta = '#060B14', logo = true, px = 0, ec = 'M' } = {}) {
  await cargar('qr');
  const qr = window.qrcode(0, ec); qr.addData(texto, 'Byte'); qr.make();
  const n = qr.getModuleCount(), q = 4, T = n + 2 * q; // q: margen blanco estándar de 4 módulos
  const ojos = [[0, 0], [0, n - 7], [n - 7, 0]];
  const enOjo = (r, c) => ojos.some(([y, x]) => r >= y - 1 && r <= y + 7 && c >= x - 1 && c <= x + 7);
  const k = logo ? Math.max(7, Math.round(n * 0.14) | 1) : 0, c0 = (n - k) / 2;
  const enLogo = (r, c) => logo && r >= c0 - 0.5 && r < c0 + k + 0.5 && c >= c0 - 0.5 && c < c0 + k + 0.5;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c) || enOjo(r, c) || enLogo(r, c)) continue;
    let l = 0; while (c + l + 1 < n && qr.isDark(r, c + l + 1) && !enOjo(r, c + l + 1) && !enLogo(r, c + l + 1)) l++;
    d += `M${c + q} ${r + q}h${l + 1}v1h-${l + 1}z`; c += l;
  }
  const ojo = ([y, x]) => `<rect x="${x + q + 0.5}" y="${y + q + 0.5}" width="6" height="6" fill="none" stroke="${tinta}"/><rect x="${x + q + 2}" y="${y + q + 2}" width="3" height="3" fill="${tinta}"/>`;
  let centro = '';
  if (logo) {
    const marca = await import('./marca.js').catch(() => null);
    const x = c0 + q - 0.25, t = k + 0.5;
    centro = `<rect x="${x - 0.6}" y="${x - 0.6}" width="${t + 1.2}" height="${t + 1.2}" rx="${t * 0.26}" fill="#fff"/>` + (marca?.isotipo
      ? marca.isotipo(t).replace(/<svg\b/, `<svg x="${x}" y="${x}"`)
      : `<rect x="${x}" y="${x}" width="${t}" height="${t}" rx="${t * 0.22}" fill="${tinta}"/><text x="${x + t / 2}" y="${x + t * 0.64}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${t * 0.36}" fill="#22D3EE">CDH</text>`);
  }
  const tam = px ? ` width="${px}" height="${px}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}"${tam} role="img" aria-label="Código QR de pago" data-qr="${++nQR}">
    <rect width="${T}" height="${T}" rx="${T * 0.04}" fill="#fff"/><path d="${d}" fill="${tinta}" shape-rendering="crispEdges"/>${ojos.map(ojo).join('')}${centro}</svg>`;
}

// Lee un QR desde la foto o captura de pantalla (BarcodeDetector si existe; si no, jsQR).
export async function leerQRImagen(file) {
  const img = await createImageBitmap(file);
  if ('BarcodeDetector' in window) {
    try { const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(img); if (r[0]?.rawValue) return r[0].rawValue; } catch { /* sigue con jsQR */ }
  }
  await cargar('lector');
  for (const lado of [1400, 900, 2000]) {
    const k = Math.min(1, lado / Math.max(img.width, img.height));
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, cv.width, cv.height);
    const r = window.jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  throw new Error('No encontré un código QR legible en «' + file.name + '».');
}

// ───────── datos ─────────
// Medios de cobro de CDH Maker por ahora (cuentas personales de Henry, por decisión suya): vienen
// predeterminados para que las cuentas de cobro y facturas salgan con QR sin configurar nada. Son llaves de
// recaudo, hechas para compartirse con quien paga. Al guardar cambios en Medios de pago, mandan los de Firestore.
export const MEDIOS_BASE = [
  { id: 'breb-bancolombia', tipo: 'breb', entidad: 'Bancolombia', negocio: 'CDH Maker', titulo: 'Bancolombia · Bre-B', llave: '@henry9866', titular: 'Henry Taborda',
    payload: '00020101021126320014CO.COM.RBM.LLA0410@henry986649250014CO.COM.RBM.RED0103RBM50310013CO.COM.RBM.CU0110000000000051220013CO.COM.RBM.CA010105204000053031705802CO59010600106101062270710CC3CA115EA080200110363180270016CO.COM.RBM.CANAL0103APP81250015CO.COM.RBM.CIVA01020282260014CO.COM.RBM.IVA01040.0083270015CO.COM.RBM.BASE01040.0084250015CO.COM.RBM.CINC01020285260014CO.COM.RBM.INC01040.0090430016CO.COM.RBM.TRXID0119000001eUqMs6dG7C_1991460014CO.COM.RBM.SEC0124s8sGvdPw7/cKrOVG/qOzJ/1A6304E3E5',
    nota: 'Desde cualquier banco con Bre-B', en_cobros: true, en_facturas: true },
  { id: 'breb-nequi-negocios', tipo: 'breb', entidad: 'Nequi Negocios', negocio: 'CDH Maker', titulo: 'Nequi Negocios · Bre-B', llave: '0089443902', titular: 'CDH Maker · Henry Taborda',
    payload: '00020101021126320014CO.COM.RBM.LLA0510008944390249250014CO.COM.RBM.RED0103RBM50310013CO.COM.RBM.CU0110008944390251250013CO.COM.RBM.CA010499995204999953031705802CO5922CDH MAKER HENRY TABORD60050500161050500162200703000080200110363180270016CO.COM.RBM.CANAL0103APP81250015CO.COM.RBM.CIVA01020382260014CO.COM.RBM.IVA01040.0083270015CO.COM.RBM.BASE01040.0084250015CO.COM.RBM.CINC01020385260014CO.COM.RBM.INC01040.0090430016CO.COM.RBM.TRXID011900000002E5cXGVRpIdf91460014CO.COM.RBM.SEC0124kS+7yLlc80o31iIjlfogq8/i6304BE4D',
    nota: 'Desde Nequi o cualquier banco con Bre-B', en_cobros: true, en_facturas: true },
];
const REF = () => doc(db, 'crm_config', 'pagos');
export async function cargarMedios() { const m = (await getDoc(REF())).data()?.metodos; return Array.isArray(m) ? m : MEDIOS_BASE; }
const guardarMedios = (metodos) => setDoc(REF(), { metodos, ...sello() }, { merge: true });

// Medios que van en cuentas de cobro o facturas, con su QR ya dibujado (comercial.js elige según el documento).
export async function mediosParaCobro() {
  const ms = (await cargarMedios()).filter((m) => m.en_cobros || m.en_facturas);
  return Promise.all(ms.map(async (m) => ({ ...m, nota: m.nota || TIPOS_PAGO[m.tipo]?.nota || '', svg: contenidoQR(m) && m.tipo !== 'cuenta' ? await qrSVG(contenidoQR(m)) : '' })));
}

// ───────── vista ─────────
export async function vistaPagos() {
  nav('pagos');
  const metodos = await cargarMedios();
  const svgs = await Promise.all(metodos.map((m) => (contenidoQR(m) && m.tipo !== 'cuenta' ? qrSVG(contenidoQR(m)) : '')));
  $app.innerHTML = `<h1 class="titulo">Medios de pago</h1><p class="bajada">QR y llaves para cobrar a CDH Maker y a la Tienda Medellín. Los marcados se agregan solos a las cuentas de cobro y facturas, con la llave al lado para copiarla (en cada documento se pueden quitar).</p>
    ${metodos.length ? '' : `<div class="card"><h2>Empieza con tus QR de Bancolombia y Nequi</h2><p class="suave">Sube las capturas de los QR Bre-B (las que te da la app del banco). Leo el código, verifico su dígito de control y lo redibujo con la marca: paga a la misma cuenta.</p>
      <input type="file" id="capturas" accept="image/*" multiple><div id="mCapturas"></div></div>`}
    <div class="grid" style="gap:16px">${metodos.map((m, i) => `<div class="card" style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      ${svgs[i] ? `<div style="width:150px;flex:none">${svgs[i]}</div>` : ''}
      <div style="flex:1;min-width:180px"><span class="chip info">${esc(m.entidad || TIPOS_PAGO[m.tipo]?.n || '')}</span> ${m.en_cobros ? '<span class="chip ok">cuentas de cobro</span>' : ''} ${m.en_facturas ? '<span class="chip ok">facturas</span>' : ''}
        <h2 style="margin:8px 0 2px">${esc(m.titulo || m.entidad)}</h2><span class="suave">${esc(m.negocio || '')}${m.titular ? ' · ' + esc(m.titular) : ''}</span>
        <p style="margin:10px 0 4px"><span class="suave">${m.tipo === 'breb' ? 'Llave' : m.tipo === 'cuenta' ? 'Cuenta' : 'Dirección'}</span><br><b style="font:600 16px/1.3 'Space Grotesk',sans-serif;word-break:break-all">${esc(m.llave || '—')}</b></p>
        ${m.tipo === 'wallet' && /test/.test(m.llave) ? '<p class="aviso warn">Es una wallet de la red de prueba de Interledger: no recibe dinero real.</p>' : ''}
        ${m.payload && m.tipo === 'breb' ? (leerEMV(m.payload)?.crcOk ? '<small class="suave">QR verificado (CRC EMVCo correcto)</small>' : '<small style="color:var(--err)">El contenido del QR no pasa la verificación</small>') : ''}
        <div class="acciones"><button class="mini" data-copiar="${esc(m.llave || '')}">Copiar llave</button>${svgs[i] ? `<button class="mini" data-cartel="${i}">Cartel PNG</button><button class="mini" data-cartelsvg="${i}">SVG</button>` : ''}
          <button class="mini" data-editar="${i}">Editar</button><button class="mini peligro" data-quitar="${i}">Quitar</button></div></div></div>`).join('')}</div>
    <div class="card" style="max-width:760px"><h2 id="tituloForm">Agregar medio de pago</h2><form id="fMedio">
      <div class="grid"><div><label>Tipo</label><select name="tipo">${Object.entries(TIPOS_PAGO).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('')}</select></div>
        <div><label>Entidad</label><input name="entidad" list="entidades" placeholder="Bancolombia"><datalist id="entidades">${ENTIDADES.map((x) => `<option value="${x}">`).join('')}</datalist></div>
        <div><label>Negocio</label><input name="negocio" list="negocios" value="CDH Maker"><datalist id="negocios">${NEGOCIOS.map((x) => `<option value="${x}">`).join('')}</datalist></div>
        <div><label>Título que ve el cliente</label><input name="titulo" placeholder="Bre-B Bancolombia"></div>
        <div><label>Llave, dirección o número</label><input name="llave" required placeholder="@usuario, $wallet.example/cdhmaker, 0x…"></div>
        <div><label>Titular</label><input name="titular" placeholder="Henry Taborda"></div></div>
      <label>Contenido del QR (opcional: se llena solo al leer la imagen; para wallets y enlaces basta la dirección)</label><textarea name="payload" style="min-height:60px"></textarea>
      <div class="acciones" style="margin-top:4px"><label class="boton" style="margin:0;cursor:pointer">Leer QR desde una imagen<input type="file" id="leerImg" accept="image/*" class="oculto"></label></div>
      <label>Nota bajo el QR (opcional)</label><input name="nota" placeholder="Desde cualquier banco con Bre-B">
      <label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="en_cobros" checked> Agregar automáticamente a las cuentas de cobro</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="en_facturas" checked> Agregar automáticamente a las facturas</label>
      <input type="hidden" name="i" value="">
      <div class="acciones"><button class="primario">Guardar</button><button type="button" id="cancelar" class="oculto">Cancelar edición</button></div></form><div id="mMedio"></div></div>`;

  const $f = document.getElementById('fMedio'), m = document.getElementById('mMedio');
  $app.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Copiada ✔'; }));
  const aplicarLectura = (texto) => {
    const e = leerEMV(texto);
    $f.payload.value = texto;
    if (e) {
      $f.tipo.value = 'breb';
      if (e.llave) $f.llave.value = e.llave;
      if (e.comercio && !$f.titular.value) $f.titular.value = e.comercio;
      aviso(m, e.crcOk ? `QR Bre-B leído y verificado. Llave <b>${esc(e.llave)}</b>${e.comercio ? ' · ' + esc(e.comercio) : ''}. Elige la entidad y guarda.` : 'Leí el QR, pero su dígito de control no cuadra: revisa la imagen.', e.crcOk ? 'ok' : 'err');
    } else {
      if (!$f.llave.value) $f.llave.value = texto;
      aviso(m, 'QR leído: ' + esc(texto.slice(0, 120)), 'ok');
    }
  };
  document.getElementById('leerImg').addEventListener('change', async (e) => {
    try { if (e.target.files[0]) aplicarLectura(await leerQRImagen(e.target.files[0])); } catch (err) { aviso(m, esc(err.message), 'err'); }
  });
  $f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData($f));
    const x = { id: f.i !== '' ? metodos[Number(f.i)].id : slug(`${f.negocio}-${f.entidad || f.tipo}-${f.llave}`).slice(0, 40), tipo: f.tipo, entidad: f.entidad.trim(), negocio: f.negocio.trim(), titulo: f.titulo.trim() || f.entidad.trim(),
      llave: f.llave.trim(), titular: f.titular.trim(), payload: f.payload.trim(), nota: f.nota.trim(), en_cobros: !!f.en_cobros, en_facturas: !!f.en_facturas };
    if (x.tipo === 'breb' && x.payload && !leerEMV(x.payload)?.crcOk) return aviso(m, 'El contenido del QR Bre-B no es válido (CRC). Léelo de nuevo desde la imagen.', 'err');
    const lista = [...metodos];
    if (f.i !== '') lista[Number(f.i)] = x; else lista.push(x);
    await guardarMedios(lista);
    await vistaPagos();
  });
  document.getElementById('cancelar').addEventListener('click', () => vistaPagos());
  $app.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => {
    const x = metodos[Number(b.dataset.editar)];
    for (const k of ['tipo', 'entidad', 'negocio', 'titulo', 'llave', 'titular', 'payload', 'nota']) $f[k].value = x[k] || '';
    $f.en_cobros.checked = !!x.en_cobros; $f.en_facturas.checked = !!x.en_facturas; $f.i.value = b.dataset.editar;
    document.getElementById('tituloForm').textContent = 'Editar ' + (x.titulo || x.entidad);
    document.getElementById('cancelar').classList.remove('oculto');
    $f.scrollIntoView({ behavior: 'smooth' });
  }));
  $app.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    const x = metodos[Number(b.dataset.quitar)];
    if (!confirm(`¿Quitar «${x.titulo || x.llave}»? Las cuentas de cobro ya exportadas no cambian.`)) return;
    await guardarMedios(metodos.filter((_, i) => i !== Number(b.dataset.quitar)));
    await vistaPagos();
  }));
  const cartel = async (i, formato) => {
    const x = metodos[i], svg = await cartelSVG(x);
    const nombre = `cartel-pago-${slug(x.negocio + '-' + (x.entidad || x.tipo))}`;
    if (formato === 'svg') return descargar(new TextEncoder().encode(svg), nombre + '.svg', 'image/svg+xml');
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const cv = Object.assign(document.createElement('canvas'), { width: 1240, height: 1754 });
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    descargar(new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, 'image/png'))).arrayBuffer()), nombre + '.png', 'image/png');
  };
  $app.querySelectorAll('[data-cartel]').forEach((b) => b.addEventListener('click', () => cartel(Number(b.dataset.cartel), 'png')));
  $app.querySelectorAll('[data-cartelsvg]').forEach((b) => b.addEventListener('click', () => cartel(Number(b.dataset.cartelsvg), 'svg')));

  // Primera vez: varias capturas a la vez → un medio Bre-B por cada QR válido.
  document.getElementById('capturas')?.addEventListener('change', async (e) => {
    const mc = document.getElementById('mCapturas'), nuevos = [];
    for (const file of e.target.files) {
      try {
        const texto = await leerQRImagen(file), x = leerEMV(texto);
        if (!x?.crcOk) { aviso(mc, `«${esc(file.name)}» no es un QR Bre-B válido.`, 'err'); continue; }
        const nequi = /^\d{10}$/.test(x.llave) || /nequi/i.test(file.name);
        nuevos.push({ id: slug('breb-' + x.llave), tipo: 'breb', entidad: nequi ? 'Nequi Negocios' : 'Bancolombia', negocio: nequi ? 'CDH Maker' : 'Henry Taborda (personal)',
          titulo: nequi ? 'Nequi Negocios · Bre-B' : 'Bancolombia · Bre-B', llave: x.llave, titular: x.comercio || 'Henry Taborda', payload: texto, nota: '', en_cobros: true, en_facturas: true });
      } catch (err) { aviso(mc, esc(err.message), 'err'); }
    }
    if (!nuevos.length) return;
    await guardarMedios([...metodos, ...nuevos]);
    await vistaPagos();
  });
}

// Cartel A4 para imprimir y pegar en la tienda (o enviar por WhatsApp).
async function cartelSVG(x) {
  const marca = await import('./marca.js').catch(() => null);
  const qr = (await qrSVG(contenidoQR(x))).replace(/<svg\b/, '<svg x="150" y="430" width="540" height="540"');
  const logo = marca?.logoHorizontal ? marca.logoHorizontal({ alto: 70, tema: 'oscuro' }).replace(/<svg\b/, '<svg x="60" y="60"') : '<text x="60" y="110" font-family="Arial" font-weight="700" font-size="40" fill="#fff">CDH MAKER</text>';
  const e = (s) => esc(s).replace(/'/g, '&#39;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 1188" width="840" height="1188">
    <rect width="840" height="1188" fill="#060B14"/><path d="M0 1188 L840 980 L840 1188 Z" fill="#0C1624"/>
    ${logo}
    <text x="420" y="285" text-anchor="middle" font-family="Space Grotesk,Inter,Arial,sans-serif" font-weight="700" font-size="58" fill="#fff">Paga aquí</text>
    <text x="420" y="345" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" fill="#8FB3C9">${e(x.negocio || 'CDH Maker')}</text>
    <rect x="120" y="400" width="600" height="600" rx="40" fill="#fff"/><rect x="120" y="400" width="600" height="600" rx="40" fill="none" stroke="#22D3EE" stroke-width="4"/>
    ${qr}
    <text x="420" y="1070" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="26" fill="#8FB3C9">${e(x.tipo === 'breb' ? 'Llave Bre-B · ' + (x.entidad || '') : x.entidad || '')}</text>
    <text x="420" y="1122" text-anchor="middle" font-family="Space Grotesk,Inter,Arial,sans-serif" font-weight="700" font-size="44" fill="#22D3EE">${e(x.llave)}</text></svg>`;
}
