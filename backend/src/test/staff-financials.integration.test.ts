import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const FINANCIAL_KEYS = ["cost", "costValue", "grossProfit", "grossProfitChange", "margin", "marginRate", "grossMargin"];

function assertNoFinancials(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoFinancials);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(FINANCIAL_KEYS).not.toContain(key);
    assertNoFinancials(child);
  }
}

function headers(uid: string) {
  return {
    "content-type": "application/json",
    ...buildAuthHeaders({ uid, email: `${uid}@example.com`, name: uid }),
  };
}

async function addMember(
  storeId: string,
  firebaseUid: string,
  role: "STAFF" | "MANAGER",
  sections?: string[],
) {
  const user = await prisma.user.create({
    data: { firebaseUid, email: `${firebaseUid}@example.com`, displayName: firebaseUid },
  });
  await prisma.storeMember.create({
    data: {
      storeId,
      userId: user.id,
      role,
      isDefault: true,
      ...(sections ? { sections } : {}),
    },
  });
}

const itemPayload = {
  imei: "111111111111111",
  model: "Pixel 9",
  capacity: "128GB",
  color: "Negro",
  condition: "USADO",
  grade: "A",
  batteryHealth: "90%",
  cost: 900,
  price: 1400,
  status: "DISPONIBLE",
};

describe("financial fields by permission", () => {
  it("returns cost to the owner and strips it from every inventory response for staff", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "owner-costs", email: "owner-costs@example.com" });
    const storeId = owner.store!.id;
    await addMember(storeId, "staff-costs", "STAFF", ["inventory", "sales", "tradeins", "reports"]);
    await addMember(storeId, "manager-sales", "MANAGER", ["inventory", "sales"]);
    await addMember(storeId, "manager-reports", "MANAGER", ["inventory", "reports"]);

    const created = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers: headers("owner-costs"),
      payload: itemPayload,
    });
    expect(created.statusCode).toBe(201);
    const itemId = created.json().inventoryItem.id as string;
    expect(created.json().inventoryItem.cost).toBe(900);

    const ownerList = await app.inject({ method: "GET", url: "/api/inventory", headers: headers("owner-costs") });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json().inventory.find((item: { id: string }) => item.id === itemId).cost).toBe(900);

    const staffList = await app.inject({ method: "GET", url: "/api/inventory", headers: headers("staff-costs") });
    expect(staffList.statusCode).toBe(200);
    expect(staffList.json().inventory[0]).toMatchObject({ id: itemId, model: "Pixel 9", price: 1400 });
    assertNoFinancials(staffList.json());

    const staffPage = await app.inject({
      method: "GET",
      url: "/api/inventory?skip=0&take=10",
      headers: headers("staff-costs"),
    });
    expect(staffPage.statusCode).toBe(200);
    expect(staffPage.json().total).toBe(1);
    assertNoFinancials(staffPage.json());

    const managerHidden = await app.inject({ method: "GET", url: "/api/inventory", headers: headers("manager-sales") });
    assertNoFinancials(managerHidden.json());
    const managerVisible = await app.inject({ method: "GET", url: "/api/inventory", headers: headers("manager-reports") });
    expect(managerVisible.json().inventory[0].cost).toBe(900);

    const staffCreate = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers: headers("staff-costs"),
      payload: { ...itemPayload, imei: "222222222222222", model: "Pixel 8", cost: 450 },
    });
    expect(staffCreate.statusCode).toBe(201);
    expect(staffCreate.json().inventoryItem.price).toBe(1400);
    assertNoFinancials(staffCreate.json());
    const stored = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId, imei: "222222222222222" } });
    expect(stored.cost.toNumber()).toBe(450);

    const staffPatch = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${stored.id}`,
      headers: headers("staff-costs"),
      payload: { color: "Verde", cost: 1 },
    });
    expect(staffPatch.statusCode).toBe(200);
    assertNoFinancials(staffPatch.json());
    const afterPatch = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stored.id } });
    expect(afterPatch.color).toBe("Verde");
    expect(afterPatch.cost.toNumber()).toBe(450);

    const imported = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers: headers("staff-costs"),
      payload: { rows: [{ imei: "222222222222222", model: "Pixel 8", price: 1500 }] },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({ updated: 1 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stored.id } })).cost.toNumber()).toBe(450);

    const importedCost = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers: headers("staff-costs"),
      payload: { rows: [{ imei: "222222222222222", model: "Pixel 8", price: 1500, cost: 222 }] },
    });
    expect(importedCost.json()).toMatchObject({ updated: 1 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: stored.id } })).cost.toNumber()).toBe(222);

    const sale = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers: headers("staff-costs"),
      payload: {
        productId: itemId,
        amount: 1400,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        deviceLabel: "Pixel 9",
      },
    });
    expect(sale.statusCode).toBe(201);
    expect(sale.json().sale.amount).toBe(1400);
    expect(sale.json().inventory.length).toBeGreaterThan(0);
    assertNoFinancials(sale.json());

    const ownerSale = await app.inject({
      method: "GET",
      url: `/api/operations/sales/sales/${sale.json().sale.id}`,
      headers: headers("owner-costs"),
    });
    expect(ownerSale.statusCode).toBe(200);
    expect(ownerSale.json().inventory.find((item: { id: string }) => item.id === itemId).cost).toBe(900);

    const reports = await app.inject({ method: "GET", url: "/api/reports/overview", headers: headers("staff-costs") });
    expect(reports.statusCode).toBe(403);
  });
});
