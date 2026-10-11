export const RESPONSES_URL = "https://api.openai.com/v1/responses";
// Responses + structured outputs. gpt-6.1-sol supports both and reasoning effort "low".
export const DEFAULT_IMPORT_MODEL = "gpt-6.1-sol";
export const REQUEST_TIMEOUT_MS = 20_000;

// Standard short-context rates, USD per 1M tokens.
// https://developers.openai.com/api/docs/pricing
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6-sol": { input: 2, output: 10 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6-astra": { input: 10, output: 50 },
};

export type ResponseFailure = "quota" | "refusal" | "error";

export type ResponsesCall =
  | { ok: true; value: unknown; inputTokens: number; outputTokens: number }
  | { ok: false; kind: ResponseFailure; inputTokens: number; outputTokens: number };

export function importModel(): string {
  return process.env.OPENAI_IMPORT_MODEL?.trim() || DEFAULT_IMPORT_MODEL;
}

export function estimateResponsesUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_RATES[model];
  if (!rates) return 0;
  const input = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
  const output = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
  const usd = (input / 1_000_000) * rates.input + (output / 1_000_000) * rates.output;
  return Math.round(usd * 1e8) / 1e8;
}

export function liveResponsesAllowed(fetchImpl?: typeof fetch): boolean {
  if (fetchImpl) return true;
  return !process.env.VITEST;
}

export async function requestImportPlan(options: {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ResponsesCall> {
  if (!liveResponsesAllowed(options.fetchImpl)) {
    return { ok: false, kind: "error", inputTokens: 0, outputTokens: 0 };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        store: false,
        max_output_tokens: 4_000,
        reasoning: { effort: "low" },
        instructions: options.instructions,
        input: options.input,
        text: {
          format: {
            type: "json_schema",
            name: "import_plan",
            strict: true,
            schema: options.schema,
          },
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: "error", inputTokens: 0, outputTokens: 0 };
  }

  const payload = await response.json().catch(() => null);
  const usage = readUsage(payload);
  if (!response.ok) {
    return { ok: false, kind: isQuota(response.status, payload) ? "quota" : "error", ...usage };
  }
  if (statusOf(payload) === "failed" || statusOf(payload) === "incomplete") {
    return { ok: false, kind: "error", ...usage };
  }
  const text = readOutputText(payload);
  if (text === "refusal") return { ok: false, kind: "refusal", ...usage };
  if (text == null) return { ok: false, kind: "error", ...usage };
  try {
    return { ok: true, value: JSON.parse(text), ...usage };
  } catch {
    return { ok: false, kind: "error", ...usage };
  }
}

export function importPlanSchema(fields: string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sheets"],
    properties: {
      sheets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "include", "headerRow", "columns"],
          properties: {
            name: { type: "string" },
            include: { type: "boolean" },
            headerRow: { type: "integer" },
            columns: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["header", "field"],
                properties: {
                  header: { type: "string" },
                  field: { type: "string", enum: ["", ...fields] },
                },
              },
            },
          },
        },
      },
    },
  };
}

function readUsage(payload: unknown): { inputTokens: number; outputTokens: number } {
  if (!payload || typeof payload !== "object") return { inputTokens: 0, outputTokens: 0 };
  const usage = (payload as { usage?: { input_tokens?: unknown; output_tokens?: unknown } }).usage;
  return {
    inputTokens: positive(usage?.input_tokens),
    outputTokens: positive(usage?.output_tokens),
  };
}

function positive(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function statusOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const status = (payload as { status?: unknown }).status;
  return typeof status === "string" ? status : "";
}

function readOutputText(payload: unknown): string | "refusal" | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text;
  if (!Array.isArray(record.output)) return null;
  let text: string | null = null;
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const typed = part as { type?: unknown; text?: unknown; refusal?: unknown };
      if (typed.type === "refusal") return "refusal";
      if (typed.type === "output_text" && typeof typed.text === "string") text = typed.text;
    }
  }
  return text;
}

function isQuota(status: number, payload: unknown): boolean {
  if (status === 402) return true;
  const error = payload && typeof payload === "object"
    ? (payload as { error?: { code?: unknown; type?: unknown; message?: unknown } }).error
    : undefined;
  const blob = [error?.code, error?.type, error?.message]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return /insufficient_quota|billing_hard_limit|exceeded your current quota|insufficient funds|out of credits/.test(blob);
}
