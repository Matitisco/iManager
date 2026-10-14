ALTER TABLE "InventoryItem" ADD COLUMN "catalogVisible" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "StorePublicCatalog" (
  "storeId" TEXT NOT NULL PRIMARY KEY,
  "slug" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "hideWithoutStock" BOOLEAN NOT NULL DEFAULT true,
  "hideReserved" BOOLEAN NOT NULL DEFAULT true,
  "minBattery" INTEGER,
  "showPrice" BOOLEAN NOT NULL DEFAULT true,
  "priceCurrency" VARCHAR(10) NOT NULL DEFAULT 'ORIGINAL',
  "logoUrl" VARCHAR(2000), "hours" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorePublicCatalog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StorePublicCatalog_slug_key" ON "StorePublicCatalog"("slug");
CREATE INDEX "InventoryItem_storeId_catalogVisible_idx" ON "InventoryItem"("storeId", "catalogVisible");
