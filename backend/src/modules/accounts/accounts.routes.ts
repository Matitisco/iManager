import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember } from "../../middleware/section-access.js";
import { canAccessSection } from "../stores/sections.js";
import { loadActor } from "../audit/audit.js";
import { addMovement, collectAccount, getFollowUpSettings, getSaleAccount, listDebtors, listFollowUps, saveFollowUpSettings } from "./accounts.service.js";

const money = z.number().positive().max(100_000_000);
const currency = z.enum(["ARS", "USD"]).nullable().optional();

function allowClientsOrSales(request: FastifyRequest, reply: FastifyReply) {
  requireMember(request);
  const member = request.appUser;
  if (canAccessSection("clients", member) || canAccessSection("sales", member)) return true;
  reply.code(403).send({ error: "No tenés acceso a Clientes" });
  return false;
}

export async function accountsRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser];

  app.get("/debtors", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    return { debtors: await listDebtors(request.appUser!.storeId) };
  });

  app.get("/follow-ups", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    return listFollowUps(request.appUser!.storeId);
  });

  app.get("/follow-ups/settings", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    return { settings: await getFollowUpSettings(request.appUser!.storeId) };
  });

  app.patch("/follow-ups/settings", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    const body = z.object({
      birthdayLeadDays: z.number().int().min(0).max(60).optional(),
      warrantyMonths: z.number().int().min(0).max(36).optional(),
      warrantyLeadDays: z.number().int().min(0).max(60).optional(),
      inactiveDays: z.number().int().min(30).max(365).optional(),
      includeDebts: z.boolean().optional(),
    }).parse(request.body);
    return { settings: await saveFollowUpSettings(request.appUser!.storeId, body) };
  });

  app.get("/sales/:saleId", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    const params = z.object({ saleId: z.string().min(1) }).parse(request.params);
    const account = await getSaleAccount(request.appUser!.storeId, params.saleId);
    if (!account) return reply.code(404).send({ error: "Sale not found" });
    return account;
  });

  app.post("/clients/:clientId/movements", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    const params = z.object({ clientId: z.string().min(1) }).parse(request.params);
    const body = z.object({
      kind: z.enum(["CARGO", "DESCUENTO", "NOTA_CREDITO"]),
      amount: money,
      note: z.string().trim().max(200).nullable().optional(),
      saleId: z.string().min(1).nullable().optional(),
      currency,
    }).parse(request.body);
    const client = await addMovement(request.appUser!.storeId, params.clientId, {
      kind: body.kind,
      amount: body.amount,
      note: body.note,
      saleId: body.saleId,
      currency: body.currency,
    }, await loadActor(request.appUser!.userId));
    return reply.code(201).send({ client });
  });

  app.post("/collections", { preHandler: guard }, async (request, reply) => {
    if (!allowClientsOrSales(request, reply)) return;
    const body = z.object({
      clientId: z.string().min(1),
      saleId: z.string().min(1).nullable().optional(),
      repairId: z.string().min(1).nullable().optional(),
      amount: money,
      method: z.string().trim().min(1).max(50),
      currency,
    }).parse(request.body);
    const client = await collectAccount(request.appUser!.storeId, {
      clientId: body.clientId,
      saleId: body.saleId,
      repairId: body.repairId,
      amount: body.amount,
      method: body.method,
      currency: body.currency,
    }, await loadActor(request.appUser!.userId));
    return reply.code(201).send({ client });
  });
}
