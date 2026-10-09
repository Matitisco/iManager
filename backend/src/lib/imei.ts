import { z } from "zod";

export const IMEI_FORMAT_MESSAGE = "El IMEI tiene 15 dígitos";

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

export function zodOptionalImei(max = 100) {
  return z.string().trim().max(max).superRefine((value, context) => {
    const parsed = parseOptionalImei(value);
    if (parsed.ok === false) context.addIssue({ code: "custom", message: parsed.message });
  });
}
