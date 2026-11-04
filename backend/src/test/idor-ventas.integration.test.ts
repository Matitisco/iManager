import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

async function fixture() {
  const a = await seedStoreContext({ firebaseUid: "qa-sec-1", email: "qa-sec-1@example.com" });
  const b = await seedStoreContext({ firebaseUid: "qa-sec-2", email: "qa-sec-2@example.com" });
  const catalogA = await seedCatalogFixture(a.store!.id);
  const catalogB = await seedCatalogFixture(b.store!.id);
  const staff = await prisma.user.create({ data: { firebaseUid: "qa-sec-3", email: "qa-sec-3@example.com", displayName: "QA STAFF" } });
  const member = await prisma.storeMember.create({ data: { storeId: a.store!.id, userId: staff.id, role: "STAFF", isDefault: true } });
  return {
    a, b, catalogA, catalogB, staff, member,
    owner: buildAuthHeaders({ uid: a.user.firebaseUid, email: a.user.email! }),
    foreign: buildAuthHeaders({ uid: b.user.firebaseUid, email: b.user.email! }),
    staffHeaders: buildAuthHeaders({ uid: staff.firebaseUid, email: staff.email! }),
  };
}

async function sell(headers: Record<string, string>, payload: Record<string, unknown> = {}) {
  const res = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
    deviceLabel: "QA equipo", amount: 1000, currency: "ARS", exchangeRate: 1000, status: "COMPLETADA", ...payload,
  } });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().sale as { id: string; amount: number };
}

describe("sales authorization and tenant isolation", () => {
  it.each([false, true])("denies ANULADA to staff without sensitive permission (integrated=%s)", async integrated => {
    const f = await fixture();
    const sale = integrated ? await sell(f.owner) : await prisma.sale.create({ data: {
      storeId: f.a.store!.id, dateLabel: "03/11/2026", soldAt: new Date(), deviceLabel: "QA histórica",
      amount: 1000, paymentMethod: "EFECTIVO", status: "COMPLETADA",
    } });
    const before = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    // Real loopback HTTP in addition to the injected request matrix below.
    const origin = await getApp().listen({ host: "127.0.0.1", port: 0 });
    const res = await fetch(`${origin}/api/sales/${sale.id}`, {
      method: "PATCH", headers: { ...f.staffHeaders, "content-type": "application/json" }, body: JSON.stringify({ status: "ANULADA" }),
    });
    expect([400, 403], await res.text()).toContain(res.status); // 400: validation (#724) rejects the alias; 403: permission. Nothing is written either way.
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toEqual(before);
  });

  it.each(["CANCELADA", "CANCELADO", "CANCELLED", "ANULADA", "ANULADO", " cancelada ", "anulada"])("denies cancellation alias %s in sale and nested trade edits", async status => {
    const f = await fixture();
    const sale = await sell(f.owner, { clientId: f.catalogA.client.id, tradeIn: { deviceReceived: "QA recibido", takeValue: 100 } });
    const storedSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    const tradeId = storedSale.tradeInId!;
    const before = await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } });
    const attempts = [
      { url: `/api/sales/${sale.id}`, payload: { status } },
      { url: `/api/sales/${sale.id}`, payload: { tradeIn: { deviceReceived: "QA recibido", takeValue: 100, status } } },
      { url: `/api/trade-ins/${tradeId}`, payload: { status } },
      { url: `/api/operations/sales/sales/${sale.id}`, payload: { tradeIn: { status } } },
      { url: `/api/operations/sales/trades/${tradeId}`, payload: { tradeIn: { status } } },
      { url: `/api/operations/tradeins/trades/${tradeId}`, payload: { tradeIn: { status } } },
    ];
    for (const attempt of attempts) {
      const res = await getApp().inject({ method: "PATCH", headers: f.staffHeaders, ...attempt });
      // Unknown status aliases are now rejected by validation (400, #724); known ones by permission (403). Either way nothing is written.
      expect.soft([400, 403], `${attempt.url}: ${res.body}`).toContain(res.statusCode);
    }
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toEqual(storedSale);
    expect(await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } })).toEqual(before);
  });

  it("denies spoofed cancelled states on create, draft edit and confirmation", async () => {
    const f = await fixture();
    const draft = await getApp().inject({ method: "POST", url: "/api/operations/tradeins", headers: f.owner, payload: {
      draft: true, clientId: f.catalogA.client.id, deviceLabel: "QA salida", amount: 1000,
      tradeIn: { deviceReceived: "QA recibido", takeValue: 100 },
    } });
    expect(draft.statusCode, draft.body).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    const before = await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } });
    const attempts = [
      { method: "POST" as const, url: "/api/sales", payload: { date: "03/11/2026", deviceLabel: "QA", amount: 1000, paymentMethod: "EFECTIVO", status: "ANULADA" } },
      { method: "POST" as const, url: "/api/trade-ins", payload: { deviceGiven: "QA salida", deviceReceived: "QA recibido", takeValue: 100, status: "CANCELADO" } },
      { method: "POST" as const, url: "/api/operations/sales", payload: { deviceLabel: "QA", clientId: f.catalogA.client.id, amount: 1000, tradeIn: { deviceReceived: "QA recibido", takeValue: 100, status: "CANCELLED" } } },
      { method: "PATCH" as const, url: `/api/operations/tradeins/trades/${tradeId}`, payload: { tradeIn: { status: "CANCELADO" } } },
      { method: "POST" as const, url: `/api/operations/tradeins/trades/${tradeId}/confirm`, payload: { tradeIn: { status: "CANCELADO" } } },
    ];
    for (const attempt of attempts) {
      const res = await getApp().inject({ headers: f.staffHeaders, ...attempt });
      // Unknown status aliases are now rejected by validation (400, #724); known ones by permission (403). Either way nothing is written.
      expect.soft([400, 403], `${attempt.url}: ${res.body}`).toContain(res.statusCode);
    }
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.tradeIn.count()).toBe(1);
    expect(await prisma.tradeIn.findUniqueOrThrow({ where: { id: tradeId } })).toEqual(before);
  });

  it.each(["owner", "staffHeaders"] as const)("isolates foreign resource IDs for %s without changing any foreign business row", async identity => {
    const f = await fixture();
    const sale = await sell(f.foreign, { clientId: f.catalogB.client.id, productId: f.catalogB.inventoryItem.id,
      status: "PENDIENTE", tradeIn: { deviceReceived: "QA privado B", takeValue: 100 } });
    const foreignSale = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    const tradeId = foreignSale.tradeInId!;
    const before = await tenantState(f.b.store!.id);
    const requests = [
      { method: "GET" as const, url: `/api/operations/sales/sales/${sale.id}` },
      { method: "PATCH" as const, url: `/api/sales/${sale.id}`, payload: { amount: 123 } },
      { method: "PATCH" as const, url: `/api/operations/sales/sales/${sale.id}`, payload: { amount: 123 } },
      { method: "GET" as const, url: `/api/accounts/sales/${sale.id}` },
      { method: "GET" as const, url: `/api/clients/${f.catalogB.client.id}/sales` },
      { method: "GET" as const, url: `/api/clients/${f.catalogB.client.id}/payments` },
      { method: "POST" as const, url: `/api/clients/${f.catalogB.client.id}/payments`, payload: { amount: 10, method: "EFECTIVO" } },
      { method: "GET" as const, url: `/api/clients/${f.catalogB.client.id}/deposits` },
      { method: "GET" as const, url: `/api/operations/tradeins/trades/${tradeId}` },
      { method: "PATCH" as const, url: `/api/trade-ins/${tradeId}`, payload: { takeValue: 20 } },
      { method: "PATCH" as const, url: `/api/operations/tradeins/trades/${tradeId}`, payload: { tradeIn: { takeValue: 20 } } },
      { method: "POST" as const, url: `/api/operations/tradeins/trades/${tradeId}/confirm`, payload: {} },
      { method: "POST" as const, url: "/api/accounts/collections", payload: { clientId: f.catalogA.client.id, saleId: sale.id, amount: 10, method: "EFECTIVO" } },
      { method: "POST" as const, url: `/api/accounts/clients/${f.catalogA.client.id}/movements`, payload: { saleId: sale.id, kind: "NOTA_CREDITO", amount: 10 } },
      { method: "POST" as const, url: `/api/accounts/clients/${f.catalogB.client.id}/movements`, payload: { kind: "CARGO", amount: 10 } },
    ];
    for (const request of requests) {
      const res = await getApp().inject({ headers: f[identity], ...request });
      expect([403, 404], `${request.url}: ${res.body}`).toContain(res.statusCode);
    }
    for (const url of [
      `/api/sales/${sale.id}`, `/api/trade-ins/${tradeId}`,
      `/api/operations/sales/sales/${sale.id}/cancel`, `/api/operations/sales/sales/${sale.id}/void`,
      `/api/sales/${sale.id}/restore`, `/api/operations/tradeins/trades/${tradeId}/cancel`, `/api/operations/tradeins/trades/${tradeId}/void`,
    ]) {
      const res = await getApp().inject({ method: url.endsWith(`/${sale.id}`) || url.endsWith(`/${tradeId}`) ? "DELETE" : "POST", url, headers: f[identity] });
      expect([403, 404], `${url}: ${res.body}`).toContain(res.statusCode);
    }
    expect(await tenantState(f.b.store!.id)).toEqual(before);
    expect(await prisma.sale.count({ where: { storeId: f.a.store!.id } })).toBe(0);
  });

  it("rejects foreign relations on creation, editing, draft editing and confirmation atomically", async () => {
    const f = await fixture();
    const own = await sell(f.owner, { clientId: f.catalogA.client.id });
    const draft = await getApp().inject({ method: "POST", url: "/api/operations/tradeins", headers: f.owner, payload: {
      draft: true, clientId: f.catalogA.client.id, deviceLabel: "QA salida", amount: 1000,
      tradeIn: { deviceReceived: "QA recibido", takeValue: 100 },
    } });
    expect(draft.statusCode, draft.body).toBe(201);
    const tradeId = draft.json().tradeIn.id as string;
    const beforeA = await tenantState(f.a.store!.id);
    const beforeB = await tenantState(f.b.store!.id);
    const relations = [
      { clientId: f.catalogB.client.id }, { productId: f.catalogB.inventoryItem.id },
      { sellerMemberId: f.b.membership!.id }, { saleCategoryId: f.catalogB.saleCategory.id },
    ];
    for (const relation of relations) {
      const attempts = [
        { method: "POST" as const, url: "/api/operations/sales", payload: { deviceLabel: "QA", amount: 1000, ...relation } },
        { method: "PATCH" as const, url: `/api/operations/sales/sales/${own.id}`, payload: relation },
        { method: "PATCH" as const, url: `/api/operations/tradeins/trades/${tradeId}`, payload: relation },
        { method: "POST" as const, url: `/api/operations/tradeins/trades/${tradeId}/confirm`, payload: relation },
      ];
      for (const attempt of attempts) {
        const res = await getApp().inject({ headers: f.staffHeaders, ...attempt });
        expect(res.statusCode, `${attempt.url}: ${res.body}`).toBe(404);
      }
    }
    for (const relation of [{ clientId: f.catalogB.client.id }, { productId: f.catalogB.inventoryItem.id }, { sellerMemberId: f.b.membership!.id }, { categoryId: f.catalogB.saleCategory.id }]) {
      const res = await getApp().inject({ method: "POST", url: "/api/sales", headers: f.owner, payload: {
        date: "03/11/2026", deviceLabel: "QA", amount: 1000, status: "COMPLETADA", paymentMethod: "EFECTIVO", ...relation,
      } });
      expect(res.statusCode, res.body).toBe(404);
    }
    for (const request of [
      { method: "PATCH" as const, url: `/api/trade-ins/${tradeId}`, payload: { clientId: f.catalogB.client.id } },
      { method: "PATCH" as const, url: `/api/trade-ins/${tradeId}`, payload: { categoryId: f.catalogB.tradeInCategory.id } },
      { method: "POST" as const, url: "/api/operations/tradeins", payload: { draft: true, amount: 1000, categoryId: f.catalogB.tradeInCategory.id, tradeIn: { deviceReceived: "QA", takeValue: 100 } } },
      { method: "POST" as const, url: "/api/sales/import", payload: { rows: [{ device: "QA", amount: "1000", currency: "USD", sellerMemberId: f.b.membership!.id }] } },
      { method: "PATCH" as const, url: "/api/sales/categories/bulk-move", payload: { itemIds: [own.id], categoryId: f.catalogB.saleCategory.id } },
      { method: "PATCH" as const, url: "/api/trade-ins/categories/bulk-move", payload: { itemIds: [tradeId], categoryId: f.catalogB.tradeInCategory.id } },
    ]) {
      const res = await getApp().inject({ headers: f.owner, ...request });
      expect(res.statusCode, `${request.url}: ${res.body}`).toBe(404);
    }
    expect(await tenantState(f.a.store!.id)).toEqual(beforeA);
    expect(await tenantState(f.b.store!.id)).toEqual(beforeB);
  });

  it("rejects another client's sale, foreign deposits and foreign credit notes without collecting or applying funds", async () => {
    const f = await fixture();
    const own = await sell(f.owner, { clientId: f.catalogA.client.id, status: "PENDIENTE", tenders: [{ amount: 100, currency: "ARS", method: "EFECTIVO" }],
      installments: { count: 2, frequency: "MENSUAL", firstDueDate: "2026-12-01" } });
    const other = await prisma.client.create({ data: { storeId: f.a.store!.id, name: "QA otro cliente" } });
    const deposit = await getApp().inject({ method: "POST", url: `/api/clients/${f.catalogB.client.id}/deposits`, headers: f.foreign,
      payload: { amount: 100, currency: "ARS", exchangeRate: 1000, method: "EFECTIVO", requestKey: "qa-sec-deposit" } });
    expect(deposit.statusCode, deposit.body).toBe(201);
    const claim = await prisma.returnCase.create({ data: { storeId: f.b.store!.id, clientId: f.catalogB.client.id, caseNumber: 1, reason: "QA", openedAt: new Date() } });
    const credit = await prisma.creditNote.create({ data: { storeId: f.b.store!.id, clientId: f.catalogB.client.id, returnCaseId: claim.id, amount: 100, currency: "ARS", remaining: 100 } });
    const beforeA = await tenantState(f.a.store!.id);
    const beforeB = await tenantState(f.b.store!.id);
    for (const clientId of [other.id, f.catalogB.client.id]) {
      const res = await getApp().inject({ method: "POST", url: "/api/accounts/collections", headers: f.owner, payload: { clientId, saleId: own.id, amount: 10, method: "EFECTIVO" } });
      expect(res.statusCode, res.body).toBe(404);
    }
    for (const extra of [{ depositIds: [deposit.json().deposit.id] }, { creditNoteIds: [credit.id] }]) {
      const res = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers: f.owner,
        payload: { clientId: f.catalogA.client.id, deviceLabel: "QA", amount: 1000, ...extra } });
      expect([400, 404, 409], res.body).toContain(res.statusCode);
    }
    expect(await tenantState(f.a.store!.id)).toEqual(beforeA);
    expect(await tenantState(f.b.store!.id)).toEqual(beforeB);
  });

  it("keeps listings, account details, options, reports and export sources inside the membership store", async () => {
    const f = await fixture();
    const own = await sell(f.owner, { clientId: f.catalogA.client.id, status: "PENDIENTE", amount: 300,
      tenders: [{ amount: 100, currency: "ARS", method: "EFECTIVO" }], installments: { count: 2, frequency: "MENSUAL", firstDueDate: "2026-12-01" } });
    await prisma.client.update({ where: { id: f.catalogB.client.id }, data: { name: "QA_PRIVADO_B" } });
    const foreign = await sell(f.foreign, { clientId: f.catalogB.client.id, deviceLabel: "QA_PRIVADO_B", amount: 7777,
      sellerMemberId: f.b.membership!.id, tradeIn: { deviceReceived: "QA_PRIVADO_B", takeValue: 100 } });
    const foreignSale = await prisma.sale.findUniqueOrThrow({ where: { id: foreign.id } });
    for (const path of ["/api/sales", "/api/trade-ins", "/api/operations/sales/options", "/api/operations/tradeins/drafts", "/api/accounts/debtors", "/api/accounts/follow-ups",
      `/api/accounts/sales/${own.id}`, `/api/clients/${f.catalogA.client.id}/sales`, `/api/clients/${f.catalogA.client.id}/payments`]) {
      // Query/body/header store selectors cannot override the resolved default membership.
      const res = await getApp().inject({ url: `${path}?storeId=${f.b.store!.id}`, headers: { ...f.owner, "x-store-id": f.b.store!.id } });
      expect(res.statusCode, `${path}: ${res.body}`).toBe(200);
      for (const privateValue of [foreign.id, foreignSale.tradeInId!, f.catalogB.client.id, f.catalogB.inventoryItem.id, "QA_PRIVADO_B"]) expect(res.body).not.toContain(privateValue);
    }
    const overview = await getApp().inject({ url: `/api/reports/overview?rangeKey=all_time&storeId=${f.b.store!.id}`, headers: f.staffHeaders });
    expect(overview.statusCode, overview.body).toBe(200); // #691 remains effective for STAFF.
    expect(overview.json().overview.summary.revenue).toBe(300);
    expect(overview.body).not.toContain("QA_PRIVADO_B");
    const commissions = await getApp().inject({ url: "/api/reports/commissions?from=2026-11&to=2026-11", headers: f.owner });
    expect(commissions.statusCode, commissions.body).toBe(200);
    expect(commissions.body).not.toContain(f.b.membership!.id);
    const staff = await getApp().inject({ url: "/api/commissions", headers: f.staffHeaders });
    expect(staff.statusCode).toBe(403);
  });

  it("rejects foreign commission references, payments and bulk seller assignment", async () => {
    const f = await fixture();
    const own = await sell(f.owner);
    const foreign = await sell(f.foreign);
    const payment = await getApp().inject({ method: "POST", url: "/api/commissions/payments", headers: f.foreign,
      payload: { memberId: f.b.membership!.id, period: "2026-11", amount: 10, currency: "ARS", exchangeRate: 1000, settlesCurrency: "ARS" } });
    expect(payment.statusCode, payment.body).toBe(201);
    const rule = await getApp().inject({ method: "POST", url: "/api/commissions/rules", headers: f.foreign, payload: { rate: 10, effectiveFrom: "2026-11-01" } });
    expect(rule.statusCode, rule.body).toBe(201);
    const beforeA = await tenantState(f.a.store!.id);
    const beforeB = await tenantState(f.b.store!.id);
    for (const request of [
      { method: "GET" as const, url: `/api/commissions/members/${f.b.membership!.id}` },
      { method: "GET" as const, url: `/api/commissions/payments?memberId=${f.b.membership!.id}` },
      { method: "POST" as const, url: "/api/commissions/payments", payload: { memberId: f.b.membership!.id, period: "2026-11", amount: 10, currency: "ARS", exchangeRate: 1000, settlesCurrency: "ARS" } },
      { method: "POST" as const, url: `/api/commissions/payments/${payment.json().payment.id}/void` },
      { method: "PATCH" as const, url: `/api/commissions/rules/${rule.json().rule.id}`, payload: { rate: 20 } },
      { method: "DELETE" as const, url: `/api/commissions/rules/${rule.json().rule.id}` },
      { method: "POST" as const, url: "/api/commissions/rules", payload: { rate: 10, effectiveFrom: "2026-11-01", memberId: f.b.membership!.id } },
      { method: "PATCH" as const, url: "/api/commissions/sales/seller", payload: { saleIds: [own.id], sellerMemberId: f.b.membership!.id } },
      { method: "PATCH" as const, url: "/api/commissions/sales/seller", payload: { saleIds: [own.id, foreign.id], sellerMemberId: f.member.id } },
    ]) {
      const res = await getApp().inject({ headers: f.owner, ...request });
      expect(res.statusCode, `${request.url}: ${res.body}`).toBe(404);
    }
    expect(await tenantState(f.a.store!.id)).toEqual(beforeA);
    expect(await tenantState(f.b.store!.id)).toEqual(beforeB);
    expect((await prisma.commissionPayment.findUniqueOrThrow({ where: { id: payment.json().payment.id } })).voidedAt).toBeNull();
    expect(Number((await prisma.commissionRule.findUniqueOrThrow({ where: { id: rule.json().rule.id } })).rate)).toBe(10);
  });

  it("scopes category mutations and bulk operations even when the batch contains foreign IDs", async () => {
    const f = await fixture();
    const own = await sell(f.owner);
    const foreign = await sell(f.foreign, { clientId: f.catalogB.client.id, tradeIn: { deviceReceived: "QA B", takeValue: 100 } });
    const tradeId = (await prisma.sale.findUniqueOrThrow({ where: { id: foreign.id } })).tradeInId!;
    const before = await tenantState(f.b.store!.id);
    for (const [prefix, id, foreignCategory, ownCategory] of [
      ["sales", foreign.id, f.catalogB.saleCategory.id, f.catalogA.saleCategory.id],
      ["trade-ins", tradeId, f.catalogB.tradeInCategory.id, f.catalogA.tradeInCategory.id],
    ]) {
      for (const method of ["PATCH", "DELETE"] as const) {
        const res = await getApp().inject({ method, url: `/api/${prefix}/categories/${foreignCategory}`, headers: f.owner, ...(method === "PATCH" ? { payload: { name: "QA cambiado" } } : {}) });
        expect(res.statusCode, res.body).toBe(404);
      }
      const reordered = await getApp().inject({ method: "PATCH", url: `/api/${prefix}/categories/reorder`, headers: f.owner, payload: { categoryIds: [foreignCategory, ownCategory] } });
      expect(reordered.statusCode, reordered.body).toBe(204);
      const moved = await getApp().inject({ method: "PATCH", url: `/api/${prefix}/categories/bulk-move`, headers: f.owner,
        payload: { itemIds: [id, ...(prefix === "sales" ? [own.id] : [])], categoryId: ownCategory } });
      expect(moved.statusCode, moved.body).toBe(prefix === "sales" ? 200 : 204);
      if (prefix === "sales") expect(moved.json().count).toBe(1);
    }
    expect(await tenantState(f.b.store!.id)).toEqual(before);
    expect((await prisma.saleCategory.findUniqueOrThrow({ where: { id: f.catalogB.saleCategory.id } })).name).toBe(f.catalogB.saleCategory.name);
    expect((await prisma.tradeInCategory.findUniqueOrThrow({ where: { id: f.catalogB.tradeInCategory.id } })).name).toBe(f.catalogB.tradeInCategory.name);
  });

  it("requires authentication, an active membership and section access on alternate paths", async () => {
    const f = await fixture();
    const sale = await sell(f.owner);
    for (const url of ["/api/sales", "/api/trade-ins", "/api/accounts/debtors", "/api/commissions/sellers", `/api/operations/sales/sales/${sale.id}`]) {
      expect((await getApp().inject({ url })).statusCode).toBe(401);
    }
    const noStore = await seedStoreContext({ firebaseUid: "qa-sec-4", email: "qa-sec-4@example.com", createStore: false });
    const outsider = buildAuthHeaders({ uid: noStore.user.firebaseUid, email: noStore.user.email! });
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { sections: [] } });
    for (const headers of [outsider, f.staffHeaders]) {
      for (const url of ["/api/sales", "/api/trade-ins", "/api/accounts/debtors", `/api/operations/sales/sales/${sale.id}`]) {
        expect((await getApp().inject({ url, headers })).statusCode, url).toBe(403);
      }
    }
  });

  it("ignores mass assignment while allowing legitimate staff pricing, seller selection, collection and technical state edits", async () => {
    const f = await fixture();
    const sale = await sell(f.staffHeaders, { productId: f.catalogA.inventoryItem.id, clientId: f.catalogA.client.id, sellerMemberId: f.member.id,
      amount: 1200, status: "PENDIENTE", storeId: f.b.store!.id, registeredByUserId: f.b.user.id, userId: f.b.user.id, role: "OWNER",
      createdAt: "2000-01-01T00:00:00Z", voidedAt: "2000-01-01T00:00:00Z", cancellationSnapshot: { status: "COMPLETADA" },
      openBalance: 0, stockDeducted: false, tradeInId: "foreign-trade", inventoryItemId: f.catalogB.inventoryItem.id });
    const stored = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored).toMatchObject({ storeId: f.a.store!.id, registeredByUserId: f.staff.id, sellerMemberId: f.member.id, status: "PENDIENTE", inventoryItemId: f.catalogA.inventoryItem.id,
      amount: expect.anything(), tradeInId: null, stockDeducted: true, voidedAt: null, cancellationSnapshot: null, openBalance: null });
    expect(Number(stored.amount)).toBe(1200);
    expect(stored.createdAt.getUTCFullYear()).not.toBe(2000);
    const edited = await getApp().inject({ method: "PATCH", url: `/api/sales/${sale.id}`, headers: f.staffHeaders, payload: {
      amount: 1100, storeId: f.b.store!.id, registeredByUserId: f.b.user.id, voidedAt: "2000-01-01T00:00:00Z", sellerMemberId: f.member.id,
      tradeIn: { deviceReceived: "QA recibido", takeValue: 100, status: "RECHAZADO" },
    } });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json().tradeIn.status).toBe("RECHAZADO");
    const collected = await getApp().inject({ method: "POST", url: "/api/accounts/collections", headers: f.staffHeaders,
      payload: { clientId: f.catalogA.client.id, saleId: sale.id, amount: 100, method: "EFECTIVO" } });
    expect(collected.statusCode, collected.body).toBe(201);
    expect(await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).toMatchObject({ storeId: f.a.store!.id, registeredByUserId: f.staff.id, voidedAt: null });
  });

  it.each([
    { role: "STAFF" as const, sensitiveAccess: null, allowed: false },
    { role: "STAFF" as const, sensitiveAccess: true, allowed: true },
    { role: "MANAGER" as const, sensitiveAccess: null, allowed: true },
    { role: "MANAGER" as const, sensitiveAccess: false, allowed: false },
    { role: "OWNER" as const, sensitiveAccess: false, allowed: true },
  ])("preserves sensitive permissions for $role/$sensitiveAccess", async ({ role, sensitiveAccess, allowed }) => {
    const f = await fixture();
    await prisma.storeMember.update({ where: { id: f.member.id }, data: { role, sensitiveAccess } });
    const sale = await sell(f.owner);
    const res = await getApp().inject({ method: "PATCH", url: `/api/sales/${sale.id}`, headers: f.staffHeaders, payload: { status: "CANCELADA" } });
    expect(res.statusCode, res.body).toBe(allowed ? 200 : 403);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe(allowed ? "CANCELADA" : "COMPLETADA");
  });
});

async function tenantState(storeId: string) {
  const where = { storeId };
  return Promise.all([
    prisma.sale.findMany({ where, orderBy: { id: "asc" } }), prisma.tradeIn.findMany({ where, orderBy: { id: "asc" } }),
    prisma.client.findMany({ where, orderBy: { id: "asc" } }), prisma.inventoryItem.findMany({ where, orderBy: { id: "asc" } }),
    prisma.clientPayment.findMany({ where, orderBy: { id: "asc" } }), prisma.clientDeposit.findMany({ where, orderBy: { id: "asc" } }),
    prisma.saleTender.findMany({ where, orderBy: { id: "asc" } }), prisma.saleInstallment.findMany({ where, orderBy: { id: "asc" } }),
    prisma.commissionAccrual.findMany({ where, orderBy: { id: "asc" } }), prisma.cashMovement.findMany({ where, orderBy: { id: "asc" } }),
    prisma.creditNote.findMany({ where, orderBy: { id: "asc" } }), prisma.creditNoteApplication.findMany({ where, orderBy: { id: "asc" } }),
  ]);
}
