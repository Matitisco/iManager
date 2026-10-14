import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import type { TextRow } from '../modules/import/text-import.schema.js';

const { getApp } = useIntegrationApp();
const env = { ...process.env };
afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });
function headers(context: Awaited<ReturnType<typeof seedStoreContext>>) { return buildAuthHeaders({ uid: context.user.firebaseUid, email: context.user.email ?? undefined }); }
function mockLLM(rows: TextRow[]) {
  process.env.OPENAI_API_KEY = 'test-only';
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ rows, discarded: [] }) }] }], usage: { input_tokens: 12, output_tokens: 24 } })));
}
const row: TextRow = { line: 1, endLine: 1, model: 'iPhone 13', capacity: '128GB', color: 'azul', condition: 'USADO', batteryHealth: '89%', imei: null, serial: null, price: 420, currency: 'USD', cost: 350, quantity: 1, dudas: [] };

describe('inventory text import API with mocked LLM and real PostgreSQL', () => {
  it('analyzes without writes, then preserves mixed currencies/series on explicit confirmation', async () => {
    const context = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.com' });
    const app = getApp();
    mockLLM([row, { ...row, line: 2, endLine: 2, price: 550000, currency: 'ARS', cost: null, serial: 'ABCD1234' }]);
    const text = 'iPhone 13 128GB azul usado 89% costo USD350 venta USD420\niPhone 13 128GB azul usado 89% serie ABCD1234 ARS550000';
    const analyze = await app.inject({ method: 'POST', url: '/api/import/analyze-text', headers: headers(context), payload: { text } });
    expect(analyze.statusCode).toBe(200);
    expect(await prisma.inventoryItem.count()).toBe(0);
    const analysis = analyze.json();
    const rows = analysis.rows.map((item: Record<string, string>) => ({ ...item, price: Number(item.price), cost: item.cost ? Number(item.cost) : undefined, customFields: item.serial ? { serial: item.serial } : {} }));
    const imported = await app.inject({ method: 'POST', url: '/api/inventory/import', headers: headers(context), payload: { rows } });
    expect(imported.json()).toMatchObject({ imported: 2, updated: 0, errors: [] });
    const stored = await prisma.inventoryItem.findMany({ where: { storeId: context.store!.id }, orderBy: { price: 'asc' } });
    expect(stored.map((item) => item.currency)).toEqual(['USD', 'ARS']);
    expect(stored[1].customFields).toEqual({ serial: 'ABCD1234' });
    expect(await prisma.inventoryItem.count({ where: { storeId: other.store!.id } })).toBe(0);
  });

  it('enforces auth, membership and section permissions before calling model', async () => {
    const app = getApp();
    const fetch = mockLLM([row]);
    expect((await app.inject({ method: 'POST', url: '/api/import/analyze-text', payload: { text: 'iPhone 13 USD420' } })).statusCode).toBe(401);
    const noStore = await seedStoreContext({ createStore: false });
    expect((await app.inject({ method: 'POST', url: '/api/import/analyze-text', headers: headers(noStore), payload: { text: 'iPhone 13 USD420' } })).statusCode).toBe(403);
    const staff = await seedStoreContext({ firebaseUid: 'staff', email: 'staff@test.com', role: 'STAFF' });
    await prisma.storeMember.update({ where: { id: staff.membership!.id }, data: { sections: ['sales'] } });
    expect((await app.inject({ method: 'POST', url: '/api/import/analyze-text', headers: headers(staff), payload: { text: 'iPhone 13 USD420' } })).statusCode).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns visible provider/schema/size errors, limits store calls, and never creates stock', async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fetch = mockLLM([row]);
    const request = (text: string) => app.inject({ method: 'POST', url: '/api/import/analyze-text', headers: headers(context), payload: { text } });
    expect((await request('a'.repeat(100001))).statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValue(new Response(JSON.stringify({ output_text: '{broken' })));
    expect((await request('iPhone 13 USD420')).statusCode).toBe(422);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockResolvedValue(new Response('{}', { status: 500 }));
    for (let i = 0; i < 4; i++) expect((await request('iPhone 13 USD420')).statusCode).toBe(502);
    const limited = await request('iPhone 13 USD420');
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toContain('5 análisis');
    expect(await prisma.inventoryItem.count()).toBe(0);
  });

  it('normalizes against only current-store models without sending catalog to provider', async () => {
    const context = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.com' });
    for (const [storeId, model] of [[context.store!.id, 'Custom Local'], [other.store!.id, 'Private Other']]) {
      await prisma.inventoryItem.create({ data: { storeId, model, imei: null, capacity: '', color: '', batteryHealth: '', price: 0, cost: 0, condition: 'USADO', grade: '', status: 'DISPONIBLE' } });
    }
    const fetch = mockLLM([{ ...row, model: 'custom local', cost: null }, { ...row, model: 'Private Other', line: 2, endLine: 2, cost: null }]);
    const response = await getApp().inject({ method: 'POST', url: '/api/import/analyze-text', headers: headers(context), payload: { text: 'custom local usado USD420\nPrivate Other usado USD420' } });
    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.rows[0].model).toBe('Custom Local');
    expect(result.review[0].dudas.join(' ')).not.toContain('catálogo');
    expect(result.review[1].dudas.join(' ')).toContain('catálogo');
    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.input).toHaveLength(2);
    expect(JSON.parse(body.input[1].content)).toEqual({ context: [], lines: [{ line: 1, text: 'custom local usado USD420' }, { line: 2, text: 'Private Other usado USD420' }] });
  });

  it('treats currency-only changes as sensitive and preserves same-amount explicit corrections', async () => {
    const context = await seedStoreContext();
    const app = getApp();
    const payload = { rows: [{ imei: '350000000000100', model: 'iPhone 13', price: 420, currency: 'USD' }] };
    expect((await app.inject({ method: 'POST', url: '/api/inventory/import', headers: headers(context), payload })).json().imported).toBe(1);
    payload.rows[0].currency = 'ARS';
    expect((await app.inject({ method: 'POST', url: '/api/inventory/import', headers: headers(context), payload })).json().updated).toBe(1);
    expect((await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: context.store!.id } })).currency).toBe('ARS');
  });
});

it('prevents staff from changing shared currency through a cost update', async () => {
  const context = await seedStoreContext();
  const staff = await seedStoreContext({ firebaseUid: 'staff-currency', email: 'staff-currency@test.com', role: 'STAFF' });
  await prisma.storeMember.update({ where: { id: staff.membership!.id }, data: { storeId: context.store!.id, sections: ['inventory'], sensitiveAccess: false } });
  const app = getApp();
  const payload = { rows: [{ imei: '350000000000100', model: 'iPhone 13', price: 420, currency: 'USD' }] };
  expect((await app.inject({ method: 'POST', url: '/api/inventory/import', headers: headers(context), payload })).json().imported).toBe(1);
  const response = await app.inject({ method: 'POST', url: '/api/inventory/import', headers: headers(staff), payload: { rows: [{ ...payload.rows[0], currency: 'ARS', cost: 200 }] } });
  expect(response.json()).toMatchObject({ imported: 0, updated: 0, errors: [{ message: 'No tenés permiso para cambiar la moneda de este equipo' }] });
  const item = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId: context.store!.id } });
  expect(item.currency).toBe('USD');
  expect(Number(item.cost)).toBe(0);
});
