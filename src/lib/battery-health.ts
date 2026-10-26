export const BATTERY_HEALTH_MESSAGE = 'Ingresá una batería de 0 a 100 o un rango como 83-85';

/** Manual percentages and ascending ranges; null means invalid. */
export function parseBatteryHealth(raw: string): string | null {
  const value = raw.trim();
  if (!value || /^N\/A$/i.test(value)) return value;
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*(?:[-–]\s*(\d+(?:[.,]\d+)?)\s*%?)?$/);
  if (!match) return null;
  const min = Number(match[1].replace(',', '.'));
  const max = Number((match[2] ?? match[1]).replace(',', '.'));
  if (min < 0 || max > 100 || min > max) return null;
  return match[2] ? `${min}-${max}%` : `${min}%`;
}
