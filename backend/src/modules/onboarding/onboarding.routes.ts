import { z, ZodError } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import {
  completeOnboarding,
  type CompleteOnboardingInput,
} from "./onboarding.service.js";

// All progress is scoped to the authenticated membership, never a supplied store ID.
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import {
  requireMember,
  requireSectionAccess,
} from "../../middleware/section-access.js";
import {
  getGettingStarted,
  patchGettingStarted,
  createSampleStock,
  deleteSampleStock,
} from "./getting-started.service.js";

const onboardingSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "Completá el nombre de la tienda")
    .max(120),
  instagram: z.string().trim().max(300).optional(),
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
        const body = onboardingSchema.parse(
          request.body,
        ) as CompleteOnboardingInput;
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
    },
  );
}

export async function gettingStartedRoutes(app: FastifyInstance) {
  const preHandler = [authenticate, resolveAppUser];
  app.get("/onboarding/progress", { preHandler }, async (request) => {
    requireMember(request);
    return getGettingStarted(request.appUser);
  });
  app.patch("/onboarding/progress", { preHandler }, async (request) => {
    requireMember(request);
    const patch = z
      .object({
        dismissed: z.boolean().optional(),
        videoWatched: z.literal(true).optional(),
        installed: z.literal(true).optional(),
        complete: z.literal(true).optional(),
        stage: z.enum(["invite", "stock"]).optional(),
      })
      .strict()
      .parse(request.body);
    return patchGettingStarted(request.appUser, patch);
  });
  app.post(
    "/onboarding/samples",
    { preHandler: [...preHandler, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);
      if (request.appUser.role !== "OWNER")
        return reply
          .code(403)
          .send({ error: "Solo el dueño puede cargar los ejemplos." });
      await createSampleStock(request.appUser.storeId);
      return { ok: true };
    },
  );
  app.delete(
    "/onboarding/samples",
    { preHandler: [...preHandler, requireSectionAccess("inventory")] },
    async (request, reply) => {
      requireMember(request);
      if (
        request.appUser.role !== "OWNER" &&
        request.appUser.role !== "MANAGER"
      )
        return reply
          .code(403)
          .send({ error: "No tenés permiso para borrar los ejemplos." });
      return deleteSampleStock(request.appUser.storeId);
    },
  );
}
