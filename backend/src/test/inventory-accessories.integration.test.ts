import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const payload = { kind: 'ACCESSORY', model: 'Cable ficticio USB-C', accessoryType: 'Cable', compatibleWith: 'Todos', cantidad: 8, cost: 1800.25, price: 6000.50, currency: 'ARS' };
const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: object, headers = buildAuthHeaders()) => getApp().inject({ method, url, headers, ...(body ? { payload: body } : {}) });
async function fixture() {
  const { store } = await seedStoreContext();
  const { client, inventoryItem } = await seedCatalogFixture(store!.id);
  const created = await request('POST', '/api/inventory', payload);
  expect(created.statusCode, created.body).toBe(201);
  return { storeId: store!.id, clientId: client.id, deviceId: inventoryItem.id, id: created.json().inventoryItem.id as string };
}
async function sell(id: string, clientId: string, cantidad: number, requestKey: string) {
  return request('POST', '/api/operations/sales', { productId: id, clientId, cantidad, amount: cantidad * 6000, currency: 'ARS', status: 'COMPLETADA', paymentMethod: 'EFECTIVO', requestKey });
}

it('crea sin campos de celular, mantiene el default anterior, separa listas, IDs y paginado', async () => {
  const { id, deviceId, storeId } = await fixture();
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ kind: 'ACCESSORY', imei: null, condition: '', batteryHealth: '', cantidad: 8, accessoryType: 'Cable', compatibleWith: 'Todos' });
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: deviceId } })).toMatchObject({ kind: 'DEVICE' });
  for (const suffix of ['', '?skip=0&take=10', '/ids']) {
    const response = await request('GET', `/api/inventory${suffix}`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.body).not.toContain(id);
    expect(response.body).toContain(deviceId);
  }
  for (const suffix of ['?kind=ACCESSORY', '?kind=ACCESSORY&skip=0&take=10', '/ids?kind=ACCESSORY']) {
    const response = await request('GET', `/api/inventory${suffix}`);
    expect(response.body).toContain(id); expect(response.body).not.toContain(deviceId);
  }
  expect((await request('GET', '/api/inventory?kind=ALL')).json().inventory).toHaveLength(2);
  const item = (await request('GET', `/api/inventory/${id}`)).json().inventoryItem;
  expect(item.costValue).toBe(14402);
  expect(await prisma.auditEvent.count({ where: { storeId, entityId: id, action: 'inventory.created' } })).toBe(1);
});

it.each([{ cantidad: -1 }, { cantidad: 1.5 }, { imei: '490154203237518' }, { batteryHealth: '90%' }, { condition: 'USADO' }, { accessoryType: 'Inventado' }])('rechaza accesorio inválido %j', async invalid => {
  await seedStoreContext();
  expect((await request('POST', '/api/inventory', { ...payload, ...invalid })).statusCode).toBe(400);
  expect(await prisma.inventoryItem.count()).toBe(0);
});

it('vende cantidades con requestKey idempotente, rechaza sobreventa y anula restituyendo una sola vez', async () => {
  const { id, clientId } = await fixture();
  const options = await request('GET', '/api/operations/sales/options');
  expect(options.json().products).toContainEqual(expect.objectContaining({ id, kind: 'ACCESSORY', cantidad: 8 }));
  const sold = await sell(id, clientId, 3, 'accessory-sale');
  expect(sold.statusCode, sold.body).toBe(201);
  expect(sold.json().sale).toMatchObject({ cantidad: 3, stockDeducted: true });
  expect((await sell(id, clientId, 3, 'accessory-sale')).statusCode).toBe(201);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ cantidad: 5, kind: 'ACCESSORY' });
  const before = await prisma.sale.count();
  expect((await sell(id, clientId, 6, 'accessory-oversell')).statusCode).toBe(409);
  expect(await prisma.sale.count()).toBe(before);
  const monthly = await request('GET', '/api/inventory/accessories/sold');
  expect(monthly.json().sold[id]).toBe(3);
  for (let i = 0; i < 2; i++) expect((await request('POST', `/api/operations/sales/sales/${sold.json().sale.id}/void`, {})).statusCode).toBe(200);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ cantidad: 8 });
  expect((await request('GET', '/api/inventory/accessories/sold')).json().sold[id]).toBeUndefined();
});

it('no permite sobreventa concurrente ni cambiar un accesorio a celular', async () => {
  const { id, clientId } = await fixture();
  const results = await Promise.all([sell(id, clientId, 5, 'concurrent-a'), sell(id, clientId, 5, 'concurrent-b')]);
  expect(results.map(result => result.statusCode).sort()).toEqual([201, 409]);
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ cantidad: 3 });
  expect((await request('PATCH', `/api/inventory/${id}`, { kind: 'DEVICE' })).statusCode).toBe(409);
});

it('devuelve parcialmente conservando tipo, compatibilidad y cantidad sin contaminar Equipos', async () => {
  const { id, clientId } = await fixture();
  const sale = await sell(id, clientId, 3, 'return-accessory');
  const opened = await request('POST', '/api/returns', { saleId: sale.json().sale.id, cantidad: 2, reason: 'Cable defectuoso ficticio', openedOn: new Date().toISOString().slice(0, 10) });
  expect(opened.statusCode, opened.body).toBe(201);
  const resolved = await request('POST', `/api/returns/${opened.json().return.id}/resolve`, { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 12000, destination: 'STOCK', stockStatus: 'DISPONIBLE' });
  expect(resolved.statusCode, resolved.body).toBe(200);
  const all = await prisma.inventoryItem.findMany({ where: { kind: 'ACCESSORY' } });
  expect(all).toHaveLength(2);
  expect(all.reduce((sum, item) => sum + item.cantidad, 0)).toBe(7);
  expect(all.every(item => item.accessoryType === 'Cable' && item.compatibleWith === 'Todos' && !item.imei)).toBe(true);
  expect((await request('GET', '/api/inventory')).json().inventory).toHaveLength(1);
});

it('oculta costos y valuación sin permiso financiero, ignora su envío y conserva el costo al editar', async () => {
  const { id, storeId } = await fixture();
  const user = await prisma.user.create({ data: { firebaseUid: 'manager-no-cost', email: 'manager-ficticio@example.com' } });
  await prisma.storeMember.create({ data: { storeId, userId: user.id, role: 'MANAGER', sections: ['inventory'], isDefault: true } });
  const headers = buildAuthHeaders({ uid: 'manager-no-cost', email: user.email! });
  const created = await request('POST', '/api/inventory', { ...payload, cost: 999 }, headers);
  expect(created.statusCode, created.body).toBe(201);
  expect(created.json().inventoryItem).not.toHaveProperty('cost');
  expect(created.json().inventoryItem).not.toHaveProperty('costValue');
  expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: created.json().inventoryItem.id } })).cost)).toBe(0);
  const updated = await request('PATCH', `/api/inventory/${id}`, { compatibleWith: 'USB-C', cost: 999 }, headers);
  expect(updated.statusCode, updated.body).toBe(200);
  expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).cost)).toBe(1800.25);
  expect((await request('GET', '/api/inventory?kind=ACCESSORY', undefined, headers)).json().inventory.every((item: object) => !('cost' in item) && !('costValue' in item))).toBe(true);
  expect((await request('GET', '/api/inventory/accessories/sold', undefined, headers)).statusCode).toBe(200);
});

it('mantiene archivado/restauración y aísla tiendas', async () => {
  const { id } = await fixture();
  const other = await seedStoreContext({ firebaseUid: 'other-accessories', email: 'other-accessories@example.com' });
  const headers = buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! });
  expect((await request('PATCH', `/api/inventory/${id}`, { cantidad: 0 }, headers)).statusCode).toBe(404);
  expect((await request('GET', '/api/inventory?kind=ALL', undefined, headers)).body).not.toContain(id);
  expect((await request('DELETE', `/api/inventory/${id}`)).statusCode).toBe(204);
  expect((await request('GET', '/api/inventory?kind=ACCESSORY')).json().inventory).toEqual([]);
  expect((await request('GET', '/api/inventory?archived=1&kind=ACCESSORY')).body).toContain(id);
  expect((await request('POST', `/api/inventory/${id}/restore`)).statusCode).toBe(200);
});

it('no contamina Dashboard, reportes ni Control de stock y mantiene #691 para STAFF', async () => {
  const { id, clientId, storeId } = await fixture();
  const before = await request('GET', '/api/reports/overview?rangeKey=all_time');
  expect(before.statusCode, before.body).toBe(200);
  const sold = await sell(id, clientId, 2, 'separate-accessory-report');
  expect(sold.statusCode, sold.body).toBe(201);
  const after = await request('GET', '/api/reports/overview?rangeKey=all_time');
  expect(after.json().overview.summary).toEqual(before.json().overview.summary);
  expect(after.json().overview.inventory).toEqual(before.json().overview.inventory);
  const preview = await request('GET', '/api/stock-counts/preview');
  expect(preview.statusCode, preview.body).toBe(200);
  expect(preview.json().excludedNoImei).toBe(0);
  const staff = await prisma.user.create({ data: { firebaseUid: 'accessory-staff', email: 'accessory-staff@example.com' } });
  await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', sections: ['inventory'], isDefault: true } });
  const visible = await request('GET', '/api/inventory?kind=ACCESSORY', undefined, buildAuthHeaders({ uid: 'accessory-staff', email: staff.email! }));
  expect(visible.json().inventory[0]).toMatchObject({ cost: 1800.25, costValue: 10801.50 });
});
