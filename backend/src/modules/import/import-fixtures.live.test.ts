import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scoreImportRows } from "../../../test/import-score.js";
import { analyzeImport } from "./analyze-import.service.js";
import { DECISIONS_URL } from "./responses-client.js";
import type { ImportSheet } from "./sheet-plan.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../test/fixtures/import");

type ExpectedFile = { currency: "ARS" | "USD"; rows: { model?: string; capacity?: string; imei?: string }[] };

const names = readdirSync(FIXTURES)
  .filter((file) => file.endsWith(".grid.json"))
  .map((file) => file.replace(/\.grid\.json$/, ""))
  .sort();

describe.skipIf(!process.env.OPENAI_API_KEY)("import fixtures live", () => {
  it.each(names)("%s imports every expected row through Decisions", async (name) => {
    const sheets = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.grid.json`), "utf8")) as ImportSheet[];
    const expected = JSON.parse(readFileSync(path.join(FIXTURES, `${name}.expected.json`), "utf8")) as ExpectedFile;
    const urls: string[] = [];
    const result = await analyzeImport(
      { section: "inventory", currency: expected.currency, sheets },
      {
        fetchImpl: async (input, init) => {
          urls.push(String(input));
          return fetch(input, init);
        },
      },
    );
    expect(urls).toEqual([DECISIONS_URL]);
    expect(result.source).toBe("model");
    const score = scoreImportRows(expected.rows, result.rows);
    expect(score.missing, JSON.stringify(score)).toBe(0);
    expect(score.extra, JSON.stringify(score)).toBe(0);
    expect(score.imported).toBe(expected.rows.length);
  }, 30_000);
});
