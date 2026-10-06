import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradeIn } from '../types';
import {
  bulkMoveTradeInCategoryApi,
  createBackendTradeIn,
  createTradeInCategoryApi,
  deleteBackendTradeIn,
  fetchBackendTradeIns,
  fetchTradeInCategoriesApi,
  reorderTradeInCategoriesApi,
  updateBackendTradeIn,
} from './trade-ins-api';
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

const tradeInFixture: TradeIn = {
  id: 'trade-1',
  date: '2026-04-20',
  clientId: 'client-1',
  categoryId: 'cat-1',
  deviceReceived: 'iPhone 13',
  deviceReceivedImei: 'IMEI-001',
  takeValue: 600,
  deviceGiven: 'iPhone 15',
  differencePaid: 900,
  status: 'PENDIENTE',
  batteryHealth: '90%',
  grade: 'A',
};

const { id: _tradeInId, ...createTradeInPayload } = tradeInFixture;

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('trade-ins-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('loads trade-ins using the backend auth headers', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ tradeIns: [tradeInFixture] }),
    );

    await expect(fetchBackendTradeIns(mockUser)).resolves.toEqual([tradeInFixture]);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/trade-ins', {
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });

  it('surfaces creation failures and validates successful create responses', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ error: 'IMEI duplicado' }, 409))
      .mockResolvedValueOnce(jsonResponse({ tradeIn: tradeInFixture }, 201));

    await expect(createBackendTradeIn(mockUser, createTradeInPayload)).rejects.toThrow('IMEI duplicado');
    await expect(createBackendTradeIn(mockUser, createTradeInPayload)).resolves.toEqual(tradeInFixture);
  });

  it('updates trade-ins through PATCH and allows 204 deletes', async () => {
    const updatedTradeIn: TradeIn = {
      ...tradeInFixture,
      status: 'LISTO',
      differencePaid: 750,
    };

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ tradeIn: updatedTradeIn }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(updateBackendTradeIn(mockUser, updatedTradeIn)).resolves.toEqual(updatedTradeIn);
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(1, `https://api.imanager.test/api/trade-ins/${updatedTradeIn.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedTradeIn),
    });

    await expect(deleteBackendTradeIn(mockUser, updatedTradeIn.id)).resolves.toBeUndefined();
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, `https://api.imanager.test/api/trade-ins/${updatedTradeIn.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
      },
    });
  });

  it('covers trade-in category fetch/create and category mutation endpoints', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ categories: [{ id: 'cat-1', name: 'Pendientes' }] }))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'Listos' } }, 201))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(fetchTradeInCategoriesApi(mockUser)).resolves.toEqual([{ id: 'cat-1', name: 'Pendientes' }]);
    await expect(createTradeInCategoryApi(mockUser, 'Listos')).resolves.toEqual({ id: 'cat-2', name: 'Listos' });
    await expect(reorderTradeInCategoriesApi(mockUser, ['cat-1', 'cat-2'])).resolves.toBeUndefined();
    await expect(bulkMoveTradeInCategoryApi(mockUser, ['trade-1'], 'cat-2')).resolves.toBeUndefined();
  });
});
