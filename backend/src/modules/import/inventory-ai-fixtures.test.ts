import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { natanCases } from '../../../test/fixtures/import/natan/cases.js';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { DECISIONS_URL } from './responses-client.js';
import type { DecisionRequest } from './decisions-plan.js';
import type { ImportSheet } from './sheet-plan.js';
type ExpectedSheet = { name: string; include?: boolean; headerRow: number | null; rows: number; mapping: Record<number, string>; alt?: Record<number, string[]> };
type Fixture = { file: string; currency: 'ARS' | 'USD'; sheets: ExpectedSheet[] };
const read = (file: string) => JSON.parse(readFileSync(new URL(`../../../test/fixtures/import/${file}`, import.meta.url), 'utf8'));
const fakes: Fixture[] = read('ai-fakes/expected.json');
afterEach(() => vi.unstubAllEnvs());
const cases = [
  ...natanCases.map(fixture => ({ group: 'natan', file: fixture.file, currency: 'ARS' as const,
    sheets: [{ name: '*', include: true, headerRow: fixture.header, rows: fixture.accepted, mapping: fixture.mapping }] as ExpectedSheet[] })),
  ...fakes.map(fixture => ({ ...fixture, group: 'ai-fakes' })),
];
it.each(cases)('$group/$file: mocked Decisions primary, full preview and reapply', async fixture => {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const sheets: ImportSheet[] = read(`${fixture.group}/${fixture.file}.grid.json`);
  // Explicit labeled plans stand in for the model; no real requests or heuristic-derived answers.
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe(DECISIONS_URL);
    const body: DecisionRequest = JSON.parse(String(init?.body));
    const answers = body.questions.map(question => {
      const index = Number(/^h(\d+)_/.exec(question.name)?.[1]);
      const expected = fixture.sheets.find(sheet => sheet.name === sheets[index].name || sheet.name === '*');
      if (question.type === 'predicate') return { name: question.name, probability: expected?.include === false || !expected ? .01 : .99 };
      if (question.name.endsWith('_hdr')) return { name: question.name, choice: String(expected?.headerRow ?? 1), confidence: .99 };
      const column = Number(/_c(\d+)/.exec(question.name)?.[1]);
      const field = expected?.mapping[column] ?? 'ignore';
      return { name: question.name, confidence: .99, choice: field.startsWith('custom:') ? field.includes('condicion') ? 'condition' : 'grade' : field };
    });
    return Response.json({ answers });
  });
  const result = await analyzeImport({ section: 'inventory', sheets, currency: fixture.currency }, { fetchImpl });
  expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(1); expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(3);
  expect(result.source).toBe('model');
  // The wildcard mock explicitly includes the three rows in the extra sheet too.
  expect(result.rows).toHaveLength(fixture.sheets.reduce((sum, sheet) => sum + sheet.rows, 0) + (fixture.group === 'natan' && fixture.file === '01_hoja_extra' ? 3 : 0));
  for (const sheet of fixture.sheets.filter(sheet => sheet.include !== false)) {
    const plan = result.plan.find(plan => plan.name === sheet.name || sheet.name === '*')!;
    expect(plan.headerRow).toBe(sheet.headerRow);
    for (const [index, field] of Object.entries(sheet.mapping)) expect(plan.mapping.find(column => column.columnIndex === Number(index))?.field).toBe(field);
  }
  expect(applyImportPlan({ section: 'inventory', sheets, currency: fixture.currency, plan: result.plan }).rows).toEqual(result.rows);
  expect((result.diagnostics?.detectedRows ?? 0) - (result.diagnostics?.acceptedRows ?? 0)).toBe(result.diagnostics?.discardedRows);
});
it.each([1500, 5000])('validates every physical row in a large anonymized variant (%i)', async size => {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const sheets: ImportSheet[] = [{ name: 'Stock', rows: [['Modelo', 'Precio'], ...Array.from({ length: size }, (_, i) => ['iPhone QA', i === size - 1 ? 'ilegible' : '450'])] }];
  const fetchImpl = vi.fn(async () => Response.json({ answers: [ { name: 'h0_inc', probability: .99 }, { name: 'h0_c0', choice: 'model' }, { name: 'h0_c1', choice: 'price' } ] }));
  const result = await analyzeImport({ section: 'inventory', currency: 'USD', sheets }, { fetchImpl });
  expect(result.rows).toHaveLength(2); expect(result.rows[1].batteryNote).toContain('price (origen): ilegible');
  expect(result.rows.map(row => Number(row.quantity))).toEqual([size - 1, 1]);
  expect(result.diagnostics?.acceptedRows).toBe(size);
  expect(result.diagnostics?.discardedRows).toBe(0);
  expect(result.plan[0].mapping[1].review?.length).toBeGreaterThan(0);
});
