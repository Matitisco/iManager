-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('PROFIT_PERCENT', 'SALE_PERCENT', 'FIXED_PER_UNIT');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "exchangeRate" DECIMAL(12,2),
ADD COLUMN     "registeredByUserId" TEXT,
ADD COLUMN     "sellerMemberId" TEXT;

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "memberId" TEXT,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'PROFIT_PERCENT',
    "rate" DECIMAL(12,4) NOT NULL,
    "currency" VARCHAR(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(12,2) NOT NULL,
    "settlesCurrency" VARCHAR(3) NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAccrual" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sourceSaleId" TEXT NOT NULL,
    "saleNumber" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "deviceLabel" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "takeValue" DECIMAL(12,2) NOT NULL,
    "grossProfit" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "ruleId" TEXT,
    "basis" "CommissionBasis",
    "rate" DECIMAL(12,4),
    "ruleCurrency" VARCHAR(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(20),
    "adjustmentPeriod" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRule_storeId_idx" ON "CommissionRule"("storeId");

-- CreateIndex
CREATE INDEX "CommissionRule_storeId_memberId_effectiveFrom_idx" ON "CommissionRule"("storeId", "memberId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CommissionPayment_storeId_idx" ON "CommissionPayment"("storeId");

-- CreateIndex
CREATE INDEX "CommissionPayment_storeId_memberId_period_idx" ON "CommissionPayment"("storeId", "memberId", "period");

-- CreateIndex
CREATE INDEX "CommissionAccrual_storeId_idx" ON "CommissionAccrual"("storeId");

-- CreateIndex
CREATE INDEX "CommissionAccrual_storeId_sourceSaleId_idx" ON "CommissionAccrual"("storeId", "sourceSaleId");

-- CreateIndex
CREATE INDEX "CommissionAccrual_storeId_memberId_period_idx" ON "CommissionAccrual"("storeId", "memberId", "period");

-- CreateIndex
CREATE INDEX "Sale_sellerMemberId_idx" ON "Sale"("sellerMemberId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerMemberId_fkey" FOREIGN KEY ("sellerMemberId") REFERENCES "StoreMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "StoreMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "StoreMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "StoreMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
