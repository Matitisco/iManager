import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectImport, importBackendRows, suggestImportMapping, type ImportSection } from './import-api';
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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('import-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('requires a configured backend url', async () => {
    setApiBaseUrl('');

    await expect(importBackendRows(mockUser, 'sales', [])).rejects.toThrow('Backend no configurado');
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it.each<ImportSection>(['inventory', 'sales', 'clients', 'trade-ins'])('posts %s rows and resolves the backend summary', async (section) => {
    const rows = [{ name: 'Ana', imei: '356789012345678' }];
    vi.mocked(fetchWithTimeout).mockResolvedValue(json({ imported: 1, updated: 0, errors: [] }));

    await expect(importBackendRows(mockUser, section, rows)).resolves.toEqual({ imported: 1, updated: 0, errors: [] });
    expect(fetchWithTimeout).toHaveBeenCalledWith(`https://api.imanager.test/api/${section}/import`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    });
  });

  it('surfaces import errors and fallback status messages', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: 'Producto inexistente' }, 404))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(importBackendRows(mockUser, 'sales', [{ clientDni: '11222333' }])).rejects.toThrow('Producto inexistente');
    await expect(importBackendRows(mockUser, 'sales', [{ clientDni: '11222333' }])).rejects.toThrow(/Error al importar \(500\)/);
  });

  it('asks the backend for a column mapping and keeps the OpenAI key off the client', async () => {
    const suggestion = {
      source: 'decisions' as const,
      notice: null,
      suggestions: [{ header: 'Equipo', field: 'model', confidence: 0.9, review: false, suggestedField: 'model' }],
    };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(suggestion));

    await expect(suggestImportMapping(mockUser, 'inventory', [{ header: 'Equipo', samples: ['iPhone 14'] }])).resolves.toEqual(suggestion);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/import/suggest-mapping', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ section: 'inventory', columns: [{ header: 'Equipo', samples: ['iPhone 14'] }] }),
    }, 60_000);
    expect(JSON.stringify(vi.mocked(fetchWithTimeout).mock.calls)).not.toContain('OPENAI');
  });

  it('sends the sheet grids to the backend and keeps the OpenAI key off the client', async () => {
    const detected = {
      source: 'heuristic' as const,
      notice: null,
      totals: { sheets: 1, rows: 1 },
      sheets: [{
        name: 'Usados',
        include: true,
        headerRow: 0,
        condition: 'USADO',
        headers: ['Modelo'],
        mapping: { model: 'Modelo' },
        rows: [{ model: '13 mini', capacity: '128 GB', price: '477400' }],
      }],
    };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(detected));

    await expect(detectImport(mockUser, 'inventory', {
      currency: 'ARS',
      sellRate: 1540,
      sheets: [{ name: 'Usados', rows: [['Modelo'], ['13 mini 128 GB']] }],
    })).resolves.toEqual(detected);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/import/detect', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section: 'inventory',
        currency: 'ARS',
        sellRate: 1540,
        sheets: [{ name: 'Usados', rows: [['Modelo'], ['13 mini 128 GB']] }],
      }),
    }, 60_000);
    expect(JSON.stringify(vi.mocked(fetchWithTimeout).mock.calls)).not.toContain('sk-');
  });
});
