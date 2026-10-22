import { readReason } from "../audit/archive.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { loadActor } from "../audit/audit.js";
import { archiveExpense, createExpense, listExpenses, restoreExpense, updateExpense, type ExpenseInput } from "./expenses.service.js";

const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida"),
  category: z.string().trim().min(1, "Completá la categoría.").max(80, "La categoría es demasiado larga."),
  amount: z.number().positive("El monto tiene que ser mayor a cero").max(100_000_000, "El monto es demasiado grande."),
  currency: z.enum(["ARS", "USD"], { errorMap: () => ({ message: "Elegí pesos o dólares." }) }),
  exchangeRate: z.number().positive("La cotización tiene que ser mayor a cero").max(100_000_000).nullable().optional(),
  notes: z.string().trim().max(2000, "Las notas son demasiado largas.").nullable().optional(),
});

export function denyUnlessOwner(request: FastifyRequest, reply: FastifyReply) {
  if (request.appUser?.role !== "OWNER") {
    reply.code(403).send({ error: "Solo el propietario puede ver los gastos y la ganancia neta" });
    return false;
  }
  return true;
}

export async function expenseRoutes(app: FastifyInstance) {
  const guard = [authenticate, resolveAppUser];

  app.get("/", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!denyUnlessOwner(request, reply)) return;
    const query = z.object({ archived: z.enum(["1", "true"]).optional() }).parse(request.query);
    return { expenses: await listExpenses(request.appUser.storeId, Boolean(query.archived)) };
  });

  app.post("/", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!denyUnlessOwner(request, reply)) return;
    const body = expenseSchema.parse(request.body) as ExpenseInput;
    const expense = await createExpense(request.appUser.storeId, body, await loadActor(request.appUser.userId));
    return reply.code(201).send({ expense });
  });

  app.patch("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!denyUnlessOwner(request, reply)) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = expenseSchema.parse(request.body) as ExpenseInput;
    const expense = await updateExpense(request.appUser.storeId, id, body, await loadActor(request.appUser.userId));
    if (!expense) return reply.code(404).send({ error: "No encontramos ese gasto" });
    return { expense };
  });

  app.delete("/:id", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!denyUnlessOwner(request, reply)) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const archived = await archiveExpense(request.appUser.storeId, id, await loadActor(request.appUser.userId), readReason(request.body));
    if (!archived) return reply.code(404).send({ error: "No encontramos ese gasto" });
    return reply.code(204).send();
  });

  app.post("/:id/restore", { preHandler: guard }, async (request, reply) => {
    requireMember(request);
    if (!denyUnlessOwner(request, reply)) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const expense = await restoreExpense(request.appUser.storeId, id, await loadActor(request.appUser.userId));
    if (!expense) return reply.code(404).send({ error: "No encontramos ese gasto" });
    return { expense };
  });
}
