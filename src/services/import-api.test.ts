import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeInventoryText, analyzeImport, applyImportPlan, importBackendRows, type ImportSection } from './import-api';
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

  it('sends inventory text only to the authenticated backend with its bounded analysis timeout', async () => {
    const text = '13pm 256 azul usado bat 85 520usd';
    const analysis = { source: 'model', rows: [], review: [], discarded: [] };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(analysis));
    expect(await analyzeInventoryText(mockUser, text)).toEqual(analysis);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/import/analyze-text', {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: 'Bearer token-123', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }, 190_000);
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
      cache: 'no-store',
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
    await expect(importBackendRows(mockUser, 'sales', [{ clientDni: '11222333' }])).rejects.toThrow('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');
  });

  it('asks the backend to read the workbook and keeps the OpenAI key off the client', async () => {
    const analysis = {
      source: 'model' as const,
      notice: null,
      currency: 'ARS' as const,
      plan: [],
      rows: [{ model: '13 mini', capacity: '128 GB' }],
      summary: { sheetCount: 1, rowCount: 1, sheets: [] },
    };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(analysis));
    const sheets = [{ name: 'iPhones Usados', rows: [['Modelo'], ['13 mini 128 GB']] }];

    await expect(analyzeImport(mockUser, 'inventory', sheets)).resolves.toEqual(analysis);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/import/analyze', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ section: 'inventory', sheets }),
    }, 45_000);
    expect(JSON.stringify(vi.mocked(fetchWithTimeout).mock.calls)).not.toContain('OPENAI');
  });

  it('reapplies an edited plan without asking the model again', async () => {
    const analysis = {
      source: 'manual' as const,
      notice: null,
      currency: 'USD' as const,
      plan: [],
      rows: [],
      summary: { sheetCount: 0, rowCount: 0, sheets: [] },
    };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(analysis));
    const sheets = [{ name: 'Hoja 1', rows: [['Modelo']] }];
    const plan = [{
      name: 'Hoja 1',
      include: true,
      condition: 'USADO' as const,
      headerRow: 1,
      dataStartRow: 2,
      dataEndRow: 2,
      mapping: [{ header: 'Modelo', field: 'model' }],
      splitModelCapacity: true,
      batteryAsPercent: true,
      priceCurrency: 'USD' as const,
    }];

    await expect(applyImportPlan(mockUser, 'inventory', sheets, plan, true)).resolves.toEqual(analysis);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/import/apply', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ section: 'inventory', sheets, plan, refreshMapping: true }),
    }), 45_000);
  });
});
