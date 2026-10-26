import { readReason } from "../audit/archive.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canSeeFinancials } from "../stores/sections.js";
import type { AppUserContext } from "../../types/auth.js";
import { loadActor } from "../audit/audit.js";
import { requireSensitiveActor } from "../stores/sensitive-access.js";
import {
  type ReturnCaseView,
  advanceRma,
  archiveReturnCase,
  createReturnCase,
  listCreditNotes,
  listReturnCases,
  resolveReturnCase,
  restoreReturnCase,
  updateReturnCase,
} from "./returns.service.js";
import { DESTINATIONS, RESOLUTIONS, RMA_STATUSES, SETTLEMENTS } from "./returns-math.js";
import { returnPatternAnalysis } from "./patterns.service.js";

const openedOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.").refine(value => {
  const date = new Date(`${value}T15:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "La fecha no es válida.");
const note = z.string().trim().max(280, "La nota es demasiado larga.").nullable().optional();

function visibleReturn(claim: ReturnCaseView, member: AppUserContext) {
  if (canSeeFinancials(member)) return claim;
  const { itemCost: _cost, itemCurrency: _currency, ...visible } = claim;
  return visible;
}

export async function returnRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser, requireSectionAccess("sales")];

  app.get("/patterns", { preHandler: guard }, async (request) => {
    requireMember(request);
    const { groupBy } = z.object({ groupBy: z.enum(["supplier", "purchase", "model"]).default("supplier") }).parse(request.query);
    return returnPatternAnalysis(request.appUser.storeId, groupBy);
  });

  app.get("/credit-notes", { preHandler: guard }, async (request) => {
    requireMember(request);
    const query = z.object({ clientId: z.string().min(1).optional() }).parse(request.query);
    return { creditNotes: await listCreditNotes(request.appUser.storeId, query.clientId) };
  });

  app.get("/", { preHandler: guard }, async (request) => {
    requireMember(request);
    const query = z.object({ archived: z.enum(["1", "true"]).optional() }).parse(request.query);
    const claims = await listReturnCases(request.appUser.storeId, Boolean(query.archived));
    return { returns: claims.map(claim => visibleReturn(claim, request.appUser)) };
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
    return reply.code(201).send({ return: visibleReturn(claim, request.appUser) });
  });

  app.patch("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      reason: z.string().trim().min(1, "Completá el motivo.").max(500).optional(),
      openedOn: openedOn.optional(),
      diagnosis: z.string().trim().max(2000).nullable().optional(),
      status: z.enum(["ABIERTO", "EN_DIAGNOSTICO"]).optional(),
      note,
    }).strict().refine(value => Object.keys(value).length > 0, "Completá el cambio.").parse(request.body);
    const actor = { ...(await loadActor(request.appUser.userId)), role: request.appUser.role };
    const claim = await updateReturnCase(request.appUser.storeId, id, body, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: visibleReturn(claim, request.appUser) };
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
      diagnosis: z.string().trim().max(2000).nullable().optional(),
      note,
    }).parse(request.body);
    const claim = await resolveReturnCase(request.appUser.storeId, id, body, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: visibleReturn(claim, request.appUser) };
  });

  app.post("/:id/rma", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    const actor = await requireSensitiveActor(request.appUser, reply);
    if (!actor) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      status: z.enum(RMA_STATUSES),
      stockStatus: z.string().trim().max(20).nullable().optional(),
      note,
    }).parse(request.body);
    const claim = await advanceRma(request.appUser.storeId, id, body, actor);
    if (!claim) return reply.code(404).send({ error: "No encontramos ese reclamo." });
    return { return: visibleReturn(claim, request.appUser) };
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
    return { return: visibleReturn(claim, request.appUser) };
  });
}
