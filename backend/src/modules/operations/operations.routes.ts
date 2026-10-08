import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import { accessoryLinesSchema } from "../accessories/accessory-lines.js";
import {
  cancelOperationFromSale,
  cancelTradeFromSale,
  cancelTradeOperation,
  confirmTradeOperation,
  createOperation,
  getOperationErrorStatus,
  getOperationOptions,
  getSaleOperation,
  getTradeOperation,
  isTradeAccessibleToSource,
  isPendingTradeForSource,
  listOperationDrafts,
  updateSaleOperation,
  updateTradeFromSale,
  updateTradeOperation,
  type OperationInput,
  type OperationSource,
} from "./operations.service.js";

const sourceSchema = z.enum(["inventory", "sales", "tradeins", "clients"]);
const sectionFor: Record<OperationSource, "inventory" | "sales" | "tradeins" | "clients"> = {
  inventory: "inventory",
  sales: "sales",
  tradeins: "tradeins",
  clients: "clients",
};
const tradeSchema = z.object({
  deviceReceived: z.string().trim().min(1).max(120),
  deviceReceivedImei: z.string().trim().max(100).nullable().optional(),
  takeValue: z.number().nonnegative(),
  status: z.string().trim().max(30).optional(),
  batteryHealth: z.string().trim().max(50).nullable().optional(),
  grade: z.string().trim().max(20).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
}).partial().optional();
const inputSchema = z.object({
  date: z.string().trim().max(120).optional(),
  clientId: z.string().trim().nullable().optional(),
  clientName: z.string().trim().max(120).nullable().optional(),
  productId: z.string().trim().nullable().optional(),
  deviceLabel: z.string().trim().max(120).nullable().optional(),
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().trim().max(50).optional(),
  status: z.enum(["COMPLETADA", "PENDIENTE"]).optional(),
  categoryId: z.string().nullable().optional(),
  saleCategoryId: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
  requestKey: z.string().trim().max(120).optional(),
  draft: z.boolean().optional(),
  tradeIn: tradeSchema,
  accessories: accessoryLinesSchema,
});

function getSource(value: unknown): OperationSource | null {
  const parsed = sourceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function routeParams(request: FastifyRequest) {
  return z.object({ source: z.string(), id: z.string().optional() }).parse(request.params);
}

function authorized(request: FastifyRequest, reply: FastifyReply, source: OperationSource) {
  if (!request.appUser) {
    reply.code(403).send({ error: "Store membership required" });
    return false;
  }
  if (!canAccessSection(sectionFor[source], request.appUser)) {
    reply.code(403).send({ error: "No tenes acceso a esta seccion" });
    return false;
  }
  return true;
}

function errorReply(error: unknown, reply: FastifyReply) {
  const mapped = getOperationErrorStatus(error);
  if (mapped) return reply.code(mapped.statusCode).send({ error: mapped.message });
  throw error;
}

function parseInput(value: unknown, reply: FastifyReply): OperationInput | null {
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) {
    reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid operation payload" });
    return null;
  }
  return parsed.data as OperationInput;
}

export async function operationsRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];
  app.get("/:source/options", { preHandler }, async (request, reply) => {
    const source = getSource(routeParams(request).source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (!authorized(request, reply, source)) return;
    return getOperationOptions(request.appUser!.storeId);
  });

  app.get("/:source/drafts", { preHandler }, async (request, reply) => {
    const source = getSource(routeParams(request).source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (!authorized(request, reply, source)) return;
    return listOperationDrafts(request.appUser!.storeId, source);
  });

  app.post("/:source", { preHandler }, async (request, reply) => {
    const source = getSource(routeParams(request).source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (!authorized(request, reply, source)) return;
    const input = parseInput(request.body, reply);
    if (!input) return;
    if (source === "inventory" && !input.productId) return reply.code(400).send({ error: "Inventory source requires an existing product sale" });
    if (source === "clients" && !input.clientId) return reply.code(400).send({ error: "Clients source requires an existing client sale" });
    if (source === "tradeins" && !input.tradeIn) return reply.code(400).send({ error: "Trade-ins source requires exchange details" });
    try { return reply.code(201).send(await createOperation(request.appUser!.storeId, source, input, request.appUser!.userId)); }
    catch (error) { return errorReply(error, reply); }
  });

  app.get("/:source/sales/:id", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (source !== "sales") return reply.code(403).send({ error: "Only sales source can read a sale operation" });
    if (!authorized(request, reply, source)) return;
    try { return await getSaleOperation(request.appUser!.storeId, params.id ?? ""); }
    catch (error) { return errorReply(error, reply); }
  });

  app.get("/:source/trades/:id", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (!authorized(request, reply, source)) return;
    if (!await isTradeAccessibleToSource(request.appUser!.storeId, params.id ?? "", source)) {
      return reply.code(403).send({ error: "This source cannot read the trade-in operation" });
    }
    try { return await getTradeOperation(request.appUser!.storeId, params.id ?? "", source); }
    catch (error) { return errorReply(error, reply); }
  });

  app.post("/:source/trades/:id/confirm", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (!authorized(request, reply, source)) return;
    if ((source === "inventory" || source === "clients")
      ? !await isPendingTradeForSource(request.appUser!.storeId, params.id ?? "", source)
      : source !== "tradeins" && !await isTradeAccessibleToSource(request.appUser!.storeId, params.id ?? "", source)) {
      return reply.code(403).send({ error: "This source cannot confirm the trade-in" });
    }
    const input = parseInput(request.body, reply);
    if (!input) return;
    try { return await confirmTradeOperation(request.appUser!.storeId, params.id ?? "", input, request.appUser!.userId); }
    catch (error) { return errorReply(error, reply); }
  });

  app.patch("/:source/sales/:id", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (source !== "sales") return reply.code(403).send({ error: "Only sales source can edit a sale" });
    if (!authorized(request, reply, source)) return;
    const input = parseInput(request.body, reply);
    if (!input) return;
    try { return await updateSaleOperation(request.appUser!.storeId, params.id ?? "", input); }
    catch (error) { return errorReply(error, reply); }
  });

  app.patch("/:source/trades/:id", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (source !== "tradeins" && source !== "sales" && source !== "inventory" && source !== "clients") return reply.code(403).send({ error: "This source cannot edit a trade-in" });
    if (!authorized(request, reply, source)) return;
    if (source === "inventory" || source === "clients") {
      if (!await isPendingTradeForSource(request.appUser!.storeId, params.id ?? "", source)) return reply.code(403).send({ error: "This source can only edit its pending trade-in" });
    } else if (source !== "tradeins" && !await isTradeAccessibleToSource(request.appUser!.storeId, params.id ?? "", source)) return reply.code(403).send({ error: "This source cannot edit the trade-in operation" });
    const input = parseInput(request.body, reply);
    if (!input) return;
    try { return source === "sales" ? await updateTradeFromSale(request.appUser!.storeId, params.id ?? "", input) : await updateTradeOperation(request.appUser!.storeId, params.id ?? "", input); }
    catch (error) { return errorReply(error, reply); }
  });

  app.post("/:source/trades/:id/cancel", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (source !== "tradeins" && source !== "sales" && source !== "inventory" && source !== "clients") return reply.code(403).send({ error: "This source cannot cancel a trade-in" });
    if (!authorized(request, reply, source)) return;
    if (source === "inventory" || source === "clients") {
      if (!await isPendingTradeForSource(request.appUser!.storeId, params.id ?? "", source)) return reply.code(403).send({ error: "This source can only cancel its pending trade-in" });
    } else if (source !== "tradeins" && !await isTradeAccessibleToSource(request.appUser!.storeId, params.id ?? "", source)) return reply.code(403).send({ error: "This source cannot cancel the trade-in operation" });
    try { return source === "sales" ? await cancelTradeFromSale(request.appUser!.storeId, params.id ?? "") : await cancelTradeOperation(request.appUser!.storeId, params.id ?? ""); }
    catch (error) { return errorReply(error, reply); }
  });

  app.post("/:source/sales/:id/cancel", { preHandler }, async (request, reply) => {
    const params = routeParams(request);
    const source = getSource(params.source);
    if (!source) return reply.code(400).send({ error: "Invalid operation source" });
    if (source !== "sales") return reply.code(403).send({ error: "Only sales source can cancel a sale" });
    if (!authorized(request, reply, source)) return;
    try { return await cancelOperationFromSale(request.appUser!.storeId, params.id ?? ""); }
    catch (error) { return errorReply(error, reply); }
  });
}
