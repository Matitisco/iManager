import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DomainError } from "../../lib/domain-error.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireMember } from "../../middleware/section-access.js";
import { resolveAppUser } from "../../middleware/resolve-app-user.js";
import { canAccessSection } from "../stores/sections.js";
import { detectImport, type DetectImportInput } from "./detect-import.service.js";
import { IMPORT_CATALOGS, IMPORT_SECTIONS } from "./import-catalog.js";
import type { SheetOverride } from "./import-plan.js";
import { suggestColumnMapping, type SuggestMappingInput } from "./suggest-mapping.service.js";

const bodySchema = z.object({
  section: z.enum(IMPORT_SECTIONS),
  columns: z.array(z.object({
    header: z.string().trim().min(1).max(200),
    samples: z.array(z.string().max(120)).max(10),
  })).min(1).max(40),
});

const detectSchema = z.object({
  section: z.enum(IMPORT_SECTIONS),
  currency: z.enum(["ARS", "USD"]).optional(),
  sellRate: z.number().positive().max(1_000_000).nullable().optional(),
  sheets: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    rows: z.array(z.array(z.string().max(300)).max(30)).max(2000),
  })).min(1).max(20),
  overrides: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    include: z.boolean(),
    headerRow: z.number().int().min(0).max(1999),
    mapping: z.record(z.string().max(80), z.string().max(300)).optional(),
  })).max(20).optional(),
});

export async function importRoutes(app: FastifyInstance) {
  app.post(
    "/suggest-mapping",
    { preHandler: [authenticate, resolveAppUser] },
    async (request) => {
      requireMember(request);
      const body = bodySchema.parse(request.body) as SuggestMappingInput;
      const catalog = IMPORT_CATALOGS[body.section];
      if (!canAccessSection(catalog.access, request.appUser)) {
        throw new DomainError(`No tenés acceso a ${catalog.accessLabel}`, 403);
      }

      return suggestColumnMapping(body, {
        log: (entry) => request.log.info(entry, "import mapping usage"),
      });
    },
  );

  app.post(
    "/detect",
    { bodyLimit: 2_000_000, preHandler: [authenticate, resolveAppUser] },
    async (request) => {
      requireMember(request);
      const body = detectSchema.parse(request.body);
      const catalog = IMPORT_CATALOGS[body.section];
      if (!canAccessSection(catalog.access, request.appUser)) {
        throw new DomainError(`No tenés acceso a ${catalog.accessLabel}`, 403);
      }
      const overrides: SheetOverride[] | undefined = body.overrides?.map((override) => ({
        name: override.name,
        include: override.include,
        headerRow: override.headerRow,
        mapping: override.mapping,
        lockMoney: override.mapping != null,
      }));
      const input: DetectImportInput = {
        section: body.section,
        currency: body.currency,
        sellRate: body.sellRate,
        sheets: body.sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows ?? [] })),
        overrides,
      };
      return detectImport(input, {
        log: (entry) => request.log.info(entry, "import detect usage"),
      });
    },
  );
}
