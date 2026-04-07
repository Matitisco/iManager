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
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
  bulkMoveCategory,
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
  categoryId: z.string().nullable().optional(),
});

const salePatchSchema = z
  .object({
    paymentMethod: paymentMethodSchema.optional(),
    status: z.enum(["COMPLETADA", "PENDIENTE"]).optional(),
    date: z.string().min(1).max(120).optional(),
    amount: z.number().nonnegative().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function salesRoutes(app: FastifyInstance) {
  // ── Categories ─────────────────────────────────────────────────────────── //

  app.get(
    "/categories",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const categories = await listCategories(request.appUser.storeId);
      return { categories };
    }
  );

  app.post(
    "/categories",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
      try {
        const category = await createCategory(request.appUser.storeId, name);
        return reply.code(201).send({ category });
      } catch (error) {
        const err = getSalesErrorStatus(error);
        if (err) return reply.code(err.statusCode).send({ error: err.message });
        throw error;
      }
    }
  );

  app.patch(
    "/categories/reorder",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const { categoryIds } = z.object({ categoryIds: z.array(z.string()) }).parse(request.body);
      await reorderCategories(request.appUser.storeId, categoryIds);
      return reply.code(204).send();
    }
  );

  app.patch(
    "/categories/bulk-move",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const body = z.object({
        itemIds: z.array(z.string()),
        categoryId: z.string().nullable(),
      }).parse(request.body);
      
      try {
        const count = await bulkMoveCategory(request.appUser.storeId, body.itemIds, body.categoryId);
        return { count };
      } catch (error) {
        const err = getSalesErrorStatus(error);
        if (err) return reply.code(err.statusCode).send({ error: err.message });
        throw error;
      }
    }
  );

  app.patch(
    "/categories/:id",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
      try {
        const category = await renameCategory(request.appUser.storeId, id, name);
        if (!category) return reply.code(404).send({ error: "Category not found" });
        return { category };
      } catch (error) {
        const err = getSalesErrorStatus(error);
        if (err) return reply.code(err.statusCode).send({ error: err.message });
        throw error;
      }
    }
  );

  app.delete(
    "/categories/:id",
    { preHandler: [authenticate, resolveAppUser] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const deleted = await deleteCategory(request.appUser.storeId, id);
      if (!deleted) return reply.code(404).send({ error: "Category not found" });
      return reply.code(204).send();
    }
  );

  // ── Sales ──────────────────────────────────────────────────────────────── //

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
