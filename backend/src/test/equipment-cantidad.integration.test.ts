import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const product = { model: '15 Pro', capacity: '128GB', color: '', condition: 'NUEVO', grade: '', batteryHealth: '', cost: 450, price: 650, currency: 'USD', status: 'DISPONIBLE' };
const request = (method: 'POST' | 'PATCH' | 'GET', url: string, payload?: object) => getApp().inject({ method, url, headers, payload });
async function stock(cantidad = 73) {
  const { store } = await seedStoreContext();
  const created = await request('POST', '/api/inventory', { ...product, cantidad });
  expect(created.statusCode, created.body).toBe(201);
  return { storeId: store!.id, id: created.json().inventoryItem.id as string };
}
const sell = (id: string, cantidad: number, amount = 650 * cantidad) => request('POST', '/api/operations/sales', { clientName: 'Comprador ficticio', productId: id, cantidad, amount, currency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' });
const stored = (id: string) => prisma.inventoryItem.findUniqueOrThrow({ where: { id } });

it('vende parcialmente, suma unidades y valuación, edita, anula y restaura sin perder stock', async () => {
  const { id } = await stock();
  const first = await sell(id, 3);
  expect(first.statusCode, first.body).toBe(201);
  expect(first.json().sale).toMatchObject({ cantidad: 3, amount: 1950 });
  expect(first.json().inventory[0]).toMatchObject({ cantidad: 70, status: 'DISPONIBLE' });
  const second = await sell(id, 5);
  expect(second.statusCode, second.body).toBe(201);
  expect(await stored(id)).toMatchObject({ cantidad: 65, status: 'DISPONIBLE' });
  const report = await request('GET', '/api/reports/overview?rangeKey=all_time');
  expect(report.statusCode, report.body).toBe(200);
  expect(report.json().overview.summary).toMatchObject({ unitsSold: 8 });
  expect(report.json().overview.inventory).toMatchObject({ totalItems: 65, availableItems: 65, valuation: { costValue: 29250000, retailValue: 42250000 } });
  const edited = await request('PATCH', `/api/operations/sales/sales/${first.json().sale.id}`, { cantidad: 4, amount: 2600 });
  expect(edited.statusCode, edited.body).toBe(200);
  expect((await stored(id)).cantidad).toBe(64);
  const cancelled = await request('POST', `/api/operations/sales/sales/${first.json().sale.id}/void`, { reason: 'Prueba' });
  expect(cancelled.statusCode, cancelled.body).toBe(200);
  expect((await stored(id)).cantidad).toBe(68);
  const restored = await request('POST', `/api/sales/${first.json().sale.id}/restore`);
  expect(restored.statusCode, restored.body).toBe(200);
  expect((await stored(id)).cantidad).toBe(64);
  const rest = await sell(id, 64);
  expect(rest.statusCode, rest.body).toBe(201);
  expect(await stored(id)).toMatchObject({ cantidad: 0, status: 'VENDIDO' });
  expect((await sell(id, 1)).statusCode).toBe(409);
  expect((await request('POST', `/api/operations/sales/sales/${second.json().sale.id}/void`, { reason: 'Prueba' })).statusCode).toBe(200);
  expect(await stored(id)).toMatchObject({ cantidad: 5, status: 'DISPONIBLE' });
});

it('valida cantidades y evita sobreventa concurrente', async () => {
  const { id } = await stock(3);
  for (const cantidad of [0, -1, 1.5, 4]) expect((await sell(id, cantidad)).statusCode).toBe(cantidad === 4 ? 409 : 400);
  const results = await Promise.all([sell(id, 2), sell(id, 2)]);
  expect(results.map(result => result.statusCode).sort()).toEqual([201, 409]);
  expect((await stored(id)).cantidad).toBe(1);
});

it('usa default 1, conserva cantidad al editar y rechaza IMEI con múltiples unidades', async () => {
  await seedStoreContext();
  const created = await request('POST', '/api/inventory', product);
  expect(created.json().inventoryItem.cantidad).toBe(1);
  const id = created.json().inventoryItem.id;
  expect((await request('PATCH', `/api/inventory/${id}`, { cantidad: 7 })).statusCode).toBe(200);
  expect((await request('PATCH', `/api/inventory/${id}`, { imei: '990000000001109' })).statusCode).toBe(400);
  expect((await request('PATCH', `/api/inventory/${id}`, { cost: 400 })).json().inventoryItem.cantidad).toBe(7);
  expect((await request('POST', '/api/inventory', { ...product, imei: '990000000001109', cantidad: 2 })).statusCode).toBe(400);
  expect((await request('PATCH', `/api/inventory/${id}`, { cantidad: 1, imei: '990000000001109' })).statusCode).toBe(200);
  expect((await sell(id, 2)).statusCode).toBe(400);
});

it('la API de ventas directa descuenta y anula solo sus unidades', async () => {
  const { id } = await stock(8);
  const sale = await request('POST', '/api/sales', { date: '30/10/2026', productId: id, cantidad: 3, amount: 1950, amountCurrency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' });
  expect(sale.statusCode, sale.body).toBe(201);
  expect((await stored(id)).cantidad).toBe(5);
  const cancelled = await request('PATCH', `/api/sales/${sale.json().sale.id}`, { status: 'CANCELADA' });
  expect(cancelled.statusCode, cancelled.body).toBe(200);
  expect((await stored(id)).cantidad).toBe(8);
});

it('la migración conserva existentes y usa 1 por defecto en tablas históricas', async () => {
  const sql = readFileSync(new URL('../../prisma/migrations/20261030160000_equipment_cantidad/migration.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "InventoryItem" (id TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "Sale" (id TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "TradeIn" (id TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe(`INSERT INTO "InventoryItem" (id) VALUES ('legacy')`);
    await tx.$executeRawUnsafe(`INSERT INTO "Sale" (id) VALUES ('legacy')`);
    for (const statement of sql.split(';').filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
    expect(await tx.$queryRawUnsafe('SELECT quantity FROM "InventoryItem"')).toEqual([{ quantity: 1 }]);
    expect(await tx.$queryRawUnsafe('SELECT cantidad, "stockDeducted" FROM "Sale"')).toEqual([{ cantidad: 1, stockDeducted: false }]);
    await tx.$executeRawUnsafe('UPDATE "InventoryItem" SET quantity = 73');
    for (const statement of sql.split(';').filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
    expect(await tx.$queryRawUnsafe('SELECT quantity FROM "InventoryItem"')).toEqual([{ quantity: 73 }]);
  });
});

it('conserva cantidad al guardar y confirmar un borrador de canje', async () => {
  const { id } = await stock(8);
  const draft = await request('POST', '/api/operations/sales', { draft: true, productId: id, cantidad: 3, clientName: 'Comprador ficticio', amount: 1950, currency: 'USD', tradeIn: { deviceReceived: '12 Pro', takeValue: 200 } });
  expect(draft.statusCode, draft.body).toBe(201);
  expect(draft.json().tradeIn.draftCantidad).toBe(3);
  expect((await stored(id)).cantidad).toBe(8);
  const confirm = await request('POST', `/api/operations/sales/trades/${draft.json().tradeIn.id}/confirm`, {});
  expect(confirm.statusCode, confirm.body).toBe(200);
  expect(confirm.json().sale.cantidad).toBe(3);
  expect((await stored(id)).cantidad).toBe(5);
});

it('completa el precio unitario de un equipo sin precio al vender varias unidades', async () => {
  const { id } = await stock(8);
  await request('PATCH', `/api/inventory/${id}`, { price: 0 });
  const sale = await sell(id, 3);
  expect(sale.statusCode, sale.body).toBe(201);
  expect(sale.json().inventory[0]).toMatchObject({ cantidad: 5, price: 650 });
});
