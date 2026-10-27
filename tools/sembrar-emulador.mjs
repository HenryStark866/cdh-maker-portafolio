// Siembra datos de DEMOSTRACIÓN en el emulador de Firestore para probar el panel (/crm?emu).
//   firebase emulators:start      (en otra terminal)
//   node tools/sembrar-emulador.mjs
// Solo habla con 127.0.0.1:8080 (emulador). Todos los nombres llevan «Demo» para no confundirlos.
import { escribir, vaciar, DUENO } from './firestore-rest.mjs';

const dias = (n) => new Date(Date.now() - n * 864e5);
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const w = (ruta, datos) => escribir(ruta, datos, { token: DUENO }).then((s) => { if (s !== 200) throw new Error(ruta + ' → ' + s); });

await vaciar();
await w('crm_afiliados/laura-mkt', { codigo: 'laura-mkt', nombre: 'Laura Demo (agencia de marketing)', comision_pct: 10, estado: 'activo', canal: 'agencia', email: 'laura@demo.test', creado: dias(40) });
await w('crm_afiliados/contador-pao', { codigo: 'contador-pao', nombre: 'Paola Demo (contadora)', comision_pct: 12, estado: 'activo', canal: 'contador', creado: dias(20) });

const leads = [
  { origen: 'web_widget', estado: 'nuevo', ref: 'laura-mkt', ref_ts: Date.now() - 3 * 864e5, pagina: '/', idioma: 'es', servicio: '', creado: dias(1) },
  { origen: 'web_cotizador', estado: 'nuevo', ref: null, pagina: '/servicios/desarrollo-web-medellin', idioma: 'es', servicio: 'Desarrollo web y software', creado: dias(2) },
  { origen: 'web_whatsapp', estado: 'nuevo', ref: 'contador-pao', pagina: '/en', idioma: 'en', servicio: '', creado: dias(5) },
  { origen: 'manual', estado: 'contactado', nombre: 'Ferretería Demo', telefono: '300 000 0000', servicio: 'web', ref: null, notas: 'Quiere tienda en línea', creado: dias(9) },
  { origen: 'referido', estado: 'convertido', nombre: 'Clínica Demo', servicio: 'saas', ref: 'laura-mkt', creado: dias(25), oportunidad_id: 'op-clinica' },
  { origen: 'web_visor3d', estado: 'descartado', ref: null, pagina: '/', idioma: 'es', servicio: '', creado: dias(40) },
];
for (const [i, l] of leads.entries()) await w('crm_leads/demo-' + i, l);

const ops = [
  ['op-ferre', { titulo: 'Ferretería Demo · tienda web', etapa: 'contactado', valor_cop: 3500000, servicio: 'web', contacto: 'Don Mario', afiliado: null, lead_id: 'demo-3' }],
  ['op-clinica', { titulo: 'Clínica Demo · agenda SaaS', etapa: 'ganado', valor_cop: 8000000, servicio: 'saas', contacto: 'Dra. Ruiz', afiliado: 'laura-mkt', cliente_id: 'clinica-demo', cerrado: dias(15) }],
  ['op-taller', { titulo: 'Taller Demo · piezas en impresión 3D', etapa: 'propuesta', valor_cop: 1200000, servicio: 'fabricacion', contacto: 'Andrés' }],
  ['op-agro', { titulo: 'Agro Demo · sensores IoT', etapa: 'negociacion', valor_cop: 6500000, servicio: 'iot', contacto: 'Camila', afiliado: 'contador-pao', cierre_estimado: iso(10) }],
  ['op-nuevo', { titulo: 'Colegio Demo · página institucional', etapa: 'nuevo', valor_cop: 2500000, servicio: 'web' }],
  ['op-perdida', { titulo: 'Restaurante Demo · menú QR', etapa: 'perdido', valor_cop: 900000, servicio: 'web', motivo_perdida: 'Precio', cerrado: dias(30) }],
];
for (const [id, o] of ops) await w('crm_oportunidades/' + id, { creado: dias(20), actualizado: dias(3), ...o });

await w('crm_clientes/clinica-demo', { nombre: 'Clínica Demo', proyecto: 'Agenda SaaS', valor_total: 8000000, estado: 'activo', afiliado: 'laura-mkt', correo: 'demo@clinica.test',
  cuotas: [{ n: 1, fecha: iso(-14), valor: 4000000, estado: 'pagada', fecha_pago: iso(-13), referencia: 'Transferencia' }, { n: 2, fecha: iso(16), valor: 4000000, estado: 'pendiente' }], creado: dias(15) });
await w('crm_clientes/refri-demo', { nombre: 'Refrigeración Demo', proyecto: 'Sitio y cotizador', valor_total: 3000000, estado: 'activo',
  cuotas: [{ n: 1, fecha: iso(-40), valor: 1500000, estado: 'pagada', fecha_pago: iso(-40) }, { n: 2, fecha: iso(-5), valor: 1500000, estado: 'pendiente' }], creado: dias(60) });

await w('crm_proyectos/p-clinica', { nombre: 'Agenda SaaS Clínica Demo', cliente_id: 'clinica-demo', servicio: 'saas', estado: 'en_curso', url_produccion: 'https://clinica-demo.example', inicio: iso(-14), entrega_estimada: iso(30), oportunidad_id: 'op-clinica' });
await w('crm_proyectos/p-refri', { nombre: 'Sitio Refrigeración Demo', cliente_id: 'refri-demo', servicio: 'web', estado: 'soporte', url_produccion: 'https://refri-demo.example', entregado: iso(-20) });
await w('crm_proyectos/p-yam', { nombre: 'YAM (producto propio)', cliente_id: null, servicio: 'saas', estado: 'en_curso', url_produccion: 'https://yam.cdhmaker.com' });

await w('crm_actividades/a1', { entidad: 'oportunidad', entidad_id: 'op-agro', tipo: 'llamada', texto: 'Pidió ajustar el número de sensores a 12.', creado: dias(2), creado_por: 'henrytaborda57@gmail.com' });
console.log('Datos de demostración sembrados en el emulador.');
