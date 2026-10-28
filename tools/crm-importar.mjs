// Carga un expediente (cdhmaker.crm.importacion.v1) en el CRM desde la terminal, con la misma sesión
// de administrador que usa cdhmaker.com/crm (enlace de acceso al correo) y bajo las mismas reglas.
// Uso:
//   node tools/crm-importar.mjs --pedir <correo>                     → envía el enlace de acceso al correo
//   node tools/crm-importar.mjs <importacion.json> "<enlace del correo>" <correo>
import fs from 'node:fs';

const API = 'AIzaSyCmeLzxeK_TUHkmKu3G81oKyW6Bg3B-iS0'; // config web pública de cdh-maker-portafolio
const DOCS = 'https://firestore.googleapis.com/v1/projects/cdh-maker-portafolio/databases/(default)/documents';
const PARTE = 700000; // igual que public/crm/app.js
const args = process.argv.slice(2);

const post = async (url, body, token) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return j;
};

if (args[0] === '--pedir') {
  await post(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API}`, { requestType: 'EMAIL_SIGNIN', email: args[1], continueUrl: 'https://cdhmaker.com/crm', canHandleCodeInApp: true });
  console.log('Enlace enviado a', args[1]);
  process.exit(0);
}

const [archivo, enlace, correo] = args;
const oobCode = new URL(new URL(enlace).searchParams.get('link') || enlace).searchParams.get('oobCode') || new URL(enlace).searchParams.get('oobCode');
if (!oobCode) throw new Error('El enlace no trae oobCode');
const { idToken } = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${API}`, { email: correo, oobCode });

// JS -> valores de Firestore REST
const v = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (x instanceof Date) return { timestampValue: x.toISOString() };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(v) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
};
const ahora = { setToServerValue: 'REQUEST_TIME' };
const escribir = (ruta, datos, { merge = false, sello = [] } = {}) => post(`${DOCS}:commit`, { writes: [{
  update: { name: `projects/cdh-maker-portafolio/databases/(default)/documents/${ruta}`, fields: Object.fromEntries(Object.entries(datos).map(([k, y]) => [k, v(y)])) },
  ...(merge ? { updateMask: { fieldPaths: Object.keys(datos).map((k) => '`' + k + '`') } } : {}),
  updateTransforms: sello.map((fieldPath) => ({ fieldPath, ...ahora })),
}] }, idToken);
const listar = async (ruta) => {
  const r = await fetch(`${DOCS}/${ruta}?pageSize=300`, { headers: { authorization: 'Bearer ' + idToken } });
  return (await r.json()).documents || [];
};

const x = JSON.parse(fs.readFileSync(archivo, 'utf8'));
if (x.esquema !== 'cdhmaker.crm.importacion.v1') throw new Error('Esquema no reconocido');
const id = x.id;
await escribir(`crm_clientes/${id}`, { ...x.cliente, actualizado_por: correo }, { merge: true, sello: ['actualizado'] });
console.log('Cliente', id, 'actualizado');
for (const s of x.solicitudes || []) {
  await escribir(`crm_clientes/${id}/solicitudes/${s.id}`, { ...s, creado: new Date(s.creado || Date.now()) }, { merge: true });
  console.log('Solicitud', s.id);
}
const previos = new Set((await listar(`crm_clientes/${id}/archivos`)).map((d) => d.fields?.sha256?.stringValue));
for (const a of x.archivos || []) {
  if (previos.has(a.sha256)) { console.log('Ya estaba:', a.nombre); continue; }
  const aid = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const partes = Math.ceil(a.base64.length / PARTE) || 1;
  await escribir(`crm_clientes/${id}/archivos/${aid}`, { nombre: a.nombre, tipo: a.tipo, mime: a.mime, tamano: Buffer.from(a.base64, 'base64').length, sha256: a.sha256, partes, creado_por: correo }, { sello: ['creado'] });
  for (let n = 0; n < partes; n++) await escribir(`crm_clientes/${id}/archivos/${aid}/partes/${n}`, { d: a.base64.slice(n * PARTE, (n + 1) * PARTE) });
  console.log('Archivo', a.nombre, `(${partes} partes)`);
}
console.log('Listo: https://cdhmaker.com/crm#cliente/' + id);
