-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "groupKind" VARCHAR(12);

-- CreateTable
CREATE TABLE "StoreGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "primaryStoreId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" VARCHAR(255) NOT NULL,
    "requestKey" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "fromItemId" TEXT NOT NULL,
    "toItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3),

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransfer_fromStoreId_idx" ON "StockTransfer"("fromStoreId");

-- CreateIndex
CREATE INDEX "StockTransfer_toStoreId_idx" ON "StockTransfer"("toStoreId");

-- CreateIndex
CREATE INDEX "StockTransfer_groupId_createdAt_idx" ON "StockTransfer"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_groupId_requestKey_key" ON "StockTransfer"("groupId", "requestKey");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "StockTransferItem_fromItemId_idx" ON "StockTransferItem"("fromItemId");

-- CreateIndex
CREATE INDEX "StockTransferItem_toItemId_idx" ON "StockTransferItem"("toItemId");

-- CreateIndex
CREATE INDEX "Store_groupId_idx" ON "Store"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_groupId_groupKind_key" ON "Store"("groupId", "groupKind");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StoreGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StoreGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

