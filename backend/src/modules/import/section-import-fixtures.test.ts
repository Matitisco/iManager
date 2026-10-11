import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreLabeledRows } from "../../../test/import-score.js";
import { scriptDecisionAnswers } from "../../../test/script-decisions.js";
import { ANALYSIS_NOTICES, analyzeImport, unrelatedNotice } from "./analyze-import.service.js";
import { DECISIONS_MODEL, DECISIONS_URL } from "./responses-client.js";
import type { ImportSection } from "./import-catalog.js";
import type { ImportSheet } from "./sheet-plan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../test/fixtures");

type ExpectedFile = {
  section: ImportSection;
  currency: "ARS" | "USD";
  rows: Record<string, string>[];
  unrelated?: boolean;
};

function cases(dir: string, unrelated: boolean): { name: string; expected: ExpectedFile; sheets: ImportSheet[] }[] {
  const folder = path.join(ROOT, dir);
  return readdirSync(folder)
    .filter((file) => file.endsWith(".grid.json"))
    .map((file) => file.replace(/\.grid\.json$/, ""))
    .sort()
    .flatMap((name) => {
      const expected = JSON.parse(readFileSync(path.join(folder, `${name}.expected.json`), "utf8")) as ExpectedFile;
      if (Boolean(expected.unrelated) !== unrelated) return [];
      const sheets = JSON.parse(readFileSync(path.join(folder, `${name}.grid.json`), "utf8")) as ImportSheet[];
      return [{ name: `${dir}/${name}`, expected, sheets }];
    });
}

const related = [...cases("import-sales", false), ...cases("import-clients", false)];
const unrelated = [...cases("import-sales", true), ...cases("import-clients", true)];

describe("sales and client import fixtures offline", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it.each(related)("$name imports every expected row and nothing else", async ({ expected, sheets }) => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(DECISIONS_URL);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        input: string;
        questions: { name: string; type: string }[];
      };
      expect(body.model).toBe(DECISIONS_MODEL);
      expect(body.questions.some((question) => question.name.endsWith("_inc"))).toBe(true);
      return new Response(JSON.stringify({
        answers: scriptDecisionAnswers(body as never),
        usage: { input_tokens: 900, output_tokens: 40 },
      }), { status: 200 });
    });

    const result = await analyzeImport(
      { section: expected.section, currency: expected.currency, sheets },
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("model");
    const score = scoreLabeledRows(expected.rows, result.rows);
    expect(score.missing, JSON.stringify({ score, rows: result.rows }, null, 1)).toBe(0);
    expect(score.extra, JSON.stringify({ score, rows: result.rows }, null, 1)).toBe(0);
    expect(score.imported).toBe(expected.rows.length);
    fetchSpy.mockRestore();
  });

  it.each(unrelated)("$name imports nothing and says the file is unrelated", async ({ expected, sheets }) => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const fetchImpl = vi.fn();
    const result = await analyzeImport(
      { section: expected.section, currency: expected.currency, sheets },
      { fetchImpl },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.rows).toEqual([]);
    expect(result.summary.rowCount).toBe(0);
    expect(result.notice).toBe(expected.section === "sales" ? ANALYSIS_NOTICES.unrelatedSales : ANALYSIS_NOTICES.unrelatedClients);
    expect(result.notice).toBe(unrelatedNotice(expected.section));
    fetchSpy.mockRestore();
  });
});
