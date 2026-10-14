#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/indexnow.mjs
   Avisa a Bing (y a Yandex, Naver, Seznam…) que las páginas cambiaron.

   Por qué importa: ChatGPT (búsqueda), Copilot y DuckDuckGo responden con el
   índice de Bing. IndexNow le dice a Bing "vuelve a leer estas URLs" en
   minutos, en vez de esperar a que pase solo.

   Uso, DESPUÉS de `firebase deploy` (la clave tiene que estar ya publicada):
       node tools/indexnow.mjs
   La clave vive en public/<clave>.txt y se publica con el resto del sitio.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   Contacto: cdhmaker@gmail.com
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");

// Las URLs salen del sitemap generado: una sola fuente de verdad
const sitemap = fs.readFileSync(path.join(PUB, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
urls.push(new URL("/llms.txt", urls[0]).href);
const host = new URL(urls[0]).host;

const keyFile = fs.readdirSync(PUB).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("No hay archivo de clave IndexNow (public/<32 hex>.txt)");
const key = keyFile.replace(".txt", "");

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${keyFile}`, urlList: urls }),
});
// 200 = recibido; 202 = recibido, la clave se valida después
console.log(`IndexNow → ${res.status} ${res.statusText} (${urls.length} URLs de ${host})`);
if (res.status >= 400) process.exit(1);
