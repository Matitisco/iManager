import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  applyCoverage,
  balanceTone,
  calendarDays,
  convertTender,
  installmentStatus,
  monthDayWithin,
  priceRiseDebt,
  settleTenders,
  splitInstallments,
  unpaidInstallments,
} from "./ledger.js";

describe("account ledger", () => {
  it("paints day 7 yellow and keeps the other thresholds", () => {
    expect(balanceTone(0)).toBe("verde");
    expect(balanceTone(6)).toBe("verde");
    expect(balanceTone(7)).toBe("amarillo");
    expect(balanceTone(30)).toBe("amarillo");
    expect(balanceTone(31)).toBe("rojo");
    expect(calendarDays("2026-10-01", "2026-10-08")).toBe(7);
  });

  it("shows a general payment on the oldest unpaid installment", () => {
    const rows = [
      { sequence: 1, dueDate: "2026-11-14", amount: 50, paidAmount: 0 },
      { sequence: 2, dueDate: "2026-12-14", amount: 50, paidAmount: 0 },
    ];
    expect(applyCoverage(rows, 30)).toEqual([
      { sequence: 1, dueDate: "2026-11-14", amount: 50, paidAmount: 30 },
      { sequence: 2, dueDate: "2026-12-14", amount: 50, paidAmount: 0 },
    ]);
    expect(rows[0]?.paidAmount).toBe(0);
  });

  it("splits a surcharge across installments and can collect the first one", () => {
    const rows = splitInstallments({
      financed: 1000,
      count: 3,
      surcharge: 1,
      firstDue: "2026-11-01",
      frequency: "MENSUAL",
      collectFirst: true,
    });
    expect(rows.map((row) => row.amount)).toEqual([333.66, 333.66, 333.68]);
    expect(rows[0]).toMatchObject({ paidAmount: 333.66, dueDate: "2026-11-01" });
    expect(rows[1]?.dueDate).toBe("2026-12-01");
    expect(rows[2]?.dueDate).toBe("2027-01-01");
    expect(unpaidInstallments(rows)).toBe(667.34);
    expect(installmentStatus(rows[0]!, "2026-11-02")).toBe("PAGADA");
    expect(installmentStatus({ ...rows[1]!, paidAmount: 10 }, "2026-11-02")).toBe("PARCIAL");
    expect(installmentStatus(rows[1]!, "2026-12-02")).toBe("VENCIDA");
  });

  it("applies a payment to the oldest unpaid installment first", () => {
    const allocated = allocatePayment([
      { sequence: 2, dueDate: "2026-12-01", amount: 100, paidAmount: 0 },
      { sequence: 1, dueDate: "2026-11-01", amount: 100, paidAmount: 40 },
    ], 80);
    expect(allocated.applied).toBe(80);
    expect(allocated.rows.find((row) => row.sequence === 1)?.paidAmount).toBe(100);
    expect(allocated.rows.find((row) => row.sequence === 2)?.paidAmount).toBe(20);
  });

  it("converts mixed tenders and resolves an excess in the three allowed ways", () => {
    expect(convertTender(10, "USD", "ARS", 1000)).toBe(10000);
    expect(convertTender(1000, "ARS", "USD", 1000)).toBe(1);
    expect(() => convertTender(10, "USD", "ARS", null)).toThrow(/cotización/);
    expect(settleTenders(100, [80], "OMIT")).toMatchObject({ shortfall: 20, credit: 0, change: 0 });
    expect(settleTenders(100, [150], "OMIT").recorded).toEqual([100]);
    expect(settleTenders(100, [150], "CREDIT")).toMatchObject({ credit: 50, change: 0, shortfall: 0 });
    expect(settleTenders(100, [70, 50], "CHANGE")).toMatchObject({ change: 20, credit: 0 });
  });

  it("turns only a closed sale price increase into client debt", () => {
    expect(priceRiseDebt({ priorAmount: 1000, nextAmount: 1300, priorDue: 1000, nextDue: 1300, priorStatus: "COMPLETADA", hasClient: true })).toEqual({ extra: 300, reopen: true });
    expect(priceRiseDebt({ priorAmount: 1000, nextAmount: 1300, priorDue: 1000, nextDue: 800, priorStatus: "COMPLETADA", hasClient: true })).toEqual({ extra: 0, reopen: false });
    expect(priceRiseDebt({ priorAmount: 1000, nextAmount: 1300, priorDue: 1000, nextDue: 1300, priorStatus: "COMPLETADA", hasClient: false }).error).toMatch(/cliente/);
    expect(priceRiseDebt({ priorAmount: 1000, nextAmount: 1300, priorDue: 1000, nextDue: 1300, priorStatus: "PENDIENTE", hasClient: true }).reopen).toBe(false);
  });

  it("matches a birthday inside the lead window, including the year boundary", () => {
    expect(monthDayWithin("1990-01-02", "2026-12-30", 7)).toBe(true);
    expect(monthDayWithin("1990-01-02", "2026-12-20", 7)).toBe(false);
    expect(monthDayWithin("1990-10-14", "2026-10-14", 0)).toBe(true);
  });
});
