import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import {
  createBackendInventoryItem,
  deleteBackendInventoryItem,
  fetchBackendInventory,
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

  it('loads inventory with the auth headers and falls back to backend error messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ inventory: [inventoryItem] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Filtro invalido' }, 400));

    await expect(fetchBackendInventory(mockUser)).resolves.toEqual([inventoryItem]);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/inventory', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
      },
    });
    await expect(fetchBackendInventory(mockUser)).rejects.toThrow('Filtro invalido');
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

  it('shows the spanish validation message and never the raw zod payload', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({
        error: 'El precio no puede ser negativo',
        message: 'El precio no puede ser negativo',
        fields: { price: 'El precio no puede ser negativo' },
      }, 400))
      .mockResolvedValueOnce(jsonResponse({
        statusCode: 500,
        error: 'Internal Server Error',
        message: '[{"code":"too_small"}]',
      }, 500));

    await expect(createBackendInventoryItem(mockUser, createInventoryPayload)).rejects.toThrow('El precio no puede ser negativo');
    await expect(createBackendInventoryItem(mockUser, createInventoryPayload)).rejects.toThrow('No se pudo crear el equipo (500)');
  });
});
