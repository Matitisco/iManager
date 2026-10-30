import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import { item, snapshot } from './inventory-duplicates.test-helpers.js';
import type { InventoryDuplicatesApplyResponse, InventoryDuplicatesResponse } from './inventory-duplicates.service.js';

const { getApp } = useIntegrationApp();
const previousAdminEmails = process.env.ADMIN_EMAILS;
const headers = () => buildAuthHeaders({ uid: 'platform-admin', email: 'admin@internal.test' });
afterEach(() => {
  vi.restoreAllMocks();
  if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAdminEmails;
});

function post(endpoint: 'apply' | 'restore', payload: unknown, auth: Record<string, string> = headers()) {
  process.env.ADMIN_EMAILS = 'admin@internal.test';
  return getApp().inject({ method: 'POST', url: `/admin/inventory-duplicates/${endpoint}`, headers: auth, payload: payload as object });
}
async function preview(storeId: string) {
  process.env.ADMIN_EMAILS = 'admin@internal.test';
  const response = await getApp().inject({ method: 'GET', url: `/admin/inventory-duplicates?storeId=${storeId}`, headers: headers() });
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as InventoryDuplicatesResponse;
}
function expectations(plan: InventoryDuplicatesResponse) {
  return {
    storeEmail: 'owner@example.com', expectStoreName: plan.store.name,
    expectRowsBefore: plan.totals.rowsBefore, expectRowsAfter: plan.totals.rowsAfter,
    expectUnits: plan.totals.unitsBefore, groupKeys: plan.groups.map(group => group.groupKey),
  };
}
async function fixture() {
  const { store } = await seedStoreContext();
  await item(store!.id, { id: 'oldest', cantidad: 2, createdAt: new Date('2026-10-01T01:02:03.456Z'), customFields: { nested: ['ñ', { count: 2 }], number: 0 } });
  await item(store!.id, { id: 'later', cantidad: 3, customFields: { number: 0, nested: ['ñ', { count: 2 }] } });
  await item(store!.id, { id: 'z-last', cantidad: 4, customFields: { nested: ['ñ', { count: 2 }], number: 0 } });
  await item(store!.id, { id: 'review-a', model: 'Review', status: 'EN_REVISION', cantidad: 5, price: null });
  await item(store!.id, { id: 'review-b', model: 'Review', status: 'EN_REVISION', cantidad: 6, price: null });
  return { store: store!, plan: await preview(store!.id) };
}
async function unchanged(endpoint: 'apply' | 'restore', body: unknown, status = 409) {
  const before = await snapshot();
  const response = await post(endpoint, body);
  expect(response.statusCode, response.body).toBe(status);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(await snapshot()).toEqual(before);
  return response;
}
async function appliedFixture() {
  const { store, plan } = await fixture();
  const response = await post('apply', expectations(plan));
  expect(response.statusCode, response.body).toBe(200);
  const applied = response.json() as InventoryDuplicatesApplyResponse;
  return { store, plan, applied };
}

describe('POST /admin/inventory-duplicates/apply and restore', () => {
  it.each(['apply', 'restore'] as const)('%s requires a verified allowlisted admin without creating session context', async endpoint => {
    const before = await snapshot();
    const missing = await post(endpoint, {}, {});
    expect(missing.statusCode).toBe(401);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect((await post(endpoint, {}, buildAuthHeaders())).statusCode).toBe(403);
    const unverified = { Authorization: `Bearer ${createTestAuthToken({ uid: 'admin', email: 'admin@internal.test', emailVerified: false })}` };
    expect((await post(endpoint, {}, unverified)).statusCode).toBe(403);
    delete process.env.ADMIN_EMAILS;
    expect((await getApp().inject({ method: 'POST', url: `/admin/inventory-duplicates/${endpoint}`, headers: headers(), payload: {} })).statusCode).toBe(403);
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    'storeEmail', 'expectStoreName', 'expectRowsBefore', 'expectRowsAfter', 'expectUnits', 'groupKeys',
    'extra', 'emptyKeys', 'duplicateKeys', 'invalidEmail', 'fraction', 'numericString',
  ])('rejects invalid apply body: %s without writes', async invalid => {
    const { plan } = await fixture();
    const body: Record<string, unknown> = expectations(plan);
    if (invalid in body) delete body[invalid];
    else if (invalid === 'extra') body.extra = true;
    else if (invalid === 'emptyKeys') body.groupKeys = [];
    else if (invalid === 'duplicateKeys') body.groupKeys = [plan.groups[0]!.groupKey, plan.groups[0]!.groupKey];
    else if (invalid === 'invalidEmail') body.storeEmail = 'bad';
    else if (invalid === 'fraction') body.expectRowsBefore = 1.5;
    else body.expectUnits = '20';
    await unchanged('apply', body, 400);
  });

  it.each([
    ['expectStoreName', 'Otra tienda', 'nombre'], ['expectRowsBefore', 999, 'rowsBefore'],
    ['expectRowsAfter', 999, 'rowsAfter'], ['expectUnits', 999, 'unitsBefore'],
    ['extraKey', null, 'groupKeys'], ['missingKey', null, 'groupKeys'], ['differentKeys', null, 'groupKeys'],
  ])('rejects mismatched %s with a full unchanged database snapshot', async (field, value, message) => {
    const { plan } = await fixture();
    const body = expectations(plan);
    if (field === 'extraKey') body.groupKeys.push('extra');
    else if (field === 'missingKey') body.groupKeys.pop();
    else if (field === 'differentKeys') body.groupKeys[0] = 'different';
    else Object.assign(body, { [field]: value });
    const response = await unchanged('apply', body);
    expect(response.json().error).toContain(message);
    if (field !== 'expectStoreName') expect(response.json().error).toMatch(/esperado .*actual /);
  });

  it('uses the exact GET groupKeys as an unordered set, keeps oldest rows, backs up every physical column and restores exactly', async () => {
    const { store } = await fixture();
    const other = await prisma.store.create({ data: { name: 'Other' } });
    await item(other.id, { id: 'other-a', cantidad: 99 });
    await item(other.id, { id: 'other-b', cantidad: 98 });
    await item(store.id, { id: 'imei', imei: '123456789012345' });
    await item(store.id, { id: 'archived-a', archivedAt: new Date(), cantidad: 50 });
    await item(store.id, { id: 'archived-b', archivedAt: new Date(), cantidad: 60 });
    // Excluded peers share their own strict key, never a group being applied.
    await item(store.id, { id: 'sale-a', model: 'Sold group' });
    await item(store.id, { id: 'sale-b', model: 'Sold group', cantidad: 2 });
    await prisma.sale.create({ data: { storeId: store.id, inventoryItemId: 'sale-a', dateLabel: '', amount: 1, paymentMethod: 'EFECTIVO', status: 'ANULADA', soldAt: new Date(), voidedAt: new Date() } });
    await item(store.id, { id: 'reserved-a', model: 'Reserved group', reservedClientId: 'historical' });
    await item(store.id, { id: 'reserved-b', model: 'Reserved group', reservedClientId: 'historical' });
    await prisma.$executeRaw`UPDATE "InventoryItem" SET "createdAt" = '2026-10-01 01:02:03.456789'::timestamp WHERE "id" = 'oldest'`;
    await prisma.auditEvent.create({ data: { id: 'unrelated', storeId: store.id, actorName: 'Owner', action: 'inventory.created', entityType: 'inventory', entityId: 'imei' } });
    const plan = await preview(store.id);
    expect(plan.groups).toHaveLength(2);
    expect(plan.excluded.map(row => row.id)).toEqual(['reserved-a', 'reserved-b', 'sale-a']);
    const before = await snapshot();
    const body = expectations(plan);
    body.storeEmail = 'OWNER@EXAMPLE.COM';
    body.groupKeys.reverse();
    const response = await post('apply', body);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const applied = response.json() as InventoryDuplicatesApplyResponse;
    expect(applied).toMatchObject({ store: { id: store.id, name: store.name }, applied: true, rowsBefore: plan.totals.rowsBefore, rowsAfter: plan.totals.rowsAfter, unitsBefore: plan.totals.unitsBefore, unitsAfter: plan.totals.unitsBefore });
    expect(applied.store).toEqual({ id: store.id, name: store.name });
    expect(applied.groups).toEqual(plan.groups.map(({ groupKey, keepId, dropIds, rowsBefore, unitsBefore, summary }) => ({ groupKey, keepId, dropIds, rowsBefore, unitsBefore, summary })));
    expect(applied.groups.map(group => group.keepId)).toContain('oldest');
    const affected = new Set(plan.groups.flatMap(group => group.rowIds));
    const original = JSON.parse(before.InventoryItem!) as Record<string, unknown>[];
    const backup = applied.backup;
    expect(backup.meta).toMatchObject({ storeId: store.id, storeName: store.name, tables: ['InventoryItem'], groupKeys: [...body.groupKeys].sort() });
    expect(new Date(backup.meta.createdAt).toISOString()).toBe(backup.meta.createdAt);
    expect([...backup.items].sort((a, b) => a.id.localeCompare(b.id))).toEqual(original.filter(row => affected.has(row.id as string)).sort((a, b) => (a.id as string).localeCompare(b.id as string)));
    expect(backup.items).toHaveLength(5);
    expect(backup.items.every(row => 'quantity' in row && !('cantidad' in row))).toBe(true);
    const after = await snapshot();
    const current = JSON.parse(after.InventoryItem!) as Record<string, unknown>[];
    expect(current.filter(row => !affected.has(row.id as string))).toEqual(original.filter(row => !affected.has(row.id as string)));
    expect(current.length).toBe(original.length - 3);
    expect(current.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(original.reduce((sum, row) => sum + Number(row.quantity), 0));
    for (const group of plan.groups) {
      const previous = original.find(row => row.id === group.keepId)!;
      const kept = current.find(row => row.id === group.keepId)!;
      expect({ ...kept, updatedAt: previous.updatedAt }).toEqual({ ...previous, quantity: group.unitsBefore });
      expect(kept.updatedAt).not.toBe(previous.updatedAt);
      for (const id of group.dropIds) expect(current.some(row => row.id === id)).toBe(false);
    }
    const audits = await prisma.auditEvent.findMany({ where: { id: { in: backup.auditEventIds } } });
    expect(audits).toHaveLength(2);
    for (const [index, group] of plan.groups.entries()) {
      expect(backup.auditEventIds[index]).toMatch(/^agr_[a-f0-9]+$/);
      expect(audits.find(audit => audit.id === backup.auditEventIds[index])).toMatchObject({
        storeId: store.id, actorName: 'Agrupado automático', action: 'inventory.updated', entityType: 'inventory', source: 'bulk', entityId: group.keepId,
        detail: `Se juntaron ${group.rowsBefore} filas idénticas sin IMEI en una sola con cantidad ${group.unitsBefore}`,
        changes: [{ field: 'cantidad', label: 'Cantidad', before: String(group.rows[0]!.quantity), after: String(group.unitsBefore) }],
      });
    }
    const { InventoryItem: _beforeItems, AuditEvent: _beforeAudits, ...beforeOther } = before;
    const { InventoryItem: _afterItems, AuditEvent: _afterAudits, ...afterOther } = after;
    expect(afterOther).toEqual(beforeOther);
    await unchanged('apply', body);
    const restored = await post('restore', { expectStoreName: store.name, backup });
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.headers['cache-control']).toBe('no-store');
    expect(restored.json()).toEqual({ store: applied.store, restored: true, itemsRestored: 5, auditEventsDeleted: 2 });
    expect(await snapshot()).toEqual(before);
    const repeated = await post('restore', { expectStoreName: store.name, backup });
    expect(repeated.statusCode, repeated.body).toBe(200);
    expect(repeated.json()).toEqual({ store: applied.store, restored: true, itemsRestored: 5, auditEventsDeleted: 0 });
    expect(await snapshot()).toEqual(before);
  });

  it.each(['needsReview', 'nearDuplicateGroups', 'excluded'] as const)('refuses unsafe plans with %s before any write', async risk => {
    const { store } = await fixture();
    if (risk === 'needsReview') await prisma.inventoryItem.update({ where: { id: 'later' }, data: { reservedClientName: 'Lost data' } });
    else if (risk === 'nearDuplicateGroups') await item(store.id, { id: 'near', model: 'review', status: 'EN_REVISION', price: null });
    else await item(store.id, { id: 'excluded', model: 'Review', status: 'EN_REVISION', price: null, needsCompletion: true });
    const plan = await preview(store.id);
    const response = await unchanged('apply', expectations(plan));
    expect(response.json().error).toContain(risk === 'excluded' ? 'excluidas' : risk);
  });

  it('rejects an empty plan even when all numerical expectations match', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'single' });
    const plan = await preview(store!.id);
    const response = await unchanged('apply', { ...expectations(plan), groupKeys: ['stale'] });
    expect(response.json().error).toContain('Nada para juntar');
  });

  it.each(['wrongName', 'mixedStore', 'foreignId', 'missingStore', 'missingColumn'] as const)('refuses restore %s without writes', async mismatch => {
    const { store, applied } = await appliedFixture();
    const body = { expectStoreName: store.name, backup: applied.backup };
    if (mismatch === 'wrongName') body.expectStoreName = 'Wrong';
    else if (mismatch === 'mixedStore') body.backup.items[0]!.storeId = 'other';
    else if (mismatch === 'missingStore') body.backup.meta.storeId = 'missing';
    else if (mismatch === 'missingColumn') delete body.backup.items[0]!.color;
    else {
      const other = await prisma.store.create({ data: { name: 'Other' } });
      await item(other.id, { id: 'foreign' });
      body.backup.items[0]!.id = 'foreign';
    }
    await unchanged('restore', body);
  });

  it.each(['missingName', 'missingBackup', 'extra', 'wrongTable', 'missingStoreId', 'emptyItems', 'invalidItem', 'duplicateId', 'invalidAuditIds', 'invalidGroups'] as const)('rejects invalid restore body: %s', async invalid => {
    const { store, applied } = await appliedFixture();
    const body: Record<string, unknown> = { expectStoreName: store.name, backup: applied.backup };
    const backup = applied.backup;
    if (invalid === 'missingName') delete body.expectStoreName;
    else if (invalid === 'missingBackup') delete body.backup;
    else if (invalid === 'extra') body.extra = true;
    else if (invalid === 'wrongTable') body.backup = { ...backup, meta: { ...backup.meta, tables: ['User'] } };
    else if (invalid === 'missingStoreId') body.backup = { ...backup, meta: { storeName: store.name, tables: ['InventoryItem'] } };
    else if (invalid === 'emptyItems') backup.items = [];
    else if (invalid === 'invalidItem') body.backup = { ...backup, items: [{ id: 'x' }] };
    else if (invalid === 'duplicateId') backup.items.push(backup.items[0]!);
    else if (invalid === 'invalidAuditIds') body.backup = { ...backup, auditEventIds: [42] };
    else body.backup = { ...backup, meta: { ...backup.meta, groupKeys: [42] } };
    await unchanged('restore', body, 400);
  });

  it('restore deletes only automatic audit IDs belonging to the backup store', async () => {
    const { store, applied } = await appliedFixture();
    const other = await prisma.store.create({ data: { name: 'Other' } });
    const common = { action: 'inventory.updated', entityType: 'inventory', entityId: 'oldest' };
    await prisma.auditEvent.createMany({ data: [
      { ...common, id: 'manual', storeId: store.id, actorName: 'Owner' },
      { ...common, id: 'foreign-audit', storeId: other.id, actorName: 'Agrupado automático' },
      { ...common, id: 'unlisted', storeId: store.id, actorName: 'Agrupado automático' },
    ] });
    applied.backup.auditEventIds.push('manual', 'foreign-audit');
    const response = await post('restore', { expectStoreName: store.name, backup: applied.backup });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().auditEventsDeleted).toBe(2);
    expect((await prisma.auditEvent.findMany()).map(audit => audit.id).sort()).toEqual(['foreign-audit', 'manual', 'unlisted']);
  });

  it('rolls back partial restore writes and keeps invalid backup values out of errors and logs', async () => {
    const { store, applied } = await appliedFixture();
    const privateValue = 'contenido-privado-del-backup';
    applied.backup.items[1]!.entryDate = privateValue;
    const log = vi.spyOn(getApp().log, 'info');
    const response = await unchanged('restore', { expectStoreName: store.name, backup: applied.backup }, 500);
    expect(response.body).not.toContain(privateValue);
    expect(log).toHaveBeenCalled();
    for (const call of log.mock.calls) {
      const entry = call[0] as { err?: Error };
      expect(entry.err?.message ?? '').not.toContain(privateValue);
      expect(entry.err?.cause).toBeUndefined();
    }
  });

  it('accepts complete backups larger than the default one-megabyte request limit', async () => {
    const { store } = await seedStoreContext();
    const customFields = { text: 'x'.repeat(550_000) };
    await item(store!.id, { id: 'large-a', customFields });
    await item(store!.id, { id: 'large-b', customFields });
    const before = await snapshot();
    const plan = await preview(store!.id);
    const response = await post('apply', expectations(plan));
    expect(response.statusCode).toBe(200);
    const { backup } = response.json() as InventoryDuplicatesApplyResponse;
    expect(Buffer.byteLength(JSON.stringify(backup))).toBeGreaterThan(1024 * 1024);
    const restored = await post('restore', { expectStoreName: store!.name, backup });
    expect(restored.statusCode).toBe(200);
    expect(await snapshot()).toEqual(before);
  });

  it('resolves only exactly one active OWNER store in the apply transaction', async () => {
    const { plan } = await fixture();
    const body = expectations(plan);
    await unchanged('apply', { ...body, storeEmail: 'absent@example.com' }, 404);
    const owner = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: 'test-owner' } });
    const member = await prisma.storeMember.findFirstOrThrow({ where: { userId: owner.id } });
    await prisma.storeMember.update({ where: { id: member.id }, data: { removedAt: new Date() } });
    await unchanged('apply', body, 404);
    await prisma.storeMember.update({ where: { id: member.id }, data: { removedAt: null, role: 'STAFF' } });
    await unchanged('apply', body, 404);
    await prisma.storeMember.update({ where: { id: member.id }, data: { role: 'OWNER' } });
    const other = await prisma.store.create({ data: { name: 'Other' } });
    await prisma.storeMember.create({ data: { userId: owner.id, storeId: other.id, role: 'OWNER' } });
    await unchanged('apply', body);
  });

  it.each(['deleteCount', 'postWriteUnits'] as const)('rolls back actual writes when verification fails: %s', async failure => {
    const { plan } = await fixture();
    type Work = (tx: Prisma.TransactionClient) => Promise<unknown>;
    type Options = { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number };
    const transaction = prisma.$transaction.bind(prisma) as (work: Work, options?: Options) => Promise<unknown>;
    let probed = false;
    vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: Work, options?: Options) => {
      expect(options?.isolationLevel).toBe('Serializable');
      expect(options?.timeout).toBeGreaterThanOrEqual(60_000);
      return transaction(async tx => work(new Proxy(tx, {
        get(target, property) {
          if (property !== '$executeRaw') return Reflect.get(target, property);
          return async (sql: Prisma.Sql) => {
            const result = await target.$executeRaw(sql);
            if (sql.sql.includes('DELETE FROM "InventoryItem"')) {
              probed = true;
              if (failure === 'deleteCount') return result - 1;
              await tx.$executeRaw`UPDATE "InventoryItem" SET "quantity" = "quantity" + 1 WHERE "id" = 'oldest'`;
            }
            return result;
          };
        },
      })), options);
    }) as typeof prisma.$transaction);
    await unchanged('apply', expectations(plan));
    expect(probed).toBe(true);
  });
});
