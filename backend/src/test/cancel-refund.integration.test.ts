import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

function headersFor(uid: string, name = "Test Owner") {
  return {
    "content-type": "application/json",
    ...buildAuthHeaders({ uid, email: `${uid}@example.com`, name }),
  };
}

describe("cancel refund", () => {
  it("keeps the partial payment and records a refund when a pending sale is cancelled", async () => {
    const app = getApp();
    const context = await seedStoreContext({ displayName: "Ana Dueña" });
    const fixture = await seedCatalogFixture(context.store!.id);
    const staff = await prisma.user.create({
      data: { firebaseUid: "refund-staff", email: "refund-staff@example.com", displayName: "Eva Empleada" },
    });
    await prisma.storeMember.create({
      data: {
        storeId: context.store!.id,
        userId: staff.id,
        role: "STAFF",
        isDefault: true,
        sections: ["sales", "clients", "tradeins"],
      },
    });
    const headers = headersFor(context.user.firebaseUid, "Ana Dueña");
    const staffHeaders = headersFor("refund-staff", "Eva Empleada");

    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        deviceLabel: "iPhone 13",
        amount: 900,
        paymentMethod: "TRANSFERENCIA",
        status: "PENDIENTE",
      },
    });
    expect(created.statusCode).toBe(201);
    const saleId = created.json().sale.id as string;
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(900);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).totalSpent.toNumber()).toBe(900);

    const payment = await app.inject({
      method: "POST",
      url: `/api/clients/${fixture.client.id}/payments`,
      headers,
      payload: { amount: 300, method: "TRANSFERENCIA" },
    });
    expect(payment.statusCode).toBe(201);
    expect(payment.json().client.pendingBalance).toBe(600);
    expect(payment.json().client.totalSpent).toBe(900);

    const denied = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers: staffHeaders,
      payload: {},
    });
    expect(denied.statusCode).toBe(403);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status).toBe("PENDIENTE");
    expect(await prisma.clientPayment.count({ where: { clientId: fixture.client.id, kind: "DEVOLUCION" } })).toBe(0);

    const cancelled = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers,
      payload: {},
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().sale).toMatchObject({ status: "CANCELADA", cancelledBy: "Ana Dueña" });
    expect(cancelled.json().sale.cancelledAt).toEqual(expect.any(String));
    expect(cancelled.json().summary).toContain("devolución $ 300");

    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(0);
    expect(client.totalSpent.toNumber()).toBe(0);
    const stored = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(stored.cancelledBy).toBe("Ana Dueña");
    expect(stored.cancelledAt).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: saleId, action: "sale.cancelled" } })).toMatchObject({
      actorName: "Ana Dueña",
      detail: "Devolución $ 300",
    });

    const history = await app.inject({
      method: "GET",
      url: `/api/clients/${fixture.client.id}/payments`,
      headers,
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 300, method: "TRANSFERENCIA", kind: "PAGO" }),
      expect.objectContaining({ amount: 300, kind: "DEVOLUCION", note: expect.stringContaining("Devolución por cancelación") }),
    ]));

    const reports = await app.inject({
      method: "GET",
      url: "/api/reports/overview?rangeKey=all_time",
      headers,
    });
    expect(reports.statusCode).toBe(200);
    expect(reports.json().overview.summary).toMatchObject({ revenue: 0, pendingSales: 0, pendingAmount: 0 });

    const repeated = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers,
      payload: {},
    });
    expect(repeated.statusCode).toBe(200);
    expect(await prisma.clientPayment.count({ where: { clientId: fixture.client.id, kind: "DEVOLUCION" } })).toBe(1);
  });

  it("records a refund for a partly paid trade and leaves cancelled trades out of report cash", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);

    const created = await app.inject({
      method: "POST",
      url: "/api/operations/tradeins",
      headers,
      payload: {
        clientId: fixture.client.id,
        deviceLabel: "iPhone 13",
        amount: 1500,
        paymentMethod: "EFECTIVO",
        status: "PENDIENTE",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 600 },
      },
    });
    expect(created.statusCode).toBe(201);
    const tradeId = created.json().tradeIn.id as string;
    expect(created.json().tradeIn.differencePaid).toBe(900);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(900);

    const payment = await app.inject({
      method: "POST",
      url: `/api/clients/${fixture.client.id}/payments`,
      headers,
      payload: { amount: 300, method: "EFECTIVO" },
    });
    expect(payment.statusCode).toBe(201);

    const cancelled = await app.inject({
      method: "POST",
      url: `/api/operations/tradeins/trades/${tradeId}/cancel`,
      headers,
      payload: {},
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().sale.status).toBe("CANCELADA");
    expect(cancelled.json().tradeIn).toMatchObject({ confirmationStatus: "CANCELLED", cancelledBy: "Test Owner" });
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(0);
    expect(client.totalSpent.toNumber()).toBe(0);
    const movements = await prisma.clientPayment.findMany({ where: { clientId: fixture.client.id }, orderBy: { createdAt: "asc" } });
    expect(movements.map((row) => ({ amount: row.amount.toNumber(), kind: row.kind }))).toEqual([
      { amount: 300, kind: "PAGO" },
      { amount: 300, kind: "DEVOLUCION" },
    ]);
    expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } })).cancelledAt).toBeTruthy();

    const reports = await app.inject({
      method: "GET",
      url: "/api/reports/overview?rangeKey=all_time",
      headers,
    });
    expect(reports.json().overview.summary.revenue).toBe(0);
    expect(reports.json().overview.tradeIns).toMatchObject({
      totalInRange: 0,
      cashGenerated: 0,
      openCash: 0,
      otherCash: 0,
    });
    expect(reports.json().overview.tradeIns.series.reduce((sum: number, point: { revenue: number }) => sum + point.revenue, 0)).toBe(0);
  });

  it("refunds a collected sale in full and drops it from revenue without touching other debt", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    await prisma.client.update({ where: { id: fixture.client.id }, data: { pendingBalance: 50 } });
    const headers = headersFor(context.user.firebaseUid);

    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        deviceLabel: "iPhone 12",
        amount: 900,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      },
    });
    expect(created.statusCode).toBe(201);
    const saleId = created.json().sale.id as string;
    const before = await app.inject({ method: "GET", url: "/api/reports/overview?rangeKey=all_time", headers });
    expect(before.json().overview.summary.revenue).toBe(900);

    const cancelled = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers,
      payload: {},
    });
    expect(cancelled.statusCode).toBe(200);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(50);
    expect(client.totalSpent.toNumber()).toBe(0);
    expect(await prisma.clientPayment.findFirst({ where: { clientId: fixture.client.id, kind: "DEVOLUCION" } })).toMatchObject({
      amount: expect.anything(),
    });
    expect((await prisma.clientPayment.findFirstOrThrow({ where: { clientId: fixture.client.id, kind: "DEVOLUCION" } })).amount.toNumber()).toBe(900);

    const after = await app.inject({ method: "GET", url: "/api/reports/overview?rangeKey=all_time", headers });
    expect(after.json().overview.summary.revenue).toBe(0);
    expect(after.json().overview.clients.pendingBalance).toBe(50);
  });

  it("does not invent a refund when a pending sale was never paid", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        deviceLabel: "iPhone 11",
        amount: 900,
        paymentMethod: "EFECTIVO",
        status: "PENDIENTE",
      },
    });
    const saleId = created.json().sale.id as string;
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers,
      payload: {},
    });
    expect(cancelled.statusCode).toBe(200);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(0);
    expect(client.totalSpent.toNumber()).toBe(0);
    expect(await prisma.clientPayment.count({ where: { clientId: fixture.client.id } })).toBe(0);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: saleId, action: "sale.cancelled" } })).toMatchObject({
      detail: null,
    });
  });

  it("refunds the 160 collected on a sale and leaves an unrelated balance", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: { clientId: fixture.client.id, deviceLabel: "V-0207", amount: 160, paymentMethod: "EFECTIVO", status: "PENDIENTE", currency: "USD" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const cargo = await app.inject({
      method: "POST",
      url: `/api/accounts/clients/${fixture.client.id}/movements`,
      headers,
      payload: { kind: "CARGO", amount: 35, currency: "USD", note: "Otra deuda" },
    });
    expect(cargo.statusCode, cargo.body).toBe(201);
    const payment = await app.inject({
      method: "POST",
      url: `/api/clients/${fixture.client.id}/payments`,
      headers,
      payload: { amount: 160, method: "EFECTIVO", currency: "USD" },
    });
    expect(payment.statusCode, payment.body).toBe(201);

    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${saleId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json().summary).toContain("devolución US$ 160");
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(35);
    expect((await prisma.clientPayment.findFirstOrThrow({ where: { clientId: fixture.client.id, kind: "DEVOLUCION" } })).amount.toNumber()).toBe(160);
  });

  it("refunds the 100 collected when the price was raised to 150 and keeps a manual debt of 15", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: { clientId: fixture.client.id, deviceLabel: "V-0208", amount: 100, paymentMethod: "EFECTIVO", status: "COMPLETADA", currency: "USD" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const raised = await app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${saleId}`, headers, payload: { amount: 150 } });
    expect(raised.statusCode, raised.body).toBe(200);
    const cargo = await app.inject({
      method: "POST",
      url: `/api/accounts/clients/${fixture.client.id}/movements`,
      headers,
      payload: { kind: "CARGO", amount: 15, currency: "USD", note: "Deuda manual" },
    });
    expect(cargo.statusCode, cargo.body).toBe(201);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(65);

    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${saleId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json().summary).toMatch(/devolución (US\$|\$) 100/);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(15);
    expect((await prisma.clientPayment.findFirstOrThrow({ where: { saleId, kind: "DEVOLUCION" } })).amount.toNumber()).toBe(100);
  });

  it("refunds a payment of 30 on a pending sale without clearing another debt", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: { clientId: fixture.client.id, deviceLabel: "V-0206", amount: 100, paymentMethod: "EFECTIVO", status: "PENDIENTE", currency: "USD" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const cargo = await app.inject({
      method: "POST",
      url: `/api/accounts/clients/${fixture.client.id}/movements`,
      headers,
      payload: { kind: "CARGO", amount: 80, currency: "USD", note: "Otra deuda" },
    });
    expect(cargo.statusCode, cargo.body).toBe(201);
    const payment = await app.inject({
      method: "POST",
      url: "/api/accounts/collections",
      headers,
      payload: { clientId: fixture.client.id, saleId, amount: 30, method: "EFECTIVO", currency: "USD" },
    });
    expect(payment.statusCode, payment.body).toBe(201);

    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${saleId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json().summary).toContain("devolución US$ 30");
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(80);
  });

  it("lists the collection taken when the sale is confirmed", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = headersFor(context.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: { clientId: fixture.client.id, deviceLabel: "Cobro al confirmar", amount: 160, paymentMethod: "TRANSFERENCIA", status: "COMPLETADA", currency: "USD" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const history = await app.inject({ method: "GET", url: `/api/clients/${fixture.client.id}/payments`, headers });
    expect(history.statusCode).toBe(200);
    expect(history.json().payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 160, method: "TRANSFERENCIA", kind: "PAGO", note: "Cobro de venta", saleId }),
    ]));
  });
});
