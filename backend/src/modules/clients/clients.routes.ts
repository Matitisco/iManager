import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import type { ClientInput } from "./clients.service.js";
import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
} from "./clients.service.js";

const clientCreateSchema = z.object({
  dni: z.string().min(1).max(50),
  name: z.string().min(1).max(120),
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  lastPurchaseDate: z.string().trim().optional().nullable(),
  totalSpent: z.number().nonnegative().optional(),
  pendingBalance: z.number().nonnegative().optional(),
});

const clientPatchSchema = clientCreateSchema.partial();

export async function clientsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const clients = await listClients(request.appUser.storeId);
      return { clients };
    }
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const body = clientCreateSchema.parse(request.body) as ClientInput;
      const client = await createClient(request.appUser.storeId, body);

      return reply.code(201).send({ client });
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = clientPatchSchema.parse(request.body);
      const client = await updateClient(request.appUser.storeId, params.id, body);

      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }

      return { client };
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const deleted = await deleteClient(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Client not found" });
      }

      return reply.code(204).send();
    }
  );
}
