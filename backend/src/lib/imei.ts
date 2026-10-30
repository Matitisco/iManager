import { z } from "zod";
import { parseOptionalImei } from "./imei-value.js";
export { IMEI_FORMAT_MESSAGE, IMEI_LUHN_MESSAGE, imeiPassesLuhn, parseOptionalImei, type OptionalImei } from "./imei-value.js";

export function zodOptionalImei(max = 100) {
  return z.string().trim().max(max).superRefine((value, context) => {
    const parsed = parseOptionalImei(value);
    if (parsed.ok === false) context.addIssue({ code: "custom", message: parsed.message });
  });
}
