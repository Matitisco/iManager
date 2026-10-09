export const IMEI_OPTIONAL_LABEL = 'IMEI (opcional)';
export const IMEI_FORMAT_MESSAGE = 'El IMEI tiene 15 dígitos';

export function imeiFormatError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{15}$/.test(trimmed) ? null : IMEI_FORMAT_MESSAGE;
}
