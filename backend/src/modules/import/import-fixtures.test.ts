import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreImportRows } from "../../../test/import-score.js";
import { scriptDecisionAnswers } from "../../../test/script-decisions.js";
import { ANALYSIS_NOTICES, analyzeImport } from "./analyze-import.service.js";
import { DECISIONS_MODEL, DECISIONS_URL } from "./responses-client.js";
import type { ImportSheet } from "./sheet-plan.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../test/fixtures/import");

type ExpectedFile = {
  currency: "ARS" | "USD";
  rows: { model?: string; capacity?: string; imei?: string; condition?: string }[];
  unrelated?: boolean;
};

function fixtureNames(unrelated: boolean): string[] {
  return readdirSync(FIXTURES)
    .filter((file) => file.endsWith(".grid.json"))
    .map((file) => file.replace(/\.grid\.json$/, ""))
    .filter((name) => {
      const expected = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.expected.json`), "utf8")) as ExpectedFile;
      return Boolean(expected.unrelated) === unrelated;
    })
    .sort();
}

describe("import fixtures offline", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it.each(fixtureNames(false))("%s imports every expected row and nothing else", async (name) => {
    process.env.OPENAI_API_KEY = "sk-test";
    const sheets = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.grid.json`), "utf8")) as ImportSheet[];
    const expected = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.expected.json`), "utf8")) as ExpectedFile;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(DECISIONS_URL);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        input: string;
        questions: { name: string; type: string; instructions: string; choices?: { value: string }[] }[];
      };
      expect(body.model).toBe(DECISIONS_MODEL);
      expect(body.questions.some((question) => question.name.endsWith("_inc"))).toBe(true);
      if (name.startsWith("f5")) expect(body.input).not.toContain("Gráficos");
      return new Response(JSON.stringify({
        answers: scriptDecisionAnswers(body),
        usage: { input_tokens: 800, output_tokens: 50 },
      }), { status: 200 });
    });

    const result = await analyzeImport(
      { section: "inventory", currency: expected.currency, sheets },
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("model");
    // These fixtures use “Sellado”, which confirmation has always rejected as an unknown condition.
    // Preview must now exclude those rows too, instead of promising they will import.
    const hasSellado = name === 'f2_encabezado_dos_filas' || name === 'f7_nombres_raros';
    const accepted = hasSellado ? expected.rows.filter(row => row.condition !== 'NUEVO') : expected.rows;
    if (hasSellado) expect(result.diagnostics?.discardedByReason.invalid_row).toBe(expected.rows.length - accepted.length);
    const score = scoreImportRows(accepted, result.rows);
    expect(score.missing, JSON.stringify(score)).toBe(0);
    expect(score.extra, JSON.stringify(score)).toBe(0);
    expect(score.imported).toBe(accepted.length);
    fetchSpy.mockRestore();
  });

  it.each(fixtureNames(true))("%s imports nothing and explains that it is not equipment", async (name) => {
    process.env.OPENAI_API_KEY = "sk-test";
    const sheets = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.grid.json`), "utf8")) as ImportSheet[];
    const expected = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.expected.json`), "utf8")) as ExpectedFile;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const fetchImpl = vi.fn();

    const result = await analyzeImport(
      { section: "inventory", currency: expected.currency, sheets },
      { fetchImpl },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.rows).toEqual([]);
    expect(result.summary.rowCount).toBe(0);
    expect(result.notice).toBe(ANALYSIS_NOTICES.unrelated);
    fetchSpy.mockRestore();
  });
});
