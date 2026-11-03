// Explicit local-only harness. Uses a separate disposable DB; never an inherited shared DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Sólo PostgreSQL loopback');
assert(Number(url.port) > 20000, 'Puerto local exclusivo >20000');
const database = decodeURIComponent(url.pathname.slice(1));
assert(/^contable_migracion(?:_[a-z0-9]+)?$/.test(database), 'Base exclusiva de esta prueba');
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database, PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=2000' };
function query(input, fail = false) {
  const r = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { env, input, encoding: 'utf8', maxBuffer: 4e6 });
  if (!fail) assert.equal(r.status, 0, r.stderr);
  return r;
}
const sql = input => query(input).stdout.trim();
const file = name => readFileSync(join(here, name), 'utf8');
const id = value => '"' + value.replaceAll('"', '""') + '"';
const q = value => "'" + value.replaceAll("'", "''") + "'";
const fixtureId = (store, table) => `local_${store}_${table}`;
let required;
function minimalInsert(table, store, customId = fixtureId(store, table)) {
  const cols = required.filter(col => col.table_name === table);
  const values = cols.map(col => {
    if (col.column_name === 'id') return q(customId);
    if (col.column_name === 'storeId') return q(`local_${store}`);
    if (col.column_name === 'userId' && table === 'StoreMember') return q('local_user');
    const ref = manifest.references.find(ref => ref.table === table && ref.field === col.column_name);
    if (ref) return q(fixtureId(store, ref.parent));
    const state = manifest.columns.find(row => row.table === table && row.field === col.column_name);
    if (state) return q(manifest.states[state.domain][0]);
    if (col.column_name === 'currency') return "'USD'";
    if (col.column_name === 'period') return "'2026-11'";
    if (col.column_name === 'day') return "'2026-11-03'";
    if (col.column_name === 'status') return "'DISPONIBLE'";
    if (col.data_type.includes('timestamp') || col.data_type === 'date') return 'CURRENT_TIMESTAMP';
    if (col.data_type === 'boolean') return 'false';
    if (col.data_type === 'USER-DEFINED') return `(SELECT enumlabel::${id(col.udt_name)} FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=${q(col.udt_name)} ORDER BY enumsortorder LIMIT 1)`;
    if (['integer', 'bigint', 'numeric', 'double precision'].includes(col.data_type)) return '1';
    if (col.data_type === 'jsonb' || col.data_type === 'json') return "'{}'";
    return q('falso'.slice(0, col.character_maximum_length ?? 5));
  });
  return `INSERT INTO public.${id(table)} (${cols.map(col => id(col.column_name)).join(', ')}) VALUES (${values.join(', ')});`;
}
function backfill(...args) {
  return spawnSync(process.execPath, [join(here, 'contable-backfill.mjs'), ...args], { env, encoding: 'utf8', maxBuffer: 4e6 });
}
function prismaPush() {
  const backend = process.env.CONTABLE_BACKEND_DIR || resolve(here, '../../..');
  const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { cwd: backend, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
}

test('migración contable por fases con datos falsos inconsistentes', async t => {
  prismaPush();
  sql(file('rollback-checks.sql')); sql(file('rollback-guards.sql'));
  sql(`DO $clean$ BEGIN IF to_regclass('contable_migration."StateBackfill"') IS NOT NULL THEN TRUNCATE contable_migration."StateBackfill"; END IF; END $clean$;`);
  required = JSON.parse(sql(`SELECT json_agg(row_to_json(c)) FROM (SELECT table_name, column_name, data_type, udt_name, character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND is_nullable='NO' AND column_default IS NULL ORDER BY ordinal_position) c;`));
  const tables = [...new Set(manifest.references.flatMap(ref => [ref.table, ref.parent]))];
  sql(`TRUNCATE TABLE ${tables.map(id).join(', ')} CASCADE; DELETE FROM "Store"; DELETE FROM "User"; INSERT INTO "User" ("id","firebaseUid","updatedAt") VALUES ('local_user','falso',now()); INSERT INTO "Store" ("id","name","updatedAt") VALUES ('local_a','Local A',now()),('local_b','Local B',now());`);
  const seeded = new Set();
  while (seeded.size < tables.length) {
    let progress = false;
    for (const table of tables.filter(table => !seeded.has(table))) {
      const deps = manifest.references.filter(ref => ref.table === table && !ref.historical && required.some(col => col.table_name === table && col.column_name === ref.field));
      if (deps.some(ref => !seeded.has(ref.parent))) continue;
      sql(minimalInsert(table, 'a') + minimalInsert(table, 'b'));
      seeded.add(table); progress = true;
    }
    assert(progress, 'Las relaciones requeridas deben permitir sembrar sin desactivar FKs');
  }
  sql(`UPDATE "Sale" SET "clientId"='local_b_Client' WHERE "id"='local_a_Sale'; UPDATE "CashSession" SET "day"='2026-11-04', "registerId"='local_b_CashRegister', "status"='MISTERIO' WHERE "id"='local_a_CashSession'; UPDATE "ClientPayment" SET "saleId"='local_b_Sale' WHERE "id"='local_a_ClientPayment'; UPDATE "ClientDeposit" SET "status"=' active ' WHERE "id"='local_a_ClientDeposit'; UPDATE "TradeIn" SET "status"='en_revision' WHERE "id"='local_a_TradeIn'; UPDATE "TradeIn" SET "status"='Mi peritaje' WHERE "id"='local_b_TradeIn'; UPDATE "ReturnEvent" SET "status"=' recibido ' WHERE "id"='local_a_ReturnEvent';`);
  await t.test('precheck de sólo lectura cuenta cruces y estados, sin corregir filas', () => {
    const output = sql(file('00-precheck.sql'));
    assert.match(output, /Sale.clientId\|1\|0\|f/);
    assert.match(output, /ClientPayment.saleId\|1\|0\|t/);
    assert.equal(sql(`SELECT "clientId" FROM "Sale" WHERE "id"='local_a_Sale';`), 'local_b_Client');
  });
  sql(file('migration.sql')); sql(file('migration.sql'));
  await t.test('instalación idempotente protege nuevas escrituras, pero no oculta históricos corruptos', () => {
    assert.notEqual(query(file('03-validate.sql'), true).status, 0);
    assert.notEqual(query(`UPDATE "Sale" SET "clientId"='local_b_Client' WHERE "id"='local_a_Sale';`, true).status, 0);
    // Repair only the deliberately seeded local corruptions; never automatic in deployment.
    sql(`UPDATE "Sale" SET "clientId"='local_a_Client' WHERE "id"='local_a_Sale'; UPDATE "CashSession" SET "registerId"='local_a_CashRegister' WHERE "id"='local_a_CashSession'; UPDATE "ClientPayment" SET "saleId"='local_a_Sale' WHERE "id"='local_a_ClientPayment';`);
  });
  for (const ref of manifest.references) await t.test(`${ref.table}.${ref.field}: bloqueo SQL multi-tienda y control positivo`, () => {
    const stmt = `UPDATE public.${id(ref.table)} SET ${id(ref.field)} = ${q(fixtureId('b', ref.parent))} WHERE "id"=${q(fixtureId('a', ref.table))};`;
    assert.notEqual(query(stmt, true).status, 0, ref.table + '.' + ref.field);
    assert.match(query(stmt, true).stderr, /Relacion entre tiendas/);
    sql(`UPDATE public.${id(ref.table)} SET ${id(ref.field)} = ${q(fixtureId('a', ref.parent))} WHERE "id"=${q(fixtureId('a', ref.table))};`);
  });
  await t.test('storeId del padre es inmutable y un tombstone no se recicla entre tiendas', () => {
    assert.notEqual(query(`UPDATE "Client" SET "storeId"='local_b' WHERE "id"='local_a_Client';`, true).status, 0);
    sql(`UPDATE "ClientPayment" SET "saleId"='local_tombstone' WHERE "id"='local_a_ClientPayment';`);
    assert.notEqual(query(minimalInsert('Sale', 'b', 'local_tombstone'), true).status, 0);
    assert.notEqual(query(`UPDATE "Sale" SET "id"='local_tombstone' WHERE "id"='local_b_Sale';`, true).status, 0);
  });
  await t.test('dos conexiones serializan inserción de padre y referencia histórica', async () => {
    async function hold(statement, competing) {
      const process = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { env });
      let errors = ''; process.stderr.on('data', chunk => { errors += chunk; });
      const finished = new Promise(resolve => process.once('exit', resolve));
      const ready = new Promise(resolve => process.stdout.on('data', chunk => { if (String(chunk).includes('READY')) resolve(); }));
      process.stdin.end('BEGIN; ' + statement + '\n\\echo READY\nSELECT pg_sleep(0.2); COMMIT;\n');
      await ready;
      const result = query(competing, true);
      assert.notEqual(result.status, 0, 'La escritura concurrente debe rechazar el cruce');
      assert.equal(await finished, 0, errors);
    }
    await hold(minimalInsert('Sale', 'b', 'local_concurrent_parent'), `UPDATE "ClientPayment" SET "saleId"='local_concurrent_parent' WHERE "id"='local_a_ClientPayment';`);
    await hold(`UPDATE "ClientPayment" SET "saleId"='local_concurrent_child' WHERE "id"='local_a_ClientPayment';`, minimalInsert('Sale', 'b', 'local_concurrent_child'));
  });
  await t.test('backfill por lotes es explícito, idempotente y preserva valores personalizados/desconocidos', () => {
    const before = sql(`SELECT "status" FROM "ClientDeposit" WHERE "id"='local_a_ClientDeposit';`);
    assert.equal(backfill().status, 0);
    assert.equal(sql(`SELECT "status" FROM "ClientDeposit" WHERE "id"='local_a_ClientDeposit';`), before);
    assert.notEqual(backfill('--apply').status, 0);
    assert.equal(backfill('--apply', `--confirm-database=${database}`, '--batch-size=1').status, 0);
    assert.equal(sql(`SELECT "status" FROM "ClientDeposit" WHERE "id"='local_a_ClientDeposit';`), 'ACTIVE');
    assert.equal(sql(`SELECT "status" FROM "TradeIn" WHERE "id"='local_a_TradeIn';`), 'EN REVISIÓN');
    assert.equal(sql(`SELECT "status" FROM "TradeIn" WHERE "id"='local_b_TradeIn';`), 'Mi peritaje');
    assert.equal(sql(`SELECT "status" FROM "CashSession" WHERE "id"='local_a_CashSession';`), 'MISTERIO');
    assert.equal(sql(`SELECT "status" FROM "ReturnEvent" WHERE "id"='local_a_ReturnEvent';`), 'RECIBIDO');
    const count = sql('SELECT count(*) FROM contable_migration."StateBackfill";');
    assert.equal(backfill('--apply', `--confirm-database=${database}`).status, 0);
    assert.equal(sql('SELECT count(*) FROM contable_migration."StateBackfill";'), count);
  });
  await t.test('NOT VALID permite medir y frena estados nuevos no canónicos; VALIDATE no acepta desconocidos', () => {
    sql(file('02-state-checks.sql')); sql(file('02-state-checks.sql'));
    assert.notEqual(query(file('03-validate.sql'), true).status, 0);
    assert.notEqual(query(`UPDATE "ClientDeposit" SET "status"=' active ' WHERE "id"='local_a_ClientDeposit';`, true).status, 0);
    sql(`UPDATE "CashSession" SET "status"='OPEN' WHERE "id"='local_a_CashSession';`);
    sql(file('03-validate.sql'));
    assert.equal(sql(`SELECT count(*) FROM pg_constraint WHERE conname LIKE 'contable_%_check' AND NOT convalidated;`), '0');
    sql('ALTER TABLE "Sale" DISABLE TRIGGER contable_child_store_guard;');
    assert.match(query(file('03-validate.sql'), true).stderr, /Falta guard activo/);
    sql('ALTER TABLE "Sale" ENABLE TRIGGER contable_child_store_guard;');
  });
  await t.test('db push conserva triggers/checks y no elimina el diario aislado', () => {
    const indexCount = sql(`SELECT count(*) FROM pg_indexes WHERE indexname LIKE 'contable_ref_%';`);
    const before = sql(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'contable_%';`);
    prismaPush();
    assert.equal(sql(`SELECT count(*) FROM pg_indexes WHERE indexname LIKE 'contable_ref_%';`), indexCount);
    assert.equal(sql(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'contable_%';`), before);
    assert.notEqual(query(`UPDATE "Sale" SET "clientId"='local_b_Client' WHERE "id"='local_a_Sale';`, true).status, 0);
  });
  await t.test('borrar un padre opcional conserva SET NULL sin anular storeId', () => {
    sql(minimalInsert('Client', 'a', 'local_optional'));
    sql(`UPDATE "Sale" SET "clientId"='local_optional' WHERE "id"='local_a_Sale'; DELETE FROM "Client" WHERE "id"='local_optional';`);
    assert.equal(sql(`SELECT "storeId" || ':' || COALESCE("clientId", 'NULL') FROM "Sale" WHERE "id"='local_a_Sale';`), 'local_a:NULL');
  });
  await t.test('rollback conserva cambios posteriores, reporta pendientes y no borra filas', () => {
    sql(file('rollback-checks.sql'));
    sql(`UPDATE "ClientDeposit" SET "status"='CREDIT' WHERE "id"='local_a_ClientDeposit'; UPDATE "TradeIn" SET "updatedAt"="updatedAt" + interval '1 second' WHERE "id"='local_a_TradeIn';`);
    assert.equal(backfill('--rollback', `--confirm-database=${database}`).status, 2);
    assert.equal(sql(`SELECT "status" FROM "ClientDeposit" WHERE "id"='local_a_ClientDeposit';`), 'CREDIT');
    assert.equal(sql(`SELECT "status" FROM "TradeIn" WHERE "id"='local_a_TradeIn';`), 'EN REVISIÓN');
    assert.equal(sql(`SELECT '[' || "status" || ']' FROM "ReturnEvent" WHERE "id"='local_a_ReturnEvent';`), '[ recibido ]');
    sql(file('rollback-guards.sql')); sql(file('rollback-guards.sql'));
    assert.equal(sql(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'contable_%';`), '0');
    assert(Number(sql('SELECT count(*) FROM contable_migration."StateBackfill";')) > 0);
  });
});
