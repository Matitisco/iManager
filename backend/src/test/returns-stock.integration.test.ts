import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const resolveBody = { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 200, destination: 'STOCK', stockStatus: 'EN_REVISION' };
const post = (url: string, payload: object, headers = buildAuthHeaders()) => getApp().inject({ method: 'POST', url, payload, headers });

async function fixture(stock = 10, sold = 10, cantidad: number | undefined = 2) {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const catalog = await seedCatalogFixture(storeId);
  await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { imei: null, cantidad: stock, cost: 60, price: 100 } });
  const saleResponse = await post('/api/operations/sales', { clientId: catalog.client.id, productId: catalog.inventoryItem.id, cantidad: sold, unitPrice: 100, amount: sold * 100, status: 'COMPLETADA' });
  expect(saleResponse.statusCode, saleResponse.body).toBe(201);
  const sale = saleResponse.json().sale;
  const opened = await post('/api/returns', { saleId: sale.id, reason: 'Devolución física ficticia', openedOn: '2026-11-02', ...(cantidad === undefined ? {} : { cantidad }) });
  expect(opened.statusCode, opened.body).toBe(201);
  return { storeId, catalog, sale, claim: opened.json().return };
}

describe('unidades físicas devueltas', () => {
  it('repone dos de diez, persiste alcance y rechaza duplicados y anulación sin duplicar dinero ni stock', async () => {
    const { catalog, sale, claim } = await fixture();
    expect(claim).toMatchObject({ cantidad: 2, saleQuantity: 10 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).cantidad).toBe(0);
    const resolved = await post(`/api/returns/${claim.id}/resolve`, resolveBody);
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().return.cantidad).toBe(2);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: resolved.json().return.inventoryItemId } })).toMatchObject({ cantidad: 2, status: 'EN_REVISION' });
    expect((await post(`/api/returns/${claim.id}/resolve`, resolveBody)).statusCode).toBe(409);
    const cancelled = await getApp().inject({ method: 'PATCH', url: `/api/sales/${sale.id}`, payload: { status: 'CANCELADA' }, headers: buildAuthHeaders() });
    expect(cancelled.statusCode, cancelled.body).toBe(409);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: catalog.inventoryItem.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(2);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(1);
  });

  it('separa unidades devueltas del remanente y conserva categoría, proveedor, compra y campos', async () => {
    const { storeId, catalog, claim } = await fixture(20);
    const supplier = await prisma.supplier.create({ data: { storeId, name: 'Proveedor ficticio' } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id, customFields: { nota: 'Ficticia' } } });
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } });
    const result = await post(`/api/returns/${claim.id}/resolve`, resolveBody);
    expect(result.statusCode, result.body).toBe(200);
    const returnedId = result.json().return.inventoryItemId;
    expect(returnedId).not.toBe(before.id);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: returnedId } })).toMatchObject({ cantidad: 2, status: 'EN_REVISION', cost: before.cost, price: before.price, categoryId: before.categoryId, supplierId: supplier.id, customFields: before.customFields });
    expect((await prisma.inventoryItem.aggregate({ where: { storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(12);
  });

  it('permite precisar dos unidades al resolver un reclamo de venta completa', async () => {
    const { catalog, claim } = await fixture(10, 10, 10);
    const result = await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, cantidad: 2 });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().return.cantidad).toBe(2);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: catalog.inventoryItem.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(2);
  });

  it('serializa resoluciones concurrentes sin duplicar unidades ni compensación', async () => {
    const { catalog, claim } = await fixture();
    const results = await Promise.all([post(`/api/returns/${claim.id}/resolve`, resolveBody), post(`/api/returns/${claim.id}/resolve`, resolveBody)]);
    expect(results.map(result => result.statusCode).sort()).toEqual([200, 409]);
    expect((await prisma.inventoryItem.aggregate({ where: { storeId: catalog.inventoryItem.storeId }, _sum: { cantidad: true } }))._sum.cantidad).toBe(2);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(1);
  });

  it('preserva la reserva del remanente cuando devuelve unidades de una venta previa', async () => {
    const { catalog, claim } = await fixture(20);
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { status: 'RESERVADO', reservedClientId: catalog.client.id, reservedClientName: catalog.client.name, reservedDepositId: 'fictitious-reservation', reservedAt: new Date() } });
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } });
    const result = await post(`/api/returns/${claim.id}/resolve`, resolveBody);
    expect(result.statusCode, result.body).toBe(200);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: result.json().return.inventoryItemId } })).toMatchObject({ cantidad: 2, status: 'EN_REVISION', reservedDepositId: null });
  });

  it('conserva cantidad histórica para venta de una unidad sin descuento previo', async () => {
    const { catalog, sale, claim } = await fixture(1, 1, 1);
    await prisma.sale.update({ where: { id: sale.id }, data: { stockDeducted: false } });
    await prisma.returnCase.update({ where: { id: claim.id }, data: { cantidad: null } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { cantidad: 1, imei: '359123456789012' } });
    const result = await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, amount: 100 });
    expect(result.statusCode, result.body).toBe(200);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).toMatchObject({ cantidad: 1, status: 'EN_REVISION' });
  });

  it.each([0, -1, 1.5, 3, 2147483648])('rechaza cantidad inválida %s sin efectos', async cantidad => {
    const { catalog, claim } = await fixture();
    const result = await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, cantidad });
    expect(result.statusCode, result.body).toBe(400);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).cantidad).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe('ABIERTO');
  });

  it('rechaza cantidades de apertura superiores a lo vendido y conserva efectos al archivar', async () => {
    const { sale, claim } = await fixture();
    expect((await post(`/api/returns/${claim.id}/resolve`, resolveBody)).statusCode).toBe(200);
    expect((await getApp().inject({ method: 'DELETE', url: `/api/returns/${claim.id}`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    for (const cantidad of [0, 1.5, 11, 9]) {
      const result = await post('/api/returns', { saleId: sale.id, cantidad, reason: 'Otro reclamo', openedOn: '2026-11-02' });
      expect(result.statusCode, result.body).toBeGreaterThanOrEqual(400);
    }
    expect((await post('/api/returns', { saleId: sale.id, cantidad: 8, reason: 'Restantes', openedOn: '2026-11-02' })).statusCode).toBe(201);
  });

  it('revierte la reposición si falla el estado y aísla la tienda', async () => {
    const { catalog, claim } = await fixture();
    expect((await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, stockStatus: 'VENDIDO' })).statusCode).toBe(400);
    const other = await seedStoreContext({ firebaseUid: 'return-other', email: 'other@example.com' });
    expect((await post(`/api/returns/${claim.id}/resolve`, resolveBody, buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! }))).statusCode).toBe(404);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).cantidad).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
  });

  it('rechaza resolver si la venta se anuló después de abrir el reclamo', async () => {
    const { catalog, sale, claim } = await fixture();
    const cancelled = await getApp().inject({ method: 'PATCH', url: `/api/sales/${sale.id}`, payload: { status: 'CANCELADA' }, headers: buildAuthHeaders() });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    const refunds = await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } });
    expect((await post(`/api/returns/${claim.id}/resolve`, resolveBody)).statusCode).toBe(409);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).cantidad).toBe(10);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(refunds);
  });

  it('revalida unidades vendidas si se edita la venta después de abrir el reclamo', async () => {
    const { catalog, sale, claim } = await fixture(10, 10, 10);
    const edited = await getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${sale.id}`, payload: { cantidad: 1, amount: 100, unitPrice: 100 }, headers: buildAuthHeaders() });
    expect(edited.statusCode, edited.body).toBe(200);
    expect((await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, cantidad: 2, amount: 100 })).statusCode).toBe(400);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).cantidad).toBe(9);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0);
  });

  it('ingresa unidades al proveedor una vez y las conserva al recibir el RMA', async () => {
    const { storeId, catalog, claim } = await fixture();
    const supplier = await prisma.supplier.create({ data: { storeId, name: 'RMA ficticio' } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id } });
    const resolved = await post(`/api/returns/${claim.id}/resolve`, { ...resolveBody, destination: 'PROVEEDOR' });
    expect(resolved.statusCode, resolved.body).toBe(200);
    const returnedId = resolved.json().return.inventoryItemId;
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: returnedId } })).toMatchObject({ cantidad: 2, status: 'EN_RMA' });
    expect((await post(`/api/returns/${claim.id}/rma`, { status: 'RECIBIDO', stockStatus: 'EN_REVISION' })).statusCode).toBe(200);
    expect((await post(`/api/returns/${claim.id}/rma`, { status: 'RECIBIDO', stockStatus: 'EN_REVISION' })).statusCode).toBe(400);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: returnedId } })).toMatchObject({ cantidad: 2, status: 'EN_REVISION' });
  });
});
