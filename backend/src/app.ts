import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { onboardingRoutes } from "./modules/onboarding/onboarding.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { salesRoutes } from "./modules/sales/sales.routes.js";
import { tradeInsRoutes } from "./modules/trade-ins/trade-ins.routes.js";
import { storesRoutes } from "./modules/stores/stores.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { securityRoutes } from "./modules/security/security.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.register(sensible);

  app.register(healthRoutes, { prefix: "/api" });
  app.register(authRoutes, { prefix: "/api" });
  app.register(onboardingRoutes, { prefix: "/api" });
  app.register(clientsRoutes, { prefix: "/api/clients" });
  app.register(inventoryRoutes, { prefix: "/api/inventory" });
  app.register(reportsRoutes, { prefix: "/api/reports" });
  app.register(salesRoutes, { prefix: "/api/sales" });
  app.register(tradeInsRoutes, { prefix: "/api/trade-ins" });
  app.register(storesRoutes, { prefix: "/api/stores" });
  app.register(usersRoutes, { prefix: "/api/users" });
  app.register(securityRoutes, { prefix: "/api/security" });

  return app;
}
