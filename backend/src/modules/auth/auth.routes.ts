import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { getDefaultMembershipForUser } from "../stores/stores.service.js";

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

      const user = await findOrCreateUserFromFirebase(request.auth);
      const membership = await getDefaultMembershipForUser(user.id);

      if (!membership) {
        return {
          user: {
            id: user.id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            displayName: user.displayName,
          },
          store: null,
          membership: null,
          onboardingRequired: true,
        };
      }

      return {
        user: {
          id: user.id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
        },
        store: {
          id: membership.store.id,
          name: membership.store.name,
          currency: membership.store.currency,
          timezone: membership.store.timezone,
        },
        membership: {
          role: membership.role,
          isDefault: membership.isDefault,
        },
        onboardingRequired: false,
      };
    }
  );
}
