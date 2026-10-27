import { parseQuality } from "../inventory/quality.js";
import type { DefinitionInput } from "../custom-fields/custom-fields.service.js";
import { z } from "zod";
import type { MoneyCurrency } from "../../lib/money-currency.js";
import {
  buildDecisionContext,
  plansFromAnswers,
  postDecisions,
} from "./decisions-plan.js";
import { isPurchaseHeader } from "./column-mapping.js";
import type { ImportDiagnostics } from "./import-diagnostics.js";
import { IMPORT_CATALOGS, type ImportSection } from "./import-catalog.js";
import {
  DECISIONS_MODEL,
  estimateDecisionsUsd,
  estimateImportUsd,
  importModel,
  openAiApiKey,
  readSpreadsheetPlan,
  type ModelFailure,
} from "./responses-client.js";
import {
  applyPlans,
  headerLooksValid,
  heuristicPlan,
  heuristicSheet,
  priceCurrencyOf,
  mappingColumnIndex,
  rowLooksLikeData,
  repairBatteryMapping,
  sectionHasRelevantColumns,
  trimSheet,
  sheetHeaders,
  type ImportSheet,
  type ImportSummary,
  type SheetPlan,
} from "./sheet-plan.js";

export const ANALYSIS_NOTICES = {
  missingKey: "No hay una clave de OpenAI configurada. Leímos la planilla con las reglas internas.",
  quota: "OpenAI no tiene saldo disponible. Leímos la planilla con las reglas internas.",
  refusal: "OpenAI se negó a leer la planilla. Usamos las reglas internas.",
  error: "No se pudo consultar el análisis inteligente. Usamos las reglas internas.",
  unrelated: "Este archivo no parece tener equipos para importar.",
  unrelatedSales: "Este archivo no parece tener ventas para importar.",
  unrelatedClients: "Este archivo no parece tener clientes para importar.",
} as const;

export function unrelatedNotice(section: ImportSection): string | null {
  if (section === "inventory") return ANALYSIS_NOTICES.unrelated;
  if (section === "sales") return ANALYSIS_NOTICES.unrelatedSales;
  if (section === "clients") return ANALYSIS_NOTICES.unrelatedClients;
  return null;
}

const modelSheetSchema = z.object({
  name: z.string(),
  include: z.boolean(),
  condition: z.enum(["", "NUEVO", "USADO", "PRE-OWNED"]),
  headerRow: z.number().int(),
  dataStartRow: z.number().int(),
  dataEndRow: z.number().int(),
  mapping: z.array(z.object({
    header: z.string(),
    columnIndex: z.number().int().min(0).optional(),
    field: z.string(),
  })),
  splitModelCapacity: z.boolean(),
  batteryAsPercent: z.boolean(),
  priceCurrency: z.enum(["", "ARS", "USD"]),
});

const modelPlanSchema = z.object({
  sheets: z.array(modelSheetSchema),
});

export type AnalysisSource = "model" | "heuristic" | "manual";

export type AnalysisLogEntry = {
  section: ImportSection;
  source: AnalysisSource;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
  sheets: number;
  rows: number;
  notice: string | null;
};

export type AnalysisResult = {
  suggestedDefinitions?: DefinitionInput[];
  source: AnalysisSource;
  notice: string | null;
  currency: MoneyCurrency;
  plan: SheetPlan[];
  rows: Record<string, string>[];
  summary: ImportSummary;
  diagnostics?: ImportDiagnostics;
  missingRequiredFields?: string[];
  missingRecommendedFields?: string[];
};

export type AnalyzeDeps = {
  fetchImpl?: typeof fetch;
  log?: (entry: AnalysisLogEntry) => void;
};

export async function analyzeImport(
  input: { section: ImportSection; sheets: ImportSheet[]; currency: MoneyCurrency },
  deps: AnalyzeDeps = {},
): Promise<AnalysisResult> {
  const sheets = prepareSheets(input.sheets);
  const heuristic = () => heuristicPlan(sheets, input.section, input.currency);
  const unrelated = unrelatedNotice(input.section);
  if (unrelated && !sectionHasRelevantColumns(sheets, input.section)) {
    const plan = heuristic().map((sheet) => ({ ...sheet, include: false }));
    return finish(input, sheets, deps, "heuristic", unrelated, plan, null, 0, 0, "none");
  }
  const key = openAiApiKey();
  if (!key) return finish(input, sheets, deps, "heuristic", ANALYSIS_NOTICES.missingKey, heuristic(), null, 0, 0, "none");

  const decisions = await decideImport(input, sheets, key, deps.fetchImpl);
  if (decisions.outcome === "ready") {
    return finish(input, sheets, deps, "model", null, decisions.plan, DECISIONS_MODEL, decisions.inputTokens, decisions.outputTokens, "decisions");
  }
  if (decisions.outcome === "quota") {
    return finish(input, sheets, deps, "heuristic", ANALYSIS_NOTICES.quota, heuristic(), DECISIONS_MODEL, decisions.inputTokens, decisions.outputTokens, "decisions");
  }

  const model = importModel();
  const catalog = IMPORT_CATALOGS[input.section];
  const call = await readSpreadsheetPlan({
    apiKey: key,
    model,
    catalog,
    storeCurrency: input.currency,
    sheets,
    fetchImpl: deps.fetchImpl,
  });
  if (call.ok === false) {
    return finish(input, sheets, deps, "heuristic", noticeFor(call.kind), heuristic(), model, call.inputTokens, call.outputTokens, "responses");
  }
  const accepted = acceptModelPlan(sheets, call.plan, input.section, input.currency);
  if (!accepted) {
    return finish(input, sheets, deps, "heuristic", ANALYSIS_NOTICES.error, heuristic(), model, call.inputTokens, call.outputTokens, "responses");
  }
  return finish(input, sheets, deps, "model", null, accepted, model, call.inputTokens, call.outputTokens, "responses");
}

export function applyImportPlan(
  input: {
    section: ImportSection;
    sheets: ImportSheet[];
    currency: MoneyCurrency;
    plan: SheetPlan[];
    refreshMapping?: boolean;
  },
  deps: AnalyzeDeps = {},
): AnalysisResult {
  const sheets = prepareSheets(input.sheets);
  const plan = input.refreshMapping
    ? sheets.map((sheet) => {
      const current = input.plan.find((item) => item.name === sheet.name);
      const next = heuristicSheet(sheet, IMPORT_CATALOGS[input.section], input.currency, current?.headerRow);
      return { ...next, include: current?.include ?? next.include };
    })
    : alignPlan(sheets, input.plan, input.section, input.currency);
  return finish(input, sheets, deps, "manual", null, plan, null, 0, 0, "none");
}

async function decideImport(
  input: { section: ImportSection; currency: MoneyCurrency },
  sheets: ImportSheet[],
  apiKey: string,
  fetchImpl: AnalyzeDeps["fetchImpl"],
): Promise<
  | { outcome: "ready"; plan: SheetPlan[]; inputTokens: number; outputTokens: number }
  | { outcome: "quota" | "skip"; inputTokens: number; outputTokens: number }
> {
  const context = buildDecisionContext(sheets, input.section, input.currency);
  if (!context) return { outcome: "skip", inputTokens: 0, outputTokens: 0 };
  const call = await postDecisions({ apiKey, request: context.request, fetchImpl });
  if (call.ok === false) {
    return { outcome: call.kind === "quota" ? "quota" : "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  }
  const raw = plansFromAnswers(context, call.answers, input.section, input.currency);
  if (!importPlanUsable(raw, input.section, sheets, input.currency)) {
    return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  }
  const accepted = acceptModelPlan(sheets, { sheets: raw }, input.section, input.currency);
  if (!accepted) return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  const plan = accepted.map((item) => ({
    ...item,
    include: raw.find((sheet) => sheet.name === item.name)?.include ?? false,
  }));
  if (!importPlanUsable(plan, input.section, sheets, input.currency)) {
    return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  }
  return { outcome: "ready", plan, inputTokens: call.inputTokens, outputTokens: call.outputTokens };
}

function importPlanUsable(plans: SheetPlan[], section: ImportSection, sheets: ImportSheet[], currency: MoneyCurrency): boolean {
  const included = plans.filter((plan) => plan.include);
  if (included.length === 0) return false;
  if (section === "inventory") {
    return included.every((plan) => {
      if (!plan.mapping.some((column) => column.field === "model")) return false;
      if (plan.mapping.some((column) => column.field === "price")) return true;
      const sheet = sheets.find((item) => item.name === plan.name);
      // Retry the full mapper if Decisions overlooked an actual sale-price column.
      return !sheet || !heuristicSheet(sheet, IMPORT_CATALOGS.inventory, currency, plan.headerRow)
        .mapping.some((column) => column.field === "price");
    });
  }
  if (section === "sales") {
    return included.every((plan) =>
      plan.mapping.some((column) => column.field === "amount")
      && plan.mapping.some((column) => column.field === "clientName" || column.field === "device" || column.field === "productImei"));
  }
  if (section === "clients") return included.every((plan) => plan.mapping.some((column) => column.field === "name"));
  return true;
}

function prepareSheets(sheets: ImportSheet[]): ImportSheet[] {
  return sheets.map((sheet) => ({ name: sheet.name.trim(), rows: trimSheet(sheet.rows) }));
}

function noticeFor(kind: ModelFailure): string {
  if (kind === "quota") return ANALYSIS_NOTICES.quota;
  if (kind === "refusal") return ANALYSIS_NOTICES.refusal;
  return ANALYSIS_NOTICES.error;
}

export function acceptModelPlan(
  sheets: ImportSheet[],
  raw: unknown,
  section: ImportSection,
  currency: MoneyCurrency,
): SheetPlan[] | null {
  const parsed = modelPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const catalog = IMPORT_CATALOGS[section];
  const known = new Set(catalog.fields.map((field) => field.key));
  const byName = new Map(parsed.data.sheets.map((sheet) => [sheet.name, sheet]));
  let accepted = 0;
  const plans = sheets.map((sheet) => {
    const fallback = () => heuristicSheet(sheet, catalog, currency);
    const model = byName.get(sheet.name);
    if (!model) return fallback();
    const rows = sheet.rows;
    // The model sees a sample and can mistake a product (or a repeated product)
    // for column names. Recover the complete grid before accepting its range.
    if (section === "inventory" && (model.headerRow === 0
      || rows.slice(0, model.headerRow).some(rowLooksLikeData))) {
      const inferred = heuristicSheet(sheet, catalog, currency, 0);
      if (!inferred.mapping.some(column => column.field === "model")) return fallback();
      // Content inference protects dates and battery health. Keep the model's
      // additional fields (supplier, repair notes, etc.) on unclaimed columns.
      {
        const headers = sheetHeaders(rows, 0);
        const fields = new Set(inferred.mapping.map(column => column.field).filter(Boolean));
        for (const column of model.mapping) {
          const index = mappingColumnIndex(sheetHeaders(rows, model.headerRow), column);
          if (index < 0 || !known.has(column.field) || fields.has(column.field) || inferred.mapping[index].field) continue;
          if (column.field === "batteryHealth") continue;
          inferred.mapping[index] = { header: headers[index], columnIndex: index, field: column.field };
          fields.add(column.field);
        }
      }
      accepted += 1;
      return { ...inferred, include: model.include, condition: model.condition || inferred.condition };
    }
    const headerCells = sheetHeaders(rows, model.headerRow);
    const hasCore = ["model"].every((field) => model.mapping.some((column) => column.field === field && headerCells.some((cell) => cell.trim() && cell.trim().toLowerCase() === column.header.trim().toLowerCase())));
    if (!headerLooksValid(rows, model.headerRow, catalog) && !hasCore) return fallback();
    const headers = sheetHeaders(rows, model.headerRow);
    const seen = new Set<string>();
    const modelMapping = model.mapping.flatMap((column) => {
      const columnIndex = mappingColumnIndex(headers, column);
      const header = headers[columnIndex];
      if (columnIndex < 0 || !known.has(column.field) || seen.has(column.field)) return [];
      if ((column.field === "price" || column.field === "amount") && isPurchaseHeader(header)) return [];
      seen.add(column.field);
      return [{ header, columnIndex, field: column.field }];
    });
    if (modelMapping.length === 0) return fallback();
    const mapping = section === "inventory" ? repairBatteryMapping(rows, model.headerRow, modelMapping) : modelMapping;
    accepted += 1;
    const priceHeader = mapping.find((column) => column.field === "price")?.header ?? "";
    const detectedCurrency = priceCurrencyOf(priceHeader);
    const dataStartRow = clamp(model.dataStartRow, model.headerRow + 1, rows.length + 1);
    // The model only sees a sample; the range always runs to the last row and footers/blank rows are filtered later.
    const dataEndRow = rows.length;
    return {
      name: sheet.name,
      include: model.include,
      condition: section === "inventory" ? model.condition || fallback().condition : "",
      headerRow: model.headerRow,
      dataStartRow,
      dataEndRow,
      mapping,
      splitModelCapacity: model.splitModelCapacity,
      batteryAsPercent: model.batteryAsPercent || mapping !== modelMapping,
      priceCurrency: detectedCurrency || model.priceCurrency,
    } satisfies SheetPlan;
  });
  return accepted > 0 ? plans : null;
}

function alignPlan(
  sheets: ImportSheet[],
  plan: SheetPlan[],
  section: ImportSection,
  currency: MoneyCurrency,
): SheetPlan[] {
  return sheets.map((sheet) => {
    const current = plan.find((item) => item.name === sheet.name);
    if (!current) return heuristicSheet(sheet, IMPORT_CATALOGS[section], currency);
    const rows = sheet.rows;
    const headerRow = clamp(current.headerRow, 0, Math.max(0, rows.length));
    return {
      ...current,
      name: sheet.name,
      headerRow,
      dataStartRow: clamp(current.dataStartRow, headerRow + 1, rows.length + 1),
      dataEndRow: clamp(current.dataEndRow, headerRow, rows.length),
      condition: section === "inventory" ? current.condition : "",
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function finish(
  input: { section: ImportSection; currency: MoneyCurrency },
  sheets: ImportSheet[],
  deps: AnalyzeDeps,
  source: AnalysisSource,
  notice: string | null,
  plan: SheetPlan[],
  model: string | null,
  inputTokens: number,
  outputTokens: number,
  billing: "decisions" | "responses" | "none",
): AnalysisResult {
  // Only automatic analysis may repair a quality mapping; manual choices are authoritative.
  const suggestedDefinitions: DefinitionInput[] = [];
  if (input.section === 'inventory' && source !== 'manual') {
    plan = plan.map(item => {
      const sheet = sheets.find(sheet => sheet.name === item.name);
      if (!sheet) return item;
      const headers = sheetHeaders(sheet.rows, item.headerRow);
      const mapping = item.mapping.map(column => {
        if (column.field !== 'grade') return column;
        const index = mappingColumnIndex(headers, column);
        const values = sheet.rows.slice(Math.max(item.headerRow + 1, item.dataStartRow) - 1, item.dataEndRow)
          .map(row => row[index]?.trim() ?? '').filter(Boolean);
        if (!values.length || values.filter(value => !parseQuality(value).ok).length <= values.length / 2) return column;
        if (!suggestedDefinitions.length) suggestedDefinitions.push({
          entity: 'inventory', key: 'calidad_origen', label: 'Calidad (origen)', type: 'text', order: 0,
        });
        return { ...column, field: 'custom:calidad_origen' };
      });
      return { ...item, mapping };
    });
  }
  const applied = applyPlans(sheets, plan, input.section, input.currency);
  const result: AnalysisResult = {
    source,
    notice,
    ...(suggestedDefinitions.length ? { suggestedDefinitions } : {}),
    currency: input.currency,
    plan: applied.plans,
    rows: applied.rows,
    summary: applied.summary,
    diagnostics: applied.diagnostics,
    missingRequiredFields: applied.diagnostics.missingRequiredFields,
    missingRecommendedFields: applied.diagnostics.missingRecommendedFields,
  };
  const estimatedUsd = billing === "decisions"
    ? estimateDecisionsUsd(inputTokens)
    : billing === "responses" && model
      ? estimateImportUsd(model, inputTokens, outputTokens)
      : 0;
  try {
    deps.log?.({
      section: input.section,
      source,
      model,
      inputTokens,
      outputTokens,
      estimatedUsd,
      sheets: result.summary.sheetCount,
      rows: result.summary.rowCount,
      notice,
    });
  } catch {
    // A log failure must not block the import.
  }
  return result;
}
