-- Additive archive / void columns and audit detail. Safe for existing rows: every new column is nullable.

ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "entityLabel" VARCHAR(160);
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "changes" JSONB;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "reason" VARCHAR(280);
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "actorRole" VARCHAR(20);
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "source" VARCHAR(16);
CREATE INDEX IF NOT EXISTS "AuditEvent_storeId_actorUserId_createdAt_idx" ON "AuditEvent"("storeId", "actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_storeId_action_createdAt_idx" ON "AuditEvent"("storeId", "action", "createdAt");

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "archivedBy" VARCHAR(255);
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "archiveReason" VARCHAR(280);
CREATE INDEX IF NOT EXISTS "InventoryItem_storeId_archivedAt_idx" ON "InventoryItem"("storeId", "archivedAt");

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "voidedBy" VARCHAR(255);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "voidReason" VARCHAR(280);
CREATE INDEX IF NOT EXISTS "Sale_storeId_voidedAt_idx" ON "Sale"("storeId", "voidedAt");

ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "voidedBy" VARCHAR(255);
ALTER TABLE "TradeIn" ADD COLUMN IF NOT EXISTS "voidReason" VARCHAR(280);
CREATE INDEX IF NOT EXISTS "TradeIn_storeId_voidedAt_idx" ON "TradeIn"("storeId", "voidedAt");

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archivedBy" VARCHAR(255);
CREATE INDEX IF NOT EXISTS "Client_storeId_archivedAt_idx" ON "Client"("storeId", "archivedAt");

ALTER TABLE "RepairOrder" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "RepairOrder" ADD COLUMN IF NOT EXISTS "archivedBy" VARCHAR(255);
ALTER TABLE "RepairOrder" ADD COLUMN IF NOT EXISTS "archiveReason" VARCHAR(280);
CREATE INDEX IF NOT EXISTS "RepairOrder_storeId_archivedAt_idx" ON "RepairOrder"("storeId", "archivedAt");

ALTER TABLE "InventoryCategory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "SaleCategory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "TradeInCategory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "ClientCategory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "StoreCatalogOption" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "StoreMember" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);
ALTER TABLE "StoreMember" ADD COLUMN IF NOT EXISTS "removedBy" VARCHAR(255);
