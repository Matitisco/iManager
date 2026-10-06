import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { getCatalogErrorStatus, isCatalogKind, listCatalogs, saveCatalog } from "./catalogs.service.js";

const saveSchema = z.object({
  options: z.array(z.object({
    value: z.string().max(30).optional(),
    label: z.string().trim().min(1).max(20),
    color: z.string().trim().max(9).nullable().optional(),
  })).min(1),
  deletions: z.array(z.object({
    value: z.string().min(1).max(30),
    reassignTo: z.string().min(1).max(30),
  })).default([]),
});

export async function catalogsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    const data = await listCatalogs(request.appUser.storeId);
    return reply.send(data);
  });

  app.put("/:kind", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    if (!request.appUser) return reply.code(403).send({ error: "Store membership required" });
    if (request.appUser.role === "STAFF") return reply.code(403).send({ error: "No podés editar los catálogos" });
    const kind = (request.params as { kind: string }).kind;
    if (!isCatalogKind(kind)) return reply.code(400).send({ error: "Catálogo desconocido" });
    try {
      const body = saveSchema.parse(request.body);
      const options = body.options.flatMap((option) => (
        option.label ? [{ value: option.value, label: option.label, color: option.color ?? null }] : []
      ));
      const deletions = body.deletions.flatMap((item) => (
        item.value && item.reassignTo ? [{ value: item.value, reassignTo: item.reassignTo }] : []
      ));
      await saveCatalog(request.appUser.storeId, kind, options, deletions);
      const data = await listCatalogs(request.appUser.storeId);
      return reply.send(data);
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: "Revisá los nombres" });
      const status = getCatalogErrorStatus(error);
      const message = error instanceof Error ? error.message : "No se pudo guardar";
      return reply.code(status).send({ error: message });
    }
  });
}
