-- Additive directory; no existing business rows are rewritten.
CREATE TABLE "StoreReseller" (
 "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "name" VARCHAR(80) NOT NULL,
 "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StoreReseller_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StoreReseller_storeId_idx" ON "StoreReseller"("storeId");
CREATE UNIQUE INDEX "StoreReseller_storeId_name_key" ON "StoreReseller"("storeId", "name");
CREATE UNIQUE INDEX "StoreReseller_storeId_name_ci_key" ON "StoreReseller"("storeId", lower("name"));
ALTER TABLE "TradeIn" ADD COLUMN "draftResellerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "resellerId" TEXT;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_beneficiary_check" CHECK (NOT ("sellerMemberId" IS NOT NULL AND "resellerId" IS NOT NULL));
CREATE INDEX "Sale_storeId_resellerId_idx" ON "Sale"("storeId", "resellerId");
ALTER TABLE "CommissionRule" ADD COLUMN "resellerId" TEXT;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_beneficiary_check" CHECK (NOT ("memberId" IS NOT NULL AND "resellerId" IS NOT NULL));
CREATE INDEX "CommissionRule_storeId_resellerId_effectiveFrom_idx" ON "CommissionRule"("storeId", "resellerId", "effectiveFrom");
ALTER TABLE "CommissionPayment" ADD COLUMN "resellerId" TEXT;
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Authorized relaxation: retains all historical member IDs unchanged.
ALTER TABLE "CommissionPayment" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_beneficiary_check" CHECK ((("memberId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int) = 1);
CREATE INDEX "CommissionPayment_storeId_resellerId_period_idx" ON "CommissionPayment"("storeId", "resellerId", "period");
ALTER TABLE "CommissionAccrual" ADD COLUMN "resellerId" TEXT;
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "StoreReseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Authorized relaxation: retains all historical member IDs unchanged.
ALTER TABLE "CommissionAccrual" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_beneficiary_check" CHECK ((("memberId" IS NOT NULL)::int + ("resellerId" IS NOT NULL)::int) = 1);
CREATE INDEX "CommissionAccrual_storeId_resellerId_period_idx" ON "CommissionAccrual"("storeId", "resellerId", "period");
