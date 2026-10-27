import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
it.each(['150%', '-1%', '85-83%', '83-150%', '838%', 'abc'])('rechaza batería inválida %s en alta, edición y serie; importa vacía con advertencia', async batteryHealth => {
  const context = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(context.store!.id);
  const { id, storeId, createdAt, ...other } = inventoryItem;
  const payload = { imei: '', model: 'QA', capacity: '', color: '', condition: 'USADO', grade: 'A', batteryHealth, cost: 300, price: 500, status: 'DISPONIBLE' };
  const headers = buildAuthHeaders();
  expect((await getApp().inject({ method: 'POST', url: '/api/inventory', headers, payload })).statusCode).toBe(400);
  expect((await getApp().inject({ method: 'PATCH', url: `/api/inventory/${id}`, headers, payload: { batteryHealth } })).statusCode).toBe(400);
  expect((await getApp().inject({ method: 'POST', url: '/api/inventory/batch', headers, payload: { items: [payload] } })).statusCode).toBe(400);
  const imported = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [payload] } });
  expect(imported.json()).toMatchObject({ imported: 1, updated: 0, errors: [], warnings: [{ row: 1, message: expect.stringContaining('sin batería') }] });
  expect(await prisma.inventoryItem.count({ where: { storeId } })).toBe(2);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).batteryHealth).toBe(other.batteryHealth);
});
it.each(['0%', '100%', '83-85%', '0-100%', 'N/A', ''])('acepta batería válida %s sin cambiarla', async batteryHealth => {
  await seedStoreContext();
  const result = await getApp().inject({ method: 'POST', url: '/api/inventory', headers: buildAuthHeaders(), payload: { imei: '', model: 'QA', capacity: '', color: '', condition: 'USADO', grade: 'A', batteryHealth, cost: 300, price: 500, status: 'DISPONIBLE' } });
  expect(result.statusCode, result.body).toBe(201);
  expect(result.json().inventoryItem.batteryHealth).toBe(batteryHealth);
});
