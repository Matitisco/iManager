import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { resolveAcquiredQuantities } from './acquired-quantity.js';

useIntegrationApp();
const migration = readFileSync(new URL('../../../prisma/migrations/20261102180000_supplier_acquired_quantity/migration.sql', import.meta.url), 'utf8');
async function backfill() {
  for (const sql of migration.replace(/--[^\n]*/g, '').split(';').filter(sql => sql.trim())) await prisma.$executeRawUnsafe(sql);
}

it('backfill nullable reconstruye ventas, reposiciones en la misma fila o separadas y conserva todos los datos', async () => {
  const { store } = await seedStoreContext();
  const storeId = store!.id;
  let serial = 0;
  const item = (cantidad: number, acquiredQuantity: number | null = null) => prisma.inventoryItem.create({ data: {
    storeId, model: 'Equipo ficticio', capacity: '', color: '', grade: '', batteryHealth: '', condition: 'NUEVO', cost: 300, price: 400, status: 'DISPONIBLE', cantidad, acquiredQuantity,
  } });
  const sale = (inventoryItemId: string, cantidad: number, extra = {}) => prisma.sale.create({ data: {
    storeId, inventoryItemId, cantidad, stockDeducted: true, dateLabel: '02/11/2026', soldAt: new Date(), amount: cantidad * 400, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', ...extra,
  } });
  const returned = (inventoryItemId: string, saleId: string, cantidad: number | null, extra = {}) => prisma.returnCase.create({ data: {
    storeId, inventoryItemId, saleId, cantidad, caseNumber: ++serial, reason: 'Sintético', openedAt: new Date(), destination: 'STOCK', resolution: 'REINTEGRO', status: 'RESUELTO', ...extra,
  } });
  const partial = await item(6);
  const originalSale = await sale(partial.id, 4);
  const split = await item(1);
  await returned(split.id, originalSale.id, 2, { status: 'ANULADO', deletedAt: new Date() });
  await sale(split.id, 1); // Returned units were sold again: 1 + 1 - 2 = 0 acquisitions.
  const sameRow = await item(1);
  const singleSale = await sale(sameRow.id, 1);
  await returned(sameRow.id, singleSale.id, null); // Legacy null return quantity means full sale.
  const cancelled = await item(10);
  await sale(cancelled.id, 4, { status: 'CANCELADA', voidedAt: new Date() });
  const pending = await item(6);
  await sale(pending.id, 4, { status: 'PENDIENTE' });
  const legacy = await item(1);
  await sale(legacy.id, 1, { stockDeducted: false });
  const legacyBulk = await item(10);
  const legacyBulkSale = await sale(legacyBulk.id, 4, { stockDeducted: false });
  const legacySplit = await item(2);
  await returned(legacySplit.id, legacyBulkSale.id, 2);
  const repaired = await item(0);
  const repairSale = await sale(repaired.id, 1);
  await returned(repaired.id, repairSale.id, 1, { destination: 'PROVEEDOR', resolution: 'REPARACION', rmaStatus: 'RECIBIDO' });
  const rma = await item(2);
  await returned(rma.id, originalSale.id, 2, { destination: 'PROVEEDOR', status: 'EN_PROVEEDOR' });
  const known = await item(6, 10);
  const negative = await item(0);
  await returned(negative.id, originalSale.id, 2);
  const overflow = await item(2147483647);
  await sale(overflow.id, 1);
  const expected = new Map([[partial.id, 10], [split.id, 0], [sameRow.id, 1], [cancelled.id, 10], [pending.id, 10], [legacy.id, 1], [legacyBulk.id, 10], [legacySplit.id, 0], [repaired.id, 1], [rma.id, 0], [known.id, 10], [negative.id, null], [overflow.id, null]]);

  const before = await prisma.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  const salesBefore = await prisma.sale.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  const returnsBefore = await prisma.returnCase.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  // Reads during a db-push rollout reconstruct nulls without mutating them.
  const valid = before.filter(row => expected.get(row.id) !== null);
  await resolveAcquiredQuantities(storeId, valid);
  for (const row of valid) expect(row.acquiredQuantity).toBe(expected.get(row.id));
  await expect(resolveAcquiredQuantities(storeId, [{ id: negative.id, acquiredQuantity: null }])).rejects.toThrow('No se puede reconstruir');
  await backfill();
  await backfill();
  const after = await prisma.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } });
  for (let index = 0; index < after.length; index++) expect(after[index]).toEqual({ ...before[index], acquiredQuantity: expected.get(after[index].id) });
  expect(await prisma.sale.findMany({ where: { storeId }, orderBy: { id: 'asc' } })).toEqual(salesBefore);
  expect(await prisma.returnCase.findMany({ where: { storeId }, orderBy: { id: 'asc' } })).toEqual(returnsBefore);

  // The db-push startup must execute the same migration, including the safe null-only predicate.
  const startup = readFileSync(new URL('../../../prisma/pre-push.sql', import.meta.url), 'utf8');
  expect(startup).toContain(migration);
  await prisma.inventoryItem.update({ where: { id: partial.id }, data: { acquiredQuantity: null } });
  // Execute whole DO blocks with PostgreSQL, rather than splitting their inner statements.
  for (const block of startup.split(/(?<=END \$\$;)/).filter(block => block.trim())) await prisma.$executeRawUnsafe(block);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: partial.id } })).acquiredQuantity).toBe(10);
});


it('agrega la columna nullable sobre una tabla anterior sin cambiar stock ni exigir datos nuevos', async () => {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "InventoryItem" (id TEXT, "storeId" TEXT, quantity INTEGER, note TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe(`INSERT INTO "InventoryItem" VALUES ('legacy-local', 'synthetic', 10, 'conservar')`);
    for (const sql of migration.replace(/--[^\n]*/g, '').split(';').filter(sql => sql.trim())) await tx.$executeRawUnsafe(sql);
    expect(await tx.$queryRawUnsafe('SELECT * FROM "InventoryItem"')).toEqual([{ id: 'legacy-local', storeId: 'synthetic', quantity: 10, note: 'conservar', acquiredQuantity: 10 }]);
    await tx.$executeRawUnsafe(`INSERT INTO "InventoryItem" (id, "storeId", quantity) VALUES ('nullable-local', 'synthetic', 1)`);
    expect(await tx.$queryRawUnsafe(`SELECT "acquiredQuantity" FROM "InventoryItem" WHERE id = 'nullable-local'`)).toEqual([{ acquiredQuantity: null }]);
  });
});
