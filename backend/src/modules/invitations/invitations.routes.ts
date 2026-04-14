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

function tokenPrefix(token: string) {
  return token.slice(0, 8);
}

export async function invitationsRoutes(app: FastifyInstance) {
  // Public routes are isolated in a child scope so auth hooks below don't affect them.
  app.register(async (pub) => {
    pub.get("/preview/:token", async (request, reply) => {
      const { token } = request.params as { token: string };
      const logContext = { tokenPrefix: tokenPrefix(token) };

      try {
        const data = await previewInvitation(token);
        if (!data) {
          request.log.warn({ event: "invite_preview_unavailable", ...logContext }, "Invitation preview unavailable");
          return reply.code(410).send({ error: "La invitacion expiro o ya fue utilizada" });
        }

        request.log.info(
          { event: "invite_preview_ok", ...logContext, storeName: data.storeName, role: data.role },
          "Invitation preview loaded"
        );
        return data;
      } catch (error) {
        request.log.error({ event: "invite_preview_error", ...logContext, error }, "Invitation preview failed");
        throw error;
      }
    });

    pub.post("/accept", { preHandler: [authenticate] }, async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      const { token } = request.body as { token: string };
      if (!token || typeof token !== "string") {
        return reply.code(400).send({ error: "Token requerido" });
      }

      const logContext = {
        tokenPrefix: tokenPrefix(token),
        firebaseUid: request.auth.firebaseUid,
        email: request.auth.email ?? null,
      };

      try {
        const session = await acceptInvitation(token, request.auth);
        request.log.info(
          {
            event: "invite_accept_ok",
            ...logContext,
            storeId: session.store?.id ?? null,
            onboardingRequired: session.onboardingRequired,
            role: session.membership?.role ?? null,
          },
          "Invitation accepted"
        );
        return { session };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        request.log.warn(
          {
            event: "invite_accept_failed",
            ...logContext,
            statusCode: e.statusCode ?? 500,
            errorMessage: e.message,
          },
          "Invitation accept failed"
        );
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    });
  });

  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", resolveAppUser);

  app.get("/", async (request, reply) => {
    if (!request.appUser) {
      return reply.code(403).send({ error: "Store membership required" });
    }
    if (request.appUser.role !== "OWNER" && request.appUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "No tenes permisos para ver las invitaciones" });
    }

    const invitations = await listInvitations(request.appUser.storeId);
    request.log.info(
      {
        event: "invite_list_ok",
        storeId: request.appUser.storeId,
        actorRole: request.appUser.role,
        actorUserId: request.appUser.userId,
        count: invitations.length,
      },
      "Invitation list loaded"
    );
    return { invitations };
  });

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

      request.log.info(
        {
          event: "invite_create_ok",
          storeId: request.appUser.storeId,
          actorRole: request.appUser.role,
          actorUserId: request.appUser.userId,
          email: body.email ?? null,
          invitedRole: body.role,
          invitationId: result.id,
          tokenPrefix: tokenPrefix(result.token),
        },
        "Invitation created"
      );
      return reply.code(201).send(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      request.log.warn(
        {
          event: "invite_create_failed",
          storeId: request.appUser.storeId,
          actorRole: request.appUser.role,
          actorUserId: request.appUser.userId,
          statusCode: e.statusCode ?? 500,
          errorMessage: e.message,
        },
        "Invitation create failed"
      );
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw err;
    }
  });

  app.delete("/:id", async (request, reply) => {
    if (!request.appUser) {
      return reply.code(403).send({ error: "Store membership required" });
    }

    const { id } = request.params as { id: string };
    try {
      await revokeInvitation(request.appUser.storeId, id, request.appUser.role);
      request.log.info(
        {
          event: "invite_revoke_ok",
          storeId: request.appUser.storeId,
          actorRole: request.appUser.role,
          actorUserId: request.appUser.userId,
          invitationId: id,
        },
        "Invitation revoked"
      );
      return { ok: true };
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string };
      request.log.warn(
        {
          event: "invite_revoke_failed",
          storeId: request.appUser.storeId,
          actorRole: request.appUser.role,
          actorUserId: request.appUser.userId,
          invitationId: id,
          statusCode: e.statusCode ?? 500,
          errorMessage: e.message,
        },
        "Invitation revoke failed"
      );
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw err;
    }
  });
}
