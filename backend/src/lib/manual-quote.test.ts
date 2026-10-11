import { describe, expect, it } from "vitest";
import { MANUAL_QUOTE_ORDER_ERROR, assertManualQuoteOrder } from "./manual-quote.js";

describe("assertManualQuoteOrder", () => {
  it("rejects a buy rate above the sell rate", () => {
    expect(() => assertManualQuoteOrder(1400, 1300)).toThrowError(expect.objectContaining({
      statusCode: 400,
      message: MANUAL_QUOTE_ORDER_ERROR,
    }));
  });

  it("allows equal rates, a lower buy rate, and a missing side", () => {
    expect(() => assertManualQuoteOrder(1400, 1400)).not.toThrow();
    expect(() => assertManualQuoteOrder(1300, 1400)).not.toThrow();
    expect(() => assertManualQuoteOrder(null, 1300)).not.toThrow();
    expect(() => assertManualQuoteOrder(1400, null)).not.toThrow();
    expect(() => assertManualQuoteOrder(null, null)).not.toThrow();
  });
});
