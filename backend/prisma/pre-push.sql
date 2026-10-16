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
