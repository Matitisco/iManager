-- Additive, nullable metadata. Existing purchases and inventory stay untouched.
ALTER TABLE "StockPurchase" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120);
