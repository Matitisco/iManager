import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  inventoryItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
import { importInventoryItems, serializeInventoryItem } from './inventory.service.js';
import { moneyChanged } from '../audit/audit.js';

beforeEach(() => {
  vi.clearAllMocks();
  db.store.findUnique.mockResolvedValue({ currency: 'USD' });
  db.inventoryItem.findFirst.mockResolvedValue(null);
  db.inventoryItem.create.mockResolvedValue({ id: 'new' });
  db.inventoryItem.update.mockResolvedValue({});
});
it('guarda null real, admite precio omitido y cuenta los equipos sin precio', async () => {
  const result = await importInventoryItems('store', [{ model: 'iPhone 13', imei: '', price: null }, { model: 'iPhone 12', imei: '' }]);
  expect(result).toEqual({ imported: 2, updated: 0, errors: [], priceToDefine: 2, withoutImei: 2, diagnostics: { detectedRows: 2, acceptedRows: 2, discardedRows: 0, discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: [] } });
  expect(db.inventoryItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ price: null }) });
});
it('reimportar sin precio no borra un precio guardado', async () => {
  db.inventoryItem.findFirst.mockResolvedValue({ id: 'existing', price: new Decimal(500), cost: new Decimal(300), currency: 'USD', customFields: {}, condition: 'USADO', grade: 'A' });
  const result = await importInventoryItems('store', [{ model: 'iPhone 13', imei: '356789012345671', price: null }]);
  expect(result).toMatchObject({ updated: 1, priceToDefine: 0 });
  expect(db.inventoryItem.update.mock.calls[0][0].data).not.toHaveProperty('price');
});
it('reimportar sin precio cuenta un null existente y permite definirlo después', async () => {
  db.inventoryItem.findFirst.mockResolvedValue({ id: 'existing', price: null, cost: new Decimal(300), currency: 'USD', customFields: {}, condition: 'USADO', grade: 'A' });
  expect(await importInventoryItems('store', [{ model: 'iPhone 13', imei: '356789012345671', price: null }])).toMatchObject({ updated: 1, priceToDefine: 1 });
  expect(await importInventoryItems('store', [{ model: 'iPhone 13', imei: '356789012345671', price: 500 }])).toMatchObject({ updated: 1, priceToDefine: 0 });
  expect(db.inventoryItem.update.mock.calls[1][0].data.price.toNumber()).toBe(500);
});
it('rechaza valores inválidos y no los convierte a precio a definir', async () => {
  const result = await importInventoryItems('store', [-1, NaN, Infinity].map(price => ({ model: 'iPhone', imei: '', price })));
  expect(result.imported).toBe(0);
  expect(result.errors).toHaveLength(3);
});
it('serializa null sin convertirlo en cero', () => {
  const record = { id: 'item', model: 'iPhone', price: null, cost: new Decimal(300), createdAt: new Date(), updatedAt: new Date() } as unknown as Parameters<typeof serializeInventoryItem>[0];
  expect(serializeInventoryItem(record).price).toBeNull();
  expect(moneyChanged(null, null)).toBe(false);
  expect(moneyChanged(null, 0)).toBe(true);
  expect(moneyChanged(new Decimal(500), null)).toBe(true);
});
