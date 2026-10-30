/**
 * Junta filas idénticas de InventoryItem SIN IMEI en una sola con cantidad = suma.
 *
 *   node dist/scripts/agrupar-repetidos.js --store-email dueño@mail.com                      (dry-run, no escribe)
 *   node dist/scripts/agrupar-repetidos.js --store-id <id> --apply --expect-store-name "<nombre>" [--backup-dir /ruta]
 *   node dist/scripts/agrupar-repetidos.js --store-id <id> --apply --expect-store-name "<nombre>" --restore <backup.json>
 *
 * Guardas: dry-run por defecto; --apply exige --expect-store-name igual al nombre real; aborta si detecta producción
 * (RAILWAY_ENVIRONMENT_NAME=production o host de la base de producción) salvo --allow-production. No imprime secretos.
 */
import { inventoryDuplicateKeySql } from '../src/modules/inventory/duplicate-key.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };

const PRODUCTION_HOST_HINTS = ['r-9e', 'r_9e'];
function looksLikeProduction(env: NodeJS.ProcessEnv = process.env) {
  let host = '';
  try { host = new URL(env.DATABASE_URL ?? '').hostname; } catch { /* sin URL válida */ }
  return (env.RAILWAY_ENVIRONMENT_NAME ?? '').toLowerCase() === 'production' || PRODUCTION_HOST_HINTS.some(hint => host.includes(hint));
}

const APPLY = flag('apply');
const JSON_OUT = flag('json');
const ALLOW_EDITED = flag('allow-edited');
const STATUSES = (opt('statuses') ?? 'DISPONIBLE,EN_REVISION').split(',').map(s => s.trim()).filter(Boolean);
const EDIT_ACTIONS = ['inventory.updated', 'inventory.price', 'inventory.cost', 'inventory.status', 'inventory.archived', 'inventory.restored', 'inventory.moved'];
const ACTOR = 'Agrupado automático';
const out = (...parts: unknown[]) => { if (!JSON_OUT) console.log(...parts); };
const fail = (message: string, code = 2): never => { console.error(message); process.exit(code); };

if (looksLikeProduction() && !flag('allow-production')) fail('ABORTADO: esto parece producción (entorno o host). No corro sin --allow-production.', 3);

// Todo igual => mismo grupo. NULL cuenta como un valor.
const KEY_EXPR = inventoryDuplicateKeySql();

const CANDIDATES_SQL = `
SELECT i."id", i."model", i."capacity", i."color", i."condition", i."grade", i."cost"::text AS cost, i."price"::text AS price,
       i."status", i."quantity"::int AS quantity, ${KEY_EXPR} AS gkey,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN EXISTS (SELECT 1 FROM "Sale" s WHERE s."inventoryItemId" = i."id") THEN 'tiene ventas' END,
         CASE WHEN EXISTS (SELECT 1 FROM "TradeIn" t WHERE t."receivedInventoryItemId" = i."id") THEN 'viene de un canje' END,
         CASE WHEN EXISTS (SELECT 1 FROM "ReturnCase" r WHERE r."inventoryItemId" = i."id") THEN 'tiene devolución' END,
         CASE WHEN i."reservedDepositId" IS NOT NULL OR i."reservedClientId" IS NOT NULL THEN 'reservado' END,
         CASE WHEN EXISTS (SELECT 1 FROM "ClientDeposit" d WHERE d."storeId" = i."storeId" AND d."productId" = i."id") THEN 'tiene seña' END,
         CASE WHEN EXISTS (SELECT 1 FROM "StockCountExpected" e WHERE e."inventoryItemId" = i."id")
                OR EXISTS (SELECT 1 FROM "StockCountScan" c WHERE c."inventoryItemId" = i."id") THEN 'en un control de stock' END,
         CASE WHEN i."pendingSaleRegistration" OR i."needsCompletion" THEN 'pendiente de completar' END,
         CASE WHEN $3::boolean = false AND EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a."storeId" = i."storeId" AND a."entityType" = 'inventory'
                AND a."entityId" = i."id" AND a."action" = ANY($4::text[]) AND a."actorName" <> '${ACTOR}') THEN 'editado a mano (historial)' END
       ], NULL) AS reasons
FROM "InventoryItem" i
WHERE i."storeId" = $1 AND i."archivedAt" IS NULL AND (i."imei" IS NULL OR btrim(i."imei") = '')
  AND i."status" = ANY($2::text[]) AND i."quantity" >= 1
ORDER BY i."createdAt", i."id"`;

const TOTALS_SQL = `SELECT count(*)::int AS filas, coalesce(sum("quantity"),0)::int AS unidades,
  (count(*) FILTER (WHERE "archivedAt" IS NULL))::int AS filas_activas,
  (coalesce(sum("quantity") FILTER (WHERE "archivedAt" IS NULL),0))::int AS unidades_activas
  FROM "InventoryItem" WHERE "storeId" = $1`;

type Row = { id: string; model: string; capacity: string; color: string; condition: string; grade: string; cost: string; price: string | null; status: string; quantity: number; gkey: string; reasons: string[] };
type Group = { keep: Row; drop: Row[]; rowsBefore: number; units: number };
const label = (r: Row) => [r.model, r.capacity, r.color, r.condition, r.grade && `calidad ${r.grade}`].filter(Boolean).join(' · ');
const money = (v: string | null) => v ?? 'a definir';

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;

async function resolveStore(): Promise<{ id: string; name: string }> {
  const id = opt('store-id'); const email = opt('store-email');
  let rows: { id: string; name: string }[];
  if (id) rows = await prisma.$queryRawUnsafe(`SELECT "id","name" FROM "Store" WHERE "id" = $1`, id);
  else if (email) rows = await prisma.$queryRawUnsafe(`SELECT DISTINCT s."id", s."name" FROM "Store" s JOIN "StoreMember" m ON m."storeId" = s."id" AND m."removedAt" IS NULL AND m."role"::text = 'OWNER'
      JOIN "User" u ON u."id" = m."userId" WHERE lower(u."email") = lower($1)`, email);
  else return fail('Indicá --store-id o --store-email');
  if (rows.length !== 1) return fail(`Esperaba exactamente 1 tienda y encontré ${rows.length}: ${rows.map(r => `${r.id} «${r.name}»`).join(', ')}`);
  const expect = opt('expect-store-name');
  if (APPLY && !expect) return fail('Con --apply hace falta --expect-store-name "<nombre exacto de la tienda>"');
  if (expect !== undefined && expect !== rows[0].name) return fail(`El nombre de la tienda es «${rows[0].name}», no «${expect}». Aborto.`);
  return rows[0];
}

async function plan(tx: Tx, storeId: string) {
  const rows = await tx.$queryRawUnsafe<Row[]>(CANDIDATES_SQL + (APPLY ? ' FOR UPDATE OF i' : ''), storeId, STATUSES, ALLOW_EDITED, EDIT_ACTIONS);
  const byKey = new Map<string, Row[]>();
  for (const row of rows) byKey.set(row.gkey, [...(byKey.get(row.gkey) ?? []), row]);
  const groups: Group[] = []; const excluded: { id: string; label: string; reasons: string[] }[] = [];
  for (const members of byKey.values()) {
    const ok = members.filter(m => m.reasons.length === 0);
    if (members.length >= 2) for (const bad of members.filter(m => m.reasons.length > 0)) excluded.push({ id: bad.id, label: label(bad), reasons: bad.reasons });
    if (ok.length < 2) continue;
    const [keep, ...drop] = ok; // ordenadas por createdAt, id => la más antigua
    groups.push({ keep, drop, rowsBefore: ok.length, units: ok.reduce((s, m) => s + m.quantity, 0) });
  }
  return { groups, excluded, candidates: rows.length };
}

async function backupAndApply(tx: Tx, store: { id: string; name: string }, groups: Group[]) {
  const dir = opt('backup-dir') ?? '/tmp/agrupar-backups';
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = path.join(dir, `agrupar-${store.id}-${stamp}.json`);
  const items = (await tx.$queryRawUnsafe<{ row: unknown }[]>(`SELECT to_jsonb(i) AS row FROM "InventoryItem" i WHERE i."storeId" = $1 ORDER BY i."createdAt", i."id"`, store.id)).map(r => r.row);
  const auditIds = groups.map(() => `agr_${crypto.randomBytes(12).toString('hex')}`);
  fs.writeFileSync(file, JSON.stringify({ meta: { storeId: store.id, storeName: store.name, createdAt: new Date().toISOString(), tables: ['InventoryItem'] }, auditEventIds: auditIds, items }));
  out(`Backup: archivo ${file} (${items.length} filas de InventoryItem). Tomá además un backup de la base en Railway antes de aplicar en producción.`);
  let index = 0;
  for (const g of groups) {
    const dropIds = g.drop.map(d => d.id);
    await tx.$executeRawUnsafe(`UPDATE "InventoryItem" SET "quantity" = $2, "updatedAt" = now() WHERE "id" = $1 AND "storeId" = $3`, g.keep.id, g.units, store.id);
    const deleted = await tx.$executeRawUnsafe(`DELETE FROM "InventoryItem" WHERE "id" = ANY($1::text[]) AND "storeId" = $2`, dropIds, store.id);
    if (deleted !== dropIds.length) throw new Error(`Esperaba borrar ${dropIds.length} filas y borré ${deleted}`);
    await tx.$executeRawUnsafe(`INSERT INTO "AuditEvent" ("id","storeId","actorUserId","actorName","action","entityType","entityId","entityLabel","detail","changes","source","createdAt")
      VALUES ($1,$2,NULL,$3,'inventory.updated','inventory',$4,$5,$6,$7::jsonb,'bulk',now())`,
      auditIds[index++], store.id, ACTOR, g.keep.id, label(g.keep).slice(0, 160),
      `Se juntaron ${g.rowsBefore} filas idénticas sin IMEI en una sola con cantidad ${g.units}`,
      JSON.stringify([{ field: 'cantidad', label: 'Cantidad', before: String(g.keep.quantity), after: String(g.units) }]));
  }
  return { file };
}

async function restore(tx: Tx, store: { id: string; name: string }, file: string) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { meta: { storeId: string }; auditEventIds: string[]; items: unknown[] };
  if (data.meta.storeId !== store.id) throw new Error('El backup es de otra tienda');
  const cols = (await tx.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='InventoryItem' ORDER BY ordinal_position`)).map(r => r.column_name);
  const colList = cols.map(c => `"${c}"`).join(',');
  const setList = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(',');
  for (const row of data.items) {
    await tx.$executeRawUnsafe(`INSERT INTO "InventoryItem" (${colList}) SELECT ${colList} FROM jsonb_populate_record(NULL::"InventoryItem", $1::jsonb) ON CONFLICT ("id") DO UPDATE SET ${setList}`, JSON.stringify(row));
  }
  const deleted = await tx.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE "id" = ANY($1::text[]) AND "storeId" = $2`, data.auditEventIds, store.id);
  out(`Restauradas ${data.items.length} filas de InventoryItem; borrados ${deleted} eventos de historial del agrupado.`);
}

try {
  const store = await resolveStore();
  out(`Modo: ${APPLY ? 'APLICAR' : 'DRY-RUN (no escribe)'} · Tienda: «${store.name}» (${store.id}) · Estados: ${STATUSES.join(', ')}`);
  const restoreFile = opt('restore');
  if (restoreFile) {
    if (!APPLY) { out('Restaurar sin --apply: no hago nada. Agregá --apply.'); } else await prisma.$transaction(tx => restore(tx, store, restoreFile), { timeout: 300_000, maxWait: 30_000 });
  } else {
    await prisma.$transaction(async tx => {
      if (!APPLY) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`);
      const [before] = await tx.$queryRawUnsafe<{ filas: number; unidades: number; filas_activas: number; unidades_activas: number }[]>(TOTALS_SQL, store.id);
      const p = await plan(tx, store.id);
      const dropped = p.groups.reduce((s, g) => s + g.drop.length, 0);
      const report: Record<string, unknown> = {
        store, mode: APPLY ? 'apply' : 'dry-run', candidates: p.candidates, groups: p.groups.length,
        rowsBefore: before.filas_activas, rowsAfter: before.filas_activas - dropped, unitsBefore: before.unidades_activas, unitsAfter: before.unidades_activas,
        detail: p.groups.map(g => ({ keepId: g.keep.id, label: label(g.keep), rowsBefore: g.rowsBefore, unitsBefore: g.units })), excluded: p.excluded,
      };
      out(`\nFilas candidatas (sin IMEI, activas, estados ${STATUSES.join('/')}): ${p.candidates}`);
      out(`Grupos a juntar: ${p.groups.length}`);
      for (const g of p.groups) out(`  - ${label(g.keep)} | costo ${g.keep.cost} | precio ${money(g.keep.price)} | ${g.keep.status}: ${g.rowsBefore} filas -> 1 fila (cantidad ${g.units}) | unidades ${g.units} -> ${g.units} | se conserva ${g.keep.id}`);
      if (p.excluded.length) { out(`\nExcluidas (iguales a otras pero con ventas/reservas/historial; no se tocan): ${p.excluded.length}`); for (const e of p.excluded) out(`  - ${e.id} ${e.label}: ${e.reasons.join(', ')}`); }
      out(`\nFilas activas de la tienda: ${before.filas_activas} -> ${before.filas_activas - dropped}`);
      out(`Unidades activas de la tienda: ${before.unidades_activas} -> ${before.unidades_activas}`);
      if (!APPLY) { if (JSON_OUT) console.log(JSON.stringify(report, null, 1)); return; }
      if (p.groups.length === 0) { out('\nNada para agrupar (ya está agrupado).'); return; }
      Object.assign(report, await backupAndApply(tx, store, p.groups));
      const [after] = await tx.$queryRawUnsafe<{ filas: number; unidades: number }[]>(TOTALS_SQL, store.id);
      if (after.unidades !== before.unidades || after.filas !== before.filas - dropped) throw new Error(`Verificación falló: filas ${before.filas}->${after.filas}, unidades ${before.unidades}->${after.unidades}. ROLLBACK.`);
      out(`\nCOMMIT OK. Filas totales ${before.filas} -> ${after.filas} · Unidades totales ${before.unidades} -> ${after.unidades} (iguales).`);
      if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
    }, { timeout: 300_000, maxWait: 30_000 });
  }
} catch (cause) {
  console.error('ERROR (se hizo ROLLBACK):', cause instanceof Error ? cause.message : 'desconocido');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
