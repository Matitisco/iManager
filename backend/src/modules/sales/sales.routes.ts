import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess } from "../../middleware/section-access.js";
import { cancelOperationFromSale, createOperation, getOperationErrorStatus, isIntegratedSale, updateSaleOperation } from "../operations/operations.service.js";
import {
  createSale,
  deleteSale,
  getSalesErrorStatus,
  importSales,
  listSales,
  updateSale,
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
  bulkMoveCategory,
} from "./sales.service.js";

const paymentMethodSchema = z.string().trim().min(1).max(50);
const operationTradeInSchema = z.object({
  deviceReceived: z.string().trim().min(1).max(120),
  deviceReceivedImei: z.string().trim().max(100).nullable().optional(),
  takeValue: z.number().nonnegative(),
  status: z.string().trim().max(30).optional(),
  batteryHealth: z.string().trim().max(50).nullable().optional(),
  grade: z.string().trim().max(20).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

const saleCreateSchema = z.object({
  date: z.string().min(1).max(120),
  clientId: z.string().trim().max(50).nullable().optional(),
  clientName: z.string().trim().max(120).nullable().optional(),
  productId: z.string().trim().max(50).optional(),
  deviceLabel: z.string().trim().max(120).nullable().optional(),
  amount: z.number().nonnegative(),
  paymentMethod: paymentMethodSchema,
  status: z.string().trim().min(1).max(20),
  categoryId: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
  tradeIn: operationTradeInSchema.optional(),
});

const salePatchSchema = z
  .object({
    clientId: z.string().trim().max(50).nullable().optional(),
    clientName: z.string().trim().max(120).nullable().optional(),
    productId: z.string().trim().max(50).nullable().optional(),
    deviceLabel: z.string().trim().max(120).nullable().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: z.string().trim().min(1).max(20).optional(),
    date: z.string().min(1).max(120).optional(),
    amount: z.number().nonnegative().optional(),
    categoryId: z.string().nullable().optional(),
    customFields: z.record(z.unknown()).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function salesRoutes(app: FastifyInstance) {
  // ── Import ──────────────────────────────────────────────────────────────── //

  app.post(
    "/import",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });

      const rowSchema = z.object({
        date:          z.string().trim().optional(),
        clientName:    z.string().trim().optional(),
        productImei:   z.string().trim().optional(),
        amount:        z.string().trim().optional(),
        paymentMethod: z.string().trim().optional(),
        status:        z.string().trim().optional(),
      });
      const { rows } = z.object({ rows: z.array(rowSchema) }).parse(request.body);
      const result = await importSales(request.appUser.storeId, rows);
      return reply.code(200).send(result);
    }
  );

  // ── Categories ─────────────────────────────────────────────────────────── //

  app.get(
    "/categories",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const categories = await listCategories(request.appUser.storeId);
      return { categories };
    }
  );

  app.post(
    "/categories",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
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
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
      const { categoryIds } = z.object({ categoryIds: z.array(z.string()) }).parse(request.body);
      await reorderCategories(request.appUser.storeId, categoryIds);
      return reply.code(204).send();
    }
  );

  app.patch(
    "/categories/bulk-move",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
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
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
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
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
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
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
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
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const body = saleCreateSchema.parse(request.body) as Parameters<typeof createSale>[1];

      try {
        const operation = await createOperation(request.appUser.storeId, "sales", body);
        return reply.code(201).send(operation);
      } catch (error) {
        const operationError = getOperationErrorStatus(error);
        if (operationError) return reply.code(operationError.statusCode).send({ error: operationError.message });
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
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = salePatchSchema.parse(request.body);
      try {
        if (await isIntegratedSale(request.appUser.storeId, params.id)) {
          if (body.status === "CANCELADA") {
            return await cancelOperationFromSale(request.appUser.storeId, params.id);
          }
          return await updateSaleOperation(request.appUser.storeId, params.id, body);
        }
        const sale = await updateSale(request.appUser.storeId, params.id, body);

        if (!sale) {
          return reply.code(404).send({ error: "Sale not found" });
        }

        return { sale };
      } catch (error) {
        const operationError = getOperationErrorStatus(error);
        if (operationError) return reply.code(operationError.statusCode).send({ error: operationError.message });
        const mapped = getSalesErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      if (await isIntegratedSale(request.appUser.storeId, params.id)) {
        try {
          await cancelOperationFromSale(request.appUser.storeId, params.id);
          return reply.code(204).send();
        } catch (error) {
          const mapped = getOperationErrorStatus(error);
          if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
          throw error;
        }
      }
      const deleted = await deleteSale(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Sale not found" });
      }

      return reply.code(204).send();
    }
  );
}
