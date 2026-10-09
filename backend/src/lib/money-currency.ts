import type { Prisma, PrismaClient } from "@prisma/client";

export const CURRENCIES = ["ARS", "USD"] as const;
export const EXCHANGE_MODES = ["auto", "manual"] as const;
export const EXCHANGE_SOURCES = ["blue", "oficial", "mep"] as const;

export type MoneyCurrency = (typeof CURRENCIES)[number];
export type ExchangeMode = (typeof EXCHANGE_MODES)[number];
export type ExchangeSource = (typeof EXCHANGE_SOURCES)[number];

type Db = PrismaClient | Prisma.TransactionClient;

export function asCurrency(value: unknown, fallback: MoneyCurrency = "ARS"): MoneyCurrency {
  return value === "USD" ? "USD" : value === "ARS" ? "ARS" : fallback;
}

export function optionalCurrency(value: unknown): MoneyCurrency | undefined {
  if (value === "ARS" || value === "USD") return value;
  return undefined;
}

export function asExchangeMode(value: unknown): ExchangeMode {
  return value === "manual" ? "manual" : "auto";
}

export function asExchangeSource(value: unknown): ExchangeSource {
  if (value === "oficial" || value === "mep" || value === "blue") return value;
  return "blue";
}

export function positiveRate(value: unknown): number | null {
  const decimal = value && typeof value === "object" && "toNumber" in value ? value.toNumber : null;
  const amount = typeof decimal === "function"
    ? decimal.call(value)
    : typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function storeCurrency(storeId: string, db: Db): Promise<MoneyCurrency> {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { currency: true } });
  return asCurrency(store?.currency);
}

export function currencyOnWrite(
  explicit: unknown,
  changed: boolean,
  current: MoneyCurrency,
): MoneyCurrency | undefined {
  const provided = optionalCurrency(explicit);
  if (provided) return provided;
  if (changed) return current;
  return undefined;
}
