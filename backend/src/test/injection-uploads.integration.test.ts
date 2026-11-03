import ExcelJS from 'exceljs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const email = 'qa-sec-1@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', email); vi.stubEnv('OPENAI_API_KEY', ''); });
afterEach(() => vi.unstubAllEnvs());
const auth = () => buildAuthHeaders({ uid: 'qa-sec-1', email });

async function workbook(extra: Record<string, Uint8Array> = {}) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Stock');
  sheet.addRow(['Modelo', 'Precio']);
  sheet.addRow(['iPhone sintético', '100']);
  return zipSync({ ...unzipSync(new Uint8Array(await book.xlsx.writeBuffer())), ...extra });
}

async function postFile(extra: Record<string, Uint8Array> = {}) {
  const origin = await getApp().listen({ host: '127.0.0.1', port: 0 });
  const response = await fetch(`${origin}/admin/inventory-import`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify({
    storeEmail: email, expectStoreName: 'Test Store', expectStoreCurrency: 'ARS', dryRun: true,
    fileBase64: Buffer.from(await workbook(extra)).toString('base64'),
  }) });
  return { statusCode: response.status, body: await response.text() };
}

describe('injection and uploads security over real PostgreSQL', () => {
  it('rejects compressed expansion without writing any business data', async () => {
    await seedStoreContext({ firebaseUid: 'qa-sec-1', email });
    const response = await postFile({ 'unused.bin': new Uint8Array(32 * 1024 * 1024 + 1) });
    expect(response.statusCode).toBe(400);
    expect(await prisma.inventoryItem.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('rejects named ranges that would pollute Object.prototype', async () => {
    await seedStoreContext({ firebaseUid: 'qa-sec-1', email });
    const entries = unzipSync(await workbook());
    const xml = strFromU8(entries['xl/workbook.xml']).replace('</workbook>', `<definedNames><definedName name="QaRange">'__proto__'!$A$123456</definedName></definedNames></workbook>`);
    try {
      const response = await postFile({ 'xl/workbook.xml': strToU8(xml) });
      expect(Object.hasOwn(Object.prototype, '123456')).toBe(false);
      expect(response.statusCode).toBe(400);
      expect(await prisma.inventoryItem.count()).toBe(0);
    } finally { Reflect.deleteProperty(Object.prototype, '123456'); }
  });

  it('preserves a normal XLSX dry-run and rolls it back', async () => {
    await seedStoreContext({ firebaseUid: 'qa-sec-1', email });
    const response = await postFile();
    expect(response.statusCode, response.body).toBe(200);
    expect(JSON.parse(response.body).summary.imported).toBe(1);
    expect(await prisma.inventoryItem.count()).toBe(0);
  });

  it('binds SQL metacharacters in filters and ignores unlisted sort expressions', async () => {
    const { store } = await seedStoreContext({ firebaseUid: 'qa-sec-1', email });
    const other = await seedStoreContext({ firebaseUid: 'qa-sec-2', email: 'qa-sec-2@example.com' });
    const item = { model: 'QA iPhone', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 60, price: 100, status: 'DISPONIBLE' };
    await prisma.inventoryItem.create({ data: { ...item, storeId: store!.id } });
    await prisma.inventoryItem.create({ data: { ...item, storeId: other.store!.id } });
    const attack = "' OR 1=1; SELECT pg_sleep(10); --";
    const filtered = await getApp().inject({ url: `/api/inventory?take=20&search=${encodeURIComponent(attack)}&sortKey=${encodeURIComponent(attack)}`, headers: auth() });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toMatchObject({ items: [], total: 0 });
    const sorted = await getApp().inject({ url: `/api/inventory?take=20&sortKey=${encodeURIComponent(attack)}`, headers: auth() });
    expect(sorted.statusCode).toBe(200);
    expect(sorted.json().total).toBe(1);
    expect(await prisma.inventoryItem.count()).toBe(2);
    const operator = await getApp().inject({ method: 'POST', url: '/api/clients', headers: auth(), payload: { name: { contains: '' } } });
    expect(operator.statusCode).toBe(400);
    expect(await prisma.client.count()).toBe(0);
  });
});
