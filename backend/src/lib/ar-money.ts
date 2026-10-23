// Keep monetary helpers deterministic for callers.
export function formatArMoney(value: number, currency?: string | null): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
  return currency === "USD" ? `US$ ${formatted}` : `$ ${formatted}`;
}
