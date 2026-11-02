import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const owner = buildAuthHeaders();
function request(method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object, headers = owner) {
  return getApp().inject({ method, url, headers, ...(payload ? { payload } : {}) });
}
const previousAdmin = process.env.ADMIN_EMAILS;
afterEach(() => { if (previousAdmin === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previousAdmin; });

async function fixture() {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  const catalog = await seedCatalogFixture(storeId);
  await prisma.store.update({ where: { id: storeId }, data: { currency: 'USD' } });
  await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { cantidad: 10, imei: null, currency: 'USD' } });
  const staff = await prisma.user.create({ data: { firebaseUid: 'claims-staff', email: 'staff@example.test' } });
  await prisma.storeMember.create({ data: { userId: staff.id, storeId, role: 'STAFF', sections: ['sales'], sensitiveAccess: false, isDefault: true } });
  return { storeId, ...catalog, staff: buildAuthHeaders({ uid: 'claims-staff', email: 'staff@example.test' }) };
}
const open = (saleId: string, cantidad = 1, auth = owner) => request('POST', '/api/returns', { saleId, cantidad, reason: 'Falla de prueba', openedOn: '2026-11-02' }, auth);

describe('reclamos: cobro, origen y permisos', () => {
  it.each([
    ['COMPLETADA', 'USD', '', false, null],
    ['COMPLETADA', 'ARS', 'EFECTIVO', true, null],
    ['PENDIENTE', 'USD', 'CUENTA_CORRIENTE', true, null],
    ['PENDIENTE', 'USD', '', true, 1620],
  ] as const)('lista y abre %s %s método=%s cliente=%s saldo=%s como owner/staff', async (status, currency, method, linked, balance) => {
    const f = await fixture();
    for (const auth of [owner, f.staff]) {
      const sale = await prisma.sale.create({ data: { storeId: f.storeId, status, amountCurrency: currency, paymentMethod: method, clientId: linked ? f.client.id : null, amount: 2025, openBalance: balance, cantidad: 5, dateLabel: '30/10/2026', soldAt: new Date('2026-10-30T15:00:00Z') } });
      const list = await request('GET', '/api/sales', undefined, auth);
      expect(list.statusCode, list.body).toBe(200);
      expect(list.json().sales).toEqual(expect.arrayContaining([expect.objectContaining({ id: sale.id, status, cantidad: 5 })]));
      const result = await open(sale.id, 2, auth);
      expect(result.statusCode, result.body).toBe(201);
      expect(result.json().return).toMatchObject({ cantidad: 2, saleCurrency: currency, refundable: status === 'PENDIENTE' ? balance == null ? 0 : 162 : 810 });
      expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toMatchObject({ status, openBalance: balance == null ? null : expect.anything() });
    }
  });

  it.each([false, true])('conserva elegibilidad después de corregir cantidad/precio con collectDifference=%s', async collectDifference => {
    const f = await fixture();
    const sold = await request('POST', '/api/operations/sales', { productId: f.inventoryItem.id, clientId: f.client.id, cantidad: 5, amount: 405, currency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' });
    expect(sold.statusCode, sold.body).toBe(201);
    const sale = sold.json().sale;
    process.env.ADMIN_EMAILS = 'admin@internal.test';
    const corrected = await request('POST', '/admin/sale-corrections', { storeEmail: 'owner@example.com', expectStoreName: 'Test Store', expectStoreCurrency: 'USD', dryRun: false, sales: [{ saleNumber: sale.saleNumber, expectModel: 'iPhone 14', expectQuantity: 5, expectAmount: 405, expectStatus: 'COMPLETADA', unitPrice: 405, collectDifference }] }, buildAuthHeaders({ uid: 'platform-admin', email: 'admin@internal.test' }));
    expect(corrected.statusCode, corrected.body).toBe(200);
    const updated = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(updated.status).toBe(collectDifference ? 'COMPLETADA' : 'PENDIENTE');
    expect(Number(updated.openBalance)).toBe(collectDifference ? 0 : 1620);
    const opened = await open(sale.id, 1, f.staff);
    expect(opened.statusCode, opened.body).toBe(201);
    expect(opened.json().return).toMatchObject({ cantidad: 1, refundable: collectDifference ? 405 : 81 });
  });

  it('acepta venta del endpoint de importación sin cliente ni método de pago', async () => {
    await fixture();
    const imported = await request('POST', '/api/sales/import', { rows: [{ date: '02/11/2026', device: 'Importado ficticio', amount: '500', currency: 'USD', paymentMethod: '', status: 'COMPLETADA' }] });
    expect(imported.statusCode, imported.body).toBe(200);
    const sale = await prisma.sale.findFirstOrThrow({ where: { deviceLabel: 'Importado ficticio' } });
    expect(sale.clientId).toBeNull();
    expect((await open(sale.id)).statusCode).toBe(201);
  });

  it('restituye solo unidades reclamadas y limita su importe sin modificar el lote disponible', async () => {
    const f = await fixture();
    const sold = await request('POST', '/api/operations/sales', { productId: f.inventoryItem.id, clientId: f.client.id, cantidad: 5, amount: 2500, currency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' });
    expect(sold.statusCode, sold.body).toBe(201);
    const sale = sold.json().sale;
    const first = await open(sale.id, 2);
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json().return).toMatchObject({ cantidad: 2, refundable: 1000 });
    expect((await open(sale.id, 4)).statusCode).toBe(409);
    for (const cantidad of [0, -1, 1.5, 6]) expect((await open(sale.id, cantidad)).statusCode).toBeGreaterThanOrEqual(400);
    const id = first.json().return.id;
    const resolve = (amount: number, auth = owner) => request('POST', `/api/returns/${id}/resolve`, { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount, destination: 'STOCK', stockStatus: 'EN_REVISION' }, auth);
    expect((await resolve(1000, f.staff)).statusCode).toBe(403);
    expect((await resolve(1001)).statusCode).toBe(400);
    const resolved = await resolve(1000);
    expect(resolved.statusCode, resolved.body).toBe(200);
    const returned = resolved.json().return;
    expect(returned).toMatchObject({ itemCost: 800, saleQuantity: 5 });
    expect(returned.inventoryItemId).not.toBe(f.inventoryItem.id);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: returned.inventoryItemId } })).toMatchObject({ cantidad: 2, status: 'EN_REVISION', currency: 'USD' });
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).toMatchObject({ cantidad: 5, status: 'DISPONIBLE' });
    expect((await open(sale.id, 3)).statusCode).toBe(201);
    expect((await open(sale.id)).statusCode).toBe(409);
    expect((await request('DELETE', `/api/returns/${id}`)).statusCode).toBe(204);
    expect((await open(sale.id)).statusCode).toBe(409);
  });

  it('rechaza anuladas/canceladas, tiendas ajenas y usuarios sin acceso a ventas', async () => {
    const f = await fixture();
    for (const data of [{ status: 'CANCELADA' }, { status: 'ANULADA' }, { status: 'COMPLETADA', voidedAt: new Date() }]) {
      const sale = await prisma.sale.create({ data: { storeId: f.storeId, amount: 500, dateLabel: '02/11/2026', soldAt: new Date('2026-11-02T15:00:00Z'), paymentMethod: '', ...data } });
      expect((await open(sale.id)).statusCode).toBe(400);
    }
    const other = await seedStoreContext({ firebaseUid: 'other-claims', email: 'other@claims.test' });
    const foreign = await prisma.sale.create({ data: { storeId: other.store!.id, amount: 500, dateLabel: '02/11/2026', soldAt: new Date('2026-11-02T15:00:00Z'), status: 'COMPLETADA', paymentMethod: '' } });
    expect((await open(foreign.id)).statusCode).toBe(404);
    await prisma.storeMember.updateMany({ where: { storeId: f.storeId, role: 'STAFF' }, data: { sections: ['inventory'] } });
    expect((await request('GET', '/api/sales', undefined, f.staff)).statusCode).toBe(403);
    expect((await open(foreign.id, 1, f.staff)).statusCode).toBe(403);
  });
});
