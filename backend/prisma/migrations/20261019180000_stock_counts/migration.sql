-- Additive stock-count tables. No new unique constraints and no changes to existing tables.

CREATE TABLE IF NOT EXISTS "StockCount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  "scope" VARCHAR(16) NOT NULL DEFAULT 'DEVICES',
  "startedById" TEXT NOT NULL,
  "startedByName" VARCHAR(255) NOT NULL,
  "closedById" TEXT,
  "closedByName" VARCHAR(255),
  "closedAt" TIMESTAMP(3),
  "resolution" VARCHAR(16),
  "excludedNoImei" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockCountExpected" (
  "id" TEXT NOT NULL,
  "stockCountId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "imei" VARCHAR(32) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "capacity" VARCHAR(50) NOT NULL,
  "color" VARCHAR(50) NOT NULL,
  "statusAtSnapshot" VARCHAR(20) NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCountExpected_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockCountScan" (
  "id" TEXT NOT NULL,
  "stockCountId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "scannedById" TEXT NOT NULL,
  "scannedByName" VARCHAR(255) NOT NULL,
  "imei" VARCHAR(32) NOT NULL,
  "result" VARCHAR(16) NOT NULL,
  "counts" BOOLEAN NOT NULL DEFAULT true,
  "inventoryItemId" TEXT,
  "model" VARCHAR(100),
  "capacity" VARCHAR(50),
  "color" VARCHAR(50),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCountScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockCount_storeId_status_idx" ON "StockCount"("storeId", "status");
CREATE INDEX IF NOT EXISTS "StockCount_storeId_createdAt_idx" ON "StockCount"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockCountExpected_stockCountId_idx" ON "StockCountExpected"("stockCountId");
CREATE INDEX IF NOT EXISTS "StockCountExpected_storeId_stockCountId_idx" ON "StockCountExpected"("storeId", "stockCountId");
CREATE INDEX IF NOT EXISTS "StockCountExpected_stockCountId_imei_idx" ON "StockCountExpected"("stockCountId", "imei");
CREATE INDEX IF NOT EXISTS "StockCountScan_stockCountId_scannedById_createdAt_idx" ON "StockCountScan"("stockCountId", "scannedById", "createdAt");
CREATE INDEX IF NOT EXISTS "StockCountScan_stockCountId_imei_idx" ON "StockCountScan"("stockCountId", "imei");
CREATE INDEX IF NOT EXISTS "StockCountScan_storeId_stockCountId_idx" ON "StockCountScan"("storeId", "stockCountId");

DO $$ BEGIN
  ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountExpected" ADD CONSTRAINT "StockCountExpected_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountScan" ADD CONSTRAINT "StockCountScan_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
