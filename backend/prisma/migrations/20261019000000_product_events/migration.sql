CREATE TABLE IF NOT EXISTS "ProductEvent" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(48) NOT NULL,
  "storeId" TEXT,
  "userId" TEXT,
  "source" VARCHAR(8) NOT NULL,
  "props" JSONB,
  "dedupeKey" VARCHAR(160),
  "clientAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductEvent_dedupeKey_key" ON "ProductEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "ProductEvent_name_createdAt_idx" ON "ProductEvent"("name", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductEvent_storeId_createdAt_idx" ON "ProductEvent"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductEvent_userId_createdAt_idx" ON "ProductEvent"("userId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductEvent_storeId_fkey' AND conrelid = '"ProductEvent"'::regclass) THEN
    ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
