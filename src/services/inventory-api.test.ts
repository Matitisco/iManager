import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import {
  createBackendInventoryItem,
  createBackendInventoryBatch,
  deleteBackendInventoryItem,
  fetchBackendInventory,
  fetchBackendInventoryItem,
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

  it('carga 1001 equipos en lotes y mantiene los índices globales', async () => {
    const items = Array.from({ length: 1001 }, (_, index) => ({ ...createInventoryPayload, imei: String(index).padStart(15, '0') }));
    let offset = 0;
    vi.mocked(fetchWithTimeout).mockImplementation(async (_url, options) => {
      const batch = JSON.parse(String(options?.body)).items as typeof items;
      expect(batch.length).toBeLessThanOrEqual(200);
      const created = batch.map((item, index) => ({ ...item, id: String(offset + index) }));
      const response = jsonResponse({ created: offset === 400 ? created.slice(1) : created, errors: offset === 400 ? [{ index: 0, imei: batch[0].imei, message: 'Revisar' }] : [] });
      offset += batch.length;
      return response;
    });
    const result = await createBackendInventoryBatch(mockUser, items);
    expect(fetchWithTimeout).toHaveBeenCalledTimes(6);
    expect(result.created).toHaveLength(1000);
    expect(result.errors).toEqual([{ index: 400, imei: items[400].imei, message: 'Revisar' }]);
  });

  it('devuelve los ya guardados y todos los pendientes si falla un lote de la serie', async () => {
    const items = Array.from({ length: 501 }, () => createInventoryPayload);
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({ created: Array(200).fill(inventoryItem), errors: [] })).mockRejectedValueOnce(new Error('Conexión interrumpida'));
    const result = await createBackendInventoryBatch(mockUser, items);
    expect(result.created).toHaveLength(200);
    expect(result.errors).toHaveLength(301);
    expect(result.errors[0].index).toBe(200);
    expect(result.errors.at(-1)?.index).toBe(500);
  });

  it('consulta el detalle con origen y resumen de compra, y rechaza datos inválidos', async () => {
    const detail = { ...inventoryItem, supplierId: 'supplier', supplierName: 'Andes', stockPurchaseId: 'buy', purchasedAt: '2026-09-05', purchaseName: 'Septiembre', purchaseSummary: { problems: 4, devices: 11 } };
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({ inventoryItem: detail })).mockResolvedValueOnce(jsonResponse({}));
    await expect(fetchBackendInventoryItem(mockUser, 'item-1')).resolves.toEqual(detail);
    expect(fetchWithTimeout).toHaveBeenLastCalledWith('https://api.imanager.test/api/inventory/item-1', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }));
    await expect(fetchBackendInventoryItem(mockUser, 'item-1')).rejects.toThrow('Respuesta inválida');
  });

  it('loads inventory with the auth headers and falls back to backend error messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ inventory: [inventoryItem] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'Filtro invalido' }, 400));

    await expect(fetchBackendInventory(mockUser)).resolves.toEqual([inventoryItem]);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/inventory', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'x-im-device': 'desktop',
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
    await expect(createBackendInventoryItem(mockUser, createInventoryPayload)).rejects.toThrow('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');
  });
});
