import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import type { InventoryItemInput, ImportRow } from "./inventory.service.js";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryErrorStatus,
  importInventoryItems,
  listInventory,
  updateInventoryItem,
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  bulkMoveCategory,
} from "./inventory.service.js";

const inventoryItemSchema = z.object({
  imei: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  capacity: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(50),
  condition: z.enum(["NUEVO", "USADO", "PRE-OWNED"]),
  grade: z.enum(["A+", "A", "B", "C", "N/A"]),
  batteryHealth: z.string().trim().max(50),
  cost: z.number().nonnegative(),
  price: z.number().nonnegative(),
  status: z.enum(["DISPONIBLE", "VENDIDO", "EN_REVISION"]),
  categoryId: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
});

const inventoryPatchSchema = inventoryItemSchema
  .extend({
    capacity: z.string().trim().max(50),
    color: z.string().trim().max(50),
  })
  .partial();

export async function inventoryRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const inventory = await listInventory(request.appUser.storeId);
      return { inventory };
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

      const body = inventoryItemSchema.parse(request.body) as InventoryItemInput;
      try {
        const inventoryItem = await createInventoryItem(request.appUser.storeId, body);

        return reply.code(201).send({ inventoryItem });
      } catch (error) {
        const mapped = getInventoryErrorStatus(error);
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
      const body = inventoryPatchSchema.parse(request.body);
      try {
        const inventoryItem = await updateInventoryItem(
          request.appUser.storeId,
          params.id,
          body
        );

        if (!inventoryItem) {
          return reply.code(404).send({ error: "Inventory item not found" });
        }

        return { inventoryItem };
      } catch (error) {
        const mapped = getInventoryErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
    }
  );

  app.post(
    "/import",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const bodySchema = z.object({
        rows: z
          .array(
            z.object({
              imei: z.string(),
              model: z.string(),
              capacity: z.string().optional(),
              color: z.string().optional(),
              condition: z.string().optional(),
              grade: z.string().optional(),
              batteryHealth: z.coerce.string().optional(),
              cost: z.coerce.number().optional(),
              price: z.coerce.number(),
              status: z.string().optional(),
              customFields: z.record(z.unknown()).optional(),
            })
          )
          .max(2000),
      });

      const { rows } = bodySchema.parse(request.body) as { rows: ImportRow[] };
      const result = await importInventoryItems(request.appUser.storeId, rows);
      return reply.code(200).send(result);
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
      const deleted = await deleteInventoryItem(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      return reply.code(204).send();
    }
  );

  // ─── Categories ─────────────────────────────────────────────────────────────

  app.get("/categories", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const categories = await listCategories(request.appUser.storeId);
    return { categories };
  });

  app.post("/categories", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(request.body);
    try {
      const category = await createCategory(request.appUser.storeId, name);
      return reply.code(201).send({ category });
    } catch (error) {
      const mapped = getInventoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });

  app.patch("/categories/:id", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(request.body);
    try {
      const category = await renameCategory(request.appUser.storeId, id, name);
      if (!category) return reply.code(404).send({ error: "Category not found" });
      return { category };
    } catch (error) {
      const mapped = getInventoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });

  app.delete("/categories/:id", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await deleteCategory(request.appUser.storeId, id);
    if (!deleted) return reply.code(404).send({ error: "Category not found" });
    return reply.code(204).send();
  });

  app.post("/bulk-move", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const { ids, categoryId } = z.object({
      ids: z.array(z.string()).min(1).max(500),
      categoryId: z.string().nullable(),
    }).parse(request.body);
    try {
      const count = await bulkMoveCategory(request.appUser.storeId, ids, categoryId);
      return { count };
    } catch (error) {
      const mapped = getInventoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });
}
