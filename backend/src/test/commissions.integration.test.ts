import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";
import { createSale, deleteSale, importSales } from "../modules/sales/sales.service.js";
import { currentPeriodKey, nextPeriod } from "../modules/commissions/commission-math.js";
import { voidSaleCommission } from "../modules/commissions/commission-ledger.js";
import { withSerializableRetry } from "../lib/with-serializable-retry.js";

const PERIOD = "2026-01";
const { getApp } = useIntegrationApp();
const ownerHeaders = () => buildAuthHeaders();

async function fixture() {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  const user = await prisma.user.create({ data: { firebaseUid: "seller", displayName: "Vendedor", email: "seller@test.com" } });
  const member = await prisma.storeMember.create({ data: { storeId, userId: user.id, role: "STAFF", isDefault: true } });
  const headers = buildAuthHeaders({ uid: "seller", email: user.email! });
  return { ...context, storeId, member, headers };
}
async function rule(memberId: string | null = null, rate = 10, effectiveFrom = "2025-01-01T00:00:00Z", basis = "SALE_PERCENT", currency?: string) {
  const response = await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: ownerHeaders(), payload: { memberId, rate, effectiveFrom, basis, ...(currency ? { currency } : {}) } });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().rule;
}
async function sell(memberId?: string | null, extra: Record<string, unknown> = {}) {
  const response = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers: ownerHeaders(), payload: {
    date: "15/01/2026", deviceLabel: "iPhone", amount: 1000, currency: "ARS", exchangeRate: 1200,
    ...(memberId !== undefined ? { sellerMemberId: memberId } : {}), ...extra,
  } });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().sale;
}
async function detail(memberId: string, period = PERIOD, headers = ownerHeaders()) {
  const response = await getApp().inject({ url: `/api/commissions/members/${memberId}?period=${period}`, headers });
  expect(response.statusCode, response.body).toBe(200);
  return response.json().person;
}
async function pay(memberId: string, extra: Record<string, unknown> = {}) {
  const response = await getApp().inject({ method: "POST", url: "/api/commissions/payments", headers: ownerHeaders(), payload: {
    memberId, period: PERIOD, amount: 40, currency: "ARS", exchangeRate: 1250, settlesCurrency: "ARS", ...extra,
  } });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().payment;
}

describe("commissions API (adapted from #122)", () => {
  it("lets staff select a seller using only the current store's minimal directory", async () => {
    const f = await fixture();
    const other = await prisma.store.create({ data: { name: "Otra tienda" } });
    await prisma.storeMember.create({ data: { storeId: other.id, userId: f.user.id, role: "OWNER" } });
    const response = await getApp().inject({ url: "/api/commissions/sellers", headers: f.headers });
    expect(response.statusCode, response.body).toBe(200);
    const quote = await getApp().inject({ url: "/api/commissions/exchange-rate", headers: f.headers });
    expect(quote.statusCode).toBe(200);
    expect(quote.json()).toEqual({ exchangeRate: 1000 });
    const sellers = response.json().sellers;
    expect(sellers).toEqual(expect.arrayContaining([{ id: f.member.id, name: "Vendedor", role: "STAFF" }]));
    expect(sellers).toHaveLength(2);
    expect(Object.keys(sellers[0]).sort()).toEqual(["id", "name", "role"]);
  });
  it("stores current registrator and quote without defaulting a seller, including /sales", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell();
    expect(sale).toMatchObject({ sellerMemberId: null, registeredByUserId: f.user.id, exchangeRate: 1200 });
    const response = await getApp().inject({ method: "POST", url: "/api/sales", headers: ownerHeaders(), payload: {
      date: "16/01/2026", deviceLabel: "Otro", amount: 200, amountCurrency: "USD", paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ sellerMemberId: null, registeredByUserId: f.user.id, exchangeRate: 1000, amountCurrency: "USD" });
    const summary = await getApp().inject({ url: `/api/commissions?period=${PERIOD}`, headers: ownerHeaders() });
    expect(summary.json().summary).toMatchObject({ unassignedSalesCount: 2, earned: { ARS: 0, USD: 0 } });
  });
  it("calculates profit with trade-in, converts device cost to sale currency, defaults the rule basis", async () => {
    const f = await fixture();
    const stock = await seedCatalogFixture(f.storeId);
    await prisma.inventoryItem.update({ where: { id: stock.inventoryItem.id }, data: { cost: 600000, currency: "ARS" } });
    const response = await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: ownerHeaders(), payload: { rate: 10, effectiveFrom: "2025-01-01T00:00:00Z" } });
    expect(response.statusCode).toBe(201);
    expect(response.json().rule.basis).toBe("PROFIT_PERCENT");
    await sell(f.member.id, { amount: 1000, currency: "USD", productId: stock.inventoryItem.id, clientId: stock.client.id, tradeIn: { deviceReceived: "iPhone viejo", takeValue: 200 } });
    const person = await detail(f.member.id);
    expect(person.earned).toEqual({ ARS: 0, USD: 30 });
    expect(person.sales[0]).toMatchObject({ cost: 500, takeValue: 200, grossProfit: 300, commission: 30 });
    expect(person.converted.earned.ARS).toBe(36000);
  });
  it("picks personal over team with effectiveFrom, freezes history after rule CRUD", async () => {
    const f = await fixture();
    const team = await rule();
    const personal = await rule(f.member.id, 20, "2026-01-15T03:00:00Z");
    await rule(f.member.id, 50, "2026-02-01T03:00:00Z");
    await sell(f.member.id, { date: "14/01/2026" });
    const sale = await sell(f.member.id);
    expect((await detail(f.member.id)).earned.ARS).toBe(300);
    const patch = await getApp().inject({ method: "PATCH", url: `/api/commissions/rules/${personal.id}`, headers: ownerHeaders(), payload: {
      memberId: f.member.id, rate: 99, basis: "SALE_PERCENT", effectiveFrom: "2026-01-15T03:00:00Z",
    } });
    expect(patch.statusCode).toBe(200);
    expect((await detail(f.member.id)).earned.ARS).toBe(300);
    expect((await getApp().inject({ method: "DELETE", url: `/api/commissions/rules/${team.id}`, headers: ownerHeaders() })).statusCode).toBe(204);
    expect((await detail(f.member.id)).earned.ARS).toBe(300);
    await getApp().inject({ method: "PATCH", url: `/api/operations/sales/sales/${sale.id}`, headers: ownerHeaders(), payload: { paymentMethod: "TRANSFERENCIA" } });
    expect((await detail(f.member.id)).earned.ARS).toBe(300);
  });
  it("converts fixed-per-unit rule currency using each sale's quote", async () => {
    const f = await fixture();
    await rule(null, 12000, "2025-01-01T00:00:00Z", "FIXED_PER_UNIT", "ARS");
    await sell(f.member.id, { currency: "USD", exchangeRate: 1200 });
    await sell(f.member.id, { currency: "USD", exchangeRate: 1500 });
    expect((await detail(f.member.id)).earned).toEqual({ ARS: 0, USD: 18 });
  });
  it("keeps multiple partial payments and carries balances separately by currency", async () => {
    const f = await fixture();
    await rule();
    await sell(f.member.id);
    await sell(f.member.id, { currency: "USD" });
    await pay(f.member.id);
    await pay(f.member.id, { amount: 10 });
    const person = await detail(f.member.id);
    expect(person.payments).toHaveLength(2);
    expect(person.pending).toEqual({ ARS: 50, USD: 100 });
    const next = await detail(f.member.id, "2026-02");
    expect(next.previousBalance).toEqual(person.pending);
    expect(next.carry).toEqual(person.pending);
    const list = await getApp().inject({ url: `/api/commissions/payments?period=${PERIOD}&memberId=${f.member.id}`, headers: ownerHeaders() });
    expect(list.json().payments).toHaveLength(2);
  });
  it("settles ARS debt with USD, and USD debt with ARS at the payment quote", async () => {
    const f = await fixture();
    await rule();
    await sell(f.member.id, { amount: 250000 });
    await sell(f.member.id, { currency: "USD" });
    const payment = await pay(f.member.id, { amount: 10, currency: "USD", settlesCurrency: "ARS", exchangeRate: 1250 });
    expect(payment.settledAmount).toBe(12500);
    await pay(f.member.id, { amount: 25000, currency: "ARS", settlesCurrency: "USD", exchangeRate: 1250 });
    expect((await detail(f.member.id)).pending).toEqual({ ARS: 12500, USD: 80 });
  });
  it.each(["cancel", "delete"])("creates one negative next-month adjustment after paid %s", async action => {
    const f = await fixture();
    await rule();
    const sale = await sell(f.member.id);
    await pay(f.member.id, { amount: 100 });
    const cancelled = await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    if (action === "delete") {
      const deleted = await getApp().inject({ method: "DELETE", url: `/api/sales/${sale.id}`, headers: ownerHeaders() });
      expect(deleted.statusCode, deleted.body).toBe(204);
      expect((await prisma.sale.findUnique({ where: { id: sale.id } }))?.voidedAt).toBeTruthy();
    } else await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    const original = await detail(f.member.id);
    expect(original.sales[0]).toMatchObject({ cancelled: true, commission: 0 });
    const next = await detail(f.member.id, nextPeriod(currentPeriodKey()));
    expect(next.adjustments).toHaveLength(1);
    expect(next.adjustments[0]).toMatchObject({ amount: -100, currency: "ARS", label: "A descontar" });
    expect(next.pending.ARS).toBe(-100);
    expect((await detail(f.member.id, nextPeriod(nextPeriod(currentPeriodKey())))).carry.ARS).toBe(-100);
  });
  it("physically deletes a paid legacy sale, retaining a tombstone and adjustment", async () => {
    const f = await fixture();
    await rule();
    const sale = await createSale(f.storeId, { date: "15/01/2026", deviceLabel: "Histórica", amount: 1000, amountCurrency: "USD", paymentMethod: "EFECTIVO", status: "COMPLETADA", sellerMemberId: f.member.id }, { userId: f.user.id, name: "Dueño" });
    await pay(f.member.id, { currency: "USD", settlesCurrency: "USD", amount: 40 });
    await deleteSale(f.storeId, sale.id, { userId: f.user.id, name: "Dueño" });
    expect((await detail(f.member.id, nextPeriod(currentPeriodKey()))).pending.USD).toBe(-40);
  });
  it.each(["ARS", "USD"])("partial settlement, cancel and hard delete preserve only the paid %s deduction in every projection", async currency => {
    const f = await fixture();
    await rule(f.member.id, 20, "2025-01-01T00:00:00Z", "FIXED_PER_UNIT", currency);
    const sale = await sell(f.member.id, { currency });
    const payment = await pay(f.member.id, { amount: currency === "USD" ? 15500 : 10, currency: "ARS", settlesCurrency: currency, exchangeRate: 1550 });
    expect(payment.settledAmount).toBe(10);
    expect((await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() })).statusCode).toBe(200);
    const cancelled = await detail(f.member.id);
    expect(cancelled.earned[currency]).toBe(0);
    expect(cancelled.paid[currency]).toBe(10);
    expect(cancelled.pending[currency]).toBe(-10);
    expect(cancelled.salesCount).toBe(0);
    const snapshot = await prisma.commissionAccrual.findFirstOrThrow({ where: { sourceSaleId: sale.id } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/sales/${sale.id}`, headers: ownerHeaders() })).statusCode).toBe(204);
    expect((await prisma.sale.findUnique({ where: { id: sale.id } }))?.voidedAt).toBeTruthy();
    expect((await detail(f.member.id)).sales[0]).toMatchObject({ commission: 0, originalCommission: 20, voidReason: "DELETED" });
    const next = await detail(f.member.id, snapshot.adjustmentPeriod!);
    expect(next.adjustments).toEqual([expect.objectContaining({ saleNumber: sale.saleNumber, amount: -10, currency, label: "A descontar", reason: "DELETED" })]);
    expect(next.previousBalance[currency]).toBe(0);
    expect(next.pending[currency]).toBe(-10);
    expect((await detail(f.member.id, nextPeriod(snapshot.adjustmentPeriod!))).pending[currency]).toBe(-10);
    const summary = await getApp().inject({ url: `/api/commissions?period=${PERIOD}`, headers: ownerHeaders() });
    expect(summary.json().summary.earned[currency]).toBe(0);
    expect(summary.json().summary.pending[currency]).toBe(-10);
    const report = await getApp().inject({ url: `/api/reports/commissions?from=${PERIOD}&to=${snapshot.adjustmentPeriod}`, headers: ownerHeaders() });
    expect(report.statusCode).toBe(200);
    const reportRows = report.json().rows.filter((row: { memberId: string }) => row.memberId === f.member.id);
    expect(reportRows[0]).toMatchObject({ salesCount: 0, earned: { ARS: 0, USD: 0 }, pending: { [currency]: -10 } });
    expect(reportRows.at(-1)).toMatchObject({ adjustmentsTotal: { [currency]: -10 }, pending: { [currency]: -10 } });
    const voided = await getApp().inject({ method: "POST", url: `/api/commissions/payments/${payment.id}/void`, headers: ownerHeaders(), payload: { reason: "Duplicado" } });
    expect(voided.statusCode).toBe(200);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: payment.id, action: "commission.payment.voided" } })).toMatchObject({ reason: "Duplicado" });
    expect(voided.json().payment).toMatchObject({ voidedAt: expect.any(String), voidedBy: f.user.id });
    const afterVoid = await detail(f.member.id, snapshot.adjustmentPeriod!);
    expect(afterVoid.pending[currency]).toBe(0);
    expect(afterVoid.adjustments).toEqual([]);
    const original = await detail(f.member.id);
    expect(original.paid[currency]).toBe(0);
    expect(original.payments[0].voidedAt).toBeTruthy();
    await getApp().inject({ method: "POST", url: `/api/commissions/payments/${payment.id}/void`, headers: ownerHeaders() });
    expect(await prisma.auditEvent.count({ where: { entityId: payment.id, action: "commission.payment.voided" } })).toBe(1);
  });
  it("does not allocate payments from another currency or payments made after cancellation to a cancelled sale", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell(f.member.id, { currency: "USD" });
    await sell(f.member.id, { currency: "ARS" });
    await pay(f.member.id, { amount: 40 });
    await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    await pay(f.member.id, { amount: 10, currency: "USD", settlesCurrency: "USD" });
    const next = await detail(f.member.id, nextPeriod(currentPeriodKey()));
    expect(next.adjustments).toEqual([]);
    expect(next.pending).toEqual({ ARS: 60, USD: -10 });
  });
  it("allocates multiple partial payments once across multiple cancelled sales", async () => {
    const f = await fixture();
    await rule();
    const a = await sell(f.member.id, { date: "14/01/2026" });
    const b = await sell(f.member.id);
    await pay(f.member.id, { amount: 120 });
    await pay(f.member.id, { amount: 20 });
    for (const sale of [a, b]) await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    const next = await detail(f.member.id, nextPeriod(currentPeriodKey()));
    expect(next.adjustments.map((row: { amount: number }) => row.amount).sort((a: number, b: number) => a - b)).toEqual([-100, -40]);
    expect(next.pending.ARS).toBe(-140);
    expect(next.adjustmentsTotal.ARS).toBe(-140);
  });
  it("rule activation and logical deletion affect new sales without recalculating paid history", async () => {
    const f = await fixture();
    const saved = await rule();
    await sell(f.member.id);
    await pay(f.member.id);
    const patch = async (active: boolean) => getApp().inject({ method: "PATCH", url: `/api/commissions/rules/${saved.id}`, headers: ownerHeaders(), payload: { active } });
    expect((await patch(false)).json().rule.active).toBe(false);
    await sell(f.member.id);
    expect((await detail(f.member.id)).earned.ARS).toBe(100);
    expect((await patch(true)).json().rule.active).toBe(true);
    await sell(f.member.id);
    expect((await detail(f.member.id)).earned.ARS).toBe(200);
    expect((await getApp().inject({ method: "DELETE", url: `/api/commissions/rules/${saved.id}`, headers: ownerHeaders() })).statusCode).toBe(204);
    await sell(f.member.id);
    const person = await detail(f.member.id);
    expect(person.earned.ARS).toBe(200);
    expect(person.paid.ARS).toBe(40);
    expect((await getApp().inject({ url: "/api/commissions/rules", headers: ownerHeaders() })).json().rules).toEqual([]);
    expect((await prisma.commissionRule.findUniqueOrThrow({ where: { id: saved.id } })).deletedAt).not.toBeNull();
    const events = await prisma.auditEvent.findMany({ where: { entityId: saved.id } });
    expect(events.map(event => event.action)).toEqual(expect.arrayContaining(["commission.rule.deactivated", "commission.rule.activated", "commission.rule.deleted"]));
  });
  it.each(["STAFF", "MANAGER"] as const)("requires commissions permission for %s rule mutations and voids, independently of sensitive access", async role => {
    const f = await fixture();
    const saved = await rule();
    const payment = await pay(f.member.id);
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { role, sensitiveAccess: true } });
    for (const request of [
      { method: "PATCH" as const, url: `/api/commissions/rules/${saved.id}`, payload: { active: false } },
      { method: "DELETE" as const, url: `/api/commissions/rules/${saved.id}` },
      { method: "POST" as const, url: `/api/commissions/payments/${payment.id}/void` },
    ]) expect((await getApp().inject({ ...request, headers: f.headers })).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { sections: ["commissions"], sensitiveAccess: false } });
    expect((await getApp().inject({ method: "PATCH", url: `/api/commissions/rules/${saved.id}`, headers: f.headers, payload: { active: false } })).statusCode).toBe(200);
    expect((await getApp().inject({ method: "POST", url: `/api/commissions/payments/${payment.id}/void`, headers: f.headers })).statusCode).toBe(200);
    expect((await getApp().inject({ method: "DELETE", url: `/api/commissions/rules/${saved.id}`, headers: f.headers, payload: { reason: "Error de carga" } })).statusCode).toBe(204);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: saved.id, action: "commission.rule.deleted" } })).toMatchObject({ reason: "Error de carga" });
    const foreign = await seedStoreContext({ firebaseUid: "foreign-owner", email: "foreign@example.com" });
    const foreignRule = await prisma.commissionRule.create({ data: { storeId: foreign.store!.id, rate: 10, effectiveFrom: new Date(), createdBy: foreign.user.id } });
    const foreignPayment = await prisma.commissionPayment.create({ data: { storeId: foreign.store!.id, memberId: foreign.membership!.id, period: PERIOD, amount: 10, currency: "ARS", settlesCurrency: "ARS", exchangeRate: 1000, createdBy: foreign.user.id } });
    expect((await getApp().inject({ method: "PATCH", url: `/api/commissions/rules/${foreignRule.id}`, headers: f.headers, payload: { active: false } })).statusCode).toBe(404);
    expect((await getApp().inject({ method: "DELETE", url: `/api/commissions/rules/${foreignRule.id}`, headers: f.headers })).statusCode).toBe(404);
    expect((await getApp().inject({ method: "POST", url: `/api/commissions/payments/${foreignPayment.id}/void`, headers: f.headers })).statusCode).toBe(404);
    expect(await prisma.auditEvent.count({ where: { storeId: foreign.store!.id } })).toBe(0);
  });
  it("finds and sells unarchived inventory without Estado, while excluding reserved and archived devices", async () => {
    const f = await fixture();
    const stock = await seedCatalogFixture(f.storeId);
    await prisma.inventoryItem.createMany({ data: ["RESERVADO", ""].map((status, index) => ({
      storeId: f.storeId, model: "No elegible", capacity: "128GB", color: "Negro", condition: "USADO",
      grade: "A", batteryHealth: "90%", cost: 10, price: 20, status, archivedAt: index ? new Date() : null,
    })) });
    await prisma.inventoryItem.update({ where: { id: stock.inventoryItem.id }, data: { status: "" } });
    const options = await getApp().inject({ url: "/api/operations/sales/options", headers: ownerHeaders() });
    expect(options.statusCode).toBe(200);
    expect(options.json().products.map((product: { id: string }) => product.id)).toEqual([stock.inventoryItem.id]);
    await sell(null, { productId: stock.inventoryItem.id });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stock.inventoryItem.id } })).status).toBe("VENDIDO");
    expect((await getApp().inject({ url: "/api/operations/sales/options", headers: ownerHeaders() })).json().products).toEqual([]);
  });
  it("unpaid cancellations earn zero and do not produce a paid adjustment", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell(f.member.id);
    await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    const person = await detail(f.member.id);
    expect(person.earned.ARS).toBe(0);
    expect(person.sales[0]).toMatchObject({ cancelled: true, commission: 0 });
    expect((await detail(f.member.id, nextPeriod(currentPeriodKey()))).adjustments).toEqual([]);
  });
  it("handles paid trade-operation cancellation, including partial payment", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell(f.member.id, { clientName: "Cliente", tradeIn: { deviceReceived: "Anterior", takeValue: 100 } });
    await pay(f.member.id);
    const response = await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: ownerHeaders() });
    expect(response.statusCode, response.body).toBe(200);
    expect((await detail(f.member.id, nextPeriod(currentPeriodKey()))).pending.ARS).toBe(-40);
  });
  it.each(["STAFF", "MANAGER"] as const)("denies null-sections %s access to management and bulk assignment", async role => {
    const f = await fixture();
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { role } });
    const sale = await sell();
    for (const url of ["/api/commissions", "/api/commissions/rules", "/api/commissions/payments", `/api/commissions/members/${f.membership!.id}`, "/api/reports/commissions?from=2026-01&to=2026-01"]) {
      expect((await getApp().inject({ url, headers: f.headers })).statusCode).toBe(403);
    }
    expect((await getApp().inject({ method: "PATCH", url: "/api/commissions/sales/seller", headers: f.headers, payload: { saleIds: [sale.id], sellerMemberId: f.member.id } })).statusCode).toBe(403);
    expect((await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: f.headers, payload: {} })).statusCode).toBe(403);
    expect((await getApp().inject({ method: "POST", url: "/api/commissions/payments", headers: f.headers, payload: {} })).statusCode).toBe(403);
  });
  it("mine is restricted to the current member and always omits financial fields", async () => {
    const f = await fixture();
    await rule(null, 10, "2025-01-01T00:00:00Z", "PROFIT_PERCENT");
    await sell(f.member.id);
    await sell(f.membership!.id, { deviceLabel: "Privada" });
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { sections: ["commissions", "reports"] } });
    const mine = await getApp().inject({ url: `/api/commissions/mine?period=${PERIOD}`, headers: f.headers });
    expect(mine.statusCode, mine.body).toBe(200);
    expect(mine.json().person.memberId).toBe(f.member.id);
    expect(mine.json().person.sales).toHaveLength(1);
    expect(mine.body).not.toMatch(/"(?:cost|grossProfit|takeValue)"/);
    expect(mine.body).not.toContain("Privada");
    const ownerMine = await getApp().inject({ url: `/api/commissions/mine?period=${PERIOD}`, headers: ownerHeaders() });
    expect(ownerMine.body).not.toMatch(/"(?:cost|grossProfit|takeValue)"/);
    expect((await getApp().inject({ url: `/api/commissions/mine?memberId=${f.membership!.id}`, headers: f.headers })).statusCode).toBe(400);
  });
  it("requires Reportes as well for financial detail and commissions report", async () => {
    const f = await fixture();
    await rule();
    await sell(f.member.id);
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { sections: ["commissions"] } });
    const hidden = await detail(f.member.id, PERIOD, f.headers);
    expect(hidden.sales[0]).not.toHaveProperty("grossProfit");
    expect(hidden.sales[0]).not.toHaveProperty("cost");
    const reportUrl = "/api/reports/commissions?from=2026-01&to=2026-02";
    expect((await getApp().inject({ url: reportUrl, headers: f.headers })).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { sections: ["commissions", "reports"] } });
    expect((await detail(f.member.id, PERIOD, f.headers)).sales[0].grossProfit).toBe(1000);
    const report = await getApp().inject({ url: reportUrl, headers: f.headers });
    expect(report.statusCode, report.body).toBe(200);
    expect(report.json().rows.find((row: { memberId: string; period: string }) => row.memberId === f.member.id && row.period === PERIOD).earned.ARS).toBe(100);
  });
  it("bulk-assigns explicitly, supports null, audits changes and rejects cross-store IDs atomically", async () => {
    const f = await fixture();
    await rule();
    const a = await sell();
    const b = await sell();
    const assign = (saleIds: string[], sellerMemberId: string | null) => getApp().inject({ method: "PATCH", url: "/api/commissions/sales/seller", headers: ownerHeaders(), payload: { saleIds, sellerMemberId } });
    expect((await assign([a.id, b.id], f.member.id)).json()).toEqual({ updated: 2 });
    expect((await detail(f.member.id)).earned.ARS).toBe(200);
    expect(await prisma.auditEvent.count({ where: { storeId: f.storeId, action: "sale.seller.changed" } })).toBe(2);
    expect((await assign([a.id, "foreign"], null)).statusCode).toBe(404);
    expect((await detail(f.member.id)).earned.ARS).toBe(200);
    expect((await assign([a.id, b.id], null)).statusCode).toBe(200);
    expect((await detail(f.member.id)).earned.ARS).toBe(0);
    expect((await assign([a.id], "foreign")).statusCode).toBe(404);
  });
  it("updates seller only when sent and retains original registrator", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell();
    const patch = (payload: Record<string, unknown>) => getApp().inject({ method: "PATCH", url: `/api/sales/${sale.id}`, headers: ownerHeaders(), payload });
    expect((await patch({ sellerMemberId: f.member.id })).json().sale).toMatchObject({ sellerMemberId: f.member.id, registeredByUserId: f.user.id });
    expect((await patch({ paymentMethod: "TRANSFERENCIA" })).json().sale.sellerMemberId).toBe(f.member.id);
    expect((await patch({ sellerMemberId: null })).json().sale.sellerMemberId).toBeNull();
    expect((await detail(f.member.id)).earned.ARS).toBe(0);
  });
  it("imports explicit member/name sellers, leaves missing sellers null and records registrator/quote", async () => {
    const f = await fixture();
    await rule();
    const response = await getApp().inject({ method: "POST", url: "/api/sales/import", headers: ownerHeaders(), payload: { rows: [
      { date: "15/01/2026", device: "A", amount: "1000" },
      { date: "15/01/2026", device: "B", amount: "1000", sellerMemberId: f.member.id, exchangeRate: 1400 },
      { date: "15/01/2026", device: "C", amount: "1000", seller: "Vendedor" },
    ] } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().imported).toBe(3);
    const rows = await prisma.sale.findMany({ where: { storeId: f.storeId }, orderBy: { saleNumber: "asc" } });
    expect(rows.map(row => row.sellerMemberId)).toEqual([null, f.member.id, f.member.id]);
    expect(rows.every(row => row.registeredByUserId === f.user.id)).toBe(true);
    expect(Number(rows[1].exchangeRate)).toBe(1400);
    expect((await detail(f.member.id)).earned.USD).toBe(0.17);
    await expect(importSales(f.storeId, [{ device: "D", amount: "1000", sellerMemberId: "foreign" }])).rejects.toThrow();
  });
  it("uses current rate for legacy sales assigned in bulk and handles month boundaries", async () => {
    const f = await fixture();
    await rule();
    const sale = await prisma.sale.create({ data: { storeId: f.storeId, amount: 1000, amountCurrency: "USD", deviceLabel: "Legada", dateLabel: "", soldAt: new Date("2026-02-01T02:59:59Z"), status: "COMPLETADA", paymentMethod: "EFECTIVO" } });
    await getApp().inject({ method: "PATCH", url: "/api/commissions/sales/seller", headers: ownerHeaders(), payload: { saleIds: [sale.id], sellerMemberId: f.member.id } });
    const january = await detail(f.member.id);
    expect(january.earned.USD).toBe(100);
    expect(january.converted.earned.ARS).toBe(100000);
    expect(january.sales[0].exchangeRate).toBeNull();
    expect((await detail(f.member.id, "2026-02")).earned.USD).toBe(0);
  });
  it("does not duplicate adjustments when cancellation transactions race", async () => {
    const f = await fixture();
    await rule();
    const sale = await sell(f.member.id);
    await pay(f.member.id);
    await Promise.all([
      withSerializableRetry(tx => voidSaleCommission(tx, f.storeId, sale.id, "CANCELLED")),
      withSerializableRetry(tx => voidSaleCommission(tx, f.storeId, sale.id, "DELETED")),
    ]);
    expect((await detail(f.member.id, nextPeriod(currentPeriodKey()))).adjustments).toHaveLength(1);
  });
  it("updates rules partially, interprets effective dates in the store timezone and audits mutations", async () => {
    const f = await fixture();
    const saved = await rule(null, 10, "2026-01-15");
    expect(saved.effectiveFrom).toBe("2026-01-15T03:00:00.000Z");
    const response = await getApp().inject({ method: "PATCH", url: `/api/commissions/rules/${saved.id}`, headers: ownerHeaders(), payload: { rate: 15 } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().rule).toMatchObject({ rate: 15, basis: "SALE_PERCENT", memberId: null, effectiveFrom: saved.effectiveFrom });
    const list = await getApp().inject({ url: "/api/commissions/rules", headers: ownerHeaders() });
    expect(list.json().rules).toHaveLength(1);
    await pay(f.member.id);
    expect(await prisma.auditEvent.count({ where: { storeId: f.storeId, action: { startsWith: "commission." } } })).toBe(3);
  });
  it("rejects real foreign-store sellers, sales and payment targets without writes", async () => {
    const f = await fixture();
    const foreign = await seedStoreContext({ firebaseUid: "foreign-owner", email: "foreign@test.com" });
    const sale = await sell();
    const response = await getApp().inject({ method: "PATCH", url: "/api/commissions/sales/seller", headers: ownerHeaders(),
      payload: { saleIds: [sale.id], sellerMemberId: foreign.membership!.id } });
    expect(response.statusCode).toBe(404);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).sellerMemberId).toBeNull();
    const payment = await getApp().inject({ method: "POST", url: "/api/commissions/payments", headers: ownerHeaders(),
      payload: { memberId: foreign.membership!.id, period: PERIOD, amount: 100, currency: "ARS", settlesCurrency: "ARS", exchangeRate: 1000 } });
    expect(payment.statusCode).toBe(404);
    expect((await getApp().inject({ url: `/api/commissions/members/${foreign.membership!.id}`, headers: ownerHeaders() })).statusCode).toBe(404);
    expect(await prisma.commissionPayment.count({ where: { storeId: f.storeId } })).toBe(0);
  });
  it("keeps historical sellers nullable when their membership is removed", async () => {
    const f = await fixture();
    const sale = await sell(f.member.id);
    await prisma.storeMember.delete({ where: { id: f.member.id } });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).sellerMemberId).toBeNull();
  });
  it("validates periods, payment currencies, fixed rule currency, and store membership", async () => {
    const f = await fixture();
    expect((await getApp().inject({ url: "/api/commissions?period=2026-13", headers: ownerHeaders() })).statusCode).toBe(400);
    expect((await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: ownerHeaders(), payload: { basis: "FIXED_PER_UNIT", rate: 10, effectiveFrom: "2025-01-01T00:00:00Z" } })).statusCode).toBe(400);
    expect((await getApp().inject({ method: "POST", url: "/api/commissions/payments", headers: ownerHeaders(), payload: { memberId: f.member.id, period: PERIOD, currency: "EUR", settlesCurrency: "USD", exchangeRate: 0, amount: 10 } })).statusCode).toBe(400);
    expect((await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: ownerHeaders(), payload: { memberId: "foreign", rate: 10, effectiveFrom: "2025-01-01T00:00:00Z" } })).statusCode).toBe(404);
    expect((await getApp().inject({ url: "/api/commissions/members/foreign", headers: ownerHeaders() })).statusCode).toBe(404);
    expect(await prisma.auditEvent.count({ where: { storeId: f.storeId } })).toBe(0);
  });
});
