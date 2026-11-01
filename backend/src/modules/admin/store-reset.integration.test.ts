import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { allocateDocumentNumber } from '../../lib/store-sequence.js';
import { STORE_RESET_DELETE_MODELS, STORE_RESET_KEEP_MODELS } from './store-reset.service.js';

const { getApp } = useIntegrationApp();
const adminEmail = 'admin@internal.test';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', adminEmail);
  vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', 'test');
  vi.stubEnv('STORE_RESET_ALLOWED_STORE_IDS', '');
});
afterEach(() => vi.unstubAllEnvs());

const table = (model: { name: string; dbName: string | null }) => Prisma.raw(`"${model.dbName ?? model.name}"`);
// Snapshot every model independently of the reset classifications. Includes full
// rows, not only counts, so SetNull, balances and user/config edits are visible.
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    result[model.name] = await prisma.$queryRaw(Prisma.sql`
      SELECT to_jsonb(t) AS row FROM ${table(model)} t ORDER BY to_jsonb(t)::text`);
  }
  return result;
}

async function fixture(suffix = 'one') {
  const context = await seedStoreContext({ firebaseUid: `owner-${suffix}`, email: `owner-${suffix}@example.com` });
  const { store, user, membership } = context;
  const storeId = store!.id;
  vi.stubEnv('STORE_RESET_ALLOWED_STORE_IDS', `${process.env.STORE_RESET_ALLOWED_STORE_IDS ?? ''}, ${storeId} , does-not-exist`);
  const now = new Date('2026-10-01T12:00:00Z');
  const catalog = await seedCatalogFixture(storeId);
  const clientId = catalog.client.id;
  const itemId = catalog.inventoryItem.id;
  const staff = await prisma.user.create({ data: { firebaseUid: `staff-${suffix}`, email: `staff-${suffix}@example.com` } });
  await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: 'STAFF', sections: { sales: true } } });
  await prisma.storeInvitation.create({ data: { storeId, email: `invited-${suffix}@example.com`, role: 'STAFF', expiresAt: now } });
  await prisma.storeFollowUpSettings.create({ data: { storeId, inactiveDays: 55 } });
  await prisma.periodicReportSettings.create({ data: { storeId, enabled: true, recipients: user.email!, lastPeriodKey: '2026-09' } });
  await prisma.storePublicCatalog.create({ data: { storeId, slug: `reset-${suffix}`, active: true } });
  await prisma.storeCatalogOption.create({ data: { storeId, kind: 'CLIENT_TAG', value: 'VIP', label: 'VIP' } });
  await prisma.customFieldDefinition.create({ data: { storeId, key: 'test', label: 'Test', type: 'text' } });
  const rule = await prisma.commissionRule.create({ data: { storeId, memberId: membership!.id, rate: 10, effectiveFrom: now, createdBy: user.id } });
  await prisma.billingPlan.upsert({ where: { key: 'test' }, create: { key: 'test', providerId: 'fake-provider', sellerId: 'fake-seller', initPoint: 'https://example.com', amountArs: 1, exchangeRate: 1 }, update: {} });
  await prisma.imeiTacMiss.upsert({ where: { tac: '12345678' }, create: { tac: '12345678' }, update: {} });
  await prisma.billingCheckout.create({ data: { storeId, planKey: 'test', providerPlanId: 'fake-provider', payerEmail: user.email!, amountArs: 1, exchangeRate: 1, expiresAt: now } });
  await prisma.auditEvent.create({ data: { storeId, actorName: 'Owner', action: 'test.previous', entityType: 'store', entityId: storeId, detail: 'Must remain' } });
  await prisma.storeCounter.create({ data: { storeId, lastSaleNumber: 42, lastTradeNumber: 43, lastRepairNumber: 44 } });
  const supplier = await prisma.supplier.create({ data: { storeId, name: 'Proveedor ficticio', deletedAt: now } });
  const purchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, purchasedAt: now, deletedAt: now } });
  await prisma.inventoryItem.update({ where: { id: itemId }, data: { supplierId: supplier.id, stockPurchaseId: purchase.id, archivedAt: now } });
  await prisma.client.update({ where: { id: clientId }, data: { archivedAt: now } });
  const trade = await prisma.tradeIn.create({ data: { storeId, clientId, categoryId: catalog.tradeInCategory.id, dateLabel: '01/10', deviceReceived: 'Ficticio', receivedInventoryItemId: itemId, takeValue: 10, differencePaid: 90, status: 'COMPLETADO', tradeAt: now, tradeNumber: 43 } });
  const sale = await prisma.sale.create({ data: { storeId, clientId, sellerMemberId: membership!.id, categoryId: catalog.saleCategory.id, inventoryItemId: itemId, tradeInId: trade.id, dateLabel: '01/10', amount: 100, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', soldAt: now, saleNumber: 42 } });
  const repair = await prisma.repairOrder.create({ data: { storeId, clientId, device: 'Ficticio', orderNumber: 44 } });
  await prisma.repairStatusEvent.create({ data: { storeId, orderId: repair.id, status: 'RECIBIDO' } });
  await prisma.clientPayment.create({ data: { storeId, clientId, saleId: sale.id, repairOrderId: repair.id, amount: 10, method: 'EFECTIVO' } });
  await prisma.clientDeposit.create({ data: { storeId, clientId, requestKey: 'reset-test', amount: 10, currency: 'ARS', exchangeRate: 1, usdAmount: 10, method: 'EFECTIVO', saleId: sale.id, repairId: repair.id, productId: itemId } });
  await prisma.saleTender.create({ data: { storeId, saleId: sale.id, clientId, amount: 10, currency: 'ARS', method: 'EFECTIVO' } });
  const plan = await prisma.saleInstallmentPlan.create({ data: { storeId, saleId: sale.id, clientId, count: 1, frequency: 'MONTHLY', firstDueDate: now, financedAmount: 10 } });
  await prisma.saleInstallment.create({ data: { storeId, saleId: sale.id, clientId, planId: plan.id, sequence: 1, dueDate: now, amount: 10 } });
  await prisma.commissionPayment.create({ data: { storeId, memberId: membership!.id, period: '2026-10', amount: 1, currency: 'ARS', exchangeRate: 1, settlesCurrency: 'ARS', createdBy: user.id } });
  await prisma.commissionAccrual.create({ data: { storeId, memberId: membership!.id, sourceSaleId: sale.id, saleNumber: 42, soldAt: now, period: '2026-10', deviceLabel: 'Ficticio', currency: 'ARS', total: 100, cost: 50, takeValue: 10, grossProfit: 40, commission: 4, ruleId: rule.id } });
  await prisma.expense.create({ data: { storeId, spentAt: now, category: 'Prueba', amount: 10, currency: 'ARS', deletedAt: now } });
  const returnCase = await prisma.returnCase.create({ data: { storeId, caseNumber: 1, saleId: sale.id, clientId, inventoryItemId: itemId, supplierId: supplier.id, reason: 'Prueba', openedAt: now, deletedAt: now } });
  await prisma.returnEvent.create({ data: { storeId, caseId: returnCase.id, status: 'ABIERTO' } });
  const credit = await prisma.creditNote.create({ data: { storeId, clientId, returnCaseId: returnCase.id, saleId: sale.id, amount: 10, remaining: 5, currency: 'ARS' } });
  await prisma.creditNoteApplication.create({ data: { storeId, creditNoteId: credit.id, saleId: sale.id, amount: 5, currency: 'ARS' } });
  const register = await prisma.cashRegister.create({ data: { storeId, name: 'Caja prueba', currency: 'ARS', method: 'EFECTIVO', balance: 100, isDefault: true } });
  const session = await prisma.cashSession.create({ data: { storeId, registerId: register.id, day: '2026-10-01', opening: 10, openedBy: user.id } });
  await prisma.cashMovement.create({ data: { storeId, registerId: register.id, sessionId: session.id, amount: 90, kind: 'IN', sourceId: sale.id, sourceType: 'sale' } });
  await prisma.cashCount.create({ data: { storeId, sessionId: session.id, expected: 100, counted: 100, difference: 0, countedBy: user.id } });
  const stock = await prisma.stockCount.create({ data: { storeId, startedById: user.id, startedByName: 'Owner' } });
  await prisma.stockCountExpected.create({ data: { storeId, stockCountId: stock.id, inventoryItemId: itemId, imei: catalog.inventoryItem.imei!, model: 'Ficticio', capacity: '', color: '', statusAtSnapshot: 'DISPONIBLE' } });
  await prisma.stockCountScan.create({ data: { storeId, stockCountId: stock.id, scannedById: user.id, scannedByName: 'Owner', imei: catalog.inventoryItem.imei!, result: 'MATCH', inventoryItemId: itemId } });
  await prisma.sectionRecordView.create({ data: { storeId, userId: user.id, section: 'inventory', recordId: itemId, seenUpdatedAt: now } });
  const notification = await prisma.storeNotification.create({ data: { storeId, section: 'sales', title: 'Prueba', message: 'Prueba', kind: 'sale', recordId: sale.id } });
  await prisma.notificationRead.create({ data: { notificationId: notification.id, userId: user.id } });
  await prisma.productEvent.create({ data: { storeId, userId: user.id, name: 'test', source: 'server' } });
  await prisma.periodicReportDelivery.create({ data: { storeId, periodKey: '2026-10', recipient: user.email!, subject: 'Prueba', html: '<p>Prueba</p>', text: 'Prueba' } });
  return { store: store!, user, sale, client: catalog.client, item: catalog.inventoryItem, notification, register };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function body(f: Fixture, extra: Record<string, unknown> = {}) {
  return { storeId: f.store.id, storeEmail: f.user.email!, expectStoreName: f.store.name, dryRun: true, ...extra };
}
function post(payload: object, headers: Record<string, string> = buildAuthHeaders({ uid: 'platform-admin', email: adminEmail })) {
  return getApp().inject({ method: 'POST', url: '/admin/store-reset', headers, payload });
}
async function preview(f: Fixture) {
  const res = await post(body(f));
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ willDelete: Record<string, number>; willKeep: Record<string, number>; confirmToken: string }>();
}

describe('POST /admin/store-reset', () => {
  it('classifies every DMMF model with storeId exactly once, including child models', () => {
    const classified = [...STORE_RESET_KEEP_MODELS, ...STORE_RESET_DELETE_MODELS];
    expect(new Set(classified).size).toBe(classified.length);
    for (const model of Prisma.dmmf.datamodel.models) {
      if (model.fields.some(field => field.name === 'storeId')) expect(classified, model.name).toContain(model.name);
      // Future children without storeId also need an explicit ownership decision.
      if (model.fields.some(field => field.relationFromFields?.length && (STORE_RESET_DELETE_MODELS as readonly string[]).includes(field.type))) {
        expect(classified, model.name).toContain(model.name);
      }
    }
    for (const model of classified) expect(Prisma.dmmf.datamodel.models.some(item => item.name === model), model).toBe(true);
  });

  it.each([
    ['missing token', {}, 401],
    ['store OWNER', buildAuthHeaders({ uid: 'owner-one', email: 'owner-one@example.com' }), 403],
    ['other user', buildAuthHeaders({ uid: 'other', email: 'other@example.com' }), 403],
  ])('rejects %s without any writes', async (_label, headers, status) => {
    const f = await fixture();
    const before = await snapshot();
    const res = await post(body(f), headers);
    expect(res.statusCode).toBe(status);
    expect(await snapshot()).toEqual(before);
  });

  it.each(['production', ' PRODUCTION ', undefined])('rejects environment %s before any DB access, even for dryRun', async env => {
    const f = await fixture();
    const before = await snapshot();
    vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', env);
    vi.stubEnv('NODE_ENV', 'production');
    const transaction = vi.spyOn(prisma, '$transaction');
    try {
      for (const dryRun of [true, false]) {
        const res = await post(body(f, { dryRun }));
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'Solo disponible en ambientes de prueba' });
      }
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
    expect(await snapshot()).toEqual(before);
  });

  it('requires an exact allowlist entry before database access for preview and apply', async () => {
    const f = await fixture();
    const before = await snapshot();
    const transaction = vi.spyOn(prisma, '$transaction');
    try {
      for (const allowed of ['', ' , , ', 'another-store', `${f.store.id}-suffix`, undefined]) {
        vi.stubEnv('STORE_RESET_ALLOWED_STORE_IDS', allowed);
        for (const dryRun of [true, false]) expect((await post(body(f, { dryRun }))).statusCode).toBe(403);
      }
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['unknown store', { storeId: 'does-not-exist' }, 404],
    ['wrong owner email', { storeEmail: 'other@example.com' }, 409],
    ['wrong name', { expectStoreName: 'Test Store ' }, 409],
    ['unknown body key', { unexpected: true }, 400],
    ['missing dryRun', { dryRun: undefined }, 400],
    ['invalid email', { storeEmail: 'invalid' }, 400],
  ])('rejects %s with no writes', async (_label, extra, status) => {
    const f = await fixture();
    const before = await snapshot();
    const res = await post(body(f, extra));
    expect(res.statusCode, res.body).toBe(status);
    expect(await snapshot()).toEqual(before);
  });

  it('does not accept a staff email, removed OWNER, or the OWNER of another store', async () => {
    const f = await fixture();
    const other = await fixture('two');
    const staff = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: 'staff-one' } });
    await prisma.storeMember.update({ where: { storeId_userId: { storeId: f.store.id, userId: staff.id } }, data: { role: 'OWNER', removedAt: new Date() } });
    const before = await snapshot();
    for (const storeEmail of [staff.email, other.user.email]) {
      const res = await post(body(f, { storeEmail }));
      expect(res.statusCode).toBe(409);
    }
    expect(await snapshot()).toEqual(before);
  });

  it('previews correct counts for every table and rolls back all effects', async () => {
    const f = await fixture();
    await fixture('two');
    const before = await snapshot();
    const out = await preview(f);
    expect(out.willDelete).toEqual(Object.fromEntries(STORE_RESET_DELETE_MODELS.map(model => [model, 1])));
    expect(out.willKeep).toEqual(Object.fromEntries(STORE_RESET_KEEP_MODELS.map(model => [model, model === 'User' || model === 'StoreMember' ? 2 : 1])));
    expect(out.confirmToken).toBe(`VACIAR ${f.store.id} ${STORE_RESET_DELETE_MODELS.length}`);
    expect(await snapshot()).toEqual(before);
    expect((await preview(f)).confirmToken).toBe(out.confirmToken);
  });

  it('requires exact confirmation and the complete, fresh count map', async () => {
    const f = await fixture();
    const out = await preview(f);
    const { Client: _client, ...missingKey } = out.willDelete;
    const before = await snapshot();
    for (const extra of [
      { expect: out.willDelete },
      { confirm: 'wrong', expect: out.willDelete },
      { confirm: out.confirmToken },
      { confirm: out.confirmToken, expect: missingKey },
      { confirm: out.confirmToken, expect: { ...out.willDelete, Client: 2 } },
      { confirm: out.confirmToken, expect: { ...out.willDelete, Unknown: 0 } },
    ]) {
      const res = await post(body(f, { dryRun: false, ...extra }));
      expect(res.statusCode, res.body).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
    // Same total and token, different per-table distribution: expect still blocks.
    await prisma.expense.deleteMany({ where: { storeId: f.store.id } });
    await prisma.productEvent.create({ data: { storeId: f.store.id, name: 'extra', source: 'server' } });
    const changed = await snapshot();
    const stale = await post(body(f, { dryRun: false, confirm: out.confirmToken, expect: out.willDelete }));
    expect(stale.statusCode).toBe(409);
    expect(await snapshot()).toEqual(changed);
  });

  it('deletes all business rows, preserves identities/config/audit and the entire other store, then resets again', async () => {
    const f = await fixture();
    await fixture('two');
    // Also retain analytics without a tenant and users without a membership.
    await prisma.productEvent.create({ data: { name: 'global', source: 'server' } });
    await prisma.user.create({ data: { firebaseUid: 'without-store' } });
    const before = await snapshot();
    const out = await preview(f);
    const res = await post(body(f, { dryRun: false, confirm: out.confirmToken, expect: out.willDelete }));
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ ...out, dryRun: false });
    const after = await snapshot();
    for (const [model, rows] of Object.entries(before)) {
      const originals = (rows as { row: Record<string, unknown> }[]);
      if ((STORE_RESET_DELETE_MODELS as readonly string[]).includes(model)) {
        const kept = originals.filter(({ row }) => model === 'NotificationRead' ? row.notificationId !== f.notification.id : row.storeId !== f.store.id);
        expect(after[model], model).toEqual(kept);
      } else if (model === 'AuditEvent') {
        expect(after[model]).toEqual(expect.arrayContaining(originals));
        expect((after[model] as unknown[]).length).toBe(originals.length + 1);
      } else if (model === 'StoreCounter' || model === 'CashRegister') {
        const expected = originals.map(({ row }) => ({ row: row.storeId !== f.store.id ? row : model === 'StoreCounter'
          ? { ...row, lastSaleNumber: 0, lastTradeNumber: 0, lastRepairNumber: 0 }
          : { ...row, balance: 0, updatedAt: expect.any(String) } }));
        expect(after[model], model).toEqual(expect.arrayContaining(expected));
        expect((after[model] as unknown[]).length).toBe(originals.length);
      } else expect(after[model], model).toEqual(originals);
    }
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { storeId: f.store.id, action: 'store.reset' } });
    expect(audit.source).toBe('system');
    expect(JSON.parse(audit.detail!)).toEqual({ admin: adminEmail, willDelete: out.willDelete, willKeep: out.willKeep, reset: { StoreCounter: 0, CashRegisterBalance: 0 } });
    const again = await preview(f);
    expect(again.willDelete).toEqual(Object.fromEntries(STORE_RESET_DELETE_MODELS.map(model => [model, 0])));
    const second = await post(body(f, { dryRun: false, confirm: again.confirmToken, expect: again.willDelete }));
    expect(second.statusCode, second.body).toBe(200);
    expect(await prisma.auditEvent.count({ where: { storeId: f.store.id, action: 'store.reset' } })).toBe(2);
    const numbers = await prisma.$transaction(async tx => Promise.all([
      allocateDocumentNumber(tx, f.store.id, 'sale'), allocateDocumentNumber(tx, f.store.id, 'trade'), allocateDocumentNumber(tx, f.store.id, 'repair'),
    ]));
    expect(numbers).toEqual([1, 1, 1]);
  });

  it.each(['cascade', 'set-null'])('rolls back every deletion on a cross-store %s side effect', async kind => {
    const f = await fixture();
    const other = await fixture('two');
    if (kind === 'cascade') {
      await prisma.saleTender.updateMany({ where: { storeId: other.store.id }, data: { saleId: f.sale.id } });
    } else {
      await prisma.sale.update({ where: { id: other.sale.id }, data: { clientId: f.client.id } });
    }
    const before = await snapshot();
    // Obtain counts without running the destructive preview (which also detects
    // these broken tenant FKs). Every target table still contains exactly one row.
    const willDelete = Object.fromEntries(STORE_RESET_DELETE_MODELS.map(model => [model, 1]));
    const res = await post(body(f, { dryRun: false, confirm: `VACIAR ${f.store.id} ${STORE_RESET_DELETE_MODELS.length}`, expect: willDelete }));
    expect(res.statusCode, res.body).toBe(409);
    expect(await snapshot()).toEqual(before);
    const dry = await post(body(f));
    expect(dry.statusCode).toBe(409);
    expect(await snapshot()).toEqual(before);
  });
});
