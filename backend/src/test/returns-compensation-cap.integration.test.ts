import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("QA 04: límite económico después de anular reclamos", () => {
  it.each(["NOTA_CREDITO", "REINTEGRO"])("conserva el límite de la venta tras anular una compensación %s", async settlement => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const catalog = await seedCatalogFixture(storeId);
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Proveedor ficticio" } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id } });
    const app = getApp();
    const headers = buildAuthHeaders();
    const sale = await app.inject({ method: "POST", url: "/api/operations/sales", headers, payload: { productId: catalog.inventoryItem.id, clientId: catalog.client.id, amount: 701000, amountCurrency: "ARS", status: "COMPLETADA", paymentMethod: "EFECTIVO" } });
    expect(sale.statusCode, sale.body).toBe(201);
    const saleId = sale.json().sale.id;
    const open = async () => {
      const response = await app.inject({ method: "POST", url: "/api/returns", headers, payload: { saleId, reason: "Falla", openedOn: "2026-10-26" } });
      expect(response.statusCode, response.body).toBe(201);
      return response.json().return.id as string;
    };
    const resolve = (id: string, amount: number) => app.inject({ method: "POST", url: `/api/returns/${id}/resolve`, headers, payload: { resolution: "CAMBIO", settlement, amount, destination: "PROVEEDOR" } });
    const first = await open();
    expect((await resolve(first, 500000)).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/api/returns/${first}/rma`, headers, payload: { status: "RECIBIDO", stockStatus: "EN_REVISION" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/returns/${first}`, headers })).statusCode).toBe(204);
    const second = await open();
    const duplicated = await resolve(second, 701000);
    expect(duplicated.statusCode, duplicated.body).toBe(400);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: second } })).moneyAmount.toNumber()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("EN_REVISION");
    const excessivePartial = await resolve(second, 201000.01);
    expect(excessivePartial.statusCode, excessivePartial.body).toBe(400);
    expect((await resolve(second, 201000)).statusCode).toBe(200);
    // Anular con el proveedor tampoco libera lo ya emitido.
    expect((await app.inject({ method: "DELETE", url: `/api/returns/${second}`, headers })).statusCode).toBe(204);
    const third = await open();
    expect((await resolve(third, 0.01)).statusCode).toBe(400);
    const payments = await prisma.clientPayment.findMany({ where: { storeId, saleId, kind: "DEVOLUCION" } });
    const notes = await prisma.creditNote.findMany({ where: { storeId, saleId } });
    expect([...payments, ...notes].reduce((sum, row) => sum + Number(row.amount), 0)).toBe(701000);
    if (settlement === "NOTA_CREDITO") expect(notes.every(row => row.status === "ABIERTA" && Number(row.remaining) === Number(row.amount))).toBe(true);
  });
});
