import type { AppUserContext, FirebaseAuthContext } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: FirebaseAuthContext;
    appUser?: AppUserContext;
  }
}

export {};
