import { SAMSUNG_MODELS } from '../../lib/samsung-models.js';
import { INVENTORY_MODELS } from '../../lib/inventory-models.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeTextImport, amountInSource, chunkText, normalizeTextModel, normalizeTextRow, UNRELATED_TEXT_NOTICE } from './text-import.service.js';
import { TEXT_LIMITS, textOutputSchema, textRowSchema, type TextRow } from './text-import.schema.js';
import { createTextImportLimiter, textImportQuota } from './text-import-rate-limit.js';

const row: TextRow = { line: 1, endLine: 1, model: 'iPhone 13', capacity: '128GB', color: 'Midnight', batteryHealth: '89%', condition: null, imei: null, serial: null, price: 420, currency: 'USD', cost: null, quantity: 1, dudas: [] };
const text = 'iPhone 13 128GB Midnight 89% US$ 420';
const response = (output: unknown) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: typeof output === 'string' ? output : JSON.stringify(output) }] }], usage: { input_tokens: 10, output_tokens: 20 } }));
const env = { ...process.env };
it.each([101, 1001])('acepta %i unidades en una fila de texto', async quantity => {
  process.env.OPENAI_API_KEY = 'mock';
  const result = await analyzeTextImport({ text: `${text} x${quantity}`, currency: 'USD' }, {
    fetchImpl: vi.fn(async () => response({ rows: [{ ...row, quantity }], discarded: [] })),
  });
  expect(result.rows[0].quantity).toBe(String(quantity));
  expect(textRowSchema.safeParse({ ...row, quantity }).success).toBe(true);
});
afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); vi.useRealTimers(); });

it('uses server-only key, strict schema, selected model, and only pasted data', async () => {
  process.env.OPENAI_API_KEY = 'backend-secret';
  delete process.env.OPENAI_IMPORT_MODEL;
  const fetchImpl = vi.fn(async () => response({ rows: [row], discarded: [] }));
  const result = await analyzeTextImport({ text, currency: 'ARS', models: ['PRIVATE MODEL'] }, { fetchImpl });
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(init.body));
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(body).toMatchObject({ model: 'gpt-6-luna', store: false, text: { format: { strict: true, type: 'json_schema' } } });
  expect(String(init.body)).not.toContain('PRIVATE MODEL');
  expect(JSON.stringify(result)).not.toContain('backend-secret');
  expect(result.rows[0]).toMatchObject({ model: 'iPhone 13', price: '420', currency: 'USD' });
  expect(result.review[0].dudas).toContain('Sin condición: elegí la condición antes de importar.');
  expect(result.usage).toMatchObject({ calls: 1, inputTokens: 10, outputTokens: 20 });
});

it.each(['{broken', JSON.stringify({ rows: [{ ...row, price: '420' }], discarded: [] }), JSON.stringify({ rows: [row], discarded: [], injected: true }), JSON.stringify({ rows: [{ ...row, line: 2 }], discarded: [] })])('retries invalid output once (%s)', async (bad) => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn().mockResolvedValueOnce(response(bad)).mockResolvedValueOnce(response({ rows: [row], discarded: [] }));
  expect((await analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).usage.calls).toBe(2);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('rejects two invalid responses without fallback', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn(async () => response('{broken'));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).rejects.toThrow('dos intentos');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('respects override and missing configuration', async () => {
  process.env.OPENAI_API_KEY = 'mock'; process.env.OPENAI_IMPORT_MODEL = 'custom-model';
  const fetchImpl = vi.fn(async () => response({ rows: [], discarded: [{ line: 1, reason: 'Charla' }] }));
  const result = await analyzeTextImport({ text: 'Hola cómo va?', currency: 'ARS' }, { fetchImpl });
  expect(result.usage.model).toBe('custom-model'); expect(result.notice).toBe(UNRELATED_TEXT_NOTICE);
  expect(result.discarded).toEqual([{ line: 1, original: 'Hola cómo va?', reason: 'Charla' }]);
  delete process.env.OPENAI_API_KEY;
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).rejects.toThrow('OPENAI_API_KEY');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it.each([429, 500, 401])('returns Spanish errors for provider HTTP %s without repeated billing', async (status) => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn(async () => new Response('{}', { status }));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).rejects.toThrow(status === 429 ? 'ocupado o sin saldo' : status === 401 ? 'clave' : 'No se pudo analizar');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('times out a stalled request and aborts in-flight work', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => { const controller = new AbortController(); setTimeout(() => controller.abort(), 5); return controller.signal; });
  const fetchImpl: typeof fetch = vi.fn(async (_, init) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abort')))));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).rejects.toThrow('tardó demasiado');
});

it('rejects already aborted analysis before calling the provider', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn();
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl, signal: AbortSignal.abort() })).rejects.toThrow('tardó demasiado');
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('chunks all 500 lines, limits concurrency and keeps global provenance/order', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  let active = 0, peak = 0;
  const fetchImpl: typeof fetch = vi.fn(async (_, init) => {
    active++; peak = Math.max(peak, active);
    const chunk = JSON.parse(JSON.parse(String(init?.body)).input[1].content) as { lines: { line: number; text: string }[] };
    await new Promise((resolve) => setTimeout(resolve, 2)); active--;
    return response({ rows: chunk.lines.map(({ line }) => ({ ...row, line, endLine: line })), discarded: [] });
  });
  const result = await analyzeTextImport({ text: Array(500).fill(text).join('\r\n'), currency: 'ARS' }, { fetchImpl });
  expect(result.rows).toHaveLength(1); expect(result.rows[0]).toMatchObject({ quantity: '500', _groupedLines: '500' });
  expect(result.review[0].original.split('\n')).toHaveLength(500);
  expect(result.usage.calls).toBe(Math.ceil(500 / TEXT_LIMITS.chunkLines));
  expect(peak).toBeLessThanOrEqual(TEXT_LIMITS.concurrency);
});

it('bounds input before any model call and handles UTF-8/BOM', () => {
  expect(() => chunkText('')).toThrow('Pegá');
  expect(() => chunkText('a'.repeat(100001))).toThrow('100 KB');
  expect(() => chunkText(Array(1001).fill('a').join('\n'))).toThrow('1000 líneas');
  expect(() => chunkText('a'.repeat(4001))).toThrow('demasiado larga');
  expect(() => chunkText('binary\x00')).toThrow('UTF-8');
  expect(() => chunkText('hola�')).toThrow('UTF-8');
  expect(chunkText('\uFEFFiPhone 13\r\nUSD 420')[0].lines[0].text).toBe('iPhone 13');
});

it('carries only supplied headers across chunks and bounds chunk characters', () => {
  const chunks = chunkText(['USADOS EN USD', ...Array(80).fill(text)].join('\n'));
  expect(chunks[1].context).toEqual(['USADOS EN USD']);
  expect(chunks.flatMap((chunk) => chunk.lines)).toHaveLength(81);
  expect(chunkText(Array(10).fill('x'.repeat(2000)).join('\n')).every((chunk) => chunk.lines.reduce((sum, line) => sum + line.text.length, 0) <= TEXT_LIMITS.chunkChars)).toBe(true);
});

it('normalizes aliases against shared and store-specific catalog, flags unknown models', () => {
  expect(normalizeTextModel('13pm')).toEqual({ model: 'iPhone 13 Pro Max', matched: true });
  expect(normalizeTextModel('14p').model).toBe('iPhone 14 Pro');
  expect(normalizeTextModel('Samsung Galaxy S23', ['Samsung Galaxy S23']).matched).toBe(true);
  expect(normalizeTextRow({ ...row, model: 'Unknown' }, text).dudas.join(' ')).toContain('catálogo');
});

it('removes unsupported IMEI/prices/cost/series; keeps zeroes, ranges and Argentine numbers', () => {
  const normalized = normalizeTextRow({ ...row, imei: '123456789012345', price: 999, cost: 888, serial: 'FAKE' }, text);
  expect(normalized.row).toMatchObject({ imei: null, price: null, cost: null, serial: null });
  expect(normalized.dudas.length).toBeGreaterThanOrEqual(4);
  expect(amountInSource(1200000, '$1.200.000')).toBe(true);
  expect(amountInSource(420.5, 'USD420,50')).toBe(true);
  expect(amountInSource(520000, '520k pesos')).toBe(true);
  expect(amountInSource(420, '1420')).toBe(false);
  const actual = normalizeTextRow({ ...row, imei: '001234567890123' }, 'iPhone 13 001-234-567-890-123 US$420');
  expect(actual.row.imei).toBe('001234567890123');
});

it('limits expanded quantities server-side', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn(async () => response({ rows: Array(21).fill({ ...row, quantity: 100 }), discarded: [] }));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).rejects.toThrow('2000 equipos');
});

it('enforces per-store rolling quota and one active analysis, and releases failed requests', () => {
  let now = 0;
  const acquire = createTextImportLimiter(() => now, 10);
  const release = acquire('a');
  expect(() => acquire('a')).toThrow('Ya hay');
  acquire('b')(); release();
  for (let i = 0; i < 9; i++) acquire('a')();
  expect(() => acquire('a')).toThrow('10 análisis');
  now = 600000;
  expect(() => acquire('a')()).not.toThrow();
});

const fixtureDir = fileURLToPath(new URL('../../../test/fixtures/import-text/', import.meta.url));
const fixtures = readdirSync(fixtureDir).filter((name) => name.endsWith('.txt'));
describe('57 realistic parser fixtures with a mocked LLM', () => {
  it('has >=50 independently labeled listings and a mixed 20+ line fixture', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(50);
    const mixed = fixtures.find((name) => name.includes('mixto'))!;
    expect(readFileSync(fixtureDir + mixed, 'utf8').trim().split('\n').length).toBeGreaterThanOrEqual(20);
  });
  it.each(fixtures)('%s validates/normalizes expected structured output', async (name) => {
    process.env.OPENAI_API_KEY = 'mock';
    const text = readFileSync(fixtureDir + name, 'utf8');
    const rows = textOutputSchema.shape.rows.parse(JSON.parse(readFileSync(fixtureDir + name.replace('.txt', '.expected.json'), 'utf8')).rows);
    const fetchImpl = vi.fn(async () => response({ rows, discarded: [] }));
    const result = await analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl });
    expect(result.rows.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(rows.reduce((sum, row) => sum + row.quantity, 0));
    // Every original line remains represented after grouping, with its own
    // model/identifier/money. Review metadata stays aligned with the result.
    for (const row of rows) {
      textRowSchema.parse(row);
      const index = result.rows.findIndex((item, index) => item.model === row.model && item.imei === (row.imei ?? '') && item.price === (row.price === null ? '' : String(row.price)) && (result.review[index].line === row.line || result.review[index].original.split('\n').includes(text.trim().split('\n')[row.line - 1])));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(result.rows[index]).toMatchObject({ model: row.model, imei: row.imei ?? '', price: row.price === null ? '' : String(row.price), currency: row.currency ?? '' });
    }
    if (!rows.length) expect(result.notice).toBe(UNRELATED_TEXT_NOTICE);
  });
});

it('keeps multi-line descriptions across block boundaries without dropping lines', () => {
  const lines = [...Array(39).fill(text), 'iPhone 13 Pro 256GB usado', 'bat 89%', 'USD 520', ...Array(2).fill(text)];
  const chunks = chunkText(lines.join('\n'));
  expect(chunks[0].lines).toHaveLength(39);
  expect(chunks[1].lines.slice(0, 3).map((line) => line.line)).toEqual([40, 41, 42]);
  expect(chunks.flatMap((chunk) => chunk.lines).map((line) => line.text)).toEqual(lines);
});

it('retries malformed HTTP JSON once, but reports refusal without retry', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('{broken')).mockResolvedValueOnce(response({ rows: [row], discarded: [] }));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl })).resolves.toMatchObject({ rows: [{ price: '420' }] });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  const refused = vi.fn(async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'refusal' }] }] })));
  await expect(analyzeTextImport({ text, currency: 'ARS' }, { fetchImpl: refused })).rejects.toThrow('No se pudo interpretar');
  expect(refused).toHaveBeenCalledTimes(1);
});

it('enforces overall timeout across successful slow blocks', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  vi.useFakeTimers();
  const fetchImpl: typeof fetch = vi.fn(async (_, init) => {
    const chunk = JSON.parse(JSON.parse(String(init?.body)).input[1].content) as { lines: { line: number }[] };
    await new Promise<void>((resolve) => setTimeout(resolve, 25_000));
    return response({ rows: chunk.lines.map(({ line }) => ({ ...row, line, endLine: line })), discarded: [] });
  });
  const task = analyzeTextImport({ text: Array(1000).fill(text).join('\n'), currency: 'ARS' }, { fetchImpl });
  const check = expect(task).rejects.toThrow('tardó demasiado');
  await vi.advanceTimersByTimeAsync(TEXT_LIMITS.totalMs + TEXT_LIMITS.callMs);
  await check;
});

it('accepts every generated Samsung suggestion without confusing Plus and base models', () => {
  expect(SAMSUNG_MODELS).toHaveLength(188);
  for (const model of SAMSUNG_MODELS) {
    expect(INVENTORY_MODELS).toContain(model);
    expect(normalizeTextModel(model.toLowerCase())).toEqual({ model, matched: true });
  }
  expect(normalizeTextModel('Samsung Galaxy S24+')).toEqual({ model: 'Samsung Galaxy S24+', matched: true });
  expect(normalizeTextModel('Samsung Galaxy Note10+')).toEqual({ model: 'Samsung Galaxy Note10+', matched: true });
  const family = (model: string) => /^Samsung Galaxy (Note|[SZAMF])/.exec(model)?.[1];
  const families = [...new Set(SAMSUNG_MODELS.map(family))];
  expect(families).toEqual(['S', 'Z', 'A', 'Note', 'M', 'F']);
  const firstSamsung = INVENTORY_MODELS.indexOf(SAMSUNG_MODELS[0]);
  expect(INVENTORY_MODELS.slice(0, firstSamsung).every(model => model.startsWith('iPhone'))).toBe(true);
});


it('agrupa texto x2 + x3 con review alineada y conserva variantes e IMEI', async () => {
  process.env.OPENAI_API_KEY = 'mock';
  const lines = [text + ' x2', text + ' x3', text + ' rojo', text + ' IMEI 990000000000038'];
  const result = await analyzeTextImport({ text: lines.join('\n'), currency: 'USD' }, {
    fetchImpl: vi.fn(async () => response({ rows: [
      { ...row, quantity: 2 }, { ...row, quantity: 3, line: 2, endLine: 2 },
      { ...row, color: 'Rojo', line: 3, endLine: 3 }, { ...row, imei: '990000000000038', line: 4, endLine: 4 },
    ], discarded: [] })),
  });
  expect(result.rows).toHaveLength(3);
  expect(result.rows[0]).toMatchObject({ quantity: '5', _groupedLines: '2' });
  expect(result.rows[1]).toMatchObject({ quantity: '1', color: 'Rojo' });
  expect(result.rows[2]).toMatchObject({ quantity: '1', imei: '990000000000038' });
  expect(result.review.map(review => review.line)).toEqual([1, 3, 4]);
  expect(result.review[0].original).toBe(lines.slice(0, 2).join('\n'));
});

it('has no quota in the Railway test environment and 10 elsewhere', () => {
  expect(textImportQuota('test')).toBe(Infinity);
  expect(textImportQuota('production')).toBe(10);
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  expect(textImportQuota(undefined)).toBe(10);
});

it('allows more than 10 analyses in Railway test while still blocking concurrent analyses', () => {
  process.env.RAILWAY_ENVIRONMENT_NAME = 'test';
  const acquire = createTextImportLimiter(() => 0);
  for (let i = 0; i < 11; i++) acquire('a')();
  const release = acquire('a');
  expect(() => acquire('a')).toThrow('Ya hay un listado analizándose');
  release();
  expect(() => acquire('a')()).not.toThrow();
});
