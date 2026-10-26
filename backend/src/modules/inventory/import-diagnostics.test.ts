import { beforeEach, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  inventoryItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: prismaMock }));
import { importInventoryItems } from './inventory.service.js';

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.store.findUnique.mockResolvedValue({ currency: 'USD' });
  prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
  prismaMock.inventoryItem.create.mockResolvedValue({ id: 'new-item' });
});

it('counts missing model, bad price and invalid IMEI without saving rejected rows', async () => {
  const result = await importInventoryItems('store-test', [
    { imei: '', model: 'iPhone 13', price: 500 },
    { imei: '', model: '', price: 500 },
    { imei: '', model: 'iPhone 13', price: NaN },
    { imei: '1234', model: 'iPhone 13', price: 500 },
  ]);
  expect(result).toMatchObject({ imported: 1, updated: 0, diagnostics: {
    detectedRows: 4, acceptedRows: 1, discardedRows: 3,
    discardedByReason: { missing_model: 1, invalid_price: 1, invalid_imei: 1 },
    missingRequiredFields: [], missingRecommendedFields: [],
  } });
  expect(prismaMock.inventoryItem.create).toHaveBeenCalledOnce();
});

it('counts an existing IMEI as an accepted update, preserving upsert behavior', async () => {
  prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: 'existing-item', customFields: {}, price: 500, cost: 400, currency: 'USD', condition: 'USADO', grade: 'A' });
  const result = await importInventoryItems('store-test', [{ imei: '356789012345671', model: 'iPhone 13', price: 500 }]);
  expect(result).toMatchObject({ imported: 0, updated: 1, errors: [], diagnostics: {
    detectedRows: 1, acceptedRows: 1, discardedRows: 0, discardedByReason: {},
  } });
  expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled();
  expect(prismaMock.inventoryItem.update).toHaveBeenCalledOnce();
});

it('accepts null prices while retaining discard reasons for other rows', async () => {
  const result = await importInventoryItems('store-test', [
    { imei: '', model: 'iPhone 13', price: null, cost: 420 },
    { imei: '', model: '', price: null },
    { imei: '', model: 'iPhone 14', price: NaN },
  ]);
  expect(result).toMatchObject({ imported: 1, priceToDefine: 1, diagnostics: {
    detectedRows: 3, acceptedRows: 1, discardedRows: 2,
    discardedByReason: { missing_model: 1, invalid_price: 1 },
  } });
  expect(result.diagnostics?.discardedByReason).not.toHaveProperty('missing_price');
  expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ price: null }) });
});
