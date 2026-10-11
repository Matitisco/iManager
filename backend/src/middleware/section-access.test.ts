import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { registerApiErrorHandler } from "../lib/api-error.js";
import { DomainError } from "../lib/domain-error.js";
import { requireMember } from "./section-access.js";

class ModuleError extends DomainError {}

async function routes(app: FastifyInstance) {
  app.get("/member", async (request) => {
    requireMember(request);
    return { storeId: request.appUser.storeId };
  });
  app.get("/stock", async () => {
    throw new ModuleError("Stock insuficiente", 409);
  });
}

function buildApp(appUser?: { userId: string; storeId: string; role: "OWNER" }) {
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (request) => {
    request.appUser = appUser;
  });
  app.register(routes, { prefix: "/api" });
  registerApiErrorHandler(app);
  return app;
}

describe("requireMember", () => {
  it("answers 403 when the request has no store membership", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/member" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Store membership required" });
    await app.close();
  });

  it("lets a member through", async () => {
    const app = buildApp({ userId: "user-1", storeId: "store-1", role: "OWNER" });
    const response = await app.inject({ method: "GET", url: "/api/member" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ storeId: "store-1" });
    await app.close();
  });

  it("maps module errors thrown by plugin routes with their own status", async () => {
    const app = buildApp({ userId: "user-1", storeId: "store-1", role: "OWNER" });
    const response = await app.inject({ method: "GET", url: "/api/stock" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Stock insuficiente" });
    await app.close();
  });
});
