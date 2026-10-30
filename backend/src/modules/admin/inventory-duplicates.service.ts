/**
 * GET /admin/inventory-duplicates?storeEmail=... previews the exact plan.
 * POST .../apply with storeEmail, expectStoreName, expectRowsBefore,
 * expectRowsAfter, expectUnits and every GET groupKey applies that plan atomically.
 * Save the complete response.backup securely: POST .../restore with
 * { expectStoreName, backup } restores those physical rows and removes its audits.
 * All endpoints require a verified platform admin. Never log the backup.
 */
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { prisma } from '../../plugins/prisma.js';

export const inventoryDuplicatesQuery = z.object({
  storeEmail: z.string().trim().email().optional(),
  storeId: z.string().trim().min(1).max(160).optional(),
  expectStoreName: z.string().max(255).optional(),
}).strict().refine(q => (q.storeEmail !== undefined) !== (q.storeId !== undefined), {
  message: 'Tenés que indicar exactamente uno de storeEmail o storeId.',
});

const KEY_FIELDS = [
  'storeId', 'categoryId', 'model', 'capacity', 'color', 'condition', 'grade',
  'batteryHealth', 'batteryNote', 'cost', 'price', 'currency', 'status', 'supplierId',
  'stockPurchaseId', 'entryDate', 'customFields', 'catalogVisible', 'sampleBatchId',
] as const;
const KEY = KEY_FIELDS.map(f => f === 'entryDate' ? 'entryDate(día)' : f).join(', ');
const SUMMARY_FIELDS = ['model', 'capacity', 'color', 'condition', 'grade', 'batteryHealth', 'batteryNote', 'cost', 'price', 'currency', 'status'] as const;
const EXPECTED_VARIATION = new Set(['id', 'createdAt', 'updatedAt', 'quantity']);
const EDIT_ACTIONS = ['inventory.updated', 'inventory.price', 'inventory.cost', 'inventory.status', 'inventory.archived', 'inventory.restored', 'inventory.moved'];

// Keep this SQL expression identical to the reference script's KEY_EXPR.
const KEY_SQL = Prisma.sql`md5(jsonb_build_array(
  i."storeId", i."categoryId", i."model", i."capacity", i."color", i."condition", i."grade",
  i."batteryHealth", i."batteryNote", i."cost"::text, i."price"::text, i."currency",
  i."status", i."supplierId", i."stockPurchaseId", i."entryDate"::date::text,
  coalesce(i."customFields", 'null'::jsonb), i."catalogVisible", i."sampleBatchId"
)::text)`;

type Json = Prisma.JsonValue;
export type InventoryDuplicateRow = Record<string, Json> & {
  id: string; createdAt: string; updatedAt: string; quantity: number;
  cost: string; price: string | null; entryDate: string | null;
};
type Candidate = { row: InventoryDuplicateRow; groupKey: string; reasons: string[]; entryDay: string | null };
type FieldDifference = { field: string; values: { value: Json; rowIds: string[] }[] };
type DifferenceType = 'whitespace' | 'case' | 'null-vs-empty' | 'other-normalized';

// DMMF supplies trusted column names, including @map names. New Decimal/date columns
// are serialized too, while to_jsonb keeps every physical InventoryItem column.
const inventoryFields = Prisma.dmmf.datamodel.models.find(m => m.name === 'InventoryItem')!.fields;
const decimalOverrides = inventoryFields.filter(f => f.type === 'Decimal').flatMap(f => {
  const name = f.dbName ?? f.name;
  return [Prisma.sql`${name}`, Prisma.sql`${Prisma.raw(`i."${name}"`)}::text`];
});
const dateColumns = inventoryFields.filter(f => f.type === 'DateTime').map(f => f.dbName ?? f.name);

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function bucketBy<T>(rows: T[], key: (row: T) => string): T[][] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = buckets.get(k) ?? [];
    bucket.push(row);
    buckets.set(k, bucket);
  }
  return [...buckets.values()];
}

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function compareRows(a: InventoryDuplicateRow, b: InventoryDuplicateRow): number {
  return compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id);
}

function fieldDifferences(rows: InventoryDuplicateRow[], fields: string[]): FieldDifference[] {
  return fields.flatMap(field => {
    const values = bucketBy(rows, row => canonical(row[field]!)).map(bucket => ({
      value: bucket[0]![field]!, rowIds: bucket.map(row => row.id),
    }));
    return values.length > 1 ? [{ field, values }] : [];
  });
}

function collapse(value: string): string { return value.trim().replace(/\s+/gu, ' '); }
function normalize(value: Json): Json {
  if (typeof value === 'string') return collapse(value).toLowerCase() || null;
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    if (Object.keys(value).length === 0) return null;
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k]!)]));
  }
  return value;
}

function normalizedKey(candidate: Candidate): string {
  return canonical(KEY_FIELDS.map(field => {
    if (field === 'entryDate') return candidate.entryDay;
    const value = candidate.row[field]!;
    if ((field === 'cost' || field === 'price') && typeof value === 'string') return new Prisma.Decimal(value).toString();
    return normalize(value);
  }));
}

function differenceType(value: Json, peers: Json[]): DifferenceType {
  const different = peers.filter(peer => canonical(peer) !== canonical(value));
  if (different.some(peer => (value === null || (typeof value === 'string' && !collapse(value)))
    && (peer === null || (typeof peer === 'string' && !collapse(peer))))) return 'null-vs-empty';
  if (typeof value === 'string') {
    if (different.some(peer => typeof peer === 'string' && collapse(peer) === collapse(value))) return 'whitespace';
    if (different.some(peer => typeof peer === 'string' && peer.toLowerCase() === value.toLowerCase())) return 'case';
  }
  return 'other-normalized';
}

function nearDifferences(row: InventoryDuplicateRow, peers: InventoryDuplicateRow[]) {
  const differences: { field: string; value: string; type: DifferenceType }[] = [];
  function visit(field: string, value: Json, values: Json[]) {
    if (values.every(v => canonical(v) === canonical(value))) return;
    // Preserve paths for recursive custom fields; keep a whole value when structures differ.
    if (field.startsWith('customFields') && value !== null && typeof value === 'object'
      && values.every(v => v !== null && typeof v === 'object' && Array.isArray(v) === Array.isArray(value)
        && canonical(Object.keys(v).sort()) === canonical(Object.keys(value).sort()))) {
      for (const key of Object.keys(value).sort()) {
        const get = (v: Json) => (v as Record<string, Json>)[key]!;
        visit(`${field}[${JSON.stringify(key)}]`, get(value), values.map(get));
      }
      return;
    }
    differences.push({ field, value: JSON.stringify(value), type: differenceType(value, values) });
  }
  for (const field of KEY_FIELDS) visit(field, row[field]!, peers.map(peer => peer[field]!));
  return differences;
}

type Store = { id: string; name: string };
type Tx = Prisma.TransactionClient;

async function resolveStore(tx: Tx, query: z.infer<typeof inventoryDuplicatesQuery>) {
  const stores = query.storeId !== undefined
    ? await tx.store.findMany({ where: { id: query.storeId }, select: { id: true, name: true } })
    : await tx.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
      SELECT DISTINCT s."id", s."name" FROM "Store" s
      JOIN "StoreMember" m ON m."storeId" = s."id" AND m."removedAt" IS NULL AND m."role"::text = 'OWNER'
      JOIN "User" u ON u."id" = m."userId" WHERE lower(u."email") = lower(${query.storeEmail})`);
  if (stores.length !== 1) throw new DomainError(`Se esperaba exactamente 1 tienda y se encontraron ${stores.length}.`, stores.length === 0 ? 404 : 409);
  const store = stores[0]!;
  if (query.expectStoreName !== undefined && query.expectStoreName !== store.name) {
    throw new DomainError(`El nombre de la tienda es «${store.name}», no «${query.expectStoreName}».`, 409);
  }
  return store;
}

export async function listInventoryDuplicates(query: z.infer<typeof inventoryDuplicatesQuery>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return calculateInventoryDuplicates(tx, await resolveStore(tx, query), false);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });
}

// The only candidate query and grouping calculation, shared by preview and apply.
async function calculateInventoryDuplicates(tx: Tx, store: Store, lockRows: boolean) {
  const [totals] = await tx.$queryRaw<{ rowsBefore: number; unitsBefore: bigint; rowsWithImeiSkipped: number }[]>(Prisma.sql`
    SELECT count(*)::int AS "rowsBefore", coalesce(sum("quantity"), 0)::bigint AS "unitsBefore",
      count(*) FILTER (WHERE "imei" IS NOT NULL AND btrim("imei") <> '')::int AS "rowsWithImeiSkipped"
    FROM "InventoryItem" WHERE "storeId" = ${store.id} AND "archivedAt" IS NULL`);
  const candidates = await tx.$queryRaw<Candidate[]>(Prisma.sql`
    SELECT to_jsonb(i) || jsonb_build_object(${Prisma.join(decimalOverrides)}) AS row,
      ${KEY_SQL} AS "groupKey", i."entryDate"::date::text AS "entryDay",
      ARRAY_REMOVE(ARRAY[
        CASE WHEN EXISTS (SELECT 1 FROM "Sale" s WHERE s."inventoryItemId" = i."id") THEN 'tiene ventas' END,
        CASE WHEN EXISTS (SELECT 1 FROM "TradeIn" t WHERE t."receivedInventoryItemId" = i."id") THEN 'viene de un canje' END,
        CASE WHEN EXISTS (SELECT 1 FROM "ReturnCase" r WHERE r."inventoryItemId" = i."id") THEN 'tiene devolución' END,
        CASE WHEN i."reservedDepositId" IS NOT NULL OR i."reservedClientId" IS NOT NULL THEN 'reservado' END,
        CASE WHEN EXISTS (SELECT 1 FROM "ClientDeposit" d WHERE d."storeId" = i."storeId" AND d."productId" = i."id") THEN 'tiene seña' END,
        CASE WHEN EXISTS (SELECT 1 FROM "StockCountExpected" e WHERE e."inventoryItemId" = i."id")
          OR EXISTS (SELECT 1 FROM "StockCountScan" c WHERE c."inventoryItemId" = i."id") THEN 'en un control de stock' END,
        CASE WHEN i."pendingSaleRegistration" OR i."needsCompletion" THEN 'pendiente de completar' END,
        CASE WHEN EXISTS (SELECT 1 FROM "AuditEvent" a WHERE a."storeId" = i."storeId" AND a."entityType" = 'inventory'
          AND a."entityId" = i."id" AND a."action" IN (${Prisma.join(EDIT_ACTIONS)})
          AND a."actorName" <> 'Agrupado automático') THEN 'editado a mano (historial)' END
      ], NULL) AS reasons
    FROM "InventoryItem" i WHERE i."storeId" = ${store.id} AND i."archivedAt" IS NULL
      AND (i."imei" IS NULL OR btrim(i."imei") = '')
      AND i."status" IN ('DISPONIBLE', 'EN_REVISION') AND i."quantity" >= 1
    ORDER BY i."createdAt", i."id" ${lockRows ? Prisma.sql`FOR UPDATE OF i` : Prisma.empty}`);
  for (const candidate of candidates) {
    for (const field of dateColumns) {
      const value = candidate.row[field];
      if (typeof value === 'string') candidate.row[field] = new Date(`${value}Z`).toISOString();
    }
  }

  const excluded: { id: string; reasons: string[]; row: InventoryDuplicateRow; groupKey: string }[] = [];
  const groups = [];
  for (const members of bucketBy(candidates, c => c.groupKey)) {
    if (members.length >= 2) {
      for (const c of members.filter(c => c.reasons.length)) excluded.push({ id: c.row.id, reasons: c.reasons, row: c.row, groupKey: c.groupKey });
    }
    const eligible = members.filter(c => !c.reasons.length);
    if (eligible.length < 2) continue;
    const rows = eligible.map(c => c.row);
    const keep = rows[0]!;
    const differences = fieldDifferences(rows, Object.keys(keep).filter(f => f !== 'id').sort());
    const expectedVariation = fieldDifferences(rows, [...EXPECTED_VARIATION].sort());
    // entryDate participates in the key only by day. Its discarded time still needs review.
    const unexpectedDifferences = differences.filter(d => !EXPECTED_VARIATION.has(d.field));
    const unitsBefore = rows.reduce((sum, row) => sum + row.quantity, 0);
    groups.push({
      groupKey: eligible[0]!.groupKey,
      summary: Object.fromEntries(SUMMARY_FIELDS.map(field => [field, keep[field]!])),
      keepId: keep.id, dropIds: rows.slice(1).map(row => row.id), rowIds: rows.map(row => row.id),
      rowsBefore: rows.length, rowsAfter: 1, unitsBefore, unitsAfter: unitsBefore, rows,
      fieldDifferences: differences, expectedVariation, unexpectedDifferences,
      warnings: unexpectedDifferences.length ? [`Difieren campos que se perderían al conservar una sola fila: ${unexpectedDifferences.map(d => d.field).join(', ')}.`] : [],
      needsReview: unexpectedDifferences.length > 0,
    });
  }
  groups.sort((a, b) => {
    for (const field of SUMMARY_FIELDS) {
      const diff = compareText(canonical(a.summary[field]!), canonical(b.summary[field]!));
      if (diff) return diff;
    }
    return compareText(a.keepId, b.keepId);
  });
  excluded.sort((a, b) => compareRows(a.row, b.row));
  const nearDuplicateGroups = bucketBy(candidates, normalizedKey)
    .filter(members => new Set(members.map(c => c.groupKey)).size > 1)
    .map(members => ({
      groupKey: normalizedKey(members[0]!),
      warning: 'Coinciden solo tras normalizar. Las diferencias entre claves estrictas no se unifican ni reducen los totales.',
      rows: members.map(c => ({
        id: c.row.id, groupKey: c.groupKey, row: c.row, excluded: c.reasons.length > 0, reasons: c.reasons,
        differences: nearDifferences(c.row, members.map(peer => peer.row)),
      })),
    })).sort((a, b) => compareText(a.groupKey, b.groupKey));
  const excludedByReason: Record<string, number> = {};
  for (const row of excluded) for (const reason of row.reasons) excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
  const unitsBefore = Number(totals!.unitsBefore);
  // Simulate the actual keep-quantity replacement and removed quantities independently.
  const unitsAfter = groups.reduce((units, group) => units - group.rows.reduce((s, row) => s + row.quantity, 0) + group.unitsAfter, unitsBefore);
  const unitsMatch = unitsBefore === unitsAfter;
  return {
    store, generatedAt: new Date().toISOString(), readOnly: true as const, key: KEY,
    groups, nearDuplicateGroups, excluded,
    totals: {
      rowsBefore: totals!.rowsBefore, rowsAfter: totals!.rowsBefore - groups.reduce((s, group) => s + group.dropIds.length, 0),
      unitsBefore, unitsAfter, unitsMatch, candidates: candidates.length, groups: groups.length,
      nearDuplicateGroups: nearDuplicateGroups.length, rowsWithImeiSkipped: totals!.rowsWithImeiSkipped,
      excludedTotal: excluded.length, excludedByReason,
    },
    warnings: unitsMatch ? [] : ['Las unidades antes y después no coinciden. Revisá el informe antes de cualquier agrupado.'],
  };
}

export type InventoryDuplicatesResponse = Awaited<ReturnType<typeof listInventoryDuplicates>>;

const uniqueStrings = z.array(z.string().min(1)).refine(values => new Set(values).size === values.length, {
  message: 'No se permiten valores repetidos.',
});
export const inventoryDuplicatesApplyBody = z.object({
  storeEmail: z.string().trim().email(),
  expectStoreName: z.string(),
  expectRowsBefore: z.number().int(),
  expectRowsAfter: z.number().int(),
  expectUnits: z.number().int(),
  groupKeys: uniqueStrings.refine(keys => keys.length > 0, { message: 'Indicá al menos un groupKey.' }),
}).strict();

export const inventoryDuplicatesBackup = z.object({
  meta: z.object({
    storeId: z.string().min(1), storeName: z.string(), createdAt: z.string().datetime(),
    tables: z.tuple([z.literal('InventoryItem')]), groupKeys: uniqueStrings,
  }).strict(),
  auditEventIds: uniqueStrings,
  // Physical names (quantity, not Prisma's cantidad); preserve every other column.
  items: z.array(z.object({ id: z.string().min(1), storeId: z.string().min(1), quantity: z.number().int() }).passthrough()).min(1)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, { message: 'Hay ids repetidos en el backup.' }),
}).strict();
export const inventoryDuplicatesRestoreBody = z.object({
  expectStoreName: z.string(), backup: inventoryDuplicatesBackup,
}).strict();

const writeTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 300_000, maxWait: 30_000,
};

function mutationError(error: unknown): never {
  if (error instanceof DomainError) throw error;
  // Database errors can contain values from jsonb_populate_record. Do not pass
  // their message/cause to the shared logger or expose any backup contents.
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const conflict = code === 'P2034' || (error instanceof Prisma.PrismaClientKnownRequestError
    && ['40001', '40P01', '55P03'].includes(String(error.meta?.code)));
  throw new DomainError(conflict
    ? 'El inventario cambió o está bloqueado. Se revirtieron los cambios; consultá el plan nuevamente.'
    : 'No se pudo completar la operación. Se revirtieron los cambios.', conflict ? 409 : 500,
  code ? { prismaCode: code } : undefined);
}

function expectEqual(field: string, expected: unknown, actual: unknown): void {
  if (expected !== actual) throw new DomainError(`${field}: esperado ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`, 409);
}

async function storeTotals(tx: Tx, storeId: string) {
  const [totals] = await tx.$queryRaw<{ rows: number; units: bigint }[]>(Prisma.sql`
    SELECT count(*)::int AS rows, coalesce(sum("quantity"), 0)::bigint AS units
    FROM "InventoryItem" WHERE "storeId" = ${storeId}`);
  return { rows: totals!.rows, units: Number(totals!.units) };
}

export async function applyInventoryDuplicates(body: z.infer<typeof inventoryDuplicatesApplyBody>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    const store = await resolveStore(tx, { storeEmail: body.storeEmail, expectStoreName: body.expectStoreName });
    const plan = await calculateInventoryDuplicates(tx, store, true);
    const { groups, totals } = plan;
    expectEqual('rowsBefore', body.expectRowsBefore, totals.rowsBefore);
    expectEqual('rowsAfter', body.expectRowsAfter, totals.rowsAfter);
    expectEqual('unitsBefore', body.expectUnits, totals.unitsBefore);
    expectEqual('unitsAfter', body.expectUnits, totals.unitsAfter);
    if (groups.length === 0) throw new DomainError('Nada para juntar: se esperaba al menos 1 grupo, actual 0.', 409);
    const actualKeys = groups.map(group => group.groupKey).sort();
    expectEqual('groupKeys', JSON.stringify([...body.groupKeys].sort()), JSON.stringify(actualKeys));
    expectEqual('grupos con needsReview', 0, groups.filter(group => group.needsReview).length);
    expectEqual('nearDuplicateGroups', 0, plan.nearDuplicateGroups.length);
    const groupKeys = new Set(actualKeys);
    expectEqual('excluidas de grupos a juntar', 0, plan.excluded.filter(row => groupKeys.has(row.groupKey)).length);
    expectEqual('unitsMatch', true, totals.unitsMatch);

    // Read and assemble the complete backup before the first write.
    const ids = groups.flatMap(group => group.rowIds);
    const items = await tx.$queryRaw<{ row: z.infer<typeof inventoryDuplicatesBackup>['items'][number] }[]>(Prisma.sql`
      SELECT to_jsonb(i) AS row FROM "InventoryItem" i
      WHERE i."storeId" = ${store.id} AND i."id" IN (${Prisma.join(ids)}) ORDER BY i."createdAt", i."id"`);
    expectEqual('filas del backup', ids.length, items.length);
    const backup: z.infer<typeof inventoryDuplicatesBackup> = {
      meta: { storeId: store.id, storeName: store.name, createdAt: new Date().toISOString(), tables: ['InventoryItem'], groupKeys: actualKeys },
      auditEventIds: groups.map(() => `agr_${randomBytes(12).toString('hex')}`), items: items.map(item => item.row),
    };
    const before = await storeTotals(tx, store.id);
    for (const [index, group] of groups.entries()) {
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE "InventoryItem" SET "quantity" = ${group.unitsBefore}, "updatedAt" = now()
        WHERE "id" = ${group.keepId} AND "storeId" = ${store.id}`);
      expectEqual('filas conservadas', 1, updated);
      const deleted = await tx.$executeRaw(Prisma.sql`
        DELETE FROM "InventoryItem" WHERE "storeId" = ${store.id} AND "id" IN (${Prisma.join(group.dropIds)})`);
      expectEqual('filas borradas', group.dropIds.length, deleted);
      const keep = group.rows[0]!;
      const label = [keep.model, keep.capacity, keep.color, keep.condition, keep.grade && `calidad ${keep.grade}`].filter(Boolean).join(' · ');
      await tx.auditEvent.create({ data: {
        id: backup.auditEventIds[index], storeId: store.id, actorName: 'Agrupado automático',
        action: 'inventory.updated', entityType: 'inventory', entityId: group.keepId, entityLabel: label.slice(0, 160), source: 'bulk',
        detail: `Se juntaron ${group.rowsBefore} filas idénticas sin IMEI en una sola con cantidad ${group.unitsBefore}`,
        changes: [{ field: 'cantidad', label: 'Cantidad', before: String(keep.quantity), after: String(group.unitsBefore) }],
      } });
    }
    const after = await storeTotals(tx, store.id);
    expectEqual('filas totales después', before.rows - groups.reduce((sum, group) => sum + group.dropIds.length, 0), after.rows);
    expectEqual('unidades totales después', before.units, after.units);
    return {
      store, applied: true as const, rowsBefore: totals.rowsBefore, rowsAfter: totals.rowsAfter,
      unitsBefore: totals.unitsBefore, unitsAfter: totals.unitsAfter,
      groups: groups.map(({ groupKey, keepId, dropIds, rowsBefore, unitsBefore, summary }) => ({ groupKey, keepId, dropIds, rowsBefore, unitsBefore, summary })),
      backup,
    };
  }, writeTransactionOptions).catch(mutationError);
}

export async function restoreInventoryDuplicates(body: z.infer<typeof inventoryDuplicatesRestoreBody>) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    const { backup } = body;
    const store = await tx.store.findUnique({ where: { id: backup.meta.storeId }, select: { id: true, name: true } });
    if (!store) throw new DomainError('Tienda del backup: esperada 1, actual 0.', 409);
    expectEqual('nombre de tienda', body.expectStoreName, store.name);
    for (const item of backup.items) expectEqual(`storeId de ${item.id}`, store.id, item.storeId);
    const ids = backup.items.map(item => item.id);
    const existing = await tx.$queryRaw<{ id: string; storeId: string }[]>(Prisma.sql`
      SELECT "id", "storeId" FROM "InventoryItem" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
    for (const item of existing) expectEqual(`tienda actual de ${item.id}`, store.id, item.storeId);

    const columns = (await tx.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'InventoryItem' ORDER BY ordinal_position`).map(row => row.column_name);
    for (const item of backup.items) {
      expectEqual(`columnas físicas de ${item.id}`, JSON.stringify([...columns].sort()), JSON.stringify(Object.keys(item).sort()));
    }
    // Only trusted schema column names are interpolated; backup values stay parameters.
    const quote = (column: string) => `"${column.replace(/"/g, '""')}"`;
    const columnList = Prisma.raw(columns.map(quote).join(', '));
    const assignments = Prisma.raw(columns.filter(column => column !== 'id').map(column => `${quote(column)} = EXCLUDED.${quote(column)}`).join(', '));
    for (const item of backup.items) {
      const restored = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "InventoryItem" (${columnList})
        SELECT ${columnList} FROM jsonb_populate_record(NULL::"InventoryItem", ${JSON.stringify(item)}::jsonb)
        ON CONFLICT ("id") DO UPDATE SET ${assignments} WHERE "InventoryItem"."storeId" = ${store.id}`);
      expectEqual(`filas restauradas para ${item.id}`, 1, restored);
    }
    const audits = await tx.auditEvent.deleteMany({ where: {
      storeId: store.id, id: { in: backup.auditEventIds }, actorName: 'Agrupado automático',
    } });
    const [totals] = await tx.$queryRaw<{ rows: number; units: bigint }[]>(Prisma.sql`
      SELECT count(*)::int AS rows, coalesce(sum("quantity"), 0)::bigint AS units
      FROM "InventoryItem" WHERE "storeId" = ${store.id} AND "id" IN (${Prisma.join(ids)})`);
    expectEqual('filas restauradas', backup.items.length, totals!.rows);
    expectEqual('unidades restauradas', backup.items.reduce((sum, item) => sum + item.quantity, 0), Number(totals!.units));
    return { store, restored: true as const, itemsRestored: backup.items.length, auditEventsDeleted: audits.count };
  }, writeTransactionOptions).catch(mutationError);
}

export type InventoryDuplicatesApplyResponse = Awaited<ReturnType<typeof applyInventoryDuplicates>>;
