-- Additive and idempotent. Existing catalogs retain GLOBAL. No data backfill.
ALTER TABLE "StoreCatalog" ADD COLUMN IF NOT EXISTS "itemVisibility" VARCHAR(10) NOT NULL DEFAULT 'GLOBAL';
CREATE TABLE IF NOT EXISTS "CatalogItemHidden" (
  "catalogId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogItemHidden_pkey" PRIMARY KEY ("catalogId", "inventoryItemId"),
  CONSTRAINT "CatalogItemHidden_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "StoreCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CatalogItemHidden_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CatalogItemHidden_inventoryItemId_idx" ON "CatalogItemHidden"("inventoryItemId");
