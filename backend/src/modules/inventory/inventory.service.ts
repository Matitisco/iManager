import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";

export interface InventoryItemInput {
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  batteryHealth: string;
  cost: number;
  price: number;
  status: string;
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface InventoryItemResponse {
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
  status: string;
  categoryId: string | null;
  customFields: Record<string, unknown>;
  soldAt: string | null;
  createdAt: string;
  archivedAt?: string | null;
  pendingSaleRegistration?: boolean;
}

export interface InventoryCategoryResponse {
  id: string;
  name: string;
}

type InventoryRecord = {
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
  status: string;
  customFields: Prisma.JsonValue | null;
  sales?: { soldAt: Date }[];
  createdAt?: Date;
  archivedAt?: Date | null;
  pendingSaleRegistration?: boolean;
};

class InventoryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

export function serializeInventoryItem(item: InventoryRecord): InventoryItemResponse {
  return {
    id: item.id,
    imei: item.imei ?? "",
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition as InventoryItemResponse["condition"],
    grade: item.grade as InventoryItemResponse["grade"],
    batteryHealth: item.batteryHealth,
    cost: item.cost.toNumber(),
    price: item.price.toNumber(),
    status: item.status as InventoryItemResponse["status"],
    categoryId: item.categoryId ?? null,
    customFields: toCustomFields(item.customFields),
    soldAt: item.sales?.[0]?.soldAt?.toISOString() ?? null,
    createdAt: item.createdAt?.toISOString() ?? new Date(0).toISOString(),
    archivedAt: item.archivedAt?.toISOString() ?? null,
    pendingSaleRegistration: item.pendingSaleRegistration ?? false,
  };
}

function normalizeCustomFields(customFields?: Record<string, unknown> | null) {
  if (!customFields) {
    return {};
  }

  return Object.keys(customFields).length > 0 ? customFields : {};
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
  id: string; imei: string | null; model: string; capacity: string; color: string;
  condition: string; grade: string; batteryHealth: string; cost: unknown; price: unknown;
  status: string; categoryId: string | null; customFields: Prisma.JsonValue | null;
  createdAt: Date | string | null;
  archivedAt: Date | string | null;
  pendingSaleRegistration: boolean;
};

function deserializeRawRow(row: RawInventoryRow): InventoryItemResponse {
  return {
    id: row.id,
    imei: row.imei ?? "",
    model: row.model,
    capacity: row.capacity,
    color: row.color,
    condition: row.condition as InventoryItemResponse['condition'],
    grade: row.grade as InventoryItemResponse['grade'],
    batteryHealth: row.batteryHealth,
    cost: Number(row.cost),
    price: Number(row.price),
    status: row.status as InventoryItemResponse['status'],
    categoryId: row.categoryId ?? null,
    customFields: toCustomFields(row.customFields),
    soldAt: null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date(0).toISOString(),
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    pendingSaleRegistration: row.pendingSaleRegistration,
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
      SELECT "id", "imei", "model", "capacity", "color", "condition", "grade",
             "batteryHealth", "cost"::float8, "price"::float8, "status", "categoryId", "customFields", "createdAt", "archivedAt", "pendingSaleRegistration"
      FROM "InventoryItem"
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${params.take} OFFSET ${params.skip}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "InventoryItem" WHERE ${where}
    `,
  ]);

  return {
    items: rows.map(deserializeRawRow),
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

export async function listInventory(storeId: string) {
  const inventory = await inventoryPrisma.inventoryItem.findMany({
    where: { storeId, archivedAt: null },
    include: {
      sales: {
        select: { soldAt: true },
        orderBy: { soldAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return inventory.map(serializeInventoryItem);
}

function storedImei(value: string) {
  const imei = value.trim();
  return imei || null;
}

export async function createInventoryItem(storeId: string, input: InventoryItemInput) {
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const imei = storedImei(input.imei);
  if (imei) {
    const existing = await inventoryPrisma.inventoryItem.findFirst({
      where: { storeId, imei },
      select: { id: true },
    });

    if (existing) {
      throw new InventoryError("Inventory item already exists", 409);
    }
  }

  const inventoryItem = await inventoryPrisma.inventoryItem.create({
    data: {
      storeId,
      imei,
      model: input.model.trim(),
      capacity: input.capacity.trim(),
      color: input.color.trim(),
      condition: input.condition,
      grade: input.grade,
      batteryHealth: input.batteryHealth,
      cost: toDecimal(input.cost),
      price: toDecimal(input.price),
      status: input.status,
      pendingSaleRegistration: input.status === "VENDIDO",
      previousSaleStatus: input.status === "VENDIDO" ? "DISPONIBLE" : null,
      categoryId: input.categoryId ?? null,
      customFields: normalizeCustomFields(input.customFields),
    },
  });

  return serializeInventoryItem(inventoryItem);
}

export async function updateInventoryItem(
  storeId: string,
  id: string,
  input: Partial<InventoryItemInput>
) {
  const updated = await withSerializableRetry(async (tx) => {
    const existing = await tx.inventoryItem.findFirst({
      where: { id, storeId, archivedAt: null },
    });
    if (!existing) return null;

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
      if (duplicate) throw new InventoryError("Inventory item already exists", 409);
    }

    if (input.status !== undefined) {
      const activeSale = await tx.sale.findFirst({
        where: { storeId, inventoryItemId: id, status: { not: "CANCELADA" } },
        select: { id: true },
      });
      if (activeSale && input.status !== existing.status) {
        throw new InventoryError("El estado de un equipo con venta activa se gestiona desde Operaciones", 409);
      }
    }

    const data: Prisma.InventoryItemUpdateInput = {};
    if (input.imei !== undefined) data.imei = nextImei;
    if (input.model !== undefined) data.model = input.model.trim();
    if (input.capacity !== undefined) data.capacity = input.capacity.trim();
    if (input.color !== undefined) data.color = input.color.trim();
    if (input.condition !== undefined) data.condition = input.condition;
    if (input.grade !== undefined) data.grade = input.grade;
    if (input.batteryHealth !== undefined) data.batteryHealth = input.batteryHealth;
    if (input.cost !== undefined) data.cost = toDecimal(input.cost);
    if (input.price !== undefined) data.price = toDecimal(input.price);
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

    return tx.inventoryItem.update({ where: { id }, data });
  });

  return updated ? serializeInventoryItem(updated) : null;
}

export async function deleteInventoryItem(storeId: string, id: string) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return false;
  }

  const linkedSale = await inventoryPrisma.sale.findFirst({ where: { storeId, inventoryItemId: id, integratedOperation: true, status: { not: "CANCELADA" } }, select: { id: true } });
  const activeReceivedTrade = await inventoryPrisma.tradeIn.findFirst({ where: { storeId, receivedInventoryItemId: id, confirmationStatus: "CONFIRMED" }, select: { id: true } });
  if (linkedSale || activeReceivedTrade) throw new InventoryError("El equipo pertenece a una operación activa", 409);

  await inventoryPrisma.inventoryItem.delete({
    where: { id },
  });

  return true;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(storeId: string): Promise<InventoryCategoryResponse[]> {
  const cats = await inventoryPrisma.inventoryCategory.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
  return cats;
}

export async function createCategory(storeId: string, name: string): Promise<InventoryCategoryResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new InventoryError("Category name required", 400);
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { storeId, name: trimmed } });
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

export async function deleteCategory(storeId: string, id: string): Promise<boolean> {
  const existing = await inventoryPrisma.inventoryCategory.findFirst({ where: { id, storeId } });
  if (!existing) return false;
  // Unassign items before deleting
  await inventoryPrisma.inventoryItem.updateMany({ where: { storeId, categoryId: id }, data: { categoryId: null } });
  await inventoryPrisma.inventoryCategory.delete({ where: { id } });
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
  "pre-owned": "PRE-OWNED",
  preowned: "PRE-OWNED",
  "pre owned": "PRE-OWNED",
};

const GRADE_MAP: Record<string, string> = {
  "a+": "A+",
  a: "A",
  b: "B",
  c: "C",
  "n/a": "N/A",
  na: "N/A",
  "-": "N/A",
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

function normalizeEnum<T extends string>(
  value: string | undefined,
  map: Record<string, string>,
  fallback: T
): T {
  return (lookupEnum(value, map) as T) ?? fallback;
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
  rows: ImportRow[]
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;

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

    const input = {
      imei: raw.imei?.trim() || `IMP-${Date.now()}-${rowNum}`,
      model: raw.model.trim(),
      capacity: raw.capacity?.trim() || "",
      color: raw.color?.trim() || "",
      condition,
      grade: normalizeEnum(raw.grade, GRADE_MAP, "N/A" as const),
      batteryHealth: normalizeBattery(raw.batteryHealth),
      cost: Number(raw.cost) || 0,
      price: Number(raw.price),
      status,
    };

    try {
      const existing = await inventoryPrisma.inventoryItem.findFirst({
        where: { storeId, imei: input.imei },
        select: { id: true },
      });

      if (existing) {
        const prev = await inventoryPrisma.inventoryItem.findFirst({
          where: { id: existing.id },
          select: { customFields: true },
        });
        const mergedFields = {
          ...(toCustomFields(prev?.customFields ?? null)),
          ...(raw.customFields ?? {}),
        };
        await inventoryPrisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            model: input.model,
            capacity: input.capacity,
            color: input.color,
            condition: input.condition,
            grade: input.grade,
            batteryHealth: input.batteryHealth,
            cost: toDecimal(input.cost),
            price: toDecimal(input.price),
            status: input.status,
            customFields: mergedFields,
          },
        });
        result.updated++;
      } else {
        await inventoryPrisma.inventoryItem.create({
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
            status: input.status,
            customFields: raw.customFields ?? {},
          },
        });
        result.imported++;
      }
    } catch {
      result.errors.push({ row: rowNum, imei: raw.imei, message: "Error al guardar" });
    }
  }

  return result;
}

export function getInventoryErrorStatus(error: unknown) {
  if (error instanceof InventoryError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}
