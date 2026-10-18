import type { AppUserContext, FirebaseAuthContext } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: FirebaseAuthContext;
    analyticsUserId?: string;
    appUser?: AppUserContext;
  }
}

export {};
