import { describe, expect, it } from "vitest";
import { formatArDate, parseArDate } from "../../lib/ar-date.js";
import {
  addCalendarDays,
  coverageState,
  defaultSaleWarrantyDays,
  isSealedCondition,
  repairDaysFromStore,
  saleDaysFromStore,
  warrantyUntil,
} from "./warranty.js";

describe("warranty days", () => {
  it("treats nuevo as sealed and every other condition as used", () => {
    expect(isSealedCondition("NUEVO")).toBe(true);
    expect(isSealedCondition("Sellado")).toBe(true);
    expect(isSealedCondition("USADO")).toBe(false);
    expect(isSealedCondition("OUTLET")).toBe(false);
    expect(isSealedCondition("")).toBe(false);
    expect(defaultSaleWarrantyDays("NUEVO", { usedWarrantyDays: 10, sealedWarrantyDays: 40 })).toBe(40);
    expect(defaultSaleWarrantyDays("PRE-OWNED", { usedWarrantyDays: 10, sealedWarrantyDays: 40 })).toBe(10);
  });

  it("keeps an explicit day count, including zero", () => {
    expect(saleDaysFromStore(0, "NUEVO", { usedWarrantyDays: 10, sealedWarrantyDays: 40 })).toBe(0);
    expect(saleDaysFromStore(undefined, "NUEVO", null)).toBe(90);
    expect(repairDaysFromStore(undefined, { repairWarrantyDays: 7 })).toBe(7);
    expect(repairDaysFromStore(undefined, null)).toBe(30);
  });

  it("moves the end date with the start date and covers the last day", () => {
    const first = warrantyUntil(parseArDate("01/10/2026"), 10);
    const shifted = warrantyUntil(parseArDate("05/10/2026"), 10);
    expect(formatArDate(first!)).toBe("11/10/2026");
    expect(formatArDate(shifted!)).toBe("15/10/2026");
    expect(coverageState(first, parseArDate("11/10/2026")!)).toBe("vigente");
    expect(coverageState(first, parseArDate("12/10/2026")!)).toBe("vencida");
    expect(warrantyUntil(parseArDate("01/10/2026"), 0)).toBeNull();
    expect(coverageState(null, new Date(), true)).toBe("pendiente");
  });

  it("crosses February in leap and common years", () => {
    expect(formatArDate(addCalendarDays(parseArDate("28/02/2024")!, 1))).toBe("29/02/2024");
    expect(formatArDate(addCalendarDays(parseArDate("28/02/2025")!, 1))).toBe("01/03/2025");
  });
});
