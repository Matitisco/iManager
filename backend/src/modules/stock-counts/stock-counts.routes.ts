import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import { actorFor } from "../audit/audit.js";
import { canManageStockCount } from "./access.js";
import {
  blindStockCount,
  closeStockCount,
  currentStockCount,
  listStockCounts,
  previewStockCount,
  resolveStockCount,
  scanStockCount,
  startStockCount,
  closedStockCount,
} from "./stock-counts.service.js";

const idParams = z.object({ id: z.string().min(1) });

export async function stockCountRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser, requireSectionAccess("inventory")];

  app.get("/", { preHandler: guard }, async (request) => {
    requireMember(request);
    return { counts: await listStockCounts(request.appUser.storeId) };
  });

  app.get("/preview", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!canManageStockCount(request.appUser)) {
      return reply.code(403).send({ error: "Solo el propietario o un socio puede iniciar el control" });
    }
    return previewStockCount(request.appUser.storeId);
  });

  app.get("/current", { preHandler: guard }, async (request) => {
    requireMember(request);
    return { count: await currentStockCount(request.appUser.storeId, request.appUser.userId) };
  });

  app.post("/", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const count = await startStockCount(request.appUser.storeId, request.appUser, await actorFor(request.appUser));
    return reply.code(201).send({ count });
  });

  app.get("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = idParams.parse(request.params);
    const open = await blindStockCount(request.appUser.storeId, id, request.appUser.userId);
    if (open) return { count: open };
    const closed = await closedStockCount(request.appUser.storeId, id);
    if (!closed) return reply.code(404).send({ error: "No encontramos ese control" });
    return { count: closed };
  });

  app.post("/:id/scans", { preHandler: guard }, async (request) => {
    requireMember(request);
    const { id } = idParams.parse(request.params);
    const body = z.object({ imei: z.string().trim().min(1).max(40) }).parse(request.body);
    const count = await scanStockCount(request.appUser.storeId, id, request.appUser.userId, await actorFor(request.appUser), body.imei);
    return { count };
  });

  app.post("/:id/close", { preHandler: guard }, async (request) => {
    requireMember(request);
    const { id } = idParams.parse(request.params);
    const count = await closeStockCount(request.appUser.storeId, id, request.appUser, await actorFor(request.appUser));
    return { count };
  });

  app.post("/:id/resolve", { preHandler: guard }, async (request) => {
    requireMember(request);
    const { id } = idParams.parse(request.params);
    const body = z.object({
      mode: z.enum(["ADJUST", "RECORD"]),
      missingIds: z.array(z.string()).max(500).optional(),
      surplusImeis: z.array(z.string()).max(500).optional(),
    }).parse(request.body);
    const count = await resolveStockCount(request.appUser.storeId, id, request.appUser, await actorFor(request.appUser), {
      mode: body.mode,
      missingIds: body.missingIds ?? [],
      surplusImeis: body.surplusImeis ?? [],
    });
    return { count };
  });
}
