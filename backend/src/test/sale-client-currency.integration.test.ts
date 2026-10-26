import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("QA 01: sale amounts in the client's balance currency", () => {
  it.each(["PENDIENTE", "COMPLETADA"])("converts ARS spending and debt into USD (%s)", async (status) => {
    const { store } = await seedStoreContext();
    await prisma.store.update({ where: { id: store!.id }, data: { currency: "USD" } });
    const client = await prisma.client.create({ data: {
      storeId: store!.id, name: "Valentina Ríos QA", balanceCurrency: "USD", totalSpent: 100, pendingBalance: 50,
    } });
    const response = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers: buildAuthHeaders(), payload: {
      clientId: client.id, deviceLabel: "iPhone 13 QA01", amount: 812500, currency: "ARS", exchangeRate: 1250, status,
    } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ amount: 812500, amountCurrency: "ARS", exchangeRate: 1250 });
    const saved = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(saved.totalSpent)).toBe(750);
    expect(Number(saved.pendingBalance)).toBe(status === "PENDIENTE" ? 700 : 50);
    expect(saved.balanceCurrency).toBe("USD");
  });

  it("respects an ARS client balance in a USD store and converts only the unpaid part", async () => {
    const { store } = await seedStoreContext();
    await prisma.store.update({ where: { id: store!.id }, data: { currency: "USD" } });
    const client = await prisma.client.create({ data: {
      storeId: store!.id, name: "Saldo ARS QA", balanceCurrency: "ARS", totalSpent: 100, pendingBalance: 50,
    } });
    const response = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers: buildAuthHeaders(), payload: {
      clientId: client.id, deviceLabel: "iPhone parcial QA", amount: 649.5, currency: "USD", exchangeRate: 1250,
      tenders: [{ amount: 400, currency: "USD", method: "EFECTIVO" }],
    } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ amount: 649.5, amountCurrency: "USD", openBalance: 249.5 });
    const saved = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(Number(saved.totalSpent)).toBe(811975);
    expect(Number(saved.pendingBalance)).toBe(311925);
    expect(saved.balanceCurrency).toBe("ARS");
  });

  it("uses the store currency for a new client, preserves cents and reverses the converted debt", async () => {
    const { store } = await seedStoreContext();
    await prisma.store.update({ where: { id: store!.id }, data: { currency: "USD" } });
    const response = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers: buildAuthHeaders(), payload: {
      clientName: "Valentina nueva QA", deviceLabel: "iPhone 13 QA01", amount: 811875, currency: "ARS", exchangeRate: 1250, status: "PENDIENTE",
    } });
    expect(response.statusCode, response.body).toBe(201);
    const sale = response.json().sale;
    let client = await prisma.client.findUniqueOrThrow({ where: { id: sale.clientId } });
    expect(Number(client.totalSpent)).toBe(649.5);
    expect(Number(client.pendingBalance)).toBe(649.5);
    const edited = await getApp().inject({ method: "PATCH", url: `/api/operations/sales/sales/${sale.id}`, headers: buildAuthHeaders(), payload: { amount: 812500, currency: "ARS" } });
    expect(edited.statusCode, edited.body).toBe(200);
    client = await prisma.client.findUniqueOrThrow({ where: { id: sale.clientId } });
    expect(Number(client.totalSpent)).toBe(650);
    expect(Number(client.pendingBalance)).toBe(650);
    const cancelled = await getApp().inject({ method: "POST", url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: buildAuthHeaders(), payload: {} });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    client = await prisma.client.findUniqueOrThrow({ where: { id: sale.clientId } });
    expect(Number(client.totalSpent)).toBe(0);
    expect(Number(client.pendingBalance)).toBe(0);
  });
});
