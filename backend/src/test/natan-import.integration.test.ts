import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { natanCases } from '../../test/fixtures/import/natan/cases.js';
import type { AnalysisResult } from '../modules/import/analyze-import.service.js';
import type { ImportSheet } from '../modules/import/sheet-plan.js';
import { parseArDate } from '../lib/ar-date.js';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
afterEach(() => vi.unstubAllEnvs());

it.each([
  { field: 'grade', key: 'calidad_origen' },
  { field: 'condition', key: 'condicion_origen' },
])('00: tienda vacía conserva calidad libre asignada a $field al aplicar y confirmar', async ({ field, key }) => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const { store } = await seedStoreContext();
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(0);
  const fixture = natanCases.find(fixture => fixture.file === '00_natan_anon')!;
  const sheets: ImportSheet[] = JSON.parse(readFileSync(new URL('../../test/fixtures/import/natan/00_natan_anon.grid.json', import.meta.url), 'utf8'));
  const analyze = await getApp().inject({ method: 'POST', url: '/api/import/analyze', headers, payload: { section: 'inventory', sheets } });
  expect(analyze.statusCode).toBe(200);
  const analysis: AnalysisResult = analyze.json();
  const plan = analysis.plan.map(item => ({ ...item, mapping: item.mapping.map(column => column.columnIndex === 6 ? { ...column, field } : column) }));
  const apply = await getApp().inject({ method: 'POST', url: '/api/import/apply', headers, payload: { section: 'inventory', sheets, plan } });
  expect(apply.statusCode).toBe(200);
  const applied: AnalysisResult = apply.json();
  expect(applied.source).toBe('manual');
  expect(applied.rows.length).toBe(fixture.accepted);
  expect(applied.diagnostics).toMatchObject({ acceptedRows: fixture.accepted, discardedByReason: fixture.reasons });
  expect(applied.plan[0].mapping.find(column => column.columnIndex === 6)?.field).toBe(`custom:${key}`);
  expect(applied.suggestedDefinitions).toEqual([expect.objectContaining({ entity: 'inventory', key, type: 'text' })]);
  // Reapplying an already repaired plan must retain its suggested definition.
  const repeated = await getApp().inject({ method: 'POST', url: '/api/import/apply', headers, payload: { section: 'inventory', sheets, plan: applied.plan } });
  expect(repeated.statusCode).toBe(200);
  expect(repeated.json().suggestedDefinitions).toEqual(applied.suggestedDefinitions);
  const rows = applied.rows.map(row => ({
    ...row, imei: row.imei ?? '', sourceRow: Number(row._sourceRow),
    price: row.price?.trim() ? Number(row.price) : null,
    cost: row.cost?.trim() ? Number(row.cost) : undefined,
    customFields: Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('custom:')).map(([key, value]) => [key.slice(7), value])),
  }));
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows, definitions: applied.suggestedDefinitions } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ imported: fixture.accepted, updated: 0, errors: [] });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(fixture.accepted);
  expect(await prisma.customFieldDefinition.count({ where: { storeId: store!.id, entity: 'inventory', key } })).toBe(1);
  const stored = await prisma.inventoryItem.findMany({ where: { storeId: store!.id }, select: { customFields: true } });
  expect(stored.map(item => (item.customFields as Record<string, unknown>)[key] ?? '').sort()).toEqual(rows.map(row => row.customFields[key]).sort());
});

it.each(natanCases)('$file: analyze → apply → persistencia y reimportación', async fixture => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const { store } = await seedStoreContext();
  const sheets: ImportSheet[] = JSON.parse(readFileSync(new URL(`../../test/fixtures/import/natan/${fixture.file}.grid.json`, import.meta.url), 'utf8'));
  const payload = { section: 'inventory', sheets };
  const analyze = await getApp().inject({ method: 'POST', url: '/api/import/analyze', headers, payload });
  expect(analyze.statusCode, analyze.body).toBe(200);
  const analysis: AnalysisResult = analyze.json();
  expect(analysis.diagnostics).toMatchObject({ detectedRows: fixture.detected, acceptedRows: fixture.accepted, discardedByReason: fixture.reasons });
  expect(analysis.rows).toHaveLength(fixture.accepted);
  expect(Object.fromEntries(analysis.plan[0].mapping.filter(column => column.field).map(column => [column.columnIndex, column.field]))).toEqual(fixture.mapping);
  const apply = await getApp().inject({ method: 'POST', url: '/api/import/apply', headers, payload: { ...payload, plan: analysis.plan } });
  expect(apply.statusCode, apply.body).toBe(200);
  expect(apply.json().rows).toEqual(analysis.rows);
  const rows = analysis.rows.map(row => ({
    ...row, supplierName: row.supplierName, model: row.model, entryDate: row.entryDate, batteryNote: row.batteryNote, currency: row.currency, imei: row.imei ?? '', sourceRow: Number(row._sourceRow),
    price: row.price?.trim() ? Number(row.price) : null,
    ...(row.cost?.trim() ? { cost: Number(row.cost) } : { cost: undefined }),
    customFields: Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('custom:')).map(([key, value]) => [key.slice(7), value])),
  }));
  const run = () => getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows, definitions: analysis.suggestedDefinitions ?? [] } });
  const first = await run();
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json()).toMatchObject({ imported: fixture.accepted, updated: 0, errors: [] });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(fixture.accepted);
  const withoutImei = rows.filter(row => !row.imei).length;
  expect(first.json().withoutImei ?? 0).toBe(withoutImei);
  const second = await run();
  expect(second.statusCode, second.body).toBe(200);
  // Unidentified rows intentionally retain the old create behavior; identified rows are idempotent.
  expect(second.json()).toMatchObject({ imported: withoutImei, updated: fixture.accepted - withoutImei, errors: [] });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(fixture.accepted + withoutImei);
  const stored = await prisma.inventoryItem.findMany({ where: { storeId: store!.id }, include: { supplier: true } });
  expect(await prisma.supplier.count({ where: { storeId: store!.id } })).toBe(new Set(rows.map(row => row.supplierName?.trim().toLocaleLowerCase('es')).filter(Boolean)).size);
  for (const row of rows.filter(row => row.imei)) {
    const item = stored.find(item => item.imei === row.imei)!;
    expect(item.model).toBe(row.model);
    if (row.supplierName) {
      expect(item.supplierId).toBeTruthy();
      expect(item.supplier).toMatchObject({ storeId: store!.id, name: row.supplierName.trim() });
    }
    expect(Number(item.cost)).toBe(row.cost ?? 0);
    expect(item.price == null ? null : Number(item.price)).toBe(row.price);
    expect(item.entryDate?.toISOString().slice(0, 10) ?? null).toBe(row.entryDate ? parseArDate(row.entryDate)?.toISOString().slice(0, 10) : null);
    expect(item.batteryNote).toBe(row.batteryNote || null);
    expect(item.currency).toBe(row.currency ?? 'ARS');
    if (row.customFields.calidad_origen) expect(item.customFields).toMatchObject({ calidad_origen: row.customFields.calidad_origen });
    if (row.customFields.condicion_origen) expect(item.customFields).toMatchObject({ condicion_origen: row.customFields.condicion_origen });
  }
}, 30_000);

it('00: confirmación directa conserva 60 equipos incluido el duplicado sin IMEI', async () => {
  const { store } = await seedStoreContext();
  const [sheet]: ImportSheet[] = JSON.parse(readFileSync(new URL('../../test/fixtures/import/natan/00_natan_anon.grid.json', import.meta.url), 'utf8'));
  const rows = sheet.rows.map((row, index) => ({ sourceRow: index + 1, entryDate: row[0], model: row[2], capacity: row[3], batteryHealth: row[4], imei: row[5], color: row[7], cost: row[8], batteryNote: row[9], status: row[10] }));
  for (let run = 0; run < 2; run++) {
    const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ imported: run ? 1 : 60, updated: run ? 59 : 0,
      errors: [], diagnostics: { discardedByReason: {} } });
    expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(60 + run);
  }
});
it('importes y modelos inválidos se conservan en notas; precio ausente se guarda a definir', async () => {
  const { store } = await seedStoreContext();
  const rows = [...['texto', '-1', '=A1', '#N/A', '-', 'sin dato'].flatMap(value => [
    { model: 'iPhone 13', imei: '', cost: value }, { model: 'iPhone 13', imei: '', price: value },
  ]), ...['=A1', '#REF!', '#N/A', '#VALUE!'].map(model => ({ model, imei: '' })), { model: 'iPhone 13', imei: '' }];
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: rows.length, priceToDefine: rows.length, errors: [], diagnostics: { discardedByReason: {} } });
  expect(response.json().errors.every((error: { message: string }) => /inválido|error de Excel/.test(error.message))).toBe(true);
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(rows.length);
  expect((await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id } })).price).toBeNull();
});
