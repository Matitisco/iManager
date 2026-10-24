import type { MoneyCurrency } from "../../lib/money-currency.js";
import { autoMap, normalizeHeader } from "./column-mapping.js";
import { IMPORT_CATALOGS, type ImportCatalog, type ImportSection } from "./import-catalog.js";
import { amountCellCurrency, normalizeCurrencyToken, normalizeSectionRow, preferWhatsappPhone } from "./normalize-import.js";

export const CONDITIONS = ["", "NUEVO", "USADO", "PRE-OWNED"] as const;
export type SheetCondition = (typeof CONDITIONS)[number];

export type ImportSheet = {
  name: string;
  rows: string[][];
};

export type ColumnMapping = {
  header: string;
  field: string;
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
};

export type ImportSummary = {
  sheetCount: number;
  rowCount: number;
  sheets: SheetSummary[];
};

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
  value = value.replace(/u\$s|us\$|u\$d|usd|dls|d[oó]lares|ars|pesos/gi, "").replace(/[$\s]/g, "");
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
  if (Number.isFinite(amount) && amount > 0 && amount <= 1) return `${Math.round(amount * 100)}%`;
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
  if (/costo|cost/.test(normalized)) return null;
  if (!/precio|price|valor|importe/.test(normalized)) return null;
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
  const available = headers.filter((header) => header.trim() && header !== priceHeader && !rejected.has(header));
  const mapped = autoMap(available, fieldLabels(catalog), catalog.hints);
  if (priceHeader && moneyField) delete mapped[moneyField];
  const fieldByHeader = new Map<string, string>();
  for (const [field, header] of Object.entries(mapped)) fieldByHeader.set(header, field);
  if (priceHeader && moneyField) fieldByHeader.set(priceHeader, moneyField);
  const mapping = headers.filter((header) => header.trim()).map((header) => ({
    header,
    field: fieldByHeader.get(header) ?? "",
  }));
  return catalog.section === "clients" ? preferWhatsappPhone(headers, mapping) : mapping;
}

function samples(rows: string[][], headerRow: number, header: string, headers: string[]): string[] {
  const index = headers.indexOf(header);
  if (index < 0) return [];
  const values: string[] = [];
  for (let rowIndex = headerRow; rowIndex < rows.length && values.length < 8; rowIndex += 1) {
    const value = rows[rowIndex]?.[index]?.trim() ?? "";
    if (value) values.push(value);
  }
  return values;
}

function shouldSplit(rows: string[][], headerRow: number, modelHeader: string | undefined, headers: string[]): boolean {
  if (!modelHeader) return false;
  const values = samples(rows, headerRow, modelHeader, headers);
  if (values.length === 0) return false;
  const hits = values.filter((value) => CAPACITY_RE.test(value.trim())).length;
  return hits >= Math.ceil(values.length / 2);
}

function shouldNormalizeBattery(rows: string[][], headerRow: number, header: string | undefined, headers: string[]): boolean {
  if (!header) return false;
  return samples(rows, headerRow, header, headers).some((value) => {
    if (value.includes("%")) return true;
    const amount = Number(value.replace(",", "."));
    return Number.isFinite(amount) && amount > 0 && amount <= 1;
  });
}

export function heuristicSheet(
  sheet: ImportSheet,
  catalog: ImportCatalog,
  storeCurrency: MoneyCurrency,
  headerOverride?: number,
): SheetPlan {
  const rows = trimSheet(sheet.rows);
  const detected = headerOverride && headerOverride >= 1 && headerOverride <= rows.length
    ? headerOverride
    : findHeaderRow(rows, catalog);
  const headerRow = detected || 1;
  const headers = rows[headerRow - 1] ?? [];
  const chosen = choosePrice(headers, storeCurrency);
  const rejected = new Set(headers.filter((header) => {
    const kind = priceKind(header);
    return kind != null && header !== chosen?.header;
  }));
  const mapping = columnMapping(headers, chosen?.header ?? null, rejected, catalog);
  const modelHeader = mapping.find((column) => column.field === "model")?.header;
  const capacityHeader = mapping.find((column) => column.field === "capacity")?.header;
  const batteryHeader = mapping.find((column) => column.field === "batteryHealth")?.header;
  const condition = catalog.section === "inventory" ? conditionFromName(sheet.name) : "";
  const dataStartRow = Math.min(rows.length + 1, headerRow + 1);
  let dataEndRow = rows.length;
  while (dataEndRow >= dataStartRow && (rows[dataEndRow - 1] ?? []).every((cell) => !cell)) dataEndRow -= 1;
  return {
    name: sheet.name,
    include: detected > 0,
    condition,
    headerRow,
    dataStartRow,
    dataEndRow: Math.max(dataStartRow - 1, dataEndRow),
    mapping,
    splitModelCapacity: !capacityHeader && shouldSplit(rows, headerRow, modelHeader, headers),
    batteryAsPercent: shouldNormalizeBattery(rows, headerRow, batteryHeader, headers),
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
  const limit = Math.min(rows.length, 40);
  for (let index = 0; index < limit; index += 1) {
    const cells = (rows[index] ?? []).map((cell) => cell.trim()).filter((cell) => cell.length > 0 && cell.length <= 40);
    if (cells.length < 2) continue;
    const mapped = Object.keys(autoMap(cells, catalog.fields, catalog.hints));
    if (also && !mapped.includes(also)) continue;
    if (mapped.some((field) => fields.has(field))) return true;
  }
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
    const limit = Math.min(rows.length, 40);
    for (let index = 0; index < limit; index += 1) {
      const cells = (rows[index] ?? []).map((cell) => cell.trim()).filter((cell) => cell.length > 0 && cell.length <= 40);
      if (cells.length < 2) continue;
      if (cells.some((cell) => namesEquipment(cell))) return true;
      const mapped = autoMap(cells, catalog.fields, catalog.hints);
      if (Object.keys(mapped).some((field) => EQUIPMENT_COLUMN_FIELDS.has(field))) return true;
    }
    return false;
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
  return /precionoincluye|noincluyeiva|subtotal|^total|cotizacion/.test(blob);
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

function indexByHeader(headers: string[], header: string): number {
  const wanted = normalizeHeader(header);
  return headers.findIndex((cell) => normalizeHeader(cell) === wanted);
}

export function applyPlans(
  sheets: ImportSheet[],
  plans: SheetPlan[],
  section: ImportSection,
  storeCurrency: MoneyCurrency,
): { rows: Record<string, string>[]; summary: ImportSummary; plans: SheetPlan[] } {
  const catalog = IMPORT_CATALOGS[section];
  const known = new Set(catalog.fields.map((field) => field.key));
  const byName = new Map(sheets.map((sheet) => [sheet.name, trimSheet(sheet.rows)]));
  const rows: Record<string, string>[] = [];
  const summaries: SheetSummary[] = [];

  for (const plan of plans) {
    const grid = byName.get(plan.name);
    if (!grid) continue;
    const headers = grid[plan.headerRow - 1] ?? [];
    const usable = plan.mapping.filter((column) => column.field && known.has(column.field) && indexByHeader(headers, column.header) >= 0);
    const seen = new Set<string>();
    const mapping = usable.filter((column) => {
      if (seen.has(column.field)) return false;
      seen.add(column.field);
      return true;
    });
    const rate = findRate(grid);
    const usdHeader = headers.find((header) => priceKind(header) === "usd") ?? "";
    const usdIndex = usdHeader ? indexByHeader(headers, usdHeader) : -1;
    let count = 0;
    const start = Math.max(plan.headerRow + 1, plan.dataStartRow);
    const end = Math.min(grid.length, Math.max(start - 1, plan.dataEndRow));

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
        if (line.every((cell) => !cell.trim()) || isFooter(line)) continue;
        const filledCells = line.filter((cell) => cell.trim());
        if ((section === "sales" || section === "clients") && filledCells.length === 1 && !parseMoney(filledCells[0])) continue;
        if (section === "inventory" && filledCells.length === 1 && filledCells[0].length <= 40 && !parseMoney(filledCells[0])) {
          sectionCondition = conditionFromName(filledCells[0]) || plan.condition;
          continue;
        }
        const record: Record<string, string> = {};
        for (const column of mapping) {
          const index = indexByHeader(headers, column.header);
          record[column.field] = (line[index] ?? "").trim();
        }
        if (sectionCondition && !record.condition) record.condition = sectionCondition;
        if (plan.splitModelCapacity && record.model) {
          const split = splitModelCapacity(record.model);
          record.model = split.model;
          if (split.capacity && !record.capacity) record.capacity = split.capacity;
        }
        if (plan.batteryAsPercent && record.batteryHealth) record.batteryHealth = normalizeBattery(record.batteryHealth);
        const rawAmount = record.amount ?? "";
        if (record.price != null) {
          const rowCurrency = normalizeCurrencyToken(record.currency) || amountCellCurrency(record.price) || plan.priceCurrency || storeCurrency;
          if (section === "inventory") record.currency = rowCurrency;
          record.price = resolvePrice({
            direct: record.price,
            usd: usdIndex >= 0 ? line[usdIndex] ?? "" : "",
            storeCurrency: section === "inventory" ? rowCurrency : storeCurrency,
            columnKind: plan.priceCurrency,
            rate,
          });
        }
        for (const field of MONEY_FIELDS) {
          if (field === "price" || !record[field]) continue;
          const amount = parseMoney(record[field]);
          if (amount != null) record[field] = moneyString(amount);
        }
        const normalized = normalizeSectionRow(section, record, plan.priceCurrency, rawAmount, storeCurrency);
        if (!normalized) continue;
        if (section === "inventory" && (!normalized.model?.trim() || !normalized.price)) continue;
        if (section === "trade-ins" && (!normalized.clientName?.trim() || !normalized.deviceReceived?.trim())) continue;
        const filled = Object.values(normalized).some((value) => value.trim());
        if (!filled) continue;
        count += 1;
        rows.push(normalized);
      }
    }

    summaries.push({
      name: plan.name,
      rows: count,
      condition: plan.condition,
      included: plan.include && count > 0,
    });
  }

  const includedSheets = summaries.filter((sheet) => sheet.included);
  return {
    rows,
    plans,
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
