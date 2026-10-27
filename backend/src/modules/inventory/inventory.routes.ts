import { definitionSchema } from '../custom-fields/custom-fields.service.js';
import { validBatteryHealth, BATTERY_HEALTH_MESSAGE } from "../../lib/battery-health.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireSectionAccess, requireMember } from "../../middleware/section-access.js";
import { loadActor } from "../audit/audit.js";
import { readReason } from "../audit/archive.js";
import { canSeeFinancials } from "../stores/sections.js";
import { canManageSensitive, requireSensitiveActor } from "../stores/sensitive-access.js";
import { zodOptionalImei } from "../../lib/imei.js";
import { purchaseNameFields } from "../suppliers/purchase-name.js";
import type { InventoryItemInput, ListInventoryParams } from "./inventory.service.js";
import {
  createInventoryItem,
  createInventoryBatch,
  deleteInventoryItem,
  importInventoryItems,
  listInventory,
  restoreInventoryItem,
  listInventoryPaged,
  getInventoryFilteredIds,
  getInventoryItem,
  updateInventoryItem,
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  bulkMoveCategory,
  reorderCategories,
} from "./inventory.service.js";

const inventoryItemSchema = z.object({
  imei: zodOptionalImei().optional(),
  model: z.string().trim().min(1).max(100),
  capacity: z.string().trim().max(50),
  color: z.string().trim().max(50),
  condition: z.string().trim().max(20),
  grade: z.string().trim().max(20),
  batteryHealth: z.string().trim().max(50).refine(validBatteryHealth, BATTERY_HEALTH_MESSAGE),
  cost: z.number().nonnegative(),
  price: z.number().positive().nullable(),
  status: z.string().trim().max(20),
  categoryId: z.string().nullable().optional(),
  entryDate: z.string().max(50).nullable().optional(),
  batteryNote: z.string().max(2000).nullable().optional(),
  customFields: z.record(z.unknown()).optional().nullable(),
  currency: z.enum(["ARS", "USD"]).nullable().optional(),
  supplierId: z.string().trim().min(1).nullable().optional(),
});

const inventoryCreateSchema = inventoryItemSchema.extend({
  ...purchaseNameFields,
  restockRetired: z.boolean().optional(),
});

const inventoryPatchSchema = inventoryItemSchema
  .extend({
    capacity: z.string().trim().max(50),
    color: z.string().trim().max(50),
    price: z.number().nonnegative().nullable(),
  })
  .partial();

export async function inventoryRoutes(app: FastifyInstance) {
  const pagedQuerySchema = z.object({
    skip: z.coerce.number().int().nonnegative().optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
    supplierId: z.string().trim().min(1).optional(),
    categoryId: z.string().optional().transform(v =>
      v === undefined ? undefined : v === 'null' ? null : v === 'all' ? undefined : v
    ),
    sortKey: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    condition: z.string().optional(),
    status: z.string().optional(),
    capacity: z.string().optional(),
    model: z.string().optional(),
    grade: z.string().optional(),
    battery: z.string().optional(),
    archived: z.enum(["1", "true"]).optional(),
  });

  app.get(
    "/",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);

      const query = pagedQuerySchema.parse(request.query);

      if (query.archived) {
        const inventory = await listInventory(request.appUser.storeId, { archived: true, supplierId: query.supplierId });
        return { inventory };
      }

      if (query.skip !== undefined || query.take !== undefined) {
        const params: ListInventoryParams = {
          skip: query.skip ?? 0,
          take: query.take ?? 30,
          search: query.search,
          supplierId: query.supplierId,
          categoryId: query.categoryId,
          sortKey: query.sortKey,
          sortDir: query.sortDir,
          condition: query.condition,
          status: query.status,
          capacity: query.capacity,
          model: query.model,
          grade: query.grade,
          battery: query.battery,
        };
        const { items, total } = await listInventoryPaged(request.appUser.storeId, params);
        return { items, total };
      }

      const inventory = await listInventory(request.appUser.storeId, { supplierId: query.supplierId });
      return { inventory };
    }
  );

  app.get(
    "/ids",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);

      const query = pagedQuerySchema.parse(request.query);
      const ids = await getInventoryFilteredIds(request.appUser.storeId, {
        search: query.search,
        supplierId: query.supplierId,
        categoryId: query.categoryId,
        condition: query.condition,
        status: query.status,
        capacity: query.capacity,
        model: query.model,
        grade: query.grade,
        battery: query.battery,
      });
      return { ids };
    }
  );

  app.get("/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const inventoryItem = await getInventoryItem(request.appUser.storeId, id);
    if (!inventoryItem) return reply.code(404).send({ error: "No encontramos ese equipo" });
    return { inventoryItem };
  });

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")],
    },
    async (request, reply) => {
      requireMember(request);

      const body = inventoryCreateSchema.parse(request.body);
      const { restockRetired, ...item } = body;
      const inventoryItem = await createInventoryItem(
        request.appUser.storeId,
        item as InventoryItemInput,
        await loadActor(request.appUser.userId),
        restockRetired ? { allowRetiredImei: true, source: "app" } : undefined,
      );

      return reply.code(201).send({ inventoryItem });
    }
  );

  app.post(
    "/batch",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);
      const body = z.object({
        items: z.array(inventoryItemSchema).min(1).max(200),
      }).parse(request.body);
      const seeCosts = canSeeFinancials(request.appUser);
      const items = body.items.map((item) => ({
        ...item,
        cost: seeCosts ? item.cost : 0,
      })) as InventoryItemInput[];
      const result = await createInventoryBatch(request.appUser.storeId, items, await loadActor(request.appUser.userId));
      return reply.code(201).send(result);
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = inventoryPatchSchema.parse(request.body);
      if (!canSeeFinancials(request.appUser)) delete body.cost;
      const inventoryItem = await updateInventoryItem(
        request.appUser.storeId,
        params.id,
        body,
        {
          actor: await loadActor(request.appUser.userId),
          enforcePriceCost: !canManageSensitive(request.appUser),
        },
      );

      if (!inventoryItem) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      return { inventoryItem };
    }
  );

  app.post(
    "/import",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")],
    },
    async (request, reply) => {
      requireMember(request);

      const bodySchema = z.object({
        ...purchaseNameFields,
        rows: z
          .array(
            z.object({
              sourceRow: z.number().int().positive().optional(),
              entryDate: z.string().max(50).nullable().optional(),
              batteryNote: z.string().max(2000).nullable().optional(),
              supplierName: z.string().trim().max(120).optional(),
              imei: z.string(),
              model: z.string(),
              capacity: z.string().optional(),
              color: z.string().optional(),
              condition: z.string().optional(),
              grade: z.string().optional(),
              batteryHealth: z.coerce.string().optional(),
              cost: z.coerce.number().optional(),
              price: z.coerce.number().finite().nonnegative().nullable().optional(),
              currency: z.enum(["ARS", "USD"]).optional(),
              status: z.string().optional(),
              purchasedAt: z.string().trim().optional(),
              purchaseName: z.string().trim().max(120).optional(),
              customFields: z.record(z.unknown()).optional(),
            })
          )
          .max(2000),
        definitions: z.array(definitionSchema).max(40).optional(),
        supplierId: z.string().trim().min(1).optional(),
      });

      const { rows, supplierId, purchaseName, name, definitions } = bodySchema.parse(request.body);
      const result = await importInventoryItems(request.appUser.storeId, rows, {
        actor: await loadActor(request.appUser.userId),
        definitions,
        lockPrice: !canManageSensitive(request.appUser),
        supplierId,
        purchaseName,
        name,
      });
      return reply.code(200).send(result);
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")],
    },
    async (request, reply) => {
      requireMember(request);

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const actor = await requireSensitiveActor(request.appUser, reply);
      if (!actor) return;
      const deleted = await deleteInventoryItem(request.appUser.storeId, params.id, actor, { reason: readReason(request.body) });

      if (!deleted) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      return reply.code(204).send();
    }
  );

  app.post(
    "/:id/restore",
    { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const actor = await requireSensitiveActor(request.appUser, reply);
      if (!actor) return;
      const item = await restoreInventoryItem(request.appUser.storeId, params.id, actor);
      if (!item) return reply.code(404).send({ error: "Inventory item not found" });
      return { inventoryItem: item };
    },
  );

  // ─── Categories ─────────────────────────────────────────────────────────────

  app.get("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const categories = await listCategories(request.appUser.storeId);
    return { categories };
  });

  app.post("/categories", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(request.body);
    const category = await createCategory(request.appUser.storeId, name);
    return reply.code(201).send({ category });
  });

  app.patch("/categories/reorder", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { ids } = z.object({ ids: z.array(z.string()).min(1).max(200) }).parse(request.body);
    await reorderCategories(request.appUser.storeId, ids);
    return reply.code(204).send();
  });

  app.patch("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(request.body);
    const category = await renameCategory(request.appUser.storeId, id, name);
    if (!category) return reply.code(404).send({ error: "Category not found" });
    return { category };
  });

  app.delete("/categories/:id", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const deleted = await deleteCategory(request.appUser.storeId, id, await loadActor(request.appUser.userId));
    if (!deleted) return reply.code(404).send({ error: "Category not found" });
    return reply.code(204).send();
  });

  app.post("/bulk-move", { preHandler: [authenticate, resolveAppUser, requireSectionAccess("inventory")] }, async (request, reply) => {
    requireMember(request);
    const { ids, categoryId } = z.object({
      ids: z.array(z.string()).min(1).max(500),
      categoryId: z.string().nullable(),
    }).parse(request.body);
    const count = await bulkMoveCategory(request.appUser.storeId, ids, categoryId);
    return { count };
  });
}
