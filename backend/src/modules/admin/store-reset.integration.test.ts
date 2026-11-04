import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import {
  buildAuthHeaders,
  seedCatalogFixture,
  seedStoreContext,
} from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createTestAuthToken } from '../../testing/test-auth.js';
import {
  STORE_RESET_DELETE_MODELS,
  STORE_RESET_FULL_DELETE_MODELS,
  STORE_RESET_KEEP_MODELS,
} from './store-reset.service.js';

const { getApp } = useIntegrationApp();
const adminEmail = 'admin@internal.test';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', adminEmail);
  vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', 'production');
});
afterEach(() => vi.unstubAllEnvs());

const table = (model: { name: string; dbName: string | null }) =>
  Prisma.raw(`"${model.dbName ?? model.name}"`);
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
  const context = await seedStoreContext({
    firebaseUid: `owner-${suffix}`,
    email: `owner-${suffix}@example.com`,
  });
  const { store, user, membership } = context;
  const storeId = store!.id;
  const now = new Date('2026-10-01T12:00:00Z');
  const catalog = await seedCatalogFixture(storeId);
  const clientId = catalog.client.id;
  const itemId = catalog.inventoryItem.id;
  const staff = await prisma.user.create({
    data: {
      firebaseUid: `staff-${suffix}`,
      email: `staff-${suffix}@example.com`,
    },
  });
  await prisma.storeMember.create({
    data: {
      storeId,
      userId: staff.id,
      role: 'STAFF',
      sections: { sales: true },
    },
  });
  await prisma.storeInvitation.create({
    data: {
      storeId,
      email: `invited-${suffix}@example.com`,
      role: 'STAFF',
      expiresAt: now,
    },
  });
  await prisma.storeFollowUpSettings.create({
    data: { storeId, inactiveDays: 55 },
  });
  await prisma.periodicReportSettings.create({
    data: {
      storeId,
      enabled: true,
      recipients: user.email!,
      lastPeriodKey: '2026-09',
    },
  });
  await prisma.storePublicCatalog.create({
    data: { storeId, slug: `reset-${suffix}`, active: true },
  });
  const publicCatalog = await prisma.storeCatalog.create({
    data: {
      id: `default:${storeId}`,
      storeId,
      slug: `reset-${suffix}`,
      isDefault: true,
      active: true,
    },
  });
  await prisma.catalogItemPrice.create({
    data: {
      catalogId: publicCatalog.id,
      inventoryItemId: itemId,
      price: 120,
      currency: 'USD',
    },
  });
  await prisma.catalogItemHidden.create({
    data: { catalogId: publicCatalog.id, inventoryItemId: itemId },
  });
  await prisma.storeCatalogOption.create({
    data: { storeId, kind: 'CLIENT_TAG', value: 'VIP', label: 'VIP' },
  });
  await prisma.customFieldDefinition.create({
    data: { storeId, key: 'test', label: 'Test', type: 'text' },
  });
  const rule = await prisma.commissionRule.create({
    data: {
      storeId,
      memberId: membership!.id,
      rate: 10,
      effectiveFrom: now,
      createdBy: user.id,
    },
  });
  await prisma.billingPlan.upsert({
    where: { key: 'test' },
    create: {
      key: 'test',
      providerId: 'fake-provider',
      sellerId: 'fake-seller',
      initPoint: 'https://example.com',
      amountArs: 1,
      exchangeRate: 1,
    },
    update: {},
  });
  await prisma.imeiTacMiss.upsert({
    where: { tac: '12345678' },
    create: { tac: '12345678' },
    update: {},
  });
  await prisma.billingCheckout.create({
    data: {
      storeId,
      planKey: 'test',
      providerPlanId: 'fake-provider',
      payerEmail: user.email!,
      amountArs: 1,
      exchangeRate: 1,
      expiresAt: now,
    },
  });
  await prisma.auditEvent.create({
    data: {
      storeId,
      actorName: 'Owner',
      action: 'test.previous',
      entityType: 'store',
      entityId: storeId,
      detail: 'Must remain',
    },
  });
  await prisma.storeCounter.create({
    data: {
      storeId,
      lastSaleNumber: 42,
      lastTradeNumber: 43,
      lastRepairNumber: 44,
    },
  });
  const supplier = await prisma.supplier.create({
    data: { storeId, name: 'Proveedor ficticio', deletedAt: now },
  });
  const purchase = await prisma.stockPurchase.create({
    data: {
      storeId,
      supplierId: supplier.id,
      purchasedAt: now,
      deletedAt: now,
    },
  });
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      supplierId: supplier.id,
      stockPurchaseId: purchase.id,
      archivedAt: now,
    },
  });
  await prisma.client.update({
    where: { id: clientId },
    data: {
      archivedAt: now,
      totalSpent: 100,
      pendingBalance: 60,
      lastPurchaseAt: now,
      importedSpent: 500,
      importedSpentCurrency: 'USD',
    },
  });
  const trade = await prisma.tradeIn.create({
    data: {
      storeId,
      clientId,
      categoryId: catalog.tradeInCategory.id,
      dateLabel: '01/10',
      deviceReceived: 'Ficticio',
      receivedInventoryItemId: itemId,
      takeValue: 10,
      differencePaid: 90,
      status: 'COMPLETADO',
      tradeAt: now,
      tradeNumber: 43,
    },
  });
  const sale = await prisma.sale.create({
    data: {
      storeId,
      clientId,
      sellerMemberId: membership!.id,
      categoryId: catalog.saleCategory.id,
      inventoryItemId: itemId,
      tradeInId: trade.id,
      dateLabel: '01/10',
      amount: 100,
      paymentMethod: 'EFECTIVO',
      status: 'PENDIENTE',
      openBalance: 60,
      soldAt: now,
      saleNumber: 42,
    },
  });
  await prisma.consignment.create({
    data: {
      storeId,
      clientId,
      inventoryItemId: itemId,
      amount: 100,
      currency: 'ARS',
      paidAt: now,
      saleId: sale.id,
    },
  });
  const repair = await prisma.repairOrder.create({
    data: { storeId, clientId, device: 'Ficticio', orderNumber: 44 },
  });
  await prisma.repairStatusEvent.create({
    data: { storeId, orderId: repair.id, status: 'RECIBIDO' },
  });
  await prisma.clientPayment.create({
    data: {
      storeId,
      clientId,
      saleId: sale.id,
      amount: 10,
      method: 'EFECTIVO',
    },
  });
  await prisma.clientDeposit.create({
    data: {
      storeId,
      clientId,
      requestKey: 'reset-test',
      amount: 10,
      currency: 'ARS',
      exchangeRate: 1,
      usdAmount: 10,
      method: 'EFECTIVO',
      saleId: sale.id,
      productId: itemId,
    },
  });
  await prisma.saleTender.create({
    data: {
      storeId,
      saleId: sale.id,
      clientId,
      amount: 10,
      currency: 'ARS',
      method: 'EFECTIVO',
    },
  });
  const plan = await prisma.saleInstallmentPlan.create({
    data: {
      storeId,
      saleId: sale.id,
      clientId,
      count: 1,
      frequency: 'MONTHLY',
      firstDueDate: now,
      financedAmount: 10,
    },
  });
  await prisma.saleInstallment.create({
    data: {
      storeId,
      saleId: sale.id,
      clientId,
      planId: plan.id,
      sequence: 1,
      dueDate: now,
      amount: 10,
    },
  });
  await prisma.commissionPayment.create({
    data: {
      storeId,
      memberId: membership!.id,
      period: '2026-10',
      amount: 1,
      currency: 'ARS',
      exchangeRate: 1,
      settlesCurrency: 'ARS',
      createdBy: user.id,
    },
  });
  await prisma.commissionAccrual.create({
    data: {
      storeId,
      memberId: membership!.id,
      sourceSaleId: sale.id,
      saleNumber: 42,
      soldAt: now,
      period: '2026-10',
      deviceLabel: 'Ficticio',
      currency: 'ARS',
      total: 100,
      cost: 50,
      takeValue: 10,
      grossProfit: 40,
      commission: 4,
      ruleId: rule.id,
    },
  });
  await prisma.expense.create({
    data: {
      storeId,
      spentAt: now,
      category: 'Prueba',
      amount: 10,
      currency: 'ARS',
      deletedAt: now,
    },
  });
  const returnCase = await prisma.returnCase.create({
    data: {
      storeId,
      caseNumber: 1,
      saleId: sale.id,
      clientId,
      inventoryItemId: itemId,
      supplierId: supplier.id,
      reason: 'Prueba',
      openedAt: now,
      deletedAt: now,
    },
  });
  await prisma.returnEvent.create({
    data: { storeId, caseId: returnCase.id, status: 'ABIERTO' },
  });
  const credit = await prisma.creditNote.create({
    data: {
      storeId,
      clientId,
      returnCaseId: returnCase.id,
      saleId: sale.id,
      amount: 10,
      remaining: 5,
      currency: 'ARS',
    },
  });
  await prisma.creditNoteApplication.create({
    data: {
      storeId,
      creditNoteId: credit.id,
      saleId: sale.id,
      amount: 5,
      currency: 'ARS',
    },
  });
  const register = await prisma.cashRegister.create({
    data: {
      storeId,
      name: 'Caja prueba',
      currency: 'ARS',
      method: 'EFECTIVO',
      balance: 100,
      isDefault: true,
    },
  });
  const session = await prisma.cashSession.create({
    data: {
      storeId,
      registerId: register.id,
      day: '2026-10-01',
      opening: 10,
      openedBy: user.id,
    },
  });
  await prisma.cashMovement.create({
    data: {
      storeId,
      registerId: register.id,
      sessionId: session.id,
      amount: 90,
      kind: 'IN',
      sourceId: sale.id,
      sourceType: 'sale',
    },
  });
  await prisma.cashCount.create({
    data: {
      storeId,
      sessionId: session.id,
      expected: 100,
      counted: 100,
      difference: 0,
      countedBy: user.id,
    },
  });
  const stock = await prisma.stockCount.create({
    data: { storeId, startedById: user.id, startedByName: 'Owner' },
  });
  await prisma.stockCountExpected.create({
    data: {
      storeId,
      stockCountId: stock.id,
      inventoryItemId: itemId,
      imei: catalog.inventoryItem.imei!,
      model: 'Ficticio',
      capacity: '',
      color: '',
      statusAtSnapshot: 'DISPONIBLE',
    },
  });
  await prisma.stockCountScan.create({
    data: {
      storeId,
      stockCountId: stock.id,
      scannedById: user.id,
      scannedByName: 'Owner',
      imei: catalog.inventoryItem.imei!,
      result: 'MATCH',
      inventoryItemId: itemId,
    },
  });
  await prisma.sectionRecordView.create({
    data: {
      storeId,
      userId: user.id,
      section: 'inventory',
      recordId: itemId,
      seenUpdatedAt: now,
    },
  });
  const notification = await prisma.storeNotification.create({
    data: {
      storeId,
      section: 'sales',
      title: 'Prueba',
      message: 'Prueba',
      kind: 'sale',
      recordId: sale.id,
    },
  });
  await prisma.notificationRead.create({
    data: { notificationId: notification.id, userId: user.id },
  });
  await prisma.productEvent.create({
    data: { storeId, userId: user.id, name: 'test', source: 'server' },
  });
  await prisma.periodicReportDelivery.create({
    data: {
      storeId,
      periodKey: '2026-10',
      recipient: user.email!,
      subject: 'Prueba',
      html: '<p>Prueba</p>',
      text: 'Prueba',
    },
  });
  return {
    store: store!,
    user,
    sale,
    client: catalog.client,
    item: catalog.inventoryItem,
    notification,
    register,
    repair,
    purchase,
    supplier,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function body(f: Fixture, extra: Record<string, unknown> = {}) {
  return {
    expectStoreId: f.store.id,
    storeEmail: f.user.email!,
    expectStoreName: f.store.name,
    dryRun: true,
    ...extra,
  };
}
function post(
  payload: object,
  headers: Record<string, string> = buildAuthHeaders({
    uid: 'platform-admin',
    email: adminEmail,
  }),
) {
  return getApp().inject({
    method: 'POST',
    url: '/admin/store-reset',
    headers,
    payload,
  });
}
async function preview(f: Fixture, extra: Record<string, unknown> = {}) {
  const res = await post(body(f, extra));
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{
    willDelete: Record<string, number>;
    willKeep: Record<string, number>;
  }>();
}

describe('POST /admin/store-reset', () => {
  it.each([
    { scope: 'default', deleteModels: STORE_RESET_DELETE_MODELS },
    { scope: 'full', deleteModels: STORE_RESET_FULL_DELETE_MODELS },
  ])(
    'classifies every DMMF model for $scope, including children',
    ({ deleteModels }) => {
      const classified = [
        ...STORE_RESET_KEEP_MODELS.filter(
          (model) => !(deleteModels as readonly string[]).includes(model),
        ),
        ...deleteModels,
      ];
      expect(new Set(classified).size).toBe(classified.length);
      for (const model of Prisma.dmmf.datamodel.models) {
        if (model.fields.some((field) => field.name === 'storeId'))
          expect(classified, model.name).toContain(model.name);
        // Future children without storeId also need an explicit ownership decision.
        if (
          model.fields.some(
            (field) =>
              field.relationFromFields?.length &&
              (deleteModels as readonly string[]).includes(field.type),
          )
        ) {
          expect(classified, model.name).toContain(model.name);
        }
      }
      for (const model of classified)
        expect(
          Prisma.dmmf.datamodel.models.some((item) => item.name === model),
          model,
        ).toBe(true);
    },
  );

  it.each([
    ['missing token', {}, 401],
    [
      'store OWNER',
      buildAuthHeaders({ uid: 'owner-one', email: 'owner-one@example.com' }),
      403,
    ],
    [
      'other user',
      buildAuthHeaders({ uid: 'other', email: 'other@example.com' }),
      403,
    ],
    [
      'unverified admin',
      {
        Authorization: `Bearer ${createTestAuthToken({ uid: 'platform-admin', email: adminEmail, emailVerified: false })}`,
      },
      403,
    ],
  ])('rejects %s without any writes', async (_label, headers, status) => {
    const f = await fixture();
    const before = await snapshot();
    for (const scope of [undefined, 'full']) {
      const res = await post(body(f, { scope }), headers);
      expect(res.statusCode).toBe(status);
      expect(await snapshot()).toEqual(before);
    }
  });

  it('does not depend on environment or a store allowlist', async () => {
    const f = await fixture();
    const before = await snapshot();
    vi.stubEnv('NODE_ENV', 'production');
    for (const env of ['production', 'test', undefined]) {
      vi.stubEnv('RAILWAY_ENVIRONMENT_NAME', env);
      vi.stubEnv('STORE_RESET_ALLOWED_STORE_IDS', 'another-store');
      await preview(f);
    }
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['unknown owner', { storeEmail: 'missing@example.com' }, 409],
    ['wrong owner email', { storeEmail: 'other@example.com' }, 409],
    ['wrong name', { expectStoreName: 'Test Store ' }, 409],
    ['wrong ID', { expectStoreId: 'another-store' }, 409],
    ['unknown body key', { unexpected: true }, 400],
    ['legacy storeId', { storeId: 'anything' }, 400],
    ['missing ID', { expectStoreId: undefined }, 400],
    ['missing dryRun', { dryRun: undefined }, 400],
    ['invalid email', { storeEmail: 'invalid' }, 400],
    ['invalid scope', { scope: 'everything' }, 400],
  ])('rejects %s with no writes', async (_label, extra, status) => {
    const f = await fixture();
    const before = await snapshot();
    for (const scope of [undefined, 'full'])
      for (const dryRun of [true, false]) {
        const res = await post(body(f, { scope, dryRun, ...extra }));
        expect(res.statusCode, res.body).toBe(status);
        expect(await snapshot()).toEqual(before);
      }
  });

  it('rejects staff, removed OWNER, another owner and an ambiguous owner email', async () => {
    const f = await fixture();
    const other = await fixture('two');
    const staff = await prisma.user.findUniqueOrThrow({
      where: { firebaseUid: 'staff-one' },
    });
    for (const storeEmail of [staff.email, other.user.email]) {
      expect((await post(body(f, { storeEmail }))).statusCode).toBe(409);
    }
    await prisma.storeMember.update({
      where: { storeId_userId: { storeId: f.store.id, userId: staff.id } },
      data: { role: 'OWNER', removedAt: new Date() },
    });
    const before = await snapshot();
    expect((await post(body(f, { storeEmail: staff.email }))).statusCode).toBe(
      409,
    );
    expect(await snapshot()).toEqual(before);
    await prisma.storeMember.create({
      data: { storeId: other.store.id, userId: f.user.id, role: 'OWNER' },
    });
    const ambiguous = await snapshot();
    expect((await post(body(f))).statusCode).toBe(409);
    expect(await snapshot()).toEqual(ambiguous);
  });

  it('previews counts by table in Serializable and rolls back every effect including audit', async () => {
    const f = await fixture();
    await fixture('two');
    const before = await snapshot();
    const transaction = vi.spyOn(prisma, '$transaction');
    const out = await preview(f);
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    transaction.mockRestore();
    expect(out.willDelete).toEqual(
      Object.fromEntries(STORE_RESET_DELETE_MODELS.map((model) => [model, 1])),
    );
    expect(out.willKeep.Client).toBe(1);
    expect(out.willKeep.RepairOrder).toBe(1);
    expect(out.willKeep.Sale).toBe(0);
    expect(await snapshot()).toEqual(before);
    expect(await preview(f)).toEqual(out);
  });

  it('requires the complete, exact and fresh count map, including Sale and InventoryItem', async () => {
    const f = await fixture();
    const out = await preview(f);
    const { Sale: _sale, ...missingSale } = out.willDelete;
    const { InventoryItem: _inventory, ...missingInventory } = out.willDelete;
    const before = await snapshot();
    for (const expected of [
      undefined,
      missingSale,
      missingInventory,
      { ...out.willDelete, Sale: 2 },
      { ...out.willDelete, InventoryItem: 0 },
      { ...out.willDelete, Unknown: 0 },
      { ...out.willDelete, ClientPayment: 2 },
    ]) {
      const res = await post(body(f, { dryRun: false, expect: expected }));
      expect(res.statusCode, res.body).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
    await prisma.clientPayment.create({
      data: {
        storeId: f.store.id,
        clientId: f.client.id,
        saleId: f.sale.id,
        amount: 1,
        method: 'EFECTIVO',
      },
    });
    const changed = await snapshot();
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(409);
    expect(await snapshot()).toEqual(changed);
  });

  it('deletes only scoped rows, preserves independent modules and the whole other store, and records audit', async () => {
    const f = await fixture();
    await fixture('two');
    await prisma.productEvent.create({
      data: { name: 'global', source: 'server' },
    });
    await prisma.user.create({ data: { firebaseUid: 'without-store' } });
    // Every eligible table has exactly one selected fixture row before adding
    // unrelated rows of the same store. Capture identities independently of plan.
    const base = await snapshot();
    const removed = Object.fromEntries(
      STORE_RESET_DELETE_MODELS.map((model) => [
        model,
        (base[model] as Row[]).filter(({ row }) =>
          model === 'NotificationRead'
            ? row.notificationId === f.notification.id
            : model === 'CatalogItemPrice' || model === 'CatalogItemHidden'
              ? row.inventoryItemId === f.item.id
              : row.storeId === f.store.id,
        ),
      ]),
    );
    const independent = await seedIndependent(f);
    const before = await snapshot();
    const out = await preview(f);
    expect(out.willDelete).toEqual(
      Object.fromEntries(STORE_RESET_DELETE_MODELS.map((model) => [model, 1])),
    );
    expect(await snapshot()).toEqual(before);
    const res = await post(body(f, { dryRun: false, expect: out.willDelete }));
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ ...out, dryRun: false });
    const after = await snapshot();
    for (const [model, rows] of Object.entries(before)) {
      const originals = rows as Row[];
      if (model === 'AuditEvent') {
        expect(after[model]).toEqual(expect.arrayContaining(originals));
        expect((after[model] as Row[]).length).toBe(originals.length + 1);
        continue;
      }
      const deleted = new Set(
        (removed[model] ?? []).map(({ row }) => JSON.stringify(row)),
      );
      const expected = originals
        .filter(({ row }) => !deleted.has(JSON.stringify(row)))
        .map(({ row }) => ({
          row:
            model === 'Client' && row.id === f.client.id
              ? {
                  ...row,
                  totalSpent: 0,
                  pendingBalance: 0,
                  lastPurchaseAt: null,
                  updatedAt: expect.any(String),
                }
              : model === 'CashRegister' && row.id === f.register.id
                ? { ...row, balance: 10 }
                : model === 'ClientDeposit' && row.id === independent.deposit.id
                  ? { ...row, productId: null }
                  : row,
        }));
      expect(after[model], model).toEqual(expect.arrayContaining(expected));
      expect((after[model] as Row[]).length, model).toBe(expected.length);
    }
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { storeId: f.store.id, action: 'store.reset' },
    });
    expect(audit.source).toBe('system');
    expect(audit.actorUserId).toBeNull();
    expect(JSON.parse(audit.detail!)).toEqual({
      admin: adminEmail,
      scope: 'sales-inventory',
      willDelete: out.willDelete,
      willKeep: out.willKeep,
      clientsReset: 1,
    });
    const again = await preview(f);
    expect(Object.values(again.willDelete).every((n) => n === 0)).toBe(true);
    expect(
      (await post(body(f, { dryRun: false, expect: again.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      await prisma.auditEvent.count({
        where: { storeId: f.store.id, action: 'store.reset' },
      }),
    ).toBe(2);
  });

  it('keeps a manual balance on a client who also has sales and generic payments', async () => {
    const f = await fixture();
    // 60 sale debt + 15 linked charge - 10 general payment + 25 independent charge = 90.
    await prisma.client.update({
      where: { id: f.client.id },
      data: { pendingBalance: 90 },
    });
    await prisma.clientPayment.create({
      data: {
        storeId: f.store.id,
        clientId: f.client.id,
        amount: 10,
        kind: 'PAGO',
        currency: 'ARS',
        method: 'EFECTIVO',
      },
    });
    await prisma.clientPayment.create({
      data: {
        storeId: f.store.id,
        clientId: f.client.id,
        saleId: f.sale.id,
        amount: 15,
        kind: 'CARGO',
        currency: 'ARS',
        method: 'AJUSTE',
        note: 'Flete de venta',
      },
    });
    const charge = await prisma.clientPayment.create({
      data: {
        storeId: f.store.id,
        clientId: f.client.id,
        amount: 25,
        kind: 'CARGO',
        currency: 'ARS',
        method: 'AJUSTE',
        note: 'Cargo independiente',
      },
    });
    const before = await snapshot();
    const out = await preview(f);
    expect(await snapshot()).toEqual(before);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    const client = await prisma.client.findUniqueOrThrow({
      where: { id: f.client.id },
    });
    expect(Number(client.pendingBalance)).toBe(25);
    expect(Number(client.totalSpent)).toBe(0);
    expect(
      await prisma.clientPayment.findUnique({ where: { id: charge.id } }),
    ).toEqual(charge);
  });

  it('uses stored exchange rates for debt and fails closed if a historical rate is missing', async () => {
    const f = await fixture();
    await prisma.sale.update({
      where: { id: f.sale.id },
      data: { amount: 100_000, openBalance: 60_000, amountCurrency: 'ARS' },
    });
    await prisma.tradeIn.update({
      where: { id: f.sale.tradeInId! },
      data: { differencePaid: 90_000 },
    });
    await prisma.client.update({
      where: { id: f.client.id },
      data: { balanceCurrency: 'USD', pendingBalance: 85 },
    });
    const before = await snapshot();
    expect((await post(body(f))).statusCode).toBe(409);
    expect(await snapshot()).toEqual(before);
    await prisma.sale.update({
      where: { id: f.sale.id },
      data: { exchangeRate: 1000 },
    });
    const out = await preview(f);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      Number(
        (await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } }))
          .pendingBalance,
      ),
    ).toBe(25);
  });

  it('fully resets USD clients in an ARS store without historical rates, preserves all other data and rolls preview back', async () => {
    const f = await fixture();
    await fixture('two');
    await prisma.client.update({
      where: { id: f.client.id },
      data: {
        balanceCurrency: 'USD',
        pendingBalance: 85,
        customFields: { note: 'Nota ficticia' },
      },
    });
    await prisma.sale.update({
      where: { id: f.sale.id },
      data: { amountCurrency: 'ARS', exchangeRate: null },
    });
    const legacy = await post(body(f));
    expect(legacy.statusCode).toBe(409);
    expect(legacy.json().error).toContain('Falta cotización histórica');
    await seedIndependent(f);
    // Full also owns both sides of legacy sale/repair rows, and orders without a client.
    await prisma.clientPayment.updateMany({
      where: { storeId: f.store.id, saleId: f.sale.id },
      data: { repairOrderId: f.repair.id, note: 'Nota de cuenta corriente' },
    });
    await prisma.clientDeposit.updateMany({
      where: { storeId: f.store.id, saleId: f.sale.id },
      data: { repairId: f.repair.id },
    });
    const looseRepair = await prisma.repairOrder.create({
      data: {
        storeId: f.store.id,
        device: 'Sin cliente',
        archivedAt: new Date(),
      },
    });
    await prisma.repairStatusEvent.create({
      data: {
        storeId: f.store.id,
        orderId: looseRepair.id,
        status: 'RECIBIDO',
      },
    });
    const manual = await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: 7,
        kind: 'INGRESO',
        note: 'Fondo independiente',
      },
    });
    const configNotice = await prisma.storeNotification.create({
      data: {
        storeId: f.store.id,
        section: 'settings',
        title: 'Configuración',
        message: 'Conservar',
        kind: 'settings',
      },
    });
    await prisma.notificationRead.create({
      data: { notificationId: configNotice.id, userId: f.user.id },
    });
    // Actual section IDs must also clear metadata whose operation was already deleted.
    for (const section of ['service', 'tradeins']) {
      const notice = await prisma.storeNotification.create({
        data: {
          storeId: f.store.id,
          section,
          title: 'Operación previa',
          message: 'Borrar',
          kind: 'test',
          recordId: 'deleted-before-reset',
        },
      });
      await prisma.notificationRead.create({
        data: { notificationId: notice.id, userId: f.user.id },
      });
      await prisma.sectionRecordView.create({
        data: {
          storeId: f.store.id,
          userId: f.user.id,
          section,
          recordId: 'deleted-before-reset',
          seenUpdatedAt: new Date(),
        },
      });
    }
    const before = await snapshot();
    const out = await preview(f, { scope: 'full' });
    expect(await snapshot()).toEqual(before);
    expect(await preview(f, { scope: 'full' })).toEqual(out);
    expect(out.willDelete).toMatchObject({
      Client: 2,
      RepairOrder: 2,
      RepairStatusEvent: 2,
      TradeIn: 2,
      ReturnCase: 2,
      ClientPayment: 3,
      ClientDeposit: 2,
      CashMovement: 5,
    });
    expect(Object.keys(out.willDelete).sort()).toEqual(
      [...STORE_RESET_FULL_DELETE_MODELS].sort(),
    );
    expect(out.willKeep).toMatchObject({
      Client: 0,
      RepairOrder: 0,
      ClientPayment: 0,
      CashMovement: 1,
      StoreNotification: 1,
    });
    const res = await post(
      body(f, { scope: 'full', dryRun: false, expect: out.willDelete }),
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ ...out, dryRun: false });
    const after = await snapshot();
    const removedNoticeIds = new Set(
      (before.StoreNotification as Row[])
        .filter(
          ({ row }) => row.storeId === f.store.id && row.id !== configNotice.id,
        )
        .map(({ row }) => row.id),
    );
    for (const [model, rows] of Object.entries(before)) {
      const originals = rows as Row[];
      if (model === 'AuditEvent') {
        expect(after[model]).toEqual(expect.arrayContaining(originals));
        expect((after[model] as Row[]).length).toBe(originals.length + 1);
        continue;
      }
      const expected = originals
        .filter(({ row }) => {
          if (model === 'NotificationRead')
            return !removedNoticeIds.has(row.notificationId);
          if (model === 'CatalogItemPrice' || model === 'CatalogItemHidden')
            return row.inventoryItemId !== f.item.id;
          if (row.storeId !== f.store.id) return true;
          if (model === 'CashMovement') return row.id === manual.id;
          if (model === 'StoreNotification') return row.id === configNotice.id;
          return !(
            STORE_RESET_FULL_DELETE_MODELS as readonly string[]
          ).includes(model);
        })
        .map(({ row }) => ({
          row:
            model === 'CashRegister' && row.id === f.register.id
              ? { ...row, balance: 0 }
              : row,
        }));
      expect(after[model], model).toEqual(expected);
    }
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { storeId: f.store.id, action: 'store.reset' },
    });
    expect(JSON.parse(audit.detail!)).toEqual({
      admin: adminEmail,
      scope: 'full',
      willDelete: out.willDelete,
      willKeep: out.willKeep,
      clientsReset: 2,
      cashRegistersZeroed: 1,
    });
    const again = await preview(f, { scope: 'full' });
    expect(Object.values(again.willDelete).every((n) => n === 0)).toBe(true);
    expect(
      (
        await post(
          body(f, { scope: 'full', dryRun: false, expect: again.willDelete }),
        )
      ).statusCode,
    ).toBe(200);
  });

  it('requires full counts from a fresh full preview and rejects default-scope counts', async () => {
    const f = await fixture();
    const legacy = await preview(f);
    const out = await preview(f, { scope: 'full' });
    const { Client: _client, ...missingClient } = out.willDelete;
    const before = await snapshot();
    for (const expectCounts of [
      undefined,
      legacy.willDelete,
      missingClient,
      { ...out.willDelete, RepairOrder: 0 },
      { ...out.willDelete, Unknown: 0 },
    ]) {
      const res = await post(
        body(f, { scope: 'full', dryRun: false, expect: expectCounts }),
      );
      expect(res.statusCode, res.body).toBe(409);
      expect(await snapshot()).toEqual(before);
    }
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(409);
    await prisma.client.create({
      data: { storeId: f.store.id, name: 'Nuevo cliente' },
    });
    const changed = await snapshot();
    expect(
      (
        await post(
          body(f, { scope: 'full', dryRun: false, expect: out.willDelete }),
        )
      ).statusCode,
    ).toBe(409);
    expect(await snapshot()).toEqual(changed);
  });

  it('removes all operational cash sources and recursive reversals in their register denomination', async () => {
    const f = await fixture();
    const original = await prisma.cashMovement.findFirstOrThrow({
      where: { storeId: f.store.id },
    });
    const reversal = await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: -90,
        kind: 'ANULACION',
        reversalOf: original.id,
      },
    });
    await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: 90,
        kind: 'ANULACION',
        reversalOf: reversal.id,
      },
    });
    // Orphaned source IDs must be removed too. No conversion or rate is needed.
    const usd = await prisma.cashRegister.create({
      data: {
        storeId: f.store.id,
        name: 'USD',
        currency: 'USD',
        method: 'EFECTIVO',
        balance: 75,
      },
    });
    for (const sourceType of [
      'client',
      'repair',
      'deposit',
      'return',
      'trade-in',
    ]) {
      await prisma.cashMovement.create({
        data: {
          storeId: f.store.id,
          registerId: usd.id,
          currency: 'USD',
          sourceType,
          sourceId: 'previously-deleted',
          amount: 10,
          kind: 'COBRO',
        },
      });
    }
    const manual = await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: 5,
        kind: 'INGRESO',
      },
    });
    const transfer = await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: usd.id,
        amount: 25,
        kind: 'TRANSFERENCIA',
        transferGroup: 'independent',
      },
    });
    await prisma.cashRegister.update({
      where: { id: f.register.id },
      data: { balance: 105 },
    });
    const out = await preview(f, { scope: 'full' });
    expect(out.willDelete.CashMovement).toBe(8);
    expect(
      (
        await post(
          body(f, { scope: 'full', dryRun: false, expect: out.willDelete }),
        )
      ).statusCode,
    ).toBe(200);
    expect(
      await prisma.cashMovement.findMany({
        where: { storeId: f.store.id },
        orderBy: { createdAt: 'asc' },
      }),
    ).toEqual([manual, transfer]);
    expect(
      Number(
        (
          await prisma.cashRegister.findUniqueOrThrow({
            where: { id: f.register.id },
          })
        ).balance,
      ),
    ).toBe(15);
    expect(
      Number(
        (await prisma.cashRegister.findUniqueOrThrow({ where: { id: usd.id } }))
          .balance,
      ),
    ).toBe(25);
  });

  it.each(['unassigned', 'legacy', 'currency-mismatch'])(
    'zeros ambiguous %s cash in full without historical rates',
    async (kind) => {
      const f = await fixture();
      const usd = await prisma.cashRegister.create({
        data: {
          storeId: f.store.id,
          name: 'USD',
          currency: 'USD',
          method: 'EFECTIVO',
          balance: 70,
        },
      });
      await prisma.cashMovement.create({
        data: {
          storeId: f.store.id,
          sourceType: kind === 'legacy' ? null : 'repair',
          sourceId: null,
          kind: 'COBRO',
          amount: 10,
          registerId: kind === 'currency-mismatch' ? f.register.id : null,
          currency: kind === 'legacy' ? null : 'USD',
          method: kind === 'legacy' ? null : 'EFECTIVO',
        },
      });
      const before = await snapshot();
      const out = await preview(f, { scope: 'full' });
      expect(await snapshot()).toEqual(before);
      expect(
        (
          await post(
            body(f, { scope: 'full', dryRun: false, expect: out.willDelete }),
          )
        ).statusCode,
      ).toBe(200);
      expect(
        Number(
          (
            await prisma.cashRegister.findUniqueOrThrow({
              where: { id: f.register.id },
            })
          ).balance,
        ),
      ).toBe(kind === 'unassigned' ? 10 : 0);
      expect(
        Number(
          (
            await prisma.cashRegister.findUniqueOrThrow({
              where: { id: usd.id },
            })
          ).balance,
        ),
      ).toBe(kind === 'currency-mismatch' ? 70 : 0);
    },
  );

  it('removes source-less cash reversals and keeps the net independent register balance', async () => {
    const f = await fixture();
    const original = await prisma.cashMovement.findFirstOrThrow({
      where: { storeId: f.store.id, sourceType: 'sale' },
    });
    await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: -90,
        kind: 'ANULACION',
        reversalOf: original.id,
      },
    });
    const manual = await prisma.cashMovement.create({
      data: {
        storeId: f.store.id,
        registerId: f.register.id,
        amount: 5,
        kind: 'INGRESO',
      },
    });
    await prisma.cashRegister.update({
      where: { id: f.register.id },
      data: { balance: 15 },
    });
    const out = await preview(f);
    expect(out.willDelete.CashMovement).toBe(2);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      Number(
        (
          await prisma.cashRegister.findUniqueOrThrow({
            where: { id: f.register.id },
          })
        ).balance,
      ),
    ).toBe(15);
    expect(
      await prisma.cashMovement.findMany({ where: { storeId: f.store.id } }),
    ).toEqual([manual]);
  });

  it('does not double-count price-rise ledger charges against a manual balance', async () => {
    const f = await fixture();
    await prisma.sale.update({
      where: { id: f.sale.id },
      data: { amount: 110, openBalance: 70 },
    });
    await prisma.client.update({
      where: { id: f.client.id },
      data: { pendingBalance: 95 },
    });
    await prisma.clientPayment.create({
      data: {
        storeId: f.store.id,
        clientId: f.client.id,
        saleId: f.sale.id,
        amount: 10,
        kind: 'CARGO',
        currency: 'ARS',
        method: 'AJUSTE',
        note: 'Diferencia por corrección de precio',
      },
    });
    const out = await preview(f);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      Number(
        (await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } }))
          .pendingBalance,
      ),
    ).toBe(25);
  });

  it('resets actual sales with installments and excess credit created through the public API', async () => {
    const context = await seedStoreContext();
    const catalog = await seedCatalogFixture(context.store!.id);
    const headers = buildAuthHeaders();
    const createSale = (payload: object) =>
      getApp().inject({
        method: 'POST',
        url: '/api/operations/sales',
        headers,
        payload,
      });
    const financed = await createSale({
      clientId: catalog.client.id,
      productId: catalog.inventoryItem.id,
      amount: 900,
      currency: 'ARS',
      paymentMethod: 'EFECTIVO',
      tenders: [{ amount: 300, currency: 'ARS', method: 'EFECTIVO' }],
      installments: {
        count: 3,
        frequency: 'MENSUAL',
        firstDueDate: '2026-11-14',
      },
    });
    expect(financed.statusCode, financed.body).toBe(201);
    const excess = await createSale({
      clientId: catalog.client.id,
      deviceLabel: 'Equipo sin stock',
      amount: 500,
      currency: 'ARS',
      exchangeRate: 1000,
      paymentMethod: 'EFECTIVO',
      tenders: [{ amount: 700, currency: 'ARS', method: 'EFECTIVO' }],
      excess: 'CREDIT',
    });
    expect(excess.statusCode, excess.body).toBe(201);
    const request = {
      storeEmail: context.user.email!,
      expectStoreName: context.store!.name,
      expectStoreId: context.store!.id,
      dryRun: true,
    };
    const before = await snapshot();
    const dry = await post(request);
    expect(dry.statusCode, dry.body).toBe(200);
    expect(dry.json().willDelete).toMatchObject({
      Sale: 2,
      InventoryItem: 1,
      SaleInstallment: 3,
      ClientDeposit: 1,
    });
    expect(await snapshot()).toEqual(before);
    const apply = await post({
      ...request,
      dryRun: false,
      expect: dry.json().willDelete,
    });
    expect(apply.statusCode, apply.body).toBe(200);
    const client = await prisma.client.findUniqueOrThrow({
      where: { id: catalog.client.id },
    });
    expect(Number(client.pendingBalance)).toBe(0);
    expect(Number(client.totalSpent)).toBe(0);
    const leftovers = await Promise.all([
      prisma.sale.count({ where: { storeId: context.store!.id } }),
      prisma.inventoryItem.count({ where: { storeId: context.store!.id } }),
      prisma.saleInstallment.count({ where: { storeId: context.store!.id } }),
      prisma.saleInstallmentPlan.count({
        where: { storeId: context.store!.id },
      }),
      prisma.saleTender.count({ where: { storeId: context.store!.id } }),
      prisma.clientPayment.count({ where: { storeId: context.store!.id } }),
      prisma.clientDeposit.count({ where: { storeId: context.store!.id } }),
    ]);
    expect(leftovers).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('removes legacy sale deposit ledger effects while preserving repair and receipt entries', async () => {
    const f = await fixture();
    for (const [kind, note] of [
      ['APLICACION', 'Seña aplicada a venta (sin nuevo cobro)'],
      ['CREDITO', 'Seña disponible por cancelación de venta (sin devolución)'],
    ]) {
      await prisma.clientPayment.create({
        data: {
          storeId: f.store.id,
          clientId: f.client.id,
          amount: 10,
          method: 'EFECTIVO',
          kind,
          note,
        },
      });
    }
    const kept = [];
    for (const [kind, note] of [
      ['SENA', 'Cobro de seña'],
      ['APLICACION', 'Seña aplicada a reparación (sin nuevo cobro)'],
    ]) {
      kept.push(
        await prisma.clientPayment.create({
          data: {
            storeId: f.store.id,
            clientId: f.client.id,
            amount: 10,
            method: 'EFECTIVO',
            kind,
            note,
          },
        }),
      );
    }
    const out = await preview(f);
    expect(out.willDelete.ClientPayment).toBe(3);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      await prisma.clientPayment.findMany({
        where: { storeId: f.store.id },
        orderBy: { createdAt: 'asc' },
      }),
    ).toEqual(kept);
  });

  it('removes cancellation credits, including structured references to already deleted sales', async () => {
    const f = await fixture();
    for (const saleId of [f.sale.id, 'previously-deleted-sale']) {
      await prisma.clientPayment.create({
        data: {
          storeId: f.store.id,
          clientId: f.client.id,
          saleId,
          amount: 2,
          kind: 'CREDITO',
          method: 'SALDO',
        },
      });
      await prisma.clientDeposit.create({
        data: {
          storeId: f.store.id,
          clientId: f.client.id,
          requestKey: `cancel-credit-${saleId}`,
          amount: 2,
          currency: 'ARS',
          exchangeRate: 1,
          usdAmount: 2,
          method: 'SALDO',
          status: 'CREDIT',
        },
      });
    }
    const out = await preview(f);
    expect(out.willDelete.ClientDeposit).toBe(3);
    expect(
      (await post(body(f, { dryRun: false, expect: out.willDelete })))
        .statusCode,
    ).toBe(200);
    expect(
      await prisma.clientDeposit.count({ where: { storeId: f.store.id } }),
    ).toBe(0);
  });

  it.each([
    { kind: 'cascade', scope: undefined },
    { kind: 'set-null', scope: undefined },
    { kind: 'cascade', scope: 'full' },
    { kind: 'set-null', scope: 'full' },
    { kind: 'client-cascade', scope: 'full' },
    { kind: 'repair-cascade', scope: 'full' },
  ])(
    'rolls back all effects on a cross-store $kind ($scope)',
    async ({ kind, scope }) => {
      const f = await fixture();
      const other = await fixture('two');
      const out = await preview(f, { scope });
      if (kind === 'cascade') {
        await prisma.saleTender.updateMany({
          where: { storeId: other.store.id },
          data: { saleId: f.sale.id },
        });
      } else if (kind === 'set-null') {
        await prisma.sale.update({
          where: { id: other.sale.id },
          data: { inventoryItemId: f.item.id },
        });
      } else if (kind === 'client-cascade') {
        await prisma.clientPayment.updateMany({
          where: { storeId: other.store.id },
          data: { clientId: f.client.id },
        });
      } else {
        await prisma.repairStatusEvent.updateMany({
          where: { storeId: other.store.id },
          data: { orderId: f.repair.id },
        });
      }
      const before = await snapshot();
      for (const payload of [
        body(f, { scope }),
        body(f, { scope, dryRun: false, expect: out.willDelete }),
      ]) {
        expect((await post(payload)).statusCode).toBe(409);
        expect(await snapshot()).toEqual(before);
      }
    },
  );

  it.each([undefined, 'full'])(
    'rolls back after a late failure to write the reset audit (%s)',
    async (scope) => {
      const f = await fixture();
      const out = await preview(f, { scope });
      const before = await snapshot();
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION reset_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'store.reset' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER reset_test_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reset_test_fail_audit()`,
      );
      try {
        const res = await post(
          body(f, { scope, dryRun: false, expect: out.willDelete }),
        );
        expect(res.statusCode, res.body).toBe(500);
        expect(await snapshot()).toEqual(before);
      } finally {
        await prisma.$executeRawUnsafe(
          `DROP TRIGGER reset_test_audit ON "AuditEvent"`,
        );
        await prisma.$executeRawUnsafe(`DROP FUNCTION reset_test_fail_audit()`);
      }
    },
  );

  it.each(['payment', 'deposit'])(
    'rejects an ambiguous %s shared with repairs without any changes',
    async (kind) => {
      const f = await fixture();
      if (kind === 'payment')
        await prisma.clientPayment.updateMany({
          where: { storeId: f.store.id, saleId: f.sale.id },
          data: { repairOrderId: f.repair.id },
        });
      else
        await prisma.clientDeposit.updateMany({
          where: { storeId: f.store.id, saleId: f.sale.id },
          data: { repairId: f.repair.id },
        });
      const before = await snapshot();
      expect((await post(body(f))).statusCode).toBe(409);
      expect(await snapshot()).toEqual(before);
    },
  );
});

type Row = { row: Record<string, unknown> };
async function seedIndependent(f: Fixture) {
  const storeId = f.store.id;
  const client = await prisma.client.create({
    data: {
      storeId,
      name: 'Cliente sin ventas',
      pendingBalance: 25,
      totalSpent: 80,
      importedSpent: 200,
    },
  });
  const deposit = await prisma.clientDeposit.create({
    data: {
      storeId,
      clientId: client.id,
      requestKey: 'independent',
      amount: 15,
      currency: 'ARS',
      exchangeRate: 1,
      usdAmount: 15,
      method: 'EFECTIVO',
      productId: f.item.id,
    },
  });
  await prisma.clientPayment.create({
    data: {
      storeId,
      clientId: f.client.id,
      repairOrderId: f.repair.id,
      amount: 7,
      method: 'EFECTIVO',
    },
  });
  await prisma.clientPayment.create({
    data: { storeId, clientId: client.id, amount: 3, method: 'EFECTIVO' },
  });
  await prisma.tradeIn.create({
    data: {
      storeId,
      deviceReceived: 'Borrador independiente',
      takeValue: 1,
      differencePaid: 0,
      status: 'PENDIENTE',
      dateLabel: '01/10',
      tradeAt: new Date(),
    },
  });
  const claim = await prisma.returnCase.create({
    data: {
      storeId,
      caseNumber: 2,
      clientId: client.id,
      reason: 'Independiente',
      openedAt: new Date(),
    },
  });
  await prisma.returnEvent.create({
    data: { storeId, caseId: claim.id, status: 'ABIERTO' },
  });
  const credit = await prisma.creditNote.create({
    data: {
      storeId,
      returnCaseId: claim.id,
      clientId: client.id,
      amount: 3,
      remaining: 1,
      currency: 'ARS',
    },
  });
  await prisma.creditNoteApplication.create({
    data: { storeId, creditNoteId: credit.id, amount: 2, currency: 'ARS' },
  });
  for (const source of [
    { sourceType: 'repair', sourceId: f.repair.id },
    { sourceType: 'deposit', sourceId: deposit.id },
    { sourceType: 'return', sourceId: claim.id },
    {},
  ]) {
    await prisma.cashMovement.create({
      data: { storeId, ...source, amount: 3, kind: 'COBRO' },
    });
  }
  const notice = await prisma.storeNotification.create({
    data: {
      storeId,
      section: 'repairs',
      title: 'Reparación',
      message: 'Conservar',
      kind: 'repair',
      recordId: f.repair.id,
    },
  });
  await prisma.notificationRead.create({
    data: { notificationId: notice.id, userId: f.user.id },
  });
  await prisma.sectionRecordView.create({
    data: {
      storeId,
      userId: f.user.id,
      section: 'repairs',
      recordId: f.repair.id,
      seenUpdatedAt: new Date(),
    },
  });
  return { deposit, client };
}
