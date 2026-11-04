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

-- #746: compatible startup path; relax memberId only as explicitly authorized.
DO $$
BEGIN
IF to_regclass('public."Store"') IS NOT NULL THEN
-- Additive directory; no existing business rows are rewritten.
CREATE TABLE IF NOT EXISTS "StoreReseller" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "name" VARCHAR(80) NOT NULL,
 "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StoreReseller_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StoreReseller_storeId_idx" ON "StoreReseller"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreReseller_storeId_name_key" ON "StoreReseller"("storeId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreReseller_storeId_name_ci_key" ON "StoreReseller"("storeId", lower("name"));
ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "draftResellerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "resellerId" TEXT;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_resellerId_fkey') THEN
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_beneficiary_check') THEN
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_beneficiary_check" CHECK (NOT ("sellerMemberId" IS NOT NULL AND "resellerId" IS NOT NULL));
END IF;
CREATE INDEX IF NOT EXISTS "Sale_storeId_resellerId_idx" ON "Sale"("storeId", "resellerId");
ALTER TABLE "CommissionRule" ADD COLUMN IF NOT EXISTS "resellerId" TEXT;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionRule_resellerId_fkey') THEN
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionRule_beneficiary_check') THEN
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_beneficiary_check" CHECK (NOT ("memberId" IS NOT NULL AND "resellerId" IS NOT NULL));
END IF;
CREATE INDEX IF NOT EXISTS "CommissionRule_storeId_resellerId_effectiveFrom_idx" ON "CommissionRule"("storeId", "resellerId", "effectiveFrom");
ALTER TABLE "CommissionPayment" ADD COLUMN IF NOT EXISTS "resellerId" TEXT;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionPayment_resellerId_fkey') THEN
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
-- Authorized relaxation: retains all historical member IDs unchanged.
ALTER TABLE "CommissionPayment" ALTER COLUMN "memberId" DROP NOT NULL;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionPayment_beneficiary_check') THEN
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_beneficiary_check" CHECK ((("memberId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int) = 1);
END IF;
CREATE INDEX IF NOT EXISTS "CommissionPayment_storeId_resellerId_period_idx" ON "CommissionPayment"("storeId", "resellerId", "period");
ALTER TABLE "CommissionAccrual" ADD COLUMN IF NOT EXISTS "resellerId" TEXT;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionAccrual_resellerId_fkey') THEN
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
-- Authorized relaxation: retains all historical member IDs unchanged.
ALTER TABLE "CommissionAccrual" ALTER COLUMN "memberId" DROP NOT NULL;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommissionAccrual_beneficiary_check') THEN
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_beneficiary_check" CHECK ((("memberId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int) = 1);
END IF;
CREATE INDEX IF NOT EXISTS "CommissionAccrual_storeId_resellerId_period_idx" ON "CommissionAccrual"("storeId", "resellerId", "period");
END IF;
END $$;

-- Multitienda (#663): Store.groupId/groupKind are new, nullable and empty, so the
-- composite unique key cannot collide. Create it before push so `prisma db push`
-- does not stop on the data-loss warning. Idempotent.
DO $$
BEGIN
  IF to_regclass('public."Store"') IS NOT NULL THEN
    ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
    ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "groupKind" VARCHAR(12);
    CREATE UNIQUE INDEX IF NOT EXISTS "Store_groupId_groupKind_key" ON "Store"("groupId", "groupKind");
  END IF;
END $$;
