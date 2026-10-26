export const BATTERY_HEALTH_MESSAGE = 'Ingresá una batería de 0 a 100 o un rango como 83-85';

export function validBatteryHealth(raw: string): boolean {
  const value = raw.trim();
  if (!value || /^N\/A$/i.test(value)) return true;
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*(?:[-–]\s*(\d+(?:[.,]\d+)?)\s*%?)?$/);
  if (!match) return false;
  const min = Number(match[1].replace(',', '.'));
  const max = Number((match[2] ?? match[1]).replace(',', '.'));
  return min >= 0 && max <= 100 && min <= max;
}
