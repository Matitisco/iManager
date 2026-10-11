import { afterEach, describe, expect, it, vi } from "vitest";
import { DETECT_NOTICES, detectImport, type DetectLogEntry } from "./detect-import.service.js";
import { DEFAULT_IMPORT_MODEL, RESPONSES_URL } from "./responses-client.js";

const sheet = {
  name: "Lista",
  rows: [
    ["Equipo", "Tono", "Precio"],
    ["iPhone 14", "Negro", "450000"],
  ],
};

function responseBody(plan: unknown, status = 200, usage = { input_tokens: 2000, output_tokens: 500 }) {
  return new Response(JSON.stringify({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(plan) }] }],
    usage,
  }), { status, headers: { "Content-Type": "application/json" } });
}

describe("detectImport", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_IMPORT_MODEL;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_IMPORT_MODEL;
    else process.env.OPENAI_IMPORT_MODEL = previousModel;
  });

  it("reads the sheet with the heuristic and does not call OpenAI without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchImpl = vi.fn();
    const logs: DetectLogEntry[] = [];
    const result = await detectImport(
      { section: "inventory", currency: "ARS", sheets: [sheet] },
      { fetchImpl, log: (entry) => logs.push(entry) },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBeNull();
    expect(result.totals).toEqual({ sheets: 1, rows: 1 });
    expect(result.sheets[0]?.rows[0]).toMatchObject({ model: "iPhone 14", price: "450000" });
    expect(result.sheets[0]?.rows[0]?.color).toBeUndefined();
    expect(logs[0]).toMatchObject({ source: "heuristic", model: null, inputTokens: 0, estimatedUsd: 0 });
  });

  it("does not call the network from tests unless fetch is injected", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const result = await detectImport({ section: "inventory", sheets: [sheet] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(DETECT_NOTICES.error);
    fetchSpy.mockRestore();
  });

  it("asks the Responses API for a strict plan and applies the mapping", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_IMPORT_MODEL;
    const fetchImpl = vi.fn().mockResolvedValue(responseBody({
      sheets: [{
        name: "Lista",
        include: true,
        headerRow: 1,
        columns: [
          { header: "Equipo", field: "model" },
          { header: "Tono", field: "color" },
          { header: "Precio", field: "price" },
        ],
      }],
    }));
    const logs: DetectLogEntry[] = [];
    const result = await detectImport(
      { section: "inventory", currency: "ARS", sheets: [sheet] },
      { fetchImpl, log: (entry) => logs.push(entry) },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESPONSES_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      store: boolean;
      reasoning: { effort: string };
      input: string;
      text: { format: { type: string; name: string; strict: boolean } };
    };
    expect(body.model).toBe(DEFAULT_IMPORT_MODEL);
    expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "import_plan", strict: true });
    expect(body.input).toContain("Moneda de la tienda: ARS");
    expect(body.input).toContain("Equipo | Tono | Precio");
    expect(result.source).toBe("responses");
    expect(result.notice).toBeNull();
    expect(result.sheets[0]?.rows[0]).toMatchObject({ model: "iPhone 14", color: "Negro", price: "450000" });
    expect(logs[0]).toMatchObject({
      source: "responses",
      model: DEFAULT_IMPORT_MODEL,
      inputTokens: 2000,
      outputTokens: 500,
      estimatedUsd: 0.009,
    });
  });

  it("reads the model from OPENAI_IMPORT_MODEL", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_IMPORT_MODEL = "gpt-6-luna";
    const fetchImpl = vi.fn().mockResolvedValue(responseBody({
      sheets: [{ name: "Lista", include: true, headerRow: 1, columns: [{ header: "Equipo", field: "model" }] }],
    }, 200, { input_tokens: 1000, output_tokens: 100 }));
    const logs: DetectLogEntry[] = [];
    await detectImport({ section: "inventory", sheets: [sheet] }, { fetchImpl, log: (entry) => logs.push(entry) });
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.model).toBe("gpt-6-luna");
    expect(logs[0]?.estimatedUsd).toBe(0.00015);
  });

  it("falls back when the model refuses, has no quota, or returns a bad plan", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const refusal = new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
      usage: { input_tokens: 10, output_tokens: 2 },
    }), { status: 200 });
    const quota = new Response(JSON.stringify({ error: { code: "insufficient_quota", message: "quota" } }), { status: 429 });
    const broken = responseBody({ sheets: [] });

    await expect(detectImport({ section: "inventory", sheets: [sheet] }, { fetchImpl: vi.fn().mockResolvedValue(refusal) }))
      .resolves.toMatchObject({ source: "heuristic", notice: DETECT_NOTICES.refusal });
    await expect(detectImport({ section: "inventory", sheets: [sheet] }, { fetchImpl: vi.fn().mockResolvedValue(quota) }))
      .resolves.toMatchObject({ source: "heuristic", notice: DETECT_NOTICES.quota });
    await expect(detectImport({ section: "inventory", sheets: [sheet] }, { fetchImpl: vi.fn().mockResolvedValue(broken) }))
      .resolves.toMatchObject({ source: "heuristic", notice: DETECT_NOTICES.error, totals: { rows: 1 } });
  });

  it("ignores an impossible header and still imports the row", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn().mockResolvedValue(responseBody({
      sheets: [{ name: "Lista", include: true, headerRow: 9, columns: [{ header: "Tono", field: "color" }] }],
    }));
    const result = await detectImport({ section: "inventory", sheets: [sheet] }, { fetchImpl });
    expect(result.source).toBe("responses");
    expect(result.sheets[0]?.headerRow).toBe(0);
    expect(result.sheets[0]?.rows[0]?.color).toBeUndefined();
    expect(result.sheets[0]?.rows[0]?.model).toBe("iPhone 14");
  });

  it("applies user overrides without calling OpenAI", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn();
    const result = await detectImport({
      section: "inventory",
      sheets: [sheet],
      overrides: [{ name: "Lista", include: false, headerRow: 0 }],
    }, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.totals).toEqual({ sheets: 0, rows: 0 });
  });
});
