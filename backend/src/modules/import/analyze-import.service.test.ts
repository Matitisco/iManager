import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYSIS_NOTICES, analyzeImport, applyImportPlan, type AnalysisLogEntry } from "./analyze-import.service.js";
import { scriptDecisionAnswers } from "../../../test/script-decisions.js";
import { DECISIONS_MODEL, DECISIONS_URL, DEFAULT_IMPORT_MODEL, RESPONSES_URL, estimateDecisionsUsd } from "./responses-client.js";
import { normalizeBattery, splitModelCapacity, type ImportSheet } from "./sheet-plan.js";

const RATE = 1540;

it.each([
  { field: 'grade', values: ['A', 'A/A-', 'B/C'] },
  { field: 'condition', values: ['USADO', 'NUEVO', 'PRE-OWNED'] },
])('manual: conserva $field nativo cuando todos los valores son reconocidos', ({ field, values }) => {
  const sheets: ImportSheet[] = [{ name: 'Equipos', rows: [['Modelo', field], ...values.map(value => ['iPhone 13', value])] }];
  const result = applyImportPlan({ section: 'inventory', currency: 'USD', sheets, plan: [{
    name: 'Equipos', include: true, condition: '', headerRow: 1, dataStartRow: 2, dataEndRow: 4,
    mapping: [{ header: 'Modelo', columnIndex: 0, field: 'model' }, { header: field, columnIndex: 1, field }],
    splitModelCapacity: false, batteryAsPercent: false, priceCurrency: 'USD',
  }] });
  expect(result.rows).toHaveLength(values.length);
  expect(result.plan[0].mapping[1].field).toBe(field);
  expect(result.suggestedDefinitions).toBeUndefined();
  expect(result.rows.every(row => row[field] && !Object.keys(row).some(key => key.startsWith('custom:')))).toBe(true);
});

function ars(usd: number, override?: string): string {
  return override ?? String(usd * RATE);
}

function usados(): ImportSheet {
  const rows: string[][] = [
    ["STOCK DE EQUIPOS USADOS", "", "", "", ""],
    ["TU COMPRA INCLUYE DE REGALO CABLE + FUNDA + VIDRIO", "", "", "", ""],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", "", String(RATE)],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!", "", "", "", ""],
    ["Modelo", "Batería", "Color", "PRECIO USD", "PRECIO ARS"],
  ];
  const items: [string, string, string, number, string?][] = [
    ["12 64 GB", "1", "Midnight", 280, "435.4"],
    ["13 mini 128 GB", "0.96", "Midnight", 310],
    ["13 mini 128 GB", "1", "Midnight", 330],
    ["13 mini 256 GB", "1", "Midnight", 350],
    ["13 128 GB", "83% - 84%", "Starlight", 340],
    ["13 Pro 128 GB", "1", "Grafito", 470],
    ["13 Pro 256 GB", "1", "Grafito", 500],
    ["13 Pro Max 128 GB", "1", "Blue", 590],
    ["14 128 GB", "0.87", "Midnight", 440],
    ["14 128 GB", "1", "Starlight - Lila", 450],
    ["14 Pro 128 GB", "1", "Black", 550],
    ["15 128 GB", "0.89", "Black", 530],
    ["15 Pro 128 GB", "0.89", "Natural", 650],
    ["16 128 GB", "0.88", "White", 640],
    ["16 128 GB", "0.89", "White", 650],
    ["16 Plus 256 GB", "90% - 91%", "Black - Pink", 720],
    ["16 Pro Max 256 GB", "91% 92%", "Desert", 960, "$1.497.600"],
    ["16 Pro Max 256 GB", "0.95", "Black", 980],
    ["17 Pro 256 GB", "0.92", "Orange", 1150],
    ["17 Pro Max 256 GB", "0.9", "Orange", 1230],
  ];
  for (const [model, battery, color, usd, special] of items) {
    rows.push([model, battery, color, String(usd), ars(usd, special)]);
  }
  rows.push(["PRECIO NO INCLUYE IVA", "", "", "", ""]);
  return { name: "iPhones Usados", rows };
}

function nuevos(): ImportSheet {
  const rows: string[][] = [
    ["STOCK DE EQUIPOS NUEVOS", "", "", ""],
    ["GARANTIA OFICIAL APPLE POR 12 MESES!", "", "", ""],
    ["CON TU COMPRA TE LLEVAS DE REGALO FUNDA", "", "", ""],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", String(RATE)],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!", "", "", ""],
    ["Modelo", "Color", "PRECIO USD", "PRECIO ARS"],
  ];
  const phones: [string, string, number][] = [
    ["15 128 GB", "Black - Blue", 790],
    ["17 256 GB", "Sage", 1050],
    ["17 Pro 256 GB", "Blue", 1260],
    ["17 Pro Max 256 GB", "Orange", 1370],
    ["18 Pro 256 GB", "Black", 1490],
    ["18 Pro Max 256 GB", "Black", 1670],
  ];
  for (const [model, color, usd] of phones) rows.push([model, color, String(usd), ars(usd)]);
  rows.push(["IPADS", "", "", ""]);
  rows.push(["iPad A16 256 GB", "Silver", "620", ars(620)]);
  rows.push(["OTROS ACCESORIOS ORIGIANALES", "", "", ""]);
  rows.push(["AirPods Pro 3", "", "290", ars(290)]);
  rows.push(["Adaptador 20 W", "", "58", ars(58)]);
  rows.push(["AirTag Pack x4", "", "180", ars(180)]);
  rows.push(["PRECIO NO INCLUYE IVA.", "", "", ""]);
  return { name: "iPhones Nuevos", rows };
}

function outlet(): ImportSheet {
  const rows: string[][] = [
    ["EQUIPOS OUTLET", "", "", "", ""],
    ["GARANTIA POR 90 DIAS!!!!!", "", "", "", ""],
    ["TU COMPRA INCLUYE DE REGALO", "", "", "", ""],
    ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "", "", "", String(RATE)],
    ["PRECIO DE PROMOCIÓN ABONANDO SOLO EN EFECTIVO!", "", "", "", ""],
    ["Modelo", "Batería", "Color", "PRECIO USD", "PRECIO ARS"],
  ];
  const items: [string, string, string, number][] = [
    ["13 Pro Max 128 GB", "0.84", "Green", 460],
    ["15 Pro 128 GB", "1", "Blue", 600],
    ["15 Pro Max 256 GB", "0.85", "Blue", 700],
    ["15 Pro Max 256 GB", "0.86", "Blue", 710],
    ["15 Pro Max 256 GB", "1", "Natural", 730],
    ["16 Pro 128 GB", "0.9", "Natural", 790],
    ["16 Pro Max 256 GB", "0.92", "Black", 920],
  ];
  for (const [model, battery, color, usd] of items) {
    rows.push([model, battery, color, String(usd), ars(usd)]);
  }
  rows.push(["PRECIO NO INCLUYE IVA", "", "", "", ""]);
  return { name: "OUTLET", rows };
}

function stock(): ImportSheet[] {
  return [usados(), nuevos(), outlet()];
}

function modelResponse(plan: unknown, inputTokens = 4000, outputTokens = 900) {
  return new Response(JSON.stringify({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(plan) }] }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("ejemplo stock heuristic", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("imports every sheet without a manual setup", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchImpl = vi.fn();

    const result = await analyzeImport(
      { section: "inventory", currency: "ARS", sheets: stock() },
      { fetchImpl },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.summary.sheetCount).toBe(3);
    expect(result.summary.rowCount).toBe(37);
    expect(result.summary.sheets.map((sheet) => [sheet.name, sheet.rows, sheet.condition])).toEqual([
      ["iPhones Usados", 20, "USADO"],
      ["iPhones Nuevos", 10, "NUEVO"],
      ["OUTLET", 7, "USADO"],
    ]);
    expect(result.rows).toHaveLength(37);
    expect(result.rows.some((row) => JSON.stringify(row).includes("[object Object]"))).toBe(false);
    expect(result.rows.every((row) => !row.model?.includes("GB"))).toBe(true);

    expect(result.rows[0]).toMatchObject({
      model: "12",
      capacity: "64 GB",
      batteryHealth: "100%",
      color: "Midnight",
      price: "431200",
      condition: "USADO",
    });
    expect(result.rows[1]).toMatchObject({
      model: "13 mini",
      capacity: "128 GB",
      batteryHealth: "96%",
      price: String(310 * RATE),
    });
    expect(result.rows.find((row) => row.model === "13" && row.color === "Starlight")).toMatchObject({
      capacity: "128 GB",
      batteryHealth: "83-84%",
    });
    expect(result.rows.find((row) => row.model === "16 Pro Max" && row.color === "Desert")).toMatchObject({
      batteryHealth: "91-92%",
      price: "1497600",
      capacity: "256 GB",
    });

    const nuevosRows = result.rows.filter((row) => row.condition === "NUEVO");
    expect(nuevosRows).toHaveLength(10);
    expect(nuevosRows[0]).toMatchObject({ model: "15", capacity: "128 GB", color: "Black - Blue", price: String(790 * RATE) });
    expect(nuevosRows.find((row) => row.model === "iPad A16")).toMatchObject({ capacity: "256 GB", color: "Silver" });
    expect(nuevosRows.find((row) => row.model === "AirPods Pro 3")).toMatchObject({ price: String(290 * RATE) });
    expect(nuevosRows.find((row) => row.model === "AirPods Pro 3")?.capacity).toBeUndefined();
    expect(nuevosRows.find((row) => row.model === "Adaptador 20 W")?.capacity).toBeUndefined();
    expect(nuevosRows.every((row) => !row.batteryHealth)).toBe(true);

    expect(result.rows.find((row) => row.color === "Green")).toMatchObject({
      model: "13 Pro Max",
      capacity: "128 GB",
      batteryHealth: "84%",
      condition: "USADO",
      price: String(460 * RATE),
    });
  });

  it("uses the USD column when the store currency is USD", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await analyzeImport(
      { section: "inventory", currency: "USD", sheets: [usados()] },
      { fetchImpl: vi.fn() },
    );

    expect(result.rows[0]).toMatchObject({ price: "280", condition: "USADO" });
    expect(result.rows.find((row) => row.color === "Desert")?.price).toBe("960");
    expect(result.plan[0]?.priceCurrency).toBe("USD");
    expect(result.plan[0]?.mapping.find((column) => column.field === "price")?.header).toBe("PRECIO USD");
  });
});

describe("battery and model normalization", () => {
  it('keeps recognizable sales with invalid prices visible instead of silently dropping them', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await analyzeImport({ section: 'sales', currency: 'ARS', sheets: [{ name: 'Ventas', rows: [
      ['Fecha', 'Cliente', 'Equipo', 'Precio'],
      ['22/10/2026', 'Lucía', 'iPhone 13', 'importe inválido'],
      ['nota', 'llamar al cliente mañana', '', ''],
    ] }] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ clientName: 'Lucía', device: 'iPhone 13', amount: 'importe inválido' });
  });

  it('preserves explicit inventory currencies in a mixed sheet without converting amounts', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets: [{ name: 'Equipos', rows: [
      ['Modelo', 'Precio', 'Moneda', 'Costo'],
      ['iPhone 13', '420,50', 'USD', '350,00'],
      ['iPhone 14', '850.000', 'ARS', '700.000'],
      ['iPhone 15', 'US$ 650,50', '', '500'],
    ] }] });
    expect(result.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ model: 'iPhone 13', price: '420.5', currency: 'USD', cost: '350' }),
      expect.objectContaining({ model: 'iPhone 14', price: '850000', currency: 'ARS', cost: '700000' }),
      expect.objectContaining({ model: 'iPhone 15', price: '650.5', currency: 'USD' }),
    ]));
    expect(result.plan[0].mapping).toContainEqual({ header: 'Moneda', columnIndex: 2, field: 'currency' });
  });

  it('keeps the currency of a USD-only inventory price column in an ARS store', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await analyzeImport({ section: 'inventory', currency: 'ARS', sheets: [{ name: 'Equipos', rows: [
      ['Modelo', 'Precio USD'], ['iPhone 13', '420,50'],
    ] }] });
    expect(result.rows[0]).toMatchObject({ price: '420.5', currency: 'USD' });
  });

  it("turns fractions and ranges into percentages", () => {
    expect(normalizeBattery("1")).toBe("100%");
    expect(normalizeBattery("0.96")).toBe("96%");
    expect(normalizeBattery("83% - 84%")).toBe("83-84%");
    expect(normalizeBattery("91% 92%")).toBe("91-92%");
    expect(normalizeBattery("87")).toBe("87%");
  });

  it("splits a capacity stuck to the model", () => {
    expect(splitModelCapacity("13 mini 128 GB")).toEqual({ model: "13 mini", capacity: "128 GB" });
    expect(splitModelCapacity("AirPods Pro 3")).toEqual({ model: "AirPods Pro 3", capacity: "" });
    expect(splitModelCapacity("Adaptador 20 W")).toEqual({ model: "Adaptador 20 W", capacity: "" });
  });
});

describe("analyzeImport model", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_IMPORT_MODEL;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_IMPORT_MODEL;
    else process.env.OPENAI_IMPORT_MODEL = previousModel;
  });

  it("does not call the network from tests unless fetch is injected", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const result = await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(ANALYSIS_NOTICES.error);
    fetchSpy.mockRestore();
  });

  it("sends one structured response and applies the plan", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_IMPORT_MODEL;
    const plan = {
      sheets: [{
        name: "Hoja 1",
        include: true,
        condition: "",
        headerRow: 1,
        dataStartRow: 2,
        dataEndRow: 2,
        mapping: [
          { header: "Nombre", field: "email" },
          { header: "Email", field: "name" },
        ],
        splitModelCapacity: false,
        batteryAsPercent: false,
        priceCurrency: "",
      }],
    };
    const fetchImpl = vi.fn().mockResolvedValue(modelResponse(plan));
    const logs: AnalysisLogEntry[] = [];
    const result = await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    }, { fetchImpl, log: (entry) => logs.push(entry) });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESPONSES_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      reasoning: { effort: string };
      text: { format: { type: string; strict: boolean; name: string; schema: { additionalProperties: boolean } } };
      input: { content: string }[];
    };
    expect(body.model).toBe(DEFAULT_IMPORT_MODEL);
    expect(body.reasoning.effort).toBe("low");
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true, name: "import_plan" });
    expect(body.text.format.schema.additionalProperties).toBe(false);
    expect(body.input[1]?.content).toContain("Hoja: Hoja 1");
    expect(body.input[1]?.content).toContain("Nombre");
    expect(JSON.stringify(body)).not.toContain("sk-test");
    expect(result.source).toBe("model");
    expect(result.notice).toBeNull();
    expect(result.rows).toEqual([{ email: "Ana", name: "ana@test.com" }]);
    expect(logs[0]).toMatchObject({
      source: "model",
      model: DEFAULT_IMPORT_MODEL,
      inputTokens: 4000,
      outputTokens: 900,
      estimatedUsd: 0.00085,
    });
  });

  it("reads the model id from OPENAI_IMPORT_MODEL", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_IMPORT_MODEL = "gpt-6-custom";
    const fetchImpl = vi.fn().mockResolvedValue(modelResponse({ sheets: [] }));
    await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    }, { fetchImpl });
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body)) as { model: string; reasoning?: unknown };
    expect(body.model).toBe("gpt-6-custom");
    expect(body.reasoning).toEqual({ effort: "low" });
  });

  it("falls back when the model refuses, has no balance or returns an invalid plan", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(modelResponse(null))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
        usage: { input_tokens: 10, output_tokens: 2 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "You exceeded your current quota", code: "insufficient_quota" },
      }), { status: 429 }));

    const invalid = await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    }, { fetchImpl });
    expect(invalid.source).toBe("heuristic");
    expect(invalid.notice).toBe(ANALYSIS_NOTICES.error);
    expect(invalid.rows).toEqual([{ name: "Ana", email: "ana@test.com" }]);

    const refused = await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    }, { fetchImpl });
    expect(refused.notice).toBe(ANALYSIS_NOTICES.refusal);

    const quota = await analyzeImport({
      section: "clients",
      currency: "ARS",
      sheets: [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }],
    }, { fetchImpl });
    expect(quota.notice).toBe(ANALYSIS_NOTICES.quota);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("asks Decisions once and prices input tokens only", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.OPENAI_IMPORT_MODEL;
    const logs: AnalysisLogEntry[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(DECISIONS_URL);
      const body = JSON.parse(String(init?.body)) as { model: string; questions: { name: string }[] };
      expect(body.model).toBe(DECISIONS_MODEL);
      expect(body.questions.length).toBeGreaterThan(0);
      return new Response(JSON.stringify({
        answers: scriptDecisionAnswers(body as never),
        usage: { input_tokens: 2_700, output_tokens: 400 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const result = await analyzeImport({
      section: "inventory",
      currency: "USD",
      sheets: [{ name: "Usados", rows: [["Modelo", "Color", "Precio USD"], ["13 128 GB", "Black", "500"]] }],
    }, { fetchImpl, log: (entry) => logs.push(entry) });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("model");
    expect(result.notice).toBeNull();
    expect(result.rows).toEqual([expect.objectContaining({ model: "13", capacity: "128 GB", color: "Black", price: "500", condition: "USADO" })]);
    expect(logs[0]).toMatchObject({
      source: "model",
      model: DECISIONS_MODEL,
      inputTokens: 2700,
      outputTokens: 400,
      estimatedUsd: estimateDecisionsUsd(2700),
    });
    expect(logs[0]?.estimatedUsd).toBe(0.00027);
  });

  it("uses a visible heuristic fallback on Decisions failure without calling Responses", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn(async () => new Response("no", { status: 500 }));
    const failed = await analyzeImport({ section: "inventory", currency: "USD",
      sheets: [{ name: "Usados", rows: [["Modelo", "Color", "Precio USD"], ["13 128 GB", "Black", "500"]] }],
    }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();

    expect(failed.source).toBe("heuristic"); expect(failed.notice).toBeTruthy();
    expect(failed.rows[0]).toMatchObject({ model: "13", price: "500" });
  });

  it("does not call Luna when Decisions has no balance", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "You exceeded your current quota", code: "insufficient_quota" },
    }), { status: 429 }));
    const result = await analyzeImport({
      section: "inventory",
      currency: "USD",
      sheets: [{ name: "Usados", rows: [["Modelo", "Color", "Precio USD"], ["13 128 GB", "Black", "500"]] }],
    }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe(DECISIONS_URL);
    expect(result.source).toBe("heuristic");
    expect(result.notice).toBe(ANALYSIS_NOTICES.quota);
    expect(result.rows[0]).toMatchObject({ model: "13", price: "500" });
  });
});
