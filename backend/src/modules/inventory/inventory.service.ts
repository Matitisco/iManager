import { normalizeInventoryImportStatus } from "../import/inventory-status.js";
import { randomUUID } from 'node:crypto';
import { convertFields, entryDateValue, ensureDefinitions, listDefinitions, validateFields, type DefinitionInput } from '../custom-fields/custom-fields.service.js';
import { importErrorCollector, type ImportDiagnostics } from "../import/import-diagnostics.js";
import { parseArDate } from "../../lib/ar-date.js";
import { validateInventoryImportRow, prepareInventoryImportRow, MAX_INVENTORY_IMPORT_ITEMS } from "./import-validation.js";
import { ruleReason } from '../public-catalog/rules.js';
import type { StorePublicCatalog } from '@prisma/client';
import { lockInventory } from '../deposits/deposits.service.js';
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { normalizeCustomFields } from "../../lib/custom-fields.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { moneyChanged, writeAudit, type Actor } from "../audit/audit.js";
import { archivedMatch, batchChanges, cleanReason, deviceLabel, type ArchiveMeta } from "../audit/archive.js";
import { diffFields, MONEY } from "../audit/diff-fields.js";
import { writeOperationNotifications } from "../operations/operations.service.js";
import { imeiPassesLuhn, parseOptionalImei } from "../../lib/imei.js";
import { currencyOnWrite, storeCurrency } from "../../lib/money-currency.js";
import { assignItemSupplier, attachItemsToPurchase } from "../suppliers/link.js";
import { calendarDay } from "../periodic-reports/schedule.js";
import { loadProblems, summarizeProblems, type ProblemSummary } from "../suppliers/problems.js";
import { readPurchaseName } from "../suppliers/purchase-name.js";
import { inventoryGrade } from "./quality.js";

export interface InventoryItemInput {
  cantidad?: number;
  imei?: string | null;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  entryDate?: string | null;
  batteryNote?: string | null;
  batteryHealth: string;
  cost: number;
  price: number | null;
  currency?: string | null;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
  supplierId?: string | null;
  purchaseName?: string | null;
  name?: string | null;
}

export interface InventoryItemResponse {
  cantidad: number;
  catalogVisible: boolean;
  catalogIncluded: boolean;
  reservedDepositId?: string | null;
  reservedClientId?: string | null;
  reservedClientName?: string | null;
  reservedAt?: string | null;
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  entryDate?: string | null;
  batteryNote?: string | null;
  batteryHealth: string;
  cost: number;
  price: number | null;
  currency: string | null;
  status: string;
  categoryId: string | null;
  customFields: Record<string, unknown>;
  soldAt: string | null;
  createdAt: string;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  pendingSaleRegistration?: boolean;
  needsCompletion?: boolean;
  priceChangedBy: string | null;
  priceChangedAt: string | null;
  costChangedBy: string | null;
  costChangedAt: string | null;
  supplierId: string | null;
  supplierName: string | null;
  stockPurchaseId: string | null;
  purchasedAt: string | null;
  purchaseName: string | null;
}

export interface InventoryCategoryResponse {
  id: string;
  name: string;
  archived?: boolean;
}

export interface InventoryItemDetailResponse extends InventoryItemResponse {
  purchaseSummary: ProblemSummary | null;
}

type InventoryRecord = {
  catalogVisible?: boolean;
  catalogIncluded?: boolean;
  cantidad?: number;
  reservedDepositId?: string | null;
  reservedClientId?: string | null;
  reservedClientName?: string | null;
  reservedAt?: Date | null;
  id: string;
  imei: string | null;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  entryDate?: Date | null;
  batteryNote?: string | null;
  batteryHealth: string;
  categoryId: string | null;
  cost: Decimal;
  price: Decimal | null;
  currency?: string | null;
  status: string;
  customFields: Prisma.JsonValue | null;
  sales?: { soldAt: Date }[];
  createdAt?: Date;
  archivedAt?: Date | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  pendingSaleRegistration?: boolean;
  needsCompletion?: boolean;
  priceChangedBy?: string | null;
  priceChangedAt?: Date | null;
  costChangedBy?: string | null;
  costChangedAt?: Date | null;
  supplierId?: string | null;
  stockPurchaseId?: string | null;
  stockPurchase?: { purchasedAt: Date; name: string | null; deletedAt: Date | null } | null;
  supplier?: { name: string } | null;
  supplierName?: string | null;
};

class InventoryError extends DomainError {}

const inventoryPrisma = prisma as any;

const toDecimal = (value: number) => new Decimal(value);
const priceDecimal = (value: number | null) => value == null ? null : toDecimal(value);

async function assertCategoryBelongsToStore(storeId: string, categoryId?: string | null) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await inventoryPrisma.inventoryCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  if (!category) {
    throw new InventoryError("La categoría no existe en esta tienda", 404);
  }
}

const toCustomFields = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

function inPublicCatalog(item: { catalogVisible?: boolean; cantidad?: number; status: string; batteryHealth: string; archivedAt?: Date | string | null; needsCompletion?: boolean }, catalog: StorePublicCatalog | null) {
  return Boolean(catalog?.active && item.catalogVisible && !ruleReason({ ...item, quantity: item.cantidad ?? 1, archivedAt: item.archivedAt ? new Date(item.archivedAt) : null }, catalog));
}

function keptImei(customFields: Prisma.JsonValue | null | undefined): string {
  const value = toCustomFields(customFields ?? null).keptImei;
  return typeof value === "string" && /^\d{15}$/.test(value) ? value : "";
}

function visibleImei(imei: string | null | undefined, customFields: Prisma.JsonValue | null | undefined) {
  return imei || keptImei(customFields);
}

export function serializeInventoryItem(item: InventoryRecord): InventoryItemResponse {
  return {
    cantidad: item.cantidad ?? 1,
    catalogVisible: item.catalogVisible ?? false,
    catalogIncluded: item.catalogIncluded ?? false,
    id: item.id,
    imei: visibleImei(item.imei, item.customFields),
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition as InventoryItemResponse["condition"],
    grade: item.grade as InventoryItemResponse["grade"],
    entryDate: item.entryDate?.toISOString() ?? null,
    batteryNote: item.batteryNote ?? null,
    batteryHealth: item.batteryHealth,
    cost: item.cost.toNumber(),
    price: item.price?.toNumber() ?? null,
    currency: item.currency ?? null,
    status: item.status as InventoryItemResponse["status"],
    reservedDepositId: item.reservedDepositId ?? null,
    reservedClientId: item.reservedClientId ?? null,
    reservedClientName: item.reservedClientName ?? null,
    reservedAt: item.reservedAt?.toISOString() ?? null,
    categoryId: item.categoryId ?? null,
    customFields: toCustomFields(item.customFields),
    soldAt: item.sales?.[0]?.soldAt?.toISOString() ?? null,
    createdAt: item.createdAt?.toISOString() ?? new Date(0).toISOString(),
    archivedAt: item.archivedAt?.toISOString() ?? null,
    archivedBy: item.archivedBy ?? null,
    archiveReason: item.archiveReason ?? null,
    pendingSaleRegistration: item.pendingSaleRegistration ?? false,
    needsCompletion: item.needsCompletion ?? false,
    priceChangedBy: item.priceChangedBy ?? null,
    priceChangedAt: item.priceChangedAt ? new Date(item.priceChangedAt).toISOString() : null,
    costChangedBy: item.costChangedBy ?? null,
    costChangedAt: item.costChangedAt ? new Date(item.costChangedAt).toISOString() : null,
    supplierId: item.supplierId ?? null,
    supplierName: item.supplier?.name ?? item.supplierName ?? null,
    stockPurchaseId: item.stockPurchaseId ?? null,
    purchasedAt: item.stockPurchase && !item.stockPurchase.deletedAt ? calendarDay(item.stockPurchase.purchasedAt, "America/Argentina/Buenos_Aires") : null,
    purchaseName: item.stockPurchase && !item.stockPurchase.deletedAt ? item.stockPurchase.name : null,
  };
}

// ─── Paged listing ────────────────────────────────────────────────────────────

export interface ListInventoryParams {
  skip: number;
  take: number;
  search?: string;
  categoryId?: string | null;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  condition?: string;
  status?: string;
  capacity?: string;
  model?: string;
  grade?: string;
  battery?: string;
  supplierId?: string;
}

function buildWhereConditions(storeId: string, params: Omit<ListInventoryParams, 'skip' | 'take' | 'sortKey' | 'sortDir'>): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`"storeId" = ${storeId}`, Prisma.sql`"archivedAt" IS NULL`];

  if (params.search) {
    const search = `%${params.search.trim()}%`;
    parts.push(
      Prisma.sql`(
        "imei" ILIKE ${search}
        OR "customFields"->>'keptImei' ILIKE ${search}
        OR "model" ILIKE ${search}
        OR "capacity" ILIKE ${search}
        OR "color" ILIKE ${search}
        OR "batteryHealth" ILIKE ${search}
      )`
    );
  }

  if (params.categoryId !== undefined) {
    if (params.categoryId === null) {
      parts.push(Prisma.sql`"categoryId" IS NULL`);
    } else {
      parts.push(Prisma.sql`"categoryId" = ${params.categoryId}`);
    }
  }

  if (params.supplierId) parts.push(Prisma.sql`"supplierId" = ${params.supplierId}`);
  if (params.condition) parts.push(Prisma.sql`"condition" = ${params.condition}`);
  if (params.status) parts.push(Prisma.sql`"status" = ${params.status}`);
  if (params.capacity) parts.push(Prisma.sql`"capacity" = ${params.capacity}`);
  if (params.model) parts.push(Prisma.sql`"model" = ${params.model}`);
  if (params.grade) parts.push(Prisma.sql`"grade" = ${params.grade}`);

  if (params.battery) {
    const expr = `(CASE WHEN "batteryHealth" ~ '^[0-9]' THEN CAST(SUBSTRING("batteryHealth" FROM '^([0-9]+)') AS INTEGER) ELSE 0 END)`;
    if (params.battery === '100%') {
      parts.push(Prisma.sql`${Prisma.raw(expr)} = 100`);
    } else if (params.battery === '> 90%') {
      parts.push(Prisma.sql`${Prisma.raw(expr)} > 90`);
    } else if (params.battery === '80% - 90%') {
      parts.push(Prisma.sql`${Prisma.raw(expr)} BETWEEN 80 AND 90`);
    } else if (params.battery === '< 80%') {
      parts.push(Prisma.sql`${Prisma.raw(expr)} < 80 AND ${Prisma.raw(expr)} > 0`);
    }
  }

  return Prisma.join(parts, ' AND ');
}

function buildOrderByClause(sortKey?: string, sortDir?: 'asc' | 'desc'): Prisma.Sql {
  const dir = sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  if (sortKey === 'entryDate') return Prisma.sql`"entryDate" ${dir} NULLS LAST`;
  if (sortKey === 'model') return Prisma.sql`LOWER("model") ${dir}`;
  if (sortKey === 'price') return Prisma.sql`"price" ${dir}`;
  if (sortKey === 'battery') {
    const expr = Prisma.raw(`(CASE WHEN "batteryHealth" ~ '^[0-9]' THEN CAST(SUBSTRING("batteryHealth" FROM '^([0-9]+)') AS INTEGER) ELSE 0 END)`);
    return Prisma.sql`${expr} ${dir}`;
  }
  if (sortKey === 'condition') return Prisma.sql`"condition" ${dir}`;
  return Prisma.sql`"createdAt" DESC`;
}

type RawInventoryRow = {
  catalogVisible?: boolean;
  catalogIncluded?: boolean;
  cantidad?: number;
  id: string; imei: string | null; model: string; capacity: string; color: string;
  condition: string; grade: string; batteryHealth: string; cost: unknown; price: unknown;
  currency: string | null;
  reservedDepositId: string | null; reservedClientId: string | null; reservedClientName: string | null; reservedAt: Date | null;
  entryDate?: Date | null; batteryNote?: string | null;
  status: string; categoryId: string | null; customFields: Prisma.JsonValue | null;
  createdAt: Date | string | null;
  archivedAt: Date | string | null;
  pendingSaleRegistration: boolean;
  needsCompletion: boolean;
  priceChangedBy: string | null;
  priceChangedAt: Date | string | null;
  costChangedBy: string | null;
  costChangedAt: Date | string | null;
  supplierId?: string | null;
  stockPurchaseId?: string | null;
  supplierName?: string | null;
  purchasedAt?: string | null;
  purchaseName?: string | null;
};

function deserializeRawRow(row: RawInventoryRow): InventoryItemResponse {
  return {
    cantidad: row.cantidad ?? 1,
    catalogVisible: row.catalogVisible ?? false,
    catalogIncluded: row.catalogIncluded ?? false,
    id: row.id,
    imei: visibleImei(row.imei, row.customFields),
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    condition: row.condition as InventoryItemResponse['condition'],
    grade: row.grade as InventoryItemResponse['grade'],
    entryDate: row.entryDate?.toISOString() ?? null,
    batteryNote: row.batteryNote ?? null,
    batteryHealth: row.batteryHealth,
    cost: Number(row.cost),
    price: row.price == null ? null : Number(row.price),
    currency: row.currency ?? null,
    status: row.status as InventoryItemResponse['status'],
    reservedDepositId: row.reservedDepositId, reservedClientId: row.reservedClientId, reservedClientName: row.reservedClientName, reservedAt: row.reservedAt?.toISOString() ?? null,
    categoryId: row.categoryId ?? null,
    customFields: toCustomFields(row.customFields),
    soldAt: null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date(0).toISOString(),
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    pendingSaleRegistration: row.pendingSaleRegistration,
    needsCompletion: row.needsCompletion,
    priceChangedBy: row.priceChangedBy ?? null,
    priceChangedAt: row.priceChangedAt ? new Date(row.priceChangedAt).toISOString() : null,
    costChangedBy: row.costChangedBy ?? null,
    costChangedAt: row.costChangedAt ? new Date(row.costChangedAt).toISOString() : null,
    supplierId: row.supplierId ?? null,
    supplierName: row.supplierName ?? null,
    stockPurchaseId: row.stockPurchaseId ?? null,
    purchasedAt: row.purchasedAt ?? null,
    purchaseName: row.purchaseName ?? null,
  };
}

export async function listInventoryPaged(
  storeId: string,
  params: ListInventoryParams
): Promise<{ items: InventoryItemResponse[]; total: number }> {
  const where = buildWhereConditions(storeId, params);
  const orderBy = buildOrderByClause(params.sortKey, params.sortDir);

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<RawInventoryRow[]>`
      SELECT "catalogVisible", "quantity" AS "cantidad", "id", "imei", "model", "capacity", "color", "condition", "grade",
             "entryDate", "batteryNote", "batteryHealth", "cost"::float8, "price"::float8, "currency", "status", "reservedDepositId", "reservedClientId", "reservedClientName", "reservedAt", "categoryId", "customFields", "createdAt", "archivedAt", "pendingSaleRegistration", "needsCompletion",
             "priceChangedBy", "priceChangedAt", "costChangedBy", "costChangedAt",
             "supplierId", "stockPurchaseId"
      FROM "InventoryItem"
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${params.take} OFFSET ${params.skip}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "InventoryItem" WHERE ${where}
    `,
  ]);

  const catalog = await prisma.storePublicCatalog.findUnique({ where: { storeId } });
  const supplierIds = [...new Set(rows.map((row) => row.supplierId).filter((id): id is string => Boolean(id)))];
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({ where: { storeId, id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const supplierName = new Map(suppliers.map((row) => [row.id, row.name]));
  const purchaseIds = [...new Set(rows.map(row => row.stockPurchaseId).filter((id): id is string => Boolean(id)))];
  const purchases = purchaseIds.length ? await prisma.stockPurchase.findMany({
    where: { storeId, id: { in: purchaseIds }, deletedAt: null }, select: { id: true, name: true, purchasedAt: true },
  }) : [];
  const purchaseById = new Map(purchases.map(purchase => [purchase.id, purchase]));
  return {
    items: rows.map(row => deserializeRawRow({
      ...row,
      purchasedAt: row.stockPurchaseId && purchaseById.has(row.stockPurchaseId) ? calendarDay(purchaseById.get(row.stockPurchaseId)!.purchasedAt, "America/Argentina/Buenos_Aires") : null,
      purchaseName: row.stockPurchaseId ? purchaseById.get(row.stockPurchaseId)?.name ?? null : null,
      supplierName: row.supplierId ? supplierName.get(row.supplierId) ?? null : null,
      catalogIncluded: inPublicCatalog(row, catalog),
    })),
    total: Number(countResult[0].count),
  };
}

export async function getInventoryFilteredIds(
  storeId: string,
  params: Omit<ListInventoryParams, 'skip' | 'take' | 'sortKey' | 'sortDir'>
): Promise<string[]> {
  const where = buildWhereConditions(storeId, params);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "InventoryItem" WHERE ${where}
  `;
  return rows.map(r => r.id);
}

// ─── Full listing (legacy, used by AppContext) ─────────────────────────────────

export async function listInventory(storeId: string, options?: { archived?: boolean; supplierId?: string }) {
  const inventory = await inventoryPrisma.inventoryItem.findMany({
    where: { storeId, archivedAt: options?.archived ? { not: null } : null, supplierId: options?.supplierId },
    include: {
      sales: {
        select: { soldAt: true },
        orderBy: { soldAt: "desc" },
        take: 1,
      },
      supplier: { select: { name: true } },
      stockPurchase: { select: { name: true, purchasedAt: true, deletedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const catalog = await prisma.storePublicCatalog.findUnique({ where: { storeId } });
  return inventory.map((item: InventoryRecord) => serializeInventoryItem({ ...item, catalogIncluded: inPublicCatalog(item, catalog) }));
}

/** Secondary detail for the equipment modal; list responses keep only cheap purchase metadata. */
export async function getInventoryItem(storeId: string, id: string): Promise<InventoryItemDetailResponse | null> {
  const item = await prisma.inventoryItem.findFirst({
    where: { storeId, id, archivedAt: null },
    include: {
      supplier: { select: { name: true } },
      stockPurchase: { select: { name: true, purchasedAt: true, deletedAt: true } },
      sales: { select: { soldAt: true }, orderBy: { soldAt: "desc" }, take: 1 },
    },
  });
  if (!item) return null;
  const catalog = await prisma.storePublicCatalog.findUnique({ where: { storeId } });
  let purchaseSummary: ProblemSummary | null = null;
  if (item.stockPurchaseId && item.stockPurchase && !item.stockPurchase.deletedAt) {
    const snapshot = await loadProblems(storeId, { stockPurchaseId: item.stockPurchaseId });
    purchaseSummary = summarizeProblems(snapshot.items, snapshot.problems);
  }
  return { ...serializeInventoryItem({ ...item, catalogIncluded: inPublicCatalog(item, catalog) }), purchaseSummary };
}

function storedImei(value: string | null | undefined) {
  const parsed = parseOptionalImei(value);
  if (parsed.ok === false) throw new InventoryError(parsed.message, 400);
  return parsed.imei;
}

function storedGrade(condition: string, grade: string | null | undefined) {
  const parsed = inventoryGrade(condition, grade);
  if (parsed.ok === false) throw new InventoryError(parsed.message, 400);
  return parsed.grade;
}

export async function createInventoryItem(
  storeId: string,
  input: InventoryItemInput,
  actor?: Actor | null,
  options?: { allowRetiredImei?: boolean; source?: "app" | "bulk" | "import" | "system" },
) {
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const imei = storedImei(input.imei);
  if (imei && !options?.allowRetiredImei) {
    const existing = await inventoryPrisma.inventoryItem.findFirst({
      where: { storeId, imei },
      select: { id: true },
    });

    if (existing) {
      const row = await inventoryPrisma.inventoryItem.findFirst({ where: { id: existing.id }, select: { archivedAt: true } });
      if (row?.archivedAt) throw archivedMatch("Este equipo está archivado. ¿Restaurarlo?", existing.id, "inventory");
      throw new InventoryError("Ya existe un equipo con ese IMEI en esta tienda", 409);
    }
  }

  const currency = currencyOnWrite(input.currency, true, await storeCurrency(storeId, prisma));
  const grade = storedGrade(input.condition, input.grade);
  const inventoryItem = await withSerializableRetry(async (tx) => {
    if (imei && options?.allowRetiredImei) {
      const matches = await tx.inventoryItem.findMany({
        where: { storeId, imei },
        select: { id: true, status: true, archivedAt: true, customFields: true, model: true, capacity: true },
      });
      const blocking = matches.find((row) => !row.archivedAt && row.status !== "VENDIDO");
      if (blocking) throw new InventoryError("Ya está en tu stock", 409);
      for (const row of matches) {
        const fields = toCustomFields(row.customFields);
        await tx.inventoryItem.update({
          where: { id: row.id },
          data: {
            imei: null,
            customFields: { ...fields, keptImei: imei } as Prisma.InputJsonValue,
          },
        });
        if (actor) {
          await writeAudit(tx, {
            storeId,
            actor,
            action: "inventory.updated",
            entityType: "inventory",
            entityId: row.id,
            entityLabel: deviceLabel({ model: row.model, capacity: row.capacity, imei }),
            detail: "El IMEI volvió a entrar en stock",
            source: "bulk",
            changes: [{ field: "imei", label: "IMEI", before: imei, after: "Quedó en el historial" }],
          });
        }
      }
    }
    const created = await tx.inventoryItem.create({ data: {
      storeId,
      imei,
      model: input.model.trim(),
      capacity: input.capacity.trim(),
      color: input.color.trim(),
      condition: input.condition,
      grade,
      batteryHealth: input.batteryHealth,
      cantidad: validCantidad(input.cantidad ?? 1, input.imei),
      cost: toDecimal(input.cost),
      price: priceDecimal(input.price),
      currency,
      status: input.cantidad === 0 ? "VENDIDO" : input.status,
      pendingSaleRegistration: input.status === "VENDIDO" && input.cantidad !== 0,
      previousSaleStatus: input.status === "VENDIDO" ? "DISPONIBLE" : null,
      categoryId: input.categoryId ?? null,
      entryDate: entryDateValue(input.entryDate),
      batteryNote: input.batteryNote || null,
      customFields: normalizeCustomFields(await validateFields(storeId, input.customFields, tx)),
    } });
    if (actor) {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "inventory.created",
        entityType: "inventory",
        entityId: created.id,
        entityLabel: deviceLabel(created),
        detail: created.model,
        source: options?.source ?? "app",
      });
    }
    if (created.status === "VENDIDO") {
      await writeOperationNotifications(tx, storeId, [{
        section: "inventory",
        title: "Venta manual por registrar",
        message: `${created.model} fue marcado como vendido. Completá o cancelá el registro de venta.`,
        recordId: created.id,
        kind: "MANUAL_SOLD_PENDING",
      }]);
    }
    if (input.supplierId) await assignItemSupplier(tx, storeId, created.id, input.supplierId, actor, readPurchaseName(input));
    return tx.inventoryItem.findFirstOrThrow({
      where: { id: created.id },
      include: { supplier: { select: { name: true } }, stockPurchase: { select: { name: true, purchasedAt: true, deletedAt: true } } },
    });
  });

  return serializeInventoryItem(inventoryItem);
}

export interface BatchCreateResult {
  created: InventoryItemResponse[];
  errors: { index: number; imei: string; message: string }[];
}

export async function createInventoryBatch(
  storeId: string,
  items: InventoryItemInput[],
  actor?: Actor | null,
): Promise<BatchCreateResult> {
  const created: InventoryItemResponse[] = [];
  const errors: BatchCreateResult["errors"] = [];
  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let imei = "";
    try {
      imei = storedImei(item.imei) ?? "";
    } catch (error) {
      errors.push({ index, imei: item.imei ?? "", message: error instanceof Error ? error.message : "El IMEI tiene 15 dígitos" });
      continue;
    }
    if (imei && !imeiPassesLuhn(imei)) {
      errors.push({ index, imei, message: "El IMEI no pasa el control de dígito" });
      continue;
    }
    if (imei && seen.has(imei)) {
      errors.push({ index, imei, message: "Repetido en esta carga" });
      continue;
    }
    if (imei) seen.add(imei);
    try {
      created.push(await createInventoryItem(storeId, { ...item, imei: imei || null }, actor, { allowRetiredImei: true, source: "bulk" }));
    } catch (error) {
      const message = error instanceof InventoryError || error instanceof DomainError
        ? error.message
        : "No se pudo cargar el equipo";
      errors.push({ index, imei, message });
    }
  }
  return { created, errors };
}

export async function updateInventoryItem(
  storeId: string,
  id: string,
  input: Partial<InventoryItemInput>,
  options?: { actor?: Actor | null; enforcePriceCost?: boolean },
) {
  const updated = await withSerializableRetry(async (tx) => {
    await lockInventory(tx, storeId, id);
    const existing = await tx.inventoryItem.findFirst({
      where: { id, storeId, archivedAt: null },
    });
    if (!existing) return null;
    if (existing.reservedDepositId && input.status !== undefined && input.status !== existing.status) throw new InventoryError("Cancelá la seña para liberar o vender este equipo", 409);

    const priceChanges = input.price !== undefined && moneyChanged(existing.price, input.price);
    const costChanges = input.cost !== undefined && moneyChanged(existing.cost, input.cost);
    if (options?.enforcePriceCost && (priceChanges || costChanges)) {
      throw new InventoryError("No tenés permiso para cambiar precio o costo", 403);
    }

    if (input.categoryId) {
      const category = await tx.inventoryCategory.findFirst({
        where: { id: input.categoryId, storeId },
        select: { id: true },
      });
      if (!category) throw new InventoryError("La categoría no existe en esta tienda", 404);
    }

    const nextImei = input.imei !== undefined ? storedImei(input.imei) : undefined;
    if (nextImei) {
      const duplicate = await tx.inventoryItem.findFirst({
        where: { storeId, imei: nextImei, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        const archived = await tx.inventoryItem.findFirst({ where: { id: duplicate.id }, select: { archivedAt: true } });
        if (archived?.archivedAt) throw archivedMatch("Este equipo está archivado. ¿Restaurarlo?", duplicate.id, "inventory");
        throw new InventoryError("Ya existe un equipo con ese IMEI en esta tienda", 409);
      }
    }

    if (input.status !== undefined) {
      const activeSale = await tx.sale.findFirst({
        where: { storeId, inventoryItemId: id, status: { not: "CANCELADA" }, voidedAt: null },
        select: { id: true },
      });
      if (activeSale && input.status !== existing.status) {
        throw new InventoryError("El estado de un equipo con venta activa se gestiona desde Operaciones", 409);
      }
    }

    const cantidad = validCantidad(input.cantidad ?? existing.cantidad, input.imei === undefined ? existing.imei : input.imei);
    const data: Prisma.InventoryItemUpdateInput = {};
    if (input.cantidad !== undefined) {
      if (existing.reservedDepositId && cantidad !== existing.cantidad) throw new InventoryError("Cancelá la seña antes de cambiar la cantidad", 409);
      data.cantidad = cantidad;
      if (cantidad === 0) data.status = "VENDIDO";
      else if (existing.cantidad === 0 && existing.status === "VENDIDO") data.status = "DISPONIBLE";
    }
    const kept = keptImei(existing.customFields);
    const keepRetiredImei = input.imei !== undefined && !existing.imei && Boolean(nextImei) && nextImei === kept;
    if (input.imei !== undefined && !keepRetiredImei) data.imei = nextImei;
    if (input.model !== undefined) data.model = input.model.trim();
    if (input.capacity !== undefined) data.capacity = input.capacity.trim();
    if (input.color !== undefined) data.color = input.color.trim();
    if (input.condition !== undefined) data.condition = input.condition;
    if (input.grade !== undefined || input.condition !== undefined) {
      const nextCondition = input.condition !== undefined ? input.condition : existing.condition;
      const nextGrade = input.grade !== undefined ? input.grade : existing.grade;
      data.grade = storedGrade(nextCondition, nextGrade);
    }
    if (input.batteryHealth !== undefined) data.batteryHealth = input.batteryHealth;
    const changedAt = new Date();
    if (input.cost !== undefined) data.cost = toDecimal(input.cost);
    if (costChanges && options?.actor) {
      data.costChangedBy = options.actor.name;
      data.costChangedAt = changedAt;
    }
    if (input.price !== undefined) data.price = priceDecimal(input.price);
    const nextCurrency = currencyOnWrite(input.currency, priceChanges || costChanges, priceChanges || costChanges ? await storeCurrency(storeId, tx) : "ARS");
    if (nextCurrency) data.currency = nextCurrency;
    if (priceChanges && options?.actor) {
      data.priceChangedBy = options.actor.name;
      data.priceChangedAt = changedAt;
    }
    if (input.categoryId !== undefined) data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
    if (input.entryDate !== undefined) data.entryDate = entryDateValue(input.entryDate);
    if (input.batteryNote !== undefined) data.batteryNote = input.batteryNote || null;
    if (input.customFields !== undefined) data.customFields = normalizeCustomFields(await validateFields(storeId, input.customFields, tx)) as Prisma.InputJsonValue;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "VENDIDO" && existing.status !== "VENDIDO") {
        data.pendingSaleRegistration = true;
        data.previousSaleStatus = existing.status;
      } else if (input.status !== "VENDIDO") {
        data.pendingSaleRegistration = false;
        data.previousSaleStatus = null;
      }
    }

    if (cantidad === 0) { data.status = "VENDIDO"; data.pendingSaleRegistration = false; }
    else if (input.cantidad !== undefined && existing.cantidad === 0 && input.status === existing.status) data.status = "DISPONIBLE";
    const updated = await tx.inventoryItem.update({ where: { id }, data });
    const label = deviceLabel({ ...existing, ...input, imei: nextImei ?? existing.imei });
    if (options?.actor && priceChanges) {
      await writeAudit(tx, {
        storeId,
        actor: options.actor,
        action: "inventory.price",
        entityType: "inventory",
        entityId: id,
        entityLabel: label,
        detail: `${existing.price?.toString() ?? "A definir"} → ${input.price ?? "A definir"}`,
        changes: diffFields(
          { price: existing.price },
          { price: input.price },
          [{ field: "price", label: "Precio", format: MONEY }],
        ),
      });
    }
    if (options?.actor && costChanges) {
      await writeAudit(tx, {
        storeId,
        actor: options.actor,
        action: "inventory.cost",
        entityType: "inventory",
        entityId: id,
        entityLabel: label,
        detail: `${existing.cost.toString()} → ${input.cost}`,
        changes: diffFields(
          { cost: existing.cost },
          { cost: input.cost },
          [{ field: "cost", label: "Costo", format: MONEY }],
        ),
      });
    }
    if (options?.actor) {
      const changes = diffFields(
        {
          model: existing.model,
          capacity: existing.capacity,
          color: existing.color,
          condition: existing.condition,
          grade: existing.grade,
          batteryHealth: existing.batteryHealth,
          imei: existing.imei,
          status: existing.status,
        },
        {
          model: input.model?.trim() ?? existing.model,
          capacity: input.capacity?.trim() ?? existing.capacity,
          color: input.color?.trim() ?? existing.color,
          condition: input.condition ?? existing.condition,
          grade: input.grade ?? existing.grade,
          batteryHealth: input.batteryHealth ?? existing.batteryHealth,
          imei: nextImei ?? existing.imei,
          status: input.status ?? existing.status,
        },
        [
          { field: "model", label: "Modelo" },
          { field: "capacity", label: "Capacidad" },
          { field: "color", label: "Color" },
          { field: "condition", label: "Condición" },
          { field: "grade", label: "Calidad" },
          { field: "batteryHealth", label: "Batería" },
          { field: "imei", label: "IMEI" },
          { field: "status", label: "Estado" },
        ],
      );
      if (changes.length) {
        const onlyStatus = changes.length === 1 && changes[0]?.field === "status";
        await writeAudit(tx, {
          storeId,
          actor: options.actor,
          action: onlyStatus ? "inventory.status" : "inventory.updated",
          entityType: "inventory",
          entityId: id,
          entityLabel: label,
          changes,
        });
      }
    }
    if (input.status === "VENDIDO" && existing.status !== "VENDIDO") {
      await writeOperationNotifications(tx, storeId, [{
        section: "inventory",
        title: "Venta manual por registrar",
        message: `${updated.model} fue marcado como vendido. Completá o cancelá el registro de venta.`,
        recordId: updated.id,
        kind: "MANUAL_SOLD_PENDING",
      }]);
    }
    if (input.supplierId !== undefined) {
      await assignItemSupplier(tx, storeId, id, input.supplierId || null, options?.actor);
    }
    return tx.inventoryItem.findFirstOrThrow({
      where: { id },
      include: { supplier: { select: { name: true } }, stockPurchase: { select: { name: true, purchasedAt: true, deletedAt: true } } },
    });
  });

  if (!updated) return null;
  const catalog = updated.catalogVisible ? await prisma.storePublicCatalog.findUnique({ where: { storeId } }) : null;
  return serializeInventoryItem({ ...updated, catalogIncluded: inPublicCatalog(updated, catalog) });
}

/** Caller owns the transaction. Lock all items in a stable order before checking associations. */
export async function archiveInventoryItems(tx: Prisma.TransactionClient, storeId: string, ids: string[], actor?: Actor | null, meta?: ArchiveMeta) {
  const ordered = [...new Set(ids)].sort();
  if (!ordered.length) return 0;
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryItem" WHERE "storeId" = ${storeId} AND "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE`);
  const items = await tx.inventoryItem.findMany({ where: { storeId, id: { in: ordered }, archivedAt: null } });
  const activeIds = items.map(item => item.id);
  if (!activeIds.length) return 0;
  const [sales, trades] = await Promise.all([
    tx.sale.findMany({ where: { storeId, inventoryItemId: { in: activeIds }, integratedOperation: true, status: { not: "CANCELADA" }, voidedAt: null }, select: { inventoryItemId: true } }),
    tx.tradeIn.findMany({ where: { storeId, receivedInventoryItemId: { in: activeIds }, confirmationStatus: "CONFIRMED", voidedAt: null }, select: { receivedInventoryItemId: true } }),
  ]);
  if (sales.length || trades.length) throw new InventoryError("El equipo pertenece a una operación activa", 409);
  if (items.some(item => item.reservedDepositId)) throw new InventoryError("Cancelá la seña antes de archivar el equipo reservado", 409);
  const reason = cleanReason(meta?.reason);
  await tx.inventoryItem.updateMany({ where: { storeId, id: { in: activeIds }, archivedAt: null }, data: { archivedAt: new Date(), archivedBy: actor?.name ?? null, archiveReason: reason } });
  if (actor || meta?.source === "system") {
    for (const item of items) {
      await writeAudit(tx, {
        storeId, actor, action: "inventory.archived", entityType: "inventory", entityId: item.id,
        entityLabel: deviceLabel(item), detail: item.model, reason, source: meta?.source ?? "app",
        changes: [{ field: "status", label: "Estado", before: "Activo", after: "Archivado" }, ...batchChanges(meta)],
      });
    }
  }
  return items.length;
}

export async function deleteInventoryItem(storeId: string, id: string, actor?: Actor | null, meta?: ArchiveMeta) {
  return withSerializableRetry(async tx => (await archiveInventoryItems(tx, storeId, [id], actor, meta)) > 0);
}

export async function restoreInventoryItem(storeId: string, id: string, actor?: Actor | null, meta?: ArchiveMeta) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({ where: { id, storeId } });
  if (!existing || !existing.archivedAt) return null;
  if (existing.imei) {
    const clash = await inventoryPrisma.inventoryItem.findFirst({
      where: { storeId, imei: existing.imei, archivedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new InventoryError("Ya hay un equipo activo con ese IMEI", 409);
  }
  const restored = await inventoryPrisma.inventoryItem.update({
    where: { id },
    data: { archivedAt: null, archivedBy: null, archiveReason: null },
    include: { supplier: { select: { name: true } }, stockPurchase: { select: { name: true, purchasedAt: true, deletedAt: true } } },
  });
  await writeAudit(prisma, {
    storeId,
    actor,
    action: "inventory.restored",
    entityType: "inventory",
    entityId: id,
    entityLabel: deviceLabel(existing),
    source: meta?.source ?? (actor ? "app" : "system"),
    changes: [{ field: "status", label: "Estado", before: "Archivado", after: "Activo" }],
  });
  const catalog = restored.catalogVisible ? await prisma.storePublicCatalog.findUnique({ where: { storeId } }) : null;
  return serializeInventoryItem({ ...restored, catalogIncluded: inPublicCatalog(restored, catalog) });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(storeId: string): Promise<InventoryCategoryResponse[]> {
  const cats = await inventoryPrisma.inventoryCategory.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, archivedAt: true },
  });
  return cats.map((cat: { id: string; name: string; archivedAt?: Date | null }) => ({
    id: cat.id,
    name: cat.archivedAt ? `${cat.name} (archivada)` : cat.name,
    archived: Boolean(cat.archivedAt),
  }));
}

export async function createCategory(storeId: string, name: string): Promise<InventoryCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new InventoryError("Escribí el nombre de la categoría", 400);
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing?.archivedAt) {
    return inventoryPrisma.inventoryCategory.update({
      where: { id: existing.id },
      data: { archivedAt: null },
      select: { id: true, name: true },
    });
  }
  if (existing) throw new InventoryError("Ya existe una categoría con ese nombre", 409);
  const count = await inventoryPrisma.inventoryCategory.count({ where: { storeId } });
  const cat = await inventoryPrisma.inventoryCategory.create({ data: { storeId, name: trimmed, sortOrder: count }, select: { id: true, name: true } });
  return cat;
}

export async function reorderCategories(storeId: string, orderedIds: string[]): Promise<void> {
  await inventoryPrisma.$transaction(
    orderedIds.map((id, idx) =>
      inventoryPrisma.inventoryCategory.updateMany({ where: { id, storeId }, data: { sortOrder: idx } })
    )
  );
}

export async function renameCategory(storeId: string, id: string, name: string): Promise<InventoryCategoryResponse | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new InventoryError("Escribí el nombre de la categoría", 400);
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { id, storeId } });
  if (!existing) return null;
  const updated = await inventoryPrisma.inventoryCategory.update({ where: { id }, data: { name: trimmed }, select: { id: true, name: true } });
  return updated;
}

export async function deleteCategory(storeId: string, id: string, actor?: Actor | null): Promise<boolean> {
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { id, storeId } });
  if (!existing || existing.archivedAt) return false;
  await inventoryPrisma.inventoryCategory.update({ where: { id }, data: { archivedAt: new Date() } });
  if (actor) {
    await writeAudit(prisma, {
      storeId,
      actor,
      action: "category.archived",
      entityType: "category",
      entityId: id,
      entityLabel: existing.name,
      detail: "Inventario",
    });
  }
  return true;
}

export async function bulkMoveCategory(storeId: string, ids: string[], categoryId: string | null): Promise<number> {
  if (categoryId !== null) {
    const cat = await inventoryPrisma.inventoryCategory.findFirst({ where: { id: categoryId, storeId } });
    if (!cat) throw new InventoryError("La categoría no existe en esta tienda", 404);
  }
  const result = await inventoryPrisma.inventoryItem.updateMany({
    where: { id: { in: ids }, storeId },
    data: { categoryId },
  });
  return result.count;
}

export function validCantidad(value: number, imei?: string | null): number {
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) throw new InventoryError("La cantidad debe ser un entero entre 0 y 2147483647", 400);
  if (imei?.trim() && value > 1) throw new InventoryError("Los equipos con IMEI solo pueden tener cantidad 1", 400);
  return value;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportRow {
  quantity?: number;
  sourceRow?: number;
  entryDate?: string | null;
  batteryNote?: string | null;
  supplierName?: string;
  purchasedAt?: string;
  purchaseName?: string;
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  cost?: number | string;
  price?: number | string | null;
  currency?: string;
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  diagnostics?: ImportDiagnostics;
  warnings?: { row: number; message: string }[];
  imported: number;
  updated: number;
  errors: { row: number; imei: string; message: string }[];
  priceToDefine: number;
  withoutImei?: number;
}

export async function importInventoryItems(
  storeId: string,
  rows: ImportRow[],
  options?: { actor?: Actor | null; lockPrice?: boolean; supplierId?: string | null; purchaseName?: string | null; name?: string | null; definitions?: DefinitionInput[] },
  transaction?: Prisma.TransactionClient,
): Promise<ImportResult> {
  if (!transaction) {
    return prisma.$transaction(async tx => {
      await ensureDefinitions(storeId, options?.definitions ?? [], tx);
      return importInventoryItems(storeId, rows, options, tx);
    }, { timeout: 120_000 });
  }
  const db = transaction;
  const definitions = rows.some(row => row.customFields && Object.keys(row.customFields).length) ? await listDefinitions(storeId, db) : [];
  const purchaseName = readPurchaseName(options ?? {});
  const result: ImportResult = { imported: 0, updated: 0, errors: [], priceToDefine: 0 };
  const collector = importErrorCollector(result.errors);
  const seenImeis = new Map<string, number>();
  const importedCurrency = await storeCurrency(storeId, db);
  const defaultPurchasedAt = new Date();
  const purchases = new Map<string, { name: string | null; purchasedAt: Date; ids: string[] }>();
  const batchSize = 500;
  const equipmentCount = rows.reduce((sum, row) => sum + Number(row.quantity ?? 1), 0);
  if (!Number.isSafeInteger(equipmentCount) || equipmentCount > MAX_INVENTORY_IMPORT_ITEMS) {
    throw new InventoryError(`El archivo supera los ${MAX_INVENTORY_IMPORT_ITEMS} equipos. Dividilo en partes.`, 400);
  }
  const batchCreates = rows.length > batchSize;
  let acceptedRows = 0;
  let pending: Prisma.InventoryItemCreateManyInput[] = [];
  let pendingSourceRow = 1;
  const flushCreates = async () => {
    if (!pending.length) return;
    try { await db.inventoryItem.createMany({ data: pending }); }
    catch { throw new InventoryError(`No se importó ningún equipo. Fila ${pendingSourceRow}: No se pudo guardar el archivo completo. Volvé a intentarlo.`, 409); }
    pending = [];
  };
  const supplierPurchases = new Map<string, { supplierId: string; name: string | null; purchasedAt: Date; ids: string[] }>();
  if (options?.supplierId) {
    const supplier = await db.supplier.findFirst({
      where: { id: options.supplierId, storeId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new InventoryError("Ese proveedor no está en esta tienda", 404);
  }

  for (let i = 0; i < rows.length; i++) {
    const source = rows[i];
    validCantidad(Number(String(source.quantity ?? '').trim() === '' ? 1 : source.quantity ?? 1), source.imei);
    if (!Object.entries(source).some(([key, value]) => key !== 'sourceRow' && (key === 'customFields'
      ? Object.values(value ?? {}).some(cell => cell != null && String(cell).trim())
      : value != null && String(value).trim()))) { collector.reject({ row: source.sourceRow ?? i + 1, imei: '', message: 'Fila vacía' }, 'empty'); continue; }
    const prepared = prepareInventoryImportRow(Object.fromEntries(Object.entries(source)
      .filter(([key, value]) => !['customFields', 'sourceRow'].includes(key) && value != null).map(([key, value]) => [key, String(value)])), source.sourceRow ?? i + 1, seenImeis);
    const raw: ImportRow = { ...source, ...prepared, quantity: Number(prepared.quantity || 1), currency: prepared.currency || undefined };
    const quantity = validCantidad(Number(prepared.quantity || 1), source.imei);

    if (typeof raw.price === 'string' && !raw.price.trim()) raw.price = null;
    const rowNum = raw.sourceRow ?? i + 1;
    let rowCurrency: string = raw.currency ?? importedCurrency;
    const validated = validateInventoryImportRow({ ...raw, batteryNote: undefined }, rowNum, new Map());
    if (source.batteryHealth && !prepared.batteryHealth) (result.warnings ??= []).push({ row: rowNum, message: 'Batería no se pudo leer: se importó sin batería' });
    if (validated.warnings.length) (result.warnings ??= []).push(...validated.warnings);
    if (!validated.ok) {
      throw new InventoryError(`No se importó ningún equipo. Fila ${rowNum}: ${validated.message}`, 400);
    }
    const { condition, grade, imei, color, entryDate, batteryHealth } = validated.value;
    const purchasedAt = raw.purchasedAt?.trim() ? parseArDate(raw.purchasedAt)! : defaultPurchasedAt;
    const rowPurchaseName = raw.purchaseName === undefined ? purchaseName : readPurchaseName(raw);
    const purchaseKey = JSON.stringify([purchasedAt.toISOString().slice(0, 10), rowPurchaseName]);
    const normalizedStatus = normalizeInventoryImportStatus(raw.status);
    if (prepared.originalStatus) raw.customFields = { ...raw.customFields, originalStatus: prepared.originalStatus };
    if (normalizedStatus.originalStatus) raw.customFields = { ...raw.customFields, originalStatus: normalizedStatus.originalStatus };

    const providedCost = raw.cost == null || !String(raw.cost).trim() || !Number.isFinite(Number(raw.cost)) ? undefined : Number(raw.cost);
    const customFields: Record<string, unknown> = { ...raw.customFields };
    for (const [key, value] of Object.entries(customFields)) {
      try { Object.assign(customFields, convertFields({ [key]: value }, definitions)); }
      catch {
        raw.batteryNote = [raw.batteryNote, `${key} (origen): ${typeof value === 'string' ? value : JSON.stringify(value)}`].filter(Boolean).join('\n');
        delete customFields[key];
        normalizedStatus.status = 'EN_REVISION';
        raw.status = 'EN_REVISION';
      }
    }
    const input = {
      imei,
      model: raw.model.trim(),
      capacity: raw.capacity?.trim() || "",
      color,
      condition,
      grade,
      batteryHealth,
      cost: providedCost ?? 0,
      price: raw.price == null ? null : Number(raw.price),
      status: normalizedStatus.status,
    };

    try {
      let rowSupplierId = options?.supplierId;
      if (!rowSupplierId && raw.supplierName?.trim()) {
        const name = raw.supplierName.trim();
        const supplier = await db.supplier.findFirst({ where: { storeId, deletedAt: null, name: { equals: name, mode: 'insensitive' } } });
        rowSupplierId = supplier?.id ?? (await db.supplier.create({ data: { storeId, name } })).id;
      }
      const existing = input.imei
        ? await db.inventoryItem.findFirst({
          where: { storeId, imei: input.imei },
          select: { id: true, customFields: true, price: true, cost: true, currency: true, condition: true, grade: true },
        })
        : null;

      if (existing) {
        const existingCurrency = existing.currency ?? importedCurrency;
        rowCurrency = raw.currency ?? existingCurrency;
        const updatedGrade = inventoryGrade(raw.condition !== undefined ? input.condition : existing.condition, raw.grade ?? existing.grade);
        if (updatedGrade.ok === false) {
          throw new InventoryError(updatedGrade.message, 400);
        }
        if (options?.lockPrice && raw.currency !== undefined && existingCurrency !== rowCurrency) {
          throw new InventoryError("No tenés permiso para cambiar la moneda de este equipo", 403);
        }
        const mergedFields = {
          ...(toCustomFields(existing.customFields ?? null)),
          ...customFields,
        };
        const priceChanges = moneyChanged(existing.price, input.price) || (raw.currency !== undefined && existingCurrency !== rowCurrency);
        const applyPrice = raw.price != null && !(options?.lockPrice && priceChanges);
        const costChanges = providedCost !== undefined && (moneyChanged(existing.cost, providedCost) || (raw.currency !== undefined && existingCurrency !== rowCurrency));
        const changedAt = new Date();
        await db.inventoryItem.update({
          where: { id: existing.id, AND: [{ reservedDepositId: null }] },
          data: {
            model: input.model,
            ...(raw.capacity !== undefined ? { capacity: input.capacity } : {}),
            ...(raw.color !== undefined ? { color: input.color } : {}),
            ...(raw.condition !== undefined ? { condition: input.condition } : {}),
            ...(raw.grade !== undefined || raw.condition !== undefined ? { grade: updatedGrade.grade } : {}),
            ...(raw.batteryHealth !== undefined ? { batteryHealth: input.batteryHealth } : {}),
            ...(providedCost !== undefined ? { cost: toDecimal(providedCost) } : {}),
            ...(costChanges && options?.actor ? { costChangedBy: options.actor.name, costChangedAt: changedAt } : {}),
            ...(applyPrice ? { price: priceDecimal(input.price) } : {}),
            ...((applyPrice && priceChanges) || costChanges ? { currency: rowCurrency } : {}),
            ...(applyPrice && priceChanges && options?.actor ? { priceChangedBy: options.actor.name, priceChangedAt: changedAt } : {}),
            ...(raw.status !== undefined ? { status: input.status } : {}),
            ...(raw.entryDate !== undefined ? { entryDate } : {}),
            ...(raw.batteryNote !== undefined ? { batteryNote: raw.batteryNote || null } : {}),
            customFields: mergedFields as Prisma.InputJsonValue,
          },
        });
        if (options?.actor && applyPrice && priceChanges) {
          await writeAudit(db, {
            storeId,
            actor: options.actor,
            action: "inventory.price",
            entityType: "inventory",
            entityId: existing.id,
            detail: `${existing.price?.toString() ?? "A definir"} → ${input.price ?? "A definir"}`,
          });
        }
        if (options?.actor && costChanges && providedCost !== undefined) {
          await writeAudit(db, {
            storeId,
            actor: options.actor,
            action: "inventory.cost",
            entityType: "inventory",
            entityId: existing.id,
            detail: `${existing.cost.toString()} → ${providedCost}`,
          });
        }
        if (rowSupplierId && !options?.supplierId) await assignItemSupplier(db, storeId, existing.id, rowSupplierId, options?.actor);
        if (existing.price == null && !applyPrice) result.priceToDefine++;
        result.updated++;
      } else {
        const data = {
          storeId,
          imei: input.imei,
          model: input.model,
          capacity: input.capacity,
          color: input.color,
          condition: input.condition,
          grade: input.grade,
          batteryHealth: input.batteryHealth,
          cantidad: quantity,
          cost: toDecimal(input.cost),
          price: priceDecimal(input.price),
          currency: rowCurrency,
          status: input.status,
          entryDate,
          batteryNote: raw.batteryNote || null,
          customFields: customFields as Prisma.InputJsonValue,
        };
        if (batchCreates) {
          const id = randomUUID();
          pendingSourceRow = rowNum;
          pending.push({ ...data, id });
          if (rowSupplierId) {
            const key = JSON.stringify([rowSupplierId, purchaseKey]);
            const group = supplierPurchases.get(key) ?? { supplierId: rowSupplierId, name: rowPurchaseName, purchasedAt, ids: [] };
            group.ids.push(id);
            supplierPurchases.set(key, group);
          }
          if (pending.length >= batchSize) await flushCreates();
        } else {
          const created = await db.inventoryItem.create({ data });
          if (rowSupplierId && !options?.supplierId) await assignItemSupplier(db, storeId, created.id, rowSupplierId, options?.actor);
          const group = purchases.get(purchaseKey) ?? { name: rowPurchaseName, purchasedAt, ids: [] };
          group.ids.push(created.id);
          purchases.set(purchaseKey, group);
        }
        if (input.price == null) result.priceToDefine++;
        result.imported++;
      }
      acceptedRows++;
      if (!input.imei) result.withoutImei = (result.withoutImei ?? 0) + 1;
    } catch (error) {
      throw new InventoryError(`No se importó ningún equipo. Fila ${rowNum}: ${error instanceof DomainError ? error.message : 'No se pudo guardar el archivo completo. Volvé a intentarlo.'}`, error instanceof DomainError ? error.statusCode : 409);
    }
  }

  await flushCreates();
  for (const group of supplierPurchases.values()) {
    await attachItemsToPurchase(storeId, group.supplierId, group.ids, options?.actor, group.name, group.purchasedAt, transaction);
  }
  if (options?.supplierId) {
    for (const group of purchases.values()) {
      await attachItemsToPurchase(storeId, options.supplierId, group.ids, options.actor, group.name, group.purchasedAt, transaction);
    }
  }
  return { ...result, diagnostics: { ...collector.finish(rows.length, acceptedRows), ...(result.warnings ? { warnings: result.warnings } : {}) } };
}

