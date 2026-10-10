import { describe, expect, it } from "vitest";
import { MISSING_OUTGOING_PRICE, NEGATIVE_TRADE_DIFFERENCE, outgoingTradeDifference } from "./outgoing-difference.js";

describe("outgoingTradeDifference", () => {
  it("does not invent a negative gap when the sold device is unregistered and has no price", () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: false,
      saleAmount: 0,
      takeValue: 400,
    })).toEqual({ difference: null, warning: MISSING_OUTGOING_PRICE });
  });

  it("keeps a zero gap when both amounts are still empty", () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: false,
      saleAmount: 0,
      takeValue: 0,
    })).toEqual({ difference: null, warning: null });
  });

  it("warns when a typed sale price is below the trade-in", () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: true,
      saleAmount: 100,
      takeValue: 250,
    })).toEqual({ difference: -150, warning: NEGATIVE_TRADE_DIFFERENCE });
  });

  it("uses the registered sale price even when that price is zero", () => {
    expect(outgoingTradeDifference({
      registered: true,
      priceProvided: false,
      saleAmount: 0,
      takeValue: 80,
    })).toEqual({ difference: -80, warning: NEGATIVE_TRADE_DIFFERENCE });
  });

  it("returns the cash the buyer still owes", () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: true,
      saleAmount: 900,
      takeValue: 400,
    })).toEqual({ difference: 500, warning: null });
  });
});
