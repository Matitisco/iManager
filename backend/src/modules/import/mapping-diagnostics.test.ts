import { afterEach, describe, expect, it, vi } from 'vitest';
import { scriptDecisionAnswers } from '../../../test/script-decisions.js';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { DECISIONS_URL, RESPONSES_URL } from './responses-client.js';
import { heuristicPlan } from './sheet-plan.js';

const sheets = [{ name: 'Stock', rows: [['Modelo', 'Costo', 'Color'], ['iPhone 13', '420', 'Negro'], ['iPhone 12', '310', 'Blanco']] }];
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
afterEach(() => vi.unstubAllEnvs());

describe('analysis missing mapping fields', () => {
  it('returns stable missing fields for heuristic and manual analysis, recalculating after remapping', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const heuristic = await analyzeImport({ sheets, section: 'inventory', currency: 'USD' });
    expect(heuristic).toMatchObject({ source: 'heuristic', missingRequiredFields: ['price'], missingRecommendedFields: ['imei'], diagnostics: { discardedByReason: { missing_price: 2 } } });
    const manual = applyImportPlan({ sheets, section: 'inventory', currency: 'USD', plan: heuristic.plan });
    expect(manual).toMatchObject({ source: 'manual', missingRequiredFields: ['price'], missingRecommendedFields: ['imei'] });
    const complete = [{ name: 'Stock', rows: [['Modelo', 'Costo', 'Color', 'Venta', 'IMEI'], ['iPhone 13', '420', 'Negro', '500', '']] }];
    const remapped = applyImportPlan({ sheets: complete, section: 'inventory', currency: 'USD', plan: heuristic.plan, refreshMapping: true });
    expect(remapped).toMatchObject({ missingRequiredFields: [], missingRecommendedFields: [], diagnostics: { acceptedRows: 1, discardedRows: 0 } });
  });

  it('reports absent price with a mocked Decisions client and no Responses retry', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe(DECISIONS_URL);
      const body = JSON.parse(String(init?.body));
      expect(body.input).toContain('NUNCA');
      expect(body.questions[0].instructions).toContain('aunque falte precio');
      return response({ answers: scriptDecisionAnswers(body) });
    });
    const result = await analyzeImport({ sheets, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ source: 'model', rows: [], missingRequiredFields: ['price'], missingRecommendedFields: ['imei'], diagnostics: { detectedRows: 2, discardedByReason: { missing_price: 2 } } });
  });

  it.each(['Precio de compra', 'Cost price', 'Purchase price'])('rejects a Decisions price assignment to %s', async (header) => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const input = [{ name: 'Stock', rows: [['Modelo', header, 'Color'], ['iPhone 13', '420', 'Negro']] }];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const answers = scriptDecisionAnswers(body).map(answer => answer.name === 'h0_c1' ? { ...answer, choice: 'price' } : answer);
      return response({ answers });
    });
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(result).toMatchObject({ source: 'model', missingRequiredFields: ['price'], diagnostics: { discardedByReason: { missing_price: 1 } } });
    expect(result.plan[0].mapping.some(column => column.field === 'price')).toBe(false);
  });

  it.each(['Costo', 'Precio de compra', 'Cost price', 'Purchase price'])('rejects a Responses price assignment to %s and recalculates missing fields', async (header) => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const input = [{ name: 'Stock', rows: [['Modelo', header, 'Color'], ['iPhone 13', '420', 'Negro']] }];
    const plan = heuristicPlan(input, 'inventory', 'USD')[0];
    plan.mapping = [{ header: 'Modelo', field: 'model' }, { header, field: 'price' }, { header: 'Color', field: 'color' }];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (url === DECISIONS_URL) return new Response('{}', { status: 500 });
      expect(url).toBe(RESPONSES_URL);
      const body = JSON.parse(String(init?.body));
      expect(body.input[0].content).toContain('NUNCA');
      expect(body.input[0].content).toContain('PVP');
      return response({ output_text: JSON.stringify({ sheets: [{ ...plan, missingRequiredFields: [] }] }) });
    });
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(result).toMatchObject({ source: 'model', missingRequiredFields: ['price'], missingRecommendedFields: ['imei'], diagnostics: { discardedByReason: { missing_price: 1 } } });
  });

  it.each(['Venta', 'PVP', 'Precio USD', '$'])('accepts a mocked model price assignment from %s', async (header) => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const input = [{ name: 'Stock', rows: [['Modelo', 'Costo', header], ['iPhone 13', '420', '500']] }];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe(DECISIONS_URL);
      const body = JSON.parse(String(init?.body));
      const answers = scriptDecisionAnswers(body).map(answer => answer.name === 'h0_c2' ? { ...answer, choice: 'price' } : answer);
      return response({ answers });
    });
    const result = await analyzeImport({ sheets: input, section: 'inventory', currency: 'USD' }, { fetchImpl });
    expect(result).toMatchObject({ source: 'model', missingRequiredFields: [], missingRecommendedFields: ['imei'], diagnostics: { acceptedRows: 1, discardedRows: 0 } });
    expect(result.rows[0]).toMatchObject({ price: '500', cost: '420' });
  });
});
