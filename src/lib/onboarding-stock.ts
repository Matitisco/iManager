import { parseImportNumber } from "./import-number";
import { expandTextRows } from "./text-import-review";
import type {
  ImportAnalysis,
  InventoryImportRow,
} from "../services/import-api";

export function esCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function unrecognizedNote(count: number) {
  return count === 1
    ? "La línea sin reconocer no parece un equipo. Editala o borrala y volvé a analizar, o seguí sin ella."
    : `Las ${count} sin reconocer no parecen equipos. Editalas o borralas y volvé a analizar, o seguí sin ellas.`;
}

export function recognizedLinesHeading(recognized: number, total: number) {
  return `Reconocimos ${recognized} de ${esCount(total, "línea", "líneas")}`;
}

export function withoutCurrencyNote(count: number) {
  return count === 1
    ? "1 equipo sin moneda no entra en el total. Elegí ARS o USD al revisar."
    : `${count} equipos sin moneda no entran en el total. Elegí ARS o USD al revisar.`;
}

export function readingLinesLabel(count: number) {
  return `Leyendo ${esCount(Math.max(count, 1), "línea", "líneas")}`;
}

export type RecognizedEquipment = { model: string; quantity: number };

/** Splits an all-at-once recognition into visible chunks of the pasted list. */
export function recognizedSlices(
  rows: { model: string; quantity?: string | number; line?: number }[],
  lineCount: number,
  chunkLines = 8,
): RecognizedEquipment[][] {
  const items = rows.map((row) => ({
    model: row.model,
    quantity: Math.max(1, Number(row.quantity) || 1),
    line: Number(row.line) || 0,
  }));
  if (!items.length) return [];
  const chunks = Math.max(1, Math.ceil(Math.max(lineCount, 1) / chunkLines));
  const hasLines = items.some((row) => row.line > 0) && chunks > 1;
  if (hasLines) {
    const buckets: RecognizedEquipment[][] = Array.from(
      { length: chunks },
      () => [],
    );
    for (const row of items) {
      const index = Math.min(
        chunks - 1,
        Math.floor((Math.max(row.line, 1) - 1) / chunkLines),
      );
      buckets[index].push({ model: row.model, quantity: row.quantity });
    }
    return buckets.filter((bucket) => bucket.length > 0);
  }
  const steps = Math.min(8, items.length);
  const size = Math.ceil(items.length / steps);
  const slices: RecognizedEquipment[][] = [];
  for (let index = 0; index < items.length; index += size) {
    slices.push(
      items
        .slice(index, index + size)
        .map(({ model, quantity }) => ({ model, quantity })),
    );
  }
  return slices;
}

export function prepareOnboardingRows(analysis: ImportAnalysis) {
  return analysis.rows.map((row, index) => ({
    ...row,
    price: row.price ?? "",
    currency: row.currency === "ARS" || row.currency === "USD" ? row.currency : "",
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
    price: row.price?.trim() ? Number(row.price) : null,
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
    review = 0,
    withoutCurrency = 0;
  let usdKnown = true,
    arsKnown = true;
  for (const row of rows) {
    const quantity = Number(row.quantity) || 0;
    const value = (parseImportNumber(row.price) ?? 0) * quantity;
    count += quantity;
    if (row._review) review += quantity;
    if (row.currency !== "USD" && row.currency !== "ARS") {
      withoutCurrency += quantity;
      continue;
    }
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
    withoutCurrency,
  };
}

export function gettingStartedOnDashboard(state: {
  eligible: boolean;
  dismissed: boolean;
  visible?: boolean;
}) {
  return !state.dismissed && (state.eligible || Boolean(state.visible));
}
