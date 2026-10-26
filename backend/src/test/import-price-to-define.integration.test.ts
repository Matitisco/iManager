import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
async function imported() {
  const context = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [{ model: 'iPhone 13', imei: '356789012345671', cost: 420, price: null }] } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 1, priceToDefine: 1, errors: [] });
  const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: context.store!.id } });
  return { ...context, item };
}
it('persiste null y lo conserva en listado, detalle y reimportación', async () => {
  const { item } = await imported();
  expect(item.price).toBeNull();
  expect((await getApp().inject({ url: '/api/inventory', headers })).json().inventory[0].price).toBeNull();
  expect((await getApp().inject({ url: `/api/inventory/${item.id}`, headers })).json().inventoryItem.price).toBeNull();
  const repeat = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [{ model: 'iPhone 13', imei: item.imei }] } });
  expect(repeat.json()).toMatchObject({ imported: 0, updated: 1, priceToDefine: 1 });
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { price: 600 } });
  const preserve = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [{ model: 'iPhone 13', imei: item.imei, price: null }] } });
  expect(preserve.json()).toMatchObject({ updated: 1, priceToDefine: 0 });
  expect(Number((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).price)).toBe(600);
});
it('exige precio al vender y actualiza el equipo con el precio definido', async () => {
  const { item } = await imported();
  const payload = { productId: item.id, date: '26/10/2026', amount: 0, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' };
  const noPrice = await getApp().inject({ method: 'POST', url: '/api/operations/inventory', headers, payload });
  expect(noPrice.statusCode, noPrice.body).toBe(400);
  expect(await prisma.sale.count()).toBe(0);
  const sold = await getApp().inject({ method: 'POST', url: '/api/operations/inventory', headers, payload: { ...payload, amount: 650 } });
  expect(sold.statusCode, sold.body).toBe(201);
  const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  expect(stored.status).toBe('VENDIDO');
  expect(Number(stored.price)).toBe(650);
});
it('catálogo público mantiene null sin conversión ni cotización obligatoria', async () => {
  const { item, store } = await imported();
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { catalogVisible: true, currency: 'USD' } });
  await prisma.store.update({ where: { id: store!.id }, data: { exchangeMode: 'manual', manualBuy: null, manualSell: null } });
  const catalog = await prisma.storePublicCatalog.create({ data: { storeId: store!.id, slug: 'precio-a-definir-local', active: true, showPrice: true, priceCurrency: 'ARS' } });
  const response = await getApp().inject({ url: `/api/public/catalog/${catalog.slug}` });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().items[0]).toMatchObject({ price: null });
});
it('el conteo toma un snapshot con precio null y mantiene el valor al cerrar', async () => {
  const { item } = await imported();
  const started = await getApp().inject({ method: 'POST', url: '/api/stock-counts', headers });
  expect(started.statusCode, started.body).toBe(201);
  const count = started.json().count;
  const snapshot = await prisma.stockCountExpected.findFirstOrThrow({ where: { stockCountId: count.id, inventoryItemId: item.id } });
  expect(snapshot.price).toBeNull();
  const closed = await getApp().inject({ method: 'POST', url: `/api/stock-counts/${count.id}/close`, headers });
  expect(closed.statusCode, closed.body).toBe(200);
  expect((await prisma.stockCountExpected.findUniqueOrThrow({ where: { id: snapshot.id } })).price).toBeNull();
});
