import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe.each(["POST", "DELETE"] as const)("Anular via %s", method => {
  it.each([
    { trade: false, status: "PENDIENTE" },
    { trade: false, status: "COMPLETADA" },
    { trade: true, status: "PENDIENTE" },
    { trade: true, status: "COMPLETADA" },
  ])("reverses stock and balances once and persists audit ($status, trade: $trade)", async ({ trade, status }) => {
    const app = getApp();
    const owner = await seedStoreContext({ displayName: "Ana" });
    const fixture = await seedCatalogFixture(owner.store!.id);
    const headers = buildAuthHeaders();
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id,
      amount: 1200, status, paymentMethod: "EFECTIVO",
      ...(trade ? { tradeIn: { deviceReceived: "Equipo recibido", takeValue: 400 } } : {}),
    } });
    expect(created.statusCode).toBe(201);
    const { sale, tradeIn } = created.json();
    const entity = trade ? "trade-ins" : "sales";
    const id = trade ? tradeIn.id : sale.id;
    const url = method === "DELETE" ? `/api/${entity}/${id}`
      : trade ? `/api/operations/tradeins/trades/${id}/void` : `/api/operations/sales/sales/${id}/void`;
    const reason = status === "PENDIENTE" ? null : "Duplicado";
    const response = await app.inject({ method, url, headers, ...(reason ? { payload: { reason } } : method === "POST" ? { payload: {} } : {}) });
    expect(response.statusCode, response.body).toBe(method === "DELETE" ? 204 : 200);
    const stored = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored).toMatchObject({ status: "CANCELADA", voidedAt: expect.any(Date), voidedBy: "Ana", voidReason: reason });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("DISPONIBLE");
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(Number(client.pendingBalance)).toBe(0);
    expect(Number(client.totalSpent)).toBe(0);
    if (trade) {
      expect(await prisma.tradeIn.findUniqueOrThrow({ where: { id } })).toMatchObject({
        confirmationStatus: "CANCELLED", voidedAt: stored.voidedAt, voidedBy: "Ana", voidReason: reason,
      });
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: tradeIn.receivedInventoryItemId } })).archivedAt).toBeTruthy();
    }
    expect(await prisma.auditEvent.findFirst({ where: { entityId: sale.id, action: "sale.voided" } })).toMatchObject({ actorUserId: owner.user.id, reason });
    const active = await app.inject({ method: "GET", url: `/api/${entity}`, headers });
    const archived = await app.inject({ method: "GET", url: `/api/${entity}?voided=1`, headers });
    const key = trade ? "tradeIns" : "sales";
    expect(active.json()[key].map((row: { id: string }) => row.id)).not.toContain(id);
    expect(archived.json()[key]).toEqual(expect.arrayContaining([expect.objectContaining({ id, voidedBy: "Ana", voidReason: reason })]));
    // A resale makes any accidental second stock restoration observable.
    const resale = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1400, status: "PENDIENTE", paymentMethod: "EFECTIVO",
    } });
    expect(resale.statusCode).toBe(201);
    const before = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    const again = await app.inject({ method, url, headers, ...(method === "POST" ? { payload: {} } : {}) });
    expect(again.statusCode).toBe(method === "DELETE" ? 404 : 200);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("VENDIDO");
    expect(await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).toEqual(before);
    expect(await prisma.auditEvent.count({ where: { entityId: sale.id, action: "sale.voided" } })).toBe(1);
  });
});
