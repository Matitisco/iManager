import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("QA 06: compensación emitida independiente del cierre del RMA", () => {
  it.each([
    ["NOTA_CREDITO", "RECHAZADO"], ["NOTA_CREDITO", "RECIBIDO"],
    ["REINTEGRO", "RECHAZADO"], ["REINTEGRO", "RECIBIDO"],
  ])("reconoce %s al emitir y no al cerrar como %s", async (settlement, status) => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { currency: "ARS", exchangeMode: "manual", manualSell: 1250 } });
    const catalog = await seedCatalogFixture(storeId);
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Proveedor ficticio" } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id, cost: 410, currency: "USD" } });
    const app = getApp();
    const headers = buildAuthHeaders();
    const get = (url: string) => app.inject({ method: "GET", url, headers });
    const profit = async (from: string, to: string) => {
      const response = await get(`/api/reports/net-profit?from=${from}&to=${to}`);
      expect(response.statusCode, response.body).toBe(200);
      return response.json();
    };
    const sale = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: { productId: catalog.inventoryItem.id, clientId: catalog.client.id, amount: 560, amountCurrency: "USD", status: "COMPLETADA", paymentMethod: "EFECTIVO" } });
    expect(sale.statusCode, sale.body).toBe(201);
    await prisma.sale.update({ where: { id: sale.json().sale.id }, data: { soldAt: new Date("2026-09-20T15:00:00Z"), dateLabel: "20/09/2026", amountCurrency: "USD" } });
    expect(await profit("2026-09-01", "2026-09-30")).toMatchObject({ netProfit: 187500, revenue: 700000, cost: 512500 });
    const opened = await app.inject({ method: "POST", url: "/api/returns", headers, payload: { saleId: sale.json().sale.id, reason: "Falla", openedOn: "2026-09-25" } });
    expect(opened.statusCode, opened.body).toBe(201);
    const id = opened.json().return.id as string;
    const resolved = await app.inject({ method: "POST", url: `/api/returns/${id}/resolve`, headers, payload: { resolution: "CAMBIO", settlement, amount: 560, destination: "PROVEEDOR" } });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().return).toMatchObject({ status: "EN_PROVEEDOR", resolvedOn: null });
    // Simula emisión histórica: 1/10 UTC todavía es 30/9 en Argentina.
    const issuedAt = new Date("2026-10-01T02:30:00Z");
    await prisma.returnEvent.updateMany({ where: { caseId: id, status: "EN_PROVEEDOR" }, data: { createdAt: issuedAt } });
    await prisma.creditNote.updateMany({ where: { returnCaseId: id }, data: { createdAt: issuedAt } });
    expect(await profit("2026-09-01", "2026-09-30")).toMatchObject({ netProfit: 0, revenue: 0, cost: 0 });
    const listed = (await get("/api/returns")).json().returns[0];
    expect(listed).toMatchObject({ compensatedOn: "2026-09-30", resolvedOn: null });
    const overviewUrl = "/api/reports/overview?rangeKey=custom&startDate=2026-09-01T03:00:00.000Z&endDate=2026-10-01T02:59:59.999Z";
    expect((await get(overviewUrl)).json().overview.summary).toMatchObject({ returnsCount: 1, returnsAmount: 700000, grossProfit: 0, marginRate: 0 });
    const beforeClose = await profit("2026-10-01", "2026-10-31");
    expect(beforeClose).toMatchObject({ netProfit: 0, revenue: 0, cost: 0 });
    const closed = await app.inject({ method: "POST", url: `/api/returns/${id}/rma`, headers, payload: { status, ...(status === "RECIBIDO" ? { stockStatus: "EN_REVISION" } : {}) } });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json().return).toMatchObject({ status: "RESUELTO", compensatedOn: "2026-09-30", resolvedOn: expect.any(String) });
    expect(await profit("2026-09-01", "2026-09-30")).toMatchObject({ netProfit: 0, revenue: 0, cost: 0 });
    expect(await profit("2026-10-01", "2026-10-31")).toEqual(beforeClose);
    expect((await get(overviewUrl)).json().overview.summary).toMatchObject({ returnsCount: 1, returnsAmount: 700000, grossProfit: 0, marginRate: 0 });
    expect((await get("/api/reports/overview?rangeKey=all_time")).json().overview.summary.returnsCount).toBe(1);
    expect(await prisma.creditNote.count({ where: { returnCaseId: id } })).toBe(settlement === "NOTA_CREDITO" ? 1 : 0);
    expect(await prisma.clientPayment.count({ where: { saleId: sale.json().sale.id, kind: "DEVOLUCION" } })).toBe(settlement === "REINTEGRO" ? 1 : 0);
  });
});
