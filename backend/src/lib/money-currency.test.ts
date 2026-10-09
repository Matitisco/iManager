import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";
import { positiveRate } from "./money-currency.js";

describe("positiveRate", () => {
  it("reads a Prisma decimal even when it is not the imported class", () => {
    expect(positiveRate(new Decimal("500.5"))).toBe(500.5);
    expect(positiveRate({ toNumber: () => 700 })).toBe(700);
    expect(positiveRate(1200)).toBe(1200);
    expect(positiveRate("800")).toBe(800);
    expect(positiveRate(0)).toBeNull();
    expect(positiveRate(null)).toBeNull();
    expect(positiveRate("")).toBeNull();
  });
});
