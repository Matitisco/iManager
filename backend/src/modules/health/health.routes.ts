import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    // A heuristic cache would answer DevTools "Offline" with the last 200.
    reply.header("cache-control", "no-store");
    return { status: "ok" };
  });
}
