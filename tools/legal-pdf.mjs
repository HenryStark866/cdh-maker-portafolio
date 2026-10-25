// Genera el PDF de cada documento HTML de legal/ (o de la carpeta que se pase
// como argumento) usando Microsoft Edge sin interfaz. El PDF queda junto a su
// HTML, con el mismo nombre.
//
//   node tools/legal-pdf.mjs                         → todo legal/
//   node tools/legal-pdf.mjs legal/clientes/refricom → solo esa carpeta

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!EDGE) throw new Error('No se encontró Microsoft Edge');

const raiz = resolve(process.argv[2] || 'legal');

function htmls(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n.startsWith('_') ? [] : htmls(p);
    return n.endsWith('.html') ? [p] : [];
  });
}

for (const html of htmls(raiz)) {
  const pdf = html.replace(/\.html$/, '.pdf');
  execFileSync(EDGE, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' });
  console.log('✓', pdf.slice(process.cwd().length + 1));
}
