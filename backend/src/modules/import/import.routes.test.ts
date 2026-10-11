import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerApiErrorHandler } from "../../lib/api-error.js";
import { MAPPING_NOTICES } from "./suggest-mapping.service.js";
import { importRoutes } from "./import.routes.js";

const { authenticateMock, resolveAppUserMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
}));

vi.mock("../../middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("../../middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

function buildApp() {
  const app = Fastify();
  registerApiErrorHandler(app);
  return app;
}

describe("importRoutes suggest-mapping", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("returns the heuristic mapping when OpenAI is not configured", async () => {
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
      url: "/suggest-mapping",
      payload: {
        section: "inventory",
        columns: [
          { header: "Modelo", samples: ["iPhone 14", ""] },
          { header: "Obs", samples: [] },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      source: "heuristic",
      notice: MAPPING_NOTICES.missingKey,
      suggestions: [
        { header: "Modelo", field: "model", confidence: null, review: false, suggestedField: "model" },
        { header: "Obs", field: null, confidence: null, review: false, suggestedField: null },
      ],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await app.close();
  });

  it("rejects staff without access to the section and invalid files", async () => {
    authenticateMock.mockImplementation(async () => undefined);
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "STAFF", userId: "user-1", sections: ["sales"] };
    });
    const app = buildApp();
    await app.register(importRoutes);

    const forbidden = await app.inject({
      method: "POST",
      url: "/suggest-mapping",
      payload: { section: "inventory", columns: [{ header: "Modelo", samples: ["iPhone"] }] },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "No tenés acceso a Inventario" });

    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = { storeId: "store-1", role: "OWNER", userId: "user-1" };
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/suggest-mapping",
      payload: { section: "inventory", columns: [] },
    });
    expect(invalid.statusCode).toBe(400);

    await app.close();
  });
});

describe("importRoutes detect", () => {
  const previousKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  it("detects a sheet with the heuristic and does not call OpenAI", async () => {
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
      url: "/detect",
      payload: {
        section: "inventory",
        currency: "ARS",
        sheets: [{
          name: "iPhones Usados",
          rows: [
            ["STOCK DE EQUIPOS USADOS"],
            ["COTIZACION EN PESOS SEGUN PRECIO DE VENTA DEL DOLAR BLUE:", "1540"],
            ["Modelo", "Batería", "Color", "PRECIO USD", "PRECIO ARS"],
            ["13 mini 128 GB", "0.96", "Midnight", "310", "477400"],
          ],
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      source: "heuristic",
      notice: null,
      totals: { sheets: 1, rows: 1 },
    });
    expect(response.json().sheets[0].rows[0]).toMatchObject({
      model: "13 mini",
      capacity: "128 GB",
      color: "Midnight",
      batteryHealth: "96%",
      price: "477400",
      condition: "USADO",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    await app.close();
  });
});
