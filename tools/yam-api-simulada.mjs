// API de YAM SIMULADA para probar el módulo YAM del panel sin el servidor real.
// Implementa el contrato /api/cdh/* (docs/panel-admin.md §YAM) con datos en memoria.
//   node tools/yam-api-simulada.mjs                 → puerto 3999, llave «demo-llave»
//   node tools/yam-api-simulada.mjs --pendiente     → responde pendiente_migracion
//   node tools/yam-api-simulada.mjs --sin-llave     → 503 (CDH_PANEL_TOKEN sin configurar)
// En el panel: YAM → Configurar → URL http://localhost:3999, llave demo-llave.
import http from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';

const PUERTO = Number(process.env.PUERTO || 3999);
const LLAVE = process.argv.includes('--sin-llave') ? '' : (process.env.CDH_PANEL_TOKEN || 'demo-llave');
const PENDIENTE = process.argv.includes('--pendiente');
const ORIGENES = /^(https:\/\/(www\.)?cdhmaker\.com|https:\/\/cdh-maker-portafolio\.web\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const comercios = Array.from({ length: 23 }, (_, i) => ({ id: randomUUID(), nombre: `Comercio Demo ${i + 1}`, slug: `demo-${i + 1}`, ciudad: ['Medellín', 'Bogotá', 'Cali'][i % 3],
  creado: new Date(Date.now() - i * 5 * 864e5).toISOString(), activo: i % 4 !== 0, guias_30d: (i * 7) % 40, ventas_30d_cop: ((i * 13) % 20) * 150000, plan: i % 5 ? 'basico' : 'pro' }));
const campanas = [{ id: randomUUID(), nombre: 'Lanzamiento vitrina', comercio_id: null, tipo: 'cinta_cdh', titulo: 'Vende en YAM', texto: 'Tu tienda con envíos', imagen: null,
  url_destino: 'https://yam.cdhmaker.com/registro?ref=cdh-cinta', estado: 'activa', inicia: '2026-10-01', termina: '2026-11-30', presupuesto_cop: 300000, impresiones: 5400, clics: 162 }];
const afiliados = [{ id: randomUUID(), codigo: 'laura-mkt', nombre: 'Laura Demo', email: 'laura@demo.test', telefono: '', comision_pct: 20, estado: 'activo', referidos: 2, comisiones_pendientes_cop: 38000 }];

const igual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const leerCuerpo = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  const origen = req.headers.origin || '';
  const cab = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (ORIGENES.test(origen)) Object.assign(cab, { 'Access-Control-Allow-Origin': origen, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' });
  const enviar = (st, o) => { res.writeHead(st, cab); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, cab); return res.end(); }
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/cdh/')) return enviar(404, { error: 'no existe' });
  if (!LLAVE) return enviar(503, { error: 'CDH_PANEL_TOKEN no configurado' });
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!t || !igual(t, LLAVE)) return enviar(401, { error: 'llave inválida' });
  const ruta = url.pathname.slice('/api/cdh'.length);
  if (ruta === '/resumen') return enviar(200, { comercios: comercios.length, comercios_activos_30d: comercios.filter((c) => c.activo).length, guias_30d: 412, ventas_30d_cop: 18450000, campanas_activas: campanas.filter((c) => c.estado === 'activa').length, referidos_30d: 2 });
  if (ruta === '/comercios') {
    const b = (url.searchParams.get('buscar') || '').toLowerCase(), p = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
    const xs = comercios.filter((c) => !b || c.nombre.toLowerCase().includes(b));
    return enviar(200, { items: xs.slice((p - 1) * 10, p * 10), total: xs.length });
  }
  if (PENDIENTE && ['/campanas', '/afiliados', '/referidos'].some((r) => ruta.startsWith(r))) return enviar(200, { items: [], pendiente_migracion: true });
  if (ruta === '/campanas' && req.method === 'GET') return enviar(200, { items: campanas });
  if (ruta === '/campanas' && req.method === 'POST') { const c = { id: randomUUID(), impresiones: 0, clics: 0, ...(await leerCuerpo(req)) }; campanas.unshift(c); return enviar(201, c); }
  const m = /^\/campanas\/([\w-]+)$/.exec(ruta);
  if (m && req.method === 'PATCH') { const c = campanas.find((x) => x.id === m[1]); if (!c) return enviar(404, { error: 'campaña no existe' }); Object.assign(c, await leerCuerpo(req), { id: c.id }); return enviar(200, c); }
  if (ruta === '/afiliados' && req.method === 'GET') return enviar(200, { items: afiliados });
  if (ruta === '/afiliados' && req.method === 'POST') { const a = { id: randomUUID(), estado: 'activo', referidos: 0, comisiones_pendientes_cop: 0, ...(await leerCuerpo(req)) }; afiliados.push(a); return enviar(201, a); }
  if (ruta === '/referidos') return enviar(200, { items: url.searchParams.get('afiliado') === 'laura-mkt' ? [{ codigo: 'laura-mkt', comercio_id: comercios[1].id, comercio_nombre: comercios[1].nombre, registrado: '2026-10-10', primera_venta: '2026-10-14', comision_cop: 38000, estado: 'pendiente' }] : [] });
  enviar(404, { error: 'no existe' });
}).listen(PUERTO, () => console.log(`YAM simulada en http://localhost:${PUERTO} · llave: ${LLAVE || '(ninguna → 503)'}${PENDIENTE ? ' · pendiente_migracion' : ''}`));
