import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { findOrCreateUserFromFirebase } from "./users.service.js";
import { updateUserProfile } from "./users.service.js";

const userPatchSchema = z.object({
  displayName: z.string().min(1).max(255).nullable().optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  app.patch(
    "/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!request.auth) {
        return reply.code(401).send({ error: "Unauthenticated" });
      }

      const user = await findOrCreateUserFromFirebase(request.auth);
      const body = userPatchSchema.parse(request.body);
      const updated = await updateUserProfile(user.id, body);

      return {
        user: {
          id: updated.id,
          firebaseUid: updated.firebaseUid,
          email: updated.email,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
          twoFactorEnabled: updated.twoFactorEnabled,
        },
      };
    }
  );
}
