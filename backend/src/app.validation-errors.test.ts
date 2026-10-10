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

  it("keeps real failures as 500 with a generic spanish message", async () => {
    completeOnboardingMock.mockRejectedValue(new Error("postgres://user:super-secret-db-password@localhost/imanager"));
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      payload: { storeName: "Sucursal Norte" },
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
