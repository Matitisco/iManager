export const DEVICE_QUALITIES = ["A+", "A", "B", "C"] as const;

export type DeviceQuality = (typeof DEVICE_QUALITIES)[number];

const QUALITY_BY_KEY: Record<string, DeviceQuality> = {
  "a+": "A+",
  a: "A",
  b: "B",
  c: "C",
};

const EMPTY_QUALITY = new Set(["", "n/a", "na", "-", "—"]);

export const QUALITY_ERROR = "La calidad tiene que ser A+, A, B o C";

export type ParsedQuality =
  | { ok: true; grade: string }
  | { ok: false; message: string };

export function isUsedCondition(condition: string | null | undefined): boolean {
  const key = (condition ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return key === "usado" || key === "used";
}

/** Accepts the cosmetic scale, or a blank value. Rejects anything else. */
export function parseQuality(value: string | null | undefined): ParsedQuality {
  const raw = (value ?? "").trim();
  if (!raw || EMPTY_QUALITY.has(raw.toLowerCase())) return { ok: true, grade: "" };
  const grade = QUALITY_BY_KEY[raw.toLowerCase()];
  if (!grade) return { ok: false, message: QUALITY_ERROR };
  return { ok: true, grade };
}

/**
 * Quality stored on an inventory row. It only applies when the condition is Usado;
 * any other condition clears it, including a grade sent in the same request.
 */
export function inventoryGrade(condition: string | null | undefined, grade: string | null | undefined): ParsedQuality {
  if (!isUsedCondition(condition)) return { ok: true, grade: "" };
  return parseQuality(grade);
}
