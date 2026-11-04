import { expect, it, vi } from 'vitest';
import * as cashService from '../modules/cash/service.js';
import { prisma } from '../plugins/prisma.js';
import { seedStoreContext, seedCatalogFixture, buildAuthHeaders } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { createConsignments, payConsignment } from '../modules/consignments/consignments.service.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();

async function fixture(currency: 'ARS' | 'USD' = 'ARS') {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  await prisma.store.update({
    where: { id: storeId },
    data: { currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 },
  });
  const catalog = await seedCatalogFixture(storeId);
  await prisma.client.update({ where: { id: catalog.client.id }, data: { balanceCurrency: 'USD' } });
  const amount = currency === 'ARS' ? 500310 : 500.31;
  const [cons] = await createConsignments(storeId, {
    clientId: catalog.client.id,
    items: [{ productId: catalog.inventoryItem.id, amount, currency }],
  });
  return { storeId, ...catalog, cons, amount };
}

async function openCash(currency = 'ARS', method = 'EFECTIVO') {
  const app = getApp();
  const cash = await app.inject({
    method: 'POST', url: '/api/cash', headers,
    payload: { name: 'Caja QA falsa', currency, method, opening: 0 },
  });
  expect(cash.statusCode, cash.body).toBe(200);
  const id = cash.json().id as string;
  const opened = await app.inject({ method: 'POST', url: `/api/cash/${id}/open`, headers, payload: {} });
  expect(opened.statusCode, opened.body).toBe(200);
  return id;
}

function removeSale(id: string) {
  return getApp().inject({ method: 'DELETE', url: `/api/sales/${id}`, headers, payload: { reason: 'QA falsa' } });
}

async function expectReversed(storeId: string, saleId: string, registerId: string, amount: number) {
  const where = { storeId, sourceType: 'sale', sourceId: saleId };
  const rows = await prisma.cashMovement.findMany({ where });
  expect(rows).toHaveLength(2);
  const original = rows.find(row => !row.reversalOf)!;
  const reversal = rows.find(row => row.reversalOf)!;
  expect(Number(original.amount)).toBe(amount);
  expect(reversal).toMatchObject({ kind: 'ANULACION', reversalOf: original.id, registerId, sessionId: original.sessionId });
  expect(Number(reversal.amount)).toBe(-amount);
  const total = await prisma.cashMovement.aggregate({ where, _sum: { amount: true } });
  expect(Number(total._sum.amount)).toBe(0);
  expect(Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id: registerId } })).balance)).toBe(0);
}

// W4-02, copied from QA's w4-accounting.integration.test.ts; W4-01 is intentionally excluded.
it('anular cobro consignado debe dejar caja neta ARS cero', async () => {
  const f = await fixture();
  const cashId = await openCash();
  const paid = await payConsignment(f.storeId, f.cons.id, 'EFECTIVO');
  expect(paid.sale.integratedOperation).toBe(false);
  const removed = await removeSale(paid.sale.id);
  expect(removed.statusCode, removed.body).toBe(204);
  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } });
  expect(item).toMatchObject({ cantidad: 1, status: 'DISPONIBLE' });
  await expectReversed(f.storeId, paid.sale.id, cashId, f.amount);
  expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(0);
  expect(await prisma.consignment.findUniqueOrThrow({ where: { id: f.cons.id } })).toMatchObject({
    saleId: paid.sale.id, paidAt: expect.any(Date),
  });

  expect((await removeSale(paid.sale.id)).statusCode).toBe(404);
  await expectReversed(f.storeId, paid.sale.id, cashId, f.amount);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).cantidad).toBe(1);
});

it.each([
  { currency: 'ARS' as const, method: 'EFECTIVO' as const },
  { currency: 'USD' as const, method: 'TRANSFERENCIA' as const },
])('revierte una sola vez ante DELETE concurrentes ($currency, $method)', async ({ currency, method }) => {
  const f = await fixture(currency);
  const cashId = await openCash(currency, method);
  const paid = await payConsignment(f.storeId, f.cons.id, method);
  const responses = await Promise.all([removeSale(paid.sale.id), removeSale(paid.sale.id)]);
  expect(responses.map(row => row.statusCode).sort()).toEqual([204, 404]);
  await expectReversed(f.storeId, paid.sale.id, cashId, f.amount);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(1);
  expect(await prisma.auditEvent.count({ where: { storeId: f.storeId, entityId: paid.sale.id, action: 'sale.voided' } })).toBe(1);
});

it.each([false, true])('no duplica la reversión de una venta integrada (cancelada previamente: %s)', async cancelled => {
  const f = await fixture();
  const cashId = await openCash();
  const created = await getApp().inject({
    method: 'POST', url: '/api/operations/sales', headers,
    payload: { clientId: f.client.id, deviceLabel: 'Venta integrada ficticia', amount: f.amount, currency: 'ARS', paymentMethod: 'EFECTIVO' },
  });
  expect(created.statusCode, created.body).toBe(201);
  const saleId = created.json().sale.id as string;
  expect(created.json().sale.integratedOperation).toBe(true);
  if (cancelled) {
    const response = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${saleId}/cancel`, headers, payload: {} });
    expect(response.statusCode, response.body).toBe(200);
    await expectReversed(f.storeId, saleId, cashId, f.amount);
  }
  expect((await removeSale(saleId)).statusCode).toBe(204);
  expect((await removeSale(saleId)).statusCode).toBe(404);
  await expectReversed(f.storeId, saleId, cashId, f.amount);
});

it('revierte también stock, cliente y caja si falla la transacción después de compensar el cobro', async () => {
  const f = await fixture();
  const cashId = await openCash();
  const paid = await payConsignment(f.storeId, f.cons.id, 'EFECTIVO');
  const client = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
  const reverse = cashService.reverseCashSource;
  const spy = vi.spyOn(cashService, 'reverseCashSource').mockImplementationOnce(async (...args) => {
    await reverse(...args);
    throw new Error('Falla ficticia luego de revertir caja');
  });
  try {
    expect((await removeSale(paid.sale.id)).statusCode).toBe(500);
  } finally {
    spy.mockRestore();
  }
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(0);
  expect((await prisma.sale.findUniqueOrThrow({ where: { id: paid.sale.id } })).voidedAt).toBeNull();
  expect(await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).toEqual(client);
  expect(await prisma.cashMovement.count({ where: { storeId: f.storeId, sourceId: paid.sale.id } })).toBe(1);
  expect(Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id: cashId } })).balance)).toBe(f.amount);
  expect((await removeSale(paid.sale.id)).statusCode).toBe(204);
  await expectReversed(f.storeId, paid.sale.id, cashId, f.amount);
});

it('anula sin inventar movimientos si la consignación se cobró sin una caja configurada', async () => {
  const f = await fixture();
  const paid = await payConsignment(f.storeId, f.cons.id, 'EFECTIVO');
  expect((await removeSale(paid.sale.id)).statusCode).toBe(204);
  expect(await prisma.cashMovement.count({ where: { storeId: f.storeId, sourceId: paid.sale.id } })).toBe(0);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(1);
});
