import { describe, expect, it } from "vitest";
import { redactFinancials } from "./redact-financials.js";

describe("redactFinancials", () => {
  it("removes cost and margin fields at every level and keeps sale prices", () => {
    const payload = {
      inventory: [
        { id: "eq-1", model: "Pixel", price: 1400, cost: 900, customFields: { note: "ok", cost: 12 } },
      ],
      sale: { amount: 1400 },
      tradeIn: { takeValue: 600, differencePaid: 800 },
      overview: {
        summary: { revenue: 10, grossProfit: 4, marginRate: 40, grossProfitChange: 2 },
        inventory: { valuation: { costValue: 9, retailValue: 14 }, aging: [{ label: "0-14", count: 1, costValue: 9 }] },
      },
    };

    expect(redactFinancials(payload)).toEqual({
      inventory: [
        { id: "eq-1", model: "Pixel", price: 1400, customFields: { note: "ok" } },
      ],
      sale: { amount: 1400 },
      tradeIn: { takeValue: 600, differencePaid: 800 },
      overview: {
        summary: { revenue: 10 },
        inventory: { valuation: { retailValue: 14 }, aging: [{ label: "0-14", count: 1 }] },
      },
    });
  });
});
