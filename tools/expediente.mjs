#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/expediente.mjs
   Prepara y consulta los expedientes del portal de firma (public/firma.html).

   Un expediente es una carpeta de legal/clientes/<cliente>/ con:
     expediente.json   configuración: cliente, documentos, resúmenes y video
     *.html            los documentos, con la hoja legal/_base/documento.css
     .acceso.json      (lo crea este script) token del enlace y código

   Uso:
     node tools/expediente.mjs crear  legal/clientes/refricom   cifra y publica
     node tools/expediente.mjs crear  legal/clientes/refricom --nuevo-codigo
     node tools/expediente.mjs estado legal/clientes/refricom   lecturas y firmas
     node tools/expediente.mjs anular legal/clientes/refricom   borra el paquete

   "crear" escribe public/e/<token>.json (y el video, si hay archivo), que
   Firebase Hosting publica en el próximo deploy. public/e/ está en
   .gitignore: el repo es público y estos archivos son del cliente. Aunque el
   paquete se publica, está cifrado con AES-256-GCM y una clave PBKDF2 de
   600 000 iteraciones derivada del código + token: sin el código, que se
   envía por otro canal, no se puede leer.

   OJO: una vez el cliente lee o firma, NO vuelva a correr "crear" con
   cambios en los documentos: la huella cambia y la firma ya hecha queda
   asociada a la versión anterior. Para corregir, emita una versión nueva con
   --nuevo-codigo (expediente nuevo, firmas desde cero).
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { webcrypto as crypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = "https://cdhmaker.com";
const FS = "https://firestore.googleapis.com/v1/projects/cdh-maker-portafolio/databases/(default)/documents";
const ITER = 600000;
// Mismos ids que firma.js (REQUERIDOS) y firestore.rules ("condiciones")
const REQUERIDOS = ["contrato", "firmaelec", "privacidad"];

const [, , cmd, carpetaArg, ...flags] = process.argv;
if (!cmd || !carpetaArg) {
  console.log("Uso: node tools/expediente.mjs <crear|estado|anular> <carpeta> [--nuevo-codigo]");
  process.exit(1);
}
const carpeta = path.resolve(ROOT, carpetaArg);
const conf = JSON.parse(fs.readFileSync(path.join(carpeta, "expediente.json"), "utf8"));
const rutaAcceso = path.join(carpeta, ".acceso.json");

const b64 = (u8) => Buffer.from(u8).toString("base64");
const b64url = (u8) => Buffer.from(u8).toString("base64url");
const sha256 = async (t) => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))).toString("hex");
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O, 1/I/L
function codigoNuevo() {
  // Rechazo de sesgo: solo bytes < 248 (8 × 31) se reparten parejo
  let c = "";
  while (c.length < 8) {
    const [b] = crypto.getRandomValues(new Uint8Array(1));
    if (b < 248) c += ALFABETO[b % 31];
  }
  return c;
}
const verCodigo = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;

function acceso({ nuevo = false } = {}) {
  if (!nuevo && fs.existsSync(rutaAcceso)) return JSON.parse(fs.readFileSync(rutaAcceso, "utf8"));
  const a = { token: b64url(crypto.getRandomValues(new Uint8Array(24))), codigo: codigoNuevo(), creado: new Date().toISOString() };
  fs.writeFileSync(rutaAcceso, JSON.stringify(a, null, 2));
  return a;
}

function cuerpo(archivo) {
  const html = fs.readFileSync(path.resolve(carpeta, archivo), "utf8");
  const m = html.match(/<main class="hoja[^"]*">([\s\S]*?)<\/main>/);
  if (!m) throw new Error(`${archivo}: no tiene <main class="hoja">`);
  return m[1].trim();
}

async function crear() {
  const nuevo = flags.includes("--nuevo-codigo");
  const anterior = fs.existsSync(rutaAcceso) ? JSON.parse(fs.readFileSync(rutaAcceso, "utf8")) : null;
  const a = acceso({ nuevo });
  fs.mkdirSync(path.join(ROOT, "public", "e"), { recursive: true });
  if (nuevo && anterior) fs.rmSync(path.join(ROOT, "public", "e", `${anterior.token}.json`), { force: true });

  const ids = conf.documentos.map((d) => d.id);
  const faltan = REQUERIDOS.filter((id) => !ids.includes(id));
  if (faltan.length) throw new Error(`Faltan documentos obligatorios para el paso de condiciones: ${faltan.join(", ")}`);

  let avisos = 0;
  const documentos = [];
  for (const d of conf.documentos) {
    const html = cuerpo(d.archivo);
    const vacios = [...html.matchAll(/<span class="campo[^"]*"[^>]*data-pista="([^"]*)"[^>]*>&nbsp;<\/span>/g)].map((x) => x[1] || "(sin pista)");
    if (vacios.length) {
      avisos += vacios.length;
      console.warn(`⚠ ${d.archivo}: ${vacios.length} campo(s) sin completar → ${vacios.join(" · ")}`);
    }
    documentos.push({ id: d.id, titulo: d.titulo, rol: d.rol, resumen: d.resumen || [], html, sha256: await sha256(html) });
  }

  let video = null;
  if (conf.video?.archivo) {
    const origen = path.resolve(carpeta, conf.video.archivo);
    const destino = `${a.token}-video${path.extname(origen)}`;
    fs.copyFileSync(origen, path.join(ROOT, "public", "e", destino));
    video = { tipo: "archivo", src: `/e/${destino}`, titulo: conf.video.titulo };
  } else if (conf.video?.url) {
    video = { tipo: "url", src: conf.video.url, titulo: conf.video.titulo };
  }

  const paquete = {
    v: 1,
    expediente: conf.expediente,
    emitido: new Date().toISOString(),
    proyecto: conf.proyecto,
    cliente: conf.cliente,
    proveedor: conf.proveedor,
    video,
    css: fs.readFileSync(path.join(ROOT, "legal", "_base", "documento.css"), "utf8"),
    documentos,
  };

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${a.codigo}:${a.token}`), "PBKDF2", false, ["deriveKey"]);
  const clave = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, new TextEncoder().encode(JSON.stringify(paquete)));

  fs.mkdirSync(path.join(ROOT, "public", "e"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "public", "e", `${a.token}.json`),
    JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));

  // Registro local de huellas: permite probar después qué versión se firmó
  const huellas = path.join(carpeta, "huellas.json");
  const hist = fs.existsSync(huellas) ? JSON.parse(fs.readFileSync(huellas, "utf8")) : [];
  hist.push({ emitido: paquete.emitido, token: a.token.slice(0, 6) + "…", documentos: Object.fromEntries(documentos.map((d) => [d.id, d.sha256])) });
  fs.writeFileSync(huellas, JSON.stringify(hist, null, 2));

  console.log(`\n✓ Expediente ${conf.expediente} cifrado → public/e/${a.token}.json`);
  if (avisos) console.log(`⚠ Quedan ${avisos} campos en blanco. Complételos antes de enviar el enlace.`);
  console.log(`\n  Enlace:  ${SITIO}/firma#${a.token}`);
  console.log(`  Código:  ${verCodigo(a.codigo)}   (envíelo por OTRO canal, p. ej. WhatsApp)`);
  console.log(`  Prueba local: http://localhost:5055/firma?local#${a.token}`);
  console.log(`\n  Falta publicar: firebase deploy --only hosting\n`);
}

async function estado() {
  const a = JSON.parse(fs.readFileSync(rutaAcceso, "utf8"));
  const exp = await sha256(`${a.token}:${a.codigo}`);
  const r = await fetch(`${FS}/firmas/${exp}/eventos?pageSize=100`);
  if (!r.ok) throw new Error(`Firestore respondió ${r.status}: ${await r.text()}`);
  const docs = (await r.json()).documents || [];
  const v = (f) => f?.stringValue ?? f?.booleanValue ?? f?.timestampValue ?? "";
  console.log(`Expediente ${conf.expediente} — ${docs.length} evento(s)\n`);
  const hist = fs.existsSync(path.join(carpeta, "huellas.json")) ? JSON.parse(fs.readFileSync(path.join(carpeta, "huellas.json"), "utf8")) : [];
  const vigentes = hist.at(-1)?.documentos || {};
  for (const d of docs.sort((x, y) => v(x.fields.at).localeCompare(v(y.fields.at)))) {
    const f = d.fields;
    const id = d.name.split("/").pop();
    const hora = new Date(v(f.at)).toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const quien = f.nombre ? ` — ${v(f.nombre)} (C.C. ${v(f.cedula)})` : "";
    const huella = f.sha256 ? (v(f.sha256) === vigentes[v(f.doc)] ? " ✓ huella vigente" : " ⚠ huella de otra versión") : "";
    const ref = id === "condiciones" ? ` — referencia comercial: ${v(f.referencia) ? "SÍ autoriza" : "no autoriza"}` : "";
    console.log(`  ${hora}  ${id.padEnd(18)}${quien}${huella}${ref}`);
  }
}

function anular() {
  const a = JSON.parse(fs.readFileSync(rutaAcceso, "utf8"));
  fs.rmSync(path.join(ROOT, "public", "e", `${a.token}.json`), { force: true });
  console.log(`✓ Paquete borrado. El enlace dejará de funcionar tras: firebase deploy --only hosting`);
  console.log("  Los eventos ya registrados en Firestore se conservan como prueba.");
}

const acciones = { crear, estado, anular };
if (!acciones[cmd]) { console.error(`Comando desconocido: ${cmd}`); process.exit(1); }
await acciones[cmd]();
