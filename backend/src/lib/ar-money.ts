export function formatArMoney(value: number): string {
  const amount = Number.isFinite(value) ? Math.round(value) : 0;
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount)}`;
}
