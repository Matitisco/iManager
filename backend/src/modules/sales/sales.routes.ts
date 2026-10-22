import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess, requireMember } from "../../middleware/section-access.js";
import { loadActor } from "../audit/audit.js";
import { readReason } from "../audit/archive.js";
import { canManageSensitive, requireSensitiveActor } from "../stores/sensitive-access.js";
import { cancelOperationFromSale, createOperation, isIntegratedSale, updateSaleOperation } from "../operations/operations.service.js";
import {
  createSale,
  deleteSale,
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
  sellerMemberId: z.string().min(1).nullable().optional(),
  exchangeRate: z.number().finite().positive().optional(),
  date: z.string().min(1).max(120),
  clientId: z.string().trim().max(50).nullable().optional(),
  clientName: z.string().trim().max(120).nullable().optional(),
  productId: z.string().trim().max(50).optional(),
  deviceLabel: z.string().trim().max(120).nullable().optional(),
  amount: z.number().nonnegative(),
  amountCurrency: z.enum(["ARS", "USD"]).nullable().optional(),
  paymentMethod: paymentMethodSchema,
  status: z.string().trim().min(1).max(20),
  categoryId: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
  warrantyDays: z.number().int().min(0).max(3650).optional(),
  tradeIn: operationTradeInSchema.optional(),
});

const salePatchSchema = z
  .object({
    sellerMemberId: z.string().min(1).nullable().optional(),
    exchangeRate: z.number().finite().positive().optional(),
    clientId: z.string().trim().max(50).nullable().optional(),
    clientName: z.string().trim().max(120).nullable().optional(),
    productId: z.string().trim().max(50).nullable().optional(),
    deviceLabel: z.string().trim().max(120).nullable().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: z.string().trim().min(1).max(20).optional(),
    date: z.string().min(1).max(120).optional(),
    amount: z.number().nonnegative().optional(),
    amountCurrency: z.enum(["ARS", "USD"]).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    customFields: z.record(z.unknown()).optional().nullable(),
    warrantyDays: z.number().int().min(0).max(3650).optional(),
    tradeIn: operationTradeInSchema.nullable().optional(),
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
      requireMember(request);

      const rowSchema = z.object({
        sellerMemberId: z.string().min(1).nullable().optional(),
        exchangeRate: z.number().finite().positive().optional(),
        date:          z.string().trim().optional(),
        clientName:    z.string().trim().optional(),
        clientDni:     z.string().trim().optional(),
        clientPhone:   z.string().trim().optional(),
        device:        z.string().trim().optional(),
        productImei:   z.string().trim().optional(),
        amount:        z.string().trim().optional(),
        currency:      z.string().trim().optional(),
        paymentMethod: z.string().trim().optional(),
        tradeIn:       z.string().trim().optional(),
        seller:        z.string().trim().optional(),
        status:        z.string().trim().optional(),
      });
      const { rows } = z.object({ rows: z.array(rowSchema) }).parse(request.body);
      const result = await importSales(request.appUser.storeId, rows, await loadActor(request.appUser.userId));
      return reply.code(200).send(result);
    }
  );

  // ── Categories ─────────────────────────────────────────────────────────── //

  app.get(
    "/categories",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const categories = await listCategories(request.appUser.storeId);
      return { categories };
    }
  );

  app.post(
    "/categories",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
      const category = await createCategory(request.appUser.storeId, name);
      return reply.code(201).send({ category });
    }
  );

  app.patch(
    "/categories/reorder",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const { categoryIds } = z.object({ categoryIds: z.array(z.string()) }).parse(request.body);
      await reorderCategories(request.appUser.storeId, categoryIds);
      return reply.code(204).send();
    }
  );

  app.patch(
    "/categories/bulk-move",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const body = z.object({
        itemIds: z.array(z.string()),
        categoryId: z.string().nullable(),
      }).parse(request.body);
      
      const count = await bulkMoveCategory(request.appUser.storeId, body.itemIds, body.categoryId);
      return { count };
    }
  );

  app.patch(
    "/categories/:id",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const { name } = z.object({ name: z.string().min(1) }).parse(request.body);
      const category = await renameCategory(request.appUser.storeId, id, name);
      if (!category) return reply.code(404).send({ error: "Category not found" });
      return { category };
    }
  );

  app.delete(
    "/categories/:id",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")] },
    async (request, reply) => {
      requireMember(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const deleted = await deleteCategory(request.appUser.storeId, id, await loadActor(request.appUser.userId));
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
      requireMember(request);

      const voided = z.object({ voided: z.enum(["1", "true"]).optional() }).parse(request.query).voided;
      const sales = await listSales(request.appUser.storeId, { voided: Boolean(voided) });
      return { sales };
    }
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      requireMember(request);

      const body = saleCreateSchema.parse(request.body) as Parameters<typeof createSale>[1];

      const operation = await createOperation(request.appUser.storeId, "sales", { ...body, currency: body.amountCurrency }, await loadActor(request.appUser.userId));
      return reply.code(201).send(operation);
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = salePatchSchema.parse(request.body);
      if (body.status === "CANCELADA" && !canManageSensitive(request.appUser)) {
        return reply.code(403).send({ error: "No tenés permiso para esta acción" });
      }
      const actor = await loadActor(request.appUser.userId);
      if (body.tradeIn !== undefined || await isIntegratedSale(request.appUser.storeId, params.id)) {
        if (body.status === "CANCELADA") {
          return await cancelOperationFromSale(request.appUser.storeId, params.id, actor, readReason(request.body));
        }
        return await updateSaleOperation(request.appUser.storeId, params.id, { ...body, currency: body.amountCurrency } as Parameters<typeof updateSaleOperation>[2], actor);
      }
      const sale = await updateSale(request.appUser.storeId, params.id, body, actor, readReason(request.body));

      if (!sale) {
        return reply.code(404).send({ error: "Sale not found" });
      }

      return { sale };
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("sales")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const actor = await requireSensitiveActor(request.appUser, reply);
      if (!actor) return;
      if (await isIntegratedSale(request.appUser.storeId, params.id, { excludeCancelled: true })) {
        await cancelOperationFromSale(request.appUser.storeId, params.id, actor, readReason(request.body));
        return reply.code(204).send();
      }
      const deleted = await deleteSale(request.appUser.storeId, params.id, actor, { reason: readReason(request.body) });

      if (!deleted) {
        return reply.code(404).send({ error: "Sale not found" });
      }

      return reply.code(204).send();
    }
  );
}
