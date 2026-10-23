import { readReason } from "../audit/archive.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { loadActor } from "../audit/audit.js";
import { canSeeFinancials } from "../stores/sections.js";
import { archiveSupplier, createSupplier, getSupplier, getSupplierPurchase, listSupplierPurchases, listSuppliers, restoreSupplier, updateSupplier, type SupplierInput } from "./suppliers.service.js";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Completá el nombre.").max(120, "El nombre es demasiado largo."),
  phone: z.string().trim().max(50, "El teléfono es demasiado largo.").nullable().optional(),
  email: z.string().trim().max(255, "El email es demasiado largo.").nullable().optional(),
  notes: z.string().trim().max(2000, "Las notas son demasiado largas.").nullable().optional(),
});

export async function supplierRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser, requireSectionAccess("inventory")];

  app.get("/", { preHandler: guard }, async (request) => {
    requireMember(request);
    const query = z.object({ archived: z.enum(["1", "true"]).optional() }).parse(request.query);
    const suppliers = await listSuppliers(request.appUser.storeId, Boolean(query.archived));
    return { suppliers };
  });

  app.get("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = z.object({ includeItems: z.enum(["0", "1", "false", "true"]).optional() }).parse(request.query);
    const supplier = await getSupplier(request.appUser.storeId, id, canSeeFinancials(request.appUser), query.includeItems !== "0" && query.includeItems !== "false");
    if (!supplier) return reply.code(404).send({ error: "No encontramos ese proveedor" });
    return { supplier };
  });

  app.get("/:id/purchases", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const purchases = await listSupplierPurchases(request.appUser.storeId, id, canSeeFinancials(request.appUser));
    if (!purchases) return reply.code(404).send({ error: "No encontramos ese proveedor" });
    return { purchases };
  });

  app.get("/:id/purchases/:purchaseId", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id, purchaseId } = z.object({ id: z.string().min(1), purchaseId: z.string().min(1) }).parse(request.params);
    const purchase = await getSupplierPurchase(request.appUser.storeId, id, purchaseId, canSeeFinancials(request.appUser));
    if (!purchase) return reply.code(404).send({ error: "No encontramos esa compra" });
    return { purchase };
  });

  app.post("/", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const body = supplierSchema.parse(request.body) as SupplierInput;
    const supplier = await createSupplier(request.appUser.storeId, body, await loadActor(request.appUser.userId));
    return reply.code(201).send({ supplier });
  });

  app.patch("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = supplierSchema.parse(request.body) as SupplierInput;
    const supplier = await updateSupplier(request.appUser.storeId, id, body, await loadActor(request.appUser.userId));
    if (!supplier) return reply.code(404).send({ error: "No encontramos ese proveedor" });
    return { supplier };
  });

  app.delete("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const archived = await archiveSupplier(request.appUser.storeId, id, await loadActor(request.appUser.userId), readReason(request.body));
    if (!archived) return reply.code(404).send({ error: "No encontramos ese proveedor" });
    return reply.code(204).send();
  });

  app.post("/:id/restore", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const supplier = await restoreSupplier(request.appUser.storeId, id, await loadActor(request.appUser.userId));
    if (!supplier) return reply.code(404).send({ error: "No encontramos ese proveedor" });
    return { supplier };
  });
}
