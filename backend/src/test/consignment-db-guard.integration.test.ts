import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

useIntegrationApp();
const sql = readFileSync(new URL('../../prisma/post-push.sql', import.meta.url), 'utf8');
const runGuard = () => prisma.$executeRawUnsafe(sql);

// Simulates production, where `prisma db push` created the table without guards.
async function dropGuards() {
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Consignment_pending_item_key"`);
  const checks = await prisma.$queryRawUnsafe<{ conname: string }[]>(
    `SELECT conname FROM pg_constraint WHERE conrelid = '"Consignment"'::regclass AND contype = 'c'`,
  );
  for (const { conname } of checks)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Consignment" DROP CONSTRAINT "${conname}"`);
}
const guards = async () => ({
  index: (await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'Consignment_pending_item_key'`,
  )).length,
  checks: (await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM pg_constraint WHERE conrelid = '"Consignment"'::regclass AND contype = 'c'`,
  )).length,
});
async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const f = await seedCatalogFixture(storeId);
  const row = (extra: object = {}) => prisma.consignment.create({
    data: { storeId, clientId: f.client.id, inventoryItemId: f.inventoryItem.id, amount: 100, currency: 'ARS', ...extra },
  });
  return { row };
}
afterEach(async () => {
  await prisma.consignment.deleteMany();
  await runGuard();
});

it('crea el índice parcial y los CHECK de forma idempotente', async () => {
  await dropGuards();
  expect(await guards()).toEqual({ index: 0, checks: 0 });
  await runGuard();
  await runGuard();
  expect(await guards()).toEqual({ index: 1, checks: 4 });
  const { row } = await fixture();
  await row();
  await expect(row()).rejects.toThrow();
  await expect(row({ amount: 0, paidAt: new Date() })).rejects.toThrow();
});

it('no duplica CHECK que ya existen con nombre automático de la migración', async () => {
  const before = await guards();
  await runGuard();
  expect(await guards()).toEqual(before);
});

it('si hay datos que violarían el índice, lo saltea sin fallar ni tocar filas', async () => {
  await dropGuards();
  const { row } = await fixture();
  const a = await row();
  const b = await row();
  await expect(runGuard()).resolves.toBeDefined();
  expect((await guards()).index).toBe(0);
  expect(await prisma.consignment.findMany({ orderBy: { createdAt: 'asc' } })).toHaveLength(2);
  expect(await prisma.consignment.findUnique({ where: { id: a.id } })).toEqual(a);
  expect(await prisma.consignment.findUnique({ where: { id: b.id } })).toEqual(b);
});

it('no rompe si la tabla todavía no existe', async () => {
  await expect(prisma.$executeRawUnsafe(sql.replaceAll('"Consignment"', '"ConsignmentMissing"'))).resolves.toBeDefined();
});
