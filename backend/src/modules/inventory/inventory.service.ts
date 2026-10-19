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
import { inventoryGrade } from "./quality.js";

export interface InventoryItemInput {
  imei?: string | null;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  batteryHealth: string;
  cost: number;
  price: number;
  currency?: string | null;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
  supplierId?: string | null;
}

export interface InventoryItemResponse {
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
  batteryHealth: string;
  cost: number;
  price: number;
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
}

export interface InventoryCategoryResponse {
  id: string;
  name: string;
  archived?: boolean;
}

type InventoryRecord = {
  catalogVisible?: boolean;
  catalogIncluded?: boolean;
  quantity?: number;
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
  batteryHealth: string;
  categoryId: string | null;
  cost: Decimal;
  price: Decimal;
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
  supplier?: { name: string } | null;
  supplierName?: string | null;
};

class InventoryError extends DomainError {}

const inventoryPrisma = prisma as any;

const toDecimal = (value: number) => new Decimal(value);

async function assertCategoryBelongsToStore(storeId: string, categoryId?: string | null) {
  if (categoryId === undefined || categoryId === null) {
    return;
  }

  const category = await inventoryPrisma.inventoryCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  if (!category) {
    throw new InventoryError("Category not found", 404);
  }
}

const toCustomFields = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

function inPublicCatalog(item: { catalogVisible?: boolean; quantity?: number; status: string; batteryHealth: string; archivedAt?: Date | string | null; needsCompletion?: boolean }, catalog: StorePublicCatalog | null) {
  return Boolean(catalog?.active && item.catalogVisible && !ruleReason({ ...item, quantity: item.quantity ?? 1, archivedAt: item.archivedAt ? new Date(item.archivedAt) : null }, catalog));
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
    catalogVisible: item.catalogVisible ?? false,
    catalogIncluded: item.catalogIncluded ?? false,
    id: item.id,
    imei: visibleImei(item.imei, item.customFields),
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition as InventoryItemResponse["condition"],
    grade: item.grade as InventoryItemResponse["grade"],
    batteryHealth: item.batteryHealth,
    cost: item.cost.toNumber(),
    price: item.price.toNumber(),
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
  quantity?: number;
  id: string; imei: string | null; model: string; capacity: string; color: string;
  condition: string; grade: string; batteryHealth: string; cost: unknown; price: unknown;
  currency: string | null;
  reservedDepositId: string | null; reservedClientId: string | null; reservedClientName: string | null; reservedAt: Date | null;
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
};

function deserializeRawRow(row: RawInventoryRow): InventoryItemResponse {
  return {
    catalogVisible: row.catalogVisible ?? false,
    catalogIncluded: row.catalogIncluded ?? false,
    id: row.id,
    imei: visibleImei(row.imei, row.customFields),
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    condition: row.condition as InventoryItemResponse['condition'],
    grade: row.grade as InventoryItemResponse['grade'],
    batteryHealth: row.batteryHealth,
    cost: Number(row.cost),
    price: Number(row.price),
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
      SELECT "catalogVisible", "quantity", "id", "imei", "model", "capacity", "color", "condition", "grade",
             "batteryHealth", "cost"::float8, "price"::float8, "currency", "status", "reservedDepositId", "reservedClientId", "reservedClientName", "reservedAt", "categoryId", "customFields", "createdAt", "archivedAt", "pendingSaleRegistration", "needsCompletion",
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
    ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const supplierName = new Map(suppliers.map((row) => [row.id, row.name]));
  return {
    items: rows.map(row => deserializeRawRow({
      ...row,
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

export async function listInventory(storeId: string, options?: { archived?: boolean }) {
  const inventory = await inventoryPrisma.inventoryItem.findMany({
    where: { storeId, archivedAt: options?.archived ? { not: null } : null },
    include: {
      sales: {
        select: { soldAt: true },
        orderBy: { soldAt: "desc" },
        take: 1,
      },
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const catalog = await prisma.storePublicCatalog.findUnique({ where: { storeId } });
  return inventory.map((item: InventoryRecord) => serializeInventoryItem({ ...item, catalogIncluded: inPublicCatalog(item, catalog) }));
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
      throw new InventoryError("Inventory item already exists", 409);
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
      cost: toDecimal(input.cost),
      price: toDecimal(input.price),
      currency,
      status: input.status,
      pendingSaleRegistration: input.status === "VENDIDO",
      previousSaleStatus: input.status === "VENDIDO" ? "DISPONIBLE" : null,
      categoryId: input.categoryId ?? null,
      customFields: normalizeCustomFields(input.customFields),
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
    if (input.supplierId) await assignItemSupplier(tx, storeId, created.id, input.supplierId, actor);
    return tx.inventoryItem.findFirstOrThrow({
      where: { id: created.id },
      include: { supplier: { select: { name: true } } },
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
      if (!category) throw new InventoryError("Category not found", 404);
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
        throw new InventoryError("Inventory item already exists", 409);
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

    const data: Prisma.InventoryItemUpdateInput = {};
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
    if (input.price !== undefined) data.price = toDecimal(input.price);
    const nextCurrency = currencyOnWrite(input.currency, priceChanges || costChanges, priceChanges || costChanges ? await storeCurrency(storeId, tx) : "ARS");
    if (nextCurrency) data.currency = nextCurrency;
    if (priceChanges && options?.actor) {
      data.priceChangedBy = options.actor.name;
      data.priceChangedAt = changedAt;
    }
    if (input.categoryId !== undefined) data.category = input.categoryId
      ? { connect: { id: input.categoryId } }
      : { disconnect: true };
    if (input.customFields !== undefined) data.customFields = normalizeCustomFields(input.customFields) as Prisma.InputJsonValue;

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
        detail: `${existing.price.toString()} → ${input.price}`,
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
      include: { supplier: { select: { name: true } } },
    });
  });

  if (!updated) return null;
  const catalog = updated.catalogVisible ? await prisma.storePublicCatalog.findUnique({ where: { storeId } }) : null;
  return serializeInventoryItem({ ...updated, catalogIncluded: inPublicCatalog(updated, catalog) });
}

export async function deleteInventoryItem(storeId: string, id: string, actor?: Actor | null, meta?: ArchiveMeta) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
  });

  if (!existing || existing.archivedAt) {
    return false;
  }

  const linkedSale = await inventoryPrisma.sale.findFirst({ where: { storeId, inventoryItemId: id, integratedOperation: true, status: { not: "CANCELADA" }, voidedAt: null }, select: { id: true } });
  const activeReceivedTrade = await inventoryPrisma.tradeIn.findFirst({ where: { storeId, receivedInventoryItemId: id, confirmationStatus: "CONFIRMED", voidedAt: null }, select: { id: true } });
  if (linkedSale || activeReceivedTrade) throw new InventoryError("El equipo pertenece a una operación activa", 409);

  await withSerializableRetry(async (tx) => {
    await lockInventory(tx, storeId, id);
    const reserved = await tx.inventoryItem.findFirst({ where: { id, storeId, reservedDepositId: { not: null } } });
    if (reserved) throw new InventoryError("Cancelá la seña antes de archivar el equipo reservado", 409);
    const reason = cleanReason(meta?.reason);
    await tx.inventoryItem.update({
      where: { id },
      data: { archivedAt: new Date(), archivedBy: actor?.name ?? null, archiveReason: reason },
    });
    if (actor || meta?.source === "system") {
      await writeAudit(tx, {
        storeId,
        actor,
        action: "inventory.archived",
        entityType: "inventory",
        entityId: id,
        entityLabel: deviceLabel(existing),
        detail: existing.model,
        reason,
        source: meta?.source ?? "app",
        changes: [
          { field: "status", label: "Estado", before: "Activo", after: "Archivado" },
          ...batchChanges(meta),
        ],
      });
    }
  });

  return true;
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
  if (!trimmed) throw new InventoryError("Category name required", 400);
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { storeId, name: trimmed } });
  if (existing?.archivedAt) {
    return inventoryPrisma.inventoryCategory.update({
      where: { id: existing.id },
      data: { archivedAt: null },
      select: { id: true, name: true },
    });
  }
  if (existing) throw new InventoryError("Category already exists", 409);
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
  if (!trimmed) throw new InventoryError("Category name required", 400);
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
    if (!cat) throw new InventoryError("Category not found", 404);
  }
  const result = await inventoryPrisma.inventoryItem.updateMany({
    where: { id: { in: ids }, storeId },
    data: { categoryId },
  });
  return result.count;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportRow {
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  cost?: number;
  price: number;
  currency?: "ARS" | "USD";
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: { row: number; imei: string; message: string }[];
}

const CONDITION_MAP: Record<string, string> = {
  nuevo: "NUEVO",
  new: "NUEVO",
  usado: "USADO",
  used: "USADO",
  outlet: "OUTLET",
  "pre-owned": "PRE-OWNED",
  preowned: "PRE-OWNED",
  "pre owned": "PRE-OWNED",
};

const STATUS_MAP: Record<string, string> = {
  disponible: "DISPONIBLE",
  available: "DISPONIBLE",
  vendido: "VENDIDO",
  sold: "VENDIDO",
  "en revision": "EN_REVISION",
  en_revision: "EN_REVISION",
  review: "EN_REVISION",
  reservado: "RESERVADO",
  reserved: "RESERVADO",
};

function foldKey(value: string) {
  return value.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function lookupEnum(value: string | undefined, map: Record<string, string>) {
  if (!value?.trim()) return undefined;
  return map[foldKey(value)];
}

function normalizeBattery(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '100';
  const s = String(raw).trim();
  if (s.includes('-') || s.includes('%')) return s;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n <= 1) return String(Math.round(n * 100));
  return s;
}

export async function importInventoryItems(
  storeId: string,
  rows: ImportRow[],
  options?: { actor?: Actor | null; lockPrice?: boolean; supplierId?: string | null },
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, errors: [] };
  const importedCurrency = await storeCurrency(storeId, inventoryPrisma);
  const createdIds: string[] = [];
  if (options?.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: options.supplierId, storeId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new InventoryError("Ese proveedor no está en esta tienda", 404);
  }

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;
    const rowCurrency = raw.currency ?? importedCurrency;

    if (!raw.model?.trim()) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Modelo vacío" });
      continue;
    }
    if (raw.price == null || isNaN(raw.price)) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Precio inválido" });
      continue;
    }

    const condition = raw.condition?.trim()
      ? lookupEnum(raw.condition, CONDITION_MAP)
      : "USADO";
    if (!condition) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: `Condición «${raw.condition}» no existe` });
      continue;
    }
    const status = raw.status?.trim()
      ? lookupEnum(raw.status, STATUS_MAP)
      : "DISPONIBLE";
    if (!status) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: `Estado «${raw.status}» no existe` });
      continue;
    }

    const parsedImei = parseOptionalImei(raw.imei);
    if (parsedImei.ok === false) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: parsedImei.message });
      continue;
    }
    const providedCost = raw.cost == null || !Number.isFinite(Number(raw.cost)) ? undefined : Number(raw.cost);
    const parsedGrade = inventoryGrade(condition, raw.grade);
    if (parsedGrade.ok === false) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: parsedGrade.message });
      continue;
    }
    const color = raw.color?.trim() || "";
    if (color.length > 50) {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "El color puede tener hasta 50 caracteres" });
      continue;
    }
    const input = {
      imei: parsedImei.imei,
      model: raw.model.trim(),
      capacity: raw.capacity?.trim() || "",
      color,
      condition,
      grade: parsedGrade.grade,
      batteryHealth: normalizeBattery(raw.batteryHealth),
      cost: providedCost ?? 0,
      price: Number(raw.price),
      status,
    };

    try {
      const existing = input.imei
        ? await inventoryPrisma.inventoryItem.findFirst({
          where: { storeId, imei: input.imei },
          select: { id: true, customFields: true, price: true, cost: true, currency: true },
        })
        : null;

      if (existing) {
        const existingCurrency = existing.currency ?? importedCurrency;
        if (options?.lockPrice && raw.currency !== undefined && existingCurrency !== rowCurrency) {
          result.errors.push({ row: rowNum, imei: raw.imei, message: "No tenés permiso para cambiar la moneda de este equipo" });
          continue;
        }
        const mergedFields = {
          ...(toCustomFields(existing.customFields ?? null)),
          ...(raw.customFields ?? {}),
        };
        const priceChanges = moneyChanged(existing.price, input.price) || (raw.currency !== undefined && existingCurrency !== rowCurrency);
        const applyPrice = !(options?.lockPrice && priceChanges);
        const costChanges = providedCost !== undefined && (moneyChanged(existing.cost, providedCost) || (raw.currency !== undefined && existingCurrency !== rowCurrency));
        const changedAt = new Date();
        await prisma.inventoryItem.update({
          where: { id: existing.id, AND: [{ reservedDepositId: null }] },
          data: {
            model: input.model,
            capacity: input.capacity,
            color: input.color,
            condition: input.condition,
            grade: input.grade,
            batteryHealth: input.batteryHealth,
            ...(providedCost !== undefined ? { cost: toDecimal(providedCost) } : {}),
            ...(costChanges && options?.actor ? { costChangedBy: options.actor.name, costChangedAt: changedAt } : {}),
            ...(applyPrice ? { price: toDecimal(input.price) } : {}),
            ...((applyPrice && priceChanges) || costChanges ? { currency: rowCurrency } : {}),
            ...(applyPrice && priceChanges && options?.actor ? { priceChangedBy: options.actor.name, priceChangedAt: changedAt } : {}),
            status: input.status,
            customFields: mergedFields as Prisma.InputJsonValue,
          },
        });
        if (options?.actor && applyPrice && priceChanges) {
          await writeAudit(prisma, {
            storeId,
            actor: options.actor,
            action: "inventory.price",
            entityType: "inventory",
            entityId: existing.id,
            detail: `${existing.price.toString()} → ${input.price}`,
          });
        }
        if (options?.actor && costChanges && providedCost !== undefined) {
          await writeAudit(prisma, {
            storeId,
            actor: options.actor,
            action: "inventory.cost",
            entityType: "inventory",
            entityId: existing.id,
            detail: `${existing.cost.toString()} → ${providedCost}`,
          });
        }
        result.updated++;
      } else {
        const created = await inventoryPrisma.inventoryItem.create({
          data: {
            storeId,
            imei: input.imei,
            model: input.model,
            capacity: input.capacity,
            color: input.color,
            condition: input.condition,
            grade: input.grade,
            batteryHealth: input.batteryHealth,
            cost: toDecimal(input.cost),
            price: toDecimal(input.price),
            currency: rowCurrency,
            status: input.status,
            customFields: raw.customFields ?? {},
          },
        });
        createdIds.push(created.id);
        result.imported++;
      }
    } catch {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Error al guardar" });
    }
  }

  if (options?.supplierId && createdIds.length) {
    await attachItemsToPurchase(storeId, options.supplierId, createdIds, options.actor);
  }
  return result;
}

