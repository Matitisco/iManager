import { expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
it.each(['alta', 'edición'])('informa IMEI duplicado en español en %s sin alterar el stock', async action => {
  const context = await seedStoreContext();
  const { inventoryItem } = await seedCatalogFixture(context.store!.id);
  const payload = { imei: inventoryItem.imei, model: 'Equipo duplicado QA', capacity: '', color: '', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 300, price: 500, status: 'DISPONIBLE' };
  let url = '/api/inventory';
  if (action === 'edición') {
    const second = await prisma.inventoryItem.create({ data: { ...payload, imei: null, storeId: context.store!.id } });
    url += `/${second.id}`;
  }
  const response = await getApp().inject({ method: action === 'alta' ? 'POST' : 'PATCH', url, headers: buildAuthHeaders(), payload: action === 'alta' ? payload : { imei: inventoryItem.imei } });
  expect(response.statusCode).toBe(409);
  expect(response.json().error).toBe('Ya existe un equipo con ese IMEI en esta tienda');
  expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id, imei: inventoryItem.imei } })).toBe(1);
  expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItem.id } })).model).toBe(inventoryItem.model);
});
