import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("store currency", () => {
  it("saves the currency on the store, stamps new amounts, and leaves legacy rows untouched", async () => {
    const app = getApp();
    const owner = await seedStoreContext({
      firebaseUid: "currency-owner",
      email: "currency-owner@imanager.test",
      displayName: "Currency Owner",
      createStore: false,
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: owner.user.firebaseUid,
        email: owner.user.email ?? undefined,
        name: owner.user.displayName ?? undefined,
      }),
    };

    const onboarded = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      headers,
      payload: {
        storeName: "Casa Dólar",
        instagram: "https://instagram.com/casa.dolar",
        currency: "USD",
        exchangeMode: "auto",
        exchangeSource: "mep",
      },
    });
    expect(onboarded.statusCode).toBe(200);
    expect(onboarded.json().session.store).toMatchObject({
      name: "Casa Dólar",
      instagram: "casa.dolar",
      currency: "USD",
      exchangeMode: "auto",
      exchangeSource: "mep",
      manualBuy: null,
      manualSell: null,
    });

    const session = await app.inject({ method: "GET", url: "/api/me", headers });
    expect(session.statusCode).toBe(200);
    expect(session.json().store).toMatchObject({ currency: "USD", exchangeSource: "mep" });
    const storeId = session.json().store.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: {
        imei: "359999000000001",
        model: "iPhone 13",
        capacity: "128GB",
        color: "Azul",
        condition: "USADO",
        grade: "A",
        batteryHealth: "90%",
        cost: 80,
        price: 100,
        status: "DISPONIBLE",
      },
    });
    expect(created.statusCode).toBe(201);
    const itemId = created.json().inventoryItem.id as string;
    expect(created.json().inventoryItem.currency).toBe("USD");

    await prisma.inventoryItem.update({ where: { id: itemId }, data: { currency: null } });

    const patched = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers,
      payload: {
        currency: "ARS",
        exchangeMode: "manual",
        exchangeSource: "blue",
        manualBuy: 500,
        manualSell: 700,
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().store).toMatchObject({
      currency: "ARS",
      exchangeMode: "manual",
      manualBuy: 500,
      manualSell: 700,
    });

    const legacy = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(legacy.price.toNumber()).toBe(100);
    expect(legacy.currency).toBeNull();

    const sale = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        date: "09/10/2026",
        clientName: "Ana",
        deviceLabel: "iPhone 13",
        amount: 100,
        currency: "USD",
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
      },
    });
    expect(sale.statusCode).toBe(201);
    expect(sale.json().sale).toMatchObject({ amount: 100, amountCurrency: "USD" });
    expect(sale.json().summary).toBe("Venta US$ 100 · deuda US$ 0 · equipo libre");
    expect(sale.json().notifications.find((item: { section: string }) => item.section === "sales")?.message).toBe("iPhone 13 · Ana · US$ 100");

    const storedSale = await prisma.sale.findFirstOrThrow({ where: { storeId } });
    expect(storedSale.amount.toNumber()).toBe(100);
    expect(storedSale.amountCurrency).toBe("USD");
  });

  it("writes trade and client notices in the store currency", async () => {
    const app = getApp();
    const context = await seedStoreContext({
      firebaseUid: "usd-copy-owner",
      email: "usd-copy@imanager.test",
      displayName: "Dueña Dólar",
    });
    await prisma.store.update({ where: { id: context.store!.id }, data: { currency: "USD" } });
    const client = await prisma.client.create({
      data: { storeId: context.store!.id, name: "Ana Pérez", totalSpent: 0, pendingBalance: 0 },
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({ uid: context.user.firebaseUid, email: context.user.email ?? undefined, name: "Dueña Dólar" }),
    };

    const trade = await app.inject({
      method: "POST",
      url: "/api/operations/tradeins",
      headers,
      payload: {
        date: "09/10/2026",
        clientId: client.id,
        deviceLabel: "iPhone 14",
        amount: 1075,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 200 },
      },
    });
    expect(trade.statusCode).toBe(201);
    const body = trade.json();
    const notice = (section: string) => body.notifications.find((item: { section: string }) => item.section === section);
    expect(notice("tradeins")?.message).toBe("iPhone 11 · toma US$ 200 · diferencia US$ 875");
    expect(notice("clients")?.message).toBe("Ana Pérez compró por US$ 1.075");
    expect(notice("sales")?.message).toBe("iPhone 14 · Ana Pérez · US$ 1.075");
    expect(body.summary).toBe("Canje · total US$ 1.075 · toma US$ 200 · diferencia US$ 875 · pagada · estado técnico del recibido: Pendiente");
  });
});
