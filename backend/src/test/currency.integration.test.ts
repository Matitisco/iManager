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
        currency: "USD",
        exchangeMode: "auto",
        exchangeSource: "mep",
      },
    });
    expect(onboarded.statusCode).toBe(200);
    expect(onboarded.json().session.store).toMatchObject({
      name: "Casa Dólar",
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

    const storedSale = await prisma.sale.findFirstOrThrow({ where: { storeId } });
    expect(storedSale.amount.toNumber()).toBe(100);
    expect(storedSale.amountCurrency).toBe("USD");
  });
});
