import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("proveedores, gastos y ganancia neta", () => {
  it("aísla la tienda, archiva sin borrar y respeta al propietario", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "sup-owner", email: "sup-owner@example.com", displayName: "Natan" });
    const storeId = owner.store!.id;
    await prisma.store.update({ where: { id: storeId }, data: { exchangeMode: "manual", manualSell: 1300, currency: "ARS" } });
    const fixture = await seedCatalogFixture(storeId);
    const headers = buildAuthHeaders({ uid: "sup-owner", email: "sup-owner@example.com", name: "Natan" });

    const staff = await prisma.user.create({ data: { firebaseUid: "sup-staff", email: "sup-staff@example.com", displayName: "Eva" } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: "STAFF", isDefault: true, sections: ["inventory", "sales"] } });
    const staffHeaders = buildAuthHeaders({ uid: "sup-staff", email: "sup-staff@example.com", name: "Eva" });
    const manager = await prisma.user.create({ data: { firebaseUid: "sup-manager", email: "sup-manager@example.com", displayName: "Sol" } });
    await prisma.storeMember.create({ data: { storeId, userId: manager.id, role: "MANAGER", isDefault: true } });
    const managerHeaders = buildAuthHeaders({ uid: "sup-manager", email: "sup-manager@example.com", name: "Sol" });

    const other = await seedStoreContext({ firebaseUid: "sup-other", email: "sup-other@example.com", displayName: "Otra" });
    await prisma.store.update({ where: { id: other.store!.id }, data: { exchangeMode: "manual", manualSell: 1000, currency: "ARS" } });
    const otherHeaders = buildAuthHeaders({ uid: "sup-other", email: "sup-other@example.com", name: "Otra" });

    const created = await app.inject({ method: "POST", url: "/api/suppliers", headers, payload: { name: "Mayorista Centro", phone: "1144445555" } });
    expect(created.statusCode).toBe(201);
    const supplierId = created.json().supplier.id as string;

    const listed = await app.inject({ method: "GET", url: "/api/suppliers", headers: staffHeaders });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().suppliers.map((row: { name: string }) => row.name)).toEqual(["Mayorista Centro"]);

    const hidden = await app.inject({ method: "GET", url: `/api/suppliers/${supplierId}`, headers: otherHeaders });
    expect(hidden.statusCode).toBe(404);

    const item = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: {
        model: "iPhone 13", capacity: "128GB", color: "Azul", condition: "USADO", grade: "A", batteryHealth: "90%",
        cost: 40000, price: 100000, currency: "ARS", status: "DISPONIBLE", imei: "359111111111119", supplierId,
      },
    });
    expect(item.statusCode).toBe(201);
    expect(item.json().inventoryItem.supplierName).toBe("Mayorista Centro");
    const linkedId = item.json().inventoryItem.id as string;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${fixture.inventoryItem.id}`,
      headers,
      payload: { supplierId },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().inventoryItem.supplierId).toBe(supplierId);

    const imported = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers,
      payload: {
        supplierId,
        rows: [
          { imei: "359222222222228", model: "iPhone 12", price: 50000, cost: 20000, condition: "USADO", grade: "A", status: "DISPONIBLE" },
          { imei: "359333333333337", model: "iPhone 11", price: 40000, cost: 15000, condition: "USADO", grade: "B", status: "EN_REVISION" },
        ],
      },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().imported).toBe(2);

    await prisma.repairOrder.create({
      data: { storeId, device: "iPhone 13", imei: "359111111111119", fault: "No enciende", status: "EN_REPARACION" },
    });

    const detail = await app.inject({ method: "GET", url: `/api/suppliers/${supplierId}`, headers });
    expect(detail.statusCode).toBe(200);
    const file = detail.json().supplier;
    expect(file.deviceCount).toBe(4);
    expect(file.problemCount).toBeGreaterThan(0);
    expect(file.purchases.some((purchase: { items: { problem: boolean }[] }) => purchase.items.some((row) => row.problem))).toBe(true);
    expect(file.purchases.some((purchase: { items: { cost?: number }[] }) => purchase.items.some((row) => row.cost === 40000))).toBe(true);

    const staffDetail = await app.inject({ method: "GET", url: `/api/suppliers/${supplierId}`, headers: staffHeaders });
    expect(staffDetail.statusCode).toBe(200);
    const staffItems = staffDetail.json().supplier.purchases.flatMap((purchase: { items: { cost?: number }[] }) => purchase.items);
    expect(staffItems.every((row: { cost?: number }) => row.cost == null)).toBe(true);

    const archived = await app.inject({ method: "DELETE", url: `/api/suppliers/${supplierId}`, headers, payload: { reason: "  Duplicado  " } });
    expect(archived.statusCode).toBe(204);
    const stored = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    expect(stored.deletedAt).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: supplierId, action: "supplier.archived" } })).toMatchObject({ reason: "Duplicado" });
    const kept = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: linkedId } });
    expect(kept.supplierId).toBe(supplierId);

    const restored = await app.inject({ method: "POST", url: `/api/suppliers/${supplierId}/restore`, headers });
    expect(restored.statusCode).toBe(200);

    const expenseDenied = await app.inject({ method: "GET", url: "/api/expenses", headers: staffHeaders });
    expect(expenseDenied.statusCode).toBe(403);
    const managerDenied = await app.inject({ method: "GET", url: "/api/reports/net-profit?from=2026-10-01&to=2026-10-31", headers: managerHeaders });
    expect(managerDenied.statusCode).toBe(403);

    const expense = await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers,
      payload: { date: "2026-10-18", category: "Alquiler", amount: 5000, currency: "ARS", notes: "Local" },
    });
    expect(expense.statusCode).toBe(201);
    const expenseId = expense.json().expense.id as string;
    const usdExpense = await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers,
      payload: { date: "2026-10-18", category: "Publicidad", amount: 10, currency: "USD" },
    });
    expect(usdExpense.statusCode).toBe(201);
    await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers,
      payload: { date: "2026-09-01", category: "Flete", amount: 999, currency: "ARS" },
    });
    const dropped = await app.inject({
      method: "POST",
      url: "/api/expenses",
      headers,
      payload: { date: "2026-10-18", category: "Otros", amount: 80000, currency: "ARS" },
    });
    await app.inject({ method: "DELETE", url: `/api/expenses/${dropped.json().expense.id}`, headers, payload: { reason: "Error de carga" } });
    const gone = await prisma.expense.findUniqueOrThrow({ where: { id: dropped.json().expense.id as string } });
    expect(gone.deletedAt).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { entityId: gone.id, action: "expense.archived" } })).toMatchObject({ reason: "Error de carga" });

    const arsItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: linkedId } });
    const usdItem = await prisma.inventoryItem.create({
      data: {
        storeId, imei: "359444444444446", model: "iPhone SE", capacity: "64GB", color: "Rojo", condition: "USADO",
        grade: "A", batteryHealth: "88%", cost: 20, price: 100, currency: "USD", status: "VENDIDO",
      },
    });
    await prisma.sale.create({
      data: {
        storeId, inventoryItemId: arsItem.id, dateLabel: "2026-10-18", amount: 100000, amountCurrency: "ARS",
        paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date("2026-10-18T15:00:00.000Z"),
      },
    });
    await prisma.sale.create({
      data: {
        storeId, inventoryItemId: usdItem.id, dateLabel: "2026-10-18", amount: 100, amountCurrency: "USD",
        paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date("2026-10-18T15:00:00.000Z"),
      },
    });
    await prisma.sale.create({
      data: {
        storeId, dateLabel: "2026-10-18", amount: 900000, amountCurrency: "ARS", paymentMethod: "EFECTIVO",
        status: "CANCELADA", soldAt: new Date("2026-10-18T15:00:00.000Z"),
      },
    });
    await prisma.sale.create({
      data: {
        storeId, dateLabel: "2026-09-01", amount: 800000, amountCurrency: "ARS", paymentMethod: "EFECTIVO",
        status: "COMPLETADA", soldAt: new Date("2026-09-01T15:00:00.000Z"),
      },
    });

    const profit = await app.inject({ method: "GET", url: "/api/reports/net-profit?from=2026-10-01&to=2026-10-31", headers });
    expect(profit.statusCode).toBe(200);
    expect(profit.json()).toMatchObject({
      currency: "ARS",
      sellRate: 1300,
      blocked: false,
      revenue: 230000,
      cost: 66000,
      grossProfit: 164000,
      expenses: 18000,
      netProfit: 146000,
    });

    const otherProfit = await app.inject({ method: "GET", url: "/api/reports/net-profit?from=2026-10-01&to=2026-10-31", headers: otherHeaders });
    expect(otherProfit.json().netProfit).toBe(0);

    const edited = await app.inject({
      method: "PATCH",
      url: `/api/expenses/${expenseId}`,
      headers,
      payload: { date: "2026-10-18", category: "Alquiler local", amount: 5000, currency: "ARS" },
    });
    expect(edited.statusCode).toBe(200);

    const history = await app.inject({ method: "GET", url: "/api/history?section=suppliers", headers });
    expect(history.statusCode).toBe(200);
    const sentences = history.json().events.map((event: { actorName: string; verb: string; target: string }) => `${event.actorName} ${event.verb} ${event.target}`);
    expect(sentences.some((sentence: string) => sentence.includes("Natan") && sentence.includes("registró al proveedor") && sentence.includes("Mayorista Centro"))).toBe(true);
  });
});
