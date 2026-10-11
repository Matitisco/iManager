import { describe, expect, it } from "vitest";
import { DEPOSIT_OVER_ESTIMATE, depositExceedsEstimate } from "./repair-deposit.js";

describe("deposit within estimate", () => {
  it("rejects a deposit above the budget and keeps the Spanish notice", () => {
    expect(DEPOSIT_OVER_ESTIMATE).toBe("La seña no puede superar el presupuesto");
    expect(depositExceedsEstimate(85000, 100000)).toBe(true);
    expect(depositExceedsEstimate(85000, 85000)).toBe(false);
    expect(depositExceedsEstimate(85000, 0)).toBe(false);
    expect(depositExceedsEstimate(null, 100000)).toBe(false);
    expect(depositExceedsEstimate(undefined, 100000)).toBe(false);
    expect(depositExceedsEstimate(0, 1)).toBe(true);
  });
});
