import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("archive, void and history", () => {
  it("archives and restores an item, blocks a duplicate IMEI, and hides history from staff", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "arch-owner", email: "arch-owner@example.com", displayName: "Matías" });
    const storeId = owner.store!.id;
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders({ uid: "arch-owner", email: "arch-owner@example.com", name: "Matías" });
    const staff = await prisma.user.create({ data: { firebaseUid: "arch-staff", email: "arch-staff@example.com", displayName: "Eva" } });
    await prisma.storeMember.create({
      data: { storeId, userId: staff.id, role: "STAFF", isDefault: true, sections: ["inventory", "sales", "clients"], sensitiveAccess: true },
    });
    const staffHeaders = buildAuthHeaders({ uid: "arch-staff", email: "arch-staff@example.com", name: "Eva" });

    const denied = await app.inject({ method: "GET", url: "/api/history", headers: staffHeaders });
    expect(denied.statusCode).toBe(403);

    const archived = await app.inject({
      method: "DELETE",
      url: `/api/inventory/${fixture.inventoryItem.id}`,
      headers,
      payload: { reason: "Duplicado" },
    });
    expect(archived.statusCode).toBe(204);
    const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } });
    expect(stored.archivedAt).toBeTruthy();
    expect(stored.archiveReason).toBe("Duplicado");

    const listed = await app.inject({ method: "GET", url: "/api/inventory", headers });
    expect(listed.json().inventory.map((row: { id: string }) => row.id)).not.toContain(fixture.inventoryItem.id);
    const onlyArchived = await app.inject({ method: "GET", url: "/api/inventory?archived=1", headers });
    expect(onlyArchived.json().inventory.map((row: { id: string }) => row.id)).toContain(fixture.inventoryItem.id);

    const clash = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: {
        imei: fixture.inventoryItem.imei,
        model: "iPhone 13",
        capacity: "128GB",
        color: "Negro",
        condition: "USADO",
        grade: "A",
        batteryHealth: "90%",
        cost: 100,
        price: 200,
        status: "DISPONIBLE",
      },
    });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ code: "ARCHIVED_MATCH", archivedMatchId: fixture.inventoryItem.id });

    const restored = await app.inject({ method: "POST", url: `/api/inventory/${fixture.inventoryItem.id}/restore`, headers });
    expect(restored.statusCode).toBe(200);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).archivedAt).toBeNull();

    const history = await app.inject({ method: "GET", url: "/api/history?section=inventory", headers });
    expect(history.statusCode).toBe(200);
    const actions = history.json().events.map((event: { action: string }) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["inventory.archived", "inventory.restored"]));

    const granted = await prisma.storeMember.update({
      where: { id: (await prisma.storeMember.findFirstOrThrow({ where: { userId: staff.id } })).id },
      data: { sections: ["inventory", "sales", "clients", "history"] },
    });
    expect(granted.sections).toContain("history");
    expect((await app.inject({ method: "GET", url: "/api/history", headers: staffHeaders })).statusCode).toBe(200);
  });

  it("finds a complete IMEI within its store and returns real record context", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "history-372-owner" });
    const other = await seedStoreContext({ firebaseUid: "history-372-other", email: "other@example.com" });
    const fixture = await seedCatalogFixture(owner.store!.id);
    const foreign = await seedCatalogFixture(other.store!.id);
    await prisma.auditEvent.createMany({ data: [fixture, foreign].map((data, index) => ({
      storeId: index ? other.store!.id : owner.store!.id,
      actorName: "Lucía Fernández", actorRole: "STAFF", action: "inventory.price", entityType: "inventory", entityId: data.inventoryItem.id,
      entityLabel: "iPhone 14 128GB · IMEI …9012", detail: "Precio actualizado", changes: [],
    })) });
    const headers = buildAuthHeaders({ uid: "history-372-owner" });
    const response = await app.inject({ method: "GET", url: `/api/history?q=${fixture.inventoryItem.imei}&period=30`, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().events).toHaveLength(1);
    expect(response.json().events[0]).toMatchObject({ entityId: fixture.inventoryItem.id, entityIdentifier: `IMEI ${fixture.inventoryItem.imei}`, changes: [], detail: "Precio actualizado" });
    const absent = await app.inject({ method: "GET", url: "/api/history?q=999999999999999", headers });
    expect(absent.json().events).toEqual([]);
  });

  it("voids a sale without deleting it and rejects a second void", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "void-owner", email: "void-owner@example.com", displayName: "Lucía" });
    const fixture = await seedCatalogFixture(owner.store!.id);
    const headers = buildAuthHeaders({ uid: "void-owner", email: "void-owner@example.com", name: "Lucía" });
    const sale = await prisma.sale.create({
      data: {
        storeId: owner.store!.id,
        clientId: fixture.client.id,
        inventoryItemId: fixture.inventoryItem.id,
        clientName: "Juan Perez",
        deviceLabel: "iPhone 14",
        dateLabel: "18/10/2026",
        soldAt: new Date("2026-10-18T12:00:00.000Z"),
        amount: 500,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        integratedOperation: false,
      },
    });
    const saleId = sale.id;
    const voided = await app.inject({ method: "DELETE", url: `/api/sales/${saleId}`, headers, payload: { reason: "Error de carga" } });
    expect(voided.statusCode).toBe(204);
    const row = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(row.voidedAt).toBeTruthy();
    expect(row.saleNumber).toBeGreaterThan(0);
    expect((await app.inject({ method: "DELETE", url: `/api/sales/${saleId}`, headers })).statusCode).toBe(404);
    const live = await app.inject({ method: "GET", url: "/api/sales", headers });
    expect(live.json().sales.map((sale: { id: string }) => sale.id)).not.toContain(saleId);
    const anuladas = await app.inject({ method: "GET", url: "/api/sales?voided=1", headers });
    expect(anuladas.json().sales.map((row: { id: string }) => row.id)).toContain(saleId);
    const events = await prisma.auditEvent.findMany({ where: { storeId: owner.store!.id, entityId: saleId } });
    expect(events.map((event) => event.action)).toContain("sale.voided");
  });

  it("rejects a DNI that belongs to an archived client and restores it", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "dni-owner", email: "dni-owner@example.com", displayName: "Natan" });
    const headers = buildAuthHeaders({ uid: "dni-owner", email: "dni-owner@example.com", name: "Natan" });
    const created = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers,
      payload: { name: "Ana Pérez", dni: "40111222" },
    });
    expect(created.statusCode).toBe(201);
    const clientId = created.json().client.id as string;
    expect((await app.inject({ method: "DELETE", url: `/api/clients/${clientId}`, headers, payload: { reason: "Duplicado" } })).statusCode).toBe(204);
    const clash = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers,
      payload: { name: "Ana otra", dni: "40111222" },
    });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ code: "ARCHIVED_MATCH", archivedMatchId: clientId, entity: "client" });
    const restored = await app.inject({ method: "POST", url: `/api/clients/${clientId}/restore`, headers });
    expect(restored.statusCode).toBe(200);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: clientId } })).archivedAt).toBeNull();
  });
});
