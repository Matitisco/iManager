import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale } from '../types';
import {
  bulkMoveSalesCategoryApi,
  createBackendSale,
  createSaleCategoryApi,
  deleteBackendSale,
  fetchBackendSales,
  fetchSalesCategoriesApi,
  renameSaleCategoryApi,
  updateBackendSale,
} from './sales-api';
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

const saleFixture: Sale = {
  id: 'sale-1',
  saleNumber: 101,
  date: '2026-04-20',
  clientId: 'client-1',
  productId: 'product-1',
  amount: 1800,
  paymentMethod: 'TRANSFERENCIA',
  status: 'COMPLETADA',
  categoryId: 'cat-1',
  customFields: { channel: 'web' },
};

const { id: _saleId, saleNumber: _saleNumber, ...createSalePayload } = saleFixture;

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('sales-api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads sales using the backend auth headers', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ sales: [saleFixture] }),
    );

    await expect(fetchBackendSales(mockUser)).resolves.toEqual([saleFixture]);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/sales', {
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });

  it('surfaces create failures and validates update payloads', async () => {
    const updatedSale: Sale = {
      ...saleFixture,
      amount: 1900,
      paymentMethod: 'EFECTIVO',
      categoryId: null,
      customFields: { channel: 'showroom' },
    };

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ error: 'Stock insuficiente' }, 409))
      .mockResolvedValueOnce(jsonResponse({ sale: updatedSale }));

    await expect(createBackendSale(mockUser, createSalePayload)).rejects.toThrow('Stock insuficiente');
    await expect(updateBackendSale(mockUser, updatedSale)).resolves.toEqual(updatedSale);
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, `https://api.imanager.test/api/sales/${updatedSale.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: updatedSale.clientId,
        productId: updatedSale.productId,
        paymentMethod: updatedSale.paymentMethod,
        status: updatedSale.status,
        date: updatedSale.date,
        amount: updatedSale.amount,
        categoryId: null,
        customFields: updatedSale.customFields,
      }),
    });
  });

  it('accepts 204 deletes and covers category fetch/create/rename/move', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response(null, { status: 204 }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ categories: [{ id: 'cat-1', name: 'Web' }] }))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'Mostrador' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'Mostrador Norte' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteBackendSale(mockUser, 'sale-1')).resolves.toBeUndefined();
    await expect(fetchSalesCategoriesApi(mockUser)).resolves.toEqual([{ id: 'cat-1', name: 'Web' }]);
    await expect(createSaleCategoryApi(mockUser, 'Mostrador')).resolves.toEqual({ id: 'cat-2', name: 'Mostrador' });
    await expect(renameSaleCategoryApi(mockUser, 'cat-2', 'Mostrador Norte')).resolves.toEqual({
      id: 'cat-2',
      name: 'Mostrador Norte',
    });
    await expect(bulkMoveSalesCategoryApi(mockUser, ['sale-1'], null)).resolves.toBeUndefined();
  });
});
