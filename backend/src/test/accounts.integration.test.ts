import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

async function fixture() {
  const owner = await seedStoreContext();
  const rows = await seedCatalogFixture(owner.store!.id);
  return { ...rows, storeId: owner.store!.id, headers: buildAuthHeaders() };
}

function sale(headers: Record<string, string>, payload: Record<string, unknown>) {
  return getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload });
}

describe("cuenta corriente y cuotas", () => {
  it("lists an open sale with a traffic light, then a charge and a discount", async () => {
    const f = await fixture();
    const created = await sale(f.headers, { clientId: f.client.id, deviceLabel: "Equipo abierto", amount: 1000, currency: "ARS", paymentMethod: "EFECTIVO", status: "PENDIENTE" });
    expect(created.statusCode, created.body).toBe(201);
    const listed = await getApp().inject({ url: "/api/accounts/debtors", headers: f.headers });
    expect(listed.statusCode, listed.body).toBe(200);
    const row = listed.json().debtors.find((item: { clientId: string }) => item.clientId === f.client.id);
    expect(row).toMatchObject({ pendingBalance: 1000, tone: "verde" });
    expect(row.lines[0]).toMatchObject({ source: "VENTA", state: "ABIERTA", amount: 1000 });

    const charge = await getApp().inject({ method: "POST", url: `/api/accounts/clients/${f.client.id}/movements`, headers: f.headers, payload: { kind: "CARGO", amount: 50, note: "Flete" } });
    expect(charge.statusCode, charge.body).toBe(201);
    const discount = await getApp().inject({ method: "POST", url: `/api/accounts/clients/${f.client.id}/movements`, headers: f.headers, payload: { kind: "DESCUENTO", amount: 50, note: "Ajuste" } });
    expect(discount.statusCode, discount.body).toBe(201);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(1000);
  });

  it("finances the remainder and collects the oldest installment first", async () => {
    const f = await fixture();
    const created = await sale(f.headers, {
      clientId: f.client.id,
      deviceLabel: "Equipo en cuotas",
      amount: 900,
      currency: "ARS",
      paymentMethod: "EFECTIVO",
      tenders: [
        { amount: 200, currency: "ARS", method: "EFECTIVO" },
        { amount: 100, currency: "ARS", method: "TRANSFERENCIA" },
      ],
      installments: { count: 3, frequency: "MENSUAL", firstDueDate: "2026-11-14" },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().sale).toMatchObject({ status: "PENDIENTE", paymentMethod: "MIXTO", openBalance: 600 });
    const saleId = created.json().sale.id as string;
    const before = await prisma.saleInstallment.findMany({ where: { saleId }, orderBy: { sequence: "asc" } });
    expect(before.map((row) => Number(row.amount))).toEqual([200, 200, 200]);

    const paid = await getApp().inject({ method: "POST", url: "/api/accounts/collections", headers: f.headers, payload: { clientId: f.client.id, saleId, amount: 250, method: "EFECTIVO", currency: "ARS" } });
    expect(paid.statusCode, paid.body).toBe(201);
    const after = await prisma.saleInstallment.findMany({ where: { saleId }, orderBy: { sequence: "asc" } });
    expect(after.map((row) => Number(row.paidAmount))).toEqual([200, 50, 0]);
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).openBalance)).toBe(350);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(350);
  });

  it("turns a price increase on a closed sale into account debt and rejects it without a client", async () => {
    const f = await fixture();
    const closed = await sale(f.headers, { clientId: f.client.id, deviceLabel: "Equipo cerrado", amount: 1000, currency: "ARS", paymentMethod: "EFECTIVO", status: "COMPLETADA" });
    expect(closed.statusCode, closed.body).toBe(201);
    const saleId = closed.json().sale.id as string;
    const raised = await getApp().inject({ method: "PATCH", url: `/api/operations/sales/sales/${saleId}`, headers: f.headers, payload: { amount: 1300 } });
    expect(raised.statusCode, raised.body).toBe(200);
    expect(raised.json().sale).toMatchObject({ status: "COMPLETADA", openBalance: 300, amount: 1300 });
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(300);
    expect(await prisma.clientPayment.findFirst({ where: { saleId, kind: "CARGO", note: "Diferencia por corrección de precio" } })).toBeTruthy();
    const listed = await getApp().inject({ url: "/api/accounts/debtors", headers: f.headers });
    expect(listed.json().debtors.find((item: { clientId: string }) => item.clientId === f.client.id).lines[0]).toMatchObject({ amount: 300, state: "ABIERTA" });
    expect((await getApp().inject({ method: "DELETE", url: `/api/sales/${saleId}`, headers: f.headers })).statusCode).toBe(204);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);

    const walkIn = await sale(f.headers, { deviceLabel: "Mostrador", amount: 400, currency: "ARS", paymentMethod: "EFECTIVO", status: "COMPLETADA" });
    expect(walkIn.statusCode, walkIn.body).toBe(201);
    const rejected = await getApp().inject({ method: "PATCH", url: `/api/operations/sales/sales/${walkIn.json().sale.id}`, headers: f.headers, payload: { amount: 500 } });
    expect(rejected.statusCode, rejected.body).toBe(409);
    expect(rejected.json().error).toMatch(/cliente/);
  });

  it("rejects installments for a walk-in and leaves excess as credit", async () => {
    const f = await fixture();
    const rejected = await sale(f.headers, {
      deviceLabel: "Sin cliente",
      amount: 500,
      currency: "ARS",
      paymentMethod: "EFECTIVO",
      installments: { count: 2, frequency: "MENSUAL", firstDueDate: "2026-12-01" },
    });
    expect(rejected.statusCode, rejected.body).toBe(400);
    expect(rejected.json().error).toMatch(/consumidor final/);

    const credited = await sale(f.headers, {
      clientId: f.client.id,
      deviceLabel: "Con excedente",
      amount: 500,
      currency: "ARS",
      exchangeRate: 1000,
      paymentMethod: "EFECTIVO",
      tenders: [{ amount: 700, currency: "ARS", method: "EFECTIVO" }],
      excess: "CREDIT",
    });
    expect(credited.statusCode, credited.body).toBe(201);
    expect(credited.json().sale.status).toBe("COMPLETADA");
    const deposit = await prisma.clientDeposit.findFirstOrThrow({ where: { clientId: f.client.id, status: "CREDIT" } });
    expect(Number(deposit.amount)).toBe(200);
  });

  it("confirms the unpaid remainder and ages the line from the oldest overdue installment", async () => {
    const f = await fixture();
    const created = await sale(f.headers, {
      clientId: f.client.id,
      deviceLabel: "Cuotas vencidas",
      amount: 300,
      currency: "ARS",
      paymentMethod: "EFECTIVO",
      tenders: [{ amount: 100, currency: "ARS", method: "EFECTIVO" }],
      installments: { count: 2, frequency: "MENSUAL", firstDueDate: "2020-01-01" },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().summary).toContain("deuda $ 200");
    const listed = await getApp().inject({ url: "/api/accounts/debtors", headers: f.headers });
    const row = listed.json().debtors.find((item: { clientId: string }) => item.clientId === f.client.id);
    expect(row.lines[0].installments[0].status).toBe("VENCIDA");
    expect(row.lines[0].days).toBeGreaterThan(100);
    expect(row.days).toBe(row.lines[0].days);
    expect(row.tone).toBe("rojo");
    const history = await getApp().inject({ url: `/api/clients/${f.client.id}/payments`, headers: f.headers });
    expect(history.json().payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 100, kind: "PAGO", note: "Cobro de venta", saleId: created.json().sale.id }),
    ]));
  });

  it("shows a repair apart from the account and a credit note closes the sale without moving stock", async () => {
    const f = await fixture();
    const sold = await sale(f.headers, { clientId: f.client.id, productId: f.inventoryItem.id, amount: 400, currency: "ARS", paymentMethod: "EFECTIVO", status: "PENDIENTE" });
    expect(sold.statusCode, sold.body).toBe(201);
    const saleId = sold.json().sale.id as string;
    const repair = await getApp().inject({ method: "POST", url: "/api/repairs", headers: f.headers, payload: { clientId: f.client.id, device: "iPhone", fault: "Pantalla", estimate: 200, deposit: 0, currency: "ARS" } });
    expect(repair.statusCode, repair.body).toBe(201);
    const repairId = repair.json().order.id as string;
    const listed = await getApp().inject({ url: "/api/accounts/debtors", headers: f.headers });
    const row = listed.json().debtors.find((item: { clientId: string }) => item.clientId === f.client.id);
    expect(row.pendingBalance).toBe(400);
    expect(row.repairBalance).toBe(200);
    expect(row.lines.some((line: { source: string }) => line.source === "REPARACION")).toBe(true);

    const collected = await getApp().inject({ method: "POST", url: "/api/accounts/collections", headers: f.headers, payload: { clientId: f.client.id, repairId, amount: 50, method: "TRANSFERENCIA", currency: "ARS" } });
    expect(collected.statusCode, collected.body).toBe(201);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(400);
    expect(Number((await prisma.repairOrder.findUniqueOrThrow({ where: { id: repairId } })).deposit)).toBe(50);

    const note = await getApp().inject({ method: "POST", url: `/api/accounts/clients/${f.client.id}/movements`, headers: f.headers, payload: { kind: "NOTA_CREDITO", amount: 400, saleId, note: "Ajuste de precio" } });
    expect(note.statusCode, note.body).toBe(201);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status).toBe("COMPLETADA");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).status).toBe("VENDIDO");
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
  });

  it("includes today's birthday in follow-ups", async () => {
    const f = await fixture();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
    await prisma.client.update({ where: { id: f.client.id }, data: { birthday: new Date(`${today}T12:00:00.000Z`) } });
    const listed = await getApp().inject({ url: "/api/accounts/follow-ups", headers: f.headers });
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.json().cards.some((card: { kind: string; clientId: string }) => card.kind === "CUMPLEANOS" && card.clientId === f.client.id)).toBe(true);
  });
});
