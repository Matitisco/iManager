import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const getHistory = (id: string) => getApp().inject({ method: 'GET', url: `/api/clients/${id}/sales`, headers });

it('creates seven same-day USD sales with x2/x3 quantities and returns seven purchases to a clients-only member', async () => {
  const { store, membership } = await seedStoreContext();
  await prisma.store.update({ where: { id: store!.id }, data: { name: 'iShop Baires ficticia', currency: 'USD' } });
  const client = await prisma.client.create({ data: { storeId: store!.id, name: 'Jose barrera', balanceCurrency: 'USD' } });
  const product = await prisma.inventoryItem.create({ data: { storeId: store!.id, model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 400, cantidad: 20, price: 600, currency: 'USD', status: 'DISPONIBLE' } });
  const ids: string[] = [];
  for (const [i, cantidad] of [2, 3, 1, 2, 1, 3, 1].entries()) {
    const payload = { clientId: client.id, clientName: client.name, productId: product.id, deviceLabel: 'iPhone 13', date: '02/11/2026', cantidad, amount: 600 * cantidad, currency: 'USD', amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: i === 6 ? 'PENDIENTE' : 'COMPLETADA', requestKey: `purchase-test-${i}` };
    const response = await getApp().inject({ method: 'POST', url: i < 4 ? '/api/operations/sales' : '/api/sales', headers, payload });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ clientId: client.id, cantidad, amountCurrency: 'USD' });
    ids.push(response.json().sale.id);
    if (i === 0) {
      const retry = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers, payload });
      expect(retry.statusCode, retry.body).toBe(201);
      expect(retry.json().sale.id).toBe(response.json().sale.id);
    }
    if (i === 3) {
      const cached = await getApp().inject({ method: 'GET', url: '/api/sales', headers });
      expect(cached.json().sales).toHaveLength(4);
    }
  }
  expect(new Set(ids).size).toBe(7);
  expect((await getApp().inject({ method: 'GET', url: '/api/sales', headers })).json().sales).toHaveLength(7);
  await prisma.storeMember.update({ where: { id: membership!.id }, data: { role: 'STAFF', sections: ['clients'] } });
  expect((await getApp().inject({ method: 'GET', url: '/api/sales', headers })).statusCode).toBe(403);
  const history = await getHistory(client.id);
  expect(history.statusCode, history.body).toBe(200);
  expect(history.json().sales).toHaveLength(7);
  expect(history.json().sales.map((row: { id: string }) => row.id).sort()).toEqual(ids.sort());
});

it('scopes by store and client ID, retains annulled history, and never guesses null or duplicate client links', async () => {
  const { store } = await seedStoreContext();
  const client = await prisma.client.create({ data: { storeId: store!.id, name: 'Jose barrera' } });
  const duplicate = await prisma.client.create({ data: { storeId: store!.id, name: client.name } });
  const other = await prisma.store.create({ data: { name: 'Otra tienda ficticia' } });
  const foreign = await prisma.client.create({ data: { storeId: other.id, name: client.name } });
  const base = { storeId: store!.id, clientId: client.id, clientName: client.name, dateLabel: '02/11/2026', soldAt: new Date('2026-11-02T12:00:00Z'), amount: 600, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' };
  await prisma.sale.createMany({ data: [
    { ...base, id: 'usd', amountCurrency: 'USD', cantidad: 3 },
    { ...base, id: 'ars', amountCurrency: 'ARS', status: 'PENDIENTE' },
    { ...base, id: 'cancelled', status: 'CANCELADA' },
    { ...base, id: 'voided', voidedAt: new Date() },
    { ...base, id: 'unlinked', clientId: null },
    { ...base, id: 'homonym', clientId: duplicate.id },
    { ...base, id: 'foreign', storeId: other.id, clientId: foreign.id },
  ] });
  const response = await getHistory(client.id);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().sales.map((sale: { id: string }) => sale.id).sort()).toEqual(['ars', 'cancelled', 'usd', 'voided']);
  expect((await getHistory(foreign.id)).statusCode).toBe(404);
  expect((await getHistory('missing')).statusCode).toBe(404);
  expect((await getApp().inject({ method: 'GET', url: `/api/clients/${client.id}/sales` })).statusCode).toBe(401);
});

it('keeps seven batch imports linked to one unique client without date/model grouping', async () => {
  const { store } = await seedStoreContext();
  const client = await prisma.client.create({ data: { storeId: store!.id, name: 'Jose barrera' } });
  const imported = await getApp().inject({ method: 'POST', url: '/api/sales/import', headers, payload: {
    rows: Array.from({ length: 7 }, (_, i) => ({ date: '02/11/2026', clientName: client.name, device: 'iPhone 13', amount: String(600 + i), currency: 'USD', paymentMethod: 'EFECTIVO' })),
  } });
  expect(imported.statusCode, imported.body).toBe(200);
  expect(await prisma.client.count({ where: { storeId: store!.id } })).toBe(1);
  const history = await getHistory(client.id);
  expect(history.statusCode, history.body).toBe(200);
  expect(history.json().sales).toHaveLength(7);
});
