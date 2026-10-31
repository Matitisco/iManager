import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from '../../test/db.js';
import { useIntegrationApp } from '../../test/integration-helpers.js';
import { createOperation } from '../operations/operations.service.js';
import { snapshot } from './inventory-duplicates.test-helpers.js';

const { getApp } = useIntegrationApp();
const previousAdminEmails = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAdminEmails;
});

// Same shape as the prod incident: one-unit amount stored for a multi-unit sale,
// product price = amount / quantity (pre-#688 behavior), 16 Pro cost saved as ARS.
const ROWS = [
  ['iPhone 14 Pro', '128GB', 350, 5, 405],
  ['iPhone 15 Pro', '128GB', 475, 5, 515],
  ['iPhone 16', '128GB', 520, 1, 560],
  ['iPhone 16 Pro', '128GB', 640, 5, 675],
  ['iPhone 16 Pro Max', '256GB', 740, 5, 770],
] as const;

async function fixture(status: 'COMPLETADA' | 'PENDIENTE' = 'COMPLETADA') {
  const { user, store } = await seedStoreContext();
  await prisma.store.update({ where: { id: store!.id }, data: { currency: 'USD' } });
  await prisma.cashRegister.create({ data: { storeId: store!.id, name: 'USD', currency: 'USD', method: 'EFECTIVO', balance: 0, isDefault: true } as never });
  const client = await prisma.client.create({ data: { storeId: store!.id, name: 'Cliente Ficticio' } as never });
  const actor = { userId: user.id, name: 'Owner' };
  for (const [model, capacity, cost, qty, amount] of ROWS) {
    const product = await prisma.inventoryItem.create({ data: { storeId: store!.id, model, capacity, color: '', condition: 'USADO', grade: '', batteryHealth: '', cost, price: null, currency: 'USD', cantidad: 10, status: 'DISPONIBLE' } as never });
    await createOperation(store!.id, 'sales', { productId: product.id, cantidad: qty, amount, currency: 'USD', clientId: client.id, paymentMethod: 'EFECTIVO', status } as never, actor);
  }
  await prisma.inventoryItem.updateMany({ where: { model: 'iPhone 16 Pro' }, data: { currency: 'ARS' } });
  return { store: store!, client };
}

const sale = (n: number, extra: object = {}) => {
  const [model, , cost, qty, amount] = ROWS[n - 1]!;
  return { saleNumber: n, expectModel: model, expectQuantity: qty, expectAmount: amount, expectStatus: 'COMPLETADA', ...extra, _cost: cost };
};
function body(over: Record<string, unknown> = {}, sales: Record<string, unknown>[] = [1, 2, 3, 4, 5].map(n => ({ ...sale(n), unitPrice: ROWS[n - 1]![4], collectDifference: true }))) {
  return { storeEmail: 'owner@example.com', expectStoreName: 'Test Store', expectStoreCurrency: 'USD', dryRun: false, sales: sales.map(({ _cost, ...s }) => s), ...over };
}
function post(payload: unknown, auth = buildAuthHeaders({ uid: 'platform-admin', email: 'admin@internal.test' })) {
  process.env.ADMIN_EMAILS = 'admin@internal.test';
  return getApp().inject({ method: 'POST', url: '/admin/sale-corrections', headers: auth, payload: payload as object });
}
const amounts = async () => (await prisma.sale.findMany({ orderBy: { saleNumber: 'asc' }, select: { amount: true, status: true, openBalance: true, cantidad: true } })).map(s => ({ ...s, amount: Number(s.amount), openBalance: s.openBalance == null ? null : Number(s.openBalance) }));
const stock = async () => (await prisma.inventoryItem.findMany({ orderBy: { model: 'asc' }, select: { model: true, cantidad: true, status: true } }));

describe('POST /admin/sale-corrections', () => {
  it('reproduces the bad state', async () => {
    await fixture();
    expect((await amounts()).map(s => s.amount)).toEqual([405, 515, 560, 675, 770]);
    const prices = await prisma.inventoryItem.findMany({ select: { model: true, price: true } });
    expect(Object.fromEntries(prices.map(p => [p.model, Number(p.price)]))).toEqual({ 'iPhone 14 Pro': 81, 'iPhone 15 Pro': 103, 'iPhone 16': 560, 'iPhone 16 Pro': 135, 'iPhone 16 Pro Max': 154 });
  });

  it('interpretation A (values are unit prices): totals, profit, stock, ledger', async () => {
    const { client } = await fixture();
    const stockBefore = await stock();
    const res = await post(body());
    expect(res.statusCode, res.body).toBe(200);
    const out = res.json();
    expect(out.sales.map((s: { amount: { after: number } }) => s.amount.after)).toEqual([2025, 2575, 560, 3375, 3850]);
    expect(await amounts()).toEqual([2025, 2575, 560, 3375, 3850].map((amount, i) => ({ amount, status: 'COMPLETADA', openBalance: i === 2 ? null : 0, cantidad: ROWS[i]![3] })));
    expect(await stock()).toEqual(stockBefore);
    const c = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(c.totalSpent)).toBe(2025 + 2575 + 560 + 3375 + 3850);
    expect(Number(c.pendingBalance)).toBe(0);
    const cash = await prisma.cashMovement.aggregate({ _sum: { amount: true } });
    expect(Number(cash._sum.amount)).toBe(2025 + 2575 + 560 + 3375 + 3850); // every dollar collected is on the register
    const paid = await prisma.clientPayment.findMany();
    const net = paid.reduce((sum, p) => sum + (p.kind === 'PAGO' ? Number(p.amount) : -Number(p.amount)), 0);
    expect(net).toBe(405 + 515 + 560 + 675 + 770); // each CARGO for the difference is matched by its PAGO
    expect(out.sales[0].profit).toEqual(expect.objectContaining({ before: 405 - 350 * 5, after: 2025 - 350 * 5 }));
  });

  it('dry run is exactly the apply plan and writes nothing', async () => {
    await fixture();
    const before = await snapshot();
    const dry = await post(body({ dryRun: true }));
    expect(dry.statusCode, dry.body).toBe(200);
    expect(dry.json().applied).toBe(false);
    expect(await snapshot()).toEqual(before);
    const real = await post(body());
    expect(real.json().sales).toEqual(dry.json().sales);
  });

  it('interpretation B (values were already totals): only the product fixes apply', async () => {
    await fixture();
    const products = { expectPrice: null, expectCost: 640, expectCurrency: 'ARS', cost: 640, currency: 'USD' };
    const res = await post(body({}, [{ ...sale(4), product: { ...products, expectPrice: 135 } }]));
    expect(res.statusCode, res.body).toBe(200);
    expect(await amounts()).toEqual([405, 515, 560, 675, 770].map((amount, i) => expect.objectContaining({ amount, status: 'COMPLETADA', cantidad: ROWS[i]![3] })));
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { model: 'iPhone 16 Pro' } });
    expect(item.currency).toBe('USD');
    expect(Number(item.cost)).toBe(640);
  });

  it('collectDifference=false leaves the difference as client debt', async () => {
    const { client } = await fixture();
    const res = await post(body({}, [{ ...sale(1), newTotal: 2025, collectDifference: false }]));
    expect(res.statusCode, res.body).toBe(200);
    const s = (await amounts())[0]!;
    expect(s).toEqual(expect.objectContaining({ amount: 2025, status: 'PENDIENTE', openBalance: 1620 }));
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).pendingBalance)).toBe(1620);
    expect(Number((await prisma.cashMovement.aggregate({ _sum: { amount: true } }))._sum.amount)).toBe(405 + 515 + 560 + 675 + 770);
  });

  it('pending sales (as in production): unit prices become totals, all of it stays as client debt, no cash', async () => {
    const { client } = await fixture('PENDIENTE');
    const stockBefore = await stock();
    const payload = body({}, [1, 2, 3, 4, 5].map(n => ({ ...sale(n, { expectStatus: 'PENDIENTE' }), unitPrice: ROWS[n - 1]![4], collectDifference: false })));
    const dry = await post({ ...payload, dryRun: true });
    expect(dry.statusCode, dry.body).toBe(200);
    expect((await amounts()).map(s => s.amount)).toEqual([405, 515, 560, 675, 770]);
    const res = await post(payload);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().sales).toEqual(dry.json().sales);
    const total = 2025 + 2575 + 560 + 3375 + 3850;
    expect(await amounts()).toEqual([2025, 2575, 560, 3375, 3850].map((amount, i) => ({ amount, status: 'PENDIENTE', openBalance: null, cantidad: ROWS[i]![3] })));
    expect(await stock()).toEqual(stockBefore);
    const c = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(c.totalSpent)).toBe(total);
    expect(Number(c.pendingBalance)).toBe(total);
    expect(Number((await prisma.cashMovement.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0)).toBe(0);
  });

  it('product price, cost and currency changes are audited', async () => {
    await fixture();
    const res = await post(body({}, [{ ...sale(2), product: { expectPrice: 103, expectCost: 475, expectCurrency: 'USD', price: 515, cost: 470 } }]));
    expect(res.statusCode, res.body).toBe(200);
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { model: 'iPhone 15 Pro' } });
    expect([Number(item.price), Number(item.cost)]).toEqual([515, 470]);
    expect(item.priceChangedBy).toContain('admin@internal.test');
    expect(await prisma.auditEvent.count({ where: { action: { in: ['inventory.price', 'inventory.cost'] } } })).toBe(2);
  });

  it.each([
    ['wrong current amount', (b: any) => { b.sales[0].expectAmount = 406; }, 409],
    ['wrong quantity', (b: any) => { b.sales[1].expectQuantity = 4; }, 409],
    ['wrong store name', (b: any) => { b.expectStoreName = 'Otra'; }, 409],
    ['wrong store currency', (b: any) => { b.expectStoreCurrency = 'ARS'; }, 409],
    ['wrong model', (b: any) => { b.sales[2].expectModel = 'iPhone 99'; }, 409],
    ['unknown sale', (b: any) => { b.sales[0].saleNumber = 99; }, 409],
    ['decrease', (b: any) => { b.sales[0].unitPrice = 10; }, 409],
    ['both newTotal and unitPrice', (b: any) => { b.sales[0].newTotal = 2025; }, 400],
    ['missing collectDifference', (b: any) => { delete b.sales[0].collectDifference; }, 400],
    ['stale product guard', (b: any) => { b.sales[0].product = { expectPrice: 1, expectCost: 350, expectCurrency: 'USD', price: 2 }; }, 409],
    ['unknown field', (b: any) => { b.extra = true; }, 400],
  ])('rejects %s without writing', async (_name, mutate, status) => {
    await fixture();
    const payload = body();
    mutate(payload);
    const before = await snapshot();
    const res = await post(payload);
    expect(res.statusCode, res.body).toBe(status);
    expect(await snapshot()).toEqual(before);
  });

  it('a late failure rolls back every earlier sale', async () => {
    await fixture();
    const payload = body();
    // Sale 5 fails inside the transaction only after sales 1-4 were already edited.
    await prisma.sale.updateMany({ where: { saleNumber: 5 }, data: { status: 'CANCELADA' } });
    const before = await snapshot();
    const res = await post(payload);
    expect(res.statusCode, res.body).toBe(409);
    expect(await snapshot()).toEqual(before);
  });

  it('requires a platform admin', async () => {
    await fixture();
    const before = await snapshot();
    const res = await post(body(), buildAuthHeaders({ uid: 'someone', email: 'someone@else.test' }));
    expect(res.statusCode).toBe(403);
    expect(await snapshot()).toEqual(before);
  });
});
