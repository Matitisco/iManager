import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import type { InventoryDuplicatesResponse } from './inventory-duplicates.service.js';

const { getApp } = useIntegrationApp();
const previousAdminEmails = process.env.ADMIN_EMAILS;
afterEach(() => {
  vi.restoreAllMocks();
  if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAdminEmails;
});

function request(query: string, headers: Record<string, string> = buildAuthHeaders({ uid: 'platform-admin', email: 'admin@internal.test' })) {
  process.env.ADMIN_EMAILS = 'admin@internal.test';
  return getApp().inject({ method: 'GET', url: `/admin/inventory-duplicates${query ? `?${query}` : ''}`, headers });
}
async function report(storeId: string) {
  const response = await request(`storeId=${storeId}`);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  return response.json() as InventoryDuplicatesResponse;
}
async function item(storeId: string, overrides: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}) {
  return prisma.inventoryItem.create({ data: {
    storeId, model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A',
    batteryHealth: '90%', cost: '123.45', price: '234.56', status: 'DISPONIBLE', cantidad: 1,
    entryDate: new Date('2026-10-01T12:00:00.000Z'),
    createdAt: new Date('2026-10-02T12:00:00.000Z'), updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    ...overrides,
  } });
}

// Compare every row of every business table, including users, audit and session metadata.
async function snapshot() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  const data: Record<string, string> = {};
  for (const { tablename } of tables) {
    const [result] = await prisma.$queryRaw<{ rows: string }[]>(Prisma.sql`
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)::text AS rows
      FROM ${Prisma.raw(`"${tablename.replace(/"/g, '""')}"`)} t`);
    data[tablename] = result!.rows;
  }
  return data;
}

describe('GET /admin/inventory-duplicates', () => {
  it('requires authentication, an allowlisted email and email verification', async () => {
    const { store } = await seedStoreContext();
    const query = `storeId=${store!.id}`;
    const missing = await request(query, {});
    expect(missing.statusCode).toBe(401);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect((await request(query, buildAuthHeaders())).statusCode).toBe(403);
    const unverified = { Authorization: `Bearer ${createTestAuthToken({ uid: 'admin', email: 'admin@internal.test', emailVerified: false })}` };
    expect((await request(query, unverified)).statusCode).toBe(403);
    expect((await report(store!.id)).readOnly).toBe(true);
    delete process.env.ADMIN_EMAILS;
    expect((await getApp().inject({ method: 'GET', url: `/admin/inventory-duplicates?${query}`, headers: buildAuthHeaders({ email: 'admin@internal.test' }) })).statusCode).toBe(403);
  });

  it.each([
    '', 'storeEmail=owner@example.com&storeId=id', 'storeId=id&extra=1', 'storeEmail=bad',
    'storeId=', 'storeId=a&storeId=b', 'storeEmail=owner@example.com&apply=true',
  ])('rejects invalid/unknown query parameters: %s', async query => {
    const response = await request(query);
    expect(response.statusCode).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('resolves exactly one active OWNER case-insensitively, or a store id, and checks its exact name', async () => {
    const { store, user, membership } = await seedStoreContext({ email: 'Mixed.Owner@shop.test' });
    const response = await request('storeEmail=MIXED.OWNER@SHOP.TEST&expectStoreName=Test%20Store');
    expect(response.statusCode).toBe(200);
    expect(response.json().store).toEqual({ id: store!.id, name: store!.name });
    expect((await request(`storeId=${store!.id}&expectStoreName=wrong`)).statusCode).toBe(409);
    expect((await request('storeId=missing')).statusCode).toBe(404);
    const absent = await request('storeEmail=absent@shop.test');
    expect(absent.statusCode).toBe(404);
    expect(absent.json().error).toContain('0');
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { removedAt: new Date() } });
    expect((await request('storeEmail=mixed.owner@shop.test')).statusCode).toBe(404);
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { removedAt: null, role: 'STAFF' } });
    expect((await request('storeEmail=mixed.owner@shop.test')).statusCode).toBe(404);
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { role: 'OWNER' } });
    const other = await prisma.store.create({ data: { name: 'Other' } });
    await prisma.storeMember.create({ data: { storeId: other.id, userId: user.id, role: 'OWNER' } });
    const ambiguous = await request('storeEmail=mixed.owner@shop.test');
    expect(ambiguous.statusCode).toBe(409);
    expect(ambiguous.json().error).toContain('2');
  });

  it('uses the exact SQL key, keeps the oldest/id-first row, preserves full rows and simulates conserved quantities', async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    await item(storeId, { id: 'later', cantidad: 7, createdAt: new Date('2026-10-03T00:00:00Z') });
    await item(storeId, { id: 'b', cantidad: 3 });
    await item(storeId, { id: 'a', cantidad: 2 });
    await item(storeId, { id: 'imei', imei: '123456789012345', cantidad: 1 });
    await item(storeId, { id: 'archived', archivedAt: new Date(), cantidad: 50 });
    await item(storeId, { id: 'sold', status: 'VENDIDO', cantidad: 5 });
    await item(storeId, { id: 'zero', cantidad: 0 });
    await item(storeId, { id: 'review-a', model: 'Review', status: 'EN_REVISION' });
    await item(storeId, { id: 'review-b', model: 'Review', status: 'EN_REVISION', imei: '  ' });
    const other = await prisma.store.create({ data: { name: 'Other' } });
    await item(other.id, { cantidad: 99 });
    const body = await report(storeId);
    expect(body.store).toEqual({ id: storeId, name: store!.name });
    expect(body.generatedAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    expect(body.key).toBe('storeId, categoryId, model, capacity, color, condition, grade, batteryHealth, batteryNote, cost, price, currency, status, supplierId, stockPurchaseId, entryDate(día), customFields, catalogVisible, sampleBatchId');
    expect(body.groups.map(g => g.keepId)).toEqual(['review-a', 'a']);
    const group = body.groups.find(g => g.keepId === 'a')!;
    expect(group).toMatchObject({ rowIds: ['a', 'b', 'later'], dropIds: ['b', 'later'], rowsBefore: 3, rowsAfter: 1, unitsBefore: 12, unitsAfter: 12, needsReview: false });
    const [expectedKey] = await prisma.$queryRaw<{ key: string }[]>`
      SELECT md5(jsonb_build_array(i."storeId", i."categoryId", i."model", i."capacity", i."color", i."condition", i."grade",
        i."batteryHealth", i."batteryNote", i."cost"::text, i."price"::text, i."currency", i."status", i."supplierId", i."stockPurchaseId",
        i."entryDate"::date::text, coalesce(i."customFields", 'null'::jsonb), i."catalogVisible", i."sampleBatchId")::text) AS key
      FROM "InventoryItem" i WHERE i."id" = 'a'`;
    expect(group.groupKey).toBe(expectedKey!.key);
    const [stored] = await prisma.$queryRaw<{ row: Record<string, unknown> }[]>`SELECT to_jsonb(i) AS row FROM "InventoryItem" i WHERE id = 'a'`;
    expect(Object.keys(group.rows[0]!).sort()).toEqual(Object.keys(stored!.row).sort());
    expect(group.rows[0]).toMatchObject({ id: 'a', quantity: 2, cost: '123.45', price: '234.56', entryDate: '2026-10-01T12:00:00.000Z', batteryNote: null, customFields: null, reservedAt: null, archivedAt: null, supplierId: null, stockPurchaseId: null, categoryId: null });
    expect(group.expectedVariation.map(d => d.field)).toEqual(['createdAt', 'id', 'quantity']);
    expect(group.fieldDifferences.some(d => d.field === 'id')).toBe(false);
    expect(body.totals).toMatchObject({ rowsBefore: 8, rowsAfter: 5, unitsBefore: 20, unitsAfter: 20, unitsMatch: true, candidates: 5, groups: 2, rowsWithImeiSkipped: 1, excludedTotal: 0, nearDuplicateGroups: 0 });
    const again = await report(storeId);
    expect({ ...again, generatedAt: null }).toEqual({ ...body, generatedAt: null });
  });

  it('reports all eight script exclusions, both stock-count sources, both pending flags, and only strict candidate peers', async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    await item(storeId, { id: 'keep' });
    await item(storeId, { id: 'drop' });
    const reasons: Record<string, string> = {
      sale: 'tiene ventas', trade: 'viene de un canje', returned: 'tiene devolución',
      reservedDeposit: 'reservado', reservedClient: 'reservado', deposit: 'tiene seña',
      expected: 'en un control de stock', scan: 'en un control de stock',
      pending: 'pendiente de completar', incomplete: 'pendiente de completar',
    };
    for (const id of Object.keys(reasons)) await item(storeId, { id });
    await prisma.sale.create({ data: { storeId, inventoryItemId: 'sale', dateLabel: '', amount: 1, paymentMethod: 'EFECTIVO', status: 'ANULADA', soldAt: new Date(), voidedAt: new Date() } });
    await prisma.tradeIn.create({ data: { storeId, receivedInventoryItemId: 'trade', dateLabel: '', deviceReceived: '', takeValue: 1, differencePaid: 0, status: 'ANULADO', tradeAt: new Date() } });
    await prisma.returnCase.create({ data: { storeId, inventoryItemId: 'returned', caseNumber: 1, reason: 'Test', openedAt: new Date(), deletedAt: new Date() } });
    await prisma.inventoryItem.update({ where: { id: 'reservedDeposit' }, data: { reservedDepositId: 'historical' } });
    await prisma.inventoryItem.update({ where: { id: 'reservedClient' }, data: { reservedClientId: 'historical' } });
    const client = await prisma.client.create({ data: { storeId, name: 'Client' } });
    await prisma.clientDeposit.create({ data: { storeId, clientId: client.id, productId: 'deposit', requestKey: 'test', amount: 1, currency: 'USD', exchangeRate: 1, usdAmount: 1, method: 'EFECTIVO', status: 'CANCELLED' } });
    const count = await prisma.stockCount.create({ data: { storeId, startedById: 'test', startedByName: 'Test' } });
    await prisma.stockCountExpected.create({ data: { storeId, stockCountId: count.id, inventoryItemId: 'expected', imei: '', model: '', capacity: '', color: '', statusAtSnapshot: 'DISPONIBLE' } });
    await prisma.stockCountScan.create({ data: { storeId, stockCountId: count.id, inventoryItemId: 'scan', scannedById: 'test', scannedByName: 'Test', imei: '', result: 'FOUND' } });
    await prisma.inventoryItem.update({ where: { id: 'pending' }, data: { pendingSaleRegistration: true } });
    await prisma.inventoryItem.update({ where: { id: 'incomplete' }, data: { needsCompletion: true } });
    const actions = ['inventory.updated', 'inventory.price', 'inventory.cost', 'inventory.status', 'inventory.archived', 'inventory.restored', 'inventory.moved'];
    for (const [index, action] of actions.entries()) {
      const id = `edited-${index}`;
      await item(storeId, { id });
      await prisma.auditEvent.create({ data: { storeId, actorName: 'Owner', entityType: 'inventory', entityId: id, action } });
      reasons[id] = 'editado a mano (historial)';
    }
    await item(storeId, { id: 'automatic' });
    await prisma.auditEvent.create({ data: { storeId, actorName: 'Agrupado automático', entityType: 'inventory', entityId: 'automatic', action: 'inventory.updated' } });
    await item(storeId, { id: 'irrelevant-audit' });
    await prisma.auditEvent.createMany({ data: [
      { storeId, actorName: 'Owner', entityType: 'InventoryItem', entityId: 'irrelevant-audit', action: 'inventory.updated' },
      { storeId, actorName: 'Owner', entityType: 'inventory', entityId: 'irrelevant-audit', action: 'inventory.created' },
    ] });
    await item(storeId, { id: 'excluded-singleton', model: 'Singleton', needsCompletion: true });
    await item(storeId, { id: 'only-eligible', model: 'One eligible' });
    await item(storeId, { id: 'only-excluded', model: 'One eligible', needsCompletion: true });
    const body = await report(storeId);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]!.rowIds).toEqual(['automatic', 'drop', 'irrelevant-audit', 'keep']);
    expect(body.groups[0]!.unitsBefore).toBe(4);
    expect(body.excluded).toHaveLength(18);
    for (const [id, reason] of Object.entries(reasons)) expect(body.excluded.find(e => e.id === id)).toMatchObject({ reasons: [reason], row: { id }, groupKey: body.groups[0]!.groupKey });
    expect(body.excluded.some(e => e.id === 'excluded-singleton')).toBe(false);
    expect(body.excluded.find(e => e.id === 'only-excluded')?.reasons).toEqual(['pendiente de completar']);
    expect(body.totals.excludedByReason).toEqual({
      'tiene ventas': 1, 'viene de un canje': 1, 'tiene devolución': 1, reservado: 2, 'tiene seña': 1,
      'en un control de stock': 2, 'pendiente de completar': 3, 'editado a mano (historial)': 7,
    });
    expect(body.totals).toMatchObject({ rowsBefore: 24, rowsAfter: 21, unitsBefore: 24, unitsAfter: 24, unitsMatch: true, excludedTotal: 18, candidates: 24 });
  });

  it('compares every non-id column and warns about lost non-key data and entryDate times', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a', cantidad: 2, price: null });
    await item(store!.id, { id: 'b', cantidad: 4, price: null, entryDate: new Date('2026-10-01T23:59:59.123Z'), priceChangedBy: 'Owner', priceChangedAt: new Date('2026-10-02T05:00:00Z'), costChangedBy: 'Other', costChangedAt: new Date('2026-10-02T06:00:00Z'), previousSaleStatus: 'EN_REVISION', reservedClientName: 'Historical', updatedAt: new Date('2026-10-03T00:00:00Z') });
    const { groups } = await report(store!.id);
    const group = groups[0]!;
    expect(group.needsReview).toBe(true);
    expect(group.unexpectedDifferences.map(d => d.field)).toEqual(['costChangedAt', 'costChangedBy', 'entryDate', 'previousSaleStatus', 'priceChangedAt', 'priceChangedBy', 'reservedClientName']);
    expect(group.expectedVariation.map(d => d.field)).toEqual(['id', 'quantity', 'updatedAt']);
    expect(group.fieldDifferences.find(d => d.field === 'priceChangedBy')).toEqual({ field: 'priceChangedBy', values: [{ value: null, rowIds: ['a'] }, { value: 'Owner', rowIds: ['b'] }] });
    expect(group.warnings.join(' ')).toContain('entryDate');
    expect(group.warnings.join(' ')).toContain('priceChangedBy');
    expect(group.rows[1]!.entryDate).toBe('2026-10-01T23:59:59.123Z');
    expect(group.rows[0]!.price).toBeNull();
  });

  it.each([
    { field: 'model', first: { model: 'iPhone  13 ' }, second: { model: 'iPhone 13' }, type: 'whitespace', exact: '"iPhone  13 "' },
    { field: 'color', first: { color: 'NEGRO' }, second: { color: 'negro' }, type: 'case', exact: '"NEGRO"' },
    { field: 'batteryNote', first: { batteryNote: null }, second: { batteryNote: '' }, type: 'null-vs-empty', exact: 'null' },
    { field: 'customFields["note"]', first: { customFields: { note: null } }, second: { customFields: { note: '' } }, type: 'null-vs-empty', exact: 'null' },
    { field: 'customFields["nested"]["0"]["text"]', first: { customFields: { nested: [{ text: '  Blue  SKY ' }] } }, second: { customFields: { nested: [{ text: 'blue sky' }] } }, type: 'other-normalized', exact: '"  Blue  SKY "' },
    { field: 'customFields', first: { customFields: Prisma.DbNull }, second: { customFields: {} }, type: 'other-normalized', exact: 'null' },
  ])('keeps normalized $field differences separate, visible and out of the simulated changes', async ({ field, first, second, type, exact }) => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a', ...first });
    await item(store!.id, { id: 'b', cantidad: 3, needsCompletion: true, ...second });
    const body = await report(store!.id);
    expect(body.groups).toEqual([]);
    expect(body.excluded).toEqual([]); // Different strict keys: same behavior as the script.
    expect(body.nearDuplicateGroups).toHaveLength(1);
    const near = body.nearDuplicateGroups[0]!;
    expect(near.warning).toBeTruthy();
    expect(near.rows.map(row => row.id)).toEqual(['a', 'b']);
    expect(near.rows[0]!.differences).toContainEqual({ field, value: exact, type });
    expect(near.rows[1]).toMatchObject({ excluded: true, reasons: ['pendiente de completar'] });
    expect(body.totals).toMatchObject({ rowsBefore: 2, rowsAfter: 2, unitsBefore: 4, unitsAfter: 4, unitsMatch: true, groups: 0, nearDuplicateGroups: 1, candidates: 2, excludedTotal: 0 });
  });

  it('does not normalize real custom-field differences or array order, but ignores object key order and SQL/JSON null', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a', customFields: { note: 'different', values: [1, 2] } });
    await item(store!.id, { id: 'b', customFields: { note: 'real', values: [1, 2] } });
    await item(store!.id, { id: 'c', customFields: { note: 'different', values: [2, 1] } });
    let body = await report(store!.id);
    expect(body.groups).toEqual([]);
    expect(body.nearDuplicateGroups).toEqual([]);
    await item(store!.id, { id: 'd', customFields: { values: [1, 2], note: 'different' } });
    await item(store!.id, { id: 'null-a', model: 'Null', customFields: Prisma.DbNull });
    await item(store!.id, { id: 'null-b', model: 'Null', customFields: Prisma.JsonNull });
    body = await report(store!.id);
    expect(body.groups.map(g => g.rowIds)).toEqual([['null-a', 'null-b'], ['a', 'd']]);
    expect(body.nearDuplicateGroups).toEqual([]);
  });

  it('keeps each strict key dimension separate when its actual value changes', async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    const category = await prisma.inventoryCategory.create({ data: { storeId, name: 'Category' } });
    const supplier = await prisma.supplier.create({ data: { storeId, name: 'Supplier' } });
    const purchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, purchasedAt: new Date() } });
    await item(storeId, { id: 'base' });
    const changes: Partial<Prisma.InventoryItemUncheckedCreateInput>[] = [
      { categoryId: category.id }, { model: 'Other' }, { capacity: '256GB' }, { color: 'Blue' },
      { condition: 'NUEVO' }, { grade: 'B' }, { batteryHealth: '80%' }, { batteryNote: 'Changed' },
      { cost: '123.46' }, { price: null }, { currency: 'USD' }, { status: 'EN_REVISION' },
      { supplierId: supplier.id }, { stockPurchaseId: purchase.id }, { entryDate: new Date('2026-10-02T00:00:00Z') },
      { customFields: { location: 'A' } }, { catalogVisible: true }, { sampleBatchId: 'sample' },
    ];
    for (const [index, change] of changes.entries()) await item(storeId, { id: `key-${index}`, ...change });
    const body = await report(storeId);
    expect(body.groups).toEqual([]);
    expect(body.nearDuplicateGroups).toEqual([]);
    expect(body.totals.rowsAfter).toBe(changes.length + 1);
  });

  it('reports multiple reasons once per excluded row, and never groups two excluded rows', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a', reservedClientId: 'historical', needsCompletion: true, pendingSaleRegistration: true });
    await item(store!.id, { id: 'b', reservedDepositId: 'historical', needsCompletion: true });
    const body = await report(store!.id);
    expect(body.groups).toEqual([]);
    expect(body.excluded.map(e => e.reasons)).toEqual([['reservado', 'pendiente de completar'], ['reservado', 'pendiente de completar']]);
    expect(body.totals).toMatchObject({ excludedTotal: 2, excludedByReason: { reservado: 2, 'pendiente de completar': 2 }, rowsBefore: 2, rowsAfter: 2, unitsMatch: true });
  });

  it('leaves every row in every table unchanged, including audits and session metadata', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a' });
    await item(store!.id, { id: 'b', cantidad: 4 });
    const before = await snapshot();
    expect((await report(store!.id)).groups).toHaveLength(1);
    expect(await snapshot()).toEqual(before);
  });

  it('enforces READ ONLY in the actual endpoint transaction: PostgreSQL rejects a write', async () => {
    const { store } = await seedStoreContext();
    await item(store!.id, { id: 'a' });
    await item(store!.id, { id: 'b' });
    const before = await snapshot();
    type Work = (tx: Prisma.TransactionClient) => Promise<unknown>;
    type Options = { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number };
    const transaction = prisma.$transaction.bind(prisma) as (work: Work, options?: Options) => Promise<unknown>;
    let probed = false;
    const spy = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: Work, options?: Options) => {
      expect(options?.isolationLevel).toBe('RepeatableRead');
      return transaction(async tx => {
        const proxy = new Proxy(tx, {
          get(target, property) {
            if (property !== '$executeRawUnsafe') return Reflect.get(target, property);
            return async (sql: string, ...values: unknown[]) => {
              const result = await target.$executeRawUnsafe(sql, ...values);
              expect(sql).toBe('SET TRANSACTION READ ONLY');
              const [setting] = await tx.$queryRaw<{ readOnly: string }[]>`SELECT current_setting('transaction_read_only') AS "readOnly"`;
              expect(setting!.readOnly).toBe('on');
              await tx.$executeRawUnsafe('SAVEPOINT read_only_probe');
              await expect(tx.$executeRaw`UPDATE "InventoryItem" SET "quantity" = 999 WHERE "id" = 'a'`)
                .rejects.toMatchObject({ code: 'P2010', meta: { code: '25006' } });
              await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT read_only_probe');
              probed = true;
              return result;
            };
          },
        });
        return work(proxy);
      }, options);
    }) as typeof prisma.$transaction);
    expect((await report(store!.id)).groups).toHaveLength(1);
    expect(probed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await snapshot()).toEqual(before);
  });
});
