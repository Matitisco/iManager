import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importBackendTradeIns } from './trade-ins-import-api';
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

describe('trade-ins-import-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('requires a configured backend url', async () => {
    setApiBaseUrl('');

    await expect(importBackendTradeIns(mockUser, [])).rejects.toThrow('Backend no configurado');
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('posts trade-in rows and resolves the backend import summary', async () => {
    const rows = [{ clientName: 'Ana', deviceReceived: 'iPhone 13', deviceReceivedImei: 'IMEI-1' }];
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      new Response(JSON.stringify({ imported: 1, updated: 1, errors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(importBackendTradeIns(mockUser, rows)).resolves.toEqual({
      imported: 1,
      updated: 1,
      errors: [],
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/trade-ins/import', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });
  });

  it('surfaces trade-in import errors and fallback status messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'IMEI faltante' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(importBackendTradeIns(mockUser, [{ clientName: 'Ana' }])).rejects.toThrow('IMEI faltante');
    await expect(importBackendTradeIns(mockUser, [{ clientName: 'Ana' }])).rejects.toThrow(/Error al importar \(503\)/);
  });
});
