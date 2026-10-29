// CRM → Catálogo: los productos y servicios que CDH Maker publica en su web, con precio, imagen y
// descripción en español e inglés. Lo que se guarda aquí sale SOLO, sin tocar código:
//   · al instante en la cinta de la web, el chat y la página /catalogo (catalogo-vivo.js lee Firestore);
//   · en el HTML estático, el JSON-LD, llms.txt y el bot de Shorts en el siguiente deploy
//     (tools/build-i18n.mjs → cargarRemoto()). «Publicar ahora» lanza ese deploy desde aquí.
// Colecciones públicas de solo lectura (firestore.rules): catalogo/{id}, catalogo_imagenes/{id},
// catalogo_config/general. crm_catalogo (ítems del cotizador) sigue aparte y privada.
import { db, $app, esc, aviso, slug, nav, pestanas, kpi, sello } from './comun.js';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REPO = 'HenryStark866/cdh-maker-portafolio';
const FLUJO = 'publicar.yml';
const CATEGORIAS_BASE = [
  { id: 'consultoria', nombre: { es: 'Consultoría', en: 'Consulting' }, lema: { es: '', en: '' } },
  { id: 'software', nombre: { es: 'Software y SaaS a la medida', en: 'Custom software and SaaS' }, lema: { es: '', en: '' } },
  { id: 'ia', nombre: { es: 'Inteligencia artificial y automatización', en: 'AI and automation' }, lema: { es: '', en: '' } },
  { id: 'contenido', nombre: { es: 'Contenido en video (Shorts)', en: 'Short-form video content' }, lema: { es: '', en: '' } },
  { id: 'fabricacion', nombre: { es: 'Fabricación digital', en: 'Digital fabrication' }, lema: { es: '', en: '' } },
  { id: 'iot', nombre: { es: 'Electrónica e IoT', en: 'Electronics and IoT' }, lema: { es: '', en: '' } },
  { id: 'productos', nombre: { es: 'Productos propios (SaaS)', en: 'Our own products (SaaS)' }, lema: { es: '', en: '' } },
];

// ───────── datos ─────────
async function leerTodo() {
  const [items, conf] = await Promise.all([
    getDocs(collection(db, 'catalogo')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    getDoc(doc(db, 'catalogo_config', 'general')).then((d) => (d.exists() ? d.data() : {})),
  ]);
  const categorias = Array.isArray(conf.categorias) && conf.categorias.length ? conf.categorias : CATEGORIAS_BASE;
  const orden = Object.fromEntries(categorias.map((c, i) => [c.id, i]));
  items.sort((a, b) => (orden[a.cat] ?? 99) - (orden[b.cat] ?? 99) || (a.orden ?? 999) - (b.orden ?? 999));
  return { items, conf: { provisional: false, ...conf, categorias } };
}

// El mismo texto de precio que ven los visitantes (catalogo-vivo.js / tools/catalogo.mjs)
export function precioTexto(x, L = 'es') {
  const p = x.precio || {};
  if (p.gratis) return L === 'en' ? 'Free' : 'Gratis';
  if (p.texto && p.texto[L]) return p.texto[L];
  const usar = L === 'en' && typeof p.usd === 'number' ? { n: p.usd, cur: 'USD' } : typeof p.cop === 'number' ? { n: p.cop, cur: 'COP' } : null;
  if (!usar) return L === 'en' ? 'Quote on request' : 'A consultar';
  const monto = new Intl.NumberFormat(L === 'en' ? 'en-US' : 'es-CO', { style: 'currency', currency: usar.cur, currencyDisplay: L === 'en' ? 'code' : 'symbol', maximumFractionDigits: 0 }).format(usar.n);
  return `${p.desde ? (L === 'en' ? 'From ' : 'Desde ') : ''}${monto}${p.unidad && p.unidad[L] ? ' ' + p.unidad[L] : ''}`;
}

// Ítems del catálogo público para el cotizador (nombre, precio COP, unidad)
export async function itemsParaCotizar() {
  try {
    const s = await getDocs(collection(db, 'catalogo'));
    return s.docs.map((d) => d.data()).filter((x) => x.activo !== false && typeof x.precio?.cop === 'number')
      .map((x) => ({ nombre: x.nombre.es, precio: x.precio.cop, unidad: x.precio.unidad?.es || (x.cat === 'fabricacion' ? 'unidad' : 'proyecto'), tipo: x.cat === 'fabricacion' ? 'producto' : 'servicio' }));
  } catch { return []; }
}

// ───────── imágenes: se reducen en el navegador (sin Cloud Storage) ─────────
async function reducir(file, lado, calidad) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/webp', calidad);
}
// Grande (≤ 1280 px, < 900 KB para Firestore) y miniatura cuadrada para la cinta y el chat
async function prepararImagen(file) {
  let grande = await reducir(file, 1280, 0.82);
  for (const [lado, q] of [[1100, 0.75], [960, 0.7], [800, 0.65]]) { if (grande.length < 880000) break; grande = await reducir(file, lado, q); }
  if (grande.length >= 880000) throw new Error('La imagen sigue pesando demasiado; prueba con otra más liviana.');
  const img = await createImageBitmap(file);
  const s = Math.min(img.width, img.height);
  const cv = Object.assign(document.createElement('canvas'), { width: 96, height: 96 });
  cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
  return { grande, mini: cv.toDataURL('image/webp', 0.72) };
}

// ───────── vista ─────────
export async function vistaCatalogo([sub = '']) {
  nav('catalogo');
  if (sub === 'nuevo' || (sub && sub !== 'todos' && !sub.startsWith('cat:'))) return editor(sub);
  const { items, conf } = await leerTodo();
  const filtro = sub.startsWith('cat:') ? sub.slice(4) : '';
  const lista = filtro ? items.filter((x) => x.cat === filtro) : items;
  const activos = items.filter((x) => x.activo !== false);
  const nombreCat = (id) => conf.categorias.find((c) => c.id === id)?.nombre?.es || id;
  $app.innerHTML = `<div class="cab"><div><h1 class="titulo">Catálogo y precios</h1>
      <p class="bajada">Lo que cambies aquí sale al instante en la cinta, el chat y <a href="/catalogo" target="_blank" rel="noopener">/catalogo</a>; buscadores, asistentes de IA y el bot de Shorts lo ven en el siguiente deploy.</p></div>
      <a class="boton primario" href="#catalogo/nuevo">Nuevo producto o servicio</a></div>
    <div class="kpis">${kpi('Publicados', activos.length, 'cian')}${kpi('Ocultos', items.length - activos.length)}
      ${kpi('Recomendados', activos.filter((x) => x.destacado).length, 'ok')}${kpi('Sin imagen', activos.filter((x) => !x.mini).length, activos.some((x) => !x.mini) ? 'warn' : '')}</div>
    ${items.length ? '' : `<div class="card"><h2>El catálogo está vacío</h2><p>Carga los 17 productos y servicios que ya publica la web (con sus precios) y ajústalos desde aquí.</p>
      <div class="acciones"><button class="primario" id="sembrar">Cargar el catálogo inicial</button></div><div id="mSembrar"></div></div>`}
    ${pestanas('catalogo', [['todos', 'Todos', items.length], ...conf.categorias.map((c) => ['cat:' + c.id, c.nombre.es, items.filter((x) => x.cat === c.id).length])], filtro ? 'cat:' + filtro : 'todos')}
    <div class="card">${lista.length ? `<div class="tabla"><table><tr><th></th><th>Producto o servicio</th><th>Precio</th><th>Estado</th><th style="text-align:right">Orden</th></tr>
      ${lista.map((x) => `<tr class="fila" data-ir="${esc(x.id)}"><td style="width:52px">${x.mini ? `<img src="${esc(x.mini)}" alt="" width="40" height="40" style="border-radius:8px;display:block">` : '<span class="chip neutro">sin foto</span>'}</td>
        <td><b>${esc(x.nombre?.es)}</b>${x.destacado ? ' <span class="chip ok">recomendado</span>' : ''}<br><small class="suave">${esc(nombreCat(x.cat))} · ${esc(x.id)}</small></td>
        <td>${esc(precioTexto(x))}${typeof x.precio?.usd === 'number' ? `<br><small class="suave">${esc(precioTexto(x, 'en'))}</small>` : ''}</td>
        <td>${x.activo === false ? '<span class="chip neutro">oculto</span>' : '<span class="chip ok">publicado</span>'}</td><td style="text-align:right">${esc(x.orden ?? '')}</td></tr>`).join('')}</table></div>` : '<div class="vacio">No hay ítems en esta categoría.</div>'}</div>
    <div class="cols mitad">
      <div class="card"><h2>Publicación</h2>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="provisional" ${conf.provisional ? 'checked' : ''}> Mostrar el aviso «precios orientativos y provisionales»</label>
        <p class="suave">Apagado: los precios salen como definitivos (antes de impuestos). Hoy está ${conf.provisional ? '<b>encendido</b>' : '<b>apagado</b>'}.</p>
        <h3>Llevar los cambios al HTML, al JSON-LD y al bot</h3>
        <p class="suave">Corre el deploy de la web (GitHub Actions → <code>${FLUJO}</code>). También corre solo cada día a las 6:00.</p>
        <div class="acciones"><button class="primario" id="publicar">Publicar ahora</button><a class="boton" href="https://github.com/${REPO}/actions/workflows/${FLUJO}" target="_blank" rel="noopener">Ver despliegues ↗</a></div>
        <details style="margin-top:10px"><summary class="suave" style="cursor:pointer">Llave de GitHub para «Publicar ahora»</summary>
          <p class="suave">Un <i>fine-grained token</i> solo de <code>${REPO}</code> con permiso <b>Actions: Read and write</b>. Se guarda en <code>crm_config/github</code>, que solo leen los administradores.</p>
          <form id="fGithub"><input name="token" type="password" placeholder="github_pat_…" autocomplete="off"><div class="acciones"><button>Guardar llave</button></div></form></details>
        <div id="mPublicar"></div></div>
      <div class="card"><h2>Categorías</h2><p class="suave">El orden de esta lista es el de la web. La Consultoría va primero: la mayoría no sabe qué necesita.</p>
        <form id="fCats">${conf.categorias.map((c, i) => `<div class="sol"><div class="grid">
          <div><label>Id</label><input name="id" value="${esc(c.id)}" ${items.some((x) => x.cat === c.id) ? 'readonly' : ''} pattern="[a-z0-9-]{2,30}"></div>
          <div><label>Orden</label><input name="orden" type="number" value="${i + 1}"></div>
          <div><label>Nombre (es)</label><input name="nombre_es" value="${esc(c.nombre?.es)}"></div><div><label>Nombre (en)</label><input name="nombre_en" value="${esc(c.nombre?.en)}"></div></div>
          <label>Frase (es)</label><input name="lema_es" value="${esc(c.lema?.es)}"><label>Frase (en)</label><input name="lema_en" value="${esc(c.lema?.en)}"></div>`).join('')}
          <div class="acciones"><button class="primario">Guardar categorías</button><button type="button" id="otraCat">Agregar categoría</button></div></form><div id="mCats"></div></div>
    </div>`;

  $app.querySelectorAll('[data-ir]').forEach((tr) => tr.addEventListener('click', () => (location.hash = 'catalogo/' + encodeURIComponent(tr.dataset.ir))));
  document.getElementById('sembrar')?.addEventListener('click', sembrar);
  document.getElementById('provisional').addEventListener('change', async (e) => {
    await setDoc(doc(db, 'catalogo_config', 'general'), { provisional: e.target.checked, ...sello() }, { merge: true });
    aviso(document.getElementById('mPublicar'), e.target.checked ? 'Aviso encendido.' : 'Aviso apagado: los precios salen como definitivos.', 'ok');
  });
  document.getElementById('publicar').addEventListener('click', publicar);
  document.getElementById('fGithub').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = new FormData(e.target).get('token').trim();
    if (!t) return;
    await setDoc(doc(db, 'crm_config', 'github'), { token: t, repo: REPO, ...sello() }, { merge: true });
    e.target.reset();
    aviso(document.getElementById('mPublicar'), 'Llave guardada.', 'ok');
  });
  document.getElementById('otraCat').addEventListener('click', () => {
    const f = document.getElementById('fCats');
    f.querySelector('.acciones').insertAdjacentHTML('beforebegin', `<div class="sol"><div class="grid"><div><label>Id</label><input name="id" pattern="[a-z0-9-]{2,30}" required></div>
      <div><label>Orden</label><input name="orden" type="number" value="${f.querySelectorAll('.sol').length + 1}"></div><div><label>Nombre (es)</label><input name="nombre_es" required></div><div><label>Nombre (en)</label><input name="nombre_en"></div></div>
      <label>Frase (es)</label><input name="lema_es"><label>Frase (en)</label><input name="lema_en"></div>`);
  });
  document.getElementById('fCats').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cats = Array.from(e.target.querySelectorAll('.sol')).map((s) => {
      const v = (n) => s.querySelector(`[name=${n}]`).value.trim();
      return { id: slug(v('id')), orden: Number(v('orden')) || 99, nombre: { es: v('nombre_es'), en: v('nombre_en') || v('nombre_es') }, lema: { es: v('lema_es'), en: v('lema_en') || v('lema_es') } };
    }).filter((c) => c.id && c.nombre.es).sort((a, b) => a.orden - b.orden).map(({ orden, ...c }) => c);
    await setDoc(doc(db, 'catalogo_config', 'general'), { categorias: cats, ...sello() }, { merge: true });
    aviso(document.getElementById('mCats'), 'Categorías guardadas.', 'ok');
  });
}

// Primera carga: lo que hoy publica la web (catalogo.json del último deploy = tools/catalogo.mjs)
async function sembrar() {
  const m = document.getElementById('mSembrar');
  try {
    const r = await fetch('/catalogo.json', { cache: 'no-store' });
    const data = await r.json();
    const lote = writeBatch(db);
    data.items.forEach(({ precio_texto, imagen, ...x }, i) => lote.set(doc(db, 'catalogo', x.id), { ...x, activo: true, orden: (i + 1) * 10, ...sello(true) }));
    lote.set(doc(db, 'catalogo_config', 'general'), {
      provisional: !!data.provisional, categorias: (data.categorias || CATEGORIAS_BASE).map(({ id, nombre, lema }) => ({ id, nombre, lema: lema || { es: '', en: '' } })), ...sello(true),
    });
    await lote.commit();
    location.hash = 'catalogo/todos';
    await vistaCatalogo(['todos']);
  } catch (e) { console.error(e); aviso(m, 'No se pudo cargar: ' + esc(e.code || e.message), 'err'); }
}

async function publicar() {
  const m = document.getElementById('mPublicar');
  const cfg = await getDoc(doc(db, 'crm_config', 'github'));
  const t = cfg.exists() && cfg.data().token;
  if (!t) return aviso(m, 'Falta la llave de GitHub (abajo). Mientras tanto, la web se publica sola cada día a las 6:00, o con <code>firebase deploy --only hosting</code>.', 'warn');
  aviso(m, 'Lanzando el deploy…', 'info');
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${FLUJO}/dispatches`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (r.status !== 204) throw new Error(`GitHub respondió ${r.status}: ${(await r.text()).slice(0, 160)}`);
    aviso(m, 'Listo: el deploy arrancó. Tarda unos 2 minutos; el avance se ve en «Ver despliegues».', 'ok');
  } catch (e) { aviso(m, 'No se pudo lanzar: ' + esc(e.message), 'err'); }
}

// ───────── editor de un ítem ─────────
const lineas = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
async function editor(id) {
  const nuevo = id === 'nuevo';
  const { items, conf } = await leerTodo();
  const x = nuevo ? { activo: true, precio: { desde: true }, nombre: {}, para: {}, incluye: {}, plazo: {}, orden: (items.length + 1) * 10 } : items.find((i) => i.id === id);
  if (!x) { $app.innerHTML = '<div class="card"><div class="aviso err">Ese ítem no existe.</div><a href="#catalogo">Volver</a></div>'; return; }
  const p = x.precio || {};
  const modo = p.gratis ? 'gratis' : p.texto?.es ? 'texto' : typeof p.cop === 'number' ? 'cifra' : 'consultar';
  const v = (o, L) => esc(o?.[L] ?? '');
  $app.innerHTML = `<div class="cab"><div><h1 class="titulo">${nuevo ? 'Nuevo producto o servicio' : esc(x.nombre.es)}</h1><p class="bajada"><a href="#catalogo">← Catálogo</a>${nuevo ? '' : ` · <a href="/catalogo#${esc(x.id)}" target="_blank" rel="noopener">verlo en la web ↗</a>`}</p></div></div>
  <form id="fItem"><div class="cols mitad">
    <div class="card"><h2>Lo básico</h2>
      <div class="grid"><div><label>Categoría</label><select name="cat">${conf.categorias.map((c) => `<option value="${esc(c.id)}" ${c.id === x.cat ? 'selected' : ''}>${esc(c.nombre.es)}</option>`).join('')}</select></div>
        <div><label>Orden dentro de la categoría</label><input name="orden" type="number" value="${esc(x.orden ?? '')}"></div></div>
      <label>Nombre (es)</label><input name="nombre_es" value="${v(x.nombre, 'es')}" required maxlength="120">
      <label>Identificador (va en la URL: /catalogo#…)</label><input name="id" value="${esc(nuevo ? '' : x.id)}" ${nuevo ? '' : 'readonly'} pattern="[a-z0-9-]{2,40}" placeholder="se arma solo con el nombre">
      <label>Para quién es / qué resuelve (es)</label><textarea name="para_es" class="texto" maxlength="600" required>${v(x.para, 'es')}</textarea>
      <label>Qué incluye (es) — una línea por punto</label><textarea name="incluye_es" class="texto">${esc((x.incluye?.es || []).join('\n'))}</textarea>
      <label>Tiempo de entrega (es)</label><input name="plazo_es" value="${v(x.plazo, 'es')}" placeholder="1 a 2 semanas">
      <div class="acciones"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" name="activo" ${x.activo !== false ? 'checked' : ''}> Publicado</label>
        <label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" name="destacado" ${x.destacado ? 'checked' : ''}> Recomendado (sale primero en la cinta)</label></div>
    </div>
    <div class="card"><h2>Precio</h2>
      <div class="tabs">${[['cifra', 'Con cifra'], ['gratis', 'Gratis'], ['texto', 'Texto libre'], ['consultar', 'A consultar']].map(([k, n]) => `<label class="tab ${k === modo ? 'act' : ''}" style="cursor:pointer"><input type="radio" name="modo" value="${k}" ${k === modo ? 'checked' : ''} style="display:none">${n}</label>`).join('')}</div>
      <div data-modo="cifra"><div class="grid"><div><label>Colombia (COP)</label><input name="cop" type="number" min="0" step="1000" value="${esc(p.cop ?? '')}"></div>
        <div><label>Fuera de Colombia (USD)</label><input name="usd" type="number" min="0" step="1" value="${esc(p.usd ?? '')}"></div></div>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="desde" ${p.desde ? 'checked' : ''}> Es un precio «desde»</label>
        <div class="grid"><div><label>Unidad (es)</label><input name="unidad_es" value="${v(p.unidad, 'es')}" placeholder="al mes, por pieza…"></div><div><label>Unidad (en)</label><input name="unidad_en" value="${v(p.unidad, 'en')}" placeholder="per month…"></div></div></div>
      <div data-modo="texto"><label>Texto (es)</label><input name="texto_es" value="${v(p.texto, 'es')}" placeholder="2,5 % de las ventas pagadas"><label>Texto (en)</label><input name="texto_en" value="${v(p.texto, 'en')}"></div>
      <p class="aviso info" id="vistaPrecio"></p>
      <h2 style="margin-top:16px">Imagen</h2>
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap"><div id="vistaImg">${x.mini ? `<img src="${esc(x.mini)}" alt="" width="96" height="96" style="border-radius:12px">` : '<div class="vacio" style="width:120px">sin imagen</div>'}</div>
        <div style="flex:1;min-width:200px"><input type="file" id="archivo" accept="image/jpeg,image/png,image/webp"><p class="suave">Se reduce sola (≤ 1280 px, WebP). En la cinta sale la miniatura cuadrada; en /catalogo, la imagen completa en 16:9.</p>
        ${x.mini ? '<button type="button" class="mini peligro" id="quitarImg">Quitar imagen</button>' : ''}</div></div>
      <label>Enlace propio (opcional, https): para productos con su propia web</label><input name="url" value="${esc(x.url || '')}" placeholder="https://yam.cdhmaker.com">
      <label>Palabras con las que el chat lo reconoce (separadas por coma)</label><input name="claves" value="${esc((x.claves || []).join(', '))}">
    </div>
  </div>
  <div class="card"><h2>En inglés <small class="suave">(si lo dejas vacío, /en/catalog muestra el español)</small></h2><div class="cols mitad">
    <div><label>Name (en)</label><input name="nombre_en" value="${v(x.nombre, 'en')}" maxlength="120"><label>Who it's for (en)</label><textarea name="para_en" class="texto" maxlength="600">${v(x.para, 'en')}</textarea></div>
    <div><label>Includes (en) — one per line</label><textarea name="incluye_en" class="texto">${esc((x.incluye?.en || []).join('\n'))}</textarea><label>Timeline (en)</label><input name="plazo_en" value="${v(x.plazo, 'en')}"></div></div></div>
  <div class="acciones"><button class="primario">Guardar</button>${nuevo ? '' : '<button type="button" id="duplicar">Duplicar</button><button type="button" class="peligro" id="borrar">Borrar</button>'}</div><div id="mItem"></div></form>`;

  const f = document.getElementById('fItem');
  let imagen = null; // { grande, mini } nueva, o 'quitar'
  const leer = () => {
    const d = Object.fromEntries(new FormData(f));
    const n = (k) => (d[k] === '' || d[k] == null ? null : Number(d[k]));
    const precio = d.modo === 'gratis' ? { gratis: true }
      : d.modo === 'texto' ? { texto: { es: d.texto_es.trim(), en: d.texto_en.trim() || d.texto_es.trim() } }
      : d.modo === 'consultar' ? {}
      : { ...(n('cop') != null ? { cop: n('cop') } : {}), ...(n('usd') != null ? { usd: n('usd') } : {}), desde: !!d.desde,
        ...(d.unidad_es.trim() ? { unidad: { es: d.unidad_es.trim(), en: d.unidad_en.trim() || d.unidad_es.trim() } } : {}) };
    return {
      id: slug(d.id || d.nombre_es).slice(0, 40), cat: d.cat, orden: n('orden') ?? 999, activo: !!d.activo, destacado: !!d.destacado,
      nombre: { es: d.nombre_es.trim(), en: d.nombre_en.trim() || d.nombre_es.trim() },
      para: { es: d.para_es.trim(), en: d.para_en.trim() || d.para_es.trim() },
      incluye: { es: lineas(d.incluye_es), en: lineas(d.incluye_en).length ? lineas(d.incluye_en) : lineas(d.incluye_es) },
      plazo: { es: d.plazo_es.trim(), en: d.plazo_en.trim() || d.plazo_es.trim() },
      precio, url: d.url.trim(), claves: d.claves.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    };
  };
  const pintarModo = () => {
    const m = f.querySelector('[name=modo]:checked').value;
    f.querySelectorAll('[data-modo]').forEach((el) => el.classList.toggle('oculto', el.dataset.modo !== m));
    f.querySelectorAll('.tabs .tab').forEach((t) => t.classList.toggle('act', t.querySelector('input').checked));
    const y = leer();
    document.getElementById('vistaPrecio').innerHTML = `Así sale en la web: <b>${esc(precioTexto(y))}</b> · en inglés: <b>${esc(precioTexto(y, 'en'))}</b>`;
  };
  f.addEventListener('input', pintarModo);
  f.addEventListener('change', pintarModo);
  pintarModo();

  document.getElementById('archivo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      imagen = await prepararImagen(file);
      document.getElementById('vistaImg').innerHTML = `<img src="${imagen.mini}" alt="" width="96" height="96" style="border-radius:12px"><br><small class="suave">${Math.round(imagen.grande.length * 0.75 / 1024)} KB</small>`;
    } catch (err) { aviso(document.getElementById('mItem'), esc(err.message), 'err'); }
  });
  document.getElementById('quitarImg')?.addEventListener('click', () => { imagen = 'quitar'; document.getElementById('vistaImg').innerHTML = '<div class="vacio" style="width:120px">se quitará al guardar</div>'; });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('mItem');
    const y = leer();
    if (!/^[a-z0-9-]{2,40}$/.test(y.id)) return aviso(m, 'El identificador solo admite minúsculas, números y guiones (2 a 40).', 'err');
    if (y.url && !/^https:\/\//.test(y.url)) return aviso(m, 'El enlace debe empezar por https://', 'err');
    if (nuevo && items.some((i) => i.id === y.id)) return aviso(m, `Ya existe un ítem «${esc(y.id)}». Cambia el identificador.`, 'err');
    const { id: yid, ...datos } = y;
    try {
      const extra = {};
      if (imagen === 'quitar') {
        await deleteDoc(doc(db, 'catalogo_imagenes', yid));
        Object.assign(extra, { mini: '', imagen_v: '' });
      } else if (imagen) {
        const ver = Date.now().toString(36);
        await setDoc(doc(db, 'catalogo_imagenes', yid), { d: imagen.grande, v: ver, ...sello(true) });
        Object.assign(extra, { mini: imagen.mini, imagen_v: ver });
      }
      await setDoc(doc(db, 'catalogo', yid), { ...datos, ...extra, ...sello(nuevo) }, { merge: !nuevo });
      if (!nuevo) {
        // setDoc con merge no borra claves de un mapa: el precio se reescribe entero
        await setDoc(doc(db, 'catalogo', yid), { precio: datos.precio, actualizado: serverTimestamp() }, { mergeFields: ['precio', 'actualizado'] });
      }
      aviso(m, 'Guardado. Ya se ve en la cinta, el chat y /catalogo.', 'ok');
      if (nuevo) location.hash = 'catalogo/' + encodeURIComponent(yid);
    } catch (err) { console.error(err); aviso(m, 'No se pudo guardar: ' + esc(err.code || err.message), 'err'); }
  });
  document.getElementById('duplicar')?.addEventListener('click', async () => {
    const y = leer();
    const nid = slug(y.id + '-copia').slice(0, 40);
    const { id: _, ...datos } = y;
    await setDoc(doc(db, 'catalogo', nid), { ...datos, nombre: { ...datos.nombre, es: datos.nombre.es + ' (copia)' }, activo: false, mini: x.mini || '', ...sello(true) });
    location.hash = 'catalogo/' + encodeURIComponent(nid);
  });
  document.getElementById('borrar')?.addEventListener('click', async () => {
    if (!confirm(`¿Borrar «${x.nombre.es}» del catálogo? Si solo quieres dejar de mostrarlo, desmarca «Publicado».`)) return;
    await deleteDoc(doc(db, 'catalogo_imagenes', x.id)).catch(() => {});
    await deleteDoc(doc(db, 'catalogo', x.id));
    location.hash = 'catalogo';
  });
}
