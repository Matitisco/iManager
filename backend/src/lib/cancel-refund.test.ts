import { describe, expect, it } from "vitest";
import { cancellationRefund } from "./cancel-refund.js";

describe("cancellationRefund", () => {
  it("returns the partial payment from the issue: $ 900 pending, $ 300 collected, $ 600 still owed", () => {
    expect(cancellationRefund("PENDIENTE", 900, 600).toNumber()).toBe(300);
  });

  it("returns nothing when the pending operation was never paid", () => {
    expect(cancellationRefund("PENDIENTE", 900, 900).toNumber()).toBe(0);
  });

  it("does not refund cash that still covers other debts", () => {
    expect(cancellationRefund("PENDIENTE", 900, 1100).toNumber()).toBe(0);
  });

  it("refunds the full cash of a collected sale", () => {
    expect(cancellationRefund("COMPLETADA", 900, 0).toNumber()).toBe(900);
    expect(cancellationRefund("COMPLETADA", 900, 200).toNumber()).toBe(900);
  });

  it("uses the trade difference as the cash amount", () => {
    expect(cancellationRefund("PENDIENTE", 600, 400).toNumber()).toBe(200);
    expect(cancellationRefund("COMPLETADA", 0, 0).toNumber()).toBe(0);
  });
});
