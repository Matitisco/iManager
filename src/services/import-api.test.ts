import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeInventoryText, analyzeImport, applyImportPlan, importBackendRows, type ImportSection } from './import-api';
import { capture } from '../lib/posthog-analytics';
import { fetchWithTimeout } from './fetch-with-timeout';

vi.mock('../lib/posthog-analytics', () => ({ capture: vi.fn(), deviceAdded: vi.fn() }));

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
    vi.mocked(capture).mockClear();
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
      headers: { 'x-im-device': 'desktop', Authorization: 'Bearer token-123', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }, 190_000);
  });


  it('reports zero prepared rows and stable reasons from analyze/apply without sending cell values', async () => {
    const diagnostic = { detectedRows: 2, acceptedRows: 0, discardedRows: 2, discardedByReason: { missing_model: 2 }, missingRequiredFields: ['model'], missingRecommendedFields: ['imei'] };
    const result = { rows: [], plan: [], diagnostics: diagnostic, missingRequiredFields: ['model'], missingRecommendedFields: ['imei'] };
    vi.mocked(fetchWithTimeout).mockImplementation(async () => json(result));
    const sheets = [{ name: 'private sheet name', rows: [['Modelo', 'Costo'], ['private cell', '420']] }];
    await analyzeImport(mockUser, 'inventory', sheets);
    await applyImportPlan(mockUser, 'inventory', sheets, []);
    for (const phase of ['analyze', 'apply']) expect(capture).toHaveBeenCalledWith('import_analysis_completed', {
      import_type: 'inventory', source: 'excel', phase,
      rows_detected: 2, rows_prepared: 0, rows_imported: 0, rows_updated: 0, rows_discarded: 2,
      discarded_by_reason: { missing_model: 2 }, missing_required_fields: ['model'], missing_recommended_fields: ['imei'],
    });
    expect(JSON.stringify(vi.mocked(capture).mock.calls)).not.toContain('private');
  });

  it('emits actual creates, updates and failures from persistence without forwarding errors or rows', async () => {
    const result = { imported: 1, updated: 1, errors: [{ row: 3, imei: 'private-imei', message: 'private name' }],
      diagnostics: { detectedRows: 3, acceptedRows: 2, discardedRows: 1, discardedByReason: { invalid_imei: 1 }, missingRequiredFields: [], missingRecommendedFields: [] } };
    vi.mocked(fetchWithTimeout).mockResolvedValue(json(result));
    await importBackendRows(mockUser, 'inventory', Array.from({ length: 3 }, () => ({ model: 'private model', imei: 'private-imei', price: 500 })));
    expect(capture).toHaveBeenCalledWith('import_result', {
      import_type: 'inventory', source: 'excel', phase: 'commit',
      rows_detected: 3, rows_prepared: 3, rows_imported: 1, rows_updated: 1, rows_discarded: 1,
      discarded_by_reason: { invalid_imei: 1 }, missing_required_fields: [], missing_recommended_fields: [],
    });
    expect(JSON.stringify(vi.mocked(capture).mock.calls)).not.toContain('private');
  });

  it('reports accepted rows without price through analyze, apply and commit without missing_price discards', async () => {
    const diagnostics = { detectedRows: 1, acceptedRows: 1, discardedRows: 0, discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: ['price', 'imei'] };
    const analysis = { rows: [{ model: 'private model', cost: '420' }], plan: [], diagnostics };
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(json(analysis)).mockResolvedValueOnce(json(analysis))
      .mockResolvedValueOnce(json({ imported: 1, updated: 0, errors: [], priceToDefine: 1, diagnostics: { ...diagnostics, missingRecommendedFields: [] } }));
    const sheets = [{ name: 'Stock', rows: [['Modelo', 'Costo'], ['private model', '420']] }];
    await analyzeImport(mockUser, 'inventory', sheets);
    await applyImportPlan(mockUser, 'inventory', sheets, []);
    expect(await importBackendRows(mockUser, 'inventory', [{ model: 'private model', imei: '', price: null, cost: 420 }])).toMatchObject({ imported: 1, priceToDefine: 1 });
    expect(JSON.parse(String(vi.mocked(fetchWithTimeout).mock.calls[2][1]?.body))).toEqual({ rows: [{ model: 'private model', imei: '', price: null, cost: 420 }] });
    const events = vi.mocked(capture).mock.calls.filter(([event]) => ['import_analysis_completed', 'import_result'].includes(event));
    expect(events).toHaveLength(3);
    for (const [, properties] of events) expect(properties).toMatchObject({ rows_prepared: 1, rows_discarded: 0, discarded_by_reason: {}, missing_required_fields: [] });
    expect(JSON.stringify(events)).not.toContain('private');
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
        'x-im-device': 'desktop',
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
        'x-im-device': 'desktop',
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

describe('análisis progresivo', () => {
  it('entrega chunks partidos, conserva UTF-8 y exige un resultado final', async () => {
    const { analyzeInventoryTextProgress } = await import('./import-api');
    setApiBaseUrl('https://api.imanager.test');
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({ type: 'progress', rows: [{ model: 'Teléfono', quantity: 2 }] }) + '\n' + JSON.stringify({ type: 'result', analysis: { rows: [{ model: 'Teléfono' }] } }) + '\n');
    const stream = new ReadableStream({ start(controller) { for (let i = 0; i < data.length; i += 3) controller.enqueue(data.slice(i, i + 3)); controller.close(); } });
    vi.mocked(fetchWithTimeout).mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }));
    const progress = vi.fn();
    expect(await analyzeInventoryTextProgress(mockUser, 'texto', progress, new AbortController().signal)).toMatchObject({ rows: [{ model: 'Teléfono' }] });
    expect(progress).toHaveBeenCalledWith([{ model: 'Teléfono', quantity: 2 }]);
    vi.mocked(fetchWithTimeout).mockResolvedValue(new Response('{"type":"progress","rows":[]}\n', { headers: { 'Content-Type': 'application/x-ndjson' } }));
    await expect(analyzeInventoryTextProgress(mockUser, 'texto', progress, new AbortController().signal)).rejects.toThrow(/interrumpió/);
  });
});

it('no convierte un precio inválido en null al serializar el pedido', async () => {
  const { importBackendRows } = await import('./import-api');
  vi.mocked(fetchWithTimeout).mockClear();
  await expect(importBackendRows(mockUser, 'inventory', [{ imei: '', model: 'iPhone 13', price: NaN }])).rejects.toThrow('Revisá los precios inválidos');
  expect(fetchWithTimeout).not.toHaveBeenCalled();
});
