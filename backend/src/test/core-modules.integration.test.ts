import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("core module integrations", () => {
  it("runs the full clients CRUD and category flow against the real database", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/clients/categories",
      headers,
      payload: { name: "Mayoristas" },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const categoryId = categoryResponse.json().category.id as string;

    const clientResponse = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers,
      payload: {
        dni: "44556677",
        name: "Cliente Integracion",
        email: "cliente@imanager.test",
        phone: "2614000000",
        categoryId,
      },
    });
    expect(clientResponse.statusCode).toBe(201);
    const clientId = clientResponse.json().client.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/clients",
      headers,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().clients).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/clients/${clientId}`,
      headers,
      payload: {
        name: "Cliente Actualizado",
        pendingBalance: 500,
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      client: {
        id: clientId,
        name: "Cliente Actualizado",
        pendingBalance: 500,
      },
    });

    const bulkMoveResponse = await app.inject({
      method: "PATCH",
      url: "/api/clients/categories/bulk-move",
      headers,
      payload: {
        itemIds: [clientId],
        categoryId: null,
      },
    });
    expect(bulkMoveResponse.statusCode).toBe(204);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/clients/${clientId}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(deleteResponse.statusCode).toBe(204);

    const categoriesResponse = await app.inject({
      method: "GET",
      url: "/api/clients/categories",
      headers,
    });
    expect(categoriesResponse.statusCode).toBe(200);
    expect(categoriesResponse.json().categories).toHaveLength(1);
  });

  it("rejects assigning a client category from another store", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const foreignContext = await seedStoreContext({
      firebaseUid: "foreign-owner-clients",
      email: "foreign-clients@imanager.test",
      displayName: "Foreign Clients Owner",
    });
    const foreignCategory = await prisma.clientCategory.create({
      data: { storeId: foreignContext.store!.id, name: "Otra tienda", sortOrder: 0 },
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/clients",
      headers,
      payload: {
        dni: "99900111",
        name: "Cliente inseguro",
        categoryId: foreignCategory.id,
      },
    });
    expect(createResponse.statusCode).toBe(404);
    expect(createResponse.json()).toEqual({ error: "Category not found" });
  });

  it("covers inventory CRUD, paging, filtered ids and category movement", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/inventory/categories",
      headers,
      payload: { name: "Android" },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const categoryId = categoryResponse.json().category.id as string;

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: {
        imei: "350000000000011",
        model: "Pixel 9",
        capacity: "256GB",
        color: "Hazel",
        condition: "NUEVO",
        grade: "A+",
        batteryHealth: "100%",
        cost: 900,
        price: 1400,
        status: "DISPONIBLE",
        categoryId,
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const inventoryItemId = createResponse.json().inventoryItem.id as string;

    const pagedResponse = await app.inject({
      method: "GET",
      url: "/api/inventory?skip=0&take=10&search=Pixel",
      headers,
    });
    expect(pagedResponse.statusCode).toBe(200);
    expect(pagedResponse.json()).toMatchObject({
      total: 1,
      items: [
        {
          id: inventoryItemId,
          model: "Pixel 9",
        },
      ],
    });

    const idsResponse = await app.inject({
      method: "GET",
      url: "/api/inventory/ids?search=Pixel",
      headers,
    });
    expect(idsResponse.statusCode).toBe(200);
    expect(idsResponse.json()).toEqual({ ids: [inventoryItemId] });

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${inventoryItemId}`,
      headers,
      payload: {
        price: 1450,
        status: "EN_REVISION",
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      inventoryItem: {
        id: inventoryItemId,
        price: 1450,
        status: "EN_REVISION",
      },
    });

    const moveResponse = await app.inject({
      method: "POST",
      url: "/api/inventory/bulk-move",
      headers,
      payload: {
        ids: [inventoryItemId],
        categoryId: null,
      },
    });
    expect(moveResponse.statusCode).toBe(200);
    expect(moveResponse.json()).toEqual({ count: 1 });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/inventory/${inventoryItemId}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it("rejects assigning an inventory category from another store", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const foreignContext = await seedStoreContext({
      firebaseUid: "foreign-owner-inventory",
      email: "foreign-inventory@imanager.test",
      displayName: "Foreign Inventory Owner",
    });
    const foreignCategory = await prisma.inventoryCategory.create({
      data: { storeId: foreignContext.store!.id, name: "Otra tienda", sortOrder: 0 },
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: {
        imei: "350000000000012",
        model: "Galaxy S25",
        capacity: "512GB",
        color: "Blue",
        condition: "NUEVO",
        grade: "A+",
        batteryHealth: "100%",
        cost: 1000,
        price: 1500,
        status: "DISPONIBLE",
        categoryId: foreignCategory.id,
      },
    });
    expect(createResponse.statusCode).toBe(404);
    expect(createResponse.json()).toEqual({ error: "Category not found" });
  });

  it("creates, updates and deletes sales while mutating stock, client stats and reports", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/sales/categories",
      headers,
      payload: { name: "Web" },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const categoryId = categoryResponse.json().category.id as string;

    const saleResponse = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers,
      payload: {
        date: "19 abr 2026",
        clientId: fixture.client.id,
        productId: fixture.inventoryItem.id,
        amount: 1200,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        categoryId,
      },
    });
    expect(saleResponse.statusCode).toBe(201);
    const saleId = saleResponse.json().sale.id as string;

    const soldInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fixture.inventoryItem.id },
    });
    const updatedClient = await prisma.client.findUniqueOrThrow({
      where: { id: fixture.client.id },
    });
    expect(soldInventory.status).toBe("VENDIDO");
    expect(updatedClient.totalSpent.toNumber()).toBe(1200);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/sales",
      headers,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().sales).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/sales/${saleId}`,
      headers,
      payload: {
        amount: 1300,
        paymentMethod: "TRANSFERENCIA",
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      sale: {
        id: saleId,
        amount: 1300,
        paymentMethod: "TRANSFERENCIA",
      },
    });

    const reportsResponse = await app.inject({
      method: "GET",
      url: "/api/reports/overview?rangeKey=all_time",
      headers,
    });
    expect(reportsResponse.statusCode).toBe(200);
    expect(reportsResponse.json()).toMatchObject({
      overview: {
        summary: {
          revenue: 1300,
          unitsSold: 1,
        },
      },
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/sales/${saleId}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(deleteResponse.statusCode).toBe(204);

    const restoredInventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fixture.inventoryItem.id },
    });
    const restoredClient = await prisma.client.findUniqueOrThrow({
      where: { id: fixture.client.id },
    });
    expect(restoredInventory.status).toBe("DISPONIBLE");
    expect(restoredClient.totalSpent.toNumber()).toBe(0);
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).toMatchObject({ status: "CANCELADA", integratedOperation: true });
  });

  it("records a sale with a free-text device and leaves stock untouched", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const saleResponse = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers,
      payload: {
        date: "07/10/2026",
        clientName: "Mostrador",
        deviceLabel: "iPhone 11 64GB de afuera",
        amount: 900,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      },
    });

    expect(saleResponse.statusCode).toBe(201);
    expect(saleResponse.json().sale).toMatchObject({
      productId: "",
      deviceLabel: "iPhone 11 64GB de afuera",
      clientName: "Mostrador",
      amount: 900,
    });

    const stock = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: fixture.inventoryItem.id },
    });
    expect(stock.status).toBe("DISPONIBLE");
  });

  it("rejects assigning a sales category from another store", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const foreignContext = await seedStoreContext({
      firebaseUid: "foreign-owner-sales",
      email: "foreign-sales@imanager.test",
      displayName: "Foreign Sales Owner",
    });
    const foreignCategory = await prisma.saleCategory.create({
      data: { storeId: foreignContext.store!.id, name: "Otra tienda", sortOrder: 0 },
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const saleResponse = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers,
      payload: {
        date: "19 abr 2026",
        clientId: fixture.client.id,
        productId: fixture.inventoryItem.id,
        amount: 1200,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        categoryId: foreignCategory.id,
      },
    });
    expect(saleResponse.statusCode).toBe(404);
    expect(saleResponse.json()).toEqual({ error: "Category not found" });
  });

  it("handles trade-in CRUD and category endpoints against persisted records", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/trade-ins/categories",
      headers,
      payload: { name: "Canjes express" },
    });
    expect(categoryResponse.statusCode).toBe(201);
    const categoryId = categoryResponse.json().category.id as string;

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-ins",
      headers,
      payload: {
        date: "19 abr 2026",
        clientId: fixture.client.id,
        deviceReceived: "iPhone 12",
        deviceReceivedImei: "350000000000013",
        takeValue: 700,
        deviceGiven: "iPhone 14",
        differencePaid: 500,
        status: "PENDIENTE",
        batteryHealth: "88%",
        grade: "B",
        categoryId,
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const tradeInId = createResponse.json().tradeIn.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/trade-ins",
      headers,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tradeIns).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/trade-ins/${tradeInId}`,
      headers,
      payload: {
        status: "LISTO",
        differencePaid: 550,
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      tradeIn: {
        id: tradeInId,
        status: "LISTO",
        confirmationStatus: "PENDING",
        draftAmount: 1250,
      },
    });

    const categoriesResponse = await app.inject({
      method: "GET",
      url: "/api/trade-ins/categories",
      headers,
    });
    expect(categoriesResponse.statusCode).toBe(200);
    expect(categoriesResponse.json().categories).toHaveLength(2);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/trade-ins/${tradeInId}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(deleteResponse.statusCode).toBe(204);
    expect(await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeInId } })).toMatchObject({ confirmationStatus: "CANCELLED", status: "CANCELADO" });
  });

  it("rejects assigning a trade-in category from another store", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const fixture = await seedCatalogFixture(context.store!.id);
    const foreignContext = await seedStoreContext({
      firebaseUid: "foreign-owner-tradeins",
      email: "foreign-tradeins@imanager.test",
      displayName: "Foreign TradeIn Owner",
    });
    const foreignCategory = await prisma.tradeInCategory.create({
      data: { storeId: foreignContext.store!.id, name: "Otra tienda", sortOrder: 0 },
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-ins",
      headers,
      payload: {
        date: "19 abr 2026",
        clientId: fixture.client.id,
        deviceReceived: "Moto Edge",
        deviceReceivedImei: "350000000000014",
        takeValue: 400,
        deviceGiven: "iPhone 14",
        differencePaid: 600,
        status: "PENDIENTE",
        categoryId: foreignCategory.id,
      },
    });
    expect(createResponse.statusCode).toBe(404);
    expect(createResponse.json()).toEqual({ error: "Category not found" });
  });
});
