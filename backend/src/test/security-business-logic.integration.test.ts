import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
async function fixture() {
  const context = await seedStoreContext({ firebaseUid: 'qa-sec-1', email: 'qa-sec-1@example.com' });
  return { ...await seedCatalogFixture(context.store!.id), storeId: context.store!.id, memberId: context.membership!.id,
    headers: buildAuthHeaders({ uid: context.user.firebaseUid, email: context.user.email ?? undefined }) };
}
const baseSale = { date: '03/11/2026', deviceLabel: 'Equipo QA', amount: 100, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' };

describe('security: business logic API invariants', () => {
  it.each(['PAGADA', 'CANCELLED', 'inventado'])('rejects unknown sale status %s without stock or ledger effects', async status => {
    const f = await fixture();
    const response = await getApp().inject({ method: 'POST', url: '/api/sales', headers: f.headers,
      payload: { ...baseSale, productId: f.inventoryItem.id, clientId: f.client.id, status } });
    expect(response.statusCode, response.body).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(1);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(0);
  });

  it.each([0.001, 100.005, 10_000_000_000, 1e100, '100', -1, null])('rejects invalid sale money %s atomically', async amount => {
    const f = await fixture();
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, clientId: f.client.id, productId: f.inventoryItem.id, amount } });
    expect(response.statusCode, response.body).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.clientPayment.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(1);
  });

  it.each(['takeValue', 'differencePaid'])('rejects negative legacy trade-in %s', async field => {
    const f = await fixture();
    const trade = await prisma.tradeIn.create({ data: { storeId: f.storeId, clientId: f.client.id,
      clientName: 'Cliente QA', dateLabel: '03/11/2026', tradeAt: new Date(), deviceReceived: 'Equipo QA',
      deviceGiven: 'Otro QA', takeValue: 50, differencePaid: 50, status: 'PENDIENTE' } });
    const response = await getApp().inject({ method: 'PATCH', url: `/api/trade-ins/${trade.id}`, headers: f.headers, payload: { [field]: -50 } });
    expect(response.statusCode, response.body).toBe(400);
    const saved = await prisma.tradeIn.findUniqueOrThrow({ where: { id: trade.id } });
    expect(Number(saved.takeValue)).toBe(50);
    expect(Number(saved.differencePaid)).toBe(50);
  });

  it.each(['ARS', 'USD'])('OMIT excess keeps cash, tender and applied payment consistent (%s)', async currency => {
    const f = await fixture();
    const otherCurrency = currency === 'USD' ? 'ARS' : 'USD';
    for (const [method, boxCurrency] of [['EFECTIVO', otherCurrency], ['TRANSFERENCIA', currency]]) {
      const box = await getApp().inject({ method: 'POST', url: '/api/cash', headers: f.headers,
        payload: { name: method, currency: boxCurrency, method, opening: 0 } });
      expect(box.statusCode, box.body).toBe(200);
      expect((await getApp().inject({ method: 'POST', url: `/api/cash/${box.json().id}/open`, headers: f.headers })).statusCode).toBe(200);
    }
    const created = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers, payload: {
      ...baseSale, clientId: f.client.id, currency, exchangeRate: 1000, excess: 'OMIT', tenders: [
        { amount: 50, currency, method: 'TRANSFERENCIA' },
        { amount: currency === 'USD' ? 125000 : 0.08, currency: otherCurrency, method: 'EFECTIVO', exchangeRate: 1250 },
      ],
    } });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    const tenders = await prisma.saleTender.findMany({ where: { saleId } });
    expect(tenders.find(row => row.currency === otherCurrency)?.amount.toNumber()).toBe(currency === 'USD' ? 62500 : 0.04);
    const cash = await prisma.cashMovement.findMany({ where: { storeId: f.storeId, sourceId: saleId } });
    expect(cash.find(row => row.currency === otherCurrency)?.amount.toNumber()).toBe(currency === 'USD' ? 62500 : 0.04);
    expect(cash.find(row => row.currency === currency)?.amount.toNumber()).toBe(50);
    const payments = await prisma.clientPayment.findMany({ where: { saleId, kind: 'PAGO' } });
    expect(payments.reduce((total, row) => total + Number(row.amount), 0)).toBe(100);
  });

  it.each([
    { exchangeRate: 0 }, { exchangeRate: -1 }, { exchangeRate: 0.001 }, { exchangeRate: 1e100 },
    { unitPrice: 1e100 },
    { tradeIn: { deviceReceived: 'QA', takeValue: -1 } },
    { tradeIn: { deviceReceived: 'QA', takeValue: 0.001 } },
    { tradeIn: { deviceReceived: 'QA', takeValue: 1e100 } },
    { tenders: [{ amount: 0.001, currency: 'ARS', method: 'EFECTIVO' }] },
    { tenders: [{ amount: 1e100, currency: 'ARS', method: 'EFECTIVO' }] },
    { tenders: [{ amount: 100, currency: 'USD', method: 'EFECTIVO', exchangeRate: 0.001 }] },
    { installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-12-03', surcharge: 0.001 } },
    { installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-12-03', surcharge: 1e100 } },
  ])('rejects invalid nested money/rate %j before mutating stock', async patch => {
    const f = await fixture();
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, productId: f.inventoryItem.id, clientId: f.client.id, ...patch } });
    expect(response.statusCode, response.body).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.tradeIn.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(1);
  });

  it('rejects Infinity parsed from JSON exponent over a real local HTTP connection', async () => {
    const f = await fixture();
    const address = await getApp().listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${address}/api/operations/sales`, { method: 'POST',
      headers: { ...f.headers, 'content-type': 'application/json' },
      body: '{"deviceLabel":"QA","amount":1e999,"exchangeRate":1000}' });
    expect(response.status).toBe(400);
    expect(await prisma.sale.count()).toBe(0);
  });

  it.each([0, 0.1 + 0.2, 649.5])('preserves legitimate sale amount %s', async amount => {
    const f = await fixture();
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, amount } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale.amount).toBe(Math.round(amount * 100) / 100);
  });

  it('accepts a legitimate repeating unit price from the quantity UI', async () => {
    const f = await fixture();
    await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { imei: null, cantidad: 3, price: 0 } });
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, clientId: f.client.id, productId: f.inventoryItem.id, cantidad: 3, unitPrice: 100 / 3 } });
    expect(response.statusCode, response.body).toBe(201);
    expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).price)).toBe(33.33);
  });

  it.each([false, true])('serializes two sales competing for the last unit (IMEI=%s)', async imei => {
    const f = await fixture();
    if (!imei) await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { imei: null } });
    const responses = await Promise.all([0, 1].map(() => getApp().inject({ method: 'POST', url: '/api/operations/sales',
      headers: f.headers, payload: { ...baseSale, productId: f.inventoryItem.id, clientId: f.client.id } })));
    expect(responses.map(row => row.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.sale.count()).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).cantidad).toBe(0);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(100);
  });

  it('does not collect the same final balance twice concurrently', async () => {
    const f = await fixture();
    const created = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, clientId: f.client.id, status: 'PENDIENTE' } });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    const responses = await Promise.all([0, 1].map(() => getApp().inject({ method: 'POST', url: '/api/accounts/collections', headers: f.headers,
      payload: { clientId: f.client.id, saleId, amount: 100, currency: 'ARS', method: 'EFECTIVO' } })));
    expect(responses.map(row => row.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.clientPayment.count({ where: { saleId, kind: 'PAGO' } })).toBe(1);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
  });

  it('rejects overselling and concurrent duplicate returns and refunds', async () => {
    const f = await fixture();
    await prisma.inventoryItem.update({ where: { id: f.inventoryItem.id }, data: { imei: null, cantidad: 2 } });
    const sell = (cantidad: number) => getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, productId: f.inventoryItem.id, clientId: f.client.id, cantidad } });
    expect((await sell(3)).statusCode).toBe(409);
    const created = await sell(2);
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    const claims = await Promise.all([0, 1].map(() => getApp().inject({ method: 'POST', url: '/api/returns', headers: f.headers,
      payload: { saleId, cantidad: 2, reason: 'Falla QA', openedOn: '2026-11-03' } })));
    expect(claims.map(row => row.statusCode).sort()).toEqual([201, 409]);
    const id = claims.find(row => row.statusCode === 201)!.json().return.id;
    const resolve = (amount: number) => getApp().inject({ method: 'POST', url: `/api/returns/${id}/resolve`, headers: f.headers,
      payload: { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount, destination: 'STOCK', stockStatus: 'EN_REVISION' } });
    expect((await resolve(101)).statusCode).toBe(400);
    const refunds = await Promise.all([resolve(100), resolve(100)]);
    expect(refunds.map(row => row.statusCode).sort()).toEqual([200, 409]);
    expect(await prisma.clientPayment.count({ where: { saleId, kind: 'DEVOLUCION' } })).toBe(1);
    expect(await prisma.returnCase.count({ where: { saleId } })).toBe(1);
    expect(await prisma.inventoryItem.aggregate({ where: { storeId: f.storeId, archivedAt: null }, _sum: { cantidad: true } })).toMatchObject({ _sum: { cantidad: 2 } });
  });

  it.each(['/api/sales', '/api/trade-ins'])('replays concurrent legacy creation with a requestKey (%s)', async url => {
    const f = await fixture();
    const payload = url === '/api/sales' ? { ...baseSale, clientId: f.client.id, requestKey: 'qa-sec-repeat' }
      : { date: baseSale.date, clientId: f.client.id, deviceReceived: 'Equipo QA', deviceGiven: 'Otro QA', takeValue: 50, differencePaid: 50, requestKey: 'qa-sec-repeat' };
    const responses = await Promise.all([0, 1].map(() => getApp().inject({ method: 'POST', url, headers: f.headers, payload })));
    for (const response of responses) expect(response.statusCode, response.body).toBe(201);
    const field = url === '/api/sales' ? 'sale' : 'tradeIn';
    expect(responses[0].json()[field].id).toBe(responses[1].json()[field].id);
    expect(await prisma.sale.count()).toBe(url === '/api/sales' ? 1 : 0);
    expect(await prisma.tradeIn.count()).toBe(url === '/api/sales' ? 0 : 1);
  });

  it.each(['movement', 'collection', 'commission', 'expense', 'return'])('rejects subcent financial writes in %s', async target => {
    const f = await fixture();
    const created = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers,
      payload: { ...baseSale, clientId: f.client.id, productId: f.inventoryItem.id, status: target === 'collection' ? 'PENDIENTE' : 'COMPLETADA' } });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id;
    let url = `/api/accounts/clients/${f.client.id}/movements`;
    let payload: Record<string, unknown> = { kind: 'CARGO', amount: 0.001 };
    if (target === 'collection') { url = '/api/accounts/collections'; payload = { clientId: f.client.id, saleId, amount: 0.001, method: 'EFECTIVO' }; }
    if (target === 'commission') { url = '/api/commissions/payments'; payload = { memberId: f.memberId, period: '2026-11', amount: 0.001, currency: 'ARS', settlesCurrency: 'ARS', exchangeRate: 1000 }; }
    if (target === 'expense') { url = '/api/expenses'; payload = { date: '2026-11-03', category: 'QA', amount: 0.001, currency: 'ARS' }; }
    if (target === 'return') {
      const claim = await getApp().inject({ method: 'POST', url: '/api/returns', headers: f.headers,
        payload: { saleId, reason: 'QA', openedOn: '2026-11-03' } });
      expect(claim.statusCode, claim.body).toBe(201);
      url = `/api/returns/${claim.json().return.id}/resolve`;
      payload = { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 0.001, destination: 'PROVEEDOR' };
      // Provide a supplier so rejection must come from the monetary guard.
      const supplier = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'QA' } });
      await prisma.returnCase.update({ where: { id: claim.json().return.id }, data: { supplierId: supplier.id } });
    }
    const paymentsBefore = await prisma.clientPayment.count();
    const response = await getApp().inject({ method: 'POST', url, headers: f.headers, payload });
    expect(response.statusCode, response.body).toBe(400);
    expect(await prisma.clientPayment.count()).toBe(paymentsBefore);
    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.commissionPayment.count()).toBe(0);
    expect(await prisma.returnCase.count({ where: { resolvedAt: { not: null } } })).toBe(0);
  });
});
