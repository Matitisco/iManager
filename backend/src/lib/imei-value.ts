/** Dependency-free IMEI values and validation, also used by import previews. */
export const IMEI_FORMAT_MESSAGE = "El IMEI tiene 15 dígitos";
export const IMEI_LUHN_MESSAGE = "El IMEI no pasa el control de dígito";

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

export type OptionalImei =
  | { ok: true; imei: string | null }
  | { ok: false; message: string };

/** Empty values become null. A present value must be exactly 15 digits. */
export function parseOptionalImei(value: string | null | undefined): OptionalImei {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: true, imei: null };
  if (!/^\d{15}$/.test(trimmed)) return { ok: false, message: IMEI_FORMAT_MESSAGE };
  return { ok: true, imei: trimmed };
}

