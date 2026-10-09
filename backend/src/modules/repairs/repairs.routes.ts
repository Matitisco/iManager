import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import { canManageSensitive, requireSensitiveActor } from "../stores/sensitive-access.js";
import { loadActor } from "../audit/audit.js";
import {
  changeRepairStatus,
  createRepair,
  deleteRepair,
  getRepair,
  getRepairErrorStatus,
  listRepairs,
  updateRepair,
  type RepairOrderInput,
} from "./repairs.service.js";

const tags = z.array(z.string().trim().min(1).max(40)).max(8);
const money = z.number().nonnegative().max(100_000_000);

const repairSchema = z.object({
  clientId: z.string().trim().min(1).nullable().optional(),
  clientName: z.string().trim().min(1, "Completá el cliente").max(120),
  device: z.string().trim().min(1, "Completá el equipo").max(120),
  imei: z.string().trim().max(20).optional().default(""),
  fault: z.string().trim().max(2000).optional().default(""),
  faultTags: tags.optional().default([]),
  estimate: money.nullable().optional(),
  deposit: money.optional().default(0),
  currency: z.enum(["ARS", "USD"]).nullable().optional(),
  technician: z.string().trim().max(120).optional().default(""),
  status: z.string().trim().min(1).max(40).optional(),
  estimatedDelivery: z.string().trim().max(40).nullable().optional(),
  notifyWhatsapp: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (value.imei && !/^\d{15}$/.test(value.imei)) {
    context.addIssue({ code: "custom", message: "El IMEI tiene 15 dígitos", path: ["imei"] });
  }
  if (!value.fault && value.faultTags.length === 0) {
    context.addIssue({ code: "custom", message: "Contá la falla", path: ["fault"] });
  }
});

const patchSchema = z.object({
  clientId: z.string().trim().min(1).nullable().optional(),
  clientName: z.string().trim().min(1).max(120).optional(),
  device: z.string().trim().min(1).max(120).optional(),
  imei: z.string().trim().max(20).optional(),
  fault: z.string().trim().max(2000).optional(),
  faultTags: tags.optional(),
  estimate: money.nullable().optional(),
  deposit: money.optional(),
  currency: z.enum(["ARS", "USD"]).nullable().optional(),
  technician: z.string().trim().max(120).optional(),
  estimatedDelivery: z.string().trim().max(40).nullable().optional(),
  notifyWhatsapp: z.boolean().optional(),
}).superRefine((value, context) => {
  if (value.imei && !/^\d{15}$/.test(value.imei)) {
    context.addIssue({ code: "custom", message: "El IMEI tiene 15 dígitos", path: ["imei"] });
  }
}).refine((value) => Object.keys(value).length > 0, { message: "No hay cambios" });

const statusSchema = z.object({
  status: z.string().trim().min(1, "Elegí un estado").max(40),
});

function guard(request: { appUser?: { userId: string; storeId: string; role: string; sections?: unknown; sensitiveAccess?: boolean | null } }, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  if (!request.appUser) {
    reply.code(403).send({ error: "Store membership required" });
    return null;
  }
  if (!canAccessSection("service", request.appUser)) {
    reply.code(403).send({ error: "No tenés acceso a Servicio técnico" });
    return null;
  }
  return request.appUser;
}

// Zod errors go to the global handler (lib/api-error.ts), which answers 400 in Spanish with per-field messages.
function sendError(error: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  const mapped = getRepairErrorStatus(error);
  if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
  throw error;
}

export async function repairsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];

  app.get("/", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    return { orders: await listRepairs(member.storeId) };
  });

  app.get("/:id", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const order = await getRepair(member.storeId, id);
    if (!order) return reply.code(404).send({ error: "Orden no encontrada" });
    return { order };
  });

  app.post("/", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    try {
      const body = repairSchema.parse(request.body) as RepairOrderInput;
      const result = await createRepair(member.storeId, body);
      return reply.code(201).send(result);
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.patch("/:id", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = patchSchema.parse(request.body);
      const canChangePrice = canManageSensitive(member);
      const actor = body.estimate !== undefined && canChangePrice ? await loadActor(member.userId) : null;
      const result = await updateRepair(member.storeId, id, body, { canChangePrice, actor });
      if (!result) return reply.code(404).send({ error: "Orden no encontrada" });
      return result;
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.post("/:id/status", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = statusSchema.parse(request.body);
      const result = await changeRepairStatus(member.storeId, id, body.status);
      if (!result) return reply.code(404).send({ error: "Orden no encontrada" });
      return result;
    } catch (error) {
      return sendError(error, reply);
    }
  });

  app.delete("/:id", { preHandler }, async (request, reply) => {
    const member = guard(request, reply);
    if (!member) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const actor = await requireSensitiveActor(member, reply);
    if (!actor) return;
    const deleted = await deleteRepair(member.storeId, id, actor);
    if (!deleted) return reply.code(404).send({ error: "Orden no encontrada" });
    return reply.code(204).send();
  });
}
