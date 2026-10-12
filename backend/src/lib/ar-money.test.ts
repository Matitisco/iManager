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

  it("formats dollars with the same Argentine grouping", () => {
    expect(formatArMoney(1075, "USD")).toBe("US$ 1.075");
    expect(formatArMoney(200, "USD")).toBe("US$ 200");
    expect(formatArMoney(0, "USD")).toBe("US$ 0");
    expect(formatArMoney(1200.6, "USD")).toBe("US$ 1.201");
    expect(formatArMoney(Number.NaN, "USD")).toBe("US$ 0");
  });
});
