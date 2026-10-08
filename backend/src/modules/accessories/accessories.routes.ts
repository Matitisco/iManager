import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import {
  createAccessory,
  deleteAccessory,
  getAccessory,
  getAccessoryErrorStatus,
  listAccessories,
  updateAccessory,
  type AccessoryInput,
} from "./accessories.service.js";

const accessorySchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(40),
  compatibleWith: z.string().trim().max(160).nullable().optional(),
  sku: z.string().trim().max(40).nullable().optional(),
  cost: z.number().nonnegative(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().max(100000),
  minStock: z.number().int().nonnegative().max(100000),
});

const patchSchema = accessorySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

function canRead(member: { role: string; sections?: unknown }) {
  return canAccessSection("inventory", member) || canAccessSection("sales", member);
}

export async function accessoriesRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];

  app.get("/", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (!canRead(request.appUser)) return reply.code(403).send({ error: "No tenés acceso a Inventario" });
    const accessories = await listAccessories(request.appUser.storeId);
    return { accessories };
  });

  app.get("/:id", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (!canRead(request.appUser)) return reply.code(403).send({ error: "No tenés acceso a Inventario" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const accessory = await getAccessory(request.appUser.storeId, id);
    if (!accessory) return reply.code(404).send({ error: "Accesorio no encontrado" });
    return { accessory };
  });

  app.post("/", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (!canAccessSection("inventory", request.appUser)) return reply.code(403).send({ error: "No tenés acceso a Inventario" });
    const body = accessorySchema.parse(request.body) as AccessoryInput;
    try {
      const result = await createAccessory(request.appUser.storeId, body);
      return reply.code(201).send(result);
    } catch (error) {
      const mapped = getAccessoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });

  app.patch("/:id", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (!canAccessSection("inventory", request.appUser)) return reply.code(403).send({ error: "No tenés acceso a Inventario" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = patchSchema.parse(request.body);
    try {
      const result = await updateAccessory(request.appUser.storeId, id, body);
      if (!result) return reply.code(404).send({ error: "Accesorio no encontrado" });
      return result;
    } catch (error) {
      const mapped = getAccessoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });

  app.delete("/:id", { preHandler }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (!canAccessSection("inventory", request.appUser)) return reply.code(403).send({ error: "No tenés acceso a Inventario" });
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    try {
      const deleted = await deleteAccessory(request.appUser.storeId, id);
      if (!deleted) return reply.code(404).send({ error: "Accesorio no encontrado" });
      return reply.code(204).send();
    } catch (error) {
      const mapped = getAccessoryErrorStatus(error);
      if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
      throw error;
    }
  });
}
