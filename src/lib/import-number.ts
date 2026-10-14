/** Accept plain numbers and Argentine decimal/thousands separators in import review. */
export function parseImportNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim().replace(/[$\s]/g, '');
  if (!trimmed) return undefined;
  const normalized = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : /^-?\d+,\d+$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}
