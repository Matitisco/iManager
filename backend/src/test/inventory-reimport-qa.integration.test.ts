import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();

it.each(['VENDIDO', 'RESERVADO'])('preserva atributos omitidos y estado %s al reimportar solo modelo, IMEI y precio', async status => {
  const context = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(context.store!.id);
  await prisma.inventoryItem.update({ where: { id: inventoryItem.id }, data: { status, condition: 'NUEVO', grade: '', pendingSaleRegistration: status === 'VENDIDO', currency: 'USD', cost: 600 } });
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers: buildAuthHeaders(), payload: { rows: [{ imei: inventoryItem.imei, model: 'iPhone vendido QA control', price: 850, currency: 'USD' }] } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 0, updated: 1, errors: [] });
  const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItem.id } });
  expect(stored).toMatchObject({ status, condition: 'NUEVO', grade: '', capacity: '128GB', color: 'Black', batteryHealth: '91%', pendingSaleRegistration: status === 'VENDIDO' });
  expect(Number(stored.cost)).toBe(600);
  expect(Number(stored.price)).toBe(850);
});
it('actualiza columnas explícitas y mantiene calidad omitida cuando no cambia condición', async () => {
  const context = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(context.store!.id);
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers: buildAuthHeaders(), payload: { rows: [{ imei: inventoryItem.imei, model: inventoryItem.model, price: 900, color: '', capacity: '256GB', batteryHealth: '88%', status: 'RESERVADO' }] } });
  expect(response.json()).toMatchObject({ updated: 1, errors: [] });
  expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItem.id } })).toMatchObject({ color: '', capacity: '256GB', batteryHealth: '88%', status: 'RESERVADO', condition: 'USADO', grade: 'A' });
});
