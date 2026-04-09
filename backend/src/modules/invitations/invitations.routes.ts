import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  previewInvitation,
  acceptInvitation,
} from "./invitations.service.js";

const createSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "SELLER"]),
});

export async function invitationsRoutes(app: FastifyInstance) {
  // GET /api/invitations/preview/:token — no auth required
  app.get("/preview/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    const data = await previewInvitation(token);
    if (!data) {
      return reply.code(410).send({ error: "La invitación expiró o ya fue utilizada" });
    }
    return data;
  });

  // POST /api/invitations/accept — requires Firebase auth
  app.post("/accept", { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.auth) {
      return reply.code(401).send({ error: "Unauthenticated" });
    }
    const { token } = request.body as { token: string };
    if (!token || typeof token !== "string") {
      return reply.code(400).send({ error: "Token requerido" });
    }
    try {
      const session = await acceptInvitation(token, request.auth);
      return { session };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // From here on: requires auth + store membership
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", resolveAppUser);

  // GET /api/invitations
  app.get("/", async (request, reply) => {
    if (!request.appUser) {
      return reply.code(403).send({ error: "Store membership required" });
    }
    const invitations = await listInvitations(request.appUser.storeId);
    return { invitations };
  });

  // POST /api/invitations
  app.post("/", async (request, reply) => {
    if (!request.appUser) {
      return reply.code(403).send({ error: "Store membership required" });
    }
    try {
      const body = createSchema.parse(request.body);
      const result = await createInvitation(
        request.appUser.storeId,
        request.appUser.role,
        body.email,
        body.role
      );
      return reply.code(201).send(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw err;
    }
  });

  // DELETE /api/invitations/:id
  app.delete("/:id", async (request, reply) => {
    if (!request.appUser) {
      return reply.code(403).send({ error: "Store membership required" });
    }
    const { id } = request.params as { id: string };
    try {
      await revokeInvitation(request.appUser.storeId, id, request.appUser.role);
      return { ok: true };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw err;
    }
  });
}
