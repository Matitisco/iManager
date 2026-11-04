-- Strictly additive: all constraints belong to the new table. No existing rows are changed.
CREATE TABLE "Consignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "inventoryItemId" TEXT NOT NULL REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(12,2) NOT NULL CHECK ("amount" > 0),
  "currency" VARCHAR(3) NOT NULL CHECK ("currency" IN ('ARS', 'USD')),
  "cantidad" INTEGER NOT NULL DEFAULT 1 CHECK ("cantidad" > 0),
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "saleId" TEXT REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK (("paidAt" IS NULL) = ("saleId" IS NULL))
);
CREATE UNIQUE INDEX "Consignment_saleId_key" ON "Consignment"("saleId");
CREATE INDEX "Consignment_storeId_idx" ON "Consignment"("storeId");
CREATE INDEX "Consignment_storeId_paidAt_deliveredAt_idx" ON "Consignment"("storeId", "paidAt", "deliveredAt");
CREATE INDEX "Consignment_clientId_idx" ON "Consignment"("clientId");
CREATE INDEX "Consignment_inventoryItemId_idx" ON "Consignment"("inventoryItemId");
CREATE UNIQUE INDEX "Consignment_pending_item_key" ON "Consignment"("storeId", "inventoryItemId") WHERE "paidAt" IS NULL;
