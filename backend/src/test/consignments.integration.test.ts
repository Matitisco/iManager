import { expect, it, vi } from 'vitest';
import * as cashService from '../modules/cash/service.js';
import { prisma } from '../plugins/prisma.js';
import {
  seedCatalogFixture,
  seedStoreContext,
  buildAuthHeaders,
} from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import {
  createConsignments,
  listConsignments,
  payConsignment,
} from '../modules/consignments/consignments.service.js';
import { createSale } from '../modules/sales/sales.service.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  return { ...(await seedCatalogFixture(storeId)), storeId, owner };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const input = (f: Fixture) => ({
  clientId: f.client.id,
  items: [
    { productId: f.inventoryItem.id, amount: 950000, currency: 'ARS' as const },
  ],
});
const post = (url: string, payload: object) =>
  getApp().inject({ method: 'POST', url, headers, payload });
it('crea vía HTTP sin venta, mantiene inventario y devuelve totales reales', async () => {
  const f = await fixture();
  const result = await post('/api/consignments', input(f));
  expect(result.statusCode, result.body).toBe(201);
  const item = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: f.inventoryItem.id },
  });
  expect(item).toMatchObject({ status: 'EN_CONSIGNACION', cantidad: 1 });
  expect(await prisma.sale.count()).toBe(0);
  const list = await getApp().inject({
    method: 'GET',
    url: '/api/consignments',
    headers,
  });
  expect(list.json()).toMatchObject({
    items: [{ clientName: f.client.name, amount: 950000, daysOut: 0 }],
    totals: { debt: { ARS: 950000, USD: 0 }, equipment: 1, people: 1 },
  });
  const options = await getApp().inject({
    method: 'GET',
    url: '/api/consignments/options',
    headers,
  });
  expect(options.json().clients).toHaveLength(1);
  expect(options.json().products).toHaveLength(0);
});
it('marca pagada, crea venta/cobro únicos y cierra sin deuda corriente', async () => {
  const f = await fixture();
  const cash = await post('/api/cash', {
    name: 'Caja ficticia',
    currency: 'ARS',
    method: 'EFECTIVO',
    opening: 0,
  });
  expect(cash.statusCode, cash.body).toBe(200);
  expect((await post(`/api/cash/${cash.json().id}/open`, {})).statusCode).toBe(
    200,
  );
  const [row] = await createConsignments(f.storeId, input(f));
  const paid = await post(`/api/consignments/${row.id}/pay`, {
    paymentMethod: 'EFECTIVO',
  });
  expect(paid.statusCode, paid.body).toBe(200);
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: paid.json().sale.id },
  });
  expect(sale).toMatchObject({
    storeId: f.storeId,
    clientId: f.client.id,
    inventoryItemId: f.inventoryItem.id,
    status: 'COMPLETADA',
    stockDeducted: true,
  });
  expect(Number(sale.amount)).toBe(950000);
  expect(
    await prisma.inventoryItem.findUnique({
      where: { id: f.inventoryItem.id },
    }),
  ).toMatchObject({ status: 'VENDIDO', cantidad: 0 });
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: f.client.id },
  });
  expect(Number(client.totalSpent)).toBe(950000);
  expect(Number(client.pendingBalance)).toBe(0);
  expect(
    await prisma.cashMovement.count({
      where: { sourceType: 'sale', sourceId: sale.id },
    }),
  ).toBe(1);
  expect(await listConsignments(f.storeId)).toMatchObject({
    items: [],
    totals: { equipment: 0, people: 0, debt: { ARS: 0, USD: 0 } },
  });
  expect(
    (
      await post(`/api/consignments/${row.id}/pay`, {
        paymentMethod: 'EFECTIVO',
      })
    ).statusCode,
  ).toBe(409);
  expect(await prisma.sale.count()).toBe(1);
});
it('revierte marcador, venta y cierre cuando falla la persistencia del cobro', async () => {
  const f = await fixture();
  const [row] = await createConsignments(f.storeId, input(f));
  const failure = vi
    .spyOn(cashService, 'recordCash')
    .mockRejectedValueOnce(new Error('Falla ficticia de persistencia'));
  try {
    await expect(payConsignment(f.storeId, row.id, 'EFECTIVO')).rejects.toThrow(
      'Falla ficticia de persistencia',
    );
  } finally {
    failure.mockRestore();
  }
  expect(await prisma.sale.count()).toBe(0);
  expect(
    await prisma.consignment.findUnique({ where: { id: row.id } }),
  ).toMatchObject({ paidAt: null, saleId: null });
  expect(
    await prisma.inventoryItem.findUnique({
      where: { id: f.inventoryItem.id },
    }),
  ).toMatchObject({ status: 'EN_CONSIGNACION', cantidad: 1 });
});
it('rechaza vendidos, ya consignados y venta directa de un equipo consignado', async () => {
  const f = await fixture();
  await prisma.inventoryItem.update({
    where: { id: f.inventoryItem.id },
    data: { status: 'VENDIDO' },
  });
  await expect(createConsignments(f.storeId, input(f))).rejects.toMatchObject({
    statusCode: 409,
  });
  await prisma.inventoryItem.update({
    where: { id: f.inventoryItem.id },
    data: { status: 'DISPONIBLE' },
  });
  await createConsignments(f.storeId, input(f));
  await expect(createConsignments(f.storeId, input(f))).rejects.toMatchObject({
    statusCode: 409,
  });
  await expect(
    createSale(f.storeId, {
      date: '04/11/2026',
      productId: f.inventoryItem.id,
      amount: 950000,
      paymentMethod: 'EFECTIVO',
      status: 'COMPLETADA',
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(
    (
      await getApp().inject({
        method: 'PATCH',
        url: `/api/inventory/${f.inventoryItem.id}`,
        headers,
        payload: { status: 'DISPONIBLE' },
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await getApp().inject({
        method: 'DELETE',
        url: `/api/inventory/${f.inventoryItem.id}`,
        headers,
      })
    ).statusCode,
  ).toBe(409);
});
it('dos altas o cobros simultáneos producen una sola consignación/venta', async () => {
  const f = await fixture();
  const created = await Promise.allSettled([
    createConsignments(f.storeId, input(f)),
    createConsignments(f.storeId, input(f)),
  ]);
  expect(created.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await prisma.consignment.count()).toBe(1);
  const row = await prisma.consignment.findFirstOrThrow();
  const paid = await Promise.allSettled([
    payConsignment(f.storeId, row.id, 'EFECTIVO'),
    payConsignment(f.storeId, row.id, 'EFECTIVO'),
  ]);
  expect(paid.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await prisma.sale.count()).toBe(1);
});
it('aisla clientes, equipos, opciones, listados y cobros por tienda', async () => {
  const f = await fixture();
  const other = await seedStoreContext({
    firebaseUid: 'other',
    email: 'other@example.com',
  });
  await expect(
    createConsignments(other.store!.id, input(f)),
  ).rejects.toMatchObject({ statusCode: 404 });
  const foreignClient = await prisma.client.create({
    data: { storeId: other.store!.id, name: 'Ajeno ficticio' },
  });
  await expect(
    createConsignments(other.store!.id, {
      ...input(f),
      clientId: foreignClient.id,
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
  const [row] = await createConsignments(f.storeId, input(f));
  expect((await listConsignments(other.store!.id)).items).toHaveLength(0);
  await expect(
    payConsignment(other.store!.id, row.id, 'EFECTIVO'),
  ).rejects.toMatchObject({ statusCode: 404 });
  await prisma.storeMember.update({
    where: { id: f.owner.membership!.id },
    data: { role: 'STAFF', sections: ['inventory'] },
  });
  const denied = await getApp().inject({
    method: 'GET',
    url: '/api/consignments',
    headers,
  });
  expect(denied.statusCode).toBe(403);
});
it('lote atómico y cantidades/precios por unidad en moneda acordada', async () => {
  const f = await fixture();
  await expect(
    createConsignments(f.storeId, {
      ...input(f),
      items: [
        ...input(f).items,
        { productId: 'zz-missing', amount: 100, currency: 'ARS' },
      ],
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(await prisma.consignment.count()).toBe(0);
  expect(
    await prisma.inventoryItem.findUnique({
      where: { id: f.inventoryItem.id },
    }),
  ).toMatchObject({ status: 'DISPONIBLE' });
  await prisma.inventoryItem.update({
    where: { id: f.inventoryItem.id },
    data: { imei: null, cantidad: 3 },
  });
  const [row] = await createConsignments(f.storeId, {
    clientId: f.client.id,
    items: [{ productId: f.inventoryItem.id, amount: 550.25, currency: 'USD' }],
  });
  expect((await listConsignments(f.storeId)).totals).toMatchObject({
    debt: { USD: 1650.75 },
    equipment: 3,
  });
  const paid = await payConsignment(f.storeId, row.id, 'TRANSFERENCIA');
  expect(paid.sale).toMatchObject({
    cantidad: 3,
    amount: 1650.75,
    amountCurrency: 'USD',
  });
});
it('rechaza pagos parciales y no acepta precio alternativo al cerrar', async () => {
  const f = await fixture();
  const [row] = await createConsignments(f.storeId, input(f));
  const paid = await post(`/api/consignments/${row.id}/pay`, {
    paymentMethod: 'EFECTIVO',
    amount: 1,
  });
  expect(paid.statusCode).toBe(400);
  expect(await prisma.sale.count()).toBe(0);
});

it('conserva el historial ante borrados definitivos de cliente, equipo o venta', async () => {
  const f = await fixture();
  const [row] = await createConsignments(f.storeId, input(f));
  await prisma.client.update({
    where: { id: f.client.id },
    data: { archivedAt: new Date() },
  });
  const clientDelete = await getApp().inject({
    method: 'DELETE',
    url: `/api/clients/${f.client.id}/permanent`,
    headers,
  });
  expect(clientDelete.statusCode, clientDelete.body).toBe(409);
  const paid = await payConsignment(f.storeId, row.id, 'EFECTIVO');
  await prisma.inventoryItem.update({
    where: { id: f.inventoryItem.id },
    data: { archivedAt: new Date() },
  });
  await prisma.sale.update({
    where: { id: paid.sale.id },
    data: { voidedAt: new Date() },
  });
  const itemDelete = await getApp().inject({
    method: 'DELETE',
    url: `/api/inventory/${f.inventoryItem.id}/permanent`,
    headers,
  });
  const saleDelete = await getApp().inject({
    method: 'DELETE',
    url: `/api/sales/${paid.sale.id}/permanent`,
    headers,
  });
  expect(itemDelete.statusCode, itemDelete.body).toBe(409);
  expect(saleDelete.statusCode, saleDelete.body).toBe(409);
  expect(await prisma.consignment.count()).toBe(1);
});
