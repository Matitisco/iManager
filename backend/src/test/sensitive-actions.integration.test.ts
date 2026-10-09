import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

function headers(uid: string, name: string) {
  return buildAuthHeaders({ uid, email: `${uid}@example.com`, name });
}

const json = { "content-type": "application/json" };

describe("sensitive actions", () => {
  it("returns 403 for staff, 200 for owner and manager, and stores the audit", async () => {
    const app = getApp();
    const owner = await seedStoreContext({
      firebaseUid: "sens-owner",
      email: "sens-owner@example.com",
      displayName: "Ana Dueña",
    });
    const storeId = owner.store!.id;
    const manager = await prisma.user.create({
      data: { firebaseUid: "sens-manager", email: "sens-manager@example.com", displayName: "Luis Socio" },
    });
    const staff = await prisma.user.create({
      data: { firebaseUid: "sens-staff", email: "sens-staff@example.com", displayName: "Eva Empleada" },
    });
    const granted = await prisma.user.create({
      data: { firebaseUid: "sens-granted", email: "sens-granted@example.com", displayName: "Otto" },
    });
    const blockedManager = await prisma.user.create({
      data: { firebaseUid: "sens-blocked-manager", email: "sens-blocked@example.com", displayName: "Nora" },
    });
    await prisma.storeMember.create({
      data: { storeId, userId: manager.id, role: "MANAGER", isDefault: true },
    });
    await prisma.storeMember.create({
      data: {
        storeId,
        userId: staff.id,
        role: "STAFF",
        isDefault: true,
        sections: ["inventory", "sales", "tradeins", "clients"],
      },
    });
    await prisma.storeMember.create({
      data: {
        storeId,
        userId: granted.id,
        role: "STAFF",
        isDefault: true,
        sections: ["inventory", "clients", "sales"],
        sensitiveAccess: true,
      },
    });
    await prisma.storeMember.create({
      data: {
        storeId,
        userId: blockedManager.id,
        role: "MANAGER",
        isDefault: true,
        sections: ["inventory", "sales", "tradeins", "clients", "reports"],
        sensitiveAccess: false,
      },
    });

    const item = await prisma.inventoryItem.create({
      data: {
        storeId,
        imei: "111111111111111",
        model: "iPhone 13",
        capacity: "128GB",
        color: "Negro",
        condition: "USADO",
        grade: "A",
        batteryHealth: "90%",
        cost: 500,
        price: 800,
        status: "DISPONIBLE",
      },
    });
    const spare = await prisma.inventoryItem.create({
      data: {
        storeId,
        imei: "222222222222222",
        model: "iPhone 12",
        capacity: "64GB",
        color: "Azul",
        condition: "USADO",
        grade: "B",
        batteryHealth: "88%",
        cost: 300,
        price: 500,
        status: "DISPONIBLE",
      },
    });
    const client = await prisma.client.create({
      data: { storeId, name: "Cliente Local", dni: "30111000" },
    });
    const importedSale = await prisma.sale.create({
      data: {
        storeId,
        clientName: "Importada",
        dateLabel: "01/10/2026",
        soldAt: new Date("2026-10-01T15:00:00.000Z"),
        amount: 400,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        deviceLabel: "Equipo importado",
      },
    });

    const staffHeaders = headers("sens-staff", "Eva Empleada");
    const managerHeaders = headers("sens-manager", "Luis Socio");
    const ownerHeaders = headers("sens-owner", "Ana Dueña");
    const grantedHeaders = headers("sens-granted", "Otto");
    const blockedHeaders = headers("sens-blocked-manager", "Nora");

    const staffPrice = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${item.id}`,
      headers: { ...staffHeaders, ...json },
      payload: { price: 1 },
    });
    expect(staffPrice.statusCode).toBe(403);
    const staffDeleteItem = await app.inject({ method: "DELETE", url: `/api/inventory/${item.id}`, headers: staffHeaders });
    expect(staffDeleteItem.statusCode).toBe(403);
    const staffDeleteClient = await app.inject({ method: "DELETE", url: `/api/clients/${client.id}`, headers: staffHeaders });
    expect(staffDeleteClient.statusCode).toBe(403);
    const staffDeleteSale = await app.inject({ method: "DELETE", url: `/api/sales/${importedSale.id}`, headers: staffHeaders });
    expect(staffDeleteSale.statusCode).toBe(403);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).price.toNumber()).toBe(800);
    expect(await prisma.auditEvent.count({ where: { storeId } })).toBe(0);

    const samePrice = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${item.id}`,
      headers: { ...staffHeaders, ...json },
      payload: { price: 800, color: "Verde" },
    });
    expect(samePrice.statusCode).toBe(200);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).color).toBe("Verde");

    const blockedPrice = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${item.id}`,
      headers: { ...blockedHeaders, ...json },
      payload: { price: 2 },
    });
    expect(blockedPrice.statusCode).toBe(403);

    const managerPrice = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${item.id}`,
      headers: { ...managerHeaders, ...json },
      payload: { price: 900, cost: 510 },
    });
    expect(managerPrice.statusCode).toBe(200);
    expect(managerPrice.json().inventoryItem).toMatchObject({
      price: 900,
      cost: 510,
      priceChangedBy: "Luis Socio",
      costChangedBy: "Luis Socio",
    });
    const priced = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(priced.priceChangedAt).toBeTruthy();
    expect(priced.costChangedAt).toBeTruthy();
    const priceAudit = await prisma.auditEvent.findFirst({
      where: { storeId, entityId: item.id, action: "inventory.price" },
    });
    expect(priceAudit).toMatchObject({ actorUserId: manager.id, actorName: "Luis Socio", entityType: "inventory" });

    const grantedDelete = await app.inject({ method: "DELETE", url: `/api/inventory/${spare.id}`, headers: grantedHeaders });
    expect(grantedDelete.statusCode).toBe(204);
    expect(await prisma.inventoryItem.findUnique({ where: { id: spare.id } })).toBeNull();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: spare.id, action: "inventory.deleted" } })).toMatchObject({
      actorName: "Otto",
    });

    const ownerDeleteSale = await app.inject({ method: "DELETE", url: `/api/sales/${importedSale.id}`, headers: ownerHeaders });
    expect(ownerDeleteSale.statusCode).toBe(204);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: importedSale.id, action: "sale.deleted" } })).toMatchObject({
      actorName: "Ana Dueña",
    });

    const ownerDeleteClient = await app.inject({ method: "DELETE", url: `/api/clients/${client.id}`, headers: ownerHeaders });
    expect(ownerDeleteClient.statusCode).toBe(204);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: client.id, action: "client.deleted" } })).toMatchObject({
      actorName: "Ana Dueña",
      detail: "Cliente Local",
    });

    const operation = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers: { ...ownerHeaders, ...json },
      payload: {
        productId: item.id,
        clientName: "Comprador",
        amount: 900,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      },
    });
    expect(operation.statusCode).toBe(201);
    const saleId = operation.json().sale.id as string;

    const staffCancel = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers: { ...staffHeaders, ...json },
      payload: {},
    });
    expect(staffCancel.statusCode).toBe(403);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).status).toBe("COMPLETADA");

    const managerCancel = await app.inject({
      method: "POST",
      url: `/api/operations/sales/sales/${saleId}/cancel`,
      headers: { ...managerHeaders, ...json },
      payload: {},
    });
    expect(managerCancel.statusCode).toBe(200);
    expect(managerCancel.json().sale).toMatchObject({ status: "CANCELADA", cancelledBy: "Luis Socio" });
    expect(managerCancel.json().sale.cancelledAt).toEqual(expect.any(String));
    const storedSale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(storedSale.cancelledBy).toBe("Luis Socio");
    expect(storedSale.cancelledAt).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: saleId, action: "sale.cancelled" } })).toMatchObject({
      actorUserId: manager.id,
      actorName: "Luis Socio",
    });

    const trade = await app.inject({
      method: "POST",
      url: "/api/operations/tradeins",
      headers: { ...ownerHeaders, ...json },
      payload: {
        draft: true,
        clientName: "Canje",
        amount: 700,
        deviceLabel: "Equipo entregado",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 200 },
      },
    });
    expect(trade.statusCode).toBe(201);
    const tradeId = trade.json().tradeIn.id as string;
    const staffTrade = await app.inject({
      method: "POST",
      url: `/api/operations/tradeins/trades/${tradeId}/cancel`,
      headers: { ...staffHeaders, ...json },
      payload: {},
    });
    expect(staffTrade.statusCode).toBe(403);

    const ownerTrade = await app.inject({
      method: "POST",
      url: `/api/operations/tradeins/trades/${tradeId}/cancel`,
      headers: { ...ownerHeaders, ...json },
      payload: {},
    });
    expect(ownerTrade.statusCode).toBe(200);
    expect(ownerTrade.json().tradeIn).toMatchObject({ confirmationStatus: "CANCELLED", cancelledBy: "Ana Dueña" });
    const storedTrade = await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } });
    expect(storedTrade.cancelledBy).toBe("Ana Dueña");
    expect(storedTrade.cancelledAt).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: tradeId, action: "trade.cancelled" } })).toMatchObject({
      actorName: "Ana Dueña",
    });
  });
});
