import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import { COMMISSION_BASES } from "./commission-math.js";
import {
  getCommissionErrorStatus,
  getCommissionPeriod,
  getCommissionPerson,
  markCommissionPaid,
  saveCommissionRule,
} from "./commissions.service.js";

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/).optional();

const ruleSchema = z.object({
  memberId: z.string().trim().min(1).nullable(),
  basis: z.enum(COMMISSION_BASES),
  rate: z.number().positive(),
  includeAccessories: z.boolean(),
}).superRefine((value, context) => {
  if (value.basis === "FIXED_PER_DEVICE" && value.rate > 100_000_000) {
    context.addIssue({ code: "custom", message: "El monto por equipo es demasiado alto", path: ["rate"] });
  }
  if (value.basis !== "FIXED_PER_DEVICE" && value.rate > 100) {
    context.addIssue({ code: "custom", message: "El porcentaje no puede pasar de 100", path: ["rate"] });
  }
});

const paymentSchema = z.object({
  memberId: z.string().trim().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

function guard(request: { appUser?: { userId: string; storeId: string; role: string; sections?: unknown } }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  if (!request.appUser) {
    reply.code(403).send({ error: "Store membership required" });
    return null;
  }
  if (!canAccessSection("commissions", request.appUser)) {
    reply.code(403).send({ error: "No tenés acceso a Comisiones" });
    return null;
  }
  return request.appUser;
}

function sendError(error: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: error.issues[0]?.message ?? "Revisá la regla de comisión" });
  }
  const mapped = getCommissionErrorStatus(error);
  if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
  throw error;
}

export async function commissionsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];

  app.get("/", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    const query = z.object({ period: periodSchema }).parse(request.query);
    try {
      return await getCommissionPeriod(member.storeId, query.period);
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.get("/people/:memberId", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    const params = z.object({ memberId: z.string().trim().min(1) }).parse(request.params);
    const query = z.object({ period: periodSchema }).parse(request.query);
    try {
      return await getCommissionPerson(member.storeId, params.memberId, query.period);
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.put("/rules", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    try {
      const body = ruleSchema.parse(request.body);
      if (!body.basis || body.rate == null || body.includeAccessories == null || body.memberId === undefined) {
        return reply.code(400).send({ error: "Revisá la regla de comisión" });
      }
      return await saveCommissionRule(member.storeId, member.userId, {
        memberId: body.memberId,
        basis: body.basis,
        rate: body.rate,
        includeAccessories: body.includeAccessories,
      });
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/payments", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    try {
      const body = paymentSchema.parse(request.body);
      return await markCommissionPaid(member.storeId, member.userId, body.memberId, body.period);
    } catch (error) {
      return sendError(error, reply);
    }
  });
}
