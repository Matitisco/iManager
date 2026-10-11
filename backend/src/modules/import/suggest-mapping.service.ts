import { catalogChoices, heuristicSuggestions, resolveDecisions, trimSamples, type ColumnSuggestion } from "./column-mapping.js";
import { decideColumn, decisionsModel, estimateDecisionsUsd, openAiApiKey, type DecisionFailure } from "./decisions-client.js";
import { IMPORT_CATALOGS, type ImportSection } from "./import-catalog.js";

export const MAPPING_NOTICES = {
  missingKey: "No hay una clave de OpenAI configurada. Usamos el mapeo por nombre de columna.",
  quota: "OpenAI no tiene saldo disponible. Usamos el mapeo por nombre de columna.",
  refusal: "OpenAI se negó a clasificar las columnas. Usamos el mapeo por nombre de columna.",
  error: "No se pudo consultar el mapeo inteligente. Usamos el mapeo por nombre de columna.",
} as const;

const DEADLINE_MS = 45_000;

export type MappingLogEntry = {
  section: ImportSection;
  source: "decisions" | "heuristic";
  model: string | null;
  inputTokens: number;
  estimatedUsd: number;
  columns: number;
  notice: string | null;
};

export type SuggestMappingInput = {
  section: ImportSection;
  columns: { header: string; samples: string[] }[];
};

export type SuggestMappingResult = {
  source: "decisions" | "heuristic";
  notice: string | null;
  suggestions: ColumnSuggestion[];
};

export type SuggestDeps = {
  fetchImpl?: typeof fetch;
  log?: (entry: MappingLogEntry) => void;
  deadlineMs?: number;
};

export async function suggestColumnMapping(
  input: SuggestMappingInput,
  deps: SuggestDeps = {},
): Promise<SuggestMappingResult> {
  const catalog = IMPORT_CATALOGS[input.section];
  const columns = input.columns.map((column) => ({
    header: column.header.trim(),
    samples: trimSamples(column.samples),
  }));
  const heuristic = () => heuristicSuggestions(columns.map((column) => column.header), catalog);

  if (!openAiApiKey()) {
    return finish(input, deps, "heuristic", MAPPING_NOTICES.missingKey, heuristic(), null, 0);
  }

  const started = Date.now();
  const deadlineMs = deps.deadlineMs ?? DEADLINE_MS;
  let inputTokens = 0;
  const decided: { header: string; choice: string; confidence: number }[] = [];
  const model = decisionsModel();

  for (const column of columns) {
    if (Date.now() - started >= deadlineMs) {
      return finish(input, deps, "heuristic", MAPPING_NOTICES.error, heuristic(), model, inputTokens);
    }

    const call = await decideColumn({
      apiKey: openAiApiKey() ?? "",
      model,
      header: column.header,
      samples: column.samples,
      choices: catalogChoices(catalog),
      fetchImpl: deps.fetchImpl,
    });
    inputTokens += call.inputTokens;
    if (call.ok === false) {
      return finish(input, deps, "heuristic", noticeFor(call.kind), heuristic(), model, inputTokens);
    }
    decided.push({ header: column.header, choice: call.choice, confidence: call.confidence });
  }

  return finish(input, deps, "decisions", null, resolveDecisions(decided), model, inputTokens);
}

function noticeFor(kind: DecisionFailure): string {
  if (kind === "quota") return MAPPING_NOTICES.quota;
  if (kind === "refusal") return MAPPING_NOTICES.refusal;
  return MAPPING_NOTICES.error;
}

function finish(
  input: SuggestMappingInput,
  deps: SuggestDeps,
  source: SuggestMappingResult["source"],
  notice: string | null,
  suggestions: ColumnSuggestion[],
  model: string | null,
  inputTokens: number,
): SuggestMappingResult {
  try {
    deps.log?.({
      section: input.section,
      source,
      model,
      inputTokens,
      estimatedUsd: estimateDecisionsUsd(inputTokens),
      columns: input.columns.length,
      notice,
    });
  } catch {
    // A log failure must not block the import mapping.
  }

  return { source, notice, suggestions };
}
