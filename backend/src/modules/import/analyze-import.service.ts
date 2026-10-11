import { z } from "zod";
import type { MoneyCurrency } from "../../lib/money-currency.js";
import {
  buildDecisionContext,
  plansFromAnswers,
  postDecisions,
} from "./decisions-plan.js";
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
  inventoryHasEquipmentColumns,
  priceCurrencyOf,
  trimSheet,
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
} as const;

const modelSheetSchema = z.object({
  name: z.string(),
  include: z.boolean(),
  condition: z.enum(["", "NUEVO", "USADO", "PRE-OWNED"]),
  headerRow: z.number().int(),
  dataStartRow: z.number().int(),
  dataEndRow: z.number().int(),
  mapping: z.array(z.object({
    header: z.string(),
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
  source: AnalysisSource;
  notice: string | null;
  currency: MoneyCurrency;
  plan: SheetPlan[];
  rows: Record<string, string>[];
  summary: ImportSummary;
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
  if (input.section === "inventory" && !inventoryHasEquipmentColumns(sheets)) {
    const plan = heuristic().map((sheet) => ({ ...sheet, include: false }));
    return finish(input, sheets, deps, "heuristic", ANALYSIS_NOTICES.unrelated, plan, null, 0, 0, "none");
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
  if (!importPlanUsable(raw, input.section)) {
    return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  }
  const accepted = acceptModelPlan(sheets, { sheets: raw }, input.section, input.currency);
  if (!accepted) return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  const plan = accepted.map((item) => ({
    ...item,
    include: raw.find((sheet) => sheet.name === item.name)?.include ?? false,
  }));
  if (!importPlanUsable(plan, input.section)) {
    return { outcome: "skip", inputTokens: call.inputTokens, outputTokens: call.outputTokens };
  }
  return { outcome: "ready", plan, inputTokens: call.inputTokens, outputTokens: call.outputTokens };
}

function importPlanUsable(plans: SheetPlan[], section: ImportSection): boolean {
  const included = plans.filter((plan) => plan.include);
  if (included.length === 0) return false;
  if (section !== "inventory") return true;
  return included.every((plan) =>
    plan.mapping.some((column) => column.field === "model")
    && plan.mapping.some((column) => column.field === "price"));
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
    const headerCells = rows[model.headerRow - 1] ?? [];
    const hasCore = ["model", "price"].every((field) => model.mapping.some((column) => column.field === field && headerCells.some((cell) => cell.trim() && cell.trim().toLowerCase() === column.header.trim().toLowerCase())));
    if (!headerLooksValid(rows, model.headerRow, catalog) && !hasCore) return fallback();
    const headers = rows[model.headerRow - 1] ?? [];
    const seen = new Set<string>();
    const mapping = model.mapping.flatMap((column) => {
      const header = headers.find((cell) => cell.trim() && cell.trim() === column.header.trim())
        ?? headers.find((cell) => cell.trim().toLowerCase() === column.header.trim().toLowerCase());
      if (!header || !known.has(column.field) || seen.has(column.field)) return [];
      seen.add(column.field);
      return [{ header, field: column.field }];
    });
    if (mapping.length === 0) return fallback();
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
      batteryAsPercent: model.batteryAsPercent,
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
    const headerRow = clamp(current.headerRow, 1, Math.max(1, rows.length));
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
  const applied = applyPlans(sheets, plan, input.section, input.currency);
  const result: AnalysisResult = {
    source,
    notice,
    currency: input.currency,
    plan: applied.plans,
    rows: applied.rows,
    summary: applied.summary,
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
