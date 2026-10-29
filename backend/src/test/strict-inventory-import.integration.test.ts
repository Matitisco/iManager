import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../modules/import/analyze-import.service.js';
import type { ImportSheet } from '../modules/import/sheet-plan.js';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
afterEach(() => vi.unstubAllEnvs());
const fixtures = [
  { file: 'natan/00_natan_anon', env: 'IMPORT_NATAN_GRID', expected: 60 },
  { file: 'ai-fakes/F07_desordenado_a_mano', env: 'IMPORT_F07_GRID', expected: 25 },
];
it.each(fixtures)('$file: every nonempty source row survives preview, apply, commit and reimport', async fixture => {
  vi.stubEnv('OPENAI_API_KEY', '');
  const { store } = await seedStoreContext();
  const sheets: ImportSheet[] = JSON.parse(readFileSync(process.env[fixture.env] || new URL(`../../test/fixtures/import/${fixture.file}.grid.json`, import.meta.url), 'utf8'));
  const payload = { section: 'inventory', sheets };
  const analyze = await getApp().inject({ method: 'POST', url: '/api/import/analyze', headers, payload });
  expect(analyze.statusCode, analyze.body).toBe(200);
  const analysis: AnalysisResult = analyze.json();
  const count = analysis.plan.filter(plan => plan.include).reduce((sum, plan) => sum + sheets.find(sheet => sheet.name === plan.name)!.rows.slice(plan.headerRow).filter(row => row.some(cell => cell.trim())).length, 0);
  expect(count).toBe(fixture.expected);
  expect(analysis.rows).toHaveLength(count);
  expect(Object.keys(analysis.diagnostics!.discardedByReason).every(reason => reason === 'empty')).toBe(true);
  const apply = await getApp().inject({ method: 'POST', url: '/api/import/apply', headers, payload: { ...payload, plan: analysis.plan } });
  expect(apply.statusCode, apply.body).toBe(200);
  expect(apply.json().rows).toEqual(analysis.rows);
  const rows = analysis.rows.map(row => ({ ...row, imei: row.imei ?? '', sourceRow: Number(row._sourceRow), customFields: Object.fromEntries(Object.entries(row).filter(([key]) => key.startsWith('custom:')).map(([key, value]) => [key.slice(7), value])) }));
  const run = () => getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows, definitions: analysis.suggestedDefinitions } });
  const response = await run();
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: count, updated: 0, errors: [] });
  expect(await prisma.inventoryItem.count({ where: { storeId: store!.id } })).toBe(count);
  const possibleTotals = await prisma.inventoryItem.findMany({ where: { storeId: store!.id, batteryNote: { contains: 'Parece una fila de total' } } });
  expect(possibleTotals).toHaveLength(fixture.file.startsWith('natan') ? 0 : 1);
  for (const total of possibleTotals) expect(total.status).toBe('EN_REVISION');
  if (fixture.file.startsWith('natan')) {
    const duplicate = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id, batteryNote: { contains: 'IMEI duplicado en el archivo:' } } });
    expect(duplicate).toMatchObject({ imei: null, status: 'EN_REVISION' });
  }
  const again = await run();
  expect(again.statusCode, again.body).toBe(200);
  expect(again.json()).toMatchObject({ imported: rows.filter(row => !row.imei).length, updated: rows.filter(row => row.imei).length, errors: [] });
});
it('direct duplicate updates an existing store device once and creates every remaining occurrence', async () => {
  const { store } = await seedStoreContext();
  const imei = '990000000000038';
  await prisma.inventoryItem.create({ data: { storeId: store!.id, imei, model: 'Old', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 0, price: null, status: 'DISPONIBLE' } });
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: { rows: [1, 2, 3].map(i => ({ imei, model: `Equipo ${i}` })) } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 2, updated: 1, errors: [] });
  const items = await prisma.inventoryItem.findMany({ where: { storeId: store!.id } });
  expect(items).toHaveLength(3);
  expect(items.find(item => item.imei === imei)?.model).toBe('Equipo 1');
  expect(items.filter(item => !item.imei).every(item => item.status === 'EN_REVISION' && item.batteryNote === `IMEI duplicado en el archivo: ${imei}`)).toBe(true);
});
it('a database failure after a successful row rolls back devices, updates, definitions and suppliers', async () => {
  const { store } = await seedStoreContext();
  const item = await prisma.inventoryItem.create({ data: { storeId: store!.id, imei: '990000000000038', model: 'Original', capacity: '', color: '', condition: 'USADO', grade: '', batteryHealth: '', cost: 0, price: null, status: 'DISPONIBLE', reservedDepositId: 'locked' } });
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: {
    definitions: [{ entity: 'inventory', key: 'qa', label: 'QA', type: 'text', order: 0 }],
    rows: [{ imei: '', model: 'New', supplierName: 'New supplier' }, { imei: item.imei, model: 'Changed' }],
  } });
  expect(response.statusCode).toBe(409);
  expect(response.json().error).toContain('No se importó ningún equipo');
  expect(await prisma.inventoryItem.findMany({ where: { storeId: store!.id } })).toEqual([item]);
  expect(await prisma.supplier.count({ where: { storeId: store!.id } })).toBe(0);
  expect(await prisma.customFieldDefinition.count({ where: { storeId: store!.id } })).toBe(0);
});
it('keeps invalid built-in and typed custom values as notes instead of discarding the row', async () => {
  const { store } = await seedStoreContext();
  const response = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers, payload: {
    definitions: [{ entity: 'inventory', key: 'repairs', label: 'Reparaciones', type: 'number', order: 0 }],
    rows: [{ model: '#REF!', imei: '3.5E+14', price: 'ilegible', cost: '-1', color: 'x'.repeat(51), condition: 'raro', grade: 'ZZ', batteryHealth: '8*%', entryDate: '31/02/2026', customFields: { repairs: 'pendiente' } }],
  } });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json()).toMatchObject({ imported: 1, updated: 0, errors: [] });
  const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: store!.id } });
  expect(item).toMatchObject({ model: 'Equipo sin modelo', imei: null, price: null, status: 'EN_REVISION' });
  for (const value of ['#REF!', '3.5E+14', 'ilegible', '-1', 'x'.repeat(51), 'raro', 'ZZ', '8*%', '31/02/2026', 'pendiente']) expect(item.batteryNote).toContain(value);
});
