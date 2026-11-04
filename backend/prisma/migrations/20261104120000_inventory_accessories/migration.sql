-- Constant default: existing records remain devices, without rewriting rows
-- on PostgreSQL 11+. No backfill or mutation of existing business data.
ALTER TABLE "InventoryItem"
  ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'DEVICE',
  ADD COLUMN "accessoryType" VARCHAR(40),
  ADD COLUMN "compatibleWith" VARCHAR(120);
