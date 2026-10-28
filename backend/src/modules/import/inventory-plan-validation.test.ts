import { afterEach, expect, it, vi } from 'vitest';
import { analyzeImport, applyImportPlan } from './analyze-import.service.js';
import { buildDecisionContext, postDecisions, type DecisionRequest } from './decisions-plan.js';
import { heuristicPlan, type SheetPlan } from './sheet-plan.js';
import { repairInventoryQuality, validateInventoryPlan } from './inventory-plan-validation.js';
import { DECISIONS_URL } from './responses-client.js';
const input = { section: 'inventory' as const, currency: 'USD' as const, sheets: [{ name: 'Stock', rows: [
  ['Modelo', 'Otro', 'P. Venta', 'Almac.', 'Obs', 'Ubicación', '% ganancia', 'Calidad'],
  ['iPhone 13', 'Negro', '450', '128 GB', 'nota', 'Local', '25%', 'A'],
] }] };
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
function response(body: DecisionRequest, fields: Record<number, string>, include = true) {
  return Response.json({ answers: body.questions.map(q => ({ name: q.name, type: q.type,
    ...(q.type === 'predicate' ? { probability: include ? .99 : .01 }
      : { choice: q.name.endsWith('_hdr') ? '1' : fields[Number(/_c(\d+)/.exec(q.name)?.[1])] ?? 'ignore', confidence: .99 }),
  })), usage: { input_tokens: 100, output_tokens: 0 } });
}
it('asks the model for every column, including exact headers; content hints never bypass it', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const context = buildDecisionContext(input.sheets, 'inventory', 'USD')!;
  expect(context.fixed).toEqual([]);
  expect(context.request.questions.filter(q => /_c\d+$/.test(q.name))).toHaveLength(8);
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe(DECISIONS_URL);
    return response(JSON.parse(String(init?.body)), { 0: 'model', 1: 'color', 2: 'price', 3: 'capacity', 7: 'grade' });
  });
  const result = await analyzeImport(input, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledOnce(); expect(result.source).toBe('model');
  expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', price: '450', capacity: '128 GB' });
});
it('sends concrete all-row errors and previous plan to Decisions; succeeds on correction', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const requests: DecisionRequest[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)); requests.push(body);
    return response(body, requests.length === 1 ? { 0: 'model', 1: 'price', 2: 'price', 3: 'capacity' } : { 0: 'model', 1: 'color', 2: 'price', 3: 'capacity', 7: 'grade' });
  });
  const result = await analyzeImport(input, { fetchImpl });
  expect(requests).toHaveLength(2);
  expect(requests[1].input).toContain('Plan anterior'); expect(requests[1].input).toContain('duplicado');
  expect(requests[1].input).toContain('valores inválidos'); expect(requests[1].input).toContain('<85%');
  expect(result.rows).toHaveLength(1); expect(result.plan[0].mapping.some(c => c.review?.length)).toBe(false);
});
it('uses the best model plan after two retries and exposes doubts without overriding it with hints', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test'); let round = 0;
  const ambiguous = structuredClone(input); ambiguous.sheets[0].rows[1][1] = 'x'.repeat(51);
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    round++;
    return response(JSON.parse(String(init?.body)), round === 2 ? { 0: 'model', 2: 'price', 3: 'capacity', 1: 'color' } : { 2: 'price', 3: 'capacity' });
  });
  const result = await analyzeImport(ambiguous, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(3); expect(result.source).toBe('model');
  expect(result.plan[0].mapping[1].field).toBe('color');
  expect(result.notice).toContain('por revisar');
  expect(result.plan[0].mapping[1].review?.length).toBeGreaterThan(0);
});
it('checks rows beyond the prompt sample, per-sheet acceptance, fields and content omissions', () => {
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Precio', 'IMEI'], ...Array.from({ length: 100 }, (_, i) => ['iPhone 13', i > 80 ? 'ilegible' : '450', ''])] }];
  const plan = heuristicPlan(sheets, 'inventory', 'USD');
  const checked = validateInventoryPlan(sheets, plan, 'USD');
  expect(checked.issues.map(i => i.message).join(' ')).toContain('19/100');
  expect(checked.issues.map(i => i.message).join(' ')).toContain('81/100 <85%');
  expect(checked.applied.diagnostics.rejected).toHaveLength(19);
});
it.each([['A', 'grade'], ['AA+', 'custom:condicion_origen']])('repairs any invalid condition column (%s) before preview validation', async (quality, field) => {
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Calidad'], ['iPhone 13', quality]] }];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => response(JSON.parse(String(init?.body)), { 0: 'model', 1: 'condition' }));
  const result = await analyzeImport({ ...input, sheets }, { fetchImpl });
  expect(result.rows).toHaveLength(1); expect(result.plan[0].mapping[1].field).toBe(field);
  expect(result.rows[0][field]).toBe(quality);
  expect(applyImportPlan({ ...input, sheets, plan: result.plan }).rows).toEqual(result.rows);
  if (field.startsWith('custom:')) expect(result.suggestedDefinitions?.[0].key).toBe('condicion_origen');
});
it('preserves a minority invalid quality value too, and leaves manual type decisions authoritative', () => {
  const sheets = [{ name: 'Stock', rows: [['Modelo', 'Calidad'], ...['A','A','A','XX'].map(q => ['iPhone 13', q])] }];
  const raw = heuristicPlan(sheets, 'inventory', 'USD');
  const repaired = repairInventoryQuality(sheets, raw);
  expect(repaired.plan[0].mapping[1].field).toBe('custom:calidad_origen');
  expect(applyImportPlan({ ...input, sheets, plan: raw }).diagnostics?.discardedRows).toBe(1);
});
it('bounds the entire analysis below 20 seconds when fetch ignores cancellation', async () => {
  vi.useFakeTimers(); vi.stubEnv('OPENAI_API_KEY', 'test');
  const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
  const started = Date.now(); const pending = analyzeImport(input, { fetchImpl });
  await vi.advanceTimersByTimeAsync(18_000);
  const result = await pending;
  expect(Date.now() - started).toBeLessThan(20_000); expect(fetchImpl).toHaveBeenCalledOnce();
  expect(result.source).toBe('heuristic'); expect(result.notice).toBeTruthy(); expect(result.rows).toHaveLength(1);
});
it('times out response-body consumption as well as headers', async () => {
  vi.useFakeTimers();
  const fetchImpl = vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) }) as unknown as Response);
  const pending = postDecisions({ apiKey: 'test', request: buildDecisionContext(input.sheets, 'inventory', 'USD')!.request, fetchImpl, timeoutMs: 100 });
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toMatchObject({ ok: false });
});
it('fallback remains visible on quota; never calls Responses', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const fetchImpl = vi.fn(async () => Response.json({}, { status: 402 }));
  const result = await analyzeImport(input, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledOnce(); expect(result.source).toBe('heuristic'); expect(result.notice).toContain('saldo');
});

it('does not mistake profit percentages for batteries or allow prohibited business mappings after retries', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test');
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => response(JSON.parse(String(init?.body)), { 0: 'model', 2: 'price', 3: 'capacity', 4: 'supplierName', 5: 'cost', 6: 'batteryHealth', 7: 'grade' }));
  const result = await analyzeImport(input, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  for (const index of [4, 5, 6]) {
    expect(result.plan[0].mapping[index].field).toBe('');
    expect(result.plan[0].mapping[index].review?.length).toBeGreaterThan(0);
  }
  expect(result.rows).toHaveLength(1);
});
it('shares one deadline across all three attempts', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'test'); vi.useFakeTimers();
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    await new Promise(resolve => setTimeout(resolve, 5500));
    return response(JSON.parse(String(init?.body)), { 0: 'model' });
  });
  const started = Date.now(); const pending = analyzeImport(input, { fetchImpl });
  await vi.advanceTimersByTimeAsync(18_000);
  expect((await pending).notice).toContain('por revisar');
  expect(fetchImpl).toHaveBeenCalledTimes(3); expect(Date.now() - started).toBeLessThan(20_000);
});
