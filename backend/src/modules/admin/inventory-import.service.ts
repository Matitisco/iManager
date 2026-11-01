import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { prepareImportSheets } from '../../lib/import-shared/import-limits.js';
import { readWorksheet } from '../../lib/import-shared/workbook-grid.js';
import { inventoryImportPayload } from '../../lib/import-shared/inventory-import-payload.js';
import { prisma } from '../../plugins/prisma.js';
import { writeAudit } from '../audit/audit.js';
import { ensureDefinitions } from '../custom-fields/custom-fields.service.js';
import { analyzeImport, applyImportPlan } from '../import/analyze-import.service.js';
import { mappingColumnIndex, sheetHeaders } from '../import/sheet-plan.js';
import { groupInventoryPreviewRows } from '../inventory/import-grouping.js';
import { importInventoryItems } from '../inventory/inventory.service.js';
import { resolveStore } from './sale-corrections.service.js';
import { detectInventoryImportDuplicates } from './inventory-import-duplicates.js';

const counts = z.object({ imported: z.number().int().nonnegative(), updated: z.number().int().nonnegative(), discarded: z.number().int().nonnegative() }).strict();
export const inventoryImportBody = z.object({
  storeEmail: z.string().trim().email(),
  expectStoreName: z.string(),
  expectStoreCurrency: z.string().regex(/^[A-Za-z]{3}$/),
  dryRun: z.boolean(),
  fileBase64: z.string().min(4).max(16 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(value => value.length % 4 === 0, 'Base64 inválido.').optional(),
  sheets: z.array(z.object({ name: z.string().trim().min(1).max(80), rows: z.array(z.array(z.string().max(2000)).max(40)).max(5000) }).strict()).min(1).max(12).optional(),
  skipSourceRows: z.array(z.number().int().min(1).max(5000)).max(5000).optional(),
  allowPossibleDuplicates: z.boolean().default(false),
  expect: counts.optional(),
}).strict().superRefine((body, ctx) => {
  if ((body.fileBase64 !== undefined) === (body.sheets !== undefined)) ctx.addIssue({ code: 'custom', message: 'Indicá exactamente fileBase64 o sheets.' });
  if (!body.dryRun && !body.expect) ctx.addIssue({ code: 'custom', path: ['expect'], message: 'expect es obligatorio para aplicar.' });
});
export type InventoryImportBody = z.infer<typeof inventoryImportBody>;

export async function inventoryImportSheets(body: Pick<InventoryImportBody, 'sheets' | 'fileBase64'>) {
  try {
    let sheets = body.sheets;
    if (!sheets) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(body.fileBase64!, 'base64') as unknown as ExcelJS.Buffer);
      sheets = workbook.worksheets.map(sheet => ({ name: sheet.name, rows: readWorksheet(sheet) }));
    }
    const prepared = prepareImportSheets(sheets);
    if (new Set(prepared.map(sheet => sheet.name.trim())).size !== prepared.length) throw new Error('duplicate sheet');
    return prepared;
  } catch {
    // Workbook errors can contain arbitrary cell contents. Never log or echo them.
    throw new DomainError('No se pudo leer el XLSX o las hojas exceden los límites de importación.', 400);
  }
}

class DryRunRollback extends Error { constructor(public result: InventoryImportReport) { super('dry-run'); } }
export class InventoryImportDuplicatesError extends DomainError {
  constructor(public possibleDuplicates: ReturnType<typeof detectInventoryImportDuplicates>['possibleDuplicates']) {
    super(`Posibles duplicados en filas ${[...new Set(possibleDuplicates.map(row => row.sourceRow))].join(', ')}. Omitilas o indicá allowPossibleDuplicates.`, 409);
  }
}
function check(ok: boolean, message: string): asserts ok { if (!ok) throw new DomainError(message, 409); }
const maskImei = (imei: string) => imei ? `***${imei.slice(-4)}` : undefined;
const safeReason = (reason: string) => reason.replace(/\d{15,}/g, value => `***${value.slice(-4)}`);

type InventoryImportReport = Awaited<ReturnType<typeof runImport>>;
async function runImport(tx: Prisma.TransactionClient, body: InventoryImportBody, admin: { email: string }) {
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
  const store = await resolveStore(tx, body);
  check(store.currency === 'ARS' || store.currency === 'USD', 'Moneda de tienda no compatible con la importación.');
  const currency = store.currency === 'USD' ? 'USD' as const : 'ARS' as const;
  const sheets = await inventoryImportSheets(body);
  const input = { section: 'inventory' as const, sheets, currency };
  const analyzed = await analyzeImport(input);
  const original = applyImportPlan({ ...input, plan: analyzed.plan });
  const skip = new Set(body.skipSourceRows ?? []);
  const skipped = original.plan.flatMap(plan => {
    if (!plan.include) return [];
    const sheet = sheets.find(sheet => sheet.name === plan.name)!;
    return sheet.rows.flatMap((row, index) => skip.has(index + 1) && index + 1 >= plan.dataStartRow && index + 1 > plan.headerRow && index + 1 <= plan.dataEndRow && row.some(cell => cell.trim())
      ? [{ sourceRow: index + 1, reason: 'omitida por pedido', sheet: plan.name }] : []);
  });
  // Omit before grouping: two identical physical lines can be a single preview row.
  // Retain the original diagnostics; blanked cells are explicit skips, not empty-row discards.
  const skippedBySheet = new Map(sheets.map(sheet => [sheet.name, new Set(skipped.filter(item => item.sheet === sheet.name).map(item => item.sourceRow))]));
  const filteredSheets = sheets.map(sheet => ({ ...sheet, rows: sheet.rows.map((row, index) => skippedBySheet.get(sheet.name)!.has(index + 1) ? row.map(() => '') : row) }));
  const analysis = skipped.length ? applyImportPlan({ ...input, sheets: filteredSheets, plan: original.plan }) : original;
  const rows = inventoryImportPayload(groupInventoryPreviewRows(analysis.rows, currency).map(group => group.row));
  const ignoredColumns = original.plan.filter(plan => plan.include).flatMap(plan => plan.mapping
    .filter(column => !column.field || column.field === 'ignore').map(column => ({
      sheet: plan.name, header: column.header,
      columnIndex: mappingColumnIndex(sheetHeaders(sheets.find(sheet => sheet.name === plan.name)!.rows, plan.headerRow), column),
    })));

  const before = await tx.inventoryItem.findMany({ where: { storeId: store.id } });
  const saleCount = await tx.sale.count({ where: { storeId: store.id } });
  const { willUpdate, possibleDuplicates } = detectInventoryImportDuplicates(rows, before);
  if (!body.dryRun && possibleDuplicates.length && !body.allowPossibleDuplicates) throw new InventoryImportDuplicatesError(possibleDuplicates);
  const updatedIds = new Set(willUpdate.map(row => row.existingItemId));
  const beforeJson = updatedIds.size ? await tx.$queryRaw<{ row: Prisma.JsonValue }[]>(Prisma.sql`
    SELECT to_jsonb(t) AS row FROM "InventoryItem" t WHERE t."storeId" = ${store.id} AND t."id" IN (${Prisma.join([...updatedIds])}) ORDER BY t."id"`) : [];
  const actor = { userId: store.ownerId, name: `Importación admin (${admin.email})`.slice(0, 255) };
  // Only explicit mapped custom fields get definitions, through this same transaction.
  // The transaction overload of importInventoryItems never calls ensureDefinitions.
  if (analysis.suggestedDefinitions?.length) await ensureDefinitions(store.id, analysis.suggestedDefinitions, tx);
  const saved = await importInventoryItems(store.id, rows, { actor }, tx);
  const diagnostic = original.diagnostics!;
  const discardedByReason: Record<string, number> = { ...diagnostic.discardedByReason, ...(skipped.length ? { requested_skip: skipped.length } : {}) };
  const discarded = [
    ...(diagnostic.rejected ?? []).map(item => ({ row: item.row, reason: safeReason(item.message) })),
    // Inventory diagnostics count empty physical rows without recording rejections.
    ...original.plan.filter(plan => plan.include).flatMap(plan => sheets.find(sheet => sheet.name === plan.name)!.rows.flatMap((row, index) =>
      index + 1 >= plan.dataStartRow && index + 1 > plan.headerRow && index + 1 <= plan.dataEndRow && row.every(cell => !cell.trim())
        ? [{ row: index + 1, reason: 'empty' }] : [])),
    ...saved.errors.map(item => ({ row: item.row, imei: maskImei(item.imei), reason: safeReason(item.message) })),
  ];
  const summary = {
    detectedRows: diagnostic.detectedRows, acceptedRows: diagnostic.acceptedRows - skipped.length,
    imported: saved.imported, updated: saved.updated, discarded: diagnostic.discardedRows + skipped.length + saved.errors.length,
    units: saved.units ?? 0, priceToDefine: saved.priceToDefine, withoutImei: saved.withoutImei ?? 0, discardedByReason,
  };
  if (body.expect) for (const field of ['imported', 'updated', 'discarded'] as const) {
    check(body.expect[field] === summary[field], `${field}: esperado ${body.expect[field]}, actual ${summary[field]}. Se revirtieron los cambios.`);
  }
  const after = await tx.inventoryItem.findMany({ where: { storeId: store.id }, select: { id: true, updatedAt: true, archivedAt: true } });
  const afterById = new Map(after.map(item => [item.id, item]));
  check(after.length === before.length + saved.imported, 'La cantidad de equipos no coincide con imported.');
  check(await tx.sale.count({ where: { storeId: store.id } }) === saleCount, 'La cantidad de ventas cambió.');
  for (const item of before) {
    const current = afterById.get(item.id);
    check(!!current && current.archivedAt?.getTime() === item.archivedAt?.getTime(), 'Un equipo existente fue borrado o archivado.');
    if (!updatedIds.has(item.id)) check(current.updatedAt.getTime() === item.updatedAt.getTime(), 'Un equipo ajeno a los IMEI importados cambió.');
  }
  const beforeIds = new Set(before.map(item => item.id));
  const backup = { meta: { storeId: store.id, createdAt: new Date().toISOString() }, createdItemIds: after.filter(item => !beforeIds.has(item.id)).map(item => item.id), updatedItemsBefore: beforeJson.map(item => item.row) };
  await writeAudit(tx, { storeId: store.id, actor, action: 'inventory.import', entityType: 'inventory', entityId: store.id, source: 'system', detail: JSON.stringify(summary) });
  return {
    dryRun: body.dryRun, store: { id: store.id, name: store.name, currency }, source: analyzed.source,
    notice: analyzed.notice, warnings: [...new Set([...(analyzed.warnings ?? []), ...(analysis.warnings ?? [])])],
    summary, diagnostics: diagnostic, discarded, willUpdate, possibleDuplicates, skipped, ignoredColumns,
    plan: analysis.plan, backup,
  };
}

/** Do not log the request, workbook, rows, report or backup. */
export async function adminInventoryImport(body: InventoryImportBody, admin: { email: string }) {
  try {
    return await prisma.$transaction(async tx => {
      const result = await runImport(tx, body, admin);
      if (body.dryRun) throw new DryRunRollback(result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 30_000 });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    if (error instanceof DomainError) throw error;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    throw new DomainError('No se pudo completar la importación. Se revirtieron los cambios.', code === 'P2034' ? 409 : 500);
  }
}
