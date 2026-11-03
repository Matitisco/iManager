-- Runs before `prisma db push` on start. Adds the unique keys that push would
-- otherwise refuse without --accept-data-loss. Columns are new and empty, so
-- no existing row can collide. Idempotent and a no-op on a fresh database.
DO $$
BEGIN
  IF to_regclass('public."Sale"') IS NOT NULL THEN
    ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "requestKey" VARCHAR(120);
    ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "tradeInId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "Sale_tradeInId_key" ON "Sale"("tradeInId");
    CREATE UNIQUE INDEX IF NOT EXISTS "Sale_storeId_requestKey_key" ON "Sale"("storeId", "requestKey");
  END IF;
  IF to_regclass('public."TradeIn"') IS NOT NULL THEN
    ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "requestKey" VARCHAR(120);
    CREATE UNIQUE INDEX IF NOT EXISTS "TradeIn_storeId_requestKey_key" ON "TradeIn"("storeId", "requestKey");
  END IF;
END $$;

-- Acquisition snapshot rollout for the existing db-push startup path.
DO $$
BEGIN
  IF to_regclass('public."InventoryItem"') IS NOT NULL
     AND to_regclass('public."Sale"') IS NOT NULL
     AND to_regclass('public."ReturnCase"') IS NOT NULL THEN
-- Additive and nullable: never rewrite stock, sales, claims or a known acquisition snapshot.
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "acquiredQuantity" INTEGER;

-- Assumes quantity is the physical remainder for stockDeducted sales. Legacy sales
-- never decremented quantity and therefore must not be added again. Cancellation
-- releases stock; archived active sales still consumed it. Claims retain physical
-- effects when archived/voided, so deliberately do not filter their status/deletedAt.
-- Attribute returned units to their CURRENT inventoryItemId: a split return row is
-- current + resales - its returned units = 0 acquisitions, not a second purchase.
WITH sold AS (
  SELECT "storeId", "inventoryItemId", SUM("cantidad"::bigint) AS units
  FROM "Sale"
  WHERE "stockDeducted" AND "voidedAt" IS NULL AND status NOT IN ('CANCELADA', 'ANULADA')
  GROUP BY "storeId", "inventoryItemId"
), returned AS (
  SELECT r."storeId", r."inventoryItemId", SUM(COALESCE(r.cantidad, s.cantidad)::bigint) AS units
  FROM "ReturnCase" r
  JOIN "Sale" s ON s.id = r."saleId" AND s."storeId" = r."storeId"
  WHERE (s."stockDeducted" OR s.cantidad > 1) AND r.destination IN ('STOCK', 'PROVEEDOR') AND r.resolution IS NOT NULL
    -- A repaired RMA received back by the customer was removed from stock again.
    AND NOT (s."stockDeducted" AND r.resolution = 'REPARACION' AND COALESCE(r."rmaStatus", '') = 'RECIBIDO')
  GROUP BY r."storeId", r."inventoryItemId"
), reconstructed AS (
  SELECT i.id, i.quantity::bigint + COALESCE(s.units, 0) - COALESCE(r.units, 0) AS units
  FROM "InventoryItem" i
  LEFT JOIN sold s ON s."storeId" = i."storeId" AND s."inventoryItemId" = i.id
  LEFT JOIN returned r ON r."storeId" = i."storeId" AND r."inventoryItemId" = i.id
  WHERE i."acquiredQuantity" IS NULL
)
UPDATE "InventoryItem" i SET "acquiredQuantity" = r.units::integer
FROM reconstructed r
WHERE i.id = r.id AND i."acquiredQuantity" IS NULL AND r.units BETWEEN 0 AND 2147483647;
-- Inconsistent/overflow histories remain null for explicit review; never clamp or delete.

  END IF;
END $$;
