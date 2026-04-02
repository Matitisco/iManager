import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { buildAppSessionForUser } from "./session.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [authenticate, resolveAppUser],
    },
    async (request) => {
      if (!request.auth) {
        return { error: "Unauthenticated" };
      }

      return buildAppSessionForUser(request.auth);
    }
  );
}
