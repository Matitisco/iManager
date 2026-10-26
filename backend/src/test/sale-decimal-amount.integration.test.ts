import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();

describe('QA 04: decimal sale and commission persistence', () => {
  it.each([false, true])('keeps USD 649.50 and the 2% commission of USD 12.99 (mixed: %s)', async mixed => {
    const { store, membership } = await seedStoreContext();
    const storeId = store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { currency: 'USD' } });
    const client = await prisma.client.create({ data: { storeId, name: 'Paula Decimal QA', balanceCurrency: 'USD' } });
    const headers = buildAuthHeaders();
    const rule = await getApp().inject({ method: 'POST', url: '/api/commissions/rules', headers, payload: { rate: 2, basis: 'SALE_PERCENT', effectiveFrom: '2025-01-01T00:00:00Z' } });
    expect(rule.statusCode, rule.body).toBe(201);
    const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload: {
      clientId: client.id, deviceLabel: 'iPhone 14 QA08', amount: 649.5, currency: 'USD', exchangeRate: 1250,
      sellerMemberId: membership!.id, paymentMethod: 'EFECTIVO',
      ...(mixed ? { tenders: [{ amount: 649.5, currency: 'USD', method: 'EFECTIVO' }] } : {}),
    } });
    expect(response.statusCode, response.body).toBe(201);
    const saleId = response.json().sale.id;
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).amount)).toBe(649.5);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).totalSpent)).toBe(649.5);
    const accrual = await prisma.commissionAccrual.findFirstOrThrow({ where: { sourceSaleId: saleId, voidedAt: null } });
    expect(Number(accrual.commission)).toBe(12.99);
    const payment = await prisma.clientPayment.findFirstOrThrow({ where: { saleId, kind: 'PAGO' } });
    expect(Number(payment.amount)).toBe(649.5);
  });
});
