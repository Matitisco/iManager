import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { natanCases } from '../../../test/fixtures/import/natan/cases.js';
import { createOperation } from '../operations/operations.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import { item, snapshot } from './inventory-duplicates.test-helpers.js';
import type { ImportSheet } from '../import/sheet-plan.js';
const { getApp } = useIntegrationApp();
const dir = new URL('../../../test/fixtures/import/natan/', import.meta.url);
const grids: ImportSheet[] = JSON.parse(readFileSync(new URL('00_natan_anon.grid.json', dir), 'utf8'));
const fileBase64 = readFileSync(new URL('00_natan_anon.xlsx', dir)).toString('base64');
const fixtureCase = natanCases[0]!;
beforeEach(() => { vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('ADMIN_EMAILS', 'admin@internal.test'); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const auth = () => buildAuthHeaders({ uid: 'platform-admin', email: 'admin@internal.test' });
const body = (over: Record<string, unknown> = {}) => ({ storeEmail: 'owner@example.com', expectStoreName: 'Test Store', expectStoreCurrency: 'ARS', dryRun: true, sheets: grids, ...over });
function post(payload: unknown, headers: Record<string, string> = auth()) {
  return getApp().inject({ method: 'POST', url: '/admin/inventory-import', headers, payload: payload as object });
}
const identified: ImportSheet[] = [{ name: 'Stock', rows: [['Modelo', 'IMEI', 'Capacidad', 'Color', 'Precio'], ['iPhone 13', '990000000000018', '128GB', 'Black', '450'], ['iPhone 14', '990000000000026', '256GB', 'Blue', '550']] }];
const expected = (imported: number, updated = 0, discarded = 0) => ({ imported, updated, discarded });
async function preview(sheets: ImportSheet[] = grids, over: Record<string, unknown> = {}) {
  const response = await post(body({ sheets, ...over }));
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

describe('POST /admin/inventory-import', () => {
  it('uses the same auth/admin guards as sale-corrections', async () => {
    const before = await snapshot();
    // Standard authenticate returns 401 for missing bearer, before the admin guard.
    expect((await post(body(), {})).statusCode).toBe(401);
    expect((await post(body(), buildAuthHeaders())).statusCode).toBe(403);
    expect(await snapshot()).toEqual(before);
  });
  it('validates strict input, exclusive file choice, dryRun and mandatory apply counts', async () => {
    await seedStoreContext();
    const before = await snapshot();
    for (const over of [{ dryRun: false }, { dryRun: undefined }, { fileBase64 }, { sheets: undefined }, { extra: true }, { expect: expected(-1) }, { sheets: [{ name: 'Stock', rows: [], extra: true }] }, { fileBase64: 'bad base64', sheets: undefined }]) expect((await post(body(over))).statusCode).toBe(400);
    expect((await post(body({ fileBase64: Buffer.from('not xlsx').toString('base64'), sheets: undefined }))).statusCode).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
  it('requires exactly one owner store and exact name/currency, without writes on failure', async () => {
    const context = await seedStoreContext();
    const before = await snapshot();
    for (const [over, status] of [[{ storeEmail: 'absent@example.com' }, 404], [{ expectStoreName: 'Other' }, 409], [{ expectStoreCurrency: 'USD' }, 409]] as const) {
      expect((await post(body(over))).statusCode).toBe(status);
      expect(await snapshot()).toEqual(before);
    }
    const other = await prisma.store.create({ data: { name: 'Other' } });
    await prisma.storeMember.create({ data: { storeId: other.id, userId: context.user.id, role: 'OWNER' } });
    const ambiguous = await snapshot();
    expect((await post(body())).statusCode).toBe(409);
    expect(await snapshot()).toEqual(ambiguous);
  });
  it('rolls back every table in dryRun and produces the same grid/XLSX summary', async () => {
    await seedStoreContext();
    const before = await snapshot();
    const grid = await preview();
    const xlsx = await preview(grids, { sheets: undefined, fileBase64 });
    expect(grid.summary).toEqual(xlsx.summary);
    expect(grid.plan).toEqual(xlsx.plan);
    expect(grid.source).toBe('heuristic');
    expect(grid.summary).toMatchObject({ detectedRows: fixtureCase.detected, acceptedRows: fixtureCase.accepted, discardedByReason: fixtureCase.reasons, updated: 0, discarded: 0 });
    expect(grid.summary.imported).toBeGreaterThan(0);
    expect(grid.summary.units).toBe(fixtureCase.accepted);
    expect(grid.backup.createdItemIds).toHaveLength(grid.summary.imported);
    expect(grid.ignoredColumns.length).toBeGreaterThan(0);
    expect(grid.backup.updatedItemsBefore).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
  it('commits exactly the preview result with a system summary audit and owner actor', async () => {
    const { user } = await seedStoreContext();
    const dry = await preview();
    const response = await post(body({ dryRun: false, expect: expected(dry.summary.imported) }));
    expect(response.statusCode, response.body).toBe(200);
    const applied = response.json();
    expect(applied.summary).toEqual(dry.summary);
    expect(await prisma.inventoryItem.count()).toBe(applied.summary.imported);
    expect(applied.backup.createdItemIds).toHaveLength(applied.summary.imported);
    expect(await prisma.auditEvent.findMany({ where: { action: 'inventory.import' }, select: { actorName: true, actorUserId: true, source: true } })).toEqual([{ actorName: 'Importación admin (admin@internal.test)', actorUserId: user.id, source: 'system' }]);
    expect((await prisma.inventoryItem.findMany()).every(row => Object.keys(row.customFields as object).every(key => ['serial', 'originalStatus'].includes(key)))).toBe(true);
  });
  it('rolls back suppliers/items/audit for every expected count mismatch', async () => {
    await seedStoreContext();
    const dry = await preview();
    const before = await snapshot();
    for (const expectCounts of [expected(dry.summary.imported + 1), expected(dry.summary.imported, 1), expected(dry.summary.imported, 0, 1)]) {
      expect((await post(body({ dryRun: false, expect: expectCounts }))).statusCode).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
  });
  it('reimports identified inventory as updates with an exact SQL before-state backup', async () => {
    await seedStoreContext();
    expect((await post(body({ sheets: identified, dryRun: false, expect: expected(2) }))).statusCode).toBe(200);
    const before = await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } });
    const sqlBefore = await prisma.$queryRaw<{ row: unknown }[]>`SELECT to_jsonb(t) AS row FROM "InventoryItem" t ORDER BY t."id"`;
    const dry = await preview(identified);
    expect(dry.summary).toMatchObject(expected(0, 2));
    expect(dry.willUpdate).toHaveLength(2);
    expect(dry.possibleDuplicates).toEqual([]);
    const response = await post(body({ sheets: identified, dryRun: false, expect: expected(0, 2) }));
    expect(response.statusCode, response.body).toBe(200);
    expect(await prisma.inventoryItem.count()).toBe(2);
    expect(response.json().backup.updatedItemsBefore).toEqual(sqlBefore.map(item => item.row));
    expect(response.json().backup.updatedItemsBefore.map((row: { id: string }) => row.id)).toEqual(before.map(row => row.id));
    expect(response.json().backup.createdItemIds).toEqual([]);
  });
  it('blocks fixture reimport unless identifier-free rows are skipped or consented', async () => {
    await seedStoreContext();
    const initial = await preview();
    expect((await post(body({ dryRun: false, expect: expected(initial.summary.imported) }))).statusCode).toBe(200);
    const dry = await preview();
    expect(dry.willUpdate.length).toBeGreaterThan(0);
    expect(dry.possibleDuplicates.length).toBeGreaterThan(0);
    const before = await snapshot();
    const blocked = await post(body({ dryRun: false, expect: expected(dry.summary.imported, dry.summary.updated) }));
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().possibleDuplicates).toEqual(dry.possibleDuplicates);
    expect(await snapshot()).toEqual(before);
    const skipSourceRows = [...new Set(dry.possibleDuplicates.map((row: { sourceRow: number }) => row.sourceRow))];
    const skipped = await preview(grids, { skipSourceRows });
    expect(skipped.possibleDuplicates).toEqual([]);
    expect(skipped.skipped).toHaveLength(skipSourceRows.length);
    expect(skipped.skipped.every((row: { reason: string }) => row.reason === 'omitida por pedido')).toBe(true);
    const response = await post(body({ dryRun: false, skipSourceRows, expect: expected(skipped.summary.imported, skipped.summary.updated, skipped.summary.discarded) }));
    expect(response.statusCode, response.body).toBe(200);
    expect(await prisma.inventoryItem.count()).toBe(initial.summary.imported);
  });
  it('reports archived manual stock without IMEI and supports skip or explicit consent', async () => {
    const { store } = await seedStoreContext();
    const manual = await item(store!.id, { model: 'iPhone 13', capacity: '128GB', color: 'Black', imei: null, grade: 'B', archivedAt: new Date() });
    const dry = await preview(identified);
    expect(dry.possibleDuplicates).toMatchObject([{ sourceRow: 2, existingItemId: manual.id, existingHasImei: false, archived: true, reason: 'existing_without_imei' }]);
    const before = await snapshot();
    expect((await post(body({ sheets: identified, dryRun: false, expect: expected(2) }))).statusCode).toBe(409);
    expect(await snapshot()).toEqual(before);
    const skipped = await preview(identified, { skipSourceRows: [2] });
    expect(skipped.summary).toMatchObject(expected(1, 0, 1));
    expect(skipped.possibleDuplicates).toEqual([]);
    const applied = await post(body({ sheets: identified, dryRun: false, allowPossibleDuplicates: true, expect: expected(2) }));
    expect(applied.statusCode, applied.body).toBe(200);
    expect(await prisma.inventoryItem.count()).toBe(3);
    expect(await prisma.inventoryItem.findUnique({ where: { id: manual.id } })).toEqual(manual);
  });
  it('skips a physical row before grouping identical identifier-free rows', async () => {
    await seedStoreContext();
    const sheets = [{ name: 'Stock', rows: [['Modelo', 'Color', 'Precio'], ['iPhone 13', 'Blue', '450'], ['iPhone 13', 'Blue', '450']] }];
    expect((await preview(sheets)).summary).toMatchObject({ imported: 1, units: 2, acceptedRows: 2 });
    const skipped = await preview(sheets, { skipSourceRows: [3] });
    expect(skipped.summary).toMatchObject({ imported: 1, units: 1, acceptedRows: 1, discarded: 1 });
    const applied = await post(body({ sheets, skipSourceRows: [3], dryRun: false, expect: expected(1, 0, 1) }));
    expect(applied.statusCode, applied.body).toBe(200);
    expect((await prisma.inventoryItem.findMany()).map(row => row.cantidad)).toEqual([1]);
  });
  it('reports empty-row discards separately from requested skips and counts quantities as units', async () => {
    await seedStoreContext();
    const sheets = [{ name: 'Stock', rows: [['Modelo', 'IMEI', 'Cantidad'], ['iPhone 13', '', '5'], ['', '', ''], ['iPhone 14', '', '3']] }];
    const dry = await preview(sheets);
    expect(dry.summary).toMatchObject({ detectedRows: 3, acceptedRows: 2, imported: 2, units: 8, discarded: 1, discardedByReason: { empty: 1 } });
    expect(dry.discarded).toEqual([{ row: 3, reason: 'empty' }]);
    const response = await post(body({ sheets, dryRun: false, expect: expected(2, 0, 1) }));
    expect(response.statusCode, response.body).toBe(200);
    expect(await prisma.inventoryItem.count()).toBe(2);
    expect((await prisma.inventoryItem.findMany()).reduce((sum, item) => sum + item.cantidad, 0)).toBe(8);
  });
  it('preserves existing Sale and sold stock', async () => {
    const { store, user } = await seedStoreContext();
    const sold = await item(store!.id, { model: 'Sold synthetic', cantidad: 2 });
    await createOperation(store!.id, 'sales', { productId: sold.id, cantidad: 1, amount: 450, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' } as never, { userId: user.id, name: 'Owner' });
    const saleBefore = await prisma.sale.findMany();
    const stockBefore = await prisma.inventoryItem.findUnique({ where: { id: sold.id } });
    expect((await post(body({ sheets: identified, dryRun: false, expect: expected(2) }))).statusCode).toBe(200);
    expect(await prisma.sale.findMany()).toEqual(saleBefore);
    expect(await prisma.inventoryItem.findUnique({ where: { id: sold.id } })).toEqual(stockBefore);
  });
  it('rolls back on a postcondition failure after unrelated inventory is changed', async () => {
    const { store } = await seedStoreContext();
    const unrelated = await item(store!.id, { model: 'Unrelated' });
    const before = await snapshot();
    const realImport = inventoryService.importInventoryItems;
    vi.spyOn(inventoryService, 'importInventoryItems').mockImplementationOnce(async (storeId, rows, options, tx) => {
      const result = await realImport(storeId, rows, options, tx);
      await tx!.inventoryItem.update({ where: { id: unrelated.id }, data: { model: 'Unexpected change' } });
      return result;
    });
    expect((await post(body({ sheets: identified, dryRun: false, expect: expected(2) }))).statusCode).toBe(409);
    expect(await snapshot()).toEqual(before);
  });
});
