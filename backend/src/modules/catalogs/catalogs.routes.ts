import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { getCatalogErrorStatus, isCatalogKind, listCatalogs, saveCatalog } from "./catalogs.service.js";
import { canAccessSection, type SectionId } from "../stores/sections.js";
import type { CatalogKind } from "@prisma/client";
import { requireMember } from "../../middleware/section-access.js";

const KIND_SECTION: Record<CatalogKind, SectionId> = {
  INVENTORY_STATUS: "inventory", INVENTORY_CAPACITY: "inventory", INVENTORY_CONDITION: "inventory",
  SALE_STATUS: "sales", TRADE_IN_STATUS: "tradeins", CLIENT_TAG: "clients", REPAIR_STATUS: "service",
};
function filterCatalogs(data: Awaited<ReturnType<typeof listCatalogs>>, member: { role: string; sections?: unknown }) {
  return { ...data,
    options: data.options.filter(option => canAccessSection(KIND_SECTION[option.kind], member)),
    meta: Object.fromEntries(Object.entries(data.meta).filter(([kind]) => canAccessSection(KIND_SECTION[kind as CatalogKind], member))),
  };
}

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
    requireMember(request);
    const data = await listCatalogs(request.appUser.storeId);
    return reply.send(filterCatalogs(data, request.appUser));
  });

  app.put("/:kind", { preHandler: [authenticate, resolveAppUser] }, async (request, reply) => {
    requireMember(request);
    if (request.appUser.role === "STAFF") return reply.code(403).send({ error: "No podés editar los catálogos" });
    const kind = (request.params as { kind: string }).kind;
    if (!isCatalogKind(kind)) return reply.code(400).send({ error: "Catálogo desconocido" });
    if (!canAccessSection(KIND_SECTION[kind], request.appUser)) return reply.code(403).send({ error: "No tenés acceso a esa sección" });
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
      return reply.send(filterCatalogs(data, request.appUser));
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: "Revisá los nombres" });
      const status = getCatalogErrorStatus(error);
      const message = error instanceof Error ? error.message : "No se pudo guardar";
      return reply.code(status).send({ error: message });
    }
  });
}
