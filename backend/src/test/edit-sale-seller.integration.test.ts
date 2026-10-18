import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const catalog = await seedCatalogFixture(storeId);
  const user = await prisma.user.create({ data: { firebaseUid: 'seller-edit', displayName: 'Vendedor', email: 'seller-edit@test.com' } });
  const seller = await prisma.storeMember.create({ data: { storeId, userId: user.id, role: 'STAFF' } });
  const response = await getApp().inject({ method: 'POST', url: '/api/commissions/rules', headers, payload: { rate: 10, basis: 'SALE_PERCENT', effectiveFrom: '2025-01-01T00:00:00Z' } });
  expect(response.statusCode, response.body).toBe(201);
  return { ...catalog, storeId, owner: owner.membership!, seller };
}
function patch(id: string, payload: Record<string, unknown>) {
  return getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${id}`, headers, payload });
}
async function create(f: Awaited<ReturnType<typeof fixture>>, variant: string, currency: string) {
  let depositId: string | undefined;
  if (variant.includes('deposit')) {
    const receipt = await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers, payload: { amount: 50, currency, exchangeRate: 1234.56, method: 'EFECTIVO', requestKey: crypto.randomUUID() } });
    expect(receipt.statusCode, receipt.body).toBe(201); depositId = receipt.json().deposit.id;
  }
  const response = await getApp().inject({ method: 'POST', url: variant === 'legacy' ? '/api/sales' : '/api/operations/sales', headers, payload: {
    date: '15/01/2026', clientId: f.client.id, productId: f.inventoryItem.id, amount: 1500.31,
    ...(variant === 'legacy' ? { amountCurrency: currency } : { currency }), exchangeRate: 1234.56,
    paymentMethod: 'EFECTIVO', status: variant.startsWith('pending') ? 'PENDIENTE' : 'COMPLETADA',
    ...(variant.includes('trade') ? { tradeIn: { deviceReceived: 'iPhone viejo', takeValue: 300.21 } } : {}),
    ...(depositId ? { depositIds: [depositId] } : {}),
  } });
  expect(response.statusCode, response.body).toBe(201);
  const id = response.json().sale.id;
  // The current create endpoints produce integrated sales; seed the historical flag explicitly.
  if (variant === 'legacy') await prisma.sale.update({ where: { id }, data: { integratedOperation: false } });
  return prisma.sale.findUniqueOrThrow({ where: { id } });
}

describe('seller-only sale PATCH', () => {
  it.each(['integrated', 'legacy', 'trade', 'deposit', 'trade-deposit', 'pending', 'pending-deposit', 'pending-trade-deposit'].flatMap(variant => ['ARS', 'USD'].map(currency => ({ variant, currency }))))('persists, audits, refreshes and clears seller for $variant/$currency without changing sale data', async ({ variant, currency }) => {
    const f = await fixture();
    const prior = await create(f, variant, currency);
    expect(prior.integratedOperation).toBe(variant !== 'legacy');
    const client = await prisma.client.findUniqueOrThrow({ where: { id: prior.clientId! } });
    const trade = prior.tradeInId ? await prisma.tradeIn.findUniqueOrThrow({ where: { id: prior.tradeInId } }) : null;
    const invariants = { amount: prior.amount, amountCurrency: prior.amountCurrency, status: prior.status, clientId: prior.clientId, clientName: prior.clientName, inventoryItemId: prior.inventoryItemId, tradeInId: prior.tradeInId, soldAt: prior.soldAt, depositAppliedAmount: prior.depositAppliedAmount, openBalance: prior.openBalance };
    for (const sellerMemberId of [f.seller.id, f.owner.id, null]) {
      const response = await patch(prior.id, { sellerMemberId });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().sale).toMatchObject({ sellerMemberId, amount: Number(prior.amount), amountCurrency: currency, status: prior.status, clientId: prior.clientId });
      const saved = await prisma.sale.findUniqueOrThrow({ where: { id: prior.id } });
      expect(JSON.parse(JSON.stringify(saved))).toMatchObject(JSON.parse(JSON.stringify({ ...invariants, sellerMemberId })));
      const nextClient = await prisma.client.findUniqueOrThrow({ where: { id: prior.clientId! } });
      expect([Number(nextClient.totalSpent), Number(nextClient.pendingBalance)]).toEqual([Number(client.totalSpent), Number(client.pendingBalance)]);
      if (trade) {
        const nextTrade = await prisma.tradeIn.findUniqueOrThrow({ where: { id: trade.id } });
        expect([Number(nextTrade.takeValue), nextTrade.currency, nextTrade.confirmationStatus, Number(nextTrade.differencePaid)]).toEqual([Number(trade.takeValue), trade.currency, 'CONFIRMED', Number(trade.differencePaid)]);
      }
      const active = await prisma.commissionAccrual.findMany({ where: { storeId: f.storeId, sourceSaleId: prior.id, voidedAt: null } });
      if (sellerMemberId) {
        expect(active).toHaveLength(1);
        expect(active[0]).toMatchObject({ memberId: sellerMemberId, currency });
        expect(Number(active[0].commission)).toBe(150.03);
      } else expect(active).toHaveLength(0);
    }
    expect(await prisma.auditEvent.count({ where: { storeId: f.storeId, entityId: prior.id, action: 'sale.seller.changed' } })).toBe(3);
    const voided = await prisma.commissionAccrual.findMany({ where: { sourceSaleId: prior.id } });
    expect(voided).toHaveLength(2); expect(voided.every(row => row.voidedAt && row.voidReason === 'EDITED')).toBe(true);
  });
  it.each(['ARS', 'USD'])('allows insignificant float noise with applied deposits in %s, still rejecting a real price/currency change', async currency => {
    const f = await fixture(); const sale = await create(f, 'trade-deposit', currency);
    const response = await patch(sale.id, { sellerMemberId: f.seller.id, amount: Number(sale.amount) + 1e-10, currency, tradeIn: { takeValue: 300.21 + 1e-10 } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().sale).toMatchObject({ sellerMemberId: f.seller.id, amount: 1500.31, amountCurrency: currency });
    for (const change of [{ amount: 1501.31 }, { currency: currency === 'ARS' ? 'USD' : 'ARS' }, { tradeIn: { takeValue: 301.21 } }]) {
      const rejected = await patch(sale.id, change);
      expect(rejected.statusCode).toBe(409); expect(rejected.json().error).toContain('señas aplicadas');
    }
  });
  it('rejects editing a cancelled sale with 409 and leaves all records untouched', async () => {
    const f = await fixture(); const sale = await create(f, 'trade', 'USD');
    expect((await patch(sale.id, { sellerMemberId: f.seller.id })).statusCode).toBe(200);
    const cancelled = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${sale.id}/cancel`, headers });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    const snapshot = async () => ({ sale: await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } }), audits: await prisma.auditEvent.findMany({ orderBy: { id: 'asc' } }), accruals: await prisma.commissionAccrual.findMany(), client: await prisma.client.findUnique({ where: { id: f.client.id } }), inventory: await prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } }), trade: await prisma.tradeIn.findUnique({ where: { id: sale.tradeInId! } }) });
    const before = await snapshot();
    const response = await patch(sale.id, { sellerMemberId: f.owner.id });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('No se puede editar una operación cancelada');
    expect(await snapshot()).toEqual(before);
  });
});
