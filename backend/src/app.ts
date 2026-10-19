import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { billingRoutes, mercadoPagoWebhookRoutes } from './modules/billing/routes.js';
import { cashRoutes } from './modules/cash/routes.js';
import { catalogManagementRoutes, publicCatalogRoutes } from './modules/public-catalog/routes.js';
import { depositsRoutes } from './modules/deposits/deposits.routes.js';
import { accountsRoutes } from "./modules/accounts/accounts.routes.js";
import { commissionsRoutes } from "./modules/commissions/commissions.routes.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { onboardingRoutes, gettingStartedRoutes } from "./modules/onboarding/onboarding.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { periodicReportRoutes } from "./modules/periodic-reports/routes.js";
import { expenseRoutes } from "./modules/expenses/expenses.routes.js";
import { returnRoutes } from "./modules/returns/returns.routes.js";
import { reportsRoutes } from "./modules/reports/reports.routes.js";
import { supplierRoutes } from "./modules/suppliers/suppliers.routes.js";
import { salesRoutes } from "./modules/sales/sales.routes.js";
import { tradeInsRoutes } from "./modules/trade-ins/trade-ins.routes.js";
import { storesRoutes } from "./modules/stores/stores.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { securityRoutes } from "./modules/security/security.routes.js";
import { invitationsRoutes } from "./modules/invitations/invitations.routes.js";
import { catalogsRoutes } from "./modules/catalogs/catalogs.routes.js";
import { operationsRoutes } from "./modules/operations/operations.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { repairsRoutes } from "./modules/repairs/repairs.routes.js";
import { importRoutes } from "./modules/import/import.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { historyRoutes } from "./modules/audit/history.routes.js";
import { stockCountRoutes } from "./modules/stock-counts/stock-counts.routes.js";
import { env } from "./config/env.js";
import { registerApiErrorHandler } from "./lib/api-error.js";
import { redactFinancials } from "./lib/redact-financials.js";
import { canSeeFinancials } from "./modules/stores/sections.js";

export function buildApp({ publicCatalogReadLimit = 60 }: { publicCatalogReadLimit?: number } = {}) {
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : true,
  });

  const allowedOrigins = env.CORS_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  app.register(cors, {
    origin: allowedOrigins.length > 0
      ? (origin, callback) => {
          if (!origin) { callback(null, true); return; }
          if (allowedOrigins.includes(origin)) { callback(null, true); return; }
          callback(new Error("Origin not allowed"), false);
        }
      : true,
    credentials: true,
  });

  app.register(sensible);

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api")) reply.header("cache-control", "no-store");
  });

  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (!request.appUser || canSeeFinancials(request.appUser)) return payload;
    return redactFinancials(payload);
  });

  app.register(catalogManagementRoutes, { prefix: "/api/catalog" });
  app.register(publicCatalogRoutes, { prefix: "/api/public/catalog", readLimit: publicCatalogReadLimit });
  app.register(billingRoutes, { prefix: "/api/billing" });
  app.register(mercadoPagoWebhookRoutes, { prefix: "/webhooks" });
  app.register(healthRoutes, { prefix: "/api" });
  app.register(authRoutes, { prefix: "/api" });
  app.register(analyticsRoutes, { prefix: "/api" });
  app.register(gettingStartedRoutes, { prefix: "/api" });
  app.register(onboardingRoutes, { prefix: "/api" });
  app.register(depositsRoutes, { prefix: '/api/clients' });
  app.register(cashRoutes, { prefix: "/api/cash" });
  app.register(accountsRoutes, { prefix: "/api/accounts" });
  app.register(clientsRoutes, { prefix: "/api/clients" });
  app.register(inventoryRoutes, { prefix: "/api/inventory" });
  app.register(stockCountRoutes, { prefix: "/api/stock-counts" });
  app.register(commissionsRoutes, { prefix: "/api/commissions" });
  app.register(reportsRoutes, { prefix: "/api/reports" });
  app.register(supplierRoutes, { prefix: "/api/suppliers" });
  app.register(expenseRoutes, { prefix: "/api/expenses" });
  app.register(returnRoutes, { prefix: "/api/returns" });
  app.register(salesRoutes, { prefix: "/api/sales" });
  app.register(tradeInsRoutes, { prefix: "/api/trade-ins" });
  app.register(storesRoutes, { prefix: "/api/stores" });
  app.register(periodicReportRoutes, { prefix: "/api/stores" });
  app.register(usersRoutes, { prefix: "/api/users" });
  app.register(securityRoutes, { prefix: "/api/security" });
  app.register(invitationsRoutes, { prefix: "/api/invitations" });
  app.register(catalogsRoutes, { prefix: "/api/catalogs" });
  app.register(operationsRoutes, { prefix: "/api/operations" });
  app.register(notificationsRoutes, { prefix: "/api/notifications" });
  app.register(repairsRoutes, { prefix: "/api/repairs" });
  app.register(importRoutes, { prefix: "/api/import" });
  app.register(historyRoutes, { prefix: "/api/history" });
  app.register(adminRoutes, { prefix: "/admin" });
  registerApiErrorHandler(app);

  return app;
}
