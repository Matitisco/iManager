-- Additive only: old catalogs and inventory are left intact.
CREATE TABLE "StoreCatalog" (
 "id" TEXT NOT NULL PRIMARY KEY, "storeId" TEXT NOT NULL,
 "slug" VARCHAR(160) NOT NULL, "name" VARCHAR(100) NOT NULL DEFAULT 'Clientes finales',
 "isDefault" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT false,
 "hideWithoutStock" BOOLEAN NOT NULL DEFAULT true, "hideReserved" BOOLEAN NOT NULL DEFAULT true,
 "minBattery" INTEGER, "showPrice" BOOLEAN NOT NULL DEFAULT true,
 "priceCurrency" VARCHAR(10) NOT NULL DEFAULT 'ORIGINAL',
 "priceRuleMode" VARCHAR(20) NOT NULL DEFAULT 'LIST_PERCENT',
 "priceAdjustPercent" DECIMAL(8,2) NOT NULL DEFAULT 0,
 "logoUrl" VARCHAR(2000), "hours" VARCHAR(120),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StoreCatalog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreCatalog_slug_key" ON "StoreCatalog"("slug");
CREATE INDEX "StoreCatalog_storeId_isDefault_idx" ON "StoreCatalog"("storeId", "isDefault");
CREATE UNIQUE INDEX "StoreCatalog_default_store_key" ON "StoreCatalog"("storeId") WHERE "isDefault";
CREATE TABLE "CatalogItemPrice" (
 "catalogId" TEXT NOT NULL, "inventoryItemId" TEXT NOT NULL, "price" DECIMAL(12,2) NOT NULL, "currency" VARCHAR(3) NOT NULL,
 PRIMARY KEY ("catalogId", "inventoryItemId"),
 CONSTRAINT "CatalogItemPrice_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "StoreCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CatalogItemPrice_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CatalogItemPrice_inventoryItemId_idx" ON "CatalogItemPrice"("inventoryItemId");
INSERT INTO "StoreCatalog" ("id", "storeId", "slug", "name", "isDefault", "active", "hideWithoutStock", "hideReserved", "minBattery", "showPrice", "priceCurrency", "logoUrl", "hours", "createdAt", "updatedAt")
SELECT 'default:' || "storeId", "storeId", "slug", 'Clientes finales', true, "active", "hideWithoutStock", "hideReserved", "minBattery", "showPrice", "priceCurrency", "logoUrl", "hours", "createdAt", "updatedAt"
FROM "StorePublicCatalog" ON CONFLICT DO NOTHING;
