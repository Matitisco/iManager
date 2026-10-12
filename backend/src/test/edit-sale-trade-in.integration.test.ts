import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

async function setup(status = "PENDIENTE") {
  const context = await seedStoreContext();
  const storeId = context.store!.id;
  const fixture = await seedCatalogFixture(storeId);
  const headers = buildAuthHeaders({ uid: context.user.firebaseUid });
  const created = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
    clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1500,
    paymentMethod: "EFECTIVO", status, saleCategoryId: fixture.saleCategory.id,
  } });
  expect(created.statusCode).toBe(201);
  const saleId = created.json().sale.id as string;
  const edit = (payload: unknown, legacyRoute = false) => getApp().inject({
    method: "PATCH", url: legacyRoute ? `/api/sales/${saleId}` : `/api/operations/sales/sales/${saleId}`, headers, payload: payload as object,
  });
  return { storeId, fixture, saleId, edit, headers };
}

const tradeInput = { deviceReceived: "iPhone 11", deviceReceivedImei: "123456789012345", takeValue: 500 };

describe("editing the trade-in on a sale", () => {
  it.each(["PENDIENTE", "COMPLETADA"])("adds, edits, preserves, removes and adds again on a %s sale", async (status) => {
    const { storeId, fixture, saleId, edit, headers } = await setup(status);
    const added = await edit({ tradeIn: tradeInput, categoryId: fixture.tradeInCategory.id });
    expect(added.statusCode).toBe(200);
    const tradeId = added.json().tradeIn.id as string;
    const receivedId = added.json().tradeIn.receivedInventoryItemId as string;
    expect(added.json()).toMatchObject({
      sale: { id: saleId, amount: 1500, status, tradeInId: tradeId, categoryId: fixture.saleCategory.id },
      tradeIn: { confirmationStatus: "CONFIRMED", takeValue: 500, differencePaid: 1000, categoryId: fixture.tradeInCategory.id },
    });
    expect(added.json().inventory.find((item: { id: string }) => item.id === receivedId)).toMatchObject({ status: "EN_REVISION", cost: 500, model: "iPhone 11" });
    const changed = await edit({ tradeIn: { deviceReceived: "iPhone 12", deviceReceivedImei: "", takeValue: 700 } });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().tradeIn).toMatchObject({ id: tradeId, deviceReceived: "iPhone 12", differencePaid: 800 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: receivedId } })).imei).toBeNull();
    const preserved = await edit({ paymentMethod: "TRANSFERENCIA" });
    expect(preserved.json().sale.tradeInId).toBe(tradeId);
    expect(preserved.json().tradeIn.takeValue).toBe(700);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(status === "PENDIENTE" ? 800 : 0);

    const removed = await edit({ tradeIn: null });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({ sale: { id: saleId, status, amount: 1500, tradeInId: null }, tradeIn: { id: tradeId, confirmationStatus: "CANCELLED", status: "CANCELADO" } });
    expect(removed.json().inventory.find((item: { id: string }) => item.id === receivedId).archivedAt).toEqual(expect.any(String));
    expect(removed.json().notifications.find((note: { section: string }) => note.section === "inventory")).toMatchObject({ kind: "ARCHIVED_TRADE_IN_RECEIVED", recordId: tradeId });
    const client = await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } });
    expect(client.pendingBalance.toNumber()).toBe(status === "PENDIENTE" ? 1500 : 0);
    expect(client.totalSpent.toNumber()).toBe(1500);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("VENDIDO");
    const reopened = await getApp().inject({ method: "GET", url: `/api/operations/sales/sales/${saleId}`, headers });
    expect(reopened.json().tradeIn).toBeUndefined();
    const addedAgain = await edit({ tradeIn: tradeInput });
    expect(addedAgain.statusCode).toBe(200);
    expect(addedAgain.json().tradeIn.id).not.toBe(tradeId);
    expect(await prisma.sale.count({ where: { storeId } })).toBe(1);
    expect(await prisma.tradeIn.count({ where: { storeId } })).toBe(2);
  });

  it("supports adding/removing through the sales PATCH endpoint on a historical sale", async () => {
    const { saleId, edit } = await setup();
    await prisma.sale.update({ where: { id: saleId }, data: { integratedOperation: false } });
    const added = await edit({ tradeIn: tradeInput }, true);
    expect(added.statusCode).toBe(200);
    expect(added.json().sale).toMatchObject({ id: saleId, integratedOperation: true, tradeInId: added.json().tradeIn.id });
    const removed = await edit({ tradeIn: null }, true);
    expect(removed.statusCode).toBe(200);
    expect(removed.json().sale.tradeInId).toBeNull();
  });

  it("rolls back an invalid addition without touching stock, debt or sale", async () => {
    const { storeId, fixture, saleId, edit } = await setup();
    for (const tradeIn of [
      { ...tradeInput, takeValue: 1600 },
      { deviceReceived: "iPhone 11" },
      { takeValue: 500 },
      { ...tradeInput, deviceReceivedImei: fixture.inventoryItem.imei },
    ]) {
      const failed = await edit({ amount: 1400, tradeIn });
      expect([400, 409]).toContain(failed.statusCode);
      expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).amount.toNumber()).toBe(1500);
      expect(await prisma.tradeIn.count({ where: { storeId } })).toBe(0);
      expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(1500);
      expect(await prisma.inventoryItem.count({ where: { storeId } })).toBe(1);
    }
  });

  it("rejects removal when the received device is already sold and leaves the operation intact", async () => {
    const { saleId, edit } = await setup();
    const added = await edit({ tradeIn: tradeInput });
    const trade = added.json().tradeIn;
    await prisma.inventoryItem.update({ where: { id: trade.receivedInventoryItemId }, data: { status: "VENDIDO" } });
    const removed = await edit({ tradeIn: null, amount: 2000 });
    expect(removed.statusCode).toBe(409);
    expect(removed.json().error).toContain("ya está en uso");
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).tradeInId).toBe(trade.id);
    expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: trade.id } })).confirmationStatus).toBe("CONFIRMED");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: trade.receivedInventoryItemId } })).archivedAt).toBeNull();
  });

  it("does not edit a sale from another store or a cancelled sale", async () => {
    const { saleId, edit } = await setup();
    const other = await seedStoreContext({ firebaseUid: "other-owner", email: "other@example.com" });
    const foreign = await getApp().inject({ method: "PATCH", url: `/api/operations/sales/sales/${saleId}`, headers: buildAuthHeaders({ uid: other.user.firebaseUid }), payload: { tradeIn: tradeInput } });
    expect(foreign.statusCode).toBe(404);
    await prisma.sale.update({ where: { id: saleId }, data: { status: "CANCELADA" } });
    expect((await edit({ tradeIn: tradeInput })).statusCode).toBe(409);
  });
});
