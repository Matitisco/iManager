-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "opening" DECIMAL(12,2) NOT NULL,
    "openedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reviewNote" VARCHAR(500),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "category" VARCHAR(80),
    "note" VARCHAR(500),
    "sourceType" VARCHAR(30),
    "sourceId" TEXT,
    "requestKey" TEXT,
    "transferGroup" TEXT,
    "exchangeRate" DECIMAL(12,2),
    "reversalOf" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expected" DECIMAL(12,2) NOT NULL,
    "counted" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "denominations" JSONB,
    "note" VARCHAR(500),
    "countedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashRegister_storeId_idx" ON "CashRegister"("storeId");

-- CreateIndex
CREATE INDEX "CashRegister_storeId_currency_method_idx" ON "CashRegister"("storeId", "currency", "method");

-- CreateIndex
CREATE INDEX "CashSession_storeId_idx" ON "CashSession"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_registerId_day_key" ON "CashSession"("registerId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_reversalOf_key" ON "CashMovement"("reversalOf");

-- CreateIndex
CREATE INDEX "CashMovement_storeId_idx" ON "CashMovement"("storeId");

-- CreateIndex
CREATE INDEX "CashMovement_storeId_registerId_createdAt_idx" ON "CashMovement"("storeId", "registerId", "createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_storeId_sourceType_sourceId_idx" ON "CashMovement"("storeId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_storeId_requestKey_key" ON "CashMovement"("storeId", "requestKey");

-- CreateIndex
CREATE INDEX "CashCount_storeId_idx" ON "CashCount"("storeId");

-- CreateIndex
CREATE INDEX "CashCount_sessionId_createdAt_idx" ON "CashCount"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
