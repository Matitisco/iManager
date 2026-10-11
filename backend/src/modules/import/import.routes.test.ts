import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerApiErrorHandler } from "../../lib/api-error.js";
import { ANALYSIS_NOTICES } from "./analyze-import.service.js";
import { importRoutes } from "./import.routes.js";

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
      notice: ANALYSIS_NOTICES.missingKey,
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
