import { afterEach, describe, expect, it, vi } from "vitest";
import { DECISIONS_URL, DEFAULT_DECISIONS_MODEL } from "./decisions-client.js";
import { MAPPING_NOTICES, suggestColumnMapping, type MappingLogEntry } from "./suggest-mapping.service.js";

const columns = [
  { header: "Modelo", samples: ["iPhone 14", "Galaxy A54"] },
  { header: "Precio", samples: ["450000", "280000"] },
];

function choiceBody(choice: string, confidence: number, inputTokens = 1000, probabilities?: { value: string; probability: number }[]) {
  return {
    model: DEFAULT_DECISIONS_MODEL,
    answers: [
      {
        type: "choice",
        name: "field",
        choice,
        ...(confidence >= 0 ? { confidence } : {}),
        probabilities: probabilities ?? [{ value: choice, probability: Math.max(confidence, 0) }],
      },
    ],
    usage: { input_tokens: inputTokens, output_tokens: 0, total_tokens: inputTokens },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestBody(call: unknown[]) {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body)) as {
    model: string;
    input: string;
    questions: { type: string; name: string; choices: { value: string }[] }[];
  };
}

describe("suggestColumnMapping", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_DECISIONS_MODEL;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_DECISIONS_MODEL;
    else process.env.OPENAI_DECISIONS_MODEL = previousModel;
  });

  it("uses the name heuristic and does not call OpenAI when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchImpl = vi.fn();
    const logs: MappingLogEntry[] = [];

    const result = await suggestColumnMapping(
      { section: "inventory", columns },
      { fetchImpl, log: (entry) => logs.push(entry) },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(MAPPING_NOTICES.missingKey);
    expect(result.suggestions).toEqual([
      { header: "Modelo", field: "model", confidence: null, review: false, suggestedField: "model" },
      { header: "Precio", field: "price", confidence: null, review: false, suggestedField: "price" },
    ]);
    expect(logs[0]).toMatchObject({ source: "heuristic", inputTokens: 0, estimatedUsd: 0, model: null });
  });

  it("does not call the network from tests unless fetch is injected", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    const result = await suggestColumnMapping({ section: "inventory", columns: [columns[0]!] });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(MAPPING_NOTICES.error);
    fetchSpy.mockRestore();
  });

  it("asks one choice question per column and marks low confidence for review", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_DECISIONS_MODEL;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(choiceBody("model", 0.94)))
      .mockResolvedValueOnce(jsonResponse(choiceBody("price", 0.42, 500)));
    const logs: MappingLogEntry[] = [];

    const result = await suggestColumnMapping(
      { section: "inventory", columns },
      { fetchImpl, log: (entry) => logs.push(entry) },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DECISIONS_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = requestBody(fetchImpl.mock.calls[0] as unknown[]);
    expect(body.model).toBe(DEFAULT_DECISIONS_MODEL);
    expect(body.questions[0]).toMatchObject({ type: "choice", name: "field" });
    expect(body.questions[0]?.choices.some((choice) => choice.value === "Ignorar columna")).toBe(true);
    expect(body.questions[0]?.choices.some((choice) => choice.value === "model")).toBe(true);
    expect(body.input).toContain("Encabezado: Modelo");
    expect(body.input).toContain("1. iPhone 14");
    expect(result).toMatchObject({
      source: "decisions",
      notice: null,
      suggestions: [
        { header: "Modelo", field: "model", confidence: 0.94, review: false, suggestedField: "model" },
        { header: "Precio", field: "price", confidence: 0.42, review: true, suggestedField: "price" },
      ],
    });
    expect(logs[0]).toMatchObject({
      source: "decisions",
      model: DEFAULT_DECISIONS_MODEL,
      inputTokens: 1500,
      estimatedUsd: 0.00015,
    });
  });

  it("reads the model from OPENAI_DECISIONS_MODEL", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_DECISIONS_MODEL = "gpt-6-luna-custom";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(choiceBody("model", 0.8)));

    await suggestColumnMapping(
      { section: "inventory", columns: [columns[0]!] },
      { fetchImpl },
    );

    expect(requestBody(fetchImpl.mock.calls[0] as unknown[]).model).toBe("gpt-6-luna-custom");
  });

  it("keeps the higher confidence column when two map to the same field", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(choiceBody("price", 0.64)))
      .mockResolvedValueOnce(jsonResponse(choiceBody("price", 0.91)));

    const result = await suggestColumnMapping({
      section: "inventory",
      columns: [
        { header: "Precio promo", samples: ["9"] },
        { header: "Precio lista", samples: ["10"] },
      ],
    }, { fetchImpl });

    expect(result.source).toBe("decisions");
    expect(result.suggestions).toEqual([
      { header: "Precio promo", field: null, confidence: 0.64, review: true, suggestedField: "price" },
      { header: "Precio lista", field: "price", confidence: 0.91, review: false, suggestedField: "price" },
    ]);
  });

  it("keeps the earlier column when confidence ties", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(choiceBody("color", 0.8)))
      .mockResolvedValueOnce(jsonResponse(choiceBody("color", 0.8)));

    const result = await suggestColumnMapping({
      section: "inventory",
      columns: [
        { header: "Pintura", samples: ["Negro"] },
        { header: "Tono", samples: ["Azul"] },
      ],
    }, { fetchImpl });

    expect(result.suggestions.map((suggestion) => suggestion.field)).toEqual(["color", null]);
  });

  it("falls back to the heuristic when the model refuses", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        answers: [{ type: "refusal", name: "field" }],
        usage: { input_tokens: 80 },
      }))
      .mockResolvedValueOnce(jsonResponse(choiceBody("price", 0.99)));

    const result = await suggestColumnMapping({ section: "inventory", columns }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(MAPPING_NOTICES.refusal);
    expect(result.suggestions.find((suggestion) => suggestion.header === "Modelo")?.field).toBe("model");
  });

  it("falls back when the account has no balance", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        error: { message: "You exceeded your current quota", type: "insufficient_quota", code: "insufficient_quota" },
      }, 429))
      .mockResolvedValue(jsonResponse(choiceBody("price", 0.99)));

    const quota = await suggestColumnMapping({ section: "inventory", columns }, { fetchImpl });
    expect(quota.notice).toBe(MAPPING_NOTICES.quota);
    expect(quota.source).toBe("heuristic");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    fetchImpl.mockReset();
    fetchImpl.mockResolvedValue(jsonResponse({ error: { message: "Payment required" } }, 402));
    const payment = await suggestColumnMapping(
      { section: "inventory", columns: [columns[0]!] },
      { fetchImpl },
    );
    expect(payment.notice).toBe(MAPPING_NOTICES.quota);
  });

  it("falls back on API errors, invalid choices and timeouts without using a partial answer", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "server" } }, 500));

    const errored = await suggestColumnMapping(
      { section: "inventory", columns: [columns[0]!] },
      { fetchImpl },
    );
    expect(errored).toMatchObject({ source: "heuristic", notice: MAPPING_NOTICES.error });

    fetchImpl.mockReset();
    fetchImpl.mockResolvedValueOnce(jsonResponse(choiceBody("not-a-field", 0.99)));
    const invalid = await suggestColumnMapping(
      { section: "inventory", columns: [columns[0]!] },
      { fetchImpl },
    );
    expect(invalid.notice).toBe(MAPPING_NOTICES.error);
    expect(invalid.suggestions[0]?.field).toBe("model");

    fetchImpl.mockReset();
    fetchImpl.mockRejectedValueOnce(new Error("timeout"));
    const rejected = await suggestColumnMapping(
      { section: "clients", columns: [{ header: "Nombre", samples: ["Ana"] }] },
      { fetchImpl },
    );
    expect(rejected.notice).toBe(MAPPING_NOTICES.error);
    expect(rejected.suggestions[0]?.field).toBe("name");
  });

  it("uses the chosen probability when confidence is missing and ignores extra samples", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const long = "x".repeat(200);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(choiceBody("name", -1, 10, [
      { value: "name", probability: 0.77 },
      { value: "Ignorar columna", probability: 0.23 },
    ])));

    const result = await suggestColumnMapping({
      section: "clients",
      columns: [{
        header: "Nombre",
        samples: ["", " Ana ", long, "Beto", "Carla", "Dina", "Eva", "Fede", "Gabi", "Hugo", "Ivan", "Julia"],
      }],
    }, { fetchImpl });

    const body = requestBody(fetchImpl.mock.calls[0] as unknown[]);
    const sampleLines = body.input.split("\n").filter((line) => /^\d+\. /.test(line));
    expect(sampleLines).toHaveLength(8);
    expect(sampleLines[1]).toBe(`2. ${"x".repeat(80)}`);
    expect(body.input).not.toContain("Julia");
    expect(result.suggestions[0]).toMatchObject({ field: "name", confidence: 0.77, review: false });
  });

  it("stops before calling OpenAI when the deadline already passed", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn();

    const result = await suggestColumnMapping(
      { section: "inventory", columns },
      { fetchImpl, deadlineMs: 0 },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.notice).toBe(MAPPING_NOTICES.error);
    expect(result.suggestions.find((suggestion) => suggestion.header === "Precio")?.field).toBe("price");
  });

  it("does not map one file column to two fields", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await suggestColumnMapping({
      section: "inventory",
      columns: [{ header: "Modelo y color", samples: ["iPhone negro"] }],
    });

    const assigned = result.suggestions.filter((suggestion) => suggestion.field);
    expect(assigned).toEqual([
      expect.objectContaining({ header: "Modelo y color", field: "model" }),
    ]);
  });

  it("leaves a confident ignored column empty and flags an unsure one", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(choiceBody("Ignorar columna", 0.93)))
      .mockResolvedValueOnce(jsonResponse(choiceBody("Ignorar columna", 0.2)));

    const result = await suggestColumnMapping({
      section: "sales",
      columns: [
        { header: "Notas", samples: ["caja abierta"] },
        { header: "Obs", samples: ["?"] },
      ],
    }, { fetchImpl });

    expect(result.suggestions).toEqual([
      { header: "Notas", field: null, confidence: 0.93, review: false, suggestedField: null },
      { header: "Obs", field: null, confidence: 0.2, review: true, suggestedField: null },
    ]);
  });
});
