export const IMEI_OPTIONAL_LABEL = 'IMEI (opcional)';
export const IMEI_FORMAT_MESSAGE = 'El IMEI tiene 15 dígitos';
export const IMEI_LUHN_MESSAGE = 'El IMEI no pasa el control de dígito';

export function imeiFormatError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{15}$/.test(trimmed) ? null : IMEI_FORMAT_MESSAGE;
}

/** Luhn over 15 digits. Odd positions from the left are doubled, matching the IMEI check digit. */
export function imeiPassesLuhn(value: string): boolean {
  if (!/^\d{15}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    let digit = value.charCodeAt(index) - 48;
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function imeiLoadError(value: string): string | null {
  const format = imeiFormatError(value);
  if (format) return format;
  if (!value.trim()) return null;
  return imeiPassesLuhn(value.trim()) ? null : IMEI_LUHN_MESSAGE;
}
