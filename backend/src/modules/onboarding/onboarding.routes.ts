import { z, ZodError } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { completeOnboarding, type CompleteOnboardingInput } from "./onboarding.service.js";

const onboardingSchema = z.object({
  storeName: z.string().trim().min(1, "Completá el nombre de la tienda").max(120),
  instagram: z.string({
    required_error: "Completá el Instagram de la tienda",
    invalid_type_error: "Completá el Instagram de la tienda",
  }).trim().min(1, "Completá el Instagram de la tienda").max(300),
  currency: z.enum(["ARS", "USD"]).optional(),
  exchangeMode: z.enum(["auto", "manual"]).optional(),
  exchangeSource: z.enum(["blue", "oficial", "mep"]).optional(),
  manualBuy: z.number().positive().nullable().optional(),
  manualSell: z.number().positive().nullable().optional(),
});

export async function onboardingRoutes(app: FastifyInstance) {
  app.post(
    "/onboarding",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      try {
        const body = onboardingSchema.parse(request.body) as CompleteOnboardingInput;
        const session = await completeOnboarding(request.auth, body);
        return { session };
      } catch (error) {
        if (error instanceof ZodError) throw error;
        const mapped = error as { statusCode?: number; message?: string };
        if (mapped.statusCode) {
          return reply.code(mapped.statusCode).send({ error: mapped.message });
        }
        throw error;
      }
    }
  );
}
