import { Prisma } from '@prisma/client';
import { DomainError } from './domain-error.js';

/** Actual FKs plus soft references intentionally retained after parent deletion.
 * Keep this manifest aligned with schema.prisma and the migration audit. */
export const STORE_REFERENCES = [
  {"table": "Client", "field": "categoryId", "parent": "ClientCategory", "historical": false},
  {"table": "InventoryItem", "field": "supplierId", "parent": "Supplier", "historical": false},
  {"table": "InventoryItem", "field": "stockPurchaseId", "parent": "StockPurchase", "historical": false},
  {"table": "InventoryItem", "field": "categoryId", "parent": "InventoryCategory", "historical": false},
  {"table": "Sale", "field": "sellerMemberId", "parent": "StoreMember", "historical": false},
  {"table": "Sale", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "Sale", "field": "categoryId", "parent": "SaleCategory", "historical": false},
  {"table": "Sale", "field": "inventoryItemId", "parent": "InventoryItem", "historical": false},
  {"table": "Sale", "field": "tradeInId", "parent": "TradeIn", "historical": false},
  {"table": "TradeIn", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "TradeIn", "field": "categoryId", "parent": "TradeInCategory", "historical": false},
  {"table": "TradeIn", "field": "receivedInventoryItemId", "parent": "InventoryItem", "historical": false},
  {"table": "RepairOrder", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "RepairStatusEvent", "field": "orderId", "parent": "RepairOrder", "historical": false},
  {"table": "ClientPayment", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "ClientPayment", "field": "repairOrderId", "parent": "RepairOrder", "historical": false},
  {"table": "CommissionRule", "field": "memberId", "parent": "StoreMember", "historical": false},
  {"table": "CommissionPayment", "field": "memberId", "parent": "StoreMember", "historical": false},
  {"table": "CommissionAccrual", "field": "memberId", "parent": "StoreMember", "historical": false},
  {"table": "ClientDeposit", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "SaleTender", "field": "saleId", "parent": "Sale", "historical": false},
  {"table": "SaleInstallmentPlan", "field": "saleId", "parent": "Sale", "historical": false},
  {"table": "SaleInstallmentPlan", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "SaleInstallment", "field": "planId", "parent": "SaleInstallmentPlan", "historical": false},
  {"table": "StockPurchase", "field": "supplierId", "parent": "Supplier", "historical": false},
  {"table": "ReturnCase", "field": "saleId", "parent": "Sale", "historical": false},
  {"table": "ReturnCase", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "ReturnCase", "field": "inventoryItemId", "parent": "InventoryItem", "historical": false},
  {"table": "ReturnCase", "field": "supplierId", "parent": "Supplier", "historical": false},
  {"table": "ReturnEvent", "field": "caseId", "parent": "ReturnCase", "historical": false},
  {"table": "CreditNote", "field": "clientId", "parent": "Client", "historical": false},
  {"table": "CreditNote", "field": "returnCaseId", "parent": "ReturnCase", "historical": false},
  {"table": "CreditNoteApplication", "field": "creditNoteId", "parent": "CreditNote", "historical": false},
  {"table": "CreditNoteApplication", "field": "saleId", "parent": "Sale", "historical": false},
  {"table": "CashSession", "field": "registerId", "parent": "CashRegister", "historical": false},
  {"table": "CashMovement", "field": "registerId", "parent": "CashRegister", "historical": false},
  {"table": "CashMovement", "field": "sessionId", "parent": "CashSession", "historical": false},
  {"table": "CashCount", "field": "sessionId", "parent": "CashSession", "historical": false},
  {"table": "StockCountExpected", "field": "stockCountId", "parent": "StockCount", "historical": false},
  {"table": "StockCountScan", "field": "stockCountId", "parent": "StockCount", "historical": false},
  {"table": "ClientPayment", "field": "saleId", "parent": "Sale", "historical": true},
  {"table": "SaleTender", "field": "clientId", "parent": "Client", "historical": true},
  {"table": "SaleInstallment", "field": "saleId", "parent": "Sale", "historical": true},
  {"table": "SaleInstallment", "field": "clientId", "parent": "Client", "historical": true},
  {"table": "ClientDeposit", "field": "productId", "parent": "InventoryItem", "historical": true},
  {"table": "ClientDeposit", "field": "saleId", "parent": "Sale", "historical": true},
  {"table": "ClientDeposit", "field": "repairId", "parent": "RepairOrder", "historical": true},
  {"table": "TradeIn", "field": "draftProductId", "parent": "InventoryItem", "historical": true},
  {"table": "TradeIn", "field": "draftSaleCategoryId", "parent": "SaleCategory", "historical": true},
  {"table": "TradeIn", "field": "draftSellerMemberId", "parent": "StoreMember", "historical": true},
  {"table": "CreditNote", "field": "saleId", "parent": "Sale", "historical": true},
  {"table": "CommissionAccrual", "field": "sourceSaleId", "parent": "Sale", "historical": true},
  {"table": "CommissionAccrual", "field": "ruleId", "parent": "CommissionRule", "historical": true},
  {"table": "InventoryItem", "field": "reservedDepositId", "parent": "ClientDeposit", "historical": true},
  {"table": "InventoryItem", "field": "reservedClientId", "parent": "Client", "historical": true},
  {"table": "CashMovement", "field": "reversalOf", "parent": "CashMovement", "historical": true},
  {"table": "StockCountExpected", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true},
  {"table": "StockCountScan", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true},
] as const;
export type StoreEntity = typeof STORE_REFERENCES[number]['table'];

/** Must run inside the mutation transaction, before using any related amounts or IDs.
 * Missing historical parents are allowed; an existing parent in another store never is.
 * KEY SHARE prevents a checked parent from being deleted until the transaction ends.
 * Store reassignment outside these services needs the separate database constraints. */
export async function assertStoreReferences(
  tx: Prisma.TransactionClient, storeId: string, table: StoreEntity,
  row: object | null | undefined,
) {
  if (!row) return;
  const record = row as Record<string, unknown>;
  if (record.storeId !== undefined && record.storeId !== storeId) throw new DomainError('Referencia de otra tienda', 409);
  for (const ref of STORE_REFERENCES.filter(ref => ref.table === table)) {
    const id = record[ref.field];
    if (id == null || id === '') continue;
    if (typeof id !== 'string') throw new DomainError('Referencia inválida', 400);
    const parents = await tx.$queryRaw<Array<{ storeId: string }>>(Prisma.sql`
      SELECT "storeId" FROM ${Prisma.raw('"' + ref.parent + '"')}
      WHERE "id" = ${id} FOR KEY SHARE
    `);
    if ((!parents.length && !ref.historical) || parents.some(parent => parent.storeId !== storeId)) {
      throw new DomainError('Una relación no pertenece a la tienda. Revisá la integridad del registro.', 409);
    }
  }
}

/** Check included parent rows before returning metadata or using related money. */
export function assertIncludedStore(storeId: string, ...rows: Array<{ storeId?: string } | null | undefined>) {
  if (rows.some(row => row?.storeId !== undefined && row.storeId !== storeId)) {
    throw new DomainError('Una relación no pertenece a la tienda. Revisá la integridad del registro.', 409);
  }
}
