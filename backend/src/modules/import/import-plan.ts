import { autoMap, normalizeHeader } from "./column-mapping.js";
import { IMPORT_CATALOGS, type ImportCatalog, type ImportSection } from "./import-catalog.js";

export type StoreCurrency = "ARS" | "USD";

export type SheetGrid = {
  name: string;
  rows: string[][];
};

export type SheetOverride = {
  name: string;
  include: boolean;
  headerRow: number;
  mapping?: Record<string, string>;
  /** The user chose the price column. Don't replace it with the store currency. */
  lockMoney?: boolean;
};

export type PlannedSheet = {
  name: string;
  include: boolean;
  headerRow: number;
  condition: string | null;
  headers: string[];
  mapping: Record<string, string>;
  rows: Record<string, string>[];
};

export type PlanContext = {
  section: ImportSection;
  currency: StoreCurrency;
  sellRate: number | null;
  overrides?: SheetOverride[];
};

const MONEY_FIELD: Partial<Record<ImportSection, string>> = {
  inventory: "price",
  sales: "amount",
  "trade-ins": "takeValue",
};

const HEADER_WORD = /modelo|model|equipo|precio|price|color|colour|bateria|battery|capacidad|capacity|imei|cliente|nombre|telefono|email|fecha|pago|estado|costo|grado|condicion|total|importe/;

export function trimGrid(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && (rows[end - 1] ?? []).every((cell) => !String(cell ?? "").trim())) end -= 1;
  return rows.slice(0, end).map((row) => {
    const cells = row.map((cell) => String(cell ?? "").trim());
    let last = cells.length;
    while (last > 0 && !cells[last - 1]) last -= 1;
    return cells.slice(0, last);
  });
}

export function headerNames(cells: string[]): string[] {
  const counts = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = cell.trim() || `Columna ${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} (${seen + 1})`;
  });
}

export function headerScore(row: string[]): number {
  const cells = row.map((cell) => cell.trim()).filter(Boolean);
  if (cells.length < 2) return 0;
  if (cells.some((cell) => cell.length > 40)) return 0;
  const numeric = cells.filter((cell) => parseMoney(cell) != null && !/[a-z]/i.test(cell)).length;
  if (numeric >= cells.length / 2) return 0;
  const hits = cells.filter((cell) => HEADER_WORD.test(normalizeHeader(cell))).length;
  if (hits === 0) return 0;
  return hits * 10 + cells.length;
}

export function findHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = 0;
  const limit = Math.min(rows.length, 25);
  for (let index = 0; index < limit; index += 1) {
    const score = headerScore(rows[index] ?? []);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}

export function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let text = raw.trim().replace(/\s/g, "").replace(/[$]/g, "");
  if (!text || !/\d/.test(text)) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, "");
  else if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function conditionFromSheetName(name: string): string | null {
  const folded = normalizeHeader(name);
  if (folded.includes("outlet")) return "OUTLET";
  if (folded.includes("preowned")) return "PRE-OWNED";
  if (folded.includes("usado") || folded.includes("used")) return "USADO";
  if (folded.includes("nuevo") || /(^|[^a-z])new([^a-z]|$)/.test(folded)) return "NUEVO";
  return null;
}

export function toBatteryPercent(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "";
  const range = text.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*%?$/);
  if (range) return `${percentPiece(range[1] ?? "")}% - ${percentPiece(range[2] ?? "")}%`;
  const spaced = text.match(/^(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)\s*%?$/);
  if (spaced) return `${percentPiece(spaced[1] ?? "")}% - ${percentPiece(spaced[2] ?? "")}%`;
  if (text.includes("%")) {
    const one = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return one ? `${percentPiece(one[1] ?? "")}%` : text;
  }
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value)) return text;
  if (value > 0 && value <= 1) return `${Math.round(value * 100)}%`;
  if (value > 1 && value <= 100) return `${Math.round(value)}%`;
  return text;
}

const STORAGE_AT_END = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*(gb|tb|mb)$/i;

export function splitModelCapacity(model: string): { model: string; capacity: string } {
  const match = model.trim().match(STORAGE_AT_END);
  if (!match) return { model: model.trim(), capacity: "" };
  const amount = Number((match[2] ?? "").replace(",", "."));
  const pretty = Number.isFinite(amount) && Number.isInteger(amount) ? String(amount) : (match[2] ?? "").replace(",", ".");
  return { model: (match[1] ?? "").trim(), capacity: `${pretty} ${(match[3] ?? "").toUpperCase()}` };
}

export function planWorkbook(grids: SheetGrid[], context: PlanContext): PlannedSheet[] {
  const catalog = IMPORT_CATALOGS[context.section];
  const used = new Set<number>();
  return grids.map((grid) => {
    const rows = trimGrid(grid.rows).slice(0, 2000);
    const override = takeOverride(grid.name, context.overrides, used);
    return planSheet({ name: grid.name, rows }, catalog, context, override);
  });
}

export function workbookSample(grids: SheetGrid[], currency: StoreCurrency): string {
  const lines = [`Moneda de la tienda: ${currency}`, "Cada hoja es una tabla. Los números de fila empiezan en 1."];
  for (const grid of grids.slice(0, 8)) {
    const rows = trimGrid(grid.rows).slice(0, 18);
    lines.push("", `Hoja: ${grid.name}`);
    rows.forEach((row, index) => {
      const cells = row.slice(0, 8).map((cell) => cell.replace(/\s+/g, " ").trim().slice(0, 80));
      lines.push(`${index + 1} | ${cells.join(" | ")}`);
    });
  }
  return lines.join("\n");
}

type PriceColumns = { usd: number; ars: number; generic: number };

function planSheet(
  grid: SheetGrid,
  catalog: ImportCatalog,
  context: PlanContext,
  override: SheetOverride | undefined,
): PlannedSheet {
  const headerRow = clampHeader(override?.headerRow ?? findHeaderRow(grid.rows), grid.rows.length);
  const headers = headerNames(grid.rows[headerRow] ?? []);
  const mapping = override?.mapping
    ? sanitizeMapping(override.mapping, headers, catalog)
    : autoMap(headers, catalog.fields, catalog.hints);
  const moneyKey = MONEY_FIELD[context.section];
  const prices = findPriceColumns(headers);
  if (moneyKey && !override?.lockMoney) enforceMoney(headers, mapping, context.currency, moneyKey, prices);
  const condition = context.section === "inventory" ? conditionFromSheetName(grid.name) : null;
  const rows = materialize(grid.rows, headerRow, headers, mapping, prices, condition, context);
  const include = override ? override.include && rows.length > 0 : rows.length > 0;
  return {
    name: grid.name,
    include,
    headerRow,
    condition,
    headers,
    mapping,
    rows: include ? rows : [],
  };
}

function materialize(
  gridRows: string[][],
  headerRow: number,
  headers: string[],
  mapping: Record<string, string>,
  prices: PriceColumns,
  condition: string | null,
  context: PlanContext,
): Record<string, string>[] {
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const moneyKey = MONEY_FIELD[context.section];
  const moneyHeader = moneyKey ? mapping[moneyKey] : undefined;
  const moneyIndex = moneyHeader != null ? indexByHeader.get(moneyHeader) ?? -1 : -1;
  const primaryCurrency: StoreCurrency | null = moneyIndex === prices.ars ? "ARS" : moneyIndex === prices.usd ? "USD" : null;
  const altIndex = primaryCurrency === "ARS" ? prices.usd : primaryCurrency === "USD" ? prices.ars : -1;
  const altCurrency: StoreCurrency | null = altIndex === prices.usd ? "USD" : altIndex === prices.ars ? "ARS" : null;
  const rate = findSheetRate(gridRows, headerRow) ?? (context.sellRate != null && context.sellRate > 0 ? context.sellRate : null);
  const modelIndex = indexByHeader.get(mapping.model ?? "") ?? -1;
  const rows: Record<string, string>[] = [];

  for (let rowIndex = headerRow + 1; rowIndex < gridRows.length; rowIndex += 1) {
    const source = gridRows[rowIndex] ?? [];
    if (!source.some((cell) => cell.trim())) continue;
    const record: Record<string, string> = {};
    for (const [field, header] of Object.entries(mapping)) {
      if (!header || field === moneyKey) continue;
      const value = source[indexByHeader.get(header) ?? -1]?.trim() ?? "";
      if (value) record[field] = value;
    }
    if (moneyKey && moneyIndex >= 0) {
      const price = resolvePrice(
        source[moneyIndex] ?? "",
        primaryCurrency,
        altIndex >= 0 ? source[altIndex] ?? "" : "",
        altCurrency,
        context.currency,
        rate,
      );
      if (price) record[moneyKey] = price;
    }

    if (context.section === "inventory") {
      const rawModel = modelIndex >= 0 ? source[modelIndex]?.trim() ?? "" : record.model ?? "";
      if (!rawModel || isSectionLabel(rawModel)) continue;
      if (!record.capacity) {
        const split = splitModelCapacity(rawModel);
        record.model = split.model;
        if (split.capacity) record.capacity = split.capacity;
      } else {
        record.model = rawModel;
      }
      if (record.batteryHealth) record.batteryHealth = toBatteryPercent(record.batteryHealth);
      if (!record.condition && condition) record.condition = condition;
      if (!record.model || !record.price) continue;
    } else if (isTitleRow(source)) {
      continue;
    }

    if (Object.keys(record).length === 0) continue;
    rows.push(record);
  }

  return rows;
}

function resolvePrice(
  primaryRaw: string,
  primaryCurrency: StoreCurrency | null,
  altRaw: string,
  altCurrency: StoreCurrency | null,
  store: StoreCurrency,
  rate: number | null,
): string {
  const primary = parseMoney(primaryRaw);
  const alt = parseMoney(altRaw);
  if (primaryCurrency === store || primaryCurrency == null) {
    if (primary != null && plausible(primary, store)) return moneyString(primary);
    if (alt != null && altCurrency && altCurrency !== store && rate) {
      return moneyString(store === "ARS" ? alt * rate : alt / rate);
    }
    return primary != null ? moneyString(primary) : "";
  }
  if (rate && primary != null) return moneyString(store === "ARS" ? primary * rate : primary / rate);
  if (alt != null && altCurrency === store && plausible(alt, store)) return moneyString(alt);
  return primary != null ? moneyString(primary) : "";
}

function plausible(amount: number, currency: StoreCurrency): boolean {
  if (!(amount > 0)) return false;
  if (currency === "USD") return amount < 20_000;
  return amount >= 1_000;
}

function moneyString(value: number): string {
  return String(Math.round(value));
}

function findSheetRate(rows: string[][], headerRow: number): number | null {
  for (let index = 0; index < headerRow; index += 1) {
    const row = rows[index] ?? [];
    const text = normalizeHeader(row.join(" "));
    if (!text.includes("dolar") && !text.includes("cotiz") && !text.includes("blue")) continue;
    for (const cell of row) {
      const value = parseMoney(cell);
      if (value != null && value >= 200 && value <= 20_000) return value;
    }
  }
  return null;
}

function findPriceColumns(headers: string[]): PriceColumns {
  const folded = headers.map((header) => normalizeHeader(header));
  const usd = folded.findIndex((header) => /precio|price|valor|importe|total/.test(header) && /usd|dolar|u\$s|us\$/.test(header));
  const ars = folded.findIndex((header) => /precio|price|valor|importe|total/.test(header) && /ars|peso/.test(header) && !/usd|dolar/.test(header));
  const generic = folded.findIndex((header) => header === "precio" || header === "price" || header === "total" || header === "importe" || header === "valortomado");
  return { usd, ars, generic };
}

function enforceMoney(
  headers: string[],
  mapping: Record<string, string>,
  currency: StoreCurrency,
  moneyKey: string,
  columns: PriceColumns,
): void {
  if (columns.usd < 0 && columns.ars < 0) return;
  const chosen = currency === "USD"
    ? firstIndex(columns.usd, columns.generic, columns.ars)
    : firstIndex(columns.ars, columns.generic, columns.usd);
  if (chosen < 0) return;
  const header = headers[chosen] ?? "";
  for (const key of Object.keys(mapping)) {
    if (mapping[key] === header) delete mapping[key];
  }
  mapping[moneyKey] = header;
}

function firstIndex(...indexes: number[]): number {
  return indexes.find((index) => index >= 0) ?? -1;
}

function sanitizeMapping(mapping: Record<string, string>, headers: string[], catalog: ImportCatalog): Record<string, string> {
  const known = new Set(headers);
  const used = new Set<string>();
  const next: Record<string, string> = {};
  for (const field of catalog.fields) {
    const header = mapping[field.key]?.trim() ?? "";
    if (!header || !known.has(header) || used.has(header)) continue;
    next[field.key] = header;
    used.add(header);
  }
  return next;
}

function isSectionLabel(model: string): boolean {
  const folded = normalizeHeader(model);
  if (/^(ipads|ipad|otros|accesorios|stock|total|totales)$/.test(folded)) return true;
  if (folded.startsWith("otrosaccesorio")) return true;
  if (folded.includes("noincluye")) return true;
  if (folded.startsWith("stockde") || folded.startsWith("preciodepromo") || folded.startsWith("cotizacion")) return true;
  return false;
}

function isTitleRow(row: string[]): boolean {
  const cells = row.map((cell) => cell.trim()).filter(Boolean);
  return cells.length === 1 && cells[0]!.length > 45;
}

function clampHeader(headerRow: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isInteger(headerRow) || headerRow < 0) return 0;
  return Math.min(headerRow, length - 1);
}

function takeOverride(name: string, overrides: SheetOverride[] | undefined, used: Set<number>): SheetOverride | undefined {
  if (!overrides) return undefined;
  const index = overrides.findIndex((override, position) => !used.has(position) && override.name === name);
  if (index < 0) return undefined;
  used.add(index);
  return overrides[index];
}

function percentPiece(raw: string): string {
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) return raw;
  return Number.isInteger(value) ? String(value) : String(value);
}

export function applyAiPlan(
  grids: SheetGrid[],
  aiSheets: { name?: unknown; headerRow?: unknown; columns?: unknown }[],
  context: PlanContext,
): PlannedSheet[] | null {
  if (!Array.isArray(aiSheets) || aiSheets.length === 0) return null;
  const catalog = IMPORT_CATALOGS[context.section];
  const byName = new Map<string, { headerRow: number; mapping: Record<string, string> }>();
  for (const entry of aiSheets) {
    if (!entry || typeof entry.name !== "string") continue;
    const headerRow = typeof entry.headerRow === "number" ? entry.headerRow - 1 : -1;
    const columns = Array.isArray(entry.columns) ? entry.columns : [];
    const mapping: Record<string, string> = {};
    for (const column of columns) {
      if (!column || typeof column !== "object") continue;
      const header = "header" in column && typeof column.header === "string" ? column.header.trim() : "";
      const field = "field" in column && typeof column.field === "string" ? column.field.trim() : "";
      if (!header || !field || mapping[field]) continue;
      mapping[field] = header;
    }
    byName.set(entry.name, { headerRow, mapping });
  }

  const overrides: SheetOverride[] = grids.map((grid) => {
    const rows = trimGrid(grid.rows);
    const ai = byName.get(grid.name);
    const headerOk = ai != null && ai.headerRow >= 0 && ai.headerRow < rows.length && headerScore(rows[ai.headerRow] ?? []) > 0;
    if (!ai || !headerOk) {
      const headerRow = findHeaderRow(rows);
      return { name: grid.name, include: true, headerRow };
    }
    const headers = headerNames(rows[ai.headerRow] ?? []);
    const sanitized = sanitizeMapping(ai.mapping, headers, catalog);
    const heuristic = autoMap(headers, catalog.fields, catalog.hints);
    return {
      name: grid.name,
      include: true,
      headerRow: ai.headerRow,
      mapping: fillGaps(sanitized, heuristic),
    };
  });

  return planWorkbook(grids, { ...context, overrides });
}

function fillGaps(primary: Record<string, string>, fallback: Record<string, string>): Record<string, string> {
  const used = new Set(Object.values(primary));
  const next = { ...primary };
  for (const [field, header] of Object.entries(fallback)) {
    if (!header || next[field] || used.has(header)) continue;
    next[field] = header;
    used.add(header);
  }
  return next;
}
