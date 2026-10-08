import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess } from "../../middleware/section-access.js";
import { cancelTradeOperation, createOperation, getOperationErrorStatus, isIntegratedTradeIn, updateTradeFromLegacy } from "../operations/operations.service.js";
import type { TradeInInput } from "./trade-ins.service.js";
import {
  createTradeIn,
  deleteTradeIn,
  getTradeInsErrorStatus,
  importTradeIns,
  listTradeIns,
  updateTradeIn,
  listTradeInCategories,
  createTradeInCategory,
  renameTradeInCategory,
  deleteTradeInCategory,
  reorderTradeInCategories,
  bulkMoveTradeInCategory,
} from "./trade-ins.service.js";

const tradeInStatusSchema = z.string().trim().min(1).max(30);

const tradeInFieldsSchema = z.object({
  date: z.string().trim().max(120).optional().nullable(),
  clientId: z.string().trim().optional().nullable(),
  clientName: z.string().trim().max(120).optional().nullable(),
  categoryId: z.string().nullable().optional(),
  deviceReceived: z.string().min(1).max(120),
  deviceReceivedImei: z.string().trim().max(100).optional().nullable(),
  takeValue: z.number().optional(),
  deviceGiven: z.string().min(1).max(120),
  differencePaid: z.number().optional(),
  status: tradeInStatusSchema.optional(),
  batteryHealth: z.string().trim().max(50).optional().nullable(),
  grade: z.string().trim().max(20).optional().nullable(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

const tradeInCreateSchema = tradeInFieldsSchema.refine(
  (value) => value.takeValue === undefined || value.takeValue >= 0,
  { message: "El valor recibido no puede ser negativo", path: ["takeValue"] },
);

const tradeInPatchSchema = tradeInFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function tradeInsRoutes(app: FastifyInstance) {
  app.post(
    "/import",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const rowSchema = z.object({
        date: z.string().trim().optional(),
        clientName: z.string().trim().optional(),
        deviceReceived: z.string().trim().optional(),
        deviceReceivedImei: z.string().trim().optional(),
        takeValue: z.string().trim().optional(),
        deviceGiven: z.string().trim().optional(),
        differencePaid: z.string().trim().optional(),
        status: z.string().trim().optional(),
        batteryHealth: z.string().trim().optional(),
        grade: z.string().trim().optional(),
      });

      const { rows } = z.object({ rows: z.array(rowSchema) }).parse(request.body);
      const result = await importTradeIns(request.appUser.storeId, rows);
      return reply.code(200).send(result);
    }
  );

  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const tradeIns = await listTradeIns(request.appUser.storeId);
      return { tradeIns };
    }
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const body = tradeInCreateSchema.parse(request.body) as TradeInInput;

      try {
        const payload = request.body as TradeInInput & { draft?: boolean };
        const takeValue = body.takeValue ?? 0;
        const operation = await createOperation(request.appUser.storeId, "tradeins", {
          date: body.date ?? undefined,
          clientId: body.clientId,
          clientName: body.clientName,
          categoryId: body.categoryId,
          deviceLabel: body.deviceGiven,
          amount: takeValue + (body.differencePaid ?? 0),
          draft: payload.draft !== false,
          tradeIn: {
            deviceReceived: body.deviceReceived,
            deviceReceivedImei: body.deviceReceivedImei,
            takeValue,
            status: body.status,
            batteryHealth: body.batteryHealth,
            grade: body.grade,
            customFields: body.customFields,
          },
        }, request.appUser.userId);
        return reply.code(201).send({ ...operation, tradeIn: operation.tradeIn });
      } catch (error) {
        const operationError = getOperationErrorStatus(error);
        if (operationError) return reply.code(operationError.statusCode).send({ error: operationError.message });
        const mapped = getTradeInsErrorStatus(error);
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
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = tradeInPatchSchema.parse(request.body);

      try {
        if (await isIntegratedTradeIn(request.appUser.storeId, params.id)) {
          const operation = await updateTradeFromLegacy(request.appUser.storeId, params.id, body);
          return { tradeIn: operation.tradeIn };
        }
        const tradeIn = await updateTradeIn(request.appUser.storeId, params.id, body);

        if (!tradeIn) {
          return reply.code(404).send({ error: "Trade-in not found" });
        }

        return { tradeIn };
      } catch (error) {
        const operationError = getOperationErrorStatus(error);
        if (operationError) return reply.code(operationError.statusCode).send({ error: operationError.message });
        const mapped = getTradeInsErrorStatus(error);
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
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      if (await isIntegratedTradeIn(request.appUser.storeId, params.id)) {
        try {
          await cancelTradeOperation(request.appUser.storeId, params.id);
          return reply.code(204).send();
        } catch (error) {
          const operationError = getOperationErrorStatus(error);
          if (operationError) return reply.code(operationError.statusCode).send({ error: operationError.message });
          throw error;
        }
      }
      const deleted = await deleteTradeIn(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Trade-in not found" });
      }

      return reply.code(204).send();
    }
  );

  // ── Categories ────────────────────────────────────────────────────────────

  app.get("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const categories = await listTradeInCategories(request.appUser.storeId);
    return { categories };
  });

  app.post("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(request.body);
    const category = await createTradeInCategory(request.appUser.storeId, name);
    return reply.code(201).send({ category });
  });

  app.patch("/categories/reorder", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { categoryIds } = z.object({ categoryIds: z.array(z.string()) }).parse(request.body);
    await reorderTradeInCategories(request.appUser.storeId, categoryIds);
    return reply.code(204).send();
  });

  app.patch("/categories/bulk-move", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const body = z.object({ itemIds: z.array(z.string()), categoryId: z.string().nullable() }).parse(request.body);
    await bulkMoveTradeInCategory(request.appUser.storeId, body.itemIds, body.categoryId);
    return reply.code(204).send();
  });

  app.patch("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(request.body);
    const category = await renameTradeInCategory(request.appUser.storeId, id, name);
    if (!category) return reply.code(404).send({ error: "Category not found" });
    return { category };
  });

  app.delete("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("tradeins")] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await deleteTradeInCategory(request.appUser.storeId, id);
    if (!deleted) return reply.code(404).send({ error: "Category not found" });
    return reply.code(204).send();
  });
}
