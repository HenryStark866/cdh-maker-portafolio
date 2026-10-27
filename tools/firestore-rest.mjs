// Utilidades mínimas para hablar con el EMULADOR de Firestore por REST, sin dependencias.
// Las usan tools/test-reglas.mjs y tools/sembrar-emulador.mjs. Nunca apuntan a producción.
export const PROYECTO = 'cdh-maker-portafolio';
export const BASE = 'http://127.0.0.1:8080';
export const RAIZ = `projects/${PROYECTO}/databases/(default)/documents`;

// Token sin firma que el emulador acepta (alg: none). En producción no serviría.
export function tokenDe({ email, uid = email.replace(/\W/g, ''), verificado = true }) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  return `${b({ alg: 'none', typ: 'JWT' })}.${b({
    iss: `https://securetoken.google.com/${PROYECTO}`, aud: PROYECTO, auth_time: ahora, iat: ahora, exp: ahora + 3600,
    sub: uid, user_id: uid, email, email_verified: verificado, firebase: { sign_in_provider: 'emailLink', identities: { email: [email] } },
  })}.`;
}

export function valor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}
export const campos = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)]));

const cab = (token) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });

// Crea (o reemplaza) un documento; `ahora` = lista de campos que toman la hora del servidor.
export async function escribir(ruta, datos, { token, ahora = [], soloSiNoExiste = false } = {}) {
  const r = await fetch(`${BASE}/v1/${RAIZ}:commit`, {
    method: 'POST', headers: cab(token),
    body: JSON.stringify({ writes: [{
      update: { name: `${RAIZ}/${ruta}`, fields: campos(datos) },
      ...(soloSiNoExiste ? { currentDocument: { exists: false } } : {}),
      ...(ahora.length ? { updateTransforms: ahora.map((f) => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' })) } : {}),
    }] }),
  });
  return r.status;
}
export async function leer(ruta, token) {
  const r = await fetch(`${BASE}/v1/${RAIZ}/${ruta}`, { headers: cab(token) });
  return r.status;
}
export async function borrar(ruta, token) {
  const r = await fetch(`${BASE}/v1/${RAIZ}/${ruta}`, { method: 'DELETE', headers: cab(token) });
  return r.status;
}
export async function vaciar() {
  const r = await fetch(`${BASE}/emulator/v1/${RAIZ}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('No se pudo vaciar el emulador (¿está corriendo?): ' + r.status);
}
// Escritura de administrador del emulador (se salta las reglas): para sembrar datos.
export const DUENO = 'owner';
