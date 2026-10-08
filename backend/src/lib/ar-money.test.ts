import { describe, expect, it } from "vitest";
import { formatArMoney } from "./ar-money.js";

describe("formatArMoney", () => {
  it("formats pesos with Argentine grouping and no decimals", () => {
    expect(formatArMoney(1200)).toBe("$ 1.200");
    expect(formatArMoney(50000)).toBe("$ 50.000");
    expect(formatArMoney(0)).toBe("$ 0");
    expect(formatArMoney(1200.4)).toBe("$ 1.200");
    expect(formatArMoney(Number.NaN)).toBe("$ 0");
  });
});
