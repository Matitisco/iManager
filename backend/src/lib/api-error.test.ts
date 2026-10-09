import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toValidationBody } from "./api-error.js";
import { registerApiErrorHandler } from "./api-error.js";

describe("toValidationBody", () => {
  it("translates an empty name, a negative price and a long model", () => {
    const emptyName = z.object({ storeName: z.string().trim().min(1).max(120) }).safeParse({ storeName: "" });
    const negativePrice = z.object({ price: z.number().positive(), cost: z.number().nonnegative() }).safeParse({ price: -20, cost: -5 });
    const longModel = z.object({ model: z.string().trim().min(1).max(100) }).safeParse({ model: "a".repeat(500) });

    expect(emptyName.success).toBe(false);
    expect(negativePrice.success).toBe(false);
    expect(longModel.success).toBe(false);
    if (emptyName.success || negativePrice.success || longModel.success) return;

    expect(toValidationBody(emptyName.error)).toMatchObject({
      error: "El nombre es obligatorio",
      fields: { storeName: "El nombre es obligatorio" },
    });
    expect(toValidationBody(negativePrice.error)).toMatchObject({
      error: "El precio no puede ser negativo",
      fields: {
        price: "El precio no puede ser negativo",
        cost: "El costo no puede ser negativo",
      },
    });
    expect(toValidationBody(longModel.error)?.error).toBe("El modelo puede tener hasta 100 caracteres");
  });

  it("calls a client payment amount a pago", () => {
    const parsed = z.object({ amount: z.number().positive() }).safeParse({ amount: -1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(toValidationBody(parsed.error, "/api/clients/client-1/payments")).toMatchObject({
      error: "El pago no puede ser negativo",
      fields: { amount: "El pago no puede ser negativo" },
    });
  });
});

describe("registerApiErrorHandler", () => {
  it("maps Fastify schema failures to a spanish 400 and hides internal 500s", async () => {
    const app = Fastify({
      logger: false,
      ajv: { customOptions: { allErrors: true } },
    });
    registerApiErrorHandler(app);
    app.post("/items", {
      schema: {
        body: {
          type: "object",
          additionalProperties: true,
          properties: {
            price: { type: "number", minimum: 0 },
            model: { type: "string", maxLength: 100 },
          },
        },
      },
    }, async () => ({ ok: true }));
    app.get("/boom", async () => {
      throw new Error("postgres://user:super-secret-db-password@localhost/imanager");
    });

    const invalid = await app.inject({
      method: "POST",
      url: "/items",
      payload: { price: -8, model: "x".repeat(500) },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({
      statusCode: 400,
      error: "El precio no puede ser negativo",
      message: "El precio no puede ser negativo",
      fields: {
        price: "El precio no puede ser negativo",
        model: "El modelo puede tener hasta 100 caracteres",
      },
    });
    expect(invalid.body).not.toContain("too_small");
    expect(invalid.body).not.toContain("must NOT");

    const crashed = await app.inject({ method: "GET", url: "/boom" });
    expect(crashed.statusCode).toBe(500);
    expect(crashed.json()).toEqual({
      statusCode: 500,
      error: "Ocurrió un error interno. Probá de nuevo.",
      message: "Ocurrió un error interno. Probá de nuevo.",
    });
    expect(crashed.body).not.toContain("super-secret-db-password");

    await app.close();
  });

  it("labels the repair order fields in Spanish with the right gender", () => {
    const parsed = z.object({ deposit: z.number().nonnegative(), estimate: z.number().nonnegative(), device: z.string().min(1) })
      .safeParse({ deposit: -1, estimate: -1, device: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(toValidationBody(parsed.error)?.fields).toEqual({
      deposit: "La seña no puede ser negativa",
      estimate: "El presupuesto no puede ser negativo",
      device: "El equipo es obligatorio",
    });
  });
});
