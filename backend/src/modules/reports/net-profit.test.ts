import { describe, expect, it } from "vitest";
import { netProfit } from "./net-profit.js";

describe("net profit", () => {
  it("subtracts expenses from gross profit and converts mixed currencies with the sell rate", () => {
    const result = netProfit({
      currency: "ARS",
      sellRate: 1300,
      sales: [
        { amount: 100_000, currency: "ARS", cost: 40_000, costCurrency: "ARS" },
        { amount: 100, currency: "USD", cost: 20, costCurrency: "USD" },
      ],
      expenses: [
        { amount: 10, currency: "USD" },
        { amount: 5_000, currency: "ARS" },
      ],
    });
    expect(result).toEqual({
      revenue: 230_000,
      cost: 66_000,
      grossProfit: 164_000,
      expenses: 18_000,
      netProfit: 146_000,
    });
  });

  it("converts a peso cost into a dollar store without a second rounding pass", () => {
    const result = netProfit({
      currency: "USD",
      sellRate: 1000,
      sales: [{ amount: 100, currency: "USD", cost: 40_000, costCurrency: "ARS" }],
      expenses: [{ amount: 2_000, currency: "ARS" }],
    });
    expect(result).toEqual({
      revenue: 100,
      cost: 40,
      grossProfit: 60,
      expenses: 2,
      netProfit: 58,
    });
  });

  it("keeps a single currency when there is no quote", () => {
    const result = netProfit({
      currency: "ARS",
      sellRate: null,
      sales: [{ amount: 1000, currency: null, cost: 400, costCurrency: null }],
      expenses: [{ amount: 100, currency: "ARS" }],
    });
    expect(result?.netProfit).toBe(500);
  });

  it("blocks the total when a foreign amount has no sell rate", () => {
    expect(netProfit({
      currency: "ARS",
      sellRate: null,
      sales: [{ amount: 10, currency: "USD", cost: 0, costCurrency: "ARS" }],
      expenses: [],
    })).toBeNull();
  });

  it("returns zeros when the period has no sales and no expenses", () => {
    expect(netProfit({ currency: "ARS", sellRate: null, sales: [], expenses: [] })).toEqual({
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
    });
  });
});
