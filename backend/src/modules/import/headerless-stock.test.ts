import { afterEach, describe, expect, it, vi } from 'vitest';
import { mistakenStockPlan, stockModelResponse, syntheticStockRows, syntheticQualityStockRows, mistakenQualityStockPlan } from '../../../test/fixtures/headerless-stock.js';
import { acceptModelPlan, analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { headerCandidates } from './decisions-plan.js';
import { normalizeInventoryImportStatus } from './inventory-status.js';
import { applyPlans, heuristicPlan, sheetHeaders, type ImportSheet } from './sheet-plan.js';
import type { DecisionRequest } from './decisions-plan.js';
import { DECISIONS_URL, RESPONSES_URL } from './responses-client.js';

const stockFields = ['entryDate', 'supplierName', 'model', 'capacity', 'batteryHealth', 'imei', 'ignore', 'color', 'cost', 'batteryNote', 'status'];
function stockDecisions(init: RequestInit | undefined, fields = stockFields) {
  const body: DecisionRequest = JSON.parse(String(init?.body));
  return Response.json({ answers: body.questions.map(q => ({ name: q.name,
    ...(q.type === 'predicate' ? { probability: 1 } : { choice: q.name.endsWith('_hdr') ? '0' : fields[Number(/_c(\d+)/.exec(q.name)?.[1])] ?? 'ignore', confidence: 1 }),
  })) });
}
const sheets = (): ImportSheet[] => [{ name: 'stock de equipos', rows: syntheticStockRows() }];
const apply = (input: ImportSheet[]) => applyPlans(input, heuristicPlan(input, 'inventory', 'USD'), 'inventory', 'USD');
afterEach(() => vi.unstubAllEnvs());

describe('stock sin encabezado', () => {
  it('repara la respuesta de OpenAI de producción: detecta y acepta 60 filas, incluida la primera', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const input = sheets();
    // Force the fallback path with an additional ambiguous model column.
    input[0].rows.forEach(row => { row[15] = 'iPhone 16'; });
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(DECISIONS_URL);
      return stockDecisions(init);
    });
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // Genuine bad cells remain explicit after two retries.
    expect(result.source).toBe('model');
    expect(result.notice).toContain('por revisar');
    expect(result.plan[0]).toMatchObject({ include: true, headerRow: 0, dataStartRow: 1, dataEndRow: 60, batteryAsPercent: true });
    expect(result.plan[0].mapping.find(column => column.field === 'batteryHealth')).toMatchObject({ header: 'E', columnIndex: 4, field: 'batteryHealth' });
    expect(result.plan[0].mapping[9].field).toBe('batteryNote');
    expect(result.rows).toHaveLength(59);
    expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', imei: '990000000000000', cost: '300', batteryHealth: '80%' });
    expect(result.diagnostics?.rejected).toContainEqual({ row: 10, reason: 'invalid_price', message: expect.stringContaining('Costo inválido') });
    expect(result.rows[0].entryDate).toBe(input[0].rows[0][0]);
    expect(result.rows[1].entryDate).toBe(input[0].rows[1][0]);
    expect(result.rows[1].batteryNote).toBe('BATERIA');
    expect(result.rows.every(row => row.purchasedAt === undefined)).toBe(true);
    expect(result.rows.every(row => !row.price && row.batteryHealth !== 'BATERIA')).toBe(true);
    expect(result.diagnostics).toMatchObject({ detectedRows: 60, acceptedRows: 59, discardedRows: 1, discardedByReason: { invalid_price: 1 }, missingRecommendedFields: ['price'] });
    expect(applyImportPlan({ sheets: input, plan: result.plan, section: 'inventory', currency: 'USD' }).rows).toEqual(result.rows);
  });

  it('admite headerRow=0 del modelo y detecta datos arriba de un falso encabezado de texto', () => {
    const input = sheets();
    const raw = mistakenStockPlan(input[0].rows);
    raw.sheets[0].headerRow = 0;
    expect(acceptModelPlan(input, raw, 'inventory', 'USD')?.[0].headerRow).toBe(0);
    input[0].rows[4] = ['Fecha', 'Proveedor', 'Modelo', 'Capacidad', 'Salud', 'IMEI', 'Calidad', 'Color', 'Costo'];
    raw.sheets[0].headerRow = 5;
    raw.sheets[0].mapping = [{ header: 'Modelo', field: 'model' }];
    expect(acceptModelPlan(input, raw, 'inventory', 'USD')?.[0]).toMatchObject({ headerRow: 0, dataStartRow: 1 });
  });

  it('conserva proveedor del modelo y notas de reparación junto con fecha de ingreso y salud inferidas', () => {
    const input = sheets();
    const plan = heuristicPlan(input, 'inventory', 'USD')[0];
    plan.mapping = [
      { header: 'A', columnIndex: 0, field: 'purchasedAt' },
      { header: 'B', columnIndex: 1, field: 'supplierName' },
      { header: 'C', columnIndex: 2, field: 'model' },
      { header: 'J', columnIndex: 9, field: 'batteryHealth' },
    ];
    const accepted = acceptModelPlan(input, { sheets: [plan] }, 'inventory', 'USD')!;
    const result = applyPlans(input, accepted, 'inventory', 'USD');
    expect(result.rows).toHaveLength(59);
    expect(result.rows[1]).toMatchObject({ entryDate: '2026-10-02', supplierName: 'CANJE/xx', batteryHealth: '81%', batteryNote: 'BATERIA' });
    expect(result.rows[1]).not.toHaveProperty('purchasedAt');
  });

  it('mantiene el analizador Decisions para hojas sin encabezado y corrige sus campos en conflicto', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    let attempt = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(DECISIONS_URL); attempt++;
      const fields = [...stockFields];
      if (attempt === 1) { fields[4] = 'ignore'; fields[9] = 'batteryHealth'; }
      return stockDecisions(init, fields);
    });
    const input = sheets();
    input[0].rows.forEach(row => { row[15] = 'iPhone 16'; });
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.source).toBe('model');
    expect(result.rows).toHaveLength(59);
    expect(result.rows[1]).toMatchObject({ entryDate: '2026-10-02', supplierName: 'CANJE/xx', batteryHealth: '81%', batteryNote: 'BATERIA' });
  });

  it('normaliza seriales de Excel en fecha de ingreso y conserva fechas ISO e incompletas', () => {
    const input = [{ name: 'Stock', rows: [
      ['Fecha ingreso', 'Modelo', 'Detalle batería'],
      ['46310', 'iPhone 13', 'Batería cambiada'],
      ['2026-10-15', 'iPhone 14', 'Original'],
      ['15/10', 'iPhone 15', 'Reparada'],
    ] }];
    const result = apply(input);
    expect(result.rows.map(row => row.entryDate)).toEqual(['2026-10-15', '2026-10-15']);
    expect(result.diagnostics.rejected).toEqual([{ row: 4, reason: 'invalid_row', message: 'Fecha de ingreso inválida (dd/mm/aaaa)' }]);
    expect(result.rows.every(row => !row.batteryHealth)).toBe(true);
  });

  it('prefiere el modelo comprobado por contenido cuando el respaldo contradice un campo crítico', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const input = [{ name: 'Stock', rows: [
      ['Listado de equipos'], ['Modelo', 'Descripción', 'Precio', 'Costo', 'Salud'],
      ['iPhone 13', 'iPhone 14', '600', '400', '85%'],
    ] }];
    const expected = { name: 'Stock', include: true, condition: 'PRE-OWNED' as const, headerRow: 2, dataStartRow: 3, dataEndRow: 3,
      mapping: [{ header: 'Descripción', columnIndex: 1, field: 'model' }, { header: 'Precio', columnIndex: 2, field: 'price' }, { header: 'Salud', columnIndex: 4, field: 'batteryHealth' }],
      splitModelCapacity: false, batteryAsPercent: true, priceCurrency: 'USD' as const };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url) === RESPONSES_URL
      ? stockModelResponse({ sheets: [expected] }) : new Response('', { status: 500 }));
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(result.source).toBe('heuristic');
    expect(result.plan[0].mapping.find(column => column.field === 'model')?.columnIndex).toBe(0);
    expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', price: '600', batteryHealth: '85%' });
  });

  it('corrige solo batería de reparaciones cuando el encabezado sí es real', () => {
    const input = [{ name: 'Stock', rows: [['Modelo', 'Reparaciones', 'Salud'], ['iPhone 13', 'BATERIA', '0.85']] }];
    const plan = heuristicPlan(input, 'inventory', 'USD')[0];
    Object.assign(plan, { headerRow: 1, dataStartRow: 2, include: true });
    plan.mapping = [{ header: 'Modelo', columnIndex: 0, field: 'model' }, { header: 'Reparaciones', columnIndex: 1, field: 'batteryHealth' }];
    plan.batteryAsPercent = false;
    const accepted = acceptModelPlan(input, { sheets: [plan] }, 'inventory', 'USD')!;
    expect(accepted[0]).toMatchObject({ headerRow: 1, batteryAsPercent: true });
    expect(accepted[0].mapping.find(column => column.field === 'batteryHealth')?.columnIndex).toBe(2);
    expect(applyPlans(input, accepted, 'inventory', 'USD').rows[0].batteryHealth).toBe('85%');
    input[0].rows[1][2] = '';
    expect(acceptModelPlan(input, { sheets: [plan] }, 'inventory', 'USD')![0].mapping.some(column => column.field === 'batteryHealth')).toBe(false);
  });

  it('conserva modelos de una sola celda que parecen secciones en modo sin encabezado', () => {
    const input = sheets();
    input[0].rows.push(['', '', 'Samsung'], ['', '', 'MacBook']);
    const result = apply(input);
    expect(result.rows.slice(-2).map(row => row.model)).toEqual(['Samsung', 'MacBook']);
    expect(result.diagnostics.discardedByReason).toEqual({ invalid_price: 1 });
  });

  it('infiere A-P por contenido y conserva la fila 1 y todos los iPhone 13, sin OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetchImpl = vi.fn();
    const input = sheets();
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe('heuristic');
    expect(result.plan[0]).toMatchObject({ include: true, headerRow: 0, dataStartRow: 1, dataEndRow: 60 });
    expect(result.plan[0].mapping.map(column => column.header)).toEqual('ABCDEFGHIJKLMNOP'.split(''));
    expect(result.plan[0].mapping.filter(column => column.field)).toEqual(expect.arrayContaining([
      { header: 'A', columnIndex: 0, field: 'entryDate' },
      { header: 'C', columnIndex: 2, field: 'model' },
      { header: 'D', columnIndex: 3, field: 'capacity' },
      { header: 'E', columnIndex: 4, field: 'batteryHealth' },
      { header: 'F', columnIndex: 5, field: 'imei' },
      { header: 'H', columnIndex: 7, field: 'color' },
      { header: 'I', columnIndex: 8, field: 'cost' },
      { header: 'K', columnIndex: 10, field: 'status' },
    ]));
    expect(result.rows).toHaveLength(59);
    expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', capacity: '128GB', batteryHealth: '80%', imei: '990000000000000', cost: '300', status: 'DISPONIBLE' });
    expect(result.rows.filter(row => row.model === 'iPhone 13')).toHaveLength(19);
    for (const row of result.rows) {
      const i = Number(row.imei) - 990000000000000;
      expect(row.cost).toBe(String(300 + i * 10));
      expect(row.batteryHealth).toBe(i === 7 ? '' : `${80 + i % 20}%`);
      expect(row.status).toBe(['DISPONIBLE', 'VENDIDO', 'EN_REVISION', 'EN_REVISION'][i % 4]);
      expect(row.price).toBeUndefined();
    }
    expect(result.diagnostics).toMatchObject({ detectedRows: 60, acceptedRows: 59, discardedRows: 1, discardedByReason: { invalid_price: 1 }, missingRecommendedFields: ['price'] });
    expect(result.plan[0].mapping[9].field).toBe('batteryNote'); // BATERIA is a repair note, never health.
    expect(headerCandidates(input[0].rows)).toEqual([0]);
    const reapplied = applyImportPlan({ sheets: input, plan: result.plan, section: 'inventory', currency: 'USD' });
    expect(reapplied.rows).toEqual(result.rows);
    expect(reapplied.plan[0].headerRow).toBe(0);
    expect(applyImportPlan({ sheets: input, plan: result.plan, section: 'inventory', currency: 'USD', refreshMapping: true }).rows).toEqual(result.rows);
  });

  it('corrige un encabezado inventado por el modelo sin rechazar su plan', () => {
    const input = sheets();
    const plan = heuristicPlan(input, 'inventory', 'USD')[0];
    expect(acceptModelPlan(input, { sheets: [{ ...plan, headerRow: 2, mapping: [{ header: 'BATERIA', field: 'batteryHealth' }, { header: input[0].rows[1][2], field: 'model' }] }] }, 'inventory', 'USD')).toEqual([plan]);
  });

  it('mantiene todas las columnas aun si la fila 1 es corta y genera AA después de Z', () => {
    const input = sheets();
    input[0].rows[0] = input[0].rows[0].slice(0, 11);
    input[0].rows[1][26] = 'dato falso';
    input[0].rows[1] = Array.from(input[0].rows[1], value => value ?? '');
    const result = apply(input);
    expect(result.plans[0].mapping).toHaveLength(27);
    expect(result.plans[0].mapping[26]).toEqual({ header: 'AA', columnIndex: 26, field: '' });
    expect(result.rows[0].model).toBe('iPhone 13');
  });

  it('solo descarta encabezados repetidos con un nombre real para modelo', () => {
    const input = [{ name: 'Stock', rows: [['Modelo', 'Costo'], ['iPhone 13', '300'], ['Modelo', 'Costo'], ['iPhone 13', '310']] }];
    expect(apply(input).diagnostics.discardedByReason).toEqual({ section_header: 1 });
    const plan = heuristicPlan(input, 'inventory', 'USD');
    plan[0].mapping[0].header = 'iPhone 13';
    expect(applyPlans(input, plan, 'inventory', 'USD').rows.filter(row => row.model === 'iPhone 13')).toHaveLength(2);
  });

  it('distingue columnas vacías/repetidas por índice y conserva planes antiguos', () => {
    const input = [{ name: 'Stock', rows: [['Modelo', '', 'Valor', 'Valor', ''], ['iPhone 13', '990000000000001', '300', '500', 'Black']] }];
    const plan = heuristicPlan(input, 'inventory', 'USD');
    plan[0].mapping = [
      { header: 'Modelo', columnIndex: 0, field: 'model' }, { header: '', columnIndex: 1, field: 'imei' },
      { header: 'Valor', columnIndex: 2, field: 'cost' }, { header: 'Valor', columnIndex: 3, field: 'price' },
      { header: '', columnIndex: 4, field: 'color' },
    ];
    expect(applyPlans(input, plan, 'inventory', 'USD').rows[0]).toMatchObject({ model: 'iPhone 13', imei: '990000000000001', cost: '300', price: '500', color: 'Black' });
    const accepted = acceptModelPlan(input, { sheets: plan }, 'inventory', 'USD')!;
    expect(accepted[0].mapping).toEqual(plan[0].mapping);
    expect(applyPlans(input, accepted, 'inventory', 'USD').rows[0]).toMatchObject({ imei: '990000000000001', cost: '300', price: '500', color: 'Black' });
    plan[0].mapping = [{ header: 'Modelo', field: 'model' }];
    expect(applyPlans(input, plan, 'inventory', 'USD').rows[0].model).toBe('iPhone 13');
    expect(sheetHeaders(input[0].rows, 1)).toHaveLength(5);
  });

  it.each(['83-85', '91% 92%', '0.85', '85', '85%', 'N/A', ''])('conserva un mapeo correcto de batería con valor %s', battery => {
    const input = [{ name: 'Stock', rows: [['Modelo', 'Batería'], ['iPhone 13', battery]] }];
    const plan = heuristicPlan(input, 'inventory', 'USD');
    expect(acceptModelPlan(input, { sheets: plan }, 'inventory', 'USD')).toEqual(plan);
  });

  it.each(['abc', '123abc', '=I1', '-10'])('rechaza costo no válido %s con motivo claro', cost => {
    const result = apply([{ name: 'Stock', rows: [['Modelo', 'Costo'], ['iPhone 13', cost]] }]);
    expect(result.rows).toEqual([]);
    expect(result.diagnostics.rejected).toEqual([{ row: 2, reason: 'invalid_price', message: expect.stringContaining('Costo inválido') }]);
  });

  it.each(['SIN SERVICIO', 'SERVICIO TECNICO', 'SERVICIO TÉCNICO', 'SERVICIO TEC'])('normaliza %s al estado existente EN_REVISION', status => {
    const result = apply([{ name: 'Stock', rows: [['Modelo', 'Estado'], ['iPhone 13', status]] }]);
    expect(result.rows[0]).toMatchObject({ status: 'EN_REVISION', originalStatus: status });
  });

  it('conserva estados desconocidos y fracciones de batería desde cero', () => {
    expect(normalizeInventoryImportStatus('RARO FICTICIO')).toEqual({ status: 'DISPONIBLE', originalStatus: 'RARO FICTICIO' });
    const result = apply([{ name: 'Stock', rows: [['Modelo', 'Batería'], ['iPhone 13', '0'], ['iPhone 14', '1']] }]);
    expect(result.rows.map(row => row.batteryHealth)).toEqual(['0%', '100%']);
  });
});


describe('calidad libre y rechazos compartidos', () => {
  it.each(['decisions', 'heuristic'])('repara calidad libre por %s sin perder fila física ni advertencias', async route => {
    vi.stubEnv('OPENAI_API_KEY', route === 'heuristic' ? '' : 'sk-test');
    const input = [{ name: 'stock de equipos', rows: syntheticQualityStockRows() }];
    if (route !== 'heuristic') input[0].rows.forEach(row => { row[15] = 'iPhone 16'; });
    // Heuristics recognize an explicit quality header; headerless grade comes from the model.
    if (route === 'heuristic') input[0].rows.unshift(['Fecha ingreso', 'Proveedor', 'Modelo', 'Capacidad', 'Batería', 'IMEI', 'Calidad', 'Color', 'Costo', 'Reparaciones', 'Estado']);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe(DECISIONS_URL);
      const fields = [...stockFields]; fields[6] = 'grade';
      return stockDecisions(init, fields);
    });
    const result = await analyzeImport({ section: 'inventory', sheets: input, currency: 'USD' }, { fetchImpl });
    const offset = route === 'heuristic' ? 1 : 0;
    expect(result.source).toBe(route === 'heuristic' ? 'heuristic' : 'model');
    expect(result.suggestedDefinitions).toEqual([{ entity: 'inventory', key: 'calidad_origen', label: 'Calidad (origen)', type: 'text', order: 0 }]);
    expect(result.rows).toHaveLength(58);
    expect(result.rows[0]).toMatchObject({ 'custom:calidad_origen': 'A/A-', _sourceRow: String(1 + offset) });
    expect(result.rows.every(row => !row.grade)).toBe(true);
    expect(result.diagnostics).toMatchObject({ detectedRows: 60, acceptedRows: 58, discardedByReason: { invalid_price: 1, duplicate: 1 },
      rejected: [{ row: 10 + offset, reason: 'invalid_price', message: expect.stringContaining('Costo inválido') }, { row: 59 + offset, reason: 'duplicate', message: `IMEI repetido en el archivo (igual a la fila ${38 + offset})` }],
      warnings: expect.arrayContaining([{ row: 59 + offset, message: expect.stringContaining('sin batería') }]),
    });
    const manual = applyImportPlan({ section: 'inventory', sheets: input, currency: 'USD', plan: result.plan });
    expect(manual.rows).toEqual(result.rows);
    const gradePlan = result.plan.map(plan => ({ ...plan, mapping: plan.mapping.map(column => column.field === 'custom:calidad_origen' ? { ...column, field: 'grade' } : column) }));
    const chosen = applyImportPlan({ section: 'inventory', sheets: input, currency: 'USD', plan: gradePlan });
    expect(chosen.plan[0].mapping.some(column => column.field === 'grade')).toBe(true);
    expect(chosen.suggestedDefinitions).toBeUndefined();
    expect(chosen.rows).toHaveLength(0);
  });

  it.each([['A', 'B', 'AA'], ['A', 'AA', ''], ['A', 'B', 'C']])('preserva toda la columna si alguna calidad es inválida: %s', async (...grades) => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await analyzeImport({ section: 'inventory', currency: 'USD', sheets: [{ name: 'Stock', rows: [
      ['Modelo', 'Calidad'], ...grades.map(grade => ['iPhone 13', grade]),
    ] }] });
    const valid = grades.every(grade => ['A', 'B', 'C', ''].includes(grade));
    expect(result.plan[0].mapping.some(column => column.field === 'grade')).toBe(valid);
    if (valid) expect(result.suggestedDefinitions).toBeUndefined();
    else expect(result.suggestedDefinitions?.[0].key).toBe('calidad_origen');
  });
});
