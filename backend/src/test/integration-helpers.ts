import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import { prisma } from "../plugins/prisma.js";
import { ensureTestDatabase, resetDatabase } from "./db.js";

export function useIntegrationApp() {
  let app: FastifyInstance;

  beforeAll(async () => {
    await ensureTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return {
    getApp() {
      return app;
    },
  };
}
