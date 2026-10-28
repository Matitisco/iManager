import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { natanCases } from '../../../test/fixtures/import/natan/cases.js';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import type { ImportSheet } from './sheet-plan.js';

afterEach(() => vi.unstubAllEnvs());
export function grids(file: string): ImportSheet[] {
  return JSON.parse(readFileSync(new URL(`../../../test/fixtures/import/natan/${file}.grid.json`, import.meta.url), 'utf8'));
}
it.each(natanCases)('$file: heurística y respaldo sin red preservan filas y columnas físicas', async fixture => {
  const input = { section: 'inventory' as const, currency: 'ARS' as const, sheets: grids(fixture.file) };
  vi.stubEnv('OPENAI_API_KEY', '');
  const baseline = await analyzeImport(input);
  expect(baseline.plan[0].headerRow).toBe(fixture.header);
  expect(Object.fromEntries(baseline.plan[0].mapping.filter(column => column.field).map(column => [column.columnIndex, column.field]))).toEqual(fixture.mapping);
  expect(baseline.rows).toHaveLength(fixture.accepted);
  expect(baseline.diagnostics).toMatchObject({ detectedRows: fixture.detected, acceptedRows: fixture.accepted, discardedByReason: fixture.reasons });
  expect(baseline.diagnostics?.rejected?.every(row => /IMEI|Modelo|modelo|Costo|Fecha|Total/.test(row.message)) ?? true).toBe(true);
  expect(applyImportPlan({ ...input, plan: baseline.plan }).rows).toEqual(baseline.rows);
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const failing = vi.fn().mockRejectedValue(new Error('sin red'));
  const fallback = await analyzeImport(input, { fetchImpl: failing });
  expect(fallback.plan.map(p => ({ ...p, mapping: p.mapping.map(({ review, ...column }) => column) }))).toEqual(baseline.plan);
  expect(fallback.rows).toEqual(baseline.rows);
});
it('00: errores del modelo usan respaldo estable con aviso y nunca evitan consultar', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const input = { section: 'inventory' as const, currency: 'ARS' as const, sheets: grids('00_natan_anon') };
  let calls = 0;
  const fetchImpl = vi.fn(async () => Response.json({ sheets: [{ mapping: [{ columnIndex: calls++ % 16, field: 'model' }] }] }));
  const baseline = await analyzeImport(input, { fetchImpl });
  for (let run = 0; run < 10; run++) expect(await analyzeImport(input, { fetchImpl })).toEqual(baseline);
  expect(fetchImpl).toHaveBeenCalledTimes(11);
  expect(baseline.source).toBe('heuristic'); expect(baseline.notice).toBeTruthy();
  expect(baseline.warnings).toContain('La columna de costo no indica moneda: se importará en ARS. Podés cambiarla en la pantalla antes de importar.');
  expect(baseline.rows.every(row => row.currency === 'ARS')).toBe(true);
});
