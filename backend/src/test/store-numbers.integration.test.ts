import { describe, expect, it } from "vitest";
import { createOperation } from "../modules/operations/operations.service.js";
import { createSale, deleteSale } from "../modules/sales/sales.service.js";
import { createTradeIn } from "../modules/trade-ins/trade-ins.service.js";
import { prisma } from "../plugins/prisma.js";
import { useIntegrationApp } from "./integration-helpers.js";
import { seedStoreContext } from "./db.js";

useIntegrationApp();

const saleInput = (label: string) => ({
  date: "07/10/2026",
  clientName: "Mostrador",
  deviceLabel: label,
  amount: 100,
  paymentMethod: "EFECTIVO",
  status: "COMPLETADA",
});

describe("per-store receipt numbers", () => {
  it("numbers each store from 1 without sharing or duplicating concurrent sales", async () => {
    const first = await seedStoreContext({ firebaseUid: "numbers-a", email: "numbers-a@example.com" });
    const second = await seedStoreContext({ firebaseUid: "numbers-b", email: "numbers-b@example.com" });
    const storeA = first.store!.id;
    const storeB = second.store!.id;

    const created = await Promise.all([
      ...Array.from({ length: 8 }, (_, index) => createSale(storeA, saleInput(`A${index}`))),
      ...Array.from({ length: 3 }, (_, index) => createSale(storeB, saleInput(`B${index}`))),
    ]);

    const numbersA = created.filter((sale) => sale.deviceLabel.startsWith("A")).map((sale) => sale.saleNumber).sort((a, b) => a - b);
    const numbersB = created.filter((sale) => sale.deviceLabel.startsWith("B")).map((sale) => sale.saleNumber).sort((a, b) => a - b);
    expect(numbersA).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(numbersB).toEqual([1, 2, 3]);
  });

  it("keeps an already issued number and continues after the highest one in that store", async () => {
    const context = await seedStoreContext({ firebaseUid: "numbers-legacy", email: "numbers-legacy@example.com" });
    const storeId = context.store!.id;
    const legacy = await prisma.sale.create({
      data: {
        storeId,
        saleNumber: 6,
        clientName: "Comprobante viejo",
        dateLabel: "01/01/2026",
        amount: 10,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        soldAt: new Date("2026-01-01T15:00:00.000Z"),
      },
    });

    const next = await createSale(storeId, saleInput("Nueva"));
    expect(next.saleNumber).toBe(7);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: legacy.id } })).saleNumber).toBe(6);
  });

  it("does not reuse a sale number after the receipt is deleted", async () => {
    const context = await seedStoreContext({ firebaseUid: "numbers-delete", email: "numbers-delete@example.com" });
    const storeId = context.store!.id;
    const first = await createSale(storeId, saleInput("Primera"));
    expect(first.saleNumber).toBe(1);
    expect(await deleteSale(storeId, first.id)).toBe(true);
    const second = await createSale(storeId, saleInput("Segunda"));
    expect(second.saleNumber).toBe(2);
  });

  it("numbers trade-ins independently from sales, including integrated operations", async () => {
    const context = await seedStoreContext({ firebaseUid: "numbers-ops", email: "numbers-ops@example.com" });
    const storeId = context.store!.id;
    const operation = await createOperation(storeId, "sales", {
      date: "07/10/2026",
      clientName: "Ana",
      deviceLabel: "iPhone 11",
      amount: 1000,
      paymentMethod: "EFECTIVO",
      status: "COMPLETADA",
      tradeIn: {
        deviceReceived: "iPhone 8",
        takeValue: 200,
      },
    });

    if (!("sale" in operation) || !operation.tradeIn) {
      throw new Error("La operación confirmada no devolvió venta y canje");
    }
    expect(operation.sale.saleNumber).toBe(1);
    expect(operation.tradeIn.tradeNumber).toBe(1);

    const trade = await createTradeIn(storeId, {
      clientName: "Luis",
      deviceReceived: "Moto G",
      deviceGiven: "iPhone 12",
    });
    expect(trade.tradeNumber).toBe(2);

    const other = await seedStoreContext({ firebaseUid: "numbers-ops-b", email: "numbers-ops-b@example.com" });
    const otherTrade = await createTradeIn(other.store!.id, {
      clientName: "Mia",
      deviceReceived: "A14",
      deviceGiven: "A54",
    });
    expect(otherTrade.tradeNumber).toBe(1);
  });
});
