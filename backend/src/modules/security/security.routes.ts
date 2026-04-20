import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";

export async function securityRoutes(app: FastifyInstance) {
  const disabledMessage =
    "La autenticación de dos factores está deshabilitada hasta implementar un flujo seguro con enforcement real.";

  app.all("/2fa", { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.code(410).send({ error: disabledMessage });
  });

  app.all("/2fa/send", { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.code(410).send({ error: disabledMessage });
  });

  app.all("/2fa/verify", { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.code(410).send({ error: disabledMessage });
  });
}
