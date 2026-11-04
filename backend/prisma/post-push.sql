-- Runs after `prisma db push` on start (#763). db push never creates partial
-- indexes or CHECK constraints, but keeps them once present. Strictly additive
-- and idempotent: never touches rows. If existing rows would violate a guard it
-- is skipped with a WARNING instead of failing startup.
DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public."Consignment"') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public."Consignment_pending_item_key"') IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM "Consignment" WHERE "paidAt" IS NULL
      GROUP BY "storeId", "inventoryItemId" HAVING COUNT(*) > 1
    ) THEN
      RAISE WARNING 'post-push #763: skipped Consignment_pending_item_key, duplicate pending rows exist';
    ELSE
      CREATE UNIQUE INDEX "Consignment_pending_item_key"
        ON "Consignment"("storeId", "inventoryItemId") WHERE "paidAt" IS NULL;
      RAISE NOTICE 'post-push #763: created Consignment_pending_item_key';
    END IF;
  END IF;

  FOR c IN SELECT * FROM (VALUES
    ('Consignment_amount_check', 'amount', '"amount" > 0'),
    ('Consignment_currency_check', 'currency', '"currency" IN (''ARS'', ''USD'')'),
    ('Consignment_cantidad_check', 'cantidad', '"cantidad" > 0'),
    ('Consignment_paid_sale_check', 'saleId', '("paidAt" IS NULL) = ("saleId" IS NULL)')
  ) AS t(name, col, expr) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = '"Consignment"'::regclass AND contype = 'c'
        AND (conname = c.name OR pg_get_constraintdef(oid) LIKE '%' || c.col || '%')
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE "Consignment" ADD CONSTRAINT %I CHECK (%s)', c.name, c.expr);
        RAISE NOTICE 'post-push #763: added %', c.name;
      EXCEPTION WHEN check_violation THEN
        RAISE WARNING 'post-push #763: skipped %, existing rows violate it', c.name;
      END;
    END IF;
  END LOOP;
END $$;
