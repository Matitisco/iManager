import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { seedStoreContext, seedCatalogFixture, buildAuthHeaders } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { createConsignments, payConsignment } from '../modules/consignments/consignments.service.js';

const { getApp } = useIntegrationApp();

// W4-01, tomado de qa-nov4/w4/pruebas/backend/src/test/w4-accounting.integration.test.ts.
it('convierte el cobro consignado ARS 500310 a USD 500.31 en totalSpent', async () => {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  await prisma.store.update({ where: { id: storeId }, data: {
    currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000,
  } });
  const fixture = await seedCatalogFixture(storeId);
  await prisma.client.update({ where: { id: fixture.client.id }, data: { balanceCurrency: 'USD' } });
  const [consignment] = await createConsignments(storeId, {
    clientId: fixture.client.id,
    items: [{ productId: fixture.inventoryItem.id, amount: 500310, currency: 'ARS' }],
  });
  const cash = await getApp().inject({ method: 'POST', url: '/api/cash', headers: buildAuthHeaders(),
    payload: { name: 'Caja ficticia ARS', currency: 'ARS', method: 'EFECTIVO', opening: 0 } });
  expect(cash.statusCode, cash.body).toBe(200);
  const opened = await getApp().inject({ method: 'POST', url: `/api/cash/${cash.json().id}/open`, headers: buildAuthHeaders() });
  expect(opened.statusCode, opened.body).toBe(200);
  const paid = await payConsignment(storeId, consignment.id, 'EFECTIVO');
  expect(paid.sale).toMatchObject({ amount: 500310, amountCurrency: 'ARS', exchangeRate: 1000 });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
  expect(Number(client.totalSpent)).toBe(500.31);
  const movement = await prisma.cashMovement.findFirstOrThrow({ where: { storeId, sourceType: 'sale', sourceId: paid.sale.id } });
  expect(Number(movement.amount)).toBe(500310);
  expect(movement.currency).toBe('ARS');
});
