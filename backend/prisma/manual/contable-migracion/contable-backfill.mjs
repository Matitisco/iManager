// Manual, bounded state normalization. Dry run by default; never prints the URL.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rollback = args.includes('--rollback');
if (apply && rollback) throw new Error('Elegí aplicar o restaurar estados');
let connection;
try { connection = new URL(process.env.DATABASE_URL || 'postgresql://invalid'); } catch { throw new Error('DATABASE_URL inválida'); }
if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !connection.hostname || !connection.pathname.slice(1)) throw new Error('Falta DATABASE_URL válida');
const env = { ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432', PGDATABASE: decodeURIComponent(connection.pathname.slice(1)), PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password), PGCONNECT_TIMEOUT: '10', PGSSLMODE: connection.searchParams.get('sslmode') || (['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname) ? 'disable' : 'verify-full'), PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=2000' };
const q = value => "'" + value.replaceAll("'", "''") + "'";
const id = value => '"' + value.replaceAll('"', '""') + '"';
function sql(input) {
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { env, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  // SQL errors may contain business values. Keep stdout/stderr private to the operator.
  if (result.error || result.status !== 0) throw new Error('Falló el lote SQL; revisar conexión/locks/constraints antes de reintentar. Sin rollback automático de lotes previos.');
  return result.stdout.trim();
}
const database = sql('SELECT current_database();');
const confirmation = args.find(value => value.startsWith('--confirm-database='))?.slice('--confirm-database='.length);
if ((apply || rollback) && confirmation !== database) throw new Error('Escritura requiere --confirm-database con el nombre exacto de la base revisada');
if (connection.hostname === 'app.imanager.com.ar') throw new Error('Host no permitido');
const batchSize = Number(args.find(value => value.startsWith('--batch-size='))?.split('=')[1] ?? 500);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000) throw new Error('Lote permitido: 1–2000');
const maxBatches = Number(args.find(value => value.startsWith('--max-batches='))?.split('=')[1] ?? 10000);
if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 100000) throw new Error('Límite de lotes inválido');
let remainingTotal = 0;
for (const { table, field, domain } of manifest.columns) {
  const tableName = 'public.' + id(table), fieldName = id(field);
  let changed = 0;
  if (!rollback) {
    const normalized = `public.contable_normalize_state(${q(domain)}, ${fieldName})`;
    const predicate = `${fieldName} IS NOT NULL AND ${fieldName} IS DISTINCT FROM ${normalized}`;
    const count = Number(sql(`SELECT count(*) FROM ${tableName} WHERE ${predicate};`));
    if (apply) {
      for (let batch = 0; batch < maxBatches; batch++) {
        const size = Number(sql(`WITH candidates AS (
          SELECT "id", ${fieldName} AS old_value, ${normalized} AS new_value, to_jsonb(t)->>'updatedAt' AS row_updated_at FROM ${tableName} t
          WHERE ${predicate} ORDER BY "id" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
        ), journal AS (
          INSERT INTO contable_migration."StateBackfill" ("tableName", "rowId", "fieldName", "oldValue", "newValue", "rowUpdatedAt")
          SELECT ${q(table)}, "id", ${q(field)}, old_value, new_value, row_updated_at FROM candidates
          ON CONFLICT ("tableName", "rowId", "fieldName") DO UPDATE SET "newValue" = EXCLUDED."newValue"
          RETURNING "rowId"
        ), changed AS (
          UPDATE ${tableName} t SET ${fieldName} = c.new_value FROM candidates c
          JOIN journal j ON j."rowId" = c."id" WHERE t."id" = c."id" RETURNING 1
        ) SELECT count(*) FROM changed;`));
        changed += size;
        if (!size) break;
      }
    }
    const left = Number(sql(`SELECT count(*) FROM ${tableName} WHERE ${predicate};`));
    remainingTotal += left;
    console.log(JSON.stringify({ field: `${table}.${field}`, candidates: count, changed, remaining: left }));
  } else {
    // Restore only values still equal to our canonical result. Preserve later business edits.
    for (let batch = 0; batch < maxBatches; batch++) {
      const size = Number(sql(`WITH candidates AS (
        SELECT t."id", j."oldValue" FROM ${tableName} t JOIN contable_migration."StateBackfill" j
          ON j."tableName" = ${q(table)} AND j."fieldName" = ${q(field)} AND j."rowId" = t."id"
        WHERE (to_jsonb(t)->>'updatedAt') IS NOT DISTINCT FROM j."rowUpdatedAt" AND t.${fieldName} = j."newValue" AND t.${fieldName} <> j."oldValue"
        ORDER BY t."id" LIMIT ${batchSize} FOR UPDATE OF t SKIP LOCKED
      ), changed AS (
        UPDATE ${tableName} t SET ${fieldName} = c."oldValue" FROM candidates c WHERE t."id" = c."id" RETURNING 1
      ) SELECT count(*) FROM changed;`));
      changed += size;
      if (!size) break;
    }
    const skipped = Number(sql(`SELECT count(*) FROM contable_migration."StateBackfill" j LEFT JOIN ${tableName} t ON t."id" = j."rowId"
      WHERE j."tableName" = ${q(table)} AND j."fieldName" = ${q(field)} AND (t."id" IS NULL OR t.${fieldName} IS DISTINCT FROM j."oldValue");`));
    remainingTotal += skipped;
    console.log(JSON.stringify({ field: `${table}.${field}`, restored: changed, skippedOrPending: skipped }));
  }
}
if ((apply || rollback) && remainingTotal > 0) {
  process.exitCode = 2;
  console.error('Quedan filas bloqueadas, valores posteriores o lotes pendientes; revisar conteos y reintentar sólo lo aprobado.');
}
