import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("QA 03: costos de reclamos según Reportes", () => {
  it.each(["ARS", "USD"])("temporalmente muestra costos al empleado sin Reportes (%s)", async currency => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const catalog = await seedCatalogFixture(storeId);
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Proveedor ficticio" } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { cost: 501000, currency, supplierId: supplier.id } });
    const staff = await prisma.user.create({ data: { firebaseUid: "qa-costs", email: "qa-costs@imanager.local" } });
    const member = await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: "STAFF", sections: ["sales", "inventory"], sensitiveAccess: true, isDefault: true } });
    const auth = buildAuthHeaders({ uid: "qa-costs", email: "qa-costs@imanager.local" });
    const app = getApp();
    const sale = await app.inject({ method: "POST", url: "/api/operations/sales", headers: buildAuthHeaders(), payload: { productId: catalog.inventoryItem.id, clientId: catalog.client.id, amount: 701000, amountCurrency: currency, status: "COMPLETADA", paymentMethod: "EFECTIVO" } });
    expect(sale.statusCode, sale.body).toBe(201);
    const created = await app.inject({ method: "POST", url: "/api/returns", headers: auth, payload: { saleId: sale.json().sale.id, reason: "Falla", openedOn: "2026-10-26" } });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().return.id;
    const list = async (headers = auth, archived = false) => {
      const response = await app.inject({ method: "GET", url: `/api/returns${archived ? "?archived=1" : ""}`, headers });
      expect(response.statusCode, response.body).toBe(200);
      return response.json().returns[0];
    };
    const visible = (row: object) => {
      expect(row).toHaveProperty("itemCost", 501000);
      expect(row).toHaveProperty("itemCurrency", currency);
      expect(row).toHaveProperty("saleAmount", 701000);
    };
    visible(await list());
    visible(created.json().return);
    expect(await list(buildAuthHeaders())).toMatchObject({ itemCost: 501000, itemCurrency: currency });
    await prisma.storeMember.update({ where: { id: member.id }, data: { sections: ["sales", "reports"], sensitiveAccess: false } });
    expect(await list()).toMatchObject({ itemCost: 501000, itemCurrency: currency });
    await prisma.storeMember.update({ where: { id: member.id }, data: { sections: ["sales"], sensitiveAccess: true } });
    const edited = await app.inject({ method: "PATCH", url: `/api/returns/${id}`, headers: auth, payload: { diagnosis: "Revisar batería" } });
    expect(edited.statusCode, edited.body).toBe(200);
    visible(edited.json().return);
    const resolved = await app.inject({ method: "POST", url: `/api/returns/${id}/resolve`, headers: auth, payload: { resolution: "CAMBIO", settlement: "NOTA_CREDITO", amount: 701000, destination: "PROVEEDOR" } });
    expect(resolved.statusCode, resolved.body).toBe(200);
    visible(resolved.json().return);
    const rma = await app.inject({ method: "POST", url: `/api/returns/${id}/rma`, headers: auth, payload: { status: "RECHAZADO" } });
    expect(rma.statusCode, rma.body).toBe(200);
    visible(rma.json().return);
    expect((await app.inject({ method: "DELETE", url: `/api/returns/${id}`, headers: auth })).statusCode).toBe(204);
    visible(await list(auth, true));
    expect(await list(buildAuthHeaders(), true)).toMatchObject({ itemCost: 501000, itemCurrency: currency });
  });
});
