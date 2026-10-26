import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("QA 06: final collection of a partial sale", () => {
  it.each(["operation", "legacy", "installments", "ARS"])("collects only this sale's open balance and records it once (%s)", async (mode) => {
    const { store } = await seedStoreContext();
    await prisma.store.update({ where: { id: store!.id }, data: { currency: "USD" } });
    const client = await prisma.client.create({ data: { storeId: store!.id, name: "Bruno Parciales QA", balanceCurrency: "USD" } });
    const headers = buildAuthHeaders();
    const currency = mode === "ARS" ? "ARS" : "USD";
    const scale = currency === "ARS" ? 1250 : 1;
    const created = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: client.id, deviceLabel: "iPhone QA14", amount: 1000 * scale, currency, exchangeRate: 1250,
      ...(mode === "installments"
        ? { installments: { count: 3, frequency: "MENSUAL", firstDueDate: "2026-11-11", collectFirstNow: true, firstMethod: "EFECTIVO" } }
        : { tenders: [{ amount: 400 * scale, currency, method: "EFECTIVO" }] }),
    } });
    expect(created.statusCode, created.body).toBe(201);
    const sale = created.json().sale;
    const remaining = mode === "installments" ? 666.67 : 600;
    const other = await getApp().inject({ method: "POST", url: "/api/operations/sales", headers, payload: {
      clientId: client.id, deviceLabel: "iPhone QA15", amount: 500, currency: "USD", status: "PENDIENTE",
    } });
    expect(other.statusCode, other.body).toBe(201);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).pendingBalance)).toBe(remaining + 500);
    const url = mode === "legacy" ? `/api/sales/${sale.id}` : `/api/operations/sales/sales/${sale.id}`;
    const collect = () => getApp().inject({ method: "PATCH", url, headers, payload: { status: "COMPLETADA", paymentMethod: "EFECTIVO" } });
    const paid = await collect();
    expect(paid.statusCode, paid.body).toBe(200);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).pendingBalance)).toBe(500);
    expect(paid.json().sale).toMatchObject({ status: "COMPLETADA", openBalance: 0 });
    const history = await getApp().inject({ url: `/api/clients/${client.id}/payments`, headers });
    expect(history.statusCode).toBe(200);
    const payments = history.json().payments.filter((row: { saleId: string }) => row.saleId === sale.id);
    expect(payments).toHaveLength(2);
    expect(payments).toEqual(expect.arrayContaining([expect.objectContaining({ amount: remaining * scale, currency, kind: "PAGO" })]));
    expect(payments.reduce((total: number, row: { amount: number }) => total + row.amount, 0)).toBe(1000 * scale);
    const repeated = await collect();
    expect(repeated.statusCode, repeated.body).toBe(200);
    expect(await prisma.clientPayment.count({ where: { saleId: sale.id } })).toBe(2);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).pendingBalance)).toBe(500);
    if (mode === "installments") {
      const rows = await prisma.saleInstallment.findMany({ where: { saleId: sale.id } });
      expect(rows.every((row) => row.paidAmount.equals(row.amount))).toBe(true);
    }
  });
});
