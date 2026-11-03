import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeOnboardingMock, authenticateMock, resolveAppUserMock } = vi.hoisted(() => ({
  completeOnboardingMock: vi.fn(),
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
}));

vi.mock("./config/env.js", () => ({
  env: {
    PORT: 3000,
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/imanager_test",
    FIREBASE_PROJECT_ID: "demo-project",
    FIREBASE_CLIENT_EMAIL: "demo@example.com",
    FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
    FIRESTORE_DATABASE_ID: "demo-database",
    SMTP_PORT: 587,
    ENABLE_TEST_AUTH_BYPASS: true,
  },
}));

vi.mock("./middleware/authenticate.js", () => ({
  authenticate: authenticateMock,
}));

vi.mock("./middleware/resolve-app-user.js", () => ({
  resolveAppUser: resolveAppUserMock,
}));

vi.mock("./modules/onboarding/onboarding.service.js", () => ({
  completeOnboarding: completeOnboardingMock,
}));

vi.mock("./modules/audit/audit.js", () => ({
  loadActor: vi.fn(async () => ({ userId: "user-1", displayName: "Prueba" })),
}));

vi.mock("./modules/commissions/commissions.service.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./modules/commissions/commissions.service.js")>(),
  saveCommissionRule: vi.fn(async (_store, _actor, input) => ({ id: "rule-1", ...input })),
}));
vi.mock("./modules/clients/clients.service.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./modules/clients/clients.service.js")>(),
  createClient: vi.fn(async (_store, input) => ({ id: "client-1", ...input })),
}));

import { saveCommissionRule } from "./modules/commissions/commissions.service.js";
import { createClient } from "./modules/clients/clients.service.js";
import { buildApp } from "./app.js";

function equipment(overrides: Record<string, unknown> = {}) {
  return {
    imei: "123456789012345",
    model: "iPhone 13",
    capacity: "128GB",
    color: "Negro",
    condition: "USADO",
    grade: "A",
    batteryHealth: "90%",
    cost: 100,
    price: 200,
    status: "DISPONIBLE",
    ...overrides,
  };
}

describe("validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateMock.mockImplementation(async (request: { auth?: unknown }) => {
      request.auth = {
        firebaseUid: "firebase-user-1",
        email: "owner@example.com",
      };
    });
    resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
      request.appUser = {
        userId: "user-1",
        storeId: "store-1",
        role: "OWNER",
        sections: null,
      };
    });
  });

  it("returns 400 in spanish when onboarding name is empty", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      payload: { storeName: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Completá el nombre de la tienda",
      message: "Completá el nombre de la tienda",
      fields: { storeName: "Completá el nombre de la tienda" },
    });
    expect(response.body).not.toContain("too_small");
    expect(completeOnboardingMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 when equipment cost or price is negative", async () => {
    const app = buildApp();
    const cost = await app.inject({
      method: "POST",
      url: "/api/inventory",
      payload: equipment({ cost: -15, price: 200 }),
    });
    const price = await app.inject({
      method: "POST",
      url: "/api/inventory",
      payload: equipment({ cost: 15, price: -20 }),
    });

    expect(cost.statusCode).toBe(400);
    expect(cost.json()).toMatchObject({
      error: "El costo no puede ser negativo",
      fields: { cost: "El costo no puede ser negativo" },
    });
    expect(price.statusCode).toBe(400);
    expect(price.json()).toMatchObject({
      error: "El precio no puede ser negativo",
      fields: { price: "El precio no puede ser negativo" },
    });
    expect(cost.body).not.toContain("too_small");
    expect(price.body).not.toContain("Internal Server Error");
    await app.close();
  });

  it("returns 400 when the model is 500 characters", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/inventory",
      payload: equipment({ model: "a".repeat(500) }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "El modelo puede tener hasta 100 caracteres",
      message: "El modelo puede tener hasta 100 caracteres",
      fields: { model: "El modelo puede tener hasta 100 caracteres" },
    });
    expect(response.body).not.toContain("too_big");
    await app.close();
  });

  it("returns 400 when the client name is 300 characters", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/clients",
      payload: { name: "a".repeat(300) },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "El nombre puede tener hasta 120 caracteres",
      message: "El nombre puede tener hasta 120 caracteres",
      fields: { name: "El nombre puede tener hasta 120 caracteres" },
    });
    expect(response.body).not.toContain("too_big");
    await app.close();
  });

  it("returns 400 when a payment is negative", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/clients/client-1/payments",
      payload: { amount: -50, method: "EFECTIVO" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "El pago no puede ser negativo",
      message: "El pago no puede ser negativo",
      fields: { amount: "El pago no puede ser negativo" },
    });
    expect(response.body).not.toContain("too_small");
    await app.close();
  });

  // Recorded on Zod 3.25.76; these snapshots also gate the Zod 4 migration.
  it.each([
    ["missing name", "POST", "/api/clients", {}],
    ["null name", "POST", "/api/clients", { name: null }],
    ["wrong name type", "POST", "/api/clients", { name: 123 }],
    ["long name", "POST", "/api/clients", { name: "x".repeat(121) }],
    ["invalid currency", "POST", "/api/clients", { name: "Prueba", balanceCurrency: "EUR" }],
    ["invalid record", "POST", "/api/clients", { name: "Prueba", customFields: [] }],
    ["missing payment", "POST", "/api/clients/client-1/payments", { method: "EFECTIVO" }],
    ["null payment", "POST", "/api/clients/client-1/payments", { amount: null, method: "EFECTIVO" }],
    ["wrong payment type", "POST", "/api/clients/client-1/payments", { amount: "5", method: "EFECTIVO" }],
    ["zero payment", "POST", "/api/clients/client-1/payments", { amount: 0, method: "EFECTIVO" }],
    ["invalid expense currency", "POST", "/api/expenses", { date: "2026-11-03", category: "Local", amount: 10, currency: "EUR" }],
    ["missing expense currency", "POST", "/api/expenses", { date: "2026-11-03", category: "Local", amount: 10 }],
    ["null expense currency", "POST", "/api/expenses", { date: "2026-11-03", category: "Local", amount: 10, currency: null }],
    ["money decimals", "POST", "/api/expenses", { date: "2026-11-03", category: "Local", amount: 1.234, currency: "USD" }],
    ["invalid email", "POST", "/api/billing/quote", { key: "BASIC_MONTHLY", payerEmail: "invalid" }],
    ["strict query", "GET", "/api/reports/periodic-summary?unexpected=1", undefined],
    ["empty commission patch", "PATCH", "/api/commissions/rules/rule-1", {}],
    ["strict commission patch", "PATCH", "/api/commissions/rules/rule-1", { unexpected: true }],
    ["nested repair tags", "POST", "/api/repairs", { device: "iPhone", faultTags: [""] }],
    ["too many repair tags", "POST", "/api/repairs", { device: "iPhone", faultTags: Array(13).fill("Falla") }],
    ["repair refinement", "POST", "/api/repairs", { device: "iPhone" }],
    ["strict catalog", "PATCH", "/api/catalog", { unexpected: true }],
  ] as const)("preserves the 400 contract: %s", async (_name, method, url, payload) => {
    const app = buildApp();
    try {
      const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchSnapshot();
    } finally {
      await app.close();
    }
  });

  it.each([
    [1e100, "El dato no puede ser mayor a 3650"],
    [1.5, "El dato no es válido"],
  ])("preserves integer bounds and messages for %s", async (warrantyDays, message) => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/repairs", payload: { device: "iPhone", fault: "Pantalla", warrantyDays } });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ statusCode: 400, error: message, message, fields: { warrantyDays: message } });
    } finally { await app.close(); }
  });

  it("rejects oversized invalid collections before visiting elements (Zod 4 security cap)", async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/repairs", payload: { device: "iPhone", faultTags: Array(13).fill("") } });
      const message = "La falla puede tener hasta 12 elementos";
      expect(response.statusCode).toBe(400);
      // Zod 3 also listed faultTags.0..8 errors. Zod 4 deliberately avoids
      // traversing oversized input; restoring that traversal defeats its fix.
      expect(response.json()).toEqual({ statusCode: 400, error: message, message, fields: { faultTags: message } });
    } finally { await app.close(); }
  });

  it("keeps omitted commission fields absent in PATCH", async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: "PATCH", url: "/api/commissions/rules/rule-1", payload: { rate: 5 } });
      expect(response.statusCode).toBe(200);
      expect(vi.mocked(saveCommissionRule).mock.calls[0]?.[2]).toEqual({ rate: 5 });
    } finally { await app.close(); }
  });

  it("preserves arbitrary custom field values and strips unknown client fields", async () => {
    const app = buildApp();
    try {
      const customFields = { text: "ok", empty: null, number: 2, nested: { flags: [true, false] } };
      const response = await app.inject({ method: "POST", url: "/api/clients", payload: { name: "Prueba", customFields, unknown: true } });
      expect(response.statusCode).toBe(201);
      expect(vi.mocked(createClient).mock.calls[0]?.[1]).toEqual({ name: "Prueba", customFields });
    } finally { await app.close(); }
  });

  it("keeps real failures as 500 with a generic spanish message", async () => {
    completeOnboardingMock.mockRejectedValue(new Error("postgres://user:super-secret-db-password@localhost/imanager"));
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      payload: { storeName: "Sucursal Norte", instagram: "@norte" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      statusCode: 500,
      error: "Ocurrió un error interno. Probá de nuevo.",
      message: "Ocurrió un error interno. Probá de nuevo.",
    });
    expect(response.body).not.toContain("super-secret-db-password");
    expect(response.body).not.toContain("postgres");
    await app.close();
  });
});
