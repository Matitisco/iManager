import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("integrated operation API", () => {
  it("keeps a draft isolated, confirms idempotently, and cancels with stock and balances restored", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };

    const draftResponse = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      date: "07/10/2026", clientName: "Draft Customer", productId: fixture.inventoryItem.id, categoryId: fixture.tradeInCategory.id,
      deviceLabel: fixture.inventoryItem.model, amount: 1500, paymentMethod: "EFECTIVO", status: "PENDIENTE", draft: true,
      tradeIn: { deviceReceived: "iPhone 11", deviceReceivedImei: "", takeValue: 500 },
    } });
    expect(draftResponse.statusCode).toBe(201);
    const tradeId = draftResponse.json().tradeIn.id as string;
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(0);
    expect(await prisma.client.count({ where: { storeId: context.store!.id } })).toBe(1); // fixture only
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id } })).toBe(1);
    expect(await prisma.tradeIn.count({ where: { storeId: context.store!.id, confirmationStatus: "PENDING" } })).toBe(1);
    expect(await prisma.storeNotification.count({ where: { storeId: context.store!.id } })).toBe(1);

    const confirmInput = { productId: fixture.inventoryItem.id, amount: 1500, paymentMethod: "EFECTIVO", status: "PENDIENTE", tradeIn: { deviceReceived: "iPhone 11 Confirmed", takeValue: 600 } };
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/confirm`, headers, payload: confirmInput });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ sale: { amount: 1500, status: "PENDIENTE", categoryId: null }, tradeIn: { categoryId: fixture.tradeInCategory.id, deviceReceived: "iPhone 11 Confirmed", takeValue: 600, differencePaid: 900, confirmationStatus: "CONFIRMED" } });
    expect(confirmed.json().inventory).toHaveLength(2);
    expect(confirmed.json().inventory.find((item: { price: number }) => item.price === 0)).toBeTruthy();
    expect(confirmed.json().inventory.find((item: { price: number }) => item.price === 0)).toMatchObject({ model: "iPhone 11 Confirmed", cost: 600, condition: "", grade: "", batteryHealth: "", status: "EN_REVISION" });
    expect(confirmed.json().notifications).toHaveLength(4);
    const client = await prisma.client.findFirstOrThrow({ where: { storeId: context.store!.id, name: "Draft Customer" } });
    expect(confirmed.json().notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: "tradeins", recordId: tradeId }),
      expect.objectContaining({ section: "clients", recordId: client.id }),
    ]));
    expect(Number(client.totalSpent)).toBe(1500);
    expect(Number(client.pendingBalance)).toBe(900);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("VENDIDO");

    const repeated = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/confirm`, headers, payload: confirmInput });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().sale.id).toBe(confirmed.json().sale.id);
    expect(repeated.json().inventory).toHaveLength(2);
    expect(repeated.json().clients).toHaveLength(1);
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(1);
    expect(await prisma.storeNotification.count({ where: { storeId: context.store!.id } })).toBe(5);

    const cancelled = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().inventory).toHaveLength(2);
    expect(cancelled.json().inventory.some((item: { archivedAt: string | null }) => item.archivedAt)).toBe(true);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).pendingBalance.toNumber()).toBe(0);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).totalSpent.toNumber()).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id, archivedAt: null } })).toBe(1);
  });

  it("marks a manual sold status for one sale registration and blocks an unrelated section", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "STAFF" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["inventory"] } });
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };

    const marked = await app.inject({ method: "PATCH", url: `/api/inventory/${fixture.inventoryItem.id}`, headers, payload: { status: "VENDIDO" } });
    expect(marked.statusCode).toBe(200);
    expect(marked.json().inventoryItem).toMatchObject({ status: "VENDIDO", pendingSaleRegistration: true });
    const sale = await app.inject({ method: "POST", url: "/api/operations/inventory", headers, payload: {
      productId: fixture.inventoryItem.id, clientName: "Venta manual", amount: 1200, paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    expect(sale.statusCode).toBe(201);
    const statusChange = await app.inject({ method: "PATCH", url: `/api/inventory/${fixture.inventoryItem.id}`, headers, payload: { status: "DISPONIBLE" } });
    expect(statusChange.statusCode).toBe(409);
    const sameStatusEdit = await app.inject({ method: "PATCH", url: `/api/inventory/${fixture.inventoryItem.id}`, headers, payload: { status: "VENDIDO", price: 1250 } });
    expect(sameStatusEdit.statusCode).toBe(200);
    expect(sameStatusEdit.json().inventoryItem).toMatchObject({ status: "VENDIDO", pendingSaleRegistration: false, price: 1250 });
    const duplicate = await app.inject({ method: "POST", url: "/api/operations/inventory", headers, payload: {
      productId: fixture.inventoryItem.id, clientName: "Otra venta", amount: 1200, paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    expect(duplicate.statusCode).toBe(409);
    expect((await app.inject({ method: "GET", url: "/api/sales", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/api/operations/sales/sales/${sale.json().sale.id}/cancel`, headers, payload: {} })).statusCode).toBe(403);
  });

  it("cancels a registered manual sale back to available stock without a pending flag", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const marked = await app.inject({ method: "PATCH", url: `/api/inventory/${fixture.inventoryItem.id}`, headers, payload: { status: "VENDIDO" } });
    expect(marked.statusCode).toBe(200);
    const operation = await app.inject({ method: "POST", url: "/api/operations/inventory", headers, payload: { productId: fixture.inventoryItem.id, amount: 1200, paymentMethod: "EFECTIVO", status: "COMPLETADA" } });
    expect(operation.statusCode).toBe(201);
    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${operation.json().sale.id}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().inventory).toMatchObject([{ status: "DISPONIBLE", pendingSaleRegistration: false }]);
    const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } });
    expect(stored.status).toBe("DISPONIBLE");
    expect(stored.pendingSaleRegistration).toBe(false);
  });

  it("keeps historical balances, separates homonymous typed clients, and accepts a zero-difference canje", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    await prisma.client.update({ where: { id: fixture.client.id }, data: { totalSpent: 320, pendingBalance: 75 } });
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const response = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      productId: fixture.inventoryItem.id, clientName: fixture.client.name, amount: 500, paymentMethod: "EFECTIVO", status: "PENDIENTE",
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 500 },
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json().tradeIn.differencePaid).toBe(0);
    expect(await prisma.client.count({ where: { storeId: context.store!.id, name: fixture.client.name } })).toBe(2);
    const [historical, created] = await prisma.client.findMany({ where: { storeId: context.store!.id, name: fixture.client.name }, orderBy: { createdAt: "asc" } });
    expect(historical.pendingBalance.toNumber()).toBe(75);
    expect(historical.totalSpent.toNumber()).toBe(320);
    expect(created.pendingBalance.toNumber()).toBe(0);
    expect(created.totalSpent.toNumber()).toBe(500);
  });

  it("rejects duplicate received IMEIs atomically and validates draft references within the store", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const otherStore = await seedStoreContext({ firebaseUid: "other-integrated-owner", email: "other-integrated@example.com" });
    const otherFixture = await seedCatalogFixture(otherStore.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const incompleteDraft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: { draft: true, tradeIn: {} } });
    expect(incompleteDraft.statusCode).toBe(400);
    const invalidRef = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      productId: otherFixture.inventoryItem.id, clientId: otherFixture.client.id, amount: 1000, draft: true,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(invalidRef.statusCode).toBe(404);
    expect(await prisma.tradeIn.count({ where: { storeId: context.store!.id } })).toBe(0);

    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1000, draft: true,
      tradeIn: { deviceReceived: "iPhone 11", deviceReceivedImei: fixture.inventoryItem.imei, takeValue: 400 },
    } });
    expect(draft.statusCode).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    const confirm = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/confirm`, headers, payload: {} });
    expect(confirm.statusCode).toBe(409);
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id } })).toBe(1);
    expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } })).confirmationStatus).toBe("PENDING");
  });

  it("updates a linked operation when its outgoing device changes and blocks access from unrelated sources", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "STAFF" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["sales", "inventory"] } });
    const fixture = await seedCatalogFixture(context.store!.id);
    const second = await prisma.inventoryItem.create({ data: { storeId: context.store!.id, model: "iPhone 13", capacity: "128GB", color: "Blue", condition: "NUEVO", grade: "A", batteryHealth: "100%", cost: 900, price: 1400, status: "DISPONIBLE" } });
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const manualSold = await app.inject({ method: "PATCH", url: `/api/inventory/${second.id}`, headers, payload: { status: "VENDIDO" } });
    expect(manualSold.json().inventoryItem.pendingSaleRegistration).toBe(true);
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: { productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1200, status: "PENDIENTE", tradeIn: { deviceReceived: "iPhone 10", takeValue: 500 } } });
    expect(created.statusCode).toBe(201);
    const saleId = created.json().sale.id as string;
    const tradeId = created.json().tradeIn.id as string;
    const denied = await app.inject({ method: "PATCH", url: `/api/operations/inventory/sales/${saleId}`, headers, payload: { amount: 1300 } });
    expect(denied.statusCode).toBe(403);
    const updated = await app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${saleId}`, headers, payload: { productId: second.id, amount: 1300, tradeIn: { takeValue: 600 } } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ sale: { amount: 1300, productId: second.id }, tradeIn: { takeValue: 600, differencePaid: 700 } });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("DISPONIBLE");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("VENDIDO");
    const cancelled = await app.inject({ method: "POST", url: `/api/operations/sales/sales/${saleId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    const restored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: second.id } });
    expect(restored.status).toBe("DISPONIBLE");
    expect(restored.pendingSaleRegistration).toBe(false);
  });

  it("serializes concurrent canje confirmations into one sale and one received item", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: { clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200, draft: true, tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 } } });
    expect(draft.statusCode).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    const url = `/api/operations/tradeins/trades/${tradeId}/confirm`;
    const results = await Promise.all([app.inject({ method: "POST", url, headers, payload: {} }), app.inject({ method: "POST", url, headers, payload: {} })]);
    expect(results.map((result) => result.statusCode)).toEqual([200, 200]);
    expect(results[0].json().sale.id).toBe(results[1].json().sale.id);
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(1);
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id } })).toBe(2);
  });

  it("keeps a canje when its received device has already entered active sale stock", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(created.statusCode).toBe(201);
    const tradeId = created.json().tradeIn.id as string;
    const receivedId = created.json().tradeIn.receivedInventoryItemId as string;
    await prisma.inventoryItem.update({ where: { id: receivedId }, data: { status: "VENDIDO" } });
    const cancellation = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/cancel`, headers, payload: {} });
    expect(cancellation.statusCode).toBe(409);
    expect((await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } })).confirmationStatus).toBe("CONFIRMED");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: receivedId } })).archivedAt).toBeNull();
  });

  it("rejects zero-priced outgoing stock during both sale creation and draft confirmation", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { price: 0 } });
    const sale = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1000,
    } });
    expect(sale.statusCode).toBe(409);

    await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { price: 1200 } });
    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      productId: fixture.inventoryItem.id, clientId: fixture.client.id, amount: 1000, draft: true,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(draft.statusCode).toBe(201);
    await prisma.inventoryItem.update({ where: { id: fixture.inventoryItem.id }, data: { price: 0 } });
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${draft.json().tradeIn.id}/confirm`, headers, payload: {} });
    expect(confirmed.statusCode).toBe(409);
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(0);
  });

  it("keeps legacy manual sale creation on the shared service when it includes a canje", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const response = await app.inject({ method: "POST", url: "/api/sales", headers, payload: {
      date: "07/10/2026", clientId: fixture.client.id, productId: fixture.inventoryItem.id,
      amount: 1200, paymentMethod: "EFECTIVO", status: "COMPLETADA",
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ sale: { integratedOperation: true, amount: 1200 }, tradeIn: { confirmationStatus: "CONFIRMED", differencePaid: 800 } });
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(1);
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id, status: "EN_REVISION" } })).toBe(1);
  });

  it("routes legacy sale PATCH to CANCELADA through the full cancellation operation", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const created = await app.inject({ method: "POST", url: "/api/sales", headers, payload: {
      date: "07/10/2026", clientId: fixture.client.id, productId: fixture.inventoryItem.id,
      amount: 1200, paymentMethod: "EFECTIVO", status: "PENDIENTE",
    } });
    expect(created.statusCode).toBe(201);
    const response = await app.inject({ method: "PATCH", url: `/api/sales/${created.json().sale.id}`, headers, payload: { status: "CANCELADA" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sale: { status: "CANCELADA" }, inventory: [{ status: "DISPONIBLE" }] });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: fixture.client.id } })).pendingBalance.toNumber()).toBe(0);
  });

  it("creates a new client when a saved draft is confirmed with a typed homonymous name", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200, draft: true,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(draft.statusCode).toBe(201);
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${draft.json().tradeIn.id}/confirm`, headers, payload: {
      clientId: null, clientName: fixture.client.name,
    } });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().sale.clientId).not.toBe(fixture.client.id);
    expect(await prisma.client.count({ where: { storeId: context.store!.id, name: fixture.client.name } })).toBe(2);
  });

  it("lets a sales-only member reopen and confirm only sales-origin drafts", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "STAFF" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["sales"] } });
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const invalidDraft = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 300, draft: true,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(invalidDraft.statusCode).toBe(400);
    const draft = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1200,
      categoryId: fixture.tradeInCategory.id, saleCategoryId: fixture.saleCategory.id, draft: true, tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(draft.statusCode).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    expect(draft.json().tradeIn).toMatchObject({ operationSource: "sales", categoryId: fixture.tradeInCategory.id, draftSaleCategoryId: fixture.saleCategory.id });
    const drafts = await app.inject({ method: "GET", url: "/api/operations/sales/drafts", headers });
    expect(drafts.json().tradeIns).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/api/operations/clients/drafts", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/trade-ins", headers })).statusCode).toBe(403);
    const opened = await app.inject({ method: "GET", url: `/api/operations/sales/trades/${tradeId}`, headers });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().tradeIn.operationSource).toBe("sales");
    const invalidDraftEdit = await app.inject({ method: "PATCH", url: `/api/operations/sales/trades/${tradeId}`, headers, payload: { amount: 300, tradeIn: { takeValue: 400 } } });
    expect(invalidDraftEdit.statusCode).toBe(400);
    const draftEdit = await app.inject({ method: "PATCH", url: `/api/operations/sales/trades/${tradeId}`, headers, payload: { amount: 1300, tradeIn: { takeValue: 500 } } });
    expect(draftEdit.statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/confirm`, headers, payload: {} })).statusCode).toBe(403);

    const confirmed = await app.inject({ method: "POST", url: `/api/operations/sales/trades/${tradeId}/confirm`, headers, payload: {} });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().sale.categoryId).toBe(fixture.saleCategory.id);
    expect(confirmed.json()).toMatchObject({ sale: { amount: 1300 }, tradeIn: { categoryId: fixture.tradeInCategory.id, takeValue: 500, differencePaid: 800 } });
    const reopened = await app.inject({ method: "GET", url: `/api/operations/sales/trades/${tradeId}`, headers });
    expect(reopened.json()).toMatchObject({ sale: { amount: 1300, status: "COMPLETADA" }, tradeIn: { operationSource: "sales" } });
    expect((await app.inject({ method: "GET", url: "/api/operations/sales/drafts", headers })).json().tradeIns).toHaveLength(0);
  });

  it("lets a trade-ins-only member read the linked sale summary without sales navigation", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "STAFF" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["sales"] } });
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1400,
      status: "PENDIENTE", tradeIn: { deviceReceived: "iPhone 11", takeValue: 500 },
    } });
    expect(created.statusCode).toBe(201);
    const tradeId = created.json().tradeIn.id as string;
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["tradeins"] } });
    expect((await app.inject({ method: "GET", url: "/api/sales", headers })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `/api/operations/sales/sales/${created.json().sale.id}`, headers })).statusCode).toBe(403);
    const details = await app.inject({ method: "GET", url: `/api/operations/tradeins/trades/${tradeId}`, headers });
    expect(details.statusCode).toBe(200);
    expect(details.json().sale).toMatchObject({ amount: 1400, status: "PENDIENTE" });
  });

  it("keeps reports-only managers read-only for module lists and categories", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "MANAGER" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["reports"] } });
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    for (const path of ["/api/inventory", "/api/sales", "/api/trade-ins", "/api/clients", "/api/inventory/categories", "/api/sales/categories", "/api/trade-ins/categories", "/api/clients/categories"]) {
      const response = await app.inject({ method: "GET", url: path, headers });
      expect(response.statusCode, path).toBe(200);
    }
    const mutation = await app.inject({ method: "POST", url: "/api/inventory/categories", headers, payload: { name: "Denied" } });
    expect(mutation.statusCode).toBe(403);
  });

  it("clears explicit draft selections, separates categories and date, and preserves or replaces buyers on edits", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      date: "06/10/2026", clientId: fixture.client.id, productId: fixture.inventoryItem.id, amount: 1500,
      categoryId: fixture.tradeInCategory.id, saleCategoryId: fixture.saleCategory.id, status: "PENDIENTE", draft: true,
      tradeIn: { deviceReceived: "iPhone 11", takeValue: 400 },
    } });
    expect(draft.statusCode).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${tradeId}/confirm`, headers, payload: {
      productId: null, deviceLabel: "Equipo libre", amount: 1500, status: "PENDIENTE", date: "07/10/2026",
      categoryId: null, saleCategoryId: null, tradeIn: { deviceReceived: "iPhone 11 recibido", takeValue: 400 },
    } });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      sale: { productId: "", deviceLabel: "Equipo libre", categoryId: null, date: "07/10/2026", clientId: fixture.client.id },
      tradeIn: { categoryId: null, date: "07/10/2026" },
    });

    const amountOnly = await app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${confirmed.json().sale.id}`, headers, payload: { amount: 1600 } });
    expect(amountOnly.statusCode).toBe(200);
    expect(amountOnly.json().sale.clientId).toBe(fixture.client.id);
    const typedSameName = await app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${confirmed.json().sale.id}`, headers, payload: {
      amount: 1700, clientId: null, clientName: fixture.client.name,
      categoryId: fixture.tradeInCategory.id, saleCategoryId: fixture.saleCategory.id,
    } });
    expect(typedSameName.statusCode).toBe(200);
    expect(typedSameName.json()).toMatchObject({ sale: { categoryId: fixture.saleCategory.id }, tradeIn: { categoryId: fixture.tradeInCategory.id } });
    expect(typedSameName.json().sale.clientId).not.toBe(fixture.client.id);
    expect(await prisma.client.count({ where: { storeId: context.store!.id, name: fixture.client.name } })).toBe(2);

    const cleared = await app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${confirmed.json().sale.id}`, headers, payload: { categoryId: null, saleCategoryId: null } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ sale: { categoryId: null }, tradeIn: { categoryId: null } });
  });

  it("rejects a legacy sale created as cancelled and snapshots old product labels on read", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const rejected = await app.inject({ method: "POST", url: "/api/sales", headers, payload: {
      date: "07/10/2026", clientId: fixture.client.id, productId: fixture.inventoryItem.id,
      amount: 1200, paymentMethod: "EFECTIVO", status: "CANCELADA",
    } });
    expect(rejected.statusCode).toBe(400);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fixture.inventoryItem.id } })).status).toBe("DISPONIBLE");
    expect(await prisma.sale.count({ where: { storeId: context.store!.id } })).toBe(0);

    const soldAt = new Date("2025-05-01T12:00:00.000Z");
    const legacy = await prisma.sale.create({ data: {
      storeId: context.store!.id, inventoryItemId: fixture.inventoryItem.id, clientName: "Legacy",
      dateLabel: "01/05/2025", soldAt, amount: 900, paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    const listed = await app.inject({ method: "GET", url: "/api/sales", headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().sales.find((sale: { id: string }) => sale.id === legacy.id)?.deviceLabel).toBe("iPhone 14 128GB");
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: legacy.id } })).deviceLabel).toBeNull();
  });

  it("limits inventory trade links to its own pending drafts and exposes archived details as read-only", async () => {
    const app = getApp();
    const context = await seedStoreContext({ role: "STAFF" });
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["inventory"] } });
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: context.user.firebaseUid }) };
    const foreign = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      amount: 800, deviceLabel: "Equipo libre", draft: true, tradeIn: { deviceReceived: "Foreign source", takeValue: 100 },
    } });
    expect(foreign.statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["inventory", "tradeins"] } });
    const otherDraft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      amount: 800, deviceLabel: "Equipo libre", draft: true, tradeIn: { deviceReceived: "Canje sección", takeValue: 100 },
    } });
    expect(otherDraft.statusCode).toBe(201);
    const otherId = otherDraft.json().tradeIn.id as string;
    await prisma.storeMember.update({ where: { id: context.membership!.id }, data: { sections: ["inventory"] } });
    expect((await app.inject({ method: "PATCH", url: `/api/operations/inventory/trades/${otherId}`, headers, payload: { amount: 900 } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/api/operations/inventory/trades/${otherId}/cancel`, headers, payload: {} })).statusCode).toBe(403);

    const ownDraft = await app.inject({ method: "POST", url: "/api/operations/inventory", headers, payload: {
      productId: fixture.inventoryItem.id, clientName: "Cliente inventario", amount: 1200, draft: true,
      tradeIn: { deviceReceived: "Recibido archivado", takeValue: 200 },
    } });
    expect(ownDraft.statusCode).toBe(201);
    const ownId = ownDraft.json().tradeIn.id as string;
    expect((await app.inject({ method: "PATCH", url: `/api/operations/inventory/trades/${ownId}`, headers, payload: { amount: 1300 } })).statusCode).toBe(200);
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/inventory/trades/${ownId}/confirm`, headers, payload: {} });
    expect(confirmed.statusCode).toBe(200);
    expect((await app.inject({ method: "PATCH", url: `/api/operations/inventory/trades/${ownId}`, headers, payload: { amount: 1400 } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/api/operations/inventory/trades/${ownId}/cancel`, headers, payload: {} })).statusCode).toBe(403);
  });
});
