import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { requireMember, requireSectionAccess } from "../../middleware/section-access.js";
import { loadActor } from "../audit/audit.js";
import { canSeeFinancials } from "../stores/sections.js";
import { COMMISSION_BASES } from "./commission-math.js";
import { bulkAssignSeller, createCommissionPayment, deleteCommissionRule, getCommissionPeriod, getCommissionPerson,
  getMyCommissions, listCommissionPayments, listCommissionRules, saveCommissionRule, type CommissionRuleInput, type CommissionPaymentInput } from "./commissions.service.js";

export const commissionPeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const querySchema = z.object({ period: commissionPeriodSchema.optional() }).strict();
const ruleSchema = z.object({
  memberId: z.string().min(1).nullable().default(null),
  basis: z.enum(COMMISSION_BASES).default("PROFIT_PERCENT"),
  rate: z.number().finite().nonnegative().max(99999999),
  currency: z.enum(["ARS", "USD"]).nullable().optional(),
  effectiveFrom: z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
}).strict();
const idSchema = z.object({ id: z.string().min(1) });

export async function commissionsRoutes(app: FastifyInstance) {
  const session = [authenticate, resolveAppUser];
  const admin = [...session, requireSectionAccess("commissions")];
  app.get("/", { preHandler: admin }, async request => {
    requireMember(request);
    const data = await getCommissionPeriod(request.appUser.storeId, querySchema.parse(request.query).period);
    return { ...data, people: data.people.map(({ sales: _sales, payments: _payments, adjustments: _adjustments, ...person }) => person) };
  });
  app.get("/mine", { preHandler: session }, async request => {
    requireMember(request);
    // No caller-controlled member identifier and no financial fields, even for owners.
    return getMyCommissions(request.appUser.storeId, request.appUser.userId, querySchema.parse(request.query).period);
  });
  app.get("/members/:id", { preHandler: admin }, async request => {
    requireMember(request);
    return getCommissionPerson(request.appUser.storeId, idSchema.parse(request.params).id,
      querySchema.parse(request.query).period, canSeeFinancials(request.appUser));
  });
  app.get("/rules", { preHandler: admin }, async request => {
    requireMember(request);
    return { rules: await listCommissionRules(request.appUser.storeId) };
  });
  app.post("/rules", { preHandler: admin }, async (request, reply) => {
    requireMember(request);
    const rule = await saveCommissionRule(request.appUser.storeId, await loadActor(request.appUser.userId), ruleSchema.parse(request.body) as CommissionRuleInput);
    return reply.code(201).send({ rule });
  });
  app.patch("/rules/:id", { preHandler: admin }, async request => {
    requireMember(request);
    return { rule: await saveCommissionRule(request.appUser.storeId, await loadActor(request.appUser.userId), ruleSchema.partial().refine(value => Object.keys(value).length > 0, "Indicá un cambio").parse(request.body) as Partial<CommissionRuleInput>, idSchema.parse(request.params).id) };
  });
  app.delete("/rules/:id", { preHandler: admin }, async (request, reply) => {
    requireMember(request);
    await deleteCommissionRule(request.appUser.storeId, await loadActor(request.appUser.userId), idSchema.parse(request.params).id);
    return reply.code(204).send();
  });
  app.get("/payments", { preHandler: admin }, async request => {
    requireMember(request);
    const query = z.object({ period: commissionPeriodSchema.optional(), memberId: z.string().min(1).optional() }).strict().parse(request.query);
    return { payments: await listCommissionPayments(request.appUser.storeId, query.period, query.memberId) };
  });
  app.post("/payments", { preHandler: admin }, async (request, reply) => {
    requireMember(request);
    const input = z.object({ memberId: z.string().min(1), period: commissionPeriodSchema, amount: z.number().finite().positive().max(9999999999),
      currency: z.enum(["ARS", "USD"]), exchangeRate: z.number().finite().positive().max(9999999999),
      settlesCurrency: z.enum(["ARS", "USD"]), note: z.string().trim().max(2000).nullable().optional() }).strict().parse(request.body);
    return reply.code(201).send({ payment: await createCommissionPayment(request.appUser.storeId, await loadActor(request.appUser.userId), input as CommissionPaymentInput) });
  });
  app.patch("/sales/seller", { preHandler: admin }, async request => {
    requireMember(request);
    const input = z.object({ saleIds: z.array(z.string().min(1)).min(1).max(500), sellerMemberId: z.string().min(1).nullable() }).strict().parse(request.body);
    return bulkAssignSeller(request.appUser.storeId, await loadActor(request.appUser.userId), input.saleIds, input.sellerMemberId);
  });
}
