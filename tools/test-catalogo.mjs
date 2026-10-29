#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/test-catalogo.mjs
   Prueba el catálogo del CRM contra los EMULADORES de Firebase (nunca contra
   producción): reglas de catalogo/, catalogo_imagenes/ y catalogo_config/, y
   que el build publique lo que hay en el CRM (con su imagen).

   Uso (con los emuladores de Auth y Firestore arriba):
     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node tools/test-catalogo.mjs
   Borra los datos del emulador al empezar.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AU = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AU) {
  console.error("✗ Faltan FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST: esta prueba solo corre contra los emuladores.");
  process.exit(2);
}
const P = "cdh-maker-portafolio";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = `http://${FS}/v1/projects/${P}/databases/(default)/documents`;
let fallos = 0;
const ok = (cond, txt) => { console.log(`${cond ? "✓" : "✗"} ${txt}`); if (!cond) fallos++; };

// Valores de Firestore REST
const enc = (v) => (v === null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } });
const campos = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));

async function usuario(email, verificado) {
  const r = await fetch(`http://${AU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "prueba-123", returnSecureToken: true }) }).then((x) => x.json());
  if (verificado) {
    await fetch(`http://${AU}/identitytoolkit.googleapis.com/v1/projects/${P}/accounts:update`, {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ localId: r.localId, emailVerified: true }) });
    const s = await fetch(`http://${AU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=x`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "prueba-123", returnSecureToken: true }) }).then((x) => x.json());
    return s.idToken;
  }
  return r.idToken;
}
const escribir = (ruta, datos, token) => fetch(`${DOCS}/${ruta}`, {
  method: "PATCH", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ fields: campos(datos) }) }).then((r) => r.status);
const leer = (ruta) => fetch(`${DOCS}/${ruta}`).then((r) => r.status);

const ITEM = {
  cat: "consultoria", orden: 10, activo: true, destacado: true,
  nombre: { es: "Diagnóstico de prueba", en: "Test diagnosis" }, para: { es: "Para probar el CRM.", en: "To test the CRM." },
  incluye: { es: ["Uno", "Dos"], en: ["One", "Two"] }, plazo: { es: "1 día", en: "1 day" },
  precio: { cop: 123000, usd: 40, desde: true }, url: "", claves: ["prueba"], imagen_v: "v1",
  mini: "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
};
// PNG 1×1 válido
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

await fetch(`http://${FS}/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
const admin = await usuario("cdhmaker@gmail.com", true);
const sinVerificar = await usuario("henrytaborda57@gmail.com", false);
const extrano = await usuario("alguien@example.com", true);

console.log("— reglas");
ok(await escribir("catalogo/diagnostico-prueba", ITEM) === 403, "sin sesión no se escribe el catálogo");
ok(await escribir("catalogo/diagnostico-prueba", ITEM, extrano) === 403, "un correo que no es administrador no escribe");
ok(await escribir("catalogo/diagnostico-prueba", ITEM, sinVerificar) === 403, "un administrador sin correo verificado no escribe");
ok(await escribir("catalogo/diagnostico-prueba", ITEM, admin) === 200, "el administrador escribe un ítem válido");
ok(await escribir("catalogo/Con-Mayus", ITEM, admin) === 403, "id con mayúsculas: rechazado");
ok(await escribir("catalogo/malo", { ...ITEM, url: "javascript:alert(1)" }, admin) === 403, "enlace que no es https: rechazado");
ok(await escribir("catalogo/malo", { ...ITEM, nombre: { es: "" } }, admin) === 403, "sin nombre: rechazado");
ok(await escribir("catalogo_imagenes/diagnostico-prueba", { d: PNG, v: "v1" }, admin) === 200, "el administrador sube la imagen");
ok(await escribir("catalogo_imagenes/x", { d: "data:text/html;base64,PGI+" }, admin) === 403, "una imagen que no es imagen: rechazada");
ok(await escribir("catalogo_config/general", { provisional: false, categorias: [{ id: "consultoria", nombre: { es: "Consultoría", en: "Consulting" }, lema: { es: "Lema", en: "Motto" } }] }, admin) === 200, "el administrador guarda la configuración");
ok(await escribir("catalogo_config/otra", { x: 1 }, admin) === 403, "solo existe catalogo_config/general");
ok(await leer("catalogo/diagnostico-prueba") === 200 && await leer("catalogo_imagenes/diagnostico-prueba") === 200 && await leer("catalogo_config/general") === 200, "cualquiera lee el catálogo, la imagen y la configuración");
ok(await leer("crm_config/github") === 403, "la llave de GitHub (crm_config) sigue siendo privada");

console.log("— build con el catálogo del CRM");
const salida = execFileSync(process.execPath, [path.join(ROOT, "tools", "build-i18n.mjs")], { cwd: ROOT, env: process.env, encoding: "utf8" });
ok(/catálogo: CRM \(1 ítems\)/.test(salida), "el build lee el catálogo del CRM");
const json = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "catalogo.json"), "utf8"));
ok(json.items.length === 1 && json.items[0].id === "diagnostico-prueba" && json.provisional === false, "catalogo.json = lo del CRM");
ok(json.items[0].precio_texto.es.replace(/\s/g, " ") === "Desde $ 123.000", `precio armado: ${json.items[0].precio_texto.es}`);
const img = path.join(ROOT, "public", "media", "catalogo", "diagnostico-prueba-v1.png");
ok(fs.existsSync(img) && json.items[0].imagen === "/media/catalogo/diagnostico-prueba-v1.png", "la imagen sale como archivo y el ítem apunta a ella");
const html = fs.readFileSync(path.join(ROOT, "public", "catalogo.html"), "utf8");
ok(html.includes("Diagnóstico de prueba") && html.includes("/media/catalogo/diagnostico-prueba-v1.png") && !html.includes("Hoja de ruta tecnológica"), "/catalogo muestra solo lo del CRM, con su imagen");
ok(html.includes('"image":"https://cdhmaker.com/media/catalogo/diagnostico-prueba-v1.png"'), "el JSON-LD lleva la imagen");
ok(/Motto/.test(fs.readFileSync(path.join(ROOT, "public", "en", "catalog.html"), "utf8")), "/en/catalog usa las categorías del CRM");

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron.` : "\n✓ Todo en orden. (El build dejó public/ con datos de prueba: correr node tools/build-i18n.mjs --sin-crm o contra producción antes de commitear.)");
process.exit(fallos ? 1 : 0);
