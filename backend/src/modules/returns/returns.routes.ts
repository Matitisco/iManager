import { readReason } from "../audit/archive.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { loadActor } from "../audit/audit.js";
import { requireSensitiveActor } from "../stores/sensitive-access.js";
import {
  advanceRma,
  archiveReturnCase,
  createReturnCase,
  listCreditNotes,
  listReturnCases,
  resolveReturnCase,
  restoreReturnCase,
  updateReturnDiagnosis,
} from "./returns.service.js";
import { DESTINATIONS, RESOLUTIONS, RMA_STATUSES, SETTLEMENTS } from "./returns-math.js";

const openedOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

export async function returnRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser, requireSectionAccess("sales")];

  app.get("/credit-notes", { preHandler: guard }, async (request) => {
    requireMember(request);
    const query = z.object({ clientId: z.string().min(1).optional() }).parse(request.query);
    return { creditNotes: await listCreditNotes(request.appUser.storeId, query.clientId) };
  });

  app.get("/", { preHandler: guard }, async (request) => {
    requireMember(request);
    const query = z.object({ archived: z.enum(["1", "true"]).optional() }).parse(request.query);
    return { returns: await listReturnCases(request.appUser.storeId, Boolean(query.archived)) };
  });

  app.post("/", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const body = z.object({
      saleId: z.string().min(1),
      reason: z.string().trim().min(1, "Completá el motivo.").max(500, "El motivo es demasiado largo."),
      openedOn,
      diagnosis: z.string().trim().max(2000, "El diagnóstico es demasiado largo.").nullable().optional(),
      imei: z.string().trim().max(100).nullable().optional(),
    }).parse(request.body) as {
      saleId: string;
      reason: string;
      openedOn: string;
      diagnosis?: string | null;
      imei?: string | null;
    };
    const actor = { ...(await loadActor(request.appUser.userId)), role: request.appUser.role };
    const claim = await createReturnCase(request.appUser.storeId, body, actor);
    return reply.code(201).send({ return: claim });
  });

  app.patch("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      diagnosis: z.string().trim().min(1, "Completá el diagnóstico.").max(2000, "El diagnóstico es demasiado largo."),
    }).parse(request.body);
    const actor = { ...(await loadActor(request.appUser.userId)), role: request.appUser.role };
    const claim = await updateReturnDiagnosis(request.appUser.storeId, id, body.diagnosis, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: claim };
  });

  app.post("/:id/resolve", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      resolution: z.enum(RESOLUTIONS),
      settlement: z.enum(SETTLEMENTS),
      amount: z.number().min(0).max(100_000_000),
      destination: z.enum(DESTINATIONS),
      stockStatus: z.string().trim().max(20).nullable().optional(),
    }).parse(request.body) as {
      resolution: (typeof RESOLUTIONS)[number];
      settlement: (typeof SETTLEMENTS)[number];
      amount: number;
      destination: (typeof DESTINATIONS)[number];
      stockStatus?: string | null;
    };
    const claim = await resolveReturnCase(request.appUser.storeId, id, body, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: claim };
  });

  app.post("/:id/rma", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      status: z.enum(RMA_STATUSES),
      stockStatus: z.string().trim().max(20).nullable().optional(),
    }).parse(request.body) as {
      status: (typeof RMA_STATUSES)[number];
      stockStatus?: string | null;
    };
    const claim = await advanceRma(request.appUser.storeId, id, body, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: claim };
  });

  app.delete("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const archived = await archiveReturnCase(request.appUser.storeId, id, actor, readReason(request.body));
    if (!archived) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return reply.code(204).send();
  });

  app.post("/:id/restore", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const claim = await restoreReturnCase(request.appUser.storeId, id, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: claim };
  });
}
