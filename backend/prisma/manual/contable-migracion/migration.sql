-- Solo lectura. Conteos agregados: no imprime IDs, clientes ni importes.
SELECT 'Client.categoryId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Client" c LEFT JOIN public."ClientCategory" p ON p."id" = c."categoryId" WHERE c."categoryId" IS NOT NULL
UNION ALL
SELECT 'InventoryItem.supplierId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."InventoryItem" c LEFT JOIN public."Supplier" p ON p."id" = c."supplierId" WHERE c."supplierId" IS NOT NULL
UNION ALL
SELECT 'InventoryItem.stockPurchaseId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."InventoryItem" c LEFT JOIN public."StockPurchase" p ON p."id" = c."stockPurchaseId" WHERE c."stockPurchaseId" IS NOT NULL
UNION ALL
SELECT 'InventoryItem.categoryId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."InventoryItem" c LEFT JOIN public."InventoryCategory" p ON p."id" = c."categoryId" WHERE c."categoryId" IS NOT NULL
UNION ALL
SELECT 'Sale.sellerMemberId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Sale" c LEFT JOIN public."StoreMember" p ON p."id" = c."sellerMemberId" WHERE c."sellerMemberId" IS NOT NULL
UNION ALL
SELECT 'Sale.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Sale" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'Sale.categoryId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Sale" c LEFT JOIN public."SaleCategory" p ON p."id" = c."categoryId" WHERE c."categoryId" IS NOT NULL
UNION ALL
SELECT 'Sale.inventoryItemId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Sale" c LEFT JOIN public."InventoryItem" p ON p."id" = c."inventoryItemId" WHERE c."inventoryItemId" IS NOT NULL
UNION ALL
SELECT 'Sale.tradeInId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."Sale" c LEFT JOIN public."TradeIn" p ON p."id" = c."tradeInId" WHERE c."tradeInId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."TradeIn" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.categoryId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."TradeIn" c LEFT JOIN public."TradeInCategory" p ON p."id" = c."categoryId" WHERE c."categoryId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.receivedInventoryItemId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."TradeIn" c LEFT JOIN public."InventoryItem" p ON p."id" = c."receivedInventoryItemId" WHERE c."receivedInventoryItemId" IS NOT NULL
UNION ALL
SELECT 'RepairOrder.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."RepairOrder" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'RepairStatusEvent.orderId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."RepairStatusEvent" c LEFT JOIN public."RepairOrder" p ON p."id" = c."orderId" WHERE c."orderId" IS NOT NULL
UNION ALL
SELECT 'ClientPayment.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ClientPayment" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'ClientPayment.repairOrderId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ClientPayment" c LEFT JOIN public."RepairOrder" p ON p."id" = c."repairOrderId" WHERE c."repairOrderId" IS NOT NULL
UNION ALL
SELECT 'CommissionRule.memberId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CommissionRule" c LEFT JOIN public."StoreMember" p ON p."id" = c."memberId" WHERE c."memberId" IS NOT NULL
UNION ALL
SELECT 'CommissionPayment.memberId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CommissionPayment" c LEFT JOIN public."StoreMember" p ON p."id" = c."memberId" WHERE c."memberId" IS NOT NULL
UNION ALL
SELECT 'CommissionAccrual.memberId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CommissionAccrual" c LEFT JOIN public."StoreMember" p ON p."id" = c."memberId" WHERE c."memberId" IS NOT NULL
UNION ALL
SELECT 'ClientDeposit.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ClientDeposit" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'SaleTender.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."SaleTender" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'SaleInstallmentPlan.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."SaleInstallmentPlan" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'SaleInstallmentPlan.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."SaleInstallmentPlan" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'SaleInstallment.planId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."SaleInstallment" c LEFT JOIN public."SaleInstallmentPlan" p ON p."id" = c."planId" WHERE c."planId" IS NOT NULL
UNION ALL
SELECT 'StockPurchase.supplierId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."StockPurchase" c LEFT JOIN public."Supplier" p ON p."id" = c."supplierId" WHERE c."supplierId" IS NOT NULL
UNION ALL
SELECT 'ReturnCase.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ReturnCase" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'ReturnCase.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ReturnCase" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'ReturnCase.inventoryItemId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ReturnCase" c LEFT JOIN public."InventoryItem" p ON p."id" = c."inventoryItemId" WHERE c."inventoryItemId" IS NOT NULL
UNION ALL
SELECT 'ReturnCase.supplierId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ReturnCase" c LEFT JOIN public."Supplier" p ON p."id" = c."supplierId" WHERE c."supplierId" IS NOT NULL
UNION ALL
SELECT 'ReturnEvent.caseId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."ReturnEvent" c LEFT JOIN public."ReturnCase" p ON p."id" = c."caseId" WHERE c."caseId" IS NOT NULL
UNION ALL
SELECT 'CreditNote.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CreditNote" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'CreditNote.returnCaseId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CreditNote" c LEFT JOIN public."ReturnCase" p ON p."id" = c."returnCaseId" WHERE c."returnCaseId" IS NOT NULL
UNION ALL
SELECT 'CreditNoteApplication.creditNoteId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CreditNoteApplication" c LEFT JOIN public."CreditNote" p ON p."id" = c."creditNoteId" WHERE c."creditNoteId" IS NOT NULL
UNION ALL
SELECT 'CreditNoteApplication.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CreditNoteApplication" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'CashSession.registerId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CashSession" c LEFT JOIN public."CashRegister" p ON p."id" = c."registerId" WHERE c."registerId" IS NOT NULL
UNION ALL
SELECT 'CashMovement.registerId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CashMovement" c LEFT JOIN public."CashRegister" p ON p."id" = c."registerId" WHERE c."registerId" IS NOT NULL
UNION ALL
SELECT 'CashMovement.sessionId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CashMovement" c LEFT JOIN public."CashSession" p ON p."id" = c."sessionId" WHERE c."sessionId" IS NOT NULL
UNION ALL
SELECT 'CashCount.sessionId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."CashCount" c LEFT JOIN public."CashSession" p ON p."id" = c."sessionId" WHERE c."sessionId" IS NOT NULL
UNION ALL
SELECT 'StockCountExpected.stockCountId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."StockCountExpected" c LEFT JOIN public."StockCount" p ON p."id" = c."stockCountId" WHERE c."stockCountId" IS NOT NULL
UNION ALL
SELECT 'StockCountScan.stockCountId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, false AS historical FROM public."StockCountScan" c LEFT JOIN public."StockCount" p ON p."id" = c."stockCountId" WHERE c."stockCountId" IS NOT NULL
UNION ALL
SELECT 'ClientPayment.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."ClientPayment" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'SaleTender.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."SaleTender" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'SaleInstallment.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."SaleInstallment" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'SaleInstallment.clientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."SaleInstallment" c LEFT JOIN public."Client" p ON p."id" = c."clientId" WHERE c."clientId" IS NOT NULL
UNION ALL
SELECT 'ClientDeposit.productId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."ClientDeposit" c LEFT JOIN public."InventoryItem" p ON p."id" = c."productId" WHERE c."productId" IS NOT NULL
UNION ALL
SELECT 'ClientDeposit.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."ClientDeposit" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'ClientDeposit.repairId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."ClientDeposit" c LEFT JOIN public."RepairOrder" p ON p."id" = c."repairId" WHERE c."repairId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.draftProductId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."TradeIn" c LEFT JOIN public."InventoryItem" p ON p."id" = c."draftProductId" WHERE c."draftProductId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.draftSaleCategoryId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."TradeIn" c LEFT JOIN public."SaleCategory" p ON p."id" = c."draftSaleCategoryId" WHERE c."draftSaleCategoryId" IS NOT NULL
UNION ALL
SELECT 'TradeIn.draftSellerMemberId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."TradeIn" c LEFT JOIN public."StoreMember" p ON p."id" = c."draftSellerMemberId" WHERE c."draftSellerMemberId" IS NOT NULL
UNION ALL
SELECT 'CreditNote.saleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."CreditNote" c LEFT JOIN public."Sale" p ON p."id" = c."saleId" WHERE c."saleId" IS NOT NULL
UNION ALL
SELECT 'CommissionAccrual.sourceSaleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."CommissionAccrual" c LEFT JOIN public."Sale" p ON p."id" = c."sourceSaleId" WHERE c."sourceSaleId" IS NOT NULL
UNION ALL
SELECT 'CommissionAccrual.ruleId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."CommissionAccrual" c LEFT JOIN public."CommissionRule" p ON p."id" = c."ruleId" WHERE c."ruleId" IS NOT NULL
UNION ALL
SELECT 'InventoryItem.reservedDepositId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."InventoryItem" c LEFT JOIN public."ClientDeposit" p ON p."id" = c."reservedDepositId" WHERE c."reservedDepositId" IS NOT NULL
UNION ALL
SELECT 'InventoryItem.reservedClientId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."InventoryItem" c LEFT JOIN public."Client" p ON p."id" = c."reservedClientId" WHERE c."reservedClientId" IS NOT NULL
UNION ALL
SELECT 'CashMovement.reversalOf' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."CashMovement" c LEFT JOIN public."CashMovement" p ON p."id" = c."reversalOf" WHERE c."reversalOf" IS NOT NULL
UNION ALL
SELECT 'StockCountExpected.inventoryItemId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."StockCountExpected" c LEFT JOIN public."InventoryItem" p ON p."id" = c."inventoryItemId" WHERE c."inventoryItemId" IS NOT NULL
UNION ALL
SELECT 'StockCountScan.inventoryItemId' AS relation, count(*) FILTER (WHERE p."id" IS NOT NULL AND c."storeId" <> p."storeId") AS cross_store, count(*) FILTER (WHERE p."id" IS NULL) AS missing_parent, true AS historical FROM public."StockCountScan" c LEFT JOIN public."InventoryItem" p ON p."id" = c."inventoryItemId" WHERE c."inventoryItemId" IS NOT NULL
ORDER BY relation;
WITH m(token, canonical) AS (VALUES ('COMPLETADA', 'COMPLETADA'), ('PENDIENTE', 'PENDIENTE'), ('CANCELADA', 'CANCELADA'), ('ANULADA', 'ANULADA'), ('COMPLETED', 'COMPLETADA'), ('PENDING', 'PENDIENTE'), ('CANCELLED', 'CANCELADA'), ('CANCELED', 'CANCELADA'), ('CANCELADO', 'CANCELADA'), ('ANULADO', 'ANULADA')) SELECT 'Sale.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."Sale" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('PENDIENTE', 'PENDIENTE'), ('APROBADO', 'APROBADO'), ('RECHAZADO', 'RECHAZADO'), ('EN_REVISION', 'EN REVISIÓN'), ('PERITAJE_TEC.', 'PERITAJE TÉC.'), ('LISTO', 'LISTO'), ('CANCELADO', 'CANCELADO'), ('ANULADO', 'ANULADO'), ('PENDING', 'PENDIENTE'), ('APPROVED', 'APROBADO'), ('REJECTED', 'RECHAZADO'), ('COMPLETADO', 'LISTO'), ('COMPLETADA', 'LISTO'), ('COMPLETED', 'LISTO'), ('CANCELLED', 'CANCELADO'), ('CANCELED', 'CANCELADO'), ('CANCELADA', 'CANCELADO'), ('ANULADA', 'ANULADO')) SELECT 'TradeIn.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."TradeIn" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('COMPLETADA', 'COMPLETADA'), ('PENDIENTE', 'PENDIENTE'), ('CANCELADA', 'CANCELADA'), ('ANULADA', 'ANULADA'), ('COMPLETED', 'COMPLETADA'), ('PENDING', 'PENDIENTE'), ('CANCELLED', 'CANCELADA'), ('CANCELED', 'CANCELADA'), ('CANCELADO', 'CANCELADA'), ('ANULADO', 'ANULADA')) SELECT 'TradeIn.draftPaymentStatus' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."draftPaymentStatus" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."TradeIn" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("draftPaymentStatus"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."draftPaymentStatus" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('PAGO', 'PAGO'), ('DEVOLUCION', 'DEVOLUCION'), ('VUELTO', 'VUELTO'), ('CARGO', 'CARGO'), ('NOTA_CREDITO', 'NOTA_CREDITO'), ('SENA', 'SENA'), ('CREDITO', 'CREDITO'), ('APLICACION', 'APLICACION')) SELECT 'ClientPayment.kind' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."kind" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."ClientPayment" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("kind"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."kind" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('COBRO', 'COBRO'), ('VUELTO', 'VUELTO')) SELECT 'SaleTender.role' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."role" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."SaleTender" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("role"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."role" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('CANCELLED', 'CANCELLED'), ('DELETED', 'DELETED'), ('EDITED', 'EDITED')) SELECT 'CommissionAccrual.voidReason' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."voidReason" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."CommissionAccrual" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("voidReason"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."voidReason" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('ACTIVE', 'ACTIVE'), ('CREDIT', 'CREDIT'), ('APPLIED', 'APPLIED'), ('REFUNDED', 'REFUNDED'), ('REVERSED', 'REVERSED')) SELECT 'ClientDeposit.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."ClientDeposit" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('ABIERTO', 'ABIERTO'), ('EN_DIAGNOSTICO', 'EN_DIAGNOSTICO'), ('EN_PROVEEDOR', 'EN_PROVEEDOR'), ('RESUELTO', 'RESUELTO'), ('ANULADO', 'ANULADO')) SELECT 'ReturnCase.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."ReturnCase" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('ENVIADO', 'ENVIADO'), ('EN_REVISION', 'EN_REVISION'), ('APROBADO', 'APROBADO'), ('RECHAZADO', 'RECHAZADO'), ('RECIBIDO', 'RECIBIDO')) SELECT 'ReturnCase.rmaStatus' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."rmaStatus" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."ReturnCase" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("rmaStatus"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."rmaStatus" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('ABIERTO', 'ABIERTO'), ('EN_DIAGNOSTICO', 'EN_DIAGNOSTICO'), ('EN_PROVEEDOR', 'EN_PROVEEDOR'), ('RESUELTO', 'RESUELTO'), ('ANULADO', 'ANULADO'), ('ENVIADO', 'ENVIADO'), ('EN_REVISION', 'EN_REVISION'), ('APROBADO', 'APROBADO'), ('RECHAZADO', 'RECHAZADO'), ('RECIBIDO', 'RECIBIDO')) SELECT 'ReturnEvent.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."ReturnEvent" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('ABIERTA', 'ABIERTA'), ('APLICADA', 'APLICADA')) SELECT 'CreditNote.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."CreditNote" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('OPEN', 'OPEN'), ('SUBMITTED', 'SUBMITTED'), ('APPROVED', 'APPROVED'), ('RECOUNT', 'RECOUNT')) SELECT 'CashSession.status' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."status" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."CashSession" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("status"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."status" IS NOT NULL;
WITH m(token, canonical) AS (VALUES ('FONDO', 'FONDO'), ('INGRESO', 'INGRESO'), ('EGRESO', 'EGRESO'), ('AJUSTE', 'AJUSTE'), ('TRANSFERENCIA', 'TRANSFERENCIA'), ('COBRO', 'COBRO'), ('DEVOLUCION', 'DEVOLUCION'), ('ANULACION', 'ANULACION'), ('ARQUEO', 'ARQUEO')) SELECT 'CashMovement.kind' AS field, count(*) FILTER (WHERE m.canonical IS NOT NULL AND t."kind" <> m.canonical) AS normalizable, count(*) FILTER (WHERE m.canonical IS NULL) AS unknown FROM public."CashMovement" t LEFT JOIN m ON m.token = upper(regexp_replace(regexp_replace(normalize(btrim("kind"), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g')) WHERE t."kind" IS NOT NULL;
SET statement_timeout = '15min';
-- Fuera de transacción. Sólo índices parciales propios para comprobaciones de tombstones.
SET lock_timeout = '2s';
SET statement_timeout = '15min';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_ClientPayment_saleId" ON public."ClientPayment" ("saleId") WHERE "saleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_SaleTender_clientId" ON public."SaleTender" ("clientId") WHERE "clientId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_SaleInstallment_saleId" ON public."SaleInstallment" ("saleId") WHERE "saleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_SaleInstallment_clientId" ON public."SaleInstallment" ("clientId") WHERE "clientId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_ClientDeposit_productId" ON public."ClientDeposit" ("productId") WHERE "productId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_ClientDeposit_saleId" ON public."ClientDeposit" ("saleId") WHERE "saleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_ClientDeposit_repairId" ON public."ClientDeposit" ("repairId") WHERE "repairId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_TradeIn_draftProductId" ON public."TradeIn" ("draftProductId") WHERE "draftProductId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_TradeIn_draftSaleCategoryId" ON public."TradeIn" ("draftSaleCategoryId") WHERE "draftSaleCategoryId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_TradeIn_draftSellerMemberId" ON public."TradeIn" ("draftSellerMemberId") WHERE "draftSellerMemberId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_CreditNote_saleId" ON public."CreditNote" ("saleId") WHERE "saleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_CommissionAccrual_sourceSaleId" ON public."CommissionAccrual" ("sourceSaleId") WHERE "sourceSaleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_CommissionAccrual_ruleId" ON public."CommissionAccrual" ("ruleId") WHERE "ruleId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_InventoryItem_reservedDepositId" ON public."InventoryItem" ("reservedDepositId") WHERE "reservedDepositId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_InventoryItem_reservedClientId" ON public."InventoryItem" ("reservedClientId") WHERE "reservedClientId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_CashMovement_reversalOf" ON public."CashMovement" ("reversalOf") WHERE "reversalOf" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_StockCountExpected_inventoryItemId" ON public."StockCountExpected" ("inventoryItemId") WHERE "inventoryItemId" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contable_ref_StockCountScan_inventoryItemId" ON public."StockCountScan" ("inventoryItemId") WHERE "inventoryItemId" IS NOT NULL;
DO $indexes$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_ClientPayment_saleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_ClientPayment_saleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_SaleTender_clientId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_SaleTender_clientId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_SaleInstallment_saleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_SaleInstallment_saleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_SaleInstallment_clientId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_SaleInstallment_clientId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_ClientDeposit_productId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_ClientDeposit_productId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_ClientDeposit_saleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_ClientDeposit_saleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_ClientDeposit_repairId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_ClientDeposit_repairId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_TradeIn_draftProductId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_TradeIn_draftProductId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_TradeIn_draftSaleCategoryId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_TradeIn_draftSaleCategoryId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_TradeIn_draftSellerMemberId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_TradeIn_draftSellerMemberId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_CreditNote_saleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_CreditNote_saleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_CommissionAccrual_sourceSaleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_CommissionAccrual_sourceSaleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_CommissionAccrual_ruleId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_CommissionAccrual_ruleId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_InventoryItem_reservedDepositId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_InventoryItem_reservedDepositId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_InventoryItem_reservedClientId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_InventoryItem_reservedClientId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_CashMovement_reversalOf"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_CashMovement_reversalOf'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_StockCountExpected_inventoryItemId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_StockCountExpected_inventoryItemId'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid=to_regclass('public."contable_ref_StockCountScan_inventoryItemId"') AND i.indisvalid AND i.indisready) THEN RAISE EXCEPTION 'Indice concurrente incompleto: contable_ref_StockCountScan_inventoryItemId'; END IF;
END $indexes$;

-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
CREATE OR REPLACE FUNCTION public.contable_normalize_state(domain text, value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog, public AS $fn$
  SELECT COALESCE((SELECT canonical FROM (VALUES
('sale', 'COMPLETADA', 'COMPLETADA'),
('sale', 'PENDIENTE', 'PENDIENTE'),
('sale', 'CANCELADA', 'CANCELADA'),
('sale', 'ANULADA', 'ANULADA'),
('sale', 'COMPLETED', 'COMPLETADA'),
('sale', 'PENDING', 'PENDIENTE'),
('sale', 'CANCELLED', 'CANCELADA'),
('sale', 'CANCELED', 'CANCELADA'),
('sale', 'CANCELADO', 'CANCELADA'),
('sale', 'ANULADO', 'ANULADA'),
('trade', 'PENDIENTE', 'PENDIENTE'),
('trade', 'APROBADO', 'APROBADO'),
('trade', 'RECHAZADO', 'RECHAZADO'),
('trade', 'EN_REVISION', 'EN REVISIÓN'),
('trade', 'PERITAJE_TEC.', 'PERITAJE TÉC.'),
('trade', 'LISTO', 'LISTO'),
('trade', 'CANCELADO', 'CANCELADO'),
('trade', 'ANULADO', 'ANULADO'),
('trade', 'PENDING', 'PENDIENTE'),
('trade', 'APPROVED', 'APROBADO'),
('trade', 'REJECTED', 'RECHAZADO'),
('trade', 'COMPLETADO', 'LISTO'),
('trade', 'COMPLETADA', 'LISTO'),
('trade', 'COMPLETED', 'LISTO'),
('trade', 'CANCELLED', 'CANCELADO'),
('trade', 'CANCELED', 'CANCELADO'),
('trade', 'CANCELADA', 'CANCELADO'),
('trade', 'ANULADA', 'ANULADO'),
('deposit', 'ACTIVE', 'ACTIVE'),
('deposit', 'CREDIT', 'CREDIT'),
('deposit', 'APPLIED', 'APPLIED'),
('deposit', 'REFUNDED', 'REFUNDED'),
('deposit', 'REVERSED', 'REVERSED'),
('paymentKind', 'PAGO', 'PAGO'),
('paymentKind', 'DEVOLUCION', 'DEVOLUCION'),
('paymentKind', 'VUELTO', 'VUELTO'),
('paymentKind', 'CARGO', 'CARGO'),
('paymentKind', 'NOTA_CREDITO', 'NOTA_CREDITO'),
('paymentKind', 'SENA', 'SENA'),
('paymentKind', 'CREDITO', 'CREDITO'),
('paymentKind', 'APLICACION', 'APLICACION'),
('tenderRole', 'COBRO', 'COBRO'),
('tenderRole', 'VUELTO', 'VUELTO'),
('commissionVoid', 'CANCELLED', 'CANCELLED'),
('commissionVoid', 'DELETED', 'DELETED'),
('commissionVoid', 'EDITED', 'EDITED'),
('return', 'ABIERTO', 'ABIERTO'),
('return', 'EN_DIAGNOSTICO', 'EN_DIAGNOSTICO'),
('return', 'EN_PROVEEDOR', 'EN_PROVEEDOR'),
('return', 'RESUELTO', 'RESUELTO'),
('return', 'ANULADO', 'ANULADO'),
('returnEvent', 'ABIERTO', 'ABIERTO'),
('returnEvent', 'EN_DIAGNOSTICO', 'EN_DIAGNOSTICO'),
('returnEvent', 'EN_PROVEEDOR', 'EN_PROVEEDOR'),
('returnEvent', 'RESUELTO', 'RESUELTO'),
('returnEvent', 'ANULADO', 'ANULADO'),
('returnEvent', 'ENVIADO', 'ENVIADO'),
('returnEvent', 'EN_REVISION', 'EN_REVISION'),
('returnEvent', 'APROBADO', 'APROBADO'),
('returnEvent', 'RECHAZADO', 'RECHAZADO'),
('returnEvent', 'RECIBIDO', 'RECIBIDO'),
('rma', 'ENVIADO', 'ENVIADO'),
('rma', 'EN_REVISION', 'EN_REVISION'),
('rma', 'APROBADO', 'APROBADO'),
('rma', 'RECHAZADO', 'RECHAZADO'),
('rma', 'RECIBIDO', 'RECIBIDO'),
('credit', 'ABIERTA', 'ABIERTA'),
('credit', 'APLICADA', 'APLICADA'),
('cashSession', 'OPEN', 'OPEN'),
('cashSession', 'SUBMITTED', 'SUBMITTED'),
('cashSession', 'APPROVED', 'APPROVED'),
('cashSession', 'RECOUNT', 'RECOUNT'),
('cashKind', 'FONDO', 'FONDO'),
('cashKind', 'INGRESO', 'INGRESO'),
('cashKind', 'EGRESO', 'EGRESO'),
('cashKind', 'AJUSTE', 'AJUSTE'),
('cashKind', 'TRANSFERENCIA', 'TRANSFERENCIA'),
('cashKind', 'COBRO', 'COBRO'),
('cashKind', 'DEVOLUCION', 'DEVOLUCION'),
('cashKind', 'ANULACION', 'ANULACION'),
('cashKind', 'ARQUEO', 'ARQUEO')
  ) AS m(domain_key, token, canonical) WHERE domain_key = domain AND token = upper(regexp_replace(regexp_replace(normalize(btrim(value), NFD), U&'[\0300-\036f]', '', 'g'), '[[:space:]_]+', '_', 'g'))), value)
$fn$;
CREATE SCHEMA IF NOT EXISTS contable_migration;
CREATE TABLE IF NOT EXISTS contable_migration."StateBackfill" (
  "tableName" text NOT NULL, "rowId" text NOT NULL, "fieldName" text NOT NULL,
  "oldValue" text NOT NULL, "newValue" text NOT NULL,
  "rowUpdatedAt" text,
  "changedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tableName", "rowId", "fieldName")
);

ALTER TABLE contable_migration."StateBackfill" ADD COLUMN IF NOT EXISTS "rowUpdatedAt" text;

CREATE OR REPLACE FUNCTION public.contable_child_store_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE spec jsonb; row_data jsonb := to_jsonb(NEW); parent_id text; parent_store text;
BEGIN
  FOR spec IN SELECT value FROM jsonb_array_elements(TG_ARGV[0]::jsonb) LOOP
    parent_id := row_data ->> (spec ->> 'field');
    IF parent_id IS NULL THEN CONTINUE; END IF;
    -- Serialize soft-reference creation with a future parent reusing a tombstone ID.
    PERFORM pg_advisory_xact_lock(hashtextextended('contable:' || (spec ->> 'parent') || ':' || parent_id, 0));
    parent_store := NULL;
    EXECUTE format('SELECT "storeId" FROM public.%I WHERE "id" = $1 FOR KEY SHARE', spec ->> 'parent')
      INTO parent_store USING parent_id;
    IF parent_store IS NULL AND NOT (spec ->> 'historical')::boolean THEN
      RAISE EXCEPTION 'Padre inexistente en %.%', TG_TABLE_NAME, spec ->> 'field' USING ERRCODE = '23503';
    END IF;
    IF parent_store IS NULL AND current_setting('transaction_isolation') = 'repeatable read' THEN
      RAISE EXCEPTION 'Reintentar la referencia historica en READ COMMITTED o SERIALIZABLE' USING ERRCODE = '40001';
    END IF;
    IF parent_store IS NOT NULL AND parent_store IS DISTINCT FROM (row_data ->> 'storeId') THEN
      RAISE EXCEPTION 'Relacion entre tiendas en %.%', TG_TABLE_NAME, spec ->> 'field' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.contable_parent_store_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE spec jsonb; conflicts boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."storeId" IS DISTINCT FROM OLD."storeId" THEN
      RAISE EXCEPTION 'storeId inmutable en %', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF NEW."id" IS NOT DISTINCT FROM OLD."id" THEN RETURN NEW; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('contable:' || TG_TABLE_NAME || ':' || NEW."id", 0));
  FOR spec IN SELECT value FROM jsonb_array_elements(TG_ARGV[0]::jsonb) LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND "storeId" <> $2)', spec ->> 'table', spec ->> 'field')
      INTO conflicts USING NEW."id", NEW."storeId";
    IF conflicts THEN
      RAISE EXCEPTION 'ID historico referido desde otra tienda en %', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $fn$;
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."CashMovement";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."CashMovement"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "CashMovement", "field": "reversalOf", "parent": "CashMovement", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."CashRegister";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."CashRegister"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."CashSession";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."CashSession"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."Client";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."Client"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "SaleTender", "field": "clientId", "parent": "Client", "historical": true}, {"table": "SaleInstallment", "field": "clientId", "parent": "Client", "historical": true}, {"table": "InventoryItem", "field": "reservedClientId", "parent": "Client", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."ClientCategory";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."ClientCategory"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."ClientDeposit";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."ClientDeposit"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "InventoryItem", "field": "reservedDepositId", "parent": "ClientDeposit", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."CommissionRule";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."CommissionRule"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "CommissionAccrual", "field": "ruleId", "parent": "CommissionRule", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."CreditNote";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."CreditNote"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."InventoryCategory";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."InventoryCategory"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."InventoryItem";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."InventoryItem"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "ClientDeposit", "field": "productId", "parent": "InventoryItem", "historical": true}, {"table": "TradeIn", "field": "draftProductId", "parent": "InventoryItem", "historical": true}, {"table": "StockCountExpected", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true}, {"table": "StockCountScan", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."RepairOrder";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."RepairOrder"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "ClientDeposit", "field": "repairId", "parent": "RepairOrder", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."ReturnCase";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."ReturnCase"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."Sale";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."Sale"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "ClientPayment", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "SaleInstallment", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "ClientDeposit", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "CreditNote", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "CommissionAccrual", "field": "sourceSaleId", "parent": "Sale", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."SaleCategory";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."SaleCategory"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "TradeIn", "field": "draftSaleCategoryId", "parent": "SaleCategory", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."SaleInstallmentPlan";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."SaleInstallmentPlan"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."StockCount";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."StockCount"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."StockPurchase";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."StockPurchase"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."StoreMember";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."StoreMember"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[{"table": "TradeIn", "field": "draftSellerMemberId", "parent": "StoreMember", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."Supplier";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."Supplier"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."TradeIn";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."TradeIn"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_parent_store_guard ON public."TradeInCategory";
CREATE TRIGGER contable_parent_store_guard BEFORE INSERT OR UPDATE OF "storeId", "id" ON public."TradeInCategory"
FOR EACH ROW EXECUTE FUNCTION public.contable_parent_store_guard('[]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CashCount";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "sessionId", "storeId" ON public."CashCount"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CashCount", "field": "sessionId", "parent": "CashSession", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CashMovement";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "registerId", "reversalOf", "sessionId", "storeId" ON public."CashMovement"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CashMovement", "field": "registerId", "parent": "CashRegister", "historical": false}, {"table": "CashMovement", "field": "sessionId", "parent": "CashSession", "historical": false}, {"table": "CashMovement", "field": "reversalOf", "parent": "CashMovement", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CashSession";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "registerId", "storeId" ON public."CashSession"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CashSession", "field": "registerId", "parent": "CashRegister", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."Client";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "categoryId", "storeId" ON public."Client"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "Client", "field": "categoryId", "parent": "ClientCategory", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."ClientDeposit";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "productId", "repairId", "saleId", "storeId" ON public."ClientDeposit"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "ClientDeposit", "field": "clientId", "parent": "Client", "historical": false}, {"table": "ClientDeposit", "field": "productId", "parent": "InventoryItem", "historical": true}, {"table": "ClientDeposit", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "ClientDeposit", "field": "repairId", "parent": "RepairOrder", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."ClientPayment";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "repairOrderId", "saleId", "storeId" ON public."ClientPayment"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "ClientPayment", "field": "clientId", "parent": "Client", "historical": false}, {"table": "ClientPayment", "field": "repairOrderId", "parent": "RepairOrder", "historical": false}, {"table": "ClientPayment", "field": "saleId", "parent": "Sale", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CommissionAccrual";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "memberId", "ruleId", "sourceSaleId", "storeId" ON public."CommissionAccrual"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CommissionAccrual", "field": "memberId", "parent": "StoreMember", "historical": false}, {"table": "CommissionAccrual", "field": "sourceSaleId", "parent": "Sale", "historical": true}, {"table": "CommissionAccrual", "field": "ruleId", "parent": "CommissionRule", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CommissionPayment";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "memberId", "storeId" ON public."CommissionPayment"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CommissionPayment", "field": "memberId", "parent": "StoreMember", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CommissionRule";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "memberId", "storeId" ON public."CommissionRule"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CommissionRule", "field": "memberId", "parent": "StoreMember", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CreditNote";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "returnCaseId", "saleId", "storeId" ON public."CreditNote"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CreditNote", "field": "clientId", "parent": "Client", "historical": false}, {"table": "CreditNote", "field": "returnCaseId", "parent": "ReturnCase", "historical": false}, {"table": "CreditNote", "field": "saleId", "parent": "Sale", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."CreditNoteApplication";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "creditNoteId", "saleId", "storeId" ON public."CreditNoteApplication"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "CreditNoteApplication", "field": "creditNoteId", "parent": "CreditNote", "historical": false}, {"table": "CreditNoteApplication", "field": "saleId", "parent": "Sale", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."InventoryItem";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "categoryId", "reservedClientId", "reservedDepositId", "stockPurchaseId", "storeId", "supplierId" ON public."InventoryItem"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "InventoryItem", "field": "supplierId", "parent": "Supplier", "historical": false}, {"table": "InventoryItem", "field": "stockPurchaseId", "parent": "StockPurchase", "historical": false}, {"table": "InventoryItem", "field": "categoryId", "parent": "InventoryCategory", "historical": false}, {"table": "InventoryItem", "field": "reservedDepositId", "parent": "ClientDeposit", "historical": true}, {"table": "InventoryItem", "field": "reservedClientId", "parent": "Client", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."RepairOrder";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "storeId" ON public."RepairOrder"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "RepairOrder", "field": "clientId", "parent": "Client", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."RepairStatusEvent";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "orderId", "storeId" ON public."RepairStatusEvent"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "RepairStatusEvent", "field": "orderId", "parent": "RepairOrder", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."ReturnCase";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "inventoryItemId", "saleId", "storeId", "supplierId" ON public."ReturnCase"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "ReturnCase", "field": "saleId", "parent": "Sale", "historical": false}, {"table": "ReturnCase", "field": "clientId", "parent": "Client", "historical": false}, {"table": "ReturnCase", "field": "inventoryItemId", "parent": "InventoryItem", "historical": false}, {"table": "ReturnCase", "field": "supplierId", "parent": "Supplier", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."ReturnEvent";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "caseId", "storeId" ON public."ReturnEvent"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "ReturnEvent", "field": "caseId", "parent": "ReturnCase", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."Sale";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "categoryId", "clientId", "inventoryItemId", "sellerMemberId", "storeId", "tradeInId" ON public."Sale"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "Sale", "field": "sellerMemberId", "parent": "StoreMember", "historical": false}, {"table": "Sale", "field": "clientId", "parent": "Client", "historical": false}, {"table": "Sale", "field": "categoryId", "parent": "SaleCategory", "historical": false}, {"table": "Sale", "field": "inventoryItemId", "parent": "InventoryItem", "historical": false}, {"table": "Sale", "field": "tradeInId", "parent": "TradeIn", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."SaleInstallment";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "planId", "saleId", "storeId" ON public."SaleInstallment"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "SaleInstallment", "field": "planId", "parent": "SaleInstallmentPlan", "historical": false}, {"table": "SaleInstallment", "field": "saleId", "parent": "Sale", "historical": true}, {"table": "SaleInstallment", "field": "clientId", "parent": "Client", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."SaleInstallmentPlan";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "saleId", "storeId" ON public."SaleInstallmentPlan"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "SaleInstallmentPlan", "field": "saleId", "parent": "Sale", "historical": false}, {"table": "SaleInstallmentPlan", "field": "clientId", "parent": "Client", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."SaleTender";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "clientId", "saleId", "storeId" ON public."SaleTender"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "SaleTender", "field": "saleId", "parent": "Sale", "historical": false}, {"table": "SaleTender", "field": "clientId", "parent": "Client", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."StockCountExpected";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "inventoryItemId", "stockCountId", "storeId" ON public."StockCountExpected"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "StockCountExpected", "field": "stockCountId", "parent": "StockCount", "historical": false}, {"table": "StockCountExpected", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."StockCountScan";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "inventoryItemId", "stockCountId", "storeId" ON public."StockCountScan"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "StockCountScan", "field": "stockCountId", "parent": "StockCount", "historical": false}, {"table": "StockCountScan", "field": "inventoryItemId", "parent": "InventoryItem", "historical": true}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."StockPurchase";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "storeId", "supplierId" ON public."StockPurchase"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "StockPurchase", "field": "supplierId", "parent": "Supplier", "historical": false}]');
COMMIT;
-- NO MERGEAR / no ejecutar en bases reales sin OK de Matias.
-- Aditiva; fase manual. No toca schema.prisma ni reemplaza FKs existentes.
-- Cada tabla se bloquea por separado, brevemente; reintentar si lock_timeout.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
DROP TRIGGER IF EXISTS contable_child_store_guard ON public."TradeIn";
CREATE TRIGGER contable_child_store_guard BEFORE INSERT OR UPDATE OF "categoryId", "clientId", "draftProductId", "draftSaleCategoryId", "draftSellerMemberId", "receivedInventoryItemId", "storeId" ON public."TradeIn"
FOR EACH ROW EXECUTE FUNCTION public.contable_child_store_guard('[{"table": "TradeIn", "field": "clientId", "parent": "Client", "historical": false}, {"table": "TradeIn", "field": "categoryId", "parent": "TradeInCategory", "historical": false}, {"table": "TradeIn", "field": "receivedInventoryItemId", "parent": "InventoryItem", "historical": false}, {"table": "TradeIn", "field": "draftProductId", "parent": "InventoryItem", "historical": true}, {"table": "TradeIn", "field": "draftSaleCategoryId", "parent": "SaleCategory", "historical": true}, {"table": "TradeIn", "field": "draftSellerMemberId", "parent": "StoreMember", "historical": true}]');
COMMIT;
