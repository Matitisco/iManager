import { beforeEach, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  customFieldDefinition: { findMany: vi.fn() },
  inventoryItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: prismaMock }));
import { importInventoryItems } from './inventory.service.js';
import { ILLEGIBLE_IMEI_MESSAGE, validateInventoryImportRow } from './import-validation.js';

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.store.findUnique.mockResolvedValue({ currency: 'USD' });
  prismaMock.customFieldDefinition.findMany.mockResolvedValue([]);
  prismaMock.inventoryItem.findFirst.mockResolvedValue(null);
  prismaMock.inventoryItem.create.mockResolvedValue({ id: 'new-item' });
});

it('counts amount-only footers, bad price and invalid IMEI without saving rejected rows', async () => {
  const result = await importInventoryItems('store-test', [
    { imei: '', model: 'iPhone 13', price: 500 },
    { imei: '', model: '', price: 500 },
    { imei: '', model: 'iPhone 13', price: NaN },
    { imei: '1234', model: 'iPhone 13', price: 500 },
  ]);
  expect(result).toMatchObject({ imported: 1, updated: 0, diagnostics: {
    detectedRows: 4, acceptedRows: 1, discardedRows: 3,
    discardedByReason: { footer: 1, invalid_price: 1, invalid_imei: 1 },
    missingRequiredFields: [], missingRecommendedFields: [],
  } });
  expect(prismaMock.inventoryItem.create).toHaveBeenCalledOnce();
});

it('counts an existing IMEI as an accepted update, preserving upsert behavior', async () => {
  prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: 'existing-item', customFields: {}, price: 500, cost: 400, currency: 'USD', condition: 'USADO', grade: 'A' });
  const result = await importInventoryItems('store-test', [{ imei: '356789012345671', model: 'iPhone 13', price: 500 }]);
  expect(result).toMatchObject({ imported: 0, updated: 1, errors: [], diagnostics: {
    detectedRows: 1, acceptedRows: 1, discardedRows: 0, discardedByReason: {},
  } });
  expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled();
  expect(prismaMock.inventoryItem.update).toHaveBeenCalledOnce();
});

it('accepts null prices while retaining discard reasons for other rows', async () => {
  const result = await importInventoryItems('store-test', [
    { imei: '', model: 'iPhone 13', price: null, cost: 420 },
    { imei: '', model: '', price: null },
    { imei: '', model: 'iPhone 14', price: NaN },
  ]);
  expect(result).toMatchObject({ imported: 1, priceToDefine: 1, diagnostics: {
    detectedRows: 3, acceptedRows: 1, discardedRows: 2,
    discardedByReason: { missing_model: 1, invalid_price: 1 },
  } });
  expect(result.diagnostics?.discardedByReason).not.toHaveProperty('missing_price');
  expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ price: null }) });
});

it.each(['SIN SERVICIO', 'SERVICIO TECNICO', 'SERVICIO TÉCNICO', 'SERVICIO TEC', 'DESCONOCIDO FICTICIO'])('persists %s without a row error and retains its original value', async status => {
  const result = await importInventoryItems('store-test', [{ imei: '', model: 'iPhone 13', status, customFields: { serial: 'FAKE' } }]);
  expect(result).toMatchObject({ imported: 1, errors: [] });
  expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    status: status === 'DESCONOCIDO FICTICIO' ? 'DISPONIBLE' : 'EN_REVISION',
    customFields: { serial: 'FAKE', originalStatus: status },
  }) });
});


it('clears unreadable batteries, rejects the second file IMEI and preserves Excel rows', async () => {
  const result = await importInventoryItems('store-test', [
    { sourceRow: 38, imei: '990000000000038', model: 'iPhone 13', batteryHealth: '8*%' },
    { sourceRow: 59, imei: '990000000000038', model: 'iPhone 14', batteryHealth: '8*%' },
    { sourceRow: 60, imei: '', model: 'iPhone 15' },
    { sourceRow: 61, imei: '', model: 'iPhone 15' },
  ]);
  expect(result).toMatchObject({ imported: 3, updated: 0,
    errors: [{ row: 59, message: 'IMEI repetido en el archivo (igual a la fila 38)' }],
    warnings: [{ row: 38, message: expect.stringContaining('sin batería') }, { row: 59, message: expect.stringContaining('sin batería') }],
    diagnostics: { discardedByReason: { duplicate: 1 }, rejected: [{ row: 59, reason: 'duplicate', message: 'IMEI repetido en el archivo (igual a la fila 38)' }] },
  });
  expect(prismaMock.inventoryItem.create.mock.calls[0][0].data.batteryHealth).toBe('');
});


it('preview and confirmation reject the same file-only errors and accept the same count', async () => {
  const { applyImportPlan } = await import('../import/analyze-import.service.js');
  const header = ['model', 'price', 'condition', 'imei', 'grade', 'color', 'entryDate', 'batteryNote', 'batteryHealth'];
  const valid = ['iPhone 13', '500', 'USADO', '', 'A', 'Black', '2026-10-15', 'Original', '85%'];
  const bad = (index: number, value: string) => valid.map((cell, column) => index === column ? value : cell);
  const records = [valid, bad(0, ''), bad(1, '-1'), bad(2, 'inexistente'), bad(3, '1234'),
    bad(4, 'AA'), bad(5, 'x'.repeat(51)), bad(6, '31/02/2026'), bad(7, 'x'.repeat(2001)),
    bad(3, '990000000000038'), bad(3, '990000000000038'), bad(8, '8*%')];
  const sheets = [{ name: 'Stock', rows: [header, ...records] }];
  const analysis = applyImportPlan({ sheets, section: 'inventory', currency: 'USD', plan: [{
    name: 'Stock', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: records.length + 1,
    mapping: header.map((field, columnIndex) => ({ header: field, columnIndex, field })),
    splitModelCapacity: false, batteryAsPercent: true, priceCurrency: 'USD',
  }] });
  const rawRows = records.map((values, index) => ({ ...Object.fromEntries(header.map((field, column) => [field, values[column]])),
    imei: values[3], model: values[0], price: Number(values[1]), sourceRow: index + 2 }));
  const confirmedRaw = await importInventoryItems('store-test', rawRows);
  expect(analysis.rows.length).toBe(3);
  expect(analysis.rows.length).toBe(confirmedRaw.imported + confirmedRaw.updated);
  expect(analysis.diagnostics?.rejected).toEqual(confirmedRaw.diagnostics?.rejected);
  expect(analysis.diagnostics?.warnings).toEqual(confirmedRaw.warnings);
  const confirmedPreview = await importInventoryItems('store-test', analysis.rows.map(row => ({
    ...row, imei: row.imei, model: row.model, sourceRow: Number(row._sourceRow), price: Number(row.price),
  })));
  expect(confirmedPreview.errors).toEqual([]);
  expect(confirmedPreview.imported + confirmedPreview.updated).toBe(analysis.rows.length);
});

it('only accepts scientific IMEIs with every digit, without float conversion or collisions', async () => {
  const { applyImportPlan } = await import('../import/analyze-import.service.js');
  const identifiers = ['3.5E+14', '3.50000000000000E+14', '3.56789012340005E+14', '3.56789012340007E+14', '356789012340005', '356789012340009.0'];
  const analysis = applyImportPlan({ section: 'inventory', currency: 'USD', sheets: [{ name: 'Stock', rows: [
    ['Modelo', 'IMEI'], ...identifiers.map(imei => ['iPhone 13', imei]),
  ] }], plan: [{ name: 'Stock', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 7,
    condition: '', splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '',
    mapping: [{ header: 'Modelo', field: 'model' }, { header: 'IMEI', field: 'imei' }],
  }] });
  const confirmed = await importInventoryItems('synthetic-store', identifiers.map((imei, i) => ({ model: 'iPhone 13', imei, sourceRow: i + 2 })));
  expect(analysis.rows.map(row => row.imei)).toEqual(['356789012340005', '356789012340007', '356789012340009']);
  expect(analysis.rows.length).toBe(confirmed.imported + confirmed.updated);
  expect(confirmed.updated).toBe(0);
  expect(analysis.diagnostics?.rejected).toEqual(confirmed.diagnostics?.rejected);
  expect(confirmed.diagnostics?.rejected).toEqual([
    { row: 2, reason: 'invalid_imei', message: ILLEGIBLE_IMEI_MESSAGE },
    { row: 3, reason: 'invalid_imei', message: ILLEGIBLE_IMEI_MESSAGE },
    { row: 6, reason: 'duplicate', message: 'IMEI repetido en el archivo (igual a la fila 4)' },
  ]);
});

it.each(['Total', 'Subtotal', 'Suma', 'Totales', 'Nota', 'Notas', 'Observación', 'Observaciones'])('preserves real equipment called %s when it has identity', model => {
  for (const identity of [{ imei: '356789012340005' }, { capacity: '128 GB' }]) {
    expect(validateInventoryImportRow({ model: `${model} Phone`, ...identity }, 2, new Map()).ok).toBe(true);
  }
});

it('reports generic notes and amount-only footers equally in preview and direct confirmation', async () => {
  const { applyImportPlan } = await import('../import/analyze-import.service.js');
  const records = [['Total Phone', '128 GB', '', '500'], ['Observación: revisar stock', '', '', ''], ['', '', '', '1000'], ['1000', '', '', ''], ['Precio no incluye IVA', '', '', ''], ['iPhone 13', '', '356789012340005', '500']];
  const analysis = applyImportPlan({ section: 'inventory', currency: 'USD', sheets: [{ name: 'Stock', rows: [
    ['Modelo', 'Capacidad', 'IMEI', 'Precio'], ...records,
  ] }], plan: [{ name: 'Stock', include: true, headerRow: 1, dataStartRow: 2, dataEndRow: 7,
    condition: '', splitModelCapacity: false, batteryAsPercent: false, priceCurrency: '',
    mapping: ['model', 'capacity', 'imei', 'price'].map((field, columnIndex) => ({ header: '', field, columnIndex })),
  }] });
  const confirmed = await importInventoryItems('synthetic-store', records.map((r, i) => ({ sourceRow: i + 2,
    model: r[0], capacity: r[1], imei: r[2], price: r[3] ? Number(r[3]) : null,
  })));
  expect(analysis.rows).toHaveLength(2);
  expect(analysis.rows.length).toBe(confirmed.imported + confirmed.updated);
  expect(analysis.diagnostics?.rejected).toEqual(confirmed.diagnostics?.rejected);
  expect(confirmed.diagnostics?.rejected?.map(({ row, reason }) => ({ row, reason }))).toEqual([3, 4, 5, 6].map(row => ({ row, reason: 'footer' })));
});

it.each(['0,87', '0.87'])('persists decimal battery %s and slash qualities on create and reimport', async batteryHealth => {
  const rows = ['A/A-', 'B/C'].map((grade, i) => ({ model: 'iPhone 13', imei: `99000000000000${i}`, grade, batteryHealth }));
  const created = await importInventoryItems('store-test', rows);
  expect(created).toMatchObject({ imported: 2, errors: [] });
  expect(created.warnings ?? []).toEqual([]);
  for (const [i, grade] of ['A/A-', 'B/C'].entries()) {
    expect(prismaMock.inventoryItem.create.mock.calls[i][0].data).toMatchObject({ batteryHealth: '87%', grade });
  }
  prismaMock.inventoryItem.findFirst.mockResolvedValue({ id: 'existing-item', customFields: {}, price: null, cost: 0, currency: 'USD', condition: 'USADO', grade: 'A/A-' });
  const updated = await importInventoryItems('store-test', rows);
  expect(updated).toMatchObject({ updated: 2, errors: [] });
  expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ batteryHealth: '87%', grade: 'B/C' }) }));
});
