import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("operation concurrency (#440)", () => {
  it("creates sales in independent stores concurrently without mixing receipt numbers or balances", async () => {
    const fixtures = [];
    for (let index = 0; index < 6; index += 1) {
      const context = await seedStoreContext({ firebaseUid: `parallel-${index}`, email: `parallel-${index}@example.com` });
      const fixture = await seedCatalogFixture(context.store!.id);
      fixtures.push({ ...fixture, storeId: context.store!.id, headers: buildAuthHeaders({ uid: context.user.firebaseUid }) });
    }
    const responses = await Promise.all(fixtures.map(fixture => getApp().inject({
      method: "POST", url: "/api/operations/sales", headers: fixture.headers,
      payload: { clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 900, paymentMethod: "EFECTIVO", status: "PENDIENTE" },
    })));
    for (const [index, response] of responses.entries()) {
      expect(response.statusCode, response.body).toBe(201);
      const fixture = fixtures[index]!;
      expect(await prisma.sale.count({ where: { storeId: fixture.storeId } })).toBe(1);
      expect(response.json().sale.saleNumber).toBe(1);
      const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
      expect(Number(client.totalSpent)).toBe(900);
      expect(Number(client.pendingBalance)).toBe(900);
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("VENDIDO");
    }
  }, 30_000);

  it.each([false, true])("cancels the same paid operation concurrently once (trade-in=%s)", async (tradeIn) => {
    const context = await seedStoreContext();
    const storeId = context.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders();
    const register = await getApp().inject({ method: "POST", url: "/api/cash", headers, payload: { name: "Caja", currency: "ARS", method: "EFECTIVO", opening: 0 } });
    expect(register.statusCode, register.body).toBe(200);
    const registerId = register.json().id as string;
    const opened = await getApp().inject({ method: "POST", url: `/api/cash/${registerId}/open`, headers });
    expect(opened.statusCode, opened.body).toBe(200);
    const created = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 900, paymentMethod: "EFECTIVO", status: "COMPLETADA",
      ...(tradeIn ? { tradeIn: { deviceReceived: "iPhone 11", takeValue: 200 } } : {}),
    } });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const noticesBefore = await prisma.storeNotification.count({ where: { storeId } });
    const cancelled = await Promise.all([0, 1].map(() => getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${saleId}/cancel`, headers })));
    for (const response of cancelled) {
      expect(response.statusCode, response.body).toBe(200);
      if (tradeIn) expect(response.json().tradeIn.confirmationStatus).toBe("CANCELLED");
      else expect(response.json().sale.status).toBe("CANCELADA");
    }
    const notices = cancelled.reduce((count, response) => count + response.json().notifications.length, 0);
    expect(notices).toBe(tradeIn ? 4 : 3);
    expect(await prisma.storeNotification.count({ where: { storeId } })).toBe(noticesBefore + notices);
    expect(Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id: registerId } })).balance)).toBe(0);
    const movements = await prisma.cashMovement.findMany({ where: { storeId, registerId } });
    const cash = tradeIn ? 700 : 900;
    expect(movements.map(row => Number(row.amount)).sort((a, b) => a - b)).toEqual([-cash, cash]);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(Number(client.totalSpent)).toBe(0);
    expect(Number(client.pendingBalance)).toBe(0);
    expect(await prisma.clientDeposit.count({ where: { storeId, clientId: client.id } })).toBe(0);
    expect(await prisma.clientPayment.count({ where: { storeId, clientId: client.id, kind: "DEVOLUCION" } })).toBe(1);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status).toBe("CANCELADA");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("DISPONIBLE");
  }, 30_000);

  it("cancels separate pending sales for the same client without losing either reversal", async () => {
    const context = await seedStoreContext();
    const storeId = context.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders();
    const product = await prisma.inventoryItem.create({ data: { storeId, model: "iPhone 15", imei: "359123456789013", capacity: "128GB", color: "Black", condition: "USADO", grade: "A", batteryHealth: "91%", status: "DISPONIBLE", cost: 800, price: 1200 } });
    const saleIds: string[] = [];
    for (const productId of [fixture.inventoryItem.id, product.id]) {
      const created = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
        clientId: fixture.client.id, productId, amount: 900, paymentMethod: "EFECTIVO", status: "PENDIENTE",
      } });
      expect(created.statusCode, created.body).toBe(201);
      saleIds.push(created.json().sale.id);
    }
    const cancelled = await Promise.all(saleIds.map(id => getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${id}/cancel`, headers })));
    for (const response of cancelled) expect(response.statusCode, response.body).toBe(200);
    expect(await prisma.sale.count({ where: { storeId, status: "CANCELADA" } })).toBe(2);
    expect(await prisma.inventoryItem.count({ where: { storeId, status: "DISPONIBLE" } })).toBe(2);
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(Number(client.totalSpent)).toBe(0);
    expect(Number(client.pendingBalance)).toBe(0);
    expect(await prisma.clientDeposit.count({ where: { storeId, clientId: client.id } })).toBe(0);
  }, 30_000);
});
