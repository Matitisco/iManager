import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import {
  sendTwoFactorCode,
  verifyTwoFactorCode,
  disableTwoFactor,
} from "./security.service.js";

const verifySchema = z.object({ code: z.string().length(6) });

export async function securityRoutes(app: FastifyInstance) {
  // POST /api/security/2fa/send — genera y envía código
  app.post(
    "/2fa/send",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "Unauthenticated" });

      const user = await findOrCreateUserFromFirebase(request.auth);
      try {
        await sendTwoFactorCode(user.id);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al enviar el código";
        return reply.code(400).send({ error: msg });
      }
    }
  );

  // POST /api/security/2fa/verify — verifica el código y activa 2FA
  app.post(
    "/2fa/verify",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "Unauthenticated" });

      const parsed = verifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Código inválido" });
      }

      const user = await findOrCreateUserFromFirebase(request.auth);
      try {
        await verifyTwoFactorCode(user.id, parsed.data.code);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al verificar el código";
        return reply.code(400).send({ error: msg });
      }
    }
  );

  // DELETE /api/security/2fa — desactiva 2FA
  app.delete(
    "/2fa",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "Unauthenticated" });

      const user = await findOrCreateUserFromFirebase(request.auth);
      await disableTwoFactor(user.id);
      return { ok: true };
    }
  );
}
