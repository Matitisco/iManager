import { parseImportNumber } from "./import-number";
import { expandTextRows } from "./text-import-review";
import type {
  ImportAnalysis,
  InventoryImportRow,
} from "../services/import-api";

export function prepareOnboardingRows(analysis: ImportAnalysis) {
  return analysis.rows.map((row, index) => ({
    ...row,
    price: row.price || "0",
    currency: row.currency || analysis.currency,
    condition: row.condition || "USADO",
    quantity: row.quantity || "1",
    _review: (analysis.review?.[index]?.dudas ?? []).join(" · "),
  }));
}
export function onboardingPayload(
  rows: Record<string, string>[],
): InventoryImportRow[] {
  return expandTextRows(rows).map((row) => ({
    imei: row.imei ?? "",
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    batteryHealth: row.batteryHealth || "N/A",
    condition: row.condition,
    price: Number(row.price),
    cost: row.cost?.trim() ? Number(row.cost) : undefined,
    currency: row.currency as "ARS" | "USD",
    customFields: {
      ...(row.serial ? { serial: row.serial } : {}),
      ...(row._review ? { onboardingReview: row._review } : {}),
    },
  }));
}
export function onboardingTotals(
  rows: Record<string, string>[],
  rate: number | null,
) {
  let usd = 0,
    ars = 0,
    count = 0,
    review = 0;
  let usdKnown = true,
    arsKnown = true;
  for (const row of rows) {
    const quantity = Number(row.quantity) || 0;
    const value = (parseImportNumber(row.price) ?? 0) * quantity;
    count += quantity;
    if (row._review) review += quantity;
    if (row.currency === "USD") {
      usd += value;
      if (rate) ars += value * rate;
      else if (value) arsKnown = false;
    } else {
      ars += value;
      if (rate) usd += value / rate;
      else if (value) usdKnown = false;
    }
  }
  return {
    usd: usdKnown ? usd : null,
    ars: arsKnown ? ars : null,
    count,
    review,
  };
}
