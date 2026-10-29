#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   CDH MAKER — tools/sync-shorts.mjs
   Lee el feed RSS público del canal de YouTube (los Shorts que publica el
   bot ClipFactory) y escribe public/media/shorts.json, que consume la cinta
   de la portada (public/ads.js).

   - Solo entran los Shorts (enlace /shorts/<id>); los videos largos no.
   - Sin dependencias (Node ≥ 18, fetch nativo). No usa la API de YouTube ni
     llaves: el feed es público (los ~15 videos más recientes del canal).
   - Cada Short lleva "embed": si YouTube permite insertarlo (oEmbed 200).
     Los que no, la cinta los abre en youtube.com en vez del visor.
   - Si el feed falla (sin red, YouTube caído), NO se borra el JSON que ya
     existe: se avisa y se sale con código 0 para no frenar el deploy.
   - "servicio": si la descripción del Short enlaza a un producto del
     catálogo (cdhmaker.com/catalogo#<id> o /en/catalog#<id>, lo escribe
     ClipFactory al subirlo), la cinta muestra a qué servicio lleva. Así el
     bot "publica" en la cinta sin llaves ni servidores: basta el deploy.

   Uso:  node tools/sync-shorts.mjs
   Lo corre firebase.json → hosting.predeploy, antes de build-i18n.
   ───────────────────────────────────────────────────────────────────────────
   Autor:    Ing. Henry Taborda — CDH Maker (Medellín, Colombia)
   ═══════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHANNEL_ID = "UCrVy83mH6KNwWZpF5OjPibg";
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const MAX = 24;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "media", "shorts.json");

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : "";
};

async function main() {
  let xml;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(FEED, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    console.warn(`⚠ sync-shorts: no se pudo leer el feed (${e.message}); se conserva ${path.relative(ROOT, OUT)}.`);
    return;
  }

  const shorts = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = tag(entry, "yt:videoId");
    const link = (entry.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || "";
    if (!/^[\w-]{11}$/.test(id) || !link.includes("/shorts/")) continue;
    const desc = tag(entry, "media:description");
    const servicio = (desc.match(/cdhmaker\.com\/(?:catalogo|en\/catalog)#([a-z0-9-]{2,40})/i) || [])[1];
    shorts.push({
      id,
      ...(servicio ? { servicio: servicio.toLowerCase() } : {}),
      titulo: tag(entry, "title"),
      fecha: tag(entry, "published"),
      url: `https://www.youtube.com/shorts/${id}`,
    });
  }
  shorts.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  // ¿Se puede insertar? Si el video se subió con "permitir inserción"
  // apagado, el embed muestra "Video no disponible": el oEmbed público de
  // YouTube responde 401 en ese caso. La cinta abre esos en YouTube.
  await Promise.all(shorts.map(async (s) => {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(s.url)}`, { method: "GET" });
      s.embed = r.ok;
    } catch {
      s.embed = false;
    }
  }));

  if (!shorts.length) {
    console.warn("⚠ sync-shorts: el feed no trajo Shorts; se conserva el JSON anterior.");
    return;
  }
  const data = {
    canal: `https://www.youtube.com/channel/${CHANNEL_ID}`,
    generado: new Date().toISOString(),
    shorts: shorts.slice(0, MAX),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  const noEmbed = data.shorts.filter((s) => !s.embed).length;
  console.log(`✓ sync-shorts: ${data.shorts.length} Shorts en ${path.relative(ROOT, OUT)}` +
    (noEmbed ? ` (${noEmbed} con la inserción desactivada en YouTube: se abren en youtube.com).` : "."));
}

main();
