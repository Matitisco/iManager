-- Reuse quantity: existing inventory values are preserved, missing columns default to 1.
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem" ALTER COLUMN "quantity" SET DEFAULT 1;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cantidad" INTEGER NOT NULL DEFAULT 1;
-- Historical sales did not decrement quantity; cancellation must not add phantom units.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "stockDeducted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "draftCantidad" INTEGER NOT NULL DEFAULT 1;
