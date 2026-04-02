import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import type { InventoryItemInput } from "./inventory.service.js";
import {
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from "./inventory.service.js";

const inventoryItemSchema = z.object({
  imei: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  capacity: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(50),
  condition: z.enum(["NUEVO", "USADO", "PRE-OWNED"]),
  grade: z.enum(["A+", "A", "B", "C", "N/A"]),
  batteryHealth: z.number().int().min(0).max(100),
  cost: z.number().nonnegative(),
  price: z.number().nonnegative(),
  status: z.enum(["DISPONIBLE", "VENDIDO", "EN_REVISION"]),
  customFields: z.record(z.unknown()).optional().nullable(),
});

const inventoryPatchSchema = inventoryItemSchema.partial();

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
      const inventoryItem = await createInventoryItem(request.appUser.storeId, body);

      return reply.code(201).send({ inventoryItem });
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
      const inventoryItem = await updateInventoryItem(
        request.appUser.storeId,
        params.id,
        body
      );

      if (!inventoryItem) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      return { inventoryItem };
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
}
