import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import type { TradeInInput } from "./trade-ins.service.js";
import {
  createTradeIn,
  deleteTradeIn,
  getTradeInsErrorStatus,
  importTradeIns,
  listTradeIns,
  updateTradeIn,
} from "./trade-ins.service.js";

const tradeInStatusSchema = z.enum([
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
  "EN REVISIÓN",
  "PERITAJE TÉC.",
  "LISTO",
]);

const tradeInCreateSchema = z.object({
  date: z.string().min(1).max(120),
  clientId: z.string().min(1),
  deviceReceived: z.string().min(1).max(120),
  deviceReceivedImei: z.string().min(1).max(100),
  takeValue: z.number(),
  deviceGiven: z.string().min(1).max(120),
  differencePaid: z.number(),
  status: tradeInStatusSchema,
  batteryHealth: z.string().trim().max(50).optional().nullable(),
  grade: z.string().trim().max(20).optional().nullable(),
});

const tradeInPatchSchema = tradeInCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function tradeInsRoutes(app: FastifyInstance) {
  app.post(
    "/import",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const rowSchema = z.object({
        date: z.string().trim().optional(),
        clientName: z.string().trim().optional(),
        deviceReceived: z.string().trim().optional(),
        deviceReceivedImei: z.string().trim().optional(),
        takeValue: z.string().trim().optional(),
        deviceGiven: z.string().trim().optional(),
        differencePaid: z.string().trim().optional(),
        status: z.string().trim().optional(),
        batteryHealth: z.string().trim().optional(),
        grade: z.string().trim().optional(),
      });

      const { rows } = z.object({ rows: z.array(rowSchema) }).parse(request.body);
      const result = await importTradeIns(request.appUser.storeId, rows);
      return reply.code(200).send(result);
    }
  );

  app.get(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const tradeIns = await listTradeIns(request.appUser.storeId);
      return { tradeIns };
    }
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const body = tradeInCreateSchema.parse(request.body) as TradeInInput;

      try {
        const tradeIn = await createTradeIn(request.appUser.storeId, body);
        return reply.code(201).send({ tradeIn });
      } catch (error) {
        const mapped = getTradeInsErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
    }
  );

  app.patch(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = tradeInPatchSchema.parse(request.body);

      try {
        const tradeIn = await updateTradeIn(request.appUser.storeId, params.id, body);

        if (!tradeIn) {
          return reply.code(404).send({ error: "Trade-in not found" });
        }

        return { tradeIn };
      } catch (error) {
        const mapped = getTradeInsErrorStatus(error);
        if (mapped) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }

        throw error;
      }
    }
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request, reply) => {
      if (!request.appUser) {
        return reply.code(403).send({ error: "Store membership required" });
      }

      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const deleted = await deleteTradeIn(request.appUser.storeId, params.id);

      if (!deleted) {
        return reply.code(404).send({ error: "Trade-in not found" });
      }

      return reply.code(204).send();
    }
  );
}
