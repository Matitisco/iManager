import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importBackendClients } from './clients-import-api';
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

describe('clients-import-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('fails fast when the backend url is missing', async () => {
    setApiBaseUrl('');

    await expect(importBackendClients(mockUser, [])).rejects.toThrow('Backend no configurado');
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('posts the import rows and returns the parsed result', async () => {
    const rows = [{ name: 'Ana', dni: '11222333' }];
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      new Response(JSON.stringify({ imported: 1, updated: 0, errors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(importBackendClients(mockUser, rows)).resolves.toEqual({
      imported: 1,
      updated: 0,
      errors: [],
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/clients/import', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });
  });

  it('surfaces backend import errors with a fallback message', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Archivo invalido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(importBackendClients(mockUser, [{ name: 'Ana' }])).rejects.toThrow('Archivo invalido');
    await expect(importBackendClients(mockUser, [{ name: 'Ana' }])).rejects.toThrow(/Error al importar \(500\)/);
  });
});
