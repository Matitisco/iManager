import { z, ZodError } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser } from "../auth/session.service.js";
import {
  activateStoreForUser,
  createStoreForUser,
  listStoresForUser,
  updateStore,
  listMembers,
  updateMemberRole,
  removeMember,
} from "./stores.service.js";

const storePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  legalName: z.string().max(160).nullable().optional(),
  taxId: z.string().max(50).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  instagram: z.string().max(80).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  currency: z.string().max(10).optional(),
  timezone: z.string().max(80).optional(),
});

const memberRoleSchema = z.object({
  role: z.enum(["OWNER", "MANAGER", "STAFF"]),
});

const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const activateStoreSchema = z.object({
  storeId: z.string().trim().min(1),
});

function sendServiceError(reply: FastifyReply, error: unknown) {
  const mapped = error as { statusCode?: number; message?: string };
  if (mapped.statusCode) {
    return reply.code(mapped.statusCode).send({ error: mapped.message });
  }

  throw error;
}

export async function storesRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      const user = await findOrCreateUserFromFirebase(request.auth);
      const stores = await listStoresForUser(user.id);
      return { stores };
    }
  );

  app.post(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      const body = createStoreSchema.parse(request.body);
      const user = await findOrCreateUserFromFirebase(request.auth);

      try {
        await createStoreForUser(user.id, body.name);
      } catch (error) {
        return sendServiceError(reply, error);
      }

      const session = await buildAppSessionForUser(request.auth);
      return { session };
    }
  );

  app.post(
    "/active",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      const body = activateStoreSchema.parse(request.body);
      const user = await findOrCreateUserFromFirebase(request.auth);

      try {
        await activateStoreForUser(user.id, body.storeId);
      } catch (error) {
        return sendServiceError(reply, error);
      }

      const session = await buildAppSessionForUser(request.auth);
      return { session };
    }
  );

  app.patch(
    "/current",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }
      if (request.appUser.role !== "OWNER" && request.appUser.role !== "MANAGER") {
        return reply.code(403).send({ error: "No tenés permisos para editar la tienda" });
      }

      try {
        const body = storePatchSchema.parse(request.body);
        const store = await updateStore(request.appUser.storeId, body);
        return { store };
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.code(400).send({ error: "Revisá los datos de la tienda" });
        }
        return sendServiceError(reply, error);
      }
    }
  );

  // GET /api/stores/:storeId/members
  app.get(
    "/:storeId/members",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }
      if (request.appUser.role !== "OWNER" && request.appUser.role !== "MANAGER") {
        return reply.code(403).send({ error: "No tenés permisos para ver el equipo" });
      }
      const { storeId } = request.params as { storeId: string };
      if (request.appUser.storeId !== storeId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const members = await listMembers(storeId);
      return { members };
    }
  );

  // PATCH /api/stores/:storeId/members/:memberId
  app.patch(
    "/:storeId/members/:memberId",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }
      if (request.appUser.role !== "OWNER" && request.appUser.role !== "MANAGER") {
        return reply.code(403).send({ error: "No tenés permisos para gestionar el equipo" });
      }
      const { storeId, memberId } = request.params as { storeId: string; memberId: string };
      if (request.appUser.storeId !== storeId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      try {
        const { role } = memberRoleSchema.parse(request.body);
        const member = await updateMemberRole(storeId, memberId, role, request.appUser.role, request.appUser.userId);
        return { member };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        if (e.statusCode) {
          return reply.code(e.statusCode).send({ error: e.message });
        }
        throw err;
      }
    }
  );

  // DELETE /api/stores/:storeId/members/:memberId
  app.delete(
    "/:storeId/members/:memberId",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }
      if (request.appUser.role !== "OWNER" && request.appUser.role !== "MANAGER") {
        return reply.code(403).send({ error: "No tenés permisos para gestionar el equipo" });
      }
      const { storeId, memberId } = request.params as { storeId: string; memberId: string };
      if (request.appUser.storeId !== storeId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      try {
        await removeMember(storeId, memberId, request.appUser.role, request.appUser.userId);
        return { ok: true };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string };
        if (e.statusCode) {
          return reply.code(e.statusCode).send({ error: e.message });
        }
        throw err;
      }
    }
  );
}
