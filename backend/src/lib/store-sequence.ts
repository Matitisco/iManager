import { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;
type DocumentKind = "sale" | "trade";

/**
 * Allocates the next receipt number for one store.
 *
 * The counter row is updated with a single INSERT .. ON CONFLICT, so concurrent
 * sales in the same store cannot take the same number. The first allocation for
 * a store continues after the highest number already stored (legacy global
 * sequences included) and never rewrites those rows. A rolled-back transaction
 * rolls the counter back with it, so a failed attempt does not leave a gap.
 * The identity sequence is only moved forward, so a leftover default cannot
 * reissue a number this allocator just handed out.
 */
export async function allocateDocumentNumber(
  tx: TransactionClient,
  storeId: string,
  kind: DocumentKind,
): Promise<number> {
  const rows = kind === "sale"
    ? await tx.$queryRaw<Array<{ allocated: number | bigint }>>`
        INSERT INTO "StoreCounter" ("storeId", "lastSaleNumber", "lastTradeNumber")
        SELECT
          ${storeId},
          COALESCE((SELECT MAX("saleNumber") FROM "Sale" WHERE "storeId" = ${storeId}), 0) + 1,
          COALESCE((SELECT MAX("tradeNumber") FROM "TradeIn" WHERE "storeId" = ${storeId}), 0)
        ON CONFLICT ("storeId") DO UPDATE
        SET "lastSaleNumber" = GREATEST(
          "StoreCounter"."lastSaleNumber",
          COALESCE((SELECT MAX("saleNumber") FROM "Sale" WHERE "storeId" = ${storeId}), 0)
        ) + 1
        RETURNING "lastSaleNumber" AS allocated
      `
    : await tx.$queryRaw<Array<{ allocated: number | bigint }>>`
        INSERT INTO "StoreCounter" ("storeId", "lastSaleNumber", "lastTradeNumber")
        SELECT
          ${storeId},
          COALESCE((SELECT MAX("saleNumber") FROM "Sale" WHERE "storeId" = ${storeId}), 0),
          COALESCE((SELECT MAX("tradeNumber") FROM "TradeIn" WHERE "storeId" = ${storeId}), 0) + 1
        ON CONFLICT ("storeId") DO UPDATE
        SET "lastTradeNumber" = GREATEST(
          "StoreCounter"."lastTradeNumber",
          COALESCE((SELECT MAX("tradeNumber") FROM "TradeIn" WHERE "storeId" = ${storeId}), 0)
        ) + 1
        RETURNING "lastTradeNumber" AS allocated
      `;

  const allocated = readAllocated(rows);
  await keepIdentityAhead(tx, kind, allocated);
  return allocated;
}

function readAllocated(rows: Array<{ allocated: number | bigint }>) {
  const raw = rows[0]?.allocated;
  const allocated = typeof raw === "bigint" ? Number(raw) : raw;
  if (!Number.isInteger(allocated) || allocated < 1) {
    throw new Error("No se pudo asignar el número de comprobante");
  }
  return allocated;
}

async function keepIdentityAhead(tx: TransactionClient, kind: DocumentKind, allocated: number) {
  const table = kind === "sale" ? "Sale" : "TradeIn";
  const column = kind === "sale" ? "saleNumber" : "tradeNumber";
  const lockKey = kind === "sale" ? 147001 : 147002;
  const sequence = Prisma.raw(kind === "sale" ? `"Sale_saleNumber_seq"` : `"TradeIn_tradeNumber_seq"`);
  const tableName = `public."${table}"`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  await tx.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence(${tableName}, ${column}),
      ${allocated}::bigint,
      true
    )
    WHERE ${allocated}::bigint >= (
      SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
      FROM ${sequence}
    )
  `;
}
