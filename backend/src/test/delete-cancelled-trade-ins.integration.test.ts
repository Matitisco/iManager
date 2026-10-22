import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

async function fingerprint(storeId: string, clientId: string) {
  const [inventory, client, payments, sales, notifications, trades] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    prisma.clientPayment.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    prisma.sale.findMany({ where: { storeId }, orderBy: { saleNumber: "asc" } }),
    prisma.storeNotification.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    prisma.tradeIn.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
  ]);
  return { inventory, client, payments, sales, notifications, trades };
}

describe("delete cancelled trade-ins", () => {
  it.each(["PENDIENTE", "COMPLETADA"] as const)("removes a cancelled trade without reversing stock or balance again (%s)", async (status) => {
    const app = getApp();
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders();
    await prisma.client.update({ where: { id: fixture.client.id }, data: { pendingBalance: 50 } });
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        productId: fixture.inventoryItem.id,
        amount: 1200,
        paymentMethod: "EFECTIVO",
        status,
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
      },
    });
    expect(created.statusCode).toBe(201);
    const { sale, tradeIn } = created.json();
    if (status === "PENDIENTE") {
      expect((await app.inject({ method: "POST", url: `/api/clients/${fixture.client.id}/payments`, headers, payload: { amount: 300, method: "EFECTIVO" } })).statusCode).toBe(201);
    }
    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeIn.id } })).confirmationStatus).toBe("CANCELLED");
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).toMatchObject({ status: "DISPONIBLE", pendingSaleRegistration: false });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: tradeIn.receivedInventoryItemId } })).archivedAt).not.toBeNull();

    const resale = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        productId: fixture.inventoryItem.id,
        amount: 1400,
        paymentMethod: "EFECTIVO",
        status: "PENDIENTE",
      },
    });
    expect(resale.statusCode).toBe(201);

    const before = await fingerprint(storeId, fixture.client.id);
    expect((await app.inject({ method: "DELETE", url: `/api/trade-ins/${tradeIn.id}`, headers })).statusCode).toBe(204);
    expect((await prisma.tradeIn.findUnique({ where: { id: tradeIn.id } }))?.voidedAt).toBeTruthy();

    const after = await fingerprint(storeId, fixture.client.id);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.client).toEqual(before.client);
    expect(after.payments).toEqual(before.payments);
    expect(after.notifications).toEqual(before.notifications);
    const rest = ({ voidedAt: _voidedAt, voidedBy: _voidedBy, voidReason: _voidReason, updatedAt: _updatedAt, ...row }: typeof after.trades[number]) => row;
    expect(after.trades.map(rest)).toEqual(before.trades.map(rest));
    expect(after.trades.find((trade) => trade.id === tradeIn.id)?.voidedAt).toBeTruthy();
    expect(after.sales.map(({ tradeInId, updatedAt, ...saleRow }) => saleRow)).toEqual(before.sales.map(({ tradeInId, updatedAt, ...saleRow }) => saleRow));
    expect(after.sales.find((row) => row.id === sale.id)?.tradeInId).toBeNull();
    expect(after.sales.find((row) => row.id === resale.json().sale.id)?.status).not.toBe("CANCELADA");
    expect(await prisma.auditEvent.findFirst({ where: { storeId, entityId: tradeIn.id, action: "trade.voided" } })).toMatchObject({ actorUserId: owner.user.id });
    expect(await prisma.auditEvent.count({ where: { entityId: tradeIn.id, action: "trade.cancelled" } })).toBe(1);
    expect((await app.inject({ method: "DELETE", url: `/api/trade-ins/${tradeIn.id}`, headers })).statusCode).toBe(404);
    expect(await prisma.auditEvent.count({ where: { entityId: tradeIn.id, action: "trade.voided" } })).toBe(1);
  });

  it("cancels an active trade on the first delete and removes it on the second without reversing twice", async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const fixture = await seedCatalogFixture(owner.store!.id);
    const headers = buildAuthHeaders();
    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        productId: fixture.inventoryItem.id,
        clientId: fixture.client.id,
        amount: 1200,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
      },
    });
    expect(created.statusCode).toBe(201);
    const { sale, tradeIn } = created.json();
    const url = `/api/trade-ins/${tradeIn.id}`;

    expect((await app.inject({ method: "DELETE", url, headers, payload: { reason: "Duplicado" } })).statusCode).toBe(204);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: tradeIn.id, action: "trade.cancelled" } })).toMatchObject({ reason: "Duplicado" });
    expect(await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeIn.id } })).toMatchObject({ confirmationStatus: "CANCELLED", status: "CANCELADO" });
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toMatchObject({ status: "CANCELADA" });
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).toMatchObject({ status: "DISPONIBLE" });
    const received = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: tradeIn.receivedInventoryItemId } });
    expect(received.archivedAt).not.toBeNull();

    const before = await fingerprint(owner.store!.id, fixture.client.id);
    const staff = await prisma.user.create({ data: { firebaseUid: "delete-trade-staff", email: "delete-trade-staff@example.com" } });
    await prisma.storeMember.create({ data: { userId: staff.id, storeId: owner.store!.id, role: "STAFF", isDefault: true, sections: ["tradeins"], sensitiveAccess: false } });
    expect((await app.inject({ method: "DELETE", url, headers: buildAuthHeaders({ uid: staff.firebaseUid }) })).statusCode).toBe(403);
    const foreign = await seedStoreContext({ firebaseUid: "foreign-trade", email: "foreign-trade@example.com" });
    expect((await app.inject({ method: "DELETE", url, headers: buildAuthHeaders({ uid: foreign.user.firebaseUid }) })).statusCode).toBe(404);
    expect(await prisma.tradeIn.findUnique({ where: { id: tradeIn.id } })).not.toBeNull();
    expect(await prisma.auditEvent.count({ where: { entityId: tradeIn.id, action: "trade.voided" } })).toBe(0);

    expect((await app.inject({ method: "DELETE", url, headers })).statusCode).toBe(204);
    expect((await prisma.tradeIn.findUnique({ where: { id: tradeIn.id } }))?.voidedAt).toBeTruthy();
    const after = await fingerprint(owner.store!.id, fixture.client.id);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.client).toEqual(before.client);
    expect(after.payments).toEqual(before.payments);
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toMatchObject({ status: "CANCELADA", tradeInId: null });
    expect(await prisma.auditEvent.findFirst({ where: { entityId: tradeIn.id, action: "trade.voided" } })).toMatchObject({ actorUserId: owner.user.id });
  });
});
