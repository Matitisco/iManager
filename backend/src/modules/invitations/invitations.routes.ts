import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember } from "../../middleware/section-access.js";
import { actorFor } from "../audit/audit.js";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  previewInvitation,
  acceptInvitation,
} from "./invitations.service.js";

const createSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["MANAGER", "STAFF"]),
  sections: z.array(z.string()).optional(),
  sensitiveAccess: z.boolean().optional(),
});

export async function invitationsRoutes(app: FastifyInstance) {
  // Public routes are isolated in a child scope so auth hooks below don't affect them.
  app.register(async (pub) => {
    const previewOptions = {
      exposeHeadRoute: true,
      // Preview URLs contain a bearer capability; Fastify logs requests before onRequest hooks.
      logSerializers: { req: (request: FastifyRequest) => ({ method: request.method, url: "/api/invitations/preview/[redacted]", hostname: request.hostname, remoteAddress: request.ip }) },
    };
    pub.get("/preview/:token", previewOptions, async (request, reply) => {
      const { token } = request.params as { token: string };

      try {
        const data = await previewInvitation(token);
        return data;
      } catch (error) {
        request.log.error({ event: "invite_preview_error" }, "Invitation preview failed");
        return reply.code(500).send({ error: "No se pudo verificar la invitación. Probá de nuevo." });
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
        const statusCode = e.statusCode && e.statusCode >= 400 && e.statusCode < 500 ? e.statusCode : 500;
        request.log.warn(
          {
            event: "invite_accept_failed",
            ...logContext,
            statusCode,
          },
          "Invitation accept failed"
        );
        return reply.code(statusCode).send({ error: statusCode < 500 ? e.message : "No se pudo aceptar la invitación. Probá de nuevo." });
      }
    });
  });

  const protectedPreHandler = [authenticate, resolveAppUser];

  app.get("/", { preHandler: protectedPreHandler }, async (request, reply) => {
    requireMember(request);
    if (request.appUser.role !== "OWNER" && request.appUser.role !== "MANAGER") {
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

  app.post("/", { preHandler: protectedPreHandler }, async (request, reply) => {
    requireMember(request);

    try {
      const body = createSchema.parse(request.body);
      const result = await createInvitation(
        request.appUser.storeId,
        request.appUser.role,
        body.email,
        body.role,
        { sections: body.sections, sensitiveAccess: body.sensitiveAccess },
        request.appUser.userId,
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
          errorMessage: e.statusCode && e.statusCode < 500 ? e.message : undefined,
        },
        "Invitation create failed"
      );
      if (e.statusCode) {
        return reply.code(e.statusCode).send({ error: e.message });
      }
      throw err;
    }
  });

  app.delete("/:id", { preHandler: protectedPreHandler }, async (request, reply) => {
    requireMember(request);

    const { id } = request.params as { id: string };
    try {
      await revokeInvitation(request.appUser.storeId, id, request.appUser.role, await actorFor(request.appUser));
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
          errorMessage: e.statusCode && e.statusCode < 500 ? e.message : undefined,
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
