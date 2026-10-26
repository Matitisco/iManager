import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("estado de cobro al corregir el precio", () => {
  it.each([false, true])("reabre sólo la diferencia y permite cobrarla (canje: %s)", async (trade) => {
    const context = await seedStoreContext();
    const f = await seedCatalogFixture(context.store!.id);
    const headers = buildAuthHeaders();
    const app = getApp();
    const created = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: f.client.id, productId: f.inventoryItem.id, amount: 655, currency: "ARS", status: "COMPLETADA",
      ...(trade ? { tradeIn: { deviceReceived: "Equipo ficticio recibido", takeValue: 200 } } : {}),
    } });
    expect(created.statusCode, created.body).toBe(201);
    const saleId = created.json().sale.id as string;
    const edit = (payload: Record<string, unknown>) => app.inject({ method: "PATCH", url: `/api/operations/sales/sales/${saleId}`, headers, payload });
    const raised = await edit({ amount: 700, status: "COMPLETADA" });
    expect(raised.statusCode, raised.body).toBe(200);
    expect(raised.json().sale).toMatchObject({ status: "PENDIENTE", openBalance: 45, amount: 700 });
    const saved = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    expect(saved.status).toBe("PENDIENTE");
    expect(Number(saved.openBalance)).toBe(45);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(45);
    const editedAgain = await edit({ amount: 710, status: "PENDIENTE" });
    expect(editedAgain.json().sale).toMatchObject({ status: "PENDIENTE", openBalance: 55 });
    const collected = await edit({ status: "COMPLETADA" });
    expect(collected.statusCode, collected.body).toBe(200);
    expect(collected.json().sale).toMatchObject({ status: "COMPLETADA", openBalance: 0 });
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
    const payment = await prisma.clientPayment.findFirstOrThrow({ where: { saleId, kind: "PAGO", amount: 55 } });
    expect(Number(payment.amount)).toBe(55);
  });
});
