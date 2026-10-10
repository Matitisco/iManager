import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { completeOnboarding, type CompleteOnboardingInput } from "./onboarding.service.js";

const onboardingSchema = z.object({
  storeName: z.string().trim().min(1, "Completá el nombre de la tienda").max(120),
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

      const body = onboardingSchema.parse(request.body) as CompleteOnboardingInput;
      const session = await completeOnboarding(request.auth, body);

      return { session };
    }
  );
}
