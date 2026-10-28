import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerApiErrorHandler } from "../../lib/api-error.js";
import { ANALYSIS_NOTICES } from "./analyze-import.service.js";
import { importRoutes } from "./import.routes.js";
import { syntheticStockRows } from "../../../test/fixtures/headerless-stock.js";

const { authenticateMock, resolveAppUserMock, findStoreMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  findStoreMock: vi.fn(async () => ({ currency: "ARS" })),
}));

vi.mock("../../middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("../../middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

vi.mock("../../plugins/prisma.js", () => ({
  prisma: { store: { findUnique: findStoreMock } },
}));

function buildApp() {
  const app = Fastify();
  registerApiErrorHandler(app);
  return app;
}

const sheets = [{ name: "Hoja 1", rows: [["Nombre", "Email"], ["Ana", "ana@test.com"]] }];

describe("importRoutes analyze", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    findStoreMock.mockClear();
  });

  it("roundtrips a headerless plan and its physical column indices through analyze/apply", async () => {
    delete process.env.OPENAI_API_KEY;
    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "OWNER", userId: "user-1" };
    });
    const app = buildApp();
    await app.register(importRoutes);
    try {
      const payload = { section: "inventory", sheets: [{ name: "stock de equipos", rows: syntheticStockRows() }] };
      const analyzed = await app.inject({ method: "POST", url: "/analyze", payload });
      expect(analyzed.statusCode).toBe(200);
      const analysis = analyzed.json();
      expect(analysis.plan[0]).toMatchObject({ headerRow: 0, dataStartRow: 1 });
      expect(analysis.plan[0].mapping.find((column: { field: string }) => column.field === "batteryHealth")).toMatchObject({ header: "E", columnIndex: 4 });
      const applied = await app.inject({ method: "POST", url: "/apply", payload: { ...payload, plan: analysis.plan } });
      expect(applied.statusCode).toBe(200);
      expect(applied.json().rows).toEqual(analysis.rows);
      expect(applied.json().diagnostics).toMatchObject({ detectedRows: 60, acceptedRows: 59, discardedRows: 1 });
      const customField = `custom:${'c'.repeat(60)}`;
      analysis.plan[0].mapping[1].field = customField;
      const custom = await app.inject({ method: "POST", url: "/apply", payload: { ...payload, plan: analysis.plan } });
      expect(custom.statusCode).toBe(200);
      expect(custom.json().rows[0]).toMatchObject({ [customField]: 'PROV1', entryDate: '1/10/2026', batteryHealth: '80%', _sourceRow: '1' });
      expect(custom.json().rows[2]).toMatchObject({ status: 'EN_REVISION', originalStatus: 'SIN SERVICIO' });
    } finally {
      await app.close();
    }
  });


  it("returns missing price diagnostics through analyze and apply without changing the zero-row result", async () => {
    delete process.env.OPENAI_API_KEY;
    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "OWNER", userId: "user-1" };
    });
    const app = buildApp();
    await app.register(importRoutes);
    const payload = { section: "inventory", sheets: [{ name: "Stock", rows: [["Modelo", "Costo", "Color"], ["iPhone 13", "420", "Negro"]] }] };
    const analyzed = await app.inject({ method: "POST", url: "/analyze", payload });
    expect(analyzed.statusCode).toBe(200);
    const expected = { rows: [{ model: "iPhone 13" }], missingRequiredFields: [], missingRecommendedFields: ["price", "imei"], diagnostics: { detectedRows: 1, acceptedRows: 1, discardedRows: 0, discardedByReason: {} } };
    expect(analyzed.json()).toMatchObject(expected);
    const applied = await app.inject({ method: "POST", url: "/apply", payload: { ...payload, plan: analyzed.json().plan } });
    expect(applied.statusCode).toBe(200);
    expect(applied.json()).toMatchObject(expected);
    await app.close();
  });

  it("returns the heuristic plan when OpenAI is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "OWNER", userId: "user-1" };
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const app = buildApp();
    await app.register(importRoutes);

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { section: "clients", sheets },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: "heuristic",
      notice: null,
      currency: "ARS",
      summary: { sheetCount: 1, rowCount: 1 },
      rows: [{ name: "Ana", email: "ana@test.com" }],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(findStoreMock).toHaveBeenCalled();
    fetchSpy.mockRestore();
    await app.close();
  });

  it("rejects staff without access and an empty workbook", async () => {
    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "STAFF", userId: "user-1", sections: ["sales"] };
    });
    const app = buildApp();
    await app.register(importRoutes);

    const forbidden = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { section: "inventory", sheets },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "No tenés acceso a Inventario" });

    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "OWNER", userId: "user-1" };
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { section: "inventory", sheets: [] },
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});
