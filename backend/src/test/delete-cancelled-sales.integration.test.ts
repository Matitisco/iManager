import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("delete cancelled sales", () => {
  it.each([
    { status: "PENDIENTE", trade: false },
    { status: "COMPLETADA", trade: false },
    { status: "PENDIENTE", trade: true },
    { status: "COMPLETADA", trade: true },
  ])("preserves the cancelled operation and later resale ($status, trade: $trade)", async ({ status, trade }) => {
    const app = getApp();
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders();
    await prisma.client.update({ where: { id: fixture.client.id }, data: { pendingBalance: 50 } });
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200, paymentMethod: "EFECTIVO", status,
      ...(trade ? { tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 } } : {}),
    } });
    expect(created.statusCode).toBe(201);
    const { sale, tradeIn } = created.json();
    if (status === "PENDIENTE") {
      expect((await app.inject({ method: "POST", url: `/api/clients/${fixture.client.id}/payments`, headers, payload: { amount: 300, method: "EFECTIVO" } })).statusCode).toBe(201);
    }
    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().sale.status).toBe("CANCELADA");
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).toMatchObject({ status: "DISPONIBLE", pendingSaleRegistration: false });
    if (trade) {
      expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeIn.id } })).confirmationStatus).toBe("CANCELLED");
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: tradeIn.receivedInventoryItemId } })).archivedAt).not.toBeNull();
    }
    // Selling the released device again exposes accidental restoration during delete.
    const resale = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1400, paymentMethod: "EFECTIVO", status: "PENDIENTE",
    } });
    expect(resale.statusCode).toBe(201);
    const snapshot = async () => ({
      inventory: await prisma.inventoryItem.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
      trades: await prisma.tradeIn.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
      client: await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } }),
      payments: await prisma.clientPayment.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
      notifications: await prisma.storeNotification.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    });
    const before = await snapshot();
    expect(before.client.pendingBalance.toNumber()).toBe(resale.json().clients[0].pendingBalance);
    expect(before.payments.filter((row) => row.kind === "DEVOLUCION")).toHaveLength(1);
    expect((await app.inject({ method: "DELETE", url: `/api/sales/${sale.id}`, headers })).statusCode).toBe(204);
    expect(await prisma.sale.findUnique({ where: { id: sale.id } })).toBeNull();
    expect(await snapshot()).toEqual(before);
    expect(await prisma.sale.findUnique({ where: { id: resale.json().sale.id } })).not.toBeNull();
    expect(await prisma.auditEvent.findFirst({ where: { storeId, entityId: sale.id, action: "sale.deleted" } })).toMatchObject({ actorUserId: owner.user.id });
    expect(await prisma.auditEvent.count({ where: { entityId: sale.id, action: "sale.cancelled" } })).toBe(1);
    expect((await app.inject({ method: "DELETE", url: `/api/sales/${sale.id}`, headers })).statusCode).toBe(404);
    expect(await prisma.auditEvent.count({ where: { entityId: sale.id, action: "sale.deleted" } })).toBe(1);
  });

  it("keeps active DELETE as cancellation and enforces sensitive permissions and store scope before deletion", async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const fixture = await seedCatalogFixture(owner.store!.id);
    const headers = buildAuthHeaders();
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1200, paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    expect(created.statusCode).toBe(201);
    const id = created.json().sale.id;
    const url = `/api/sales/${id}`;
    expect((await app.inject({ method: "DELETE", url, headers })).statusCode).toBe(204);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELADA");
    const staff = await prisma.user.create({ data: { firebaseUid: "delete-staff", email: "delete-staff@example.com" } });
    await prisma.storeMember.create({ data: { userId: staff.id, storeId: owner.store!.id, role: "STAFF", isDefault: true, sections: ["sales"], sensitiveAccess: false } });
    expect((await app.inject({ method: "DELETE", url, headers: buildAuthHeaders({ uid: staff.firebaseUid }) })).statusCode).toBe(403);
    const foreign = await seedStoreContext({ firebaseUid: "foreign", email: "foreign@example.com" });
    expect((await app.inject({ method: "DELETE", url, headers: buildAuthHeaders({ uid: foreign.user.firebaseUid }) })).statusCode).toBe(404);
    expect(await prisma.sale.findUnique({ where: { id } })).not.toBeNull();
    expect(await prisma.auditEvent.count({ where: { entityId: id, action: "sale.deleted" } })).toBe(0);
    expect((await app.inject({ method: "DELETE", url, headers })).statusCode).toBe(204);
    expect(await prisma.sale.findUnique({ where: { id } })).toBeNull();
  });
});
