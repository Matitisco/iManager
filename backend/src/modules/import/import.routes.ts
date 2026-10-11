import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DomainError } from "../../lib/domain-error.js";
import { storeCurrency } from "../../lib/money-currency.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { prisma } from "../../plugins/prisma.js";
import { canAccessSection } from "../stores/sections.js";
import { analyzeImport, applyImportPlan } from "./analyze-import.service.js";
import { IMPORT_CATALOGS, IMPORT_SECTIONS } from "./import-catalog.js";
import { CONDITIONS, type ImportSheet, type SheetPlan } from "./sheet-plan.js";

const sheetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rows: z.array(z.array(z.string().max(2000)).max(40)).max(2000),
});

const sheetsSchema = z.object({
  section: z.enum(IMPORT_SECTIONS),
  sheets: z.array(sheetSchema).min(1).max(12),
});

const planSchema = z.object({
  name: z.string().trim().min(1).max(80),
  include: z.boolean(),
  condition: z.enum(CONDITIONS),
  headerRow: z.number().int().min(1).max(2000),
  dataStartRow: z.number().int().min(1).max(2001),
  dataEndRow: z.number().int().min(0).max(2000),
  mapping: z.array(z.object({
    header: z.string().max(200),
    field: z.string().max(40),
  })).max(40),
  splitModelCapacity: z.boolean(),
  batteryAsPercent: z.boolean(),
  priceCurrency: z.enum(["", "ARS", "USD"]),
});

const applySchema = sheetsSchema.extend({
  plan: z.array(planSchema).min(1).max(12),
  refreshMapping: z.boolean().optional(),
});

export async function importRoutes(app: FastifyInstance) {
  app.post(
    "/analyze",
    { bodyLimit: 6 * 1024 * 1024, preHandler: [authenticate, resolveAppUser] },
    async (request) => {
      requireMember(request);
      const body = sheetsSchema.parse(request.body);
      assertAccess(body.section, request.appUser);
      const currency = await storeCurrency(request.appUser.storeId, prisma);
      return analyzeImport({
        section: body.section,
        sheets: body.sheets as ImportSheet[],
        currency,
      }, {
        log: (entry) => request.log.info(entry, "import analysis usage"),
      });
    },
  );

  app.post(
    "/apply",
    { bodyLimit: 6 * 1024 * 1024, preHandler: [authenticate, resolveAppUser] },
    async (request) => {
      requireMember(request);
      const body = applySchema.parse(request.body);
      assertAccess(body.section, request.appUser);
      const currency = await storeCurrency(request.appUser.storeId, prisma);
      return applyImportPlan({
        section: body.section,
        sheets: body.sheets as ImportSheet[],
        plan: body.plan as SheetPlan[],
        refreshMapping: body.refreshMapping,
        currency,
      }, {
        log: (entry) => request.log.info(entry, "import analysis usage"),
      });
    },
  );
}

function assertAccess(section: keyof typeof IMPORT_CATALOGS, member: { role: string; sections?: unknown }) {
  const catalog = IMPORT_CATALOGS[section];
  if (!canAccessSection(catalog.access, member)) {
    throw new DomainError(`No tenés acceso a ${catalog.accessLabel}`, 403);
  }
}
