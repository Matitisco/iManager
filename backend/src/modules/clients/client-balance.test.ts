import { describe, expect, it } from "vitest";
import { clientDeleteRefusal, creditAmount } from "./client-balance.js";

const row = (status: string, amount: number, currency = "ARS", usdAmount = amount, exchangeRate = 1) => ({
  status, amount, currency, usdAmount, exchangeRate,
});

describe("client balance and deletion", () => {
  it("sums credit in the client currency and ignores applied or refunded receipts", () => {
    expect(creditAmount([
      row("CREDIT", 15500),
      row("APPLIED", 9000),
      row("CREDIT", 100, "USD", 100, 1500),
    ], "ARS")).toBe(15500 + 150000);
    expect(creditAmount([row("CREDIT", 100000, "ARS", 100, 1000)], "USD")).toBe(100);
  });

  it("blocks an active deposit and leftover credit, and allows historical receipts", () => {
    expect(clientDeleteRefusal([row("ACTIVE", 1000)], "ARS")).toMatch(/seña activa/);
    expect(clientDeleteRefusal([row("CREDIT", 15500)], "ARS")).toBe("No se puede archivar: tiene saldo a favor ($ 15.500). Registrá la devolución del saldo desde la ficha y volvé a intentar.");
    expect(clientDeleteRefusal([row("CREDIT", 40, "USD", 40, 1)], "USD")).toMatch(/US\$ 40/);
    expect(clientDeleteRefusal([row("APPLIED", 30), row("REFUNDED", 10), row("REVERSED", 20)], "ARS")).toBeNull();
    expect(clientDeleteRefusal([], null)).toBeNull();
  });
});
