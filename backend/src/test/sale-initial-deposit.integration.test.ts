import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  await prisma.store.update({ where: { id: storeId }, data: { currency: 'USD', exchangeMode: 'manual', manualSell: 1000, manualBuy: 1000 } });
  return { ...await seedCatalogFixture(storeId), storeId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function post(url: string, payload: object) { return getApp().inject({ method: 'POST', url, headers, payload }); }
async function openCash(currency: string) {
  const created = await post('/api/cash', { name: `Caja ficticia ${currency}`, currency, method: 'EFECTIVO', opening: 0 });
  expect(created.statusCode, created.body).toBe(200);
  const id = created.json().id as string;
  expect((await post(`/api/cash/${id}/open`, {})).statusCode).toBe(200);
  return id;
}
function sell(f: Fixture, payload: Record<string, unknown> = {}) {
  return post('/api/operations/sales', { clientId: f.client.id, productId: f.inventoryItem.id, amount: 500, currency: 'USD', exchangeRate: 1000,
    paymentMethod: 'EFECTIVO', status: 'PENDIENTE', requestKey: 'initial-sale', initialDeposit: { amount: 100000, currency: 'ARS' }, ...payload });
}
async function receipts(f: Fixture) {
  const response = await getApp().inject({ url: `/api/clients/${f.client.id}/deposits`, headers });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().deposits;
}

describe('seña al registrar una venta', () => {
  it.each([
    { currency: 'ARS', amount: 100000, saleCurrency: 'USD', price: 500, balance: 400, usdAmount: 100 },
    { currency: 'USD', amount: 100.25, saleCurrency: 'ARS', price: 500000, balance: 399750, usdAmount: 100.25 },
    { currency: 'USD', amount: 100.25, saleCurrency: 'USD', price: 500, balance: 399.75, usdAmount: 100.25 },
    { currency: 'ARS', amount: 100000.25, saleCurrency: 'ARS', price: 500000, balance: 399999.75, usdAmount: 100 },
  ])('registra $currency en venta $saleCurrency: recibo, caja, historial, saldo y replay', async ({ currency, amount, saleCurrency, price, balance, usdAmount }) => {
    const f = await fixture();
    const registerId = await openCash(currency);
    const payload = { amount: price, currency: saleCurrency, initialDeposit: { amount, currency } };
    const response = await sell(f, payload);
    expect(response.statusCode, response.body).toBe(201);
    const sale = response.json().sale;
    expect(sale).toMatchObject({ amount: price, status: 'PENDIENTE', openBalance: balance, depositAppliedAmount: price - balance, hasInitialDeposit: true });
    expect(response.json().clients[0]).toMatchObject({ pendingBalance: balance, balanceCurrency: saleCurrency, totalSpent: price });
    expect((await sell(f, payload)).json().sale.id).toBe(sale.id);
    expect(await receipts(f)).toEqual([expect.objectContaining({ amount, currency, exchangeRate: 1000, usdAmount, status: 'APPLIED', saleId: sale.id, appliedAmount: price - balance })]);
    const history = await getApp().inject({ url: `/api/clients/${f.client.id}/payments`, headers });
    expect(history.statusCode, history.body).toBe(200);
    expect(history.json().payments.filter((row: { kind: string }) => row.kind === 'SENA')).toHaveLength(1);
    expect(history.json().payments.filter((row: { kind: string }) => row.kind === 'APLICACION')).toHaveLength(1);
    expect(await prisma.saleTender.count({ where: { saleId: sale.id } })).toBe(0);
    const cash = await prisma.cashMovement.findMany({ where: { storeId: f.storeId } });
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ sourceType: 'deposit', currency, registerId });
    expect(Number(cash[0].amount)).toBe(amount);
    expect(Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id: registerId } })).balance)).toBe(amount);
    const list = await getApp().inject({ url: '/api/sales', headers });
    expect(list.json().sales.find((row: { id: string }) => row.id === sale.id)).toMatchObject({ hasInitialDeposit: true, openBalance: balance });
    const report = await getApp().inject({ url: '/api/reports/overview?rangeKey=all_time', headers });
    expect(report.statusCode, report.body).toBe(200);
    expect(report.json().overview.clients.pendingBalance).toBe(balance);
    // The existing pending collection must charge only the remainder, in sale currency.
    const collected = await getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${sale.id}`, headers, payload: { status: 'COMPLETADA' } });
    expect(collected.statusCode, collected.body).toBe(200);
    expect(collected.json().sale).toMatchObject({ status: 'COMPLETADA', openBalance: 0, hasInitialDeposit: true });
    expect(collected.json().clients[0].pendingBalance).toBe(0);
    const collections = await prisma.clientPayment.findMany({ where: { storeId: f.storeId, kind: 'PAGO', saleId: sale.id } });
    expect(collections).toHaveLength(1); expect(Number(collections[0].amount)).toBe(balance);
    const after = await getApp().inject({ url: '/api/reports/overview?rangeKey=all_time', headers });
    expect(after.json().overview.clients.pendingBalance).toBe(0);
  });

  it('convive con una seña reservada anterior sin volver a cobrarla, con requestKey concurrente', async () => {
    const f = await fixture();
    await openCash('ARS'); await openCash('USD');
    const old = await post(`/api/clients/${f.client.id}/deposits`, { amount: 50, currency: 'USD', exchangeRate: 1000, method: 'EFECTIVO', productId: f.inventoryItem.id, requestKey: 'old-receipt' });
    expect(old.statusCode, old.body).toBe(201);
    const payload = { depositIds: [old.json().deposit.id] };
    const results = await Promise.all([sell(f, payload), sell(f, payload)]);
    for (const response of results) expect(response.statusCode, response.body).toBe(201);
    expect(results[0].json().sale).toMatchObject({ openBalance: 350, depositAppliedAmount: 150 });
    expect(results[0].json().sale.id).toBe(results[1].json().sale.id);
    expect(await receipts(f)).toHaveLength(2);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(2);
    expect(await prisma.cashMovement.count({ where: { sourceType: 'deposit' } })).toBe(2);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).reservedDepositId).toBeNull();
  });

  it('acepta un encargue sin stock y el total exacto como seña sin deuda residual', async () => {
    const f = await fixture();
    await openCash('USD');
    const response = await sell(f, { productId: null, deviceLabel: 'Equipo por encargo ficticio', unlistedEquipment: { model: 'Equipo por encargo ficticio' }, initialDeposit: { amount: 500, currency: 'USD' } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ status: 'COMPLETADA', openBalance: 0, hasInitialDeposit: true });
    expect(response.json().clients[0].pendingBalance).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(1);
    expect(await prisma.cashMovement.count()).toBe(1);
  });

  it.each([
    { clientId: null, clientName: '' },
    { initialDeposit: { amount: 501, currency: 'USD' } },
    { initialDeposit: { amount: 0, currency: 'USD' } },
    { initialDeposit: { amount: -1, currency: 'USD' } },
    { exchangeRate: 0 },
    { requestKey: undefined },
    { tenders: [{ amount: 10, currency: 'USD', method: 'EFECTIVO' }] },
    { installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-12-03' } },
  ])('rechaza datos inválidos y revierte stock y dinero: %j', async payload => {
    const f = await fixture(); const response = await sell(f, payload);
    expect(response.statusCode, response.body).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.clientDeposit.count()).toBe(0);
    expect(await prisma.clientPayment.count()).toBe(0);
    expect(await prisma.cashMovement.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).status).toBe('DISPONIBLE');
  });

  it('rechaza señas combinadas mayores al saldo sin consumir la seña anterior', async () => {
    const f = await fixture();
    const old = await post(`/api/clients/${f.client.id}/deposits`, { amount: 450, currency: 'USD', exchangeRate: 1000, method: 'EFECTIVO', requestKey: 'old' });
    const response = await sell(f, { depositIds: [old.json().deposit.id] });
    expect(response.statusCode, response.body).toBe(400);
    expect(await receipts(f)).toEqual([expect.objectContaining({ status: 'ACTIVE' })]);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(1);
  });

  it('cobra el saldo por el endpoint usado en Ventas y al anular devuelve solo ese cobro', async () => {
    const f = await fixture(); await openCash('ARS'); await openCash('USD');
    const created = await sell(f); expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    const paid = await getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${saleId}`, headers, payload: { clientId: f.client.id, productId: f.inventoryItem.id, amount: 500, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' } });
    expect(paid.statusCode, paid.body).toBe(200);
    expect(paid.json().sale).toMatchObject({ status: 'COMPLETADA', openBalance: 0, hasInitialDeposit: true });
    const response = await post(`/api/operations/sales/sales/${saleId}/void`, {});
    expect(response.statusCode, response.body).toBe(200);
    expect(await receipts(f)).toEqual([expect.objectContaining({ status: 'CREDIT', amount: 100000, currency: 'ARS' })]);
    const refund = await prisma.clientPayment.findMany({ where: { kind: 'DEVOLUCION' } });
    expect(refund).toHaveLength(1); expect(Number(refund[0].amount)).toBe(400); expect(refund[0].currency).toBe('USD');
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
  });

  it.each(['CREDIT', 'REFUND'])('anular restaura crédito, permite %s sin falsos éxitos y conserva el importe original', async mode => {
    const f = await fixture(); await openCash('ARS'); const created = await sell(f);
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    const receiptId = (await receipts(f))[0].id;
    for (let i = 0; i < 2; i++) {
      const cancelled = await post(`/api/operations/sales/sales/${saleId}/void`, {});
      expect(cancelled.statusCode, cancelled.body).toBe(200);
      expect(cancelled.json().sale.status).toBe('CANCELADA');
    }
    expect(await receipts(f)).toEqual([expect.objectContaining({ id: receiptId, status: 'CREDIT', amount: 100000, currency: 'ARS' })]);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).status).toBe('DISPONIBLE');
    for (let i = 0; i < 2; i++) {
      const cancelled = await post(`/api/clients/${f.client.id}/deposits/${receiptId}/cancel`, { mode });
      expect(cancelled.statusCode, cancelled.body).toBe(200);
    }
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(mode === 'REFUND' ? 1 : 0);
    const movements = await prisma.cashMovement.findMany();
    expect(movements.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(mode === 'REFUND' ? 0 : 100000);
    expect(await prisma.clientDeposit.count()).toBe(1);
  });
});
