import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

function artToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    key: `${bag.year}-${bag.month}`,
    label: `${bag.day}/${bag.month}/${bag.year}`,
    day: Number(bag.day),
  };
}

describe("commissions", () => {
  const ctx = useIntegrationApp();

  it("attributes the sale, applies today's rule and records the payment", async () => {
    const app = ctx.getApp();
    const owner = await seedStoreContext({ displayName: "Dueño Ejemplo" });
    const seller = await seedStoreContext({
      firebaseUid: "test-seller",
      email: "seller@example.com",
      displayName: "Vendedor Ejemplo",
      role: "STAFF",
      createStore: false,
    });
    const membership = await prisma.storeMember.create({
      data: { storeId: owner.store!.id, userId: seller.user.id, role: "STAFF", isDefault: true },
    });
    const today = artToday();
    const sellerHeaders = { "content-type": "application/json", ...buildAuthHeaders({ uid: "test-seller", email: "seller@example.com", name: "Vendedor Ejemplo" }) };
    const ownerHeaders = { "content-type": "application/json", ...buildAuthHeaders({ uid: owner.user.firebaseUid, email: owner.user.email ?? undefined, name: "Dueño Ejemplo" }) };

    const created = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: sellerHeaders,
      payload: { date: today.label, deviceLabel: "iPhone 13 128GB", amount: 100000, paymentMethod: "EFECTIVO", status: "COMPLETADA" },
    });
    expect(created.statusCode).toBe(201);
    const saleId = created.json().sale.id as string;
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).registeredByUserId).toBe(seller.user.id);

    if (today.day > 1) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.sale.create({
        data: {
          storeId: owner.store!.id,
          registeredByUserId: seller.user.id,
          clientName: "Ayer",
          deviceLabel: "iPhone 12",
          dateLabel: "ayer",
          soldAt: yesterday,
          amount: 50000,
          paymentMethod: "EFECTIVO",
          status: "COMPLETADA",
        },
      });
    }

    const blocked = await app.inject({ method: "GET", url: `/api/commissions?period=${today.key}`, headers: sellerHeaders });
    expect(blocked.statusCode).toBe(403);

    const saved = await app.inject({
      method: "PUT",
      url: "/api/commissions/rules",
      headers: ownerHeaders,
      payload: { memberId: null, basis: "PERCENT_SALE", rate: 10, includeAccessories: true },
    });
    expect(saved.statusCode).toBe(200);
    const body = saved.json();
    expect(body.summary.commission).toBe(10000);
    expect(body.people).toHaveLength(1);
    expect(body.people[0].name).toBe("Vendedor Ejemplo");
    expect(body.people[0].memberId).toBe(membership.id);
    expect(body.rules.team.label).toBe("10% sobre la venta");

    const detail = await app.inject({
      method: "GET",
      url: `/api/commissions/people/${membership.id}?period=${today.key}`,
      headers: ownerHeaders,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().person.sales.some((line: { commission: number }) => line.commission === 10000)).toBe(true);

    const paid = await app.inject({
      method: "POST",
      url: "/api/commissions/payments",
      headers: ownerHeaders,
      payload: { memberId: membership.id, period: today.key },
    });
    expect(paid.statusCode).toBe(200);
    expect(paid.json().summary.paidCount).toBe(1);
    expect(paid.json().summary.pendingAmount).toBe(0);
    const again = await app.inject({
      method: "POST",
      url: "/api/commissions/payments",
      headers: ownerHeaders,
      payload: { memberId: membership.id, period: today.key },
    });
    expect(again.statusCode).toBe(200);
    expect(await prisma.commissionPayment.count({ where: { storeId: owner.store!.id } })).toBe(1);

    await prisma.storeMember.update({ where: { id: owner.membership!.id }, data: { role: "MANAGER", sections: ["sales"] } });
    const partnerBlocked = await app.inject({ method: "GET", url: `/api/commissions?period=${today.key}`, headers: ownerHeaders });
    expect(partnerBlocked.statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: owner.membership!.id }, data: { sections: ["commissions"] } });
    const partnerAllowed = await app.inject({ method: "GET", url: `/api/commissions?period=${today.key}`, headers: ownerHeaders });
    expect(partnerAllowed.statusCode).toBe(200);
  });
});
