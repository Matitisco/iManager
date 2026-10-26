import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("Gestión 05: compras históricas importadas", () => {
  it("mapea las columnas de fecha y nombre sin descartarlas", async () => {
    await seedStoreContext();
    const response = await getApp().inject({ method: "POST", url: "/api/import/analyze", headers: buildAuthHeaders(), payload: { section: "inventory", sheets: [{ name: "Compra", rows: [["Modelo", "IMEI", "Precio", "Fecha de compra", "Nombre de compra"], ["iPhone 13", "359991000000000", "600", "2026-09-15", "Reposición septiembre"]] }] } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().rows[0]).toMatchObject({ purchasedAt: "2026-09-15", purchaseName: "Reposición septiembre" });
  });

  it("rechaza la fecha inválida sin crear equipo ni compra", async () => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Proveedor ficticio" } });
    const response = await getApp().inject({ method: "POST", url: "/api/inventory/import", headers: buildAuthHeaders(), payload: { supplierId: supplier.id, rows: [{ imei: "", model: "iPhone 13", price: 600, purchasedAt: "31/02/2026" }] } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ imported: 0, errors: [{ row: 1, message: "Fecha de compra inválida" }] });
    expect(await prisma.inventoryItem.count({ where: { storeId } })).toBe(0);
    expect(await prisma.stockPurchase.count({ where: { storeId } })).toBe(0);
  });

  it("persiste cada compra con su fecha y nombre y no la duplica al repetir", async () => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Proveedor ficticio" } });
    const rows = [
      { imei: "359991000000000", model: "iPhone 13", price: 600, cost: 450, currency: "USD", purchasedAt: "2026-09-15", purchaseName: "Reposición septiembre" },
      { imei: "359991000000001", model: "iPhone 14", price: 650, cost: 500, currency: "USD", purchasedAt: "15/09/2026", purchaseName: "Reposición septiembre" },
      { imei: "359991000000002", model: "iPhone 15", price: 800, cost: 600, currency: "USD", purchasedAt: "2026-08-10", purchaseName: "Reposición agosto" },
    ];
    const run = () => getApp().inject({ method: "POST", url: "/api/inventory/import", headers: buildAuthHeaders(), payload: { supplierId: supplier.id, rows } });
    const first = await run();
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toMatchObject({ imported: 3, errors: [] });
    const purchases = await prisma.stockPurchase.findMany({ where: { storeId }, include: { items: true }, orderBy: { purchasedAt: "asc" } });
    expect(purchases.map(p => ({ date: p.purchasedAt.toISOString().slice(0, 10), name: p.name, count: p.items.length }))).toEqual([
      { date: "2026-08-10", name: "Reposición agosto", count: 1 }, { date: "2026-09-15", name: "Reposición septiembre", count: 2 },
    ]);
    expect((await run()).json()).toMatchObject({ imported: 0, updated: 3 });
    expect(await prisma.stockPurchase.count({ where: { storeId } })).toBe(2);
  });
});
