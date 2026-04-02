import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { salesRoutes } from "./modules/sales/sales.routes.js";
import { tradeInsRoutes } from "./modules/trade-ins/trade-ins.routes.js";

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
  app.register(clientsRoutes, { prefix: "/api/clients" });
  app.register(inventoryRoutes, { prefix: "/api/inventory" });
  app.register(salesRoutes, { prefix: "/api/sales" });
  app.register(tradeInsRoutes, { prefix: "/api/trade-ins" });

  return app;
}
