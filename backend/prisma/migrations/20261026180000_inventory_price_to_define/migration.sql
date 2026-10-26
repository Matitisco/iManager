-- Preserve every existing price; absence is distinct from zero.
ALTER TABLE "InventoryItem" ALTER COLUMN "price" DROP NOT NULL;
ALTER TABLE "StockCountExpected" ALTER COLUMN "price" DROP NOT NULL;
