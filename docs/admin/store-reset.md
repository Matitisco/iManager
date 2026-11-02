# Reset de ventas e inventario de una tienda

`POST /admin/store-reset`

Headers: `Authorization: Bearer <Firebase ID token>` y `Content-Type: application/json`. Solo platform admins: email verificado incluido en `ADMIN_EMAILS`. No se requiere pertenecer a la tienda. Disponible en cualquier entorno; no depende de `STORE_RESET_ALLOWED_STORE_IDS`.

## Preview

```json
{
  "storeEmail": "owner@example.com",
  "expectStoreName": "Tienda ejemplo",
  "expectStoreId": "id-exacto-de-la-tienda",
  "dryRun": true
}
```

El email (sin distinción de mayúsculas, con espacios exteriores eliminados) debe resolver exactamente una tienda donde ese usuario es OWNER activo. Nombre e ID se comparan literalmente. Un email inexistente, staff/OWNER removido, varias tiendas del mismo dueño o nombre/ID distintos devuelven **409 sin cambios**.

Respuesta **200**:

```ts
{
  dryRun: boolean;
  store: { id: string; name: string };
  willDelete: Record<string, number>;
  willKeep: Record<string, number>;
}
```

`willDelete` tiene exactamente estas 20 claves, con conteos enteros >= 0 (filas, no unidades de stock):

```text
NotificationRead, SectionRecordView, StockCountScan, StockCountExpected,
StockCount, CreditNoteApplication, CreditNote, ReturnEvent, ReturnCase,
SaleInstallment, SaleInstallmentPlan, SaleTender, ClientDeposit,
ClientPayment, CommissionAccrual, CashMovement, Sale, TradeIn,
InventoryItem, StoreNotification
```

Los modelos compartidos solo cuentan filas seleccionadas. `willKeep` incluye los conteos conservados de todos los modelos clasificados, también las filas independientes de las tablas parcialmente borrables. Son conteos previos al nuevo evento de auditoría.

Preview ejecuta las mismas mutaciones, ajustes, verificaciones y auditoría de apply en una transacción **Serializable** y hace rollback al final; no persiste cambios.

## Aplicar

Repetir los cuatro campos de identidad/operación con `dryRun: false` y agregar **`expect` igual al objeto `willDelete` completo recibido**. En JavaScript:

```js
const applyBody = { ...previewBody, dryRun: false, expect: previewResponse.willDelete };
```

`expect` debe incluir las 20 claves, incluso las que tienen valor 0, particularmente `Sale` e `InventoryItem`. Si falta el objeto, falta/sobra una clave o cambia cualquier conteo recalculado, devuelve **409 sin cambios** y hay que repetir el preview. El body es estricto: no acepta claves adicionales, `storeId`, `confirm` ni strings como conteos; formatos inválidos devuelven 400. `expect` es opcional en preview y solo se verifica al aplicar.

La respuesta de apply tiene el mismo contrato con `dryRun: false`. Auth ausente/inválida devuelve 401; no-admin/email no verificado, 403. Conflictos Serializable o fallas de guards/postcondiciones devuelven 409; fallas internas, 500. Toda falla revierte la operación completa. No se ejecuta automáticamente un reintento de apply.

## Alcance y saldos

Borra ventas, todos los equipos/productos de inventario (incluidos archivados), conteos/scans/snapshots de stock, cuotas/tenders, comisiones devengadas, cobros/movimientos ligados a ventas, devoluciones/créditos/canjes ligados a ventas o stock y las notificaciones/lecturas de esos registros. Se incluyen referencias estructuradas a ventas previamente eliminadas, créditos por excedente/cancelación y reversiones de caja. Los movimientos históricos sin saleId solo se borran cuando tienen los marcadores exactos de aplicación/restauración de señas por ventas escritos por el servidor.

Conserva tienda, usuarios, miembros/empleados, clientes, categorías/configuración, plan/billing y auditoría previa. También conserva reparaciones, proveedores/compras, gastos, pagos de comisiones, sesiones/conteos de caja, movimientos independientes, analytics e informes enviados. No reinicia numeración.

En clientes afectados reinicia totalSpent y lastPurchaseAt; elimina la porción de pendingBalance atribuible a ventas usando la misma atribución de cuenta corriente (pagos generales cubren las ventas más antiguas primero) y conserva saldo manual e historial importado. Los clientes sin ventas/cobros ligados se conservan completos. Las señas independientes conservan su crédito, liberando productId si se elimina el stock reservado. Los cobros genéricos sin vínculo de venta demostrable y los pagos de reparación se conservan.

Cada caja descuenta únicamente el neto de los movimientos borrados; no se ponen todas las cajas en 0. Las filas compartidas por venta y reparación, y los saldos que requieren cotizaciones históricas ausentes, bloquean con 409 para evitar atribuciones ambiguas.

Se agrega un único `AuditEvent` con `action: "store.reset"`, `source: "system"`, email del platform admin, conteos y cantidad de clientes ajustados. El preview revierte ese evento. Ningún efecto se confirma fuera de la transacción. No loguear body ni respuesta.
