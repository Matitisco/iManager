import { formatArMoney } from "../../lib/ar-money.js";

type MoneyLike = { toString(): string } | number;

export type DepositBalanceRow = {
  status: string;
  amount: MoneyLike;
  currency: string;
  usdAmount: MoneyLike;
  exchangeRate: MoneyLike;
};

function asNumber(value: MoneyLike) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

/** Credit still available to the client, expressed in the client's balance currency. */
export function creditAmount(rows: DepositBalanceRow[], currency: string | null): number {
  const target = currency === "USD" ? "USD" : "ARS";
  const total = rows.reduce((sum, row) => {
    if (row.status !== "CREDIT") return sum;
    if (row.currency === target) return sum + asNumber(row.amount);
    if (target === "USD") return sum + asNumber(row.usdAmount);
    const rate = asNumber(row.exchangeRate);
    if (rate <= 0) return sum;
    return sum + asNumber(row.usdAmount) * rate;
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Historical deposits (applied, refunded or cancelled) do not block deletion.
 * An active reservation or leftover credit does.
 */
export function clientDeleteRefusal(deposits: DepositBalanceRow[], balanceCurrency: string | null): string | null {
  if (deposits.some((row) => row.status === "ACTIVE")) {
    return "El cliente tiene una seña activa. Cancelala desde la ficha antes de archivarlo.";
  }
  const credit = creditAmount(deposits, balanceCurrency);
  if (credit > 0) {
    const formatted = formatArMoney(credit, balanceCurrency === "USD" ? "USD" : "ARS");
    return `No se puede archivar: tiene saldo a favor (${formatted}). Registrá la devolución del saldo desde la ficha y volvé a intentar.`;
  }
  if (deposits.some((row) => row.status !== "APPLIED" && row.status !== "REFUNDED")) {
    return "El cliente tiene señas que todavía no se pueden borrar.";
  }
  return null;
}
