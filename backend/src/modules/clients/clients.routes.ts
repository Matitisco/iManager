import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess, requireMember } from "../../middleware/section-access.js";
import { requireSensitiveActor } from "../stores/sensitive-access.js";
import type { ClientInput } from "./clients.service.js";
import {
  createClient,
  deleteClient,
  listClientPayments,
  registerClientPayment,
  importClients,
  listClients,
  updateClient,
  listClientCategories,
  createClientCategory,
  renameClientCategory,
  deleteClientCategory,
  reorderClientCategories,
  bulkMoveClientCategory,
} from "./clients.service.js";

const clientCreateSchema = z.object({
  dni: z.string().trim().max(50).optional().nullable(),
  name: z.string().min(1).max(120),
  categoryId: z.string().nullable().optional(),
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  instagram: z.string().trim().max(80).optional().nullable(),
  lastPurchaseDate: z.string().trim().optional().nullable(),
  totalSpent: z.number().nonnegative().optional(),
  pendingBalance: z.number().nonnegative().optional(),
  balanceCurrency: z.enum(["ARS", "USD"]).nullable().optional(),
  tag: z.string().trim().max(30).nullable().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

const clientPatchSchema = clientCreateSchema.partial();

export async function clientsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")],
    },
    async (request, reply) => {
      requireMember(request);

      const clients = await listClients(request.appUser.storeId);
      return { clients };
    }
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")],
    },
    async (request, reply) => {
      requireMember(request);

      const body = clientCreateSchema.parse(request.body) as ClientInput;
      const client = await createClient(request.appUser.storeId, body);

      return reply.code(201).send({ client });
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = clientPatchSchema.parse(request.body);
      const client = await updateClient(request.appUser.storeId, params.id, body);

      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }

      return { client };
    }
  );

  app.get(
    "/:id/payments",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] },
    async (request, reply) => {
      requireMember(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payments = await listClientPayments(request.appUser.storeId, params.id);
      if (!payments) return reply.code(404).send({ error: "Client not found" });
      return { payments };
    }
  );

  app.post(
    "/:id/payments",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] },
    async (request, reply) => {
      requireMember(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = z.object({
        amount: z.number().positive(),
        method: z.string().trim().min(1).max(50),
        currency: z.enum(["ARS", "USD"]).nullable().optional(),
      }).parse(request.body);
      const client = await registerClientPayment(request.appUser.storeId, params.id, {
        amount: body.amount ?? 0,
        method: body.method ?? '',
        currency: body.currency,
      });
      if (!client) return reply.code(404).send({ error: "Client not found" });
      return reply.code(201).send({ client });
    }
  );

  app.post(
    "/import",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] },
    async (request, reply) => {
      requireMember(request);

      const bodySchema = z.object({
        rows: z.array(
          z.object({
            name:  z.string().trim().optional(),
            dni:   z.string().trim().optional(),
            email: z.string().trim().optional(),
            phone: z.string().trim().optional(),
            instagram: z.string().trim().optional(),
          })
        ),
      });

      const { rows } = bodySchema.parse(request.body);
      const result = await importClients(request.appUser.storeId, rows);
      return reply.code(200).send(result);
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const actor = await requireSensitiveActor(request.appUser, reply);
      if (!actor) return;
      const deleted = await deleteClient(request.appUser.storeId, params.id, actor);

      if (!deleted) {
        return reply.code(404).send({ error: "Client not found" });
      }

      return reply.code(204).send();
    }
  );

  // ── Categories ────────────────────────────────────────────────────────────

  app.get("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const categories = await listClientCategories(request.appUser.storeId);
    return { categories };
  });

  app.post("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(request.body);
    const category = await createClientCategory(request.appUser.storeId, name);
    return reply.code(201).send({ category });
  });

  app.patch("/categories/reorder", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const { categoryIds } = z.object({ categoryIds: z.array(z.string()) }).parse(request.body);
    await reorderClientCategories(request.appUser.storeId, categoryIds);
    return reply.code(204).send();
  });

  app.patch("/categories/bulk-move", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const body = z.object({ itemIds: z.array(z.string()), categoryId: z.string().nullable() }).parse(request.body);
    await bulkMoveClientCategory(request.appUser.storeId, body.itemIds, body.categoryId);
    return reply.code(204).send();
  });

  app.patch("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(request.body);
    const category = await renameClientCategory(request.appUser.storeId, id, name);
    if (!category) return reply.code(404).send({ error: "Category not found" });
    return { category };
  });

  app.delete("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("clients")] }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await deleteClientCategory(request.appUser.storeId, id);
    if (!deleted) return reply.code(404).send({ error: "Category not found" });
    return reply.code(204).send();
  });
}
