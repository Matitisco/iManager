import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import {
  createSale,
  deleteSale,
  getSalesErrorStatus,
  listSales,
  updateSale,
} from "./sales.service.js";

const paymentMethodSchema = z.enum([
  "TRANSFERENCIA",
  "EFECTIVO",
  "TARJETA",
  "CANJE / PAGO",
  "T. Crédito",
]);

const saleCreateSchema = z.object({
  date: z.string().min(1).max(120),
  clientId: z.string().min(1),
  productId: z.string().min(1),
  amount: z.number().nonnegative(),
  paymentMethod: paymentMethodSchema,
  status: z.enum(["COMPLETADA", "PENDIENTE"]),
});

const salePatchSchema = z
  .object({
    paymentMethod: paymentMethodSchema.optional(),
    status: z.enum(["COMPLETADA", "PENDIENTE"]).optional(),
    date: z.string().min(1).max(120).optional(),
    amount: z.number().nonnegative().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function salesRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const sales = await listSales(request.appUser.storeId);
      return { sales };
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

      const body = saleCreateSchema.parse(request.body) as Parameters<typeof createSale>[1];

      try {
        const sale = await createSale(request.appUser.storeId, body);
        return reply.code(201).send({ sale });
      } catch (error) {
        const mapped = getSalesErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
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
      const body = salePatchSchema.parse(request.body);
      const sale = await updateSale(request.appUser.storeId, params.id, body);

      if (!sale) {
        return reply.code(404).send({ error: "Sale not found" });
      }

      return { sale };
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
      const deleted = await deleteSale(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Sale not found" });
      }

      return reply.code(204).send();
    }
  );
}
