export const INPUT_LIMITS = {
  storeName: 120,
  model: 100,
  clientName: 120,
} as const;

export function limitedText(label: string, value: string, max: number): string | null {
  const text = value.trim();
  if (!text) return `El ${label} es obligatorio`;
  if (text.length > max) return `El ${label} puede tener hasta ${max} caracteres`;
  return null;
}

export function nonNegativeAmount(label: string, value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return `El ${label} no puede ser negativo`;
  return null;
}
