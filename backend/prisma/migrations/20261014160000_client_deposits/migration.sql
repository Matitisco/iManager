-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "reservedClientId" TEXT,
ADD COLUMN     "reservedClientName" VARCHAR(120),
ADD COLUMN     "reservedDepositId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "depositAppliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ClientDeposit" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestKey" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(12,2) NOT NULL,
    "usdAmount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "productId" TEXT,
    "productLabel" VARCHAR(200),
    "previousInventoryStatus" VARCHAR(20),
    "saleId" TEXT,
    "repairId" TEXT,
    "appliedAmount" DECIMAL(12,2),
    "appliedCurrency" VARCHAR(3),
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientDeposit_storeId_clientId_status_idx" ON "ClientDeposit"("storeId", "clientId", "status");

-- CreateIndex
CREATE INDEX "ClientDeposit_storeId_saleId_idx" ON "ClientDeposit"("storeId", "saleId");

-- CreateIndex
CREATE INDEX "ClientDeposit_storeId_repairId_idx" ON "ClientDeposit"("storeId", "repairId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDeposit_storeId_requestKey_key" ON "ClientDeposit"("storeId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_reservedDepositId_key" ON "InventoryItem"("reservedDepositId");

-- AddForeignKey
ALTER TABLE "ClientDeposit" ADD CONSTRAINT "ClientDeposit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDeposit" ADD CONSTRAINT "ClientDeposit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

