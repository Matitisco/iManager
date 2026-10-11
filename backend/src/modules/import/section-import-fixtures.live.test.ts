import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scoreLabeledRows } from "../../../test/import-score.js";
import { analyzeImport } from "./analyze-import.service.js";
import type { ImportSection } from "./import-catalog.js";
import { DECISIONS_URL } from "./responses-client.js";
import type { ImportSheet } from "./sheet-plan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../test/fixtures");

type ExpectedFile = {
  section: ImportSection;
  currency: "ARS" | "USD";
  rows: Record<string, string>[];
  unrelated?: boolean;
};

const cases = ["import-sales", "import-clients"].flatMap((dir) => {
  const folder = path.join(ROOT, dir);
  return readdirSync(folder)
    .filter((file) => file.endsWith(".grid.json"))
    .map((file) => file.replace(/\.grid\.json$/, ""))
    .sort()
    .flatMap((name) => {
      const expected = JSON.parse(readFileSync(path.join(folder, `${name}.expected.json`), "utf8")) as ExpectedFile;
      if (expected.unrelated) return [];
      const sheets = JSON.parse(readFileSync(path.join(folder, `${name}.grid.json`), "utf8")) as ImportSheet[];
      return [{ name: `${dir}/${name}`, expected, sheets }];
    });
});

describe.skipIf(!process.env.OPENAI_API_KEY)("sales and client import fixtures live", () => {
  it.each(cases)("$name imports every expected row through Decisions", async ({ expected, sheets }) => {
    const urls: string[] = [];
    const result = await analyzeImport(
      { section: expected.section, currency: expected.currency, sheets },
      {
        fetchImpl: async (input, init) => {
          urls.push(String(input));
          return fetch(input, init);
        },
      },
    );
    expect(urls).toEqual([DECISIONS_URL]);
    expect(result.source).toBe("model");
    const score = scoreLabeledRows(expected.rows, result.rows);
    expect(score.missing, JSON.stringify({ score, rows: result.rows }, null, 1)).toBe(0);
    expect(score.extra, JSON.stringify({ score, rows: result.rows }, null, 1)).toBe(0);
    expect(score.imported).toBe(expected.rows.length);
  }, 30_000);
});
