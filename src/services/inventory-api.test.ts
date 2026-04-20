import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import {
  bulkMoveCategoryApi,
  createBackendInventoryItem,
  createCategoryApi,
  deleteBackendInventoryItem,
  fetchBackendInventory,
  fetchCategories,
  fetchInventoryFilteredIds,
  fetchInventoryPage,
  renameCategoryApi,
  updateBackendInventoryItem,
} from './inventory-api';
import { fetchWithTimeout } from './fetch-with-timeout';

vi.mock('./fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

const mockUser = {
  uid: 'user-1',
  email: 'owner@imanager.test',
  displayName: 'Owner',
  getIdToken: vi.fn().mockResolvedValue('token-123'),
};

const inventoryItem: Product = {
  id: 'item-1',
  imei: 'IMEI-123',
  model: 'iPhone 15',
  capacity: '256GB',
  color: 'Black',
  condition: 'NUEVO',
  grade: 'A+',
  batteryHealth: '100%',
  cost: 1200,
  price: 1800,
  status: 'DISPONIBLE',
  categoryId: 'cat-1',
};

const { id: _inventoryId, ...createInventoryPayload } = inventoryItem;

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('inventory-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('loads paged inventory with the expected query string and auth headers', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ items: [inventoryItem], total: 1 }),
    );

    await expect(
      fetchInventoryPage(mockUser, {
        skip: 10,
        take: 20,
        search: 'iphone',
        categoryId: null,
        sortKey: 'price',
        sortDir: 'desc',
        condition: 'NUEVO',
        status: 'DISPONIBLE',
        capacity: '256GB',
        model: 'iPhone 15',
        grade: 'A+',
        battery: '100%',
      }),
    ).resolves.toEqual({ items: [inventoryItem], total: 1 });

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      'https://api.imanager.test/api/inventory?skip=10&take=20&search=iphone&categoryId=null&sortKey=price&sortDir=desc&condition=NUEVO&status=DISPONIBLE&capacity=256GB&model=iPhone+15&grade=A%2B&battery=100%25',
      {
        headers: {
          Authorization: 'Bearer token-123',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('loads filtered ids and falls back to backend error messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ ids: ['item-2', 'item-1'] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Filtro invalido' }, 400));

    await expect(
      fetchInventoryFilteredIds(mockUser, {
        search: 'iphone',
        categoryId: 'cat-1',
        status: 'DISPONIBLE',
      }),
    ).resolves.toEqual(['item-2', 'item-1']);

    await expect(fetchInventoryFilteredIds(mockUser, { status: 'BAD' })).rejects.toThrow('Filtro invalido');
  });

  it('covers inventory list/create/update/delete CRUD flows', async () => {
    const updatedItem: Product = {
      ...inventoryItem,
      price: 1900,
      status: 'EN_REVISION',
    };

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ inventory: [inventoryItem] }))
      .mockResolvedValueOnce(jsonResponse({ inventoryItem }, 201))
      .mockResolvedValueOnce(jsonResponse({ inventoryItem: updatedItem }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(fetchBackendInventory(mockUser)).resolves.toEqual([inventoryItem]);
    await expect(createBackendInventoryItem(mockUser, createInventoryPayload)).resolves.toEqual(inventoryItem);
    await expect(updateBackendInventoryItem(mockUser, updatedItem)).resolves.toEqual(updatedItem);
    await expect(deleteBackendInventoryItem(mockUser, updatedItem.id)).resolves.toBeUndefined();
  });

  it('covers category fetch, create, rename and bulk move flows', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ categories: [{ id: 'cat-1', name: 'Apple' }] }))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'Android' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'Android Premium' } }))
      .mockResolvedValueOnce(jsonResponse({ count: 2 }));

    await expect(fetchCategories(mockUser)).resolves.toEqual([{ id: 'cat-1', name: 'Apple' }]);
    await expect(createCategoryApi(mockUser, 'Android')).resolves.toEqual({ id: 'cat-2', name: 'Android' });
    await expect(renameCategoryApi(mockUser, 'cat-2', 'Android Premium')).resolves.toEqual({
      id: 'cat-2',
      name: 'Android Premium',
    });
    await expect(bulkMoveCategoryApi(mockUser, ['item-1', 'item-2'], null)).resolves.toBe(2);
  });
});
