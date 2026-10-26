import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("vendedor y garantía del canje pendiente", () => {
  it.each([90, 0])("conserva vendedor y garantía %s al guardar, listar, editar y confirmar", async (warrantyDays) => {
    const c = await seedStoreContext();
    const f = await seedCatalogFixture(c.store!.id);
    const sellerMemberId = c.membership!.id;
    const headers = buildAuthHeaders();
    const app = getApp();
    const rule = await app.inject({ method: "POST", url: "/api/commissions/rules", headers, payload: {
      basis: "SALE_PERCENT", rate: 2, effectiveFrom: "2025-01-01T00:00:00Z",
    } });
    expect(rule.statusCode, rule.body).toBe(201);
    const draft = await app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
      clientId: f.client.id, productId: f.inventoryItem.id, amount: 675, currency: "ARS", draft: true,
      sellerMemberId, warrantyDays, tradeIn: { deviceReceived: "iPhone ficticio", takeValue: 200 },
    } });
    expect(draft.statusCode, draft.body).toBe(201);
    const id = draft.json().tradeIn.id as string;
    expect(draft.json().tradeIn).toMatchObject({ draftSellerMemberId: sellerMemberId, draftWarrantyDays: warrantyDays });
    const listed = await app.inject({ url: "/api/operations/tradeins/drafts", headers });
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.json().tradeIns).toContainEqual(expect.objectContaining({ id, draftSellerMemberId: sellerMemberId, draftWarrantyDays: warrantyDays }));
    const all = await app.inject({ url: "/api/trade-ins", headers });
    expect(all.json().tradeIns).toContainEqual(expect.objectContaining({ id, draftSellerMemberId: sellerMemberId, draftWarrantyDays: warrantyDays }));
    const edited = await app.inject({ method: "PATCH", url: `/api/operations/tradeins/trades/${id}`, headers, payload: { amount: 700 } });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json().tradeIn).toMatchObject({ draftSellerMemberId: sellerMemberId, draftWarrantyDays: warrantyDays });
    const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${id}/confirm`, headers, payload: {} });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().sale).toMatchObject({ sellerMemberId, warrantyDays });
    const saved = await prisma.sale.findUniqueOrThrow({ where: { id: confirmed.json().sale.id } });
    expect(saved.sellerMemberId).toBe(sellerMemberId);
    expect(saved.warrantyDays).toBe(warrantyDays);
    const accrual = await prisma.commissionAccrual.findFirstOrThrow({ where: { sourceSaleId: saved.id, voidedAt: null } });
    expect(accrual.memberId).toBe(sellerMemberId);
    expect(Number(accrual.commission)).toBe(14);
  });
});

it("permite cambiar y quitar vendedor, y respeta overrides al confirmar", async () => {
  const c = await seedStoreContext(); const f = await seedCatalogFixture(c.store!.id);
  const other = await seedStoreContext({ firebaseUid: "otro", email: "otro@example.com" });
  const app = getApp(); const headers = buildAuthHeaders();
  const create = (sellerMemberId: string) => app.inject({ method: "POST", url: "/api/operations/tradeins", headers, payload: {
    clientId: f.client.id, productId: f.inventoryItem.id, amount: 675, currency: "ARS", draft: true,
    sellerMemberId, warrantyDays: 90, tradeIn: { deviceReceived: "Equipo ficticio", takeValue: 200 },
  } });
  expect((await create(other.membership!.id)).statusCode).toBe(404);
  const draft = await create(c.membership!.id);
  expect(draft.statusCode, draft.body).toBe(201);
  const id = draft.json().tradeIn.id as string;
  const edit = (payload: Record<string, unknown>) => app.inject({ method: "PATCH", url: `/api/operations/tradeins/trades/${id}`, headers, payload });
  expect((await edit({ sellerMemberId: other.membership!.id })).statusCode).toBe(404);
  const cleared = await edit({ sellerMemberId: null, warrantyDays: 0 });
  expect(cleared.json().tradeIn).toMatchObject({ draftSellerMemberId: null, draftWarrantyDays: 0 });
  const confirmed = await app.inject({ method: "POST", url: `/api/operations/tradeins/trades/${id}/confirm`, headers, payload: { sellerMemberId: c.membership!.id, warrantyDays: 60 } });
  expect(confirmed.statusCode, confirmed.body).toBe(200);
  expect(confirmed.json().sale).toMatchObject({ sellerMemberId: c.membership!.id, warrantyDays: 60 });
});
