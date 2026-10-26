// Arma un archivo de importación para el CRM (cdhmaker.com/crm → Importar), esquema cdhmaker.crm.importacion.v1.
// Uso: node tools/crm-expediente.mjs <datos.json> <salida.json> [archivo.pdf ...]
//   datos.json: { id, cliente: {...}, solicitudes: [...] } (sin archivos). Los archivos se adjuntan en base64.
// La salida lleva datos personales: guardarla en legal/clientes/<cliente>/ (fuera de git), nunca en public/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [datosPath, salida, ...adjuntos] = process.argv.slice(2);
if (!datosPath || !salida) { console.error('Uso: node tools/crm-expediente.mjs <datos.json> <salida.json> [archivos...]'); process.exit(1); }
const datos = JSON.parse(fs.readFileSync(datosPath, 'utf8'));
const MIME = { '.pdf': 'application/pdf', '.json': 'application/json', '.png': 'image/png', '.html': 'text/html' };
// Cada adjunto es "ruta" o "tipo=ruta" (tipo: contrato, cuenta, propuesta, registro…; por defecto "documento").
const archivos = adjuntos.map((arg) => {
  const [tipo, ruta] = arg.includes('=') ? arg.split(/=(.*)/s) : ['documento', arg];
  const bytes = fs.readFileSync(ruta);
  return { nombre: path.basename(ruta), tipo, mime: MIME[path.extname(ruta).toLowerCase()] || 'application/octet-stream',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') };
});
fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ esquema: 'cdhmaker.crm.importacion.v1', ...datos, archivos, generado: new Date().toISOString() }));
console.log('Listo:', path.resolve(salida), `(${archivos.length} archivos, ${(fs.statSync(salida).size / 1024).toFixed(0)} KB)`);
