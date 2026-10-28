import { imeiPassesLuhn } from "../../lib/imei.js";
import { z } from "zod";
import type { MoneyCurrency } from "../../lib/money-currency.js";
import { autoMap, isPurchaseHeader, normalizeHeader, isIgnoredInventoryHeader } from "./column-mapping.js";
import { IMPORT_CATALOGS, type ImportCatalog, type ImportSection } from "./import-catalog.js";
import { amountCellCurrency, normalizeCurrencyToken, normalizeSectionRow, preferWhatsappPhone } from "./normalize-import.js";
import { isInventoryFooter, validateInventoryImportRow } from "../inventory/import-validation.js";
import { recordRejection, countDiscard, emptyDiagnostics, missingFields, type ImportDiagnostics } from "./import-diagnostics.js";

export const CONDITIONS = ["", "NUEVO", "USADO", "PRE-OWNED"] as const;
export type SheetCondition = (typeof CONDITIONS)[number];

export type ImportSheet = {
  name: string;
  rows: string[][];
};

export type ColumnMapping = {
  header: string;
  /** Zero-based physical column; absent only in legacy plans. */
  columnIndex?: number;
  field: string;
  review?: string[];
};

export type SheetPlan = {
  name: string;
  include: boolean;
  condition: SheetCondition;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  mapping: ColumnMapping[];
  splitModelCapacity: boolean;
  batteryAsPercent: boolean;
  priceCurrency: "" | "ARS" | "USD";
};

export type SheetSummary = {
  name: string;
  rows: number;
  condition: SheetCondition;
  included: boolean;
  diagnostics?: ImportDiagnostics;
};

export type ImportSummary = {
  sheetCount: number;
  rowCount: number;
  sheets: SheetSummary[];
};

const inventoryQuantitySchema = z.coerce.number().int().min(1).max(2000);
const QUANTITY_HEADERS = new Set(["cantidad", "unidades", "qty", "quantity"]);
const MONEY_FIELDS = new Set(["price", "cost", "amount", "takeValue", "differencePaid"]);
const CAPACITY_RE = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*(GB|TB|MB)\s*$/i;

export function trimSheet(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].every((cell) => !cell.trim())) end -= 1;
  const sliced = rows.slice(0, end).map((row) => row.map((cell) => cell.replace(/\s+/g, " ").trim()));
  let cols = 0;
  for (const row of sliced) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index]) {
        cols = Math.max(cols, index + 1);
        break;
      }
    }
  }
  return sliced.map((row) => row.slice(0, cols));
}

export function parseMoney(raw: string): number | null {
  let value = raw.trim();
  if (!value || value.startsWith("=")) return null;
  value = value.replace(/u\$s|us\$|u\$d|usd|dls|d[oó]lares|ar\$|ars|pesos/gi, "").replace(/[$\s]/g, "");
  if (!value) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(value)) value = value.replace(",", ".");
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function moneyString(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function normalizeBattery(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const range = value.match(/(\d+(?:[.,]\d+)?)\s*%?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*%?/);
  if (range) return `${roundPart(range[1])}-${roundPart(range[2])}%`;
  const spaced = value.match(/(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)\s*%?/);
  if (spaced) return `${roundPart(spaced[1])}-${roundPart(spaced[2])}%`;
  const amount = Number(value.replace("%", "").replace(",", ".").trim());
  if (Number.isFinite(amount) && amount >= 0 && amount <= 1) return `${Math.round(amount * 100)}%`;
  if (Number.isFinite(amount) && amount > 1 && amount <= 100) return `${Math.round(amount)}%`;
  const percent = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent) return `${roundPart(percent[1])}%`;
  return value;
}

export function splitModelCapacity(model: string): { model: string; capacity: string } {
  const match = model.trim().match(CAPACITY_RE);
  if (!match) return { model: model.trim(), capacity: "" };
  const size = match[2].replace(",", ".");
  return { model: match[1].trim(), capacity: `${size} ${match[3].toUpperCase()}` };
}

export function conditionFromName(name: string): SheetCondition {
  const normalized = normalizeHeader(name);
  if (/usado|used|outlet|seminuevo/.test(normalized)) return "USADO";
  if (/nuevo|new|sellad/.test(normalized)) return "NUEVO";
  return "";
}

type PriceKind = "usd" | "ars" | "generic";

export function priceCurrencyOf(header: string): "" | "ARS" | "USD" {
  const kind = priceKind(header);
  if (kind === "usd") return "USD";
  if (kind === "ars") return "ARS";
  return "";
}

function priceKind(header: string): PriceKind | null {
  const normalized = normalizeHeader(header);
  if (isPurchaseHeader(header)) return null;
  if (/^(pventa|u\$sventa)$/.test(normalized)) return /u\$s/.test(normalized) ? "usd" : "generic";
  if (!/precio|price|valor|importe/.test(normalized) && !/^(venta|pvp)(usd|ars|us\$|\$)?$/.test(normalized) && !/^(\$|us\$|u\$s)$/.test(normalized)) return null;
  if (/usd|dolar|us\$/.test(normalized)) return "usd";
  if (/ars|peso/.test(normalized)) return "ars";
  return "generic";
}

function fieldLabels(catalog: ImportCatalog): { key: string; label: string }[] {
  return catalog.fields.map((field) => ({ key: field.key, label: field.label }));
}

function headerScore(row: string[], catalog: ImportCatalog): number {
  const cells = row.map((cell) => cell.trim()).filter(Boolean);
  if (cells.length < 2) return -100;
  if (new Set(cells.map((cell) => normalizeHeader(cell))).size < 2) return -100;
  if (rowLooksLikeData(row)) return -100;
  let matches = 0;
  let score = 0;
  for (const cell of cells) {
    if (cell.length > 48) score -= 3;
    if (priceKind(cell) || looksLikeField(cell, catalog)) {
      matches += 1;
      score += 5;
    } else if (/^\d+([.,]\d+)?$/.test(cell)) score -= 2;
    else score += 0.25;
  }
  if (matches < 2) score -= 8;
  return score;
}

function looksLikeField(header: string, catalog: ImportCatalog): boolean {
  const mapped = autoMap([header], fieldLabels(catalog), catalog.hints);
  return Object.keys(mapped).length > 0;
}

export const MODEL_VALUE = /\b(?:iphone\s*\d+|galaxy\s*(?:[asmz]\s*\d+|fold|flip)|samsung\s+\w*\d+|pixel\s*\d+|redmi\s+\w*\d+|moto\s*\w*\d+|ipad|macbook|apple\s*watch|airpods)\b/i;
const CAPACITY_VALUE = /^\d+(?:[.,]\d+)?\s*(?:GB|TB|MB)$/i;
const IMEI_VALUE = /^\d{14,16}(?:\.0+)?$/;
const DATE_VALUE = /^(?:\d{4}-\d{2}-\d{2}(?:T.*)?|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)$/;
const COLOR_VALUE = /^(?:black|white|red|blue|green|yellow|purple|pink|gold|silver|gray|grey|graphite|midnight|starlight|(?:deep |sierra |pacific )?blue|(?:natural |white |black |desert |blue )?titanium|space (?:gray|grey|black)|negro|blanco|rojo|azul|verde|amarillo|violeta|rosa|dorado|plateado|gris)$/i;
const STATUS_VALUE = /^(?:disponible|available|vendido|sold|reservado|reserved|en[ _]revision|review|sin servicio|servicio t[eé]cnico|servicio tec)$/i;

export function rowLooksLikeData(row: string[]): boolean {
  // An incidental repair value such as BATERIA must never turn a data row into a header.
  return row.filter(value => MODEL_VALUE.test(value) || CAPACITY_VALUE.test(value)
    || IMEI_VALUE.test(value) || DATE_VALUE.test(value) || /^\d+(?:[.,]\d+)?%$/.test(value)).length >= 2;
}

export function sheetHeaders(rows: string[][], headerRow: number): string[] {
  const width = Math.max(0, ...rows.map(row => row.length));
  return Array.from({ length: width }, (_, index) => headerRow === 0
    ? columnLetter(index) : rows[headerRow - 1]?.[index] ?? "");
}

export function contentMapping(rows: string[][], existing?: ColumnMapping[]): ColumnMapping[] {
  const mapping = existing ? existing.map(column => ({ ...column }))
    : sheetHeaders(rows, 0).map((header, columnIndex) => ({ header, columnIndex, field: "" }));
  const columns = mapping.map((_, index) => rows.map(row => row[index]?.trim() ?? "").filter(Boolean));
  const claim = (field: string, test: (value: string) => boolean, threshold = existing ? 0.8 : 0.7) => {
    if (mapping.some(column => column.field === field)) return;
    let best = -1;
    let score = threshold;
    columns.forEach((values, index) => {
      if (mapping[index].field || (existing && isIgnoredInventoryHeader(mapping[index].header)) || values.length === 0 || (existing && QUANTITY_HEADERS.has(normalizeHeader(mapping[index].header)))) return;
      const candidates = field === "batteryHealth" ? values.filter(value => !/^n\/?a$/i.test(value)) : values;
      if (!candidates.length) return;
      const ratio = candidates.filter(test).length / candidates.length;
      if (ratio >= score) { best = index; score = ratio + 0.000001; }
    });
    if (best >= 0) mapping[best].field = field;
  };
  claim("model", value => MODEL_VALUE.test(value));
  // Only equipment lists qualify for content inference; arbitrary numeric sheets stay excluded.
  if (!mapping.some(column => column.field === "model")) return mapping;
  claim("imei", value => existing ? imeiPassesLuhn(value)
    : IMEI_VALUE.test(value) || /^\d(?:\.\d+)?e\+?1[345]$/i.test(value));
  claim("capacity", value => CAPACITY_VALUE.test(value) || /^(?:32|64|128|256|512|1024|2048)$/.test(value));
  claim("batteryHealth", value => isBatteryValue(value, true));
  claim("color", value => COLOR_VALUE.test(value));
  claim("status", value => STATUS_VALUE.test(value));
  claim("entryDate", value => DATE_VALUE.test(value));
  claim("grade", value => /^(?:A\+?|B|C)$/i.test(value));
  claim("batteryNote", value => /bater[ií]a|reparaci[oó]n|cambio|pantalla|pin de carga/i.test(value));
  // Date serials without Excel formatting are accepted only in the leading date column.
  if (!mapping.some(column => column.field === "entryDate") && !mapping[0]?.field && columns[0]?.length
    && columns[0].every(value => Number(value) >= 20000 && Number(value) <= 80000)) mapping[0].field = "entryDate";
  claim("currency", value => /^(?:USD|ARS|u\$s|us\$)$/i.test(value));
  claim("cost", value => {
    const amount = parseMoney(value);
    return amount != null && amount >= 0 && amount < 10_000_000 && !value.includes("%")
      && (!existing || amountCellCurrency(value) === "USD");
  });
  // Supplier inference comes last: recognized equipment columns and headers always win.
  if (!mapping.some(column => column.field === "supplierName")) {
    const modelIndex = mapping.findIndex(column => column.field === "model");
    const isSupplierText = (value: string) => /\p{L}/u.test(value)
      && !DATE_VALUE.test(value) && parseMoney(value) == null && !IMEI_VALUE.test(value)
      && !CAPACITY_VALUE.test(value) && !isBatteryValue(value, true) && !MODEL_VALUE.test(value)
      && !COLOR_VALUE.test(value) && !STATUS_VALUE.test(value)
      && !/^(?:[abc][abc+\-/]*|canje|nuevo|usado|pre[ -]?owned|sellado|seminuevo)$/i.test(value);
    const firstText = columns.findIndex((values, index) => !mapping[index].field && values.some(value => /\p{L}/u.test(value)));
    const candidate = columns.findIndex((values, index) => {
      if (mapping[index].field || (existing && isIgnoredInventoryHeader(mapping[index].header)) || (index >= modelIndex && index !== firstText) || values.length < 3) return false;
      const lengths = values.map(value => value.length).sort((a, b) => a - b);
      const middle = Math.floor(lengths.length / 2);
      const median = lengths.length % 2 ? lengths[middle] : (lengths[middle - 1] + lengths[middle]) / 2;
      if (median > 40 || values.filter(isSupplierText).length / values.length < 0.8) return false;
      const counts = new Map<string, number>();
      for (const value of values) {
        const normalized = value.toLocaleLowerCase("es").replace(/\s+/g, " ");
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
      return counts.size / values.length <= 0.7 || [...counts.values()].some(count => count >= 3);
    });
    if (candidate >= 0) mapping[candidate].field = "supplierName";
  }
  return mapping;
}

/** Content checks are shared by the network gate and critical-field arbitration. */
export function checkedCriticalFields(sheet: ImportSheet, plan: SheetPlan): Set<string> {
  const body = sheet.rows.slice(Math.max(plan.headerRow, plan.dataStartRow - 1), plan.dataEndRow)
    .filter(row => row.some(value => value.trim()) && !isInventoryFooter({}, row));
  const headers = sheetHeaders(sheet.rows, plan.headerRow);
  const checks: Record<string, (value: string) => boolean> = {
    model: value => MODEL_VALUE.test(value),
    imei: value => imeiPassesLuhn(value),
    cost: value => { const n = parseMoney(value); return n != null && n >= 0; },
    price: value => { const n = parseMoney(value); return n != null && n >= 0; },
  };
  return new Set(plan.mapping.filter(column => {
    const check = checks[column.field];
    if (!check) return false;
    const index = mappingColumnIndex(headers, column);
    const values = body.map(row => row[index]?.trim() ?? "");
    // Model must be present on >=80% of actual rows, not just its nonempty cells.
    const candidates = column.field === "model" ? values : values.filter(Boolean);
    return candidates.length > 0 && candidates.filter(check).length / candidates.length >= 0.8;
  }).map(column => column.field));
}

export function trustworthyInventoryPlan(sheets: ImportSheet[], plans: SheetPlan[]): boolean {
  let included = 0;
  return plans.every(plan => {
    const sheet = sheets.find(sheet => sheet.name === plan.name);
    if (!sheet) return false;
    const fields = checkedCriticalFields(sheet, plan);
    if (!plan.include) return !fields.has("model");
    included++;
    if (!fields.has("model") || !["imei", "cost", "price"].some(field => fields.has(field))) return false;
    const body = sheet.rows.slice(plan.dataStartRow - 1, plan.dataEndRow);
    const inferred = contentMapping(body);
    // Unknown columns with recognizable equipment/amount data need a second opinion.
    return !inferred.some(column => {
      if (plan.mapping.some(mapped => mapped.columnIndex === column.columnIndex && mapped.field)) return false;
      if (["model", "imei", "capacity", "batteryHealth"].includes(column.field)) return true;
      const values = body.map(row => row[column.columnIndex!]?.trim() ?? "").filter(Boolean);
      return values.length > 0 && [
        (value: string) => MODEL_VALUE.test(value),
        (value: string) => imeiPassesLuhn(value),
        (value: string) => CAPACITY_VALUE.test(value),
        (value: string) => isBatteryValue(value, false),
        (value: string) => { const amount = parseMoney(value); return amount != null && amount >= 80 && amount <= 1800; },
      ].some(check => values.filter(check).length / values.length >= 0.8);
    });
  }) && included > 0;
}

function isBatteryValue(value: string, allowWholeNumber: boolean): boolean {
  if (!/^\d[\d.,%\s–-]*$/.test(value)) return false;
  const normalized = normalizeBattery(value);
  if (!/^\d+(?:-\d+)?%$/.test(normalized)) return false;
  return normalized.slice(0, -1).split('-').every(part => Number(part) <= 100)
    && ((allowWholeNumber && normalized.slice(0, -1).split('-').every(part => Number(part) >= 60 && Number(part) <= 100)) || value.includes('%') || Number(value.replace(',', '.')) <= 1);
}

/** Keep valid model mappings; repair a battery column that actually contains repairs. */
export function repairBatteryMapping(rows: string[][], headerRow: number, mapping: ColumnMapping[]): ColumnMapping[] {
  const headers = sheetHeaders(rows, headerRow);
  const body = rows.slice(headerRow, headerRow + 100);
  const matches = (index: number, allowWholeNumber: boolean) => {
    const values = body.map(row => row[index]?.trim() ?? "").filter(Boolean);
    return values.length > 0 && values.filter(value => isBatteryValue(value, allowWholeNumber)).length / values.length >= 0.7;
  };
  const battery = mapping.find(column => column.field === "batteryHealth");
  if (!battery) return mapping;
  const batteryIndex = mappingColumnIndex(headers, battery);
  if (body.every(row => !row[batteryIndex]?.trim() || /^N\/?A$/i.test(row[batteryIndex].trim()))
    || matches(batteryIndex, true)) return mapping;
  const candidate = headers.findIndex((_, index) => matches(index, false)
    && !mapping.some(column => column.field && column.field !== "batteryHealth" && mappingColumnIndex(headers, column) === index));
  const repaired = mapping.filter(column => column.field !== "batteryHealth");
  if (candidate >= 0) {
    const existing = repaired.findIndex(column => mappingColumnIndex(headers, column) === candidate);
    const column = { header: headers[candidate], columnIndex: candidate, field: "batteryHealth" };
    if (existing >= 0) repaired[existing] = column;
    else repaired.push(column);
  }
  return repaired;
}

function findHeaderRow(rows: string[][], catalog: ImportCatalog): number {
  let best = 0;
  let bestScore = -100;
  const limit = Math.min(rows.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const score = headerScore(rows[index] ?? [], catalog);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return bestScore >= 8 ? best + 1 : 0;
}

function findRate(rows: string[][]): number | null {
  for (const row of rows) {
    const blob = row.join(" ").toLowerCase();
    if (!/cotiz|dolar|dólar|blue/.test(blob)) continue;
    for (const cell of row) {
      const amount = parseMoney(cell) ?? parseMoney(cell.match(/\$?\s*\d[\d.,]*/)?.[0] ?? "");
      if (amount != null && amount >= 50 && amount <= 20_000) return amount;
    }
  }
  return null;
}

function choosePrice(headers: string[], storeCurrency: MoneyCurrency): { header: string; kind: PriceKind } | null {
  const usd = headers.find((header) => priceKind(header) === "usd");
  const ars = headers.find((header) => priceKind(header) === "ars");
  const generic = headers.find((header) => priceKind(header) === "generic");
  if (storeCurrency === "USD" && usd) return { header: usd, kind: "usd" };
  if (storeCurrency === "ARS" && ars) return { header: ars, kind: "ars" };
  if (usd && !ars) return { header: usd, kind: "usd" };
  if (ars && !usd) return { header: ars, kind: "ars" };
  if (generic) return { header: generic, kind: "generic" };
  return usd ? { header: usd, kind: "usd" } : ars ? { header: ars, kind: "ars" } : null;
}

function catalogMoneyField(catalog: ImportCatalog): string | null {
  if (catalog.fields.some((field) => field.key === "price")) return "price";
  if (catalog.fields.some((field) => field.key === "amount")) return "amount";
  if (catalog.fields.some((field) => field.key === "takeValue")) return "takeValue";
  return null;
}

function columnMapping(headers: string[], priceHeader: string | null, rejected: Set<string>, catalog: ImportCatalog): ColumnMapping[] {
  const moneyField = catalogMoneyField(catalog);
  const available = headers.filter((header) => header.trim() && (catalog.section === "clients" || (header !== priceHeader && !rejected.has(header))));
  const mapped = autoMap(available, fieldLabels(catalog), catalog.hints);
  if (priceHeader && moneyField) delete mapped[moneyField];
  const fieldByHeader = new Map<string, string>();
  for (const [field, header] of Object.entries(mapped)) fieldByHeader.set(header, field);
  if (priceHeader && moneyField) fieldByHeader.set(priceHeader, moneyField);
  const seen = new Set<string>();
  const mapping = headers.map((header, columnIndex) => {
    const field = fieldByHeader.get(header) ?? (catalog.hints[normalizeHeader(header)] === "batteryNote" ? "batteryNote" : "");
    const assigned = field && (!seen.has(field) || field === "batteryNote") ? field : "";
    if (assigned) seen.add(assigned);
    return { header, columnIndex, field: assigned };
  });
  if (catalog.section !== "clients") return mapping;
  return preferWhatsappPhone(headers, mapping);
}

function samples(rows: string[][], headerRow: number, columnIndex: number): string[] {
  const index = columnIndex;
  if (index < 0) return [];
  const values: string[] = [];
  for (let rowIndex = headerRow; rowIndex < rows.length && values.length < 8; rowIndex += 1) {
    const value = rows[rowIndex]?.[index]?.trim() ?? "";
    if (value) values.push(value);
  }
  return values;
}

function shouldSplit(rows: string[][], headerRow: number, modelIndex: number | undefined): boolean {
  if (modelIndex == null) return false;
  const values = samples(rows, headerRow, modelIndex);
  if (values.length === 0) return false;
  const hits = values.filter((value) => CAPACITY_RE.test(value.trim())).length;
  return hits >= Math.ceil(values.length / 2);
}

function shouldNormalizeBattery(rows: string[][], headerRow: number, columnIndex: number | undefined): boolean {
  if (columnIndex == null) return false;
  return samples(rows, headerRow, columnIndex).some((value) => {
    return isBatteryValue(value, true);
  });
}

export function columnLetter(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}

export function heuristicSheet(
  sheet: ImportSheet,
  catalog: ImportCatalog,
  storeCurrency: MoneyCurrency,
  headerOverride?: number,
): SheetPlan {
  const rows = trimSheet(sheet.rows);
  const detected = headerOverride != null && headerOverride >= 0 && headerOverride <= rows.length
    ? headerOverride
    : findHeaderRow(rows, catalog);
  const headerRow = detected;
  const headers = sheetHeaders(rows, headerRow);
  const chosen = choosePrice(headers, storeCurrency);
  const rejected = new Set(headers.filter((header) => {
    const kind = priceKind(header);
    return kind != null && header !== chosen?.header;
  }));
  const mapping = headerRow === 0
    ? (catalog.section === "inventory" ? contentMapping(rows) : headers.map((header, columnIndex) => ({ header, columnIndex, field: "" })))
    : (catalog.section === "inventory"
      ? contentMapping(rows.slice(headerRow), columnMapping(headers, chosen?.header ?? null, rejected, catalog))
      : columnMapping(headers, chosen?.header ?? null, rejected, catalog));
  const modelHeader = mapping.find((column) => column.field === "model")?.columnIndex;
  const capacityHeader = mapping.find((column) => column.field === "capacity")?.columnIndex;
  const batteryHeader = mapping.find((column) => column.field === "batteryHealth")?.columnIndex;
  const condition = catalog.section === "inventory" ? conditionFromName(sheet.name) : "";
  const dataStartRow = Math.min(rows.length + 1, headerRow + 1);
  let dataEndRow = rows.length;
  while (dataEndRow >= dataStartRow && (rows[dataEndRow - 1] ?? []).every((cell) => !cell)) dataEndRow -= 1;
  return {
    name: sheet.name,
    include: (detected > 0 || mapping.some(column => column.field === "model"))
      && missingFields(catalog.section, mapping.map(column => column.field)).missingRequiredFields.length === 0,
    condition,
    headerRow,
    dataStartRow,
    dataEndRow: Math.max(dataStartRow - 1, dataEndRow),
    mapping,
    splitModelCapacity: capacityHeader == null && shouldSplit(rows, headerRow, modelHeader),
    batteryAsPercent: shouldNormalizeBattery(rows, headerRow, batteryHeader),
    priceCurrency: chosen?.kind === "usd" ? "USD" : chosen?.kind === "ars" ? "ARS" : "",
  };
}

export function heuristicPlan(
  sheets: ImportSheet[],
  section: ImportSection,
  storeCurrency: MoneyCurrency,
): SheetPlan[] {
  const catalog = IMPORT_CATALOGS[section];
  return sheets.map((sheet) => heuristicSheet(sheet, catalog, storeCurrency));
}

const SALE_IDENTITY_FIELDS = new Set(["clientName", "device", "productImei", "paymentMethod", "tradeIn", "seller"]);
const CLIENT_CONTACT_FIELDS = new Set(["phone", "email", "dni", "instagram"]);

function sheetMapsFields(sheet: ImportSheet, section: ImportSection, fields: Set<string>, also?: string): boolean {
  const catalog = IMPORT_CATALOGS[section];
  const rows = trimSheet(sheet.rows);
  const headerRow = findHeaderRow(rows, catalog);
  if (!headerRow) return false;
  const mapped = Object.keys(autoMap(rows[headerRow - 1] ?? [], catalog.fields, catalog.hints));
  if (also && !mapped.includes(also)) return false;
  if (mapped.some((field) => fields.has(field))) return true;
  return false;
}

export function sectionHasRelevantColumns(sheets: ImportSheet[], section: ImportSection): boolean {
  if (section === "inventory") return inventoryHasEquipmentColumns(sheets);
  if (section === "sales") return sheets.some((sheet) => sheetMapsFields(sheet, "sales", SALE_IDENTITY_FIELDS));
  if (section === "clients") return sheets.some((sheet) => sheetMapsFields(sheet, "clients", CLIENT_CONTACT_FIELDS, "name"));
  return true;
}

const EQUIPMENT_COLUMN_FIELDS = new Set(["model", "imei", "capacity", "color", "condition", "batteryHealth", "grade"]);
const EQUIPMENT_HEADER = /^(mod|modelo|equipo|equipos|imei|serie|capacidad|almacenamiento|alm|gb|color|colour|colores|tono|condicion|cond|bateria|pila|bat|calidad|grado)$/;

function namesEquipment(cell: string): boolean {
  const normalized = normalizeHeader(cell);
  if (!normalized || normalized.length > 40) return false;
  if (EQUIPMENT_HEADER.test(normalized)) return true;
  return normalized.includes("imei")
    || normalized.includes("modelo")
    || normalized.includes("bateria")
    || normalized.includes("capacidad")
    || normalized.startsWith("salud");
}

// Price, cost and status show up in gastos and other lists. A sheet counts as
// inventory only when a header row names an equipment column (including the
// short names Mod, Alm, Bat, Pila, Tono).
export function inventoryHasEquipmentColumns(sheets: ImportSheet[]): boolean {
  const catalog = IMPORT_CATALOGS.inventory;
  return sheets.some((sheet) => {
    const rows = trimSheet(sheet.rows);
    const headers = rows.slice(0, 40).filter(row => !rowLooksLikeData(row));
    if (headers.some(row => row.filter(Boolean).length >= 2 && row.some(namesEquipment))) return true;
    const plan = heuristicSheet(sheet, catalog, "USD");
    return plan.mapping.some(column => column.field === "model") && rows.some(row => row.some(value => MODEL_VALUE.test(value)));
  });
}

function roundPart(value: string | undefined): string {
  const amount = Number((value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? String(Math.round(amount)) : "0";
}

function isFooter(cells: string[]): boolean {
  const filled = cells.map((cell) => cell.trim()).filter(Boolean);
  if (filled.length === 0 || filled.length > 2) return false;
  const blob = normalizeHeader(filled.join(" "));
  return /precionoincluye|noincluyeiva|subtotal|^total|cotizacion|^precios?.*(efectivo|transferencia|promocion)/.test(blob);
}

export function cellCurrency(raw: string): "" | "ARS" | "USD" {
  const value = raw.toLowerCase();
  if (/u\$s|us\$|u\$d|usd|dls|d[oó]lar/.test(value)) return "USD";
  if (/\$|ars|peso/.test(value)) return "ARS";
  return "";
}

function resolvePrice(options: {
  direct: string;
  usd: string;
  storeCurrency: MoneyCurrency;
  columnKind: "" | "ARS" | "USD";
  rate: number | null;
}): string {
  const direct = parseMoney(options.direct);
  const usd = parseMoney(options.usd);
  const { storeCurrency, rate } = options;
  const columnKind = cellCurrency(options.direct) || options.columnKind;

  if (columnKind === "ARS" && storeCurrency === "ARS") {
    if (usd != null && rate != null && (direct == null || (usd >= 10 && direct < usd * 10))) {
      return moneyString(usd * rate);
    }
    return direct == null ? "" : moneyString(direct);
  }
  if (columnKind === "USD" && storeCurrency === "USD") return direct == null ? "" : moneyString(direct);
  if (columnKind === "USD" && storeCurrency === "ARS" && direct != null && rate != null) return moneyString(direct * rate);
  if (columnKind === "ARS" && storeCurrency === "USD" && direct != null && rate != null && rate > 0) return moneyString(direct / rate);
  return direct == null ? "" : moneyString(direct);
}

export function mappingColumnIndex(headers: string[], column: ColumnMapping): number {
  if (column.columnIndex != null) {
    return Number.isInteger(column.columnIndex) && column.columnIndex >= 0 && column.columnIndex < headers.length
      ? column.columnIndex : -1;
  }
  const wanted = normalizeHeader(column.header);
  return wanted ? headers.findIndex((cell) => normalizeHeader(cell) === wanted) : -1;
}

export function applyPlans(
  sheets: ImportSheet[],
  plans: SheetPlan[],
  section: ImportSection,
  storeCurrency: MoneyCurrency,
): { rows: Record<string, string>[]; summary: ImportSummary; plans: SheetPlan[]; diagnostics: ImportDiagnostics } {
  const catalog = IMPORT_CATALOGS[section];
  const known = new Set(catalog.fields.map((field) => field.key));
  const byName = new Map(sheets.map((sheet) => [sheet.name, trimSheet(sheet.rows)]));
  const rows: Record<string, string>[] = [];
  const seenImeis = new Map<string, number>();
  const summaries: (SheetSummary & { diagnostics: ImportDiagnostics })[] = [];

  for (const plan of plans) {
    const grid = byName.get(plan.name);
    if (!grid) continue;
    const headers = sheetHeaders(grid, plan.headerRow);
    // Quantity is file metadata; keep the visible field catalog and mappings intact.
    const quantityIndex = section === "inventory" && plan.headerRow > 0
      ? headers.findIndex((header) => QUANTITY_HEADERS.has(normalizeHeader(header)))
      : -1;
    const usable = plan.mapping.filter((column) => column.field && (known.has(column.field) || (section === "inventory" && /^custom:[a-z][a-z0-9_]{0,59}$/.test(column.field))) && mappingColumnIndex(headers, column) >= 0);
    const seen = new Set<string>();
    const mapping = usable.filter((column) => {
      if (seen.has(column.field) && column.field !== "batteryNote") return false;
      seen.add(column.field);
      return true;
    });
    const realModelHeader = plan.headerRow > 0 && mapping.some(column => column.field === "model"
      && autoMap([headers[mappingColumnIndex(headers, column)]], fieldLabels(catalog), catalog.hints).model);
    const diagnostics = { ...emptyDiagnostics(), ...missingFields(section, mapping.map((column) => column.field)) };
    const rate = findRate(grid);
    const usdHeader = headers.find((header) => priceKind(header) === "usd") ?? "";
    const usdIndex = usdHeader ? headers.indexOf(usdHeader) : -1;
    let count = 0;
    const start = Math.max(plan.headerRow + 1, plan.dataStartRow);
    const end = Math.min(grid.length, Math.max(start - 1, plan.dataEndRow));

    diagnostics.detectedRows = Math.max(0, end - start + 1);
    if (!plan.include) {
      for (let index = start; index <= end; index += 1) countDiscard(diagnostics, "excluded_sheet");
    }
    if (plan.include) {
      let sectionCondition: SheetCondition = plan.condition;
      for (let above = plan.headerRow - 1; above >= 1 && above >= plan.headerRow - 3; above -= 1) {
        const filledAbove = (grid[above - 1] ?? []).filter((cell) => cell.trim());
        if (filledAbove.length === 1 && filledAbove[0].length <= 40) {
          sectionCondition = conditionFromName(filledAbove[0]) || plan.condition;
          break;
        }
      }
      for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
        const line = grid[rowIndex - 1] ?? [];
        if (line.every((cell) => !cell.trim())) { countDiscard(diagnostics, "empty"); continue; }
        if (section !== "inventory" && isFooter(line)) { countDiscard(diagnostics, "footer"); continue; }
        const filledCells = line.filter((cell) => cell.trim());
        if ((section === "sales" || section === "clients") && filledCells.length === 1 && !parseMoney(filledCells[0])) { countDiscard(diagnostics, "section_header"); continue; }
        if (section === "inventory" && realModelHeader && filledCells.length === 1 && filledCells[0].length <= 40 && !parseMoney(filledCells[0])) {
          const headingCondition = conditionFromName(filledCells[0]);
          if (headingCondition) { sectionCondition = headingCondition; countDiscard(diagnostics, "section_header"); continue; }
          if (/^(samsung|macbook|applewatch|airpodspro|ipads?|otrosaccesorios.*|accesorios)$/.test(normalizeHeader(filledCells[0].replace(/!+$/, "")))) { countDiscard(diagnostics, "section_header"); continue; }
        }
        const record: Record<string, string> = {};
        for (const column of mapping) {
          const index = mappingColumnIndex(headers, column);
          const value = (line[index] ?? "").trim();
          record[column.field] = column.field === "batteryNote" && record.batteryNote
            ? (value ? `${record.batteryNote}; ${value}` : record.batteryNote) : value;
        }
        if (section === "inventory" && isInventoryFooter(record, line)) {
          countDiscard(diagnostics, "footer");
          recordRejection(diagnostics, { row: rowIndex, reason: "footer", message: "Total o nota al pie sin equipo" });
          continue;
        }
        // A repeated table header is metadata, even when price is optional.
        if (section === "inventory" && realModelHeader && record.model && mapping.some(column => column.field === "model" && normalizeHeader(headers[mappingColumnIndex(headers, column)]) === normalizeHeader(record.model))) {
          countDiscard(diagnostics, "section_header");
          continue;
        }
        if (sectionCondition && !record.condition) record.condition = sectionCondition;
        if (plan.splitModelCapacity && record.model) {
          const split = splitModelCapacity(record.model);
          record.model = split.model;
          if (split.capacity && !record.capacity) record.capacity = split.capacity;
        }
        if (section === "inventory" && record.cost?.trim()) {
          const costHeader = mapping.find(column => column.field === "cost")?.header ?? "";
          record.currency = normalizeCurrencyToken(record.currency) || amountCellCurrency(record.price ?? "")
            || plan.priceCurrency || amountCellCurrency(record.cost) || amountCellCurrency(costHeader) || storeCurrency;
        }
        const rawAmount = record.amount ?? "";
        if (record.price != null) {
          const rowCurrency = normalizeCurrencyToken(record.currency) || amountCellCurrency(record.price) || plan.priceCurrency || storeCurrency;
          if (section === "inventory") record.currency = rowCurrency;
          const originalPrice = record.price;
          record.price = resolvePrice({
            direct: record.price,
            usd: usdIndex >= 0 ? line[usdIndex] ?? "" : "",
            storeCurrency: section === "inventory" ? rowCurrency : storeCurrency,
            columnKind: plan.priceCurrency,
            rate,
          });
          if (originalPrice.trim() && !record.price) record.price = originalPrice;
        }
        for (const field of MONEY_FIELDS) {
          if (field === "price" || !record[field]) continue;
          const amount = parseMoney(record[field]);
          if (amount != null) record[field] = moneyString(amount);
        }
        const normalized = normalizeSectionRow(section, record, plan.priceCurrency, rawAmount, storeCurrency);
        if (!normalized) {
          const missingName = section === "clients" && !record.name?.trim();
          const missingIdentity = section === "sales" && !record.clientName?.trim() && !record.device?.trim() && !record.productImei?.trim();
          countDiscard(diagnostics, missingName ? "missing_name" : missingIdentity ? "missing_identity" : "invalid_row");
          continue;
        }
        if (section === "inventory") {
          const validated = validateInventoryImportRow({
            ...normalized,
            price: normalized.price?.trim() ? parseMoney(normalized.price) ?? Number.NaN : null,
          }, rowIndex, seenImeis);
          if (validated.warnings.length) (diagnostics.warnings ??= []).push(...validated.warnings);
          if (!validated.ok) {
            countDiscard(diagnostics, validated.reason);
            recordRejection(diagnostics, { row: rowIndex, reason: validated.reason, message: validated.message });
            continue;
          }
          if (validated.value.imei) seenImeis.set(validated.value.imei, rowIndex);
          if (normalized.imei !== undefined) normalized.imei = validated.value.imei ?? "";
          if (normalized.batteryHealth !== undefined) normalized.batteryHealth = plan.batteryAsPercent
            ? normalizeBattery(validated.value.batteryHealth) : validated.value.batteryHealth;
          // Custom-field types depend on the store definitions; DB checks remain at confirmation.
        }
        if (section === "trade-ins" && !normalized.clientName?.trim()) { countDiscard(diagnostics, "missing_client"); continue; }
        if (section === "trade-ins" && !normalized.deviceReceived?.trim()) { countDiscard(diagnostics, "missing_device"); continue; }
        const filled = Object.values(normalized).some((value) => value.trim());
        if (!filled) { countDiscard(diagnostics, "empty"); continue; }
        const quantity = section === "inventory" && !normalized.imei?.trim()
          ? inventoryQuantitySchema.parse(line[quantityIndex]?.trim() || 1)
          : 1;
        if (quantityIndex >= 0) inventoryQuantitySchema.parse(rows.length + quantity);
        diagnostics.acceptedRows += 1;
        count += quantity;
        for (let unit = 0; unit < quantity; unit += 1) rows.push({ ...normalized, ...(section === "inventory" ? { _sourceRow: String(rowIndex), _sourceSheet: plan.name } : {}) });
      }
    }

    summaries.push({
      name: plan.name,
      rows: count,
      condition: plan.condition,
      included: plan.include && count > 0,
      diagnostics,
    });
  }

  const includedSheets = summaries.filter((sheet) => sheet.included);
  const diagnostics = emptyDiagnostics();
  const selected = summaries.filter((sheet) => plans.find((plan) => plan.name === sheet.name)?.include);
  const missingSheets = selected.length ? selected : summaries;
  for (const sheet of summaries) {
    const item = sheet.diagnostics;
    diagnostics.detectedRows += item.detectedRows;
    diagnostics.acceptedRows += item.acceptedRows;
    diagnostics.discardedRows += item.discardedRows;
    for (const rejected of item.rejected ?? []) recordRejection(diagnostics, rejected);
    if (item.warnings?.length) (diagnostics.warnings ??= []).push(...item.warnings);
    for (const [reason, count] of Object.entries(item.discardedByReason)) {
      const key = reason as keyof ImportDiagnostics["discardedByReason"];
      diagnostics.discardedByReason[key] = (diagnostics.discardedByReason[key] ?? 0) + count;
    }
  }
  diagnostics.missingRequiredFields = [...new Set(missingSheets.flatMap((sheet) => sheet.diagnostics.missingRequiredFields))];
  diagnostics.missingRecommendedFields = [...new Set(missingSheets.flatMap((sheet) => sheet.diagnostics.missingRecommendedFields))];
  return {
    rows,
    plans,
    diagnostics,
    summary: {
      sheetCount: includedSheets.length,
      rowCount: includedSheets.reduce((total, sheet) => total + sheet.rows, 0),
      sheets: summaries,
    },
  };
}

export function headerLooksValid(rows: string[][], headerRow: number, catalog: ImportCatalog): boolean {
  if (headerRow < 1 || headerRow > rows.length) return false;
  return headerScore(rows[headerRow - 1] ?? [], catalog) >= 8;
}
