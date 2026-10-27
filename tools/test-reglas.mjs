// Pruebas de firestore.rules contra el emulador (sin dependencias: node:test + fetch).
//   1) firebase emulators:start   (requiere Java; ver docs/panel-admin.md §Pruebas)
//   2) node --test tools/test-reglas.mjs
// El emulador recarga firestore.rules al guardar, así que se puede iterar sin reiniciarlo.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { tokenDe, escribir, leer, borrar, vaciar, DUENO } from './firestore-rest.mjs';

const ADMIN = tokenDe({ email: 'henrytaborda57@gmail.com' });
const ADMIN_SIN_VERIFICAR = tokenDe({ email: 'cdhmaker@gmail.com', verificado: false });
const EXTRANO = tokenDe({ email: 'alguien@ejemplo.com' });
const OK = 200, NO = 403;

const leadWeb = (extra = {}) => ({ origen: 'web_widget', estado: 'nuevo', ref: 'juanp', ref_ts: Date.now(), pagina: '/', idioma: 'es', servicio: '', ...extra });

before(vaciar);

test('anónimo crea un lead mínimo válido', async () => {
  assert.equal(await escribir('crm_leads/a1', leadWeb(), { ahora: ['creado'], soloSiNoExiste: true }), OK);
  assert.equal(await escribir('crm_leads/a2', leadWeb({ ref: null, ref_ts: null }), { ahora: ['creado'] }), OK);
});

test('anónimo NO puede leer, editar ni borrar leads', async () => {
  assert.equal(await leer('crm_leads/a1'), NO);
  assert.equal(await escribir('crm_leads/a1', leadWeb({ estado: 'nuevo' }), { ahora: ['creado'] }), NO); // ya existe → update
  assert.equal(await borrar('crm_leads/a1'), NO);
  assert.equal(await leer('crm_leads/a1', EXTRANO), NO);
});

test('anónimo NO puede meter datos personales ni campos raros', async () => {
  assert.equal(await escribir('crm_leads/b1', leadWeb({ email: 'x@y.com' }), { ahora: ['creado'] }), NO);
  assert.equal(await escribir('crm_leads/b2', leadWeb({ estado: 'convertido' }), { ahora: ['creado'] }), NO);
  assert.equal(await escribir('crm_leads/b3', leadWeb({ origen: 'manual' }), { ahora: ['creado'] }), NO);
  assert.equal(await escribir('crm_leads/b4', leadWeb({ ref: 'MAYUS' }), { ahora: ['creado'] }), NO);
  assert.equal(await escribir('crm_leads/b5', leadWeb({ servicio: 'x'.repeat(61) }), { ahora: ['creado'] }), NO);
  assert.equal(await escribir('crm_leads/b6', { ...leadWeb(), creado: new Date(2020, 0, 1) }), NO); // fecha inventada
});

test('admin lee, crea, edita y borra leads', async () => {
  assert.equal(await leer('crm_leads/a1', ADMIN), OK);
  assert.equal(await escribir('crm_leads/m1', { origen: 'manual', estado: 'nuevo', nombre: 'Ana', email: 'ana@x.co', ref: null }, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_leads/m1', { origen: 'manual', estado: 'contactado', nombre: 'Ana' }, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_leads/m1', { origen: 'manual', estado: 'inventado' }, { token: ADMIN }), NO);
  assert.equal(await borrar('crm_leads/m1', ADMIN), OK);
});

test('correo admin sin verificar no entra', async () => {
  assert.equal(await leer('crm_leads/a1', ADMIN_SIN_VERIFICAR), NO);
  assert.equal(await leer('crm_afiliados/juanp', ADMIN_SIN_VERIFICAR), NO);
});

test('oportunidades: etapa y valor validados; solo admin', async () => {
  const op = { titulo: 'Tienda web', etapa: 'propuesta', valor_cop: 4500000, servicio: 'web', afiliado: 'juanp' };
  assert.equal(await escribir('crm_oportunidades/o1', op, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_oportunidades/o2', { ...op, etapa: 'quizas' }, { token: ADMIN }), NO);
  assert.equal(await escribir('crm_oportunidades/o3', { ...op, valor_cop: -1 }, { token: ADMIN }), NO);
  assert.equal(await escribir('crm_oportunidades/o4', op, { token: EXTRANO }), NO);
  assert.equal(await escribir('crm_oportunidades/o5', op), NO);
});

test('proyectos: no se borran', async () => {
  assert.equal(await escribir('crm_proyectos/p1', { nombre: 'Refricom', estado: 'en_curso' }, { token: ADMIN }), OK);
  assert.equal(await borrar('crm_proyectos/p1', ADMIN), NO);
});

test('afiliados: el id es el código', async () => {
  const af = { codigo: 'juanp', nombre: 'Juan P', comision_pct: 10, estado: 'activo' };
  assert.equal(await escribir('crm_afiliados/juanp', af, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_afiliados/otro1', af, { token: ADMIN }), NO);          // id ≠ código
  assert.equal(await escribir('crm_afiliados/AB', { ...af, codigo: 'AB' }, { token: ADMIN }), NO);
  assert.equal(await escribir('crm_afiliados/juanp', { ...af, comision_pct: 80 }, { token: ADMIN }), NO);
  assert.equal(await borrar('crm_afiliados/juanp', ADMIN), NO);
  assert.equal(await leer('crm_afiliados/juanp'), NO);
});

test('comisiones: una pagada queda congelada y nada se borra', async () => {
  const c = { afiliado: 'juanp', base_cop: 2000000, pct: 10, valor_cop: 200000, estado: 'pendiente' };
  assert.equal(await escribir('crm_comisiones/c1', c, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_comisiones/c0', { ...c, estado: 'pagada' }, { token: ADMIN }), NO); // no nace pagada
  assert.equal(await escribir('crm_comisiones/c1', { ...c, estado: 'pagada' }, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_comisiones/c1', { ...c, estado: 'anulada' }, { token: ADMIN }), NO);
  assert.equal(await borrar('crm_comisiones/c1', ADMIN), NO);
});

test('actividades: solo el autor edita su nota', async () => {
  const a = { entidad: 'lead', entidad_id: 'a1', tipo: 'nota', texto: 'Llamar el lunes', creado_por: 'henrytaborda57@gmail.com' };
  assert.equal(await escribir('crm_actividades/n1', a, { token: ADMIN }), OK);
  assert.equal(await escribir('crm_actividades/n2', { ...a, creado_por: 'otro@x.com' }, { token: ADMIN }), NO);
  const ISA = tokenDe({ email: 'isarias09@gmail.com' });
  assert.equal(await borrar('crm_actividades/n1', ISA), NO);
  assert.equal(await borrar('crm_actividades/n1', ADMIN), OK);
});

test('clients (registros de auth.js): el admin puede leerlos, un extraño no', async () => {
  await escribir('clients/u1', { name: 'X', email: 'x@x.com' }, { token: DUENO });
  assert.equal(await leer('clients/u1', ADMIN), OK);
  assert.equal(await leer('clients/u1', EXTRANO), NO);
});

test('las reglas anteriores siguen igual (crm_clientes solo admin)', async () => {
  assert.equal(await escribir('crm_clientes/demo', { nombre: 'Demo' }, { token: ADMIN }), OK);
  assert.equal(await leer('crm_clientes/demo', EXTRANO), NO);
  assert.equal(await leer('crm_clientes/demo'), NO);
});
