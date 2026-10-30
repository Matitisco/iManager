export function batteryMinimum(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d/.test(normalized)) return null;
  const values = normalized.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!values.length) return null;
  const minimum = Math.min(...values);
  return minimum > 0 && minimum <= 1 && !normalized.includes('%') ? minimum * 100 : minimum;
}
export function ruleReason(item: { status: string; quantity: number; batteryHealth: string; archivedAt?: Date | null; needsCompletion?: boolean }, config: { hideWithoutStock: boolean; hideReserved: boolean; minBattery: number | null }): string | null {
  if (item.archivedAt || item.needsCompletion) return 'No disponible';
  if (config.hideWithoutStock && (item.quantity <= 0 || ['VENDIDO', 'SIN_STOCK'].includes(item.status))) return 'Regla: sin stock';
  if (config.hideReserved && item.status === 'RESERVADO') return 'Regla: reservado';
  const battery = batteryMinimum(item.batteryHealth);
  if (config.minBattery != null && (battery == null || battery < config.minBattery)) return `Regla: batería < ${config.minBattery} %`;
  return null;
}
export function countAvailable(items: { status: string; cantidad?: number }[]) {
  return items.filter(item => !item.status || item.status === 'DISPONIBLE').reduce((sum, item) => sum + (item.cantidad ?? 1), 0);
}
export function convertCatalogPrice(price: number, from: string, to: string, rate: number): number {
  if (from === to) return price;
  return Math.round((to === 'USD' ? price / rate : price * rate) * 100) / 100;
}
