import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export interface InventoryItemInput {
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: "NUEVO" | "USADO" | "PRE-OWNED";
  grade: "A+" | "A" | "B" | "C" | "N/A";
  batteryHealth: string;
  cost: number;
  price: number;
  status: "DISPONIBLE" | "VENDIDO" | "EN_REVISION";
  categoryId?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface InventoryItemResponse {
  id: string;
  imei: string;
  model: string;
  capacity: string;
  color: string;
  condition: "NUEVO" | "USADO" | "PRE-OWNED";
  grade: "A+" | "A" | "B" | "C" | "N/A";
  batteryHealth: string;
  cost: number;
  price: number;
  status: "DISPONIBLE" | "VENDIDO" | "EN_REVISION";
  categoryId: string | null;
  customFields: Record<string, unknown>;
  soldAt: string | null;
}

export interface InventoryCategoryResponse {
  id: string;
  name: string;
}

type InventoryRecord = {
  id: string;
  imei: string;
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
    imei: item.imei,
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
  const parts: Prisma.Sql[] = [Prisma.sql`"storeId" = ${storeId}`];

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
  id: string; imei: string; model: string; capacity: string; color: string;
  condition: string; grade: string; batteryHealth: string; cost: unknown; price: unknown;
  status: string; categoryId: string | null; customFields: Prisma.JsonValue | null;
};

function deserializeRawRow(row: RawInventoryRow): InventoryItemResponse {
  return {
    id: row.id,
    imei: row.imei,
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
             "batteryHealth", "cost"::float8, "price"::float8, "status", "categoryId", "customFields"
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
    where: { storeId },
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

export async function createInventoryItem(storeId: string, input: InventoryItemInput) {
  await assertCategoryBelongsToStore(storeId, input.categoryId);
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { storeId, imei: input.imei.trim() },
    select: { id: true },
  });

  if (existing) {
    throw new InventoryError("Inventory item already exists", 409);
  }

  const inventoryItem = await inventoryPrisma.inventoryItem.create({
    data: {
      storeId,
      imei: input.imei.trim(),
      model: input.model.trim(),
      capacity: input.capacity.trim(),
      color: input.color.trim(),
      condition: input.condition,
      grade: input.grade,
      batteryHealth: input.batteryHealth,
      cost: toDecimal(input.cost),
      price: toDecimal(input.price),
      status: input.status,
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
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    return null;
  }

  if (input.imei !== undefined) {
    const nextImei = input.imei.trim();
    const duplicate = await inventoryPrisma.inventoryItem.findFirst({
      where: {
        storeId,
        imei: nextImei,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new InventoryError("Inventory item already exists", 409);
    }
  }

  await assertCategoryBelongsToStore(storeId, input.categoryId);

  const updated = await inventoryPrisma.inventoryItem.update({
    where: { id },
    data: {
      imei: input.imei !== undefined ? input.imei.trim() : existing.imei,
      model: input.model !== undefined ? input.model.trim() : existing.model,
      capacity: input.capacity !== undefined ? input.capacity.trim() : existing.capacity,
      color: input.color !== undefined ? input.color.trim() : existing.color,
      condition: input.condition ?? existing.condition,
      grade: input.grade ?? existing.grade,
      batteryHealth: input.batteryHealth ?? existing.batteryHealth,
      cost: input.cost !== undefined ? toDecimal(input.cost) : existing.cost,
      price: input.price !== undefined ? toDecimal(input.price) : existing.price,
      status: input.status ?? existing.status,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      customFields:
        input.customFields !== undefined
          ? normalizeCustomFields(input.customFields)
          : existing.customFields ?? {},
    },
  });

  return serializeInventoryItem(updated);
}

export async function deleteInventoryItem(storeId: string, id: string) {
  const existing = await inventoryPrisma.inventoryItem.findFirst({
    where: { id, storeId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

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
};

function normalizeEnum<T extends string>(
  value: string | undefined,
  map: Record<string, string>,
  fallback: T
): T {
  if (!value) return fallback;
  const normalized = map[value.toLowerCase().trim()];
  return (normalized as T) ?? fallback;
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

    const input = {
      imei: raw.imei?.trim() || `IMP-${Date.now()}-${rowNum}`,
      model: raw.model.trim(),
      capacity: raw.capacity?.trim() || "",
      color: raw.color?.trim() || "",
      condition: normalizeEnum(raw.condition, CONDITION_MAP, "USADO" as const),
      grade: normalizeEnum(raw.grade, GRADE_MAP, "N/A" as const),
      batteryHealth: normalizeBattery(raw.batteryHealth),
      cost: Number(raw.cost) || 0,
      price: Number(raw.price),
      status: normalizeEnum(raw.status, STATUS_MAP, "DISPONIBLE" as const),
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
