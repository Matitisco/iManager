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

import { analyzeTextImport, chunkText } from "./text-import.service.js";
import { createTextImportLimiter } from "./text-import-rate-limit.js";
import { TEXT_LIMITS } from "./text-import.schema.js";

const MAX_IMPORT_ROWS = 5000;

const sheetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rows: z.array(z.array(z.string().max(2000)).max(40)).max(MAX_IMPORT_ROWS),
});

const sheetsSchema = z.object({
  section: z.enum(IMPORT_SECTIONS),
  sheets: z.array(sheetSchema).min(1).max(12),
});

const planSchema = z.object({
  name: z.string().trim().min(1).max(80),
  include: z.boolean(),
  condition: z.enum(CONDITIONS),
  headerRow: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  dataStartRow: z.number().int().min(1).max(MAX_IMPORT_ROWS + 1),
  dataEndRow: z.number().int().min(0).max(MAX_IMPORT_ROWS),
  mapping: z.array(z.object({
    header: z.string().max(200),
    columnIndex: z.number().int().min(0).max(39).optional(),
    field: z.string().max(67),
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
  const acquireTextImport = createTextImportLimiter();
  app.post("/analyze-text", {
    bodyLimit: TEXT_LIMITS.bytes * 2,
    preHandler: [authenticate, resolveAppUser],
  }, async (request, reply) => {
    requireMember(request);
    assertAccess("inventory", request.appUser);
    const { text } = z.object({ text: z.string().max(TEXT_LIMITS.bytes) }).strict().parse(request.body);
    chunkText(text); // Reject oversized/invalid input before consuming quota or reading business data.
    const release = acquireTextImport(request.appUser.storeId);
    const controller = new AbortController();
    const abort = () => controller.abort();
    const disconnected = () => { if (!reply.raw.writableEnded) abort(); };
    request.raw.on("aborted", abort);
    reply.raw.on("close", disconnected);
    try {
      const [currency, existing] = await Promise.all([
        storeCurrency(request.appUser.storeId, prisma),
        prisma.inventoryItem.findMany({ where: { storeId: request.appUser.storeId }, distinct: ["model"], select: { model: true }, take: 2000 }),
      ]);
      const streaming = request.headers.accept === 'application/x-ndjson';
      if (streaming) {
        reply.hijack();
        for (const [name, value] of Object.entries(reply.getHeaders())) { if (value !== undefined) reply.raw.setHeader(name, value); }
        reply.raw.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
        const send = (event: unknown) => { if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.write(JSON.stringify(event) + '\n'); };
        try {
          const result = await analyzeTextImport({ text, currency, models: existing.map(item => item.model) }, {
            signal: controller.signal,
            observe: rows => send({ type: 'progress', rows: rows.map(row => ({ model: row.model, quantity: row.quantity })) }),
          });
          request.log.info(result.usage, 'text import analysis usage');
          send({ type: 'result', analysis: result });
        } catch (error) {
          send({ type: 'error', message: error instanceof DomainError ? error.message : 'No se pudo analizar el listado. Probá de nuevo.' });
        } finally { reply.raw.end(); }
        return reply;
      }
      const result = await analyzeTextImport({ text, currency, models: existing.map((item) => item.model) }, { signal: controller.signal });
      request.log.info(result.usage, "text import analysis usage");
      return result;
    } finally {
      request.raw.off("aborted", abort);
      reply.raw.off("close", disconnected);
      release();
    }
  });
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
