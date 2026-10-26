import { expect, it } from 'vitest';
import { heuristicPlan } from '../modules/import/sheet-plan.js';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();

it('persiste las cinco unidades sin IMEI de QA 02 con valor total USD 2200', async () => {
  const context = await seedStoreContext();
  const sheets = [{ name: 'Stock', rows: [
    ['Modelo', 'Cantidad', 'Precio USD', 'Batería'],
    ['iPhone 13', '3', '400', '89%'],
    ['iPhone 14', '2', '500', '92%'],
  ] }];
  const analysis = await getApp().inject({
    method: 'POST', url: '/api/import/apply', headers: buildAuthHeaders(),
    payload: { section: 'inventory', sheets, plan: heuristicPlan(sheets, 'inventory', 'USD'), refreshMapping: false },
  });
  expect(analysis.statusCode, analysis.body).toBe(200);
  const rows = analysis.json<{ rows: Record<string, string>[] }>().rows;
  const response = await getApp().inject({
    method: 'POST', url: '/api/inventory/import', headers: buildAuthHeaders(),
    payload: { rows: rows.map(row => ({ imei: '', model: row.model, price: Number(row.price), currency: row.currency, batteryHealth: row.batteryHealth })) },
  });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 5, updated: 0, errors: [] });
  const stored = await prisma.inventoryItem.findMany({ where: { storeId: context.store!.id } });
  expect(stored).toHaveLength(5);
  expect(stored.filter(item => item.model === 'iPhone 13')).toHaveLength(3);
  expect(stored.filter(item => item.model === 'iPhone 14')).toHaveLength(2);
  expect(stored.every(item => item.currency === 'USD' && item.quantity === 1 && !item.imei)).toBe(true);
  expect(stored.reduce((total, item) => total + Number(item.price), 0)).toBe(2200);
});
