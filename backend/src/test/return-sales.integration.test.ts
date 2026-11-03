import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const request = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object, headers = buildAuthHeaders()) => getApp().inject({ method, url, headers, ...(payload ? { payload } : {}) });
async function fixture() {
  const { store } = await seedStoreContext();
  const { client, inventoryItem } = await seedCatalogFixture(store!.id);
  await prisma.inventoryItem.update({ where: { id: inventoryItem.id }, data: { imei: null, cantidad: 8, currency: 'USD' } });
  const sale = await request('POST', '/api/operations/sales', { clientId: client.id, productId: inventoryItem.id, cantidad: 3, amount: 1500, currency: 'USD', exchangeRate: 1000, status: 'COMPLETADA', paymentMethod: 'EFECTIVO', date: '2026-10-30' });
  expect(sale.statusCode, sale.body).toBe(201);
  return { storeId: store!.id, itemId: inventoryItem.id, saleId: sale.json().sale.id as string };
}
const open = (saleId: string, cantidad: number) => request('POST', '/api/returns', { saleId, cantidad, reason: 'Pantalla', openedOn: '2026-11-02' });
const resolve = (id: string, amount = 500) => request('POST', `/api/returns/${id}/resolve`, { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount, destination: 'STOCK', stockStatus: 'EN_REVISION' });

it('lists all completed USD/ARS sales beyond page 20 and excludes cancelled, voided and other stores', async () => {
  const { storeId, saleId } = await fixture();
  const source = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
  const { id: _id, saleNumber: _number, customFields: _fields, cancellationSnapshot: _snapshot, ...copy } = source;
  for (let i = 0; i < 25; i++) await prisma.sale.create({ data: { ...copy, requestKey: null, cantidad: 1, amountCurrency: 'ARS', dateLabel: '02/11/2026' } });
  await prisma.sale.create({ data: { ...copy, requestKey: null, status: 'CANCELADA' } });
  await prisma.sale.create({ data: { ...copy, requestKey: null, voidedAt: new Date() } });
  const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.com' });
  await prisma.sale.create({ data: { ...copy, storeId: other.store!.id, inventoryItemId: null, clientId: null, requestKey: null } });
  const result = await request('GET', '/api/returns/eligible-sales');
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json().sales).toHaveLength(26);
  expect(result.json().sales).toContainEqual(expect.objectContaining({ id: saleId, amountCurrency: 'USD', cantidad: 3, remainingQuantity: 3 }));
  expect((await request('GET', '/api/returns/eligible-sales', undefined, buildAuthHeaders({ uid: 'other', email: 'other@example.com' }))).json().sales).toHaveLength(1);
  const staff = await prisma.user.create({ data: { firebaseUid: 'staff', email: 'staff@example.com' } });
  const membership = await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', sections: ['sales'], isDefault: true } });
  const auth = buildAuthHeaders({ uid: 'staff', email: 'staff@example.com' });
  expect((await request('GET', '/api/returns/eligible-sales', undefined, auth)).statusCode).toBe(200);
  await prisma.storeMember.update({ where: { id: membership.id }, data: { sections: ['inventory'] } });
  expect((await request('GET', '/api/returns/eligible-sales', undefined, auth)).statusCode).toBe(403);
});
it('returns one of three units, caps money and preserves the available lot; permits remaining units', async () => {
  const { saleId, itemId } = await fixture();
  const opened = await open(saleId, 1);
  expect(opened.statusCode, opened.body).toBe(201);
  expect(opened.json().return).toMatchObject({ cantidad: 1, refundable: 500 });
  expect((await resolve(opened.json().return.id, 501)).statusCode).toBe(400);
  expect((await resolve(opened.json().return.id)).statusCode).toBe(200);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ cantidad: 5, status: 'DISPONIBLE' });
  expect((await request('POST', `/api/operations/sales/sales/${saleId}/cancel`, {})).statusCode).toBe(409);
  const saved = await prisma.returnCase.findUniqueOrThrow({ where: { id: opened.json().return.id } });
  expect(saved.inventoryItemId).not.toBe(itemId);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: saved.inventoryItemId! } })).toMatchObject({ cantidad: 1, status: 'EN_REVISION' });
  expect((await request('GET', '/api/returns/eligible-sales')).json().sales[0].remainingQuantity).toBe(2);
  expect((await open(saleId, 3)).statusCode).toBe(409);
  const last = await open(saleId, 2);
  expect(last.statusCode, last.body).toBe(201);
  expect((await request('GET', '/api/returns/eligible-sales')).json().sales).toEqual([]);
  expect((await resolve(last.json().return.id, 1000)).statusCode).toBe(200);
  expect((await resolve(last.json().return.id, 1000)).statusCode).toBe(409);
});
it('validates quantities and preserves consumed units when settled claim cancellation is blocked', async () => {
  const { saleId } = await fixture();
  for (const cantidad of [0, -1, 1.5]) expect((await open(saleId, cantidad)).statusCode).toBe(400);
  const draft = await open(saleId, 2);
  expect((await request('DELETE', `/api/returns/${draft.json().return.id}`)).statusCode).toBe(204);
  expect((await request('GET', '/api/returns/eligible-sales')).json().sales[0].remainingQuantity).toBe(3);
  const settled = await open(saleId, 1);
  expect((await resolve(settled.json().return.id)).statusCode).toBe(200);
  expect((await request('DELETE', `/api/returns/${settled.json().return.id}`)).statusCode).toBe(409);
  expect((await request('GET', '/api/returns/eligible-sales')).json().sales[0].remainingQuantity).toBe(2);
});
it.each([null, 1000])('allows pending wholesale claims independently of collection (openBalance=%s)', async openBalance => {
  const { saleId } = await fixture();
  await prisma.sale.update({ where: { id: saleId }, data: { status: 'PENDIENTE', openBalance, paymentMethod: '' } });
  const available = await request('GET', '/api/returns/eligible-sales');
  expect(available.statusCode).toBe(200);
  expect(available.json().sales).toContainEqual(expect.objectContaining({ id: saleId, status: 'PENDIENTE' }));
  const opened = await open(saleId, 1);
  expect(opened.statusCode, opened.body).toBe(201);
  expect(opened.json().return.refundable).toBe(openBalance === null ? 0 : 166.67);
  expect((await resolve(opened.json().return.id, 167)).statusCode).toBe(400);
  expect((await request('POST', `/api/returns/${opened.json().return.id}/resolve`, { resolution: 'REPARACION', settlement: 'NINGUNO', amount: 0, destination: 'CLIENTE' })).statusCode).toBe(200);
});

it('serializes concurrent partial claims without exceeding sold units', async () => {
  const { saleId } = await fixture();
  const results = await Promise.all([open(saleId, 2), open(saleId, 2)]);
  expect(results.map(result => result.statusCode).sort()).toEqual([201, 409]);
  expect((await request('GET', '/api/returns/eligible-sales')).json().sales[0].remainingQuantity).toBe(1);
});
it('isolates a partial legacy lot and receives only that unit from RMA', async () => {
  const { saleId, itemId, storeId } = await fixture();
  const supplier = await prisma.supplier.create({ data: { storeId, name: 'Proveedor ficticio' } });
  await prisma.sale.update({ where: { id: saleId }, data: { stockDeducted: false } });
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { supplierId: supplier.id } });
  const opened = await open(saleId, 1);
  const id = opened.json().return.id;
  const result = await request('POST', `/api/returns/${id}/resolve`, { resolution: 'CAMBIO', settlement: 'NOTA_CREDITO', amount: 500, destination: 'PROVEEDOR' });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json().return.inventoryItemId).not.toBe(itemId);
  expect((await request('POST', `/api/returns/${id}/rma`, { status: 'RECIBIDO', stockStatus: 'EN_REVISION' })).statusCode).toBe(200);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: result.json().return.inventoryItemId } })).toMatchObject({ cantidad: 1, status: 'EN_REVISION' });
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ cantidad: 5, status: 'DISPONIBLE' });
});
