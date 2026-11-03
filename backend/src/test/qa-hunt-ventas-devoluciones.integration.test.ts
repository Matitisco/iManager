import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  getApp().inject({ method, url, headers, ...(payload ? { payload } : {}) });

async function fixture(currency: 'ARS' | 'USD' = 'USD') {
  const { store } = await seedStoreContext();
  const storeId = store!.id;
  await prisma.store.update({ where: { id: storeId }, data: { currency, exchangeMode: 'manual', manualBuy: 1250, manualSell: 1250 } });
  const catalog = await seedCatalogFixture(storeId);
  await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { imei: null, cantidad: 10, cost: 60, price: 100, currency } });
  return { storeId, ...catalog };
}

async function sell(f: Awaited<ReturnType<typeof fixture>>, extra: object = {}) {
  const result = await request('POST', '/api/operations/sales', {
    clientId: f.client.id, productId: f.inventoryItem.id, amount: 100, cantidad: 1,
    currency: 'USD', exchangeRate: 1250, status: 'COMPLETADA', paymentMethod: 'EFECTIVO', ...extra,
  });
  expect(result.statusCode, result.body).toBe(201);
  return result.json().sale as { id: string };
}

async function open(saleId: string, cantidad = 1) {
  const result = await request('POST', '/api/returns', { saleId, cantidad, reason: 'Falla ficticia QA', openedOn: '2026-11-02' });
  expect(result.statusCode, result.body).toBe(201);
  return result.json().return as { id: string };
}

const resolve = (id: string, amount: number, settlement = 'REINTEGRO') => request('POST', `/api/returns/${id}/resolve`, {
  resolution: 'REINTEGRO', settlement, amount, destination: 'STOCK', stockStatus: 'EN_REVISION',
});

describe('QA exploratorio ventas/devoluciones', () => {
  for (const currency of ['ARS', 'USD'] as const) {
    for (const explicit of [false, true]) {
      it.each(['REINTEGRO', 'NOTA_CREDITO'])(`convierte %s a la moneda de cuenta del cliente: venta ${currency}, explícita=${explicit}`, async settlement => {
        const target = currency === 'USD' ? 'ARS' : 'USD';
        const f = await fixture(explicit ? currency : target);
        await prisma.client.update({ where: { id: f.client.id }, data: { totalSpent: 50, balanceCurrency: explicit ? target : null } });
        const amount = currency === 'USD' ? 100 : 125000;
        const converted = target === 'USD' ? 100 : 125000;
        const sale = await sell(f, { amount, currency });
        expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(50 + converted);
        await prisma.store.update({ where: { id: f.storeId }, data: { manualSell: 1500 } });
        const claim = await open(sale.id);
        const result = await resolve(claim.id, amount / 2, settlement);
        expect(result.statusCode, result.body).toBe(200);
        const client = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
        expect(Number(client.totalSpent)).toBe(50 + converted / 2);
        expect(Number(client.pendingBalance)).toBe(0);
        expect(result.json().return).toMatchObject({ moneyAmount: amount / 2, moneyCurrency: currency });
      });
    }
  }

  it('revierte toda la devolución si falta una cotización histórica necesaria', async () => {
    const f = await fixture('ARS');
    const sale = await sell(f);
    const claim = await open(sale.id);
    await prisma.sale.update({ where: { id: sale.id }, data: { exchangeRate: null } });
    const before = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    const result = await resolve(claim.id, 50);
    expect(result.statusCode, result.body).toBe(400);
    expect(result.json().error).toContain('cotización');
    expect(await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).toEqual(before);
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId } })).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(9);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe('ABIERTO');
  });

  it('aplica una nota una sola vez si el request repite su ID', async () => {
    const f = await fixture();
    const sale = await sell(f);
    const claim = await open(sale.id);
    const result = await resolve(claim.id, 100, 'NOTA_CREDITO');
    expect(result.statusCode, result.body).toBe(200);
    const note = result.json().return.creditNote;
    const next = await sell(f, { amount: 150, creditNoteIds: [note.id, note.id] });
    const applications = await prisma.creditNoteApplication.findMany({ where: { creditNoteId: note.id } });
    expect(applications).toHaveLength(1);
    expect(Number(applications[0].amount)).toBe(100);
    const collections = await prisma.clientPayment.findMany({ where: { saleId: next.id, kind: 'PAGO' } });
    expect(collections.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(50);
    expect(Number((await prisma.creditNote.findUniqueOrThrow({ where: { id: note.id } })).remaining)).toBe(0);
  });

  it('revalida el alcance conjunto de reclamos si se reduce la venta después de abrirlos', async () => {
    const f = await fixture();
    const sale = await sell(f, { cantidad: 4, amount: 400 });
    const first = await open(sale.id, 2);
    const second = await open(sale.id, 2);
    const edited = await request('PATCH', `/api/operations/sales/sales/${sale.id}`, { cantidad: 2, amount: 200, currency: 'USD' });
    expect(edited.statusCode, edited.body).toBe(200);
    const result = await resolve(first.id, 50);
    expect(result.statusCode, result.body).toBe(409);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: f.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(8);
    expect((await request('DELETE', `/api/returns/${second.id}`)).statusCode).toBe(204);
    expect((await resolve(first.id, 200)).statusCode).toBe(200);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: f.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(10);
  });

  it.each(['REINTEGRO', 'NOTA_CREDITO'])('HVD-04: bloquea anular %s y conserva la compensación en reportes', async settlement => {
    const f = await fixture();
    const sale = await sell(f);
    const claim = await open(sale.id);
    expect((await resolve(claim.id, 100, settlement)).statusCode).toBe(200);
    const url = '/api/reports/overview?rangeKey=all_time';
    const before = await request('GET', url);
    expect(before.statusCode, before.body).toBe(200);
    expect(before.json().overview.summary.revenue).toBe(0);
    const cancelled = await request('DELETE', `/api/returns/${claim.id}`);
    expect(cancelled.statusCode, cancelled.body).toBe(409);
    expect(cancelled.json().error).toMatch(/Anulá primero el reintegro o la nota de crédito/);
    const after = await request('GET', url);
    expect(after.statusCode, after.body).toBe(200);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(0);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: f.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(10);
    if (settlement === 'REINTEGRO') expect(await prisma.clientPayment.count({ where: { saleId: sale.id, kind: 'DEVOLUCION' } })).toBe(1);
    else expect(await prisma.creditNote.findFirst({ where: { returnCaseId: claim.id } })).toMatchObject({ status: 'ABIERTA' });
    expect(after.json().overview.summary.revenue).toBe(0);
  });
});
