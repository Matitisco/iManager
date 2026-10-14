import { describe, expect, it } from "vitest";
import { cancellationSettlement, type RefundMovement, type RefundTarget } from "./cancel-refund.js";

function sale(overrides: Partial<RefundTarget> = {}): RefundTarget {
  return { id: "sale", cash: 160, status: "PENDIENTE", openBalance: null, soldAt: "2026-10-01", ...overrides };
}

function pay(amount: number, overrides: Partial<RefundMovement> = {}): RefundMovement {
  return { saleId: null, kind: "PAGO", amount, ...overrides };
}

describe("cancellationSettlement", () => {
  it("refunds the 160 collected on the sale and keeps an unrelated balance", () => {
    const target = sale();
    const result = cancellationSettlement(target, [target], [pay(160), pay(35, { kind: "CARGO" })]);
    expect(result.refund.toNumber()).toBe(160);
    expect(result.debtToRemove.toNumber()).toBe(0);
  });

  it("refunds the original 100 when the price was raised to 150", () => {
    const target = sale({ cash: 150, status: "COMPLETADA", openBalance: 50 });
    const result = cancellationSettlement(target, [target], [
      pay(100, { saleId: "sale" }),
      pay(50, { saleId: "sale", kind: "CARGO" }),
    ]);
    expect(result.refund.toNumber()).toBe(100);
    expect(result.debtToRemove.toNumber()).toBe(50);
  });

  it("refunds a linked payment of 30 even when other debt covers the sale", () => {
    const target = sale({ cash: 100, openBalance: 70 });
    const result = cancellationSettlement(target, [target], [pay(30, { saleId: "sale" })]);
    expect(result.refund.toNumber()).toBe(30);
    expect(result.debtToRemove.toNumber()).toBe(70);
  });

  it("removes only the pending sale when nothing was collected", () => {
    const target = sale({ cash: 100 });
    const result = cancellationSettlement(target, [target], [pay(15, { kind: "CARGO" })]);
    expect(result.refund.toNumber()).toBe(0);
    expect(result.debtToRemove.toNumber()).toBe(100);
  });

  it("gives an unlinked payment to the older open sale", () => {
    const older = sale({ id: "older", cash: 80, soldAt: "2026-09-01" });
    const target = sale({ id: "newer", cash: 100, soldAt: "2026-10-01" });
    const result = cancellationSettlement(target, [older, target], [pay(50)]);
    expect(result.refund.toNumber()).toBe(0);
    expect(result.debtToRemove.toNumber()).toBe(100);
  });

  it("refunds a completed sale that has no payment row, minus the open rise", () => {
    const target = sale({ cash: 150, status: "COMPLETADA", openBalance: 50 });
    const result = cancellationSettlement(target, [target], []);
    expect(result.refund.toNumber()).toBe(100);
    expect(result.debtToRemove.toNumber()).toBe(50);
  });

  it("subtracts change from the collected cash", () => {
    const target = sale({ cash: 100, status: "COMPLETADA", openBalance: 0 });
    const result = cancellationSettlement(target, [target], [
      pay(130, { saleId: "sale" }),
      pay(30, { saleId: "sale", kind: "VUELTO" }),
    ]);
    expect(result.refund.toNumber()).toBe(100);
    expect(result.debtToRemove.toNumber()).toBe(0);
  });
});
