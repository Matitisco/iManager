import { describe, expect, it } from "vitest";
import { commissionForSale, convert, currentPeriodKey, monthBounds, nextPeriod, projectBalance, ruleForSale, type RuleSnapshot } from "./commission-math.js";

const sale = { sellerMemberId: "seller", status: "COMPLETADA", amount: 1000, cost: 500, takeValue: 200, currency: "USD" as const, exchangeRate: 1200 };
const rule = (overrides: Partial<RuleSnapshot> = {}): RuleSnapshot => ({ id: "team", memberId: null, basis: "PROFIT_PERCENT", rate: 10, currency: null,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z"), ...overrides });

describe("commission calculation", () => {
  it("subtracts equipment cost and the taken trade value for profit", () => {
    expect(commissionForSale(sale, rule())).toBe(30);
    expect(commissionForSale({ ...sale, amount: 600 }, rule())).toBe(0);
  });
  it("calculates percentage of sale and fixed unit amount in sale currency", () => {
    expect(commissionForSale(sale, rule({ basis: "SALE_PERCENT" }))).toBe(100);
    expect(commissionForSale(sale, rule({ basis: "FIXED_PER_UNIT", rate: 12000, currency: "ARS" }))).toBe(10);
    expect(commissionForSale({ ...sale, currency: "ARS" }, rule({ basis: "FIXED_PER_UNIT", rate: 10, currency: "USD" }))).toBe(12000);
  });
  it("keeps cents rather than rounding commissions to whole pesos", () => {
    expect(commissionForSale({ ...sale, amount: 100.55 }, rule({ basis: "SALE_PERCENT", rate: 2.5 }))).toBe(2.51);
  });
  it("ignores unassigned, cancelled sales and missing rules", () => {
    expect(commissionForSale({ ...sale, sellerMemberId: null }, rule())).toBe(0);
    expect(commissionForSale({ ...sale, status: "CANCELADA" }, rule())).toBe(0);
    expect(commissionForSale({ ...sale, status: "CANCELLED" }, rule())).toBe(0);
    expect(commissionForSale(sale, null)).toBe(0);
  });
  it("uses the latest effective personal rule before the team rule", () => {
    const rules = [rule(), rule({ id: "new-team", rate: 20, effectiveFrom: new Date("2026-02-01") }),
      rule({ id: "personal", memberId: "seller", rate: 15 }),
      rule({ id: "future", memberId: "seller", rate: 30, effectiveFrom: new Date("2026-03-01") })];
    expect(ruleForSale(rules, "seller", new Date("2026-02-10"))?.id).toBe("personal");
    expect(ruleForSale(rules, "other", new Date("2026-02-10"))?.id).toBe("new-team");
    expect(ruleForSale(rules, "seller", new Date("2025-12-31"))).toBeNull();
    expect(ruleForSale(rules, "seller", new Date("2026-03-01"))?.id).toBe("future");
  });
  it("uses payment direction and explicit quote for cross-currency settlement", () => {
    expect(convert(20, "USD", "ARS", 1250)).toBe(25000);
    expect(convert(25000, "ARS", "USD", 1250)).toBe(20);
    expect(() => convert(1, "ARS", "USD", 0)).toThrow();
  });
});
describe("store monthly periods (adapted from the original module)", () => {
  it("places UTC boundary sales in the store's local month", () => {
    expect(currentPeriodKey(new Date("2026-02-01T02:59:59Z"))).toBe("2026-01");
    expect(currentPeriodKey(new Date("2026-02-01T03:00:00Z"))).toBe("2026-02");
    const month = monthBounds("2026-01")!;
    expect(month.start.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-02-01T03:00:00.000Z");
  });
  it("respects a different store timezone and rejects invalid months", () => {
    expect(currentPeriodKey(new Date("2026-02-01T02:00:00Z"), "Asia/Tokyo")).toBe("2026-02");
    expect(monthBounds("2026-03", new Date(), "America/New_York")!.end.toISOString()).toBe("2026-04-01T04:00:00.000Z");
    expect(monthBounds("2026-13")).toBeNull();
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
});

it("projects only outstanding debt at its sale quote, with no phantom balance after full payment", () => {
  const events = [
    { period: "2026-01", at: 1, amount: 12000, currency: "ARS" as const, exchangeRate: 1200 },
    { period: "2026-01", at: 2, amount: 15000, currency: "ARS" as const, exchangeRate: 1500 },
    { period: "2026-01", at: 3, amount: -12000, currency: "ARS" as const, exchangeRate: 2000 },
  ];
  expect(projectBalance(events)).toEqual({ ARS: 15000, USD: 10 });
  expect(projectBalance([...events, { period: "2026-02", at: 4, amount: -15000, currency: "ARS", exchangeRate: 2100 }])).toEqual({ ARS: 0, USD: 0 });
});
