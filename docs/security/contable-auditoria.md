# Estados contables y relaciones por tienda

Auditoría estática del 2026-11-03 sobre `origin/test` después de #716 y #721–#730. Se leyeron schema, migraciones existentes y servicios. **No se inspeccionaron datos reales.** Las variantes que aparecen aquí proceden del código/fixtures, no de mediciones en test o producción.

## Estados y comparaciones

| Datos | Persistencia y valores | Dónde se comparan / riesgo encontrado |
| --- | --- | --- |
| `Sale.status`, `TradeIn.draftPaymentStatus` | String: COMPLETADA, PENDIENTE, CANCELADA; ANULADA histórico. CANCELLED reconocido solo por algunos consumidores. | sales/operations, accounts/ledger, cancel-refund, commissions, returns, clients, reports, inventory/import. Distintos filtros excluían distintas anulaciones. |
| `TradeIn.status` | String y catálogo personalizable: PENDIENTE, APROBADO, RECHAZADO, EN REVISIÓN, PERITAJE TÉC., LISTO, CANCELADO/ANULADO. | operations/trade-ins, reports y permisos sensibles. El importador tenía otra lista. |
| `TradeIn.confirmationStatus` | Enum Prisma PENDING/CONFIRMED/CANCELLED nullable. | Controla confirmación real, separado del estado del peritaje. No convertir APROBADO en confirmación/cobro. |
| `StockPurchase` | Sin campo de estado: `deletedAt/deletedBy`. | suppliers, acquired-quantity y reportes; no inventar un enum de compra pagada/pendiente. |
| `ClientPayment.kind` | String: PAGO, DEVOLUCION, VUELTO, CARGO, NOTA_CREDITO, SENA, CREDITO, APLICACION. | accounts, deposits, cancel-refund y restauración. Los últimos cuatro movimientos de seña no son un segundo cobro. |
| `SaleTender.role` | String: COBRO/VUELTO. | settlement/cash; no es estado de pago. |
| `ClientDeposit.status` | String: ACTIVE/CREDIT/APPLIED/REFUNDED/REVERSED. | depósitos, balances, cancelación/restauración. Vocabulario inglés deliberado. |
| Cuotas | Sin estado persistido. Derivado: PENDIENTE/PARCIAL/PAGADA/VENCIDA. | accounts/ledger a partir de amount, paidAmount y fecha. |
| Comisiones | `CommissionBasis` ya es enum; reglas usan active/deletedAt, pagos voidedAt; devengamientos `voidReason` String CANCELLED/DELETED/EDITED. | commission-ledger/math/service. Se excluye también ANULADA y alias antes ignorados. |
| `ReturnCase.status` | String ABIERTO/EN_DIAGNOSTICO/EN_PROVEEDOR/RESUELTO/ANULADO. | returns, suppliers y reports. `ReturnEvent.status` mezcla estados del reclamo y del RMA. |
| `ReturnCase.rmaStatus` | String nullable ENVIADO/EN_REVISION/APROBADO/RECHAZADO/RECIBIDO. | returns y cantidades adquiridas. resolution/settlement/destination tienen catálogos TS/Zod en returns-math, sin enum SQL. |
| `CreditNote.status` | String ABIERTA/APLICADA. | returns/coverSaleWithCredits. |
| `CashSession.status` | String OPEN/SUBMITTED/APPROVED/RECOUNT. | cash/service. `CashMovement.kind` también String: FONDO/INGRESO/EGRESO/AJUSTE/TRANSFERENCIA/COBRO/DEVOLUCION/ANULACION/ARQUEO; anulación real usa voidedAt/reversalOf. |
| Snapshots auxiliares | previousInventoryStatus, previousStatus, stockStatus, previousOutgoingStatus y cancellationSnapshot conservan estado de stock histórico. | Inventario/catálogo personalizable. No se restringen con una lista contable cerrada. RepairOrder/RepairStatusEvent también son personalizables y quedan fuera de la normalización financiera. |

## Cambio A: defensa de código

`accounting-states.ts` centraliza los vocabularios por dominio, normaliza variantes reconocidas al escribir/serializar/comparar y conserva valores desconocidos en lecturas. Zod sigue rechazando ventas nuevas desconocidas; catálogo de canjes conserva valores personalizados. No se añaden transiciones, cobros ni anulaciones compensatorias inferidas. El importador conserva su revisión histórica para estados desconocidos.

Los filtros de estado resuelven los spellings distintos realmente guardados **solo dentro de la tienda**, de modo que también reconocen espacios y variaciones de acento/case; no hacen un backfill. Agregan una consulta DISTINCT por filtro; medir costo con volumen real antes de quitar la capa de compatibilidad después del PR B. No se usa un match parcial que confundiera un estado personalizado con un cobro.

`store-references.ts` describe cada FK física y las referencias históricas sin FK. Las validaciones de los servicios se complementan con comprobación dentro de las transacciones antes de usar relaciones en ventas, canjes, cancelaciones/restauraciones, stock, cuotas, señas, comisiones, devoluciones y caja. Rechazo 409 sin exponer IDs/tienda ajenos. Los padres físicos deben existir; los tombstones sin FK pueden seguir apuntando a un padre eliminado, pero nunca a uno existente en otra tienda. KEY SHARE conserva el padre durante la transacción; escrituras SQL externas y reasignación de storeId necesitan defensa SQL.

## Relaciones auditadas

Todas las FKs físicas de esta tabla apuntan solo al `id` del padre. El `storeId` del hijo no forma parte de esa FK. `SaleItem`/`Payment` no existen con esos nombres: el inventario se relaciona directamente desde Sale y los cobros son ClientPayment/SaleTender. Identidades globales User, actores de auditoría y fuentes polimórficas de caja no son FKs de un recurso de tienda. Las referencias históricas sin FK no se deben convertir en FKs estrictas: romperían el borrado que conserva recibos/snapshots.

| Hijo.campo | Padre | Defensa SQL propuesta |
| --- | --- | --- |
| `Client.categoryId` | `ClientCategory` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `InventoryItem.supplierId` | `Supplier` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `InventoryItem.stockPurchaseId` | `StockPurchase` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `InventoryItem.categoryId` | `InventoryCategory` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `Sale.sellerMemberId` | `StoreMember` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `Sale.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `Sale.categoryId` | `SaleCategory` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `Sale.inventoryItemId` | `InventoryItem` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `Sale.tradeInId` | `TradeIn` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `TradeIn.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `TradeIn.categoryId` | `TradeInCategory` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `TradeIn.receivedInventoryItemId` | `InventoryItem` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `RepairOrder.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `RepairStatusEvent.orderId` | `RepairOrder` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ClientPayment.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ClientPayment.repairOrderId` | `RepairOrder` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CommissionRule.memberId` | `StoreMember` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CommissionPayment.memberId` | `StoreMember` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CommissionAccrual.memberId` | `StoreMember` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ClientDeposit.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `SaleTender.saleId` | `Sale` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `SaleInstallmentPlan.saleId` | `Sale` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `SaleInstallmentPlan.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `SaleInstallment.planId` | `SaleInstallmentPlan` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `StockPurchase.supplierId` | `Supplier` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ReturnCase.saleId` | `Sale` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ReturnCase.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ReturnCase.inventoryItemId` | `InventoryItem` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ReturnCase.supplierId` | `Supplier` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ReturnEvent.caseId` | `ReturnCase` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CreditNote.clientId` | `Client` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CreditNote.returnCaseId` | `ReturnCase` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CreditNoteApplication.creditNoteId` | `CreditNote` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CreditNoteApplication.saleId` | `Sale` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CashSession.registerId` | `CashRegister` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CashMovement.registerId` | `CashRegister` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CashMovement.sessionId` | `CashSession` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `CashCount.sessionId` | `CashSession` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `StockCountExpected.stockCountId` | `StockCount` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `StockCountScan.stockCountId` | `StockCount` | FK compuesta (id, storeId) o trigger que conserve el borrado original |
| `ClientPayment.saleId` | `Sale` | Trigger: si existe, misma tienda; conservar tombstone |
| `SaleTender.clientId` | `Client` | Trigger: si existe, misma tienda; conservar tombstone |
| `SaleInstallment.saleId` | `Sale` | Trigger: si existe, misma tienda; conservar tombstone |
| `SaleInstallment.clientId` | `Client` | Trigger: si existe, misma tienda; conservar tombstone |
| `ClientDeposit.productId` | `InventoryItem` | Trigger: si existe, misma tienda; conservar tombstone |
| `ClientDeposit.saleId` | `Sale` | Trigger: si existe, misma tienda; conservar tombstone |
| `ClientDeposit.repairId` | `RepairOrder` | Trigger: si existe, misma tienda; conservar tombstone |
| `TradeIn.draftProductId` | `InventoryItem` | Trigger: si existe, misma tienda; conservar tombstone |
| `TradeIn.draftSaleCategoryId` | `SaleCategory` | Trigger: si existe, misma tienda; conservar tombstone |
| `TradeIn.draftSellerMemberId` | `StoreMember` | Trigger: si existe, misma tienda; conservar tombstone |
| `CreditNote.saleId` | `Sale` | Trigger: si existe, misma tienda; conservar tombstone |
| `CommissionAccrual.sourceSaleId` | `Sale` | Trigger: si existe, misma tienda; conservar tombstone |
| `CommissionAccrual.ruleId` | `CommissionRule` | Trigger: si existe, misma tienda; conservar tombstone |
| `InventoryItem.reservedDepositId` | `ClientDeposit` | Trigger: si existe, misma tienda; conservar tombstone |
| `InventoryItem.reservedClientId` | `Client` | Trigger: si existe, misma tienda; conservar tombstone |
| `CashMovement.reversalOf` | `CashMovement` | Trigger: si existe, misma tienda; conservar tombstone |
| `StockCountExpected.inventoryItemId` | `InventoryItem` | Trigger: si existe, misma tienda; conservar tombstone |
| `StockCountScan.inventoryItemId` | `InventoryItem` | Trigger: si existe, misma tienda; conservar tombstone |

## Pendientes que necesitan OK de Matias

PR B separado: constraints/backfill, sin aplicar sobre bases reales ni integrar automáticamente. Antes de ejecutar: medir referencias cruzadas, huérfanos y estados desconocidos. No reasignar ni borrar datos inconsistentes automáticamente.

Se conservan las decisiones de #691 y las políticas pendientes de `logica-negocio.md`/`idor-ventas.md`: conversión del cobro de cuenta, reapertura COMPLETADA→PENDIENTE, y edición/importación que marque una anulación sin ejecutar sus efectos. Corregir esos flujos cambia comportamiento financiero y necesita decisión explícita; normalizar texto no repara stock/caja histórica.

Validación en PostgreSQL local exclusivo `contable_estados_fks`, puerto aleatorio >20000, datos sintéticos. Casos nuevos: 58 relaciones con control positivo, nulos/tombstones, filtros legacy y rollback en servicios frente a vínculos corruptos. Sin build, producción, schema ni migraciones en A.

Verificación A: TypeScript frontend/backend; 579 unitarias relacionadas (38 archivos; adaptación de mocks), 42 pruebas frontend relacionadas y 280 integraciones relacionadas (incluida la nueva lectura corrupta). Máximo dos workers simultáneos. CI completo solicitado por workflow_dispatch por alcance transversal.
