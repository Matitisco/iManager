import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import { item, snapshot } from './inventory-duplicates.test-helpers.js';

const { getApp } = useIntegrationApp();
const adminEmail = 'qa-sec-1@example.com';
const adminHeaders = () => buildAuthHeaders({ uid: 'qa-sec-admin', email: adminEmail });
beforeEach(() => vi.stubEnv('ADMIN_EMAILS', adminEmail));
afterEach(() => vi.unstubAllEnvs());

describe('admin security boundaries', () => {
  it('serves only a minimal public health check and rejects HTTP attacks on a loopback listener', async () => {
    const base = await getApp().listen({ host: '127.0.0.1', port: 0 });
    expect(Number(new URL(base).port)).toBeGreaterThan(20000);
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
    expect(health.headers.get('cache-control')).toBe('no-store');
    for (const path of ['/debug', '/metrics', '/docs', '/swagger', '/internal', '/admin/impersonate']) {
      expect((await fetch(`${base}${path}`)).status).toBe(404);
    }
    const response = await fetch(`${base}/admin/store-reset`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid-json',
    });
    expect(response.status).toBe(401);
  });

  it.each([
    '/admin/inventory-import', '/admin/inventory-duplicates/apply',
    '/admin/inventory-duplicates/restore', '/admin/store-reset', '/admin/sale-corrections',
  ])('rejects unauthorized %s before JSON parsing', async url => {
    const unverified = { Authorization: `Bearer ${createTestAuthToken({ uid: 'qa-sec-admin', email: adminEmail, emailVerified: false })}` };
    for (const [headers, status] of [
      [{}, 401],
      [buildAuthHeaders({ uid: 'qa-sec-owner', email: 'qa-sec-2@example.com' }), 403],
      [unverified, 403],
    ] as const) {
      const result = await getApp().inject({ method: 'POST', url,
        headers: { ...headers, 'content-type': 'application/json' }, payload: '{invalid-json' });
      expect(result.statusCode).toBe(status);
      expect(result.headers['cache-control']).toBe('no-store');
    }
    vi.stubEnv('ADMIN_EMAILS', '');
    const closed = await getApp().inject({ method: 'POST', url,
      headers: { ...adminHeaders(), 'content-type': 'application/json' }, payload: '{invalid-json' });
    expect(closed.statusCode).toBe(403);
  });

  it.each(['OWNER', 'STAFF'] as const)('does not grant platform administration to a store %s', async role => {
    const { store } = await seedStoreContext({ role, email: 'qa-sec-2@example.com', firebaseUid: 'qa-sec-member' });
    const headers = buildAuthHeaders({ uid: 'qa-sec-member', email: 'qa-sec-2@example.com' });
    const before = await snapshot();
    for (const url of ['/admin/store-activity', '/admin/funnel', '/admin/imei-tac-misses',
      `/admin/stores/${store!.id}/history`, `/admin/stores/${store!.id}/timeline`,
      `/admin/inventory-duplicates?storeId=${store!.id}`, '/api/me/admin']) {
      const result = await getApp().inject({ method: 'GET', url, headers });
      expect(result.statusCode).toBe(403);
    }
    expect(await snapshot()).toEqual(before);
  });

  it.each(['categoryId', 'supplierId', 'stockPurchaseId'] as const)('rejects a backup with foreign %s atomically', async field => {
    const { store } = await seedStoreContext({ email: 'qa-sec-2@example.com', firebaseUid: 'qa-sec-owner' });
    const other = await seedStoreContext({ email: 'qa-sec-3@example.com', firebaseUid: 'qa-sec-other' });
    const foreign = await relations(other.store!.id);
    const backup = await backupFor(store!.id);
    // Modify a later row to detect accidental partial restoration of the first.
    backup.items[1]![field] = foreign[field];
    await prisma.inventoryItem.update({ where: { id: 'qa-sec-a' }, data: { cantidad: 10 } });
    const before = await snapshot();
    const result = await getApp().inject({ method: 'POST', url: '/admin/inventory-duplicates/restore',
      headers: adminHeaders(), payload: { expectStoreName: store!.name, backup } });
    expect(result.statusCode).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['categoryId', 'supplierId', 'stockPurchaseId'] as const)('rejects missing or malformed %s before writing', async field => {
    const { store } = await seedStoreContext({ email: 'qa-sec-2@example.com', firebaseUid: 'qa-sec-owner' });
    const backup = await backupFor(store!.id);
    await prisma.inventoryItem.update({ where: { id: 'qa-sec-a' }, data: { cantidad: 10 } });
    const before = await snapshot();
    for (const value of ['missing-reference', 42, { id: 'invalid' }]) {
      backup.items[1]![field] = value;
      const result = await getApp().inject({ method: 'POST', url: '/admin/inventory-duplicates/restore',
        headers: adminHeaders(), payload: { expectStoreName: store!.name, backup } });
      expect(result.statusCode).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
  });

  it('restores exact physical rows with valid same-store relations, including archived catalogs', async () => {
    const { store } = await seedStoreContext({ email: 'qa-sec-2@example.com', firebaseUid: 'qa-sec-owner' });
    const own = await relations(store!.id);
    const backup = await backupFor(store!.id, own);
    await prisma.supplier.update({ where: { id: own.supplierId }, data: { deletedAt: new Date() } });
    await prisma.stockPurchase.update({ where: { id: own.stockPurchaseId }, data: { deletedAt: new Date() } });
    await prisma.inventoryItem.updateMany({ where: { storeId: store!.id }, data: { cantidad: 10 } });
    const result = await getApp().inject({ method: 'POST', url: '/admin/inventory-duplicates/restore',
      headers: adminHeaders(), payload: { expectStoreName: store!.name, backup } });
    expect(result.statusCode, result.body).toBe(200);
    const rows = await prisma.$queryRaw<{ row: Record<string, unknown> }[]>`
      SELECT to_jsonb(i) AS row FROM "InventoryItem" i WHERE "storeId" = ${store!.id} ORDER BY "id"`;
    expect(rows.map(r => r.row)).toEqual(backup.items);
  });
});

async function relations(storeId: string) {
  const category = await prisma.inventoryCategory.create({ data: { storeId, name: 'QA categoría' } });
  const supplier = await prisma.supplier.create({ data: { storeId, name: 'QA proveedor' } });
  const purchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, purchasedAt: new Date() } });
  return { categoryId: category.id, supplierId: supplier.id, stockPurchaseId: purchase.id };
}

async function backupFor(storeId: string, refs = {}) {
  await item(storeId, { id: 'qa-sec-a', ...refs });
  await item(storeId, { id: 'qa-sec-b', ...refs });
  const rows = await prisma.$queryRaw<{ row: Record<string, unknown> }[]>`
    SELECT to_jsonb(i) AS row FROM "InventoryItem" i WHERE "storeId" = ${storeId} ORDER BY "id"`;
  return {
    meta: { storeId, storeName: 'Test Store', createdAt: new Date().toISOString(), tables: ['InventoryItem'], groupKeys: [] },
    auditEventIds: [], items: rows.map(r => r.row),
  };
}
