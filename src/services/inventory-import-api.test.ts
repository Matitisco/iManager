import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importBackendInventoryItems } from './inventory-import-api';
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

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

describe('inventory-import-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('requires a configured backend base url', async () => {
    setApiBaseUrl('');

    await expect(importBackendInventoryItems(mockUser, [])).rejects.toThrow('Backend no configurado');
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('posts inventory rows and resolves the import summary', async () => {
    const rows = [{ imei: 'IMEI-1', model: 'iPhone 15', price: 1800 }];
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      new Response(JSON.stringify({ imported: 1, updated: 0, errors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(importBackendInventoryItems(mockUser, rows)).resolves.toEqual({
      imported: 1,
      updated: 0,
      errors: [],
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/inventory/import', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });
  });

  it('surfaces backend import errors and fallback status messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'IMEI duplicado' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(importBackendInventoryItems(mockUser, [{ imei: 'IMEI-1', model: 'iPhone 15', price: 1800 }])).rejects.toThrow('IMEI duplicado');
    await expect(importBackendInventoryItems(mockUser, [{ imei: 'IMEI-1', model: 'iPhone 15', price: 1800 }])).rejects.toThrow(/Error al importar \(500\)/);
  });
});
