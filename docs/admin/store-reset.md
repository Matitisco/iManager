# Reset de operaciones de una tienda

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

`scope` es opcional y su único valor aceptado es `"full"`. Al omitirlo se mantiene el reset actual de ventas/inventario, que conserva clientes y reparaciones. Para borrar también clientes y reparaciones, el body exacto de preview es (reemplazar las tres identidades por los valores de la tienda):

```json
{
  "storeEmail": "owner@example.com",
  "expectStoreName": "Tienda ejemplo",
  "expectStoreId": "id-exacto-de-la-tienda",
  "scope": "full",
  "dryRun": true
}
```

Respuesta **200**:

```ts
{
  dryRun: boolean;
  store: { id: string; name: string };
  willDelete: Record<string, number>;
  willKeep: Record<string, number>;
}
```

Sin `scope`, `willDelete` tiene exactamente estas 20 claves, con conteos enteros >= 0 (filas, no unidades de stock):

```text
NotificationRead, SectionRecordView, StockCountScan, StockCountExpected,
StockCount, CreditNoteApplication, CreditNote, ReturnEvent, ReturnCase,
SaleInstallment, SaleInstallmentPlan, SaleTender, ClientDeposit,
ClientPayment, CommissionAccrual, CashMovement, Sale, TradeIn,
InventoryItem, StoreNotification
```

Con `scope: "full"` son **23 claves**: las 20 anteriores más `RepairStatusEvent`, `RepairOrder` y `Client`. Las tablas operativas se borran completas para esa tienda; `CashMovement`, notificaciones, lecturas y vistas solo incluyen las filas del alcance detallado abajo.

Los modelos compartidos solo cuentan filas seleccionadas. `willKeep` incluye los conteos conservados de todos los modelos clasificados, también las filas independientes de las tablas parcialmente borrables. Son conteos previos al nuevo evento de auditoría.

Preview ejecuta las mismas mutaciones, ajustes, verificaciones y auditoría de apply en una transacción **Serializable** y hace rollback al final; no persiste cambios.

## Aplicar

Repetir los campos del preview, incluido `scope` si se usó, con `dryRun: false` y agregar **`expect` igual al objeto `willDelete` completo recibido**. En JavaScript:

```js
const applyBody = { ...previewBody, dryRun: false, expect: previewResponse.willDelete };
```

`expect` debe incluir las 20 claves del modo actual o las 23 de full, incluso las que tienen valor 0, particularmente `Sale` e `InventoryItem`. Si falta el objeto, falta/sobra una clave o cambia cualquier conteo recalculado, devuelve **409 sin cambios** y hay que repetir el preview. No se pueden usar conteos del modo actual para confirmar full ni viceversa. El body es estricto: no acepta claves adicionales, `storeId`, `confirm`, otros valores de `scope` ni strings como conteos; formatos inválidos devuelven 400. `expect` es opcional en preview y solo se verifica al aplicar.

La respuesta de apply tiene el mismo contrato con `dryRun: false`. Auth ausente/inválida devuelve 401; no-admin/email no verificado, 403. Conflictos Serializable o fallas de guards/postcondiciones devuelven 409; fallas internas, 500. Toda falla revierte la operación completa. No se ejecuta automáticamente un reintento de apply.

## Alcance y saldos sin scope (comportamiento actual)

Borra ventas, todos los equipos/productos de inventario (incluidos archivados), conteos/scans/snapshots de stock, cuotas/tenders, comisiones devengadas, cobros/movimientos ligados a ventas, devoluciones/créditos/canjes ligados a ventas o stock y las notificaciones/lecturas de esos registros. Se incluyen referencias estructuradas a ventas previamente eliminadas, créditos por excedente/cancelación y reversiones de caja. Los movimientos históricos sin saleId solo se borran cuando tienen los marcadores exactos de aplicación/restauración de señas por ventas escritos por el servidor.

Conserva tienda, usuarios, miembros/empleados, clientes, categorías/configuración, plan/billing y auditoría previa. También conserva reparaciones, proveedores/compras, gastos, pagos de comisiones, sesiones/conteos de caja, movimientos independientes, analytics e informes enviados. No reinicia numeración.

En clientes afectados reinicia totalSpent y lastPurchaseAt; elimina la porción de pendingBalance atribuible a ventas usando la misma atribución de cuenta corriente (pagos generales cubren las ventas más antiguas primero) y conserva saldo manual e historial importado. Los clientes sin ventas/cobros ligados se conservan completos. Las señas independientes conservan su crédito, liberando productId si se elimina el stock reservado. Los cobros genéricos sin vínculo de venta demostrable y los pagos de reparación se conservan.

Cada caja descuenta únicamente el neto de los movimientos borrados; no se ponen todas las cajas en 0. Las filas compartidas por venta y reparación, y los saldos que requieren cotizaciones históricas ausentes, bloquean con 409 para evitar atribuciones ambiguas.

## Alcance y saldos con scope full

Además de ventas, inventario e historial de stock, borra **todos** los clientes (también archivados), sus saldos, historial importado, campos/notas, cuenta corriente y depósitos/señas; **todas** las órdenes de reparación y eventos de estado, incluso sin cliente o archivadas; **todos** los canjes/borradores, devoluciones/reclamos, eventos, notas de crédito y aplicaciones, aunque sean independientes de ventas. También borra cuotas, tenders y comisiones devengadas.

No se separa la deuda de ventas ni se convierte ningún saldo del cliente. **Nunca bloquea por cotización histórica ausente**, incluso con cliente USD en tienda ARS. Los cobros/señas compartidos entre venta y reparación se borran porque ambos lados están incluidos.

Elimina los movimientos de caja con fuentes `sale`, `client`, `repair`, `deposit`, `return`, `trade-in` o `trade`, incluso si su operación ya no existe; incluye reversiones recursivas sin fuente. También elimina cobros/devoluciones automáticos históricos sin sourceType (`COBRO`/`DEVOLUCION`) o con sourceId identificable en el conjunto borrado. Conserva fondos/movimientos manuales, ajustes, transferencias independientes y definiciones de cajas, sesiones y arqueos históricos.

Cada caja descuenta el neto firmado atribuible de los movimientos borrados, sin convertir monedas ni consultar cotizaciones. Si un movimiento borrado tiene moneda incompatible con la caja, esa caja queda en **0**. Si no tiene registerId, quedan en **0** las cajas compatibles con su moneda y método; si faltan ambos metadatos, quedan en **0 todas las cajas de la tienda**. Este fallback prefiere saldo cero ante atribución incierta y no bloquea el reset; los arqueos/sesiones conservados son históricos. Las cajas de otras tiendas se conservan completas.

Conserva tienda, usuarios, miembros/empleados, invitaciones, configuración, categorías, catálogo de modelos/opciones/plantillas, campos personalizados (definiciones), plan/billing, numeración y auditoría previa. Proveedores/compras, gastos, pagos de comisiones, analytics e informes enviados permanecen. Elimina notificaciones/lecturas y vistas de los registros borrados o de las secciones de ventas, inventario, clientes, reparaciones, canjes y devoluciones; conserva avisos independientes de configuración.

## Auditoría y atomicidad

Ambos modos agregan un único `AuditEvent` con `action: "store.reset"`, `source: "system"`, email del platform admin, `scope` (`"sales-inventory"` al omitirlo, `"full"` al solicitarlo), conteos y `clientsReset` (clientes ajustados en el modo actual, clientes eliminados en full). Full incluye `cashRegistersZeroed`, cantidad de cajas llevadas a cero por atribución incierta. El preview revierte ese evento. Los fingerprints verifican filas preservadas y otras tiendas; cualquier cambio inesperado revierte la transacción completa. Ningún efecto se confirma fuera de la transacción. No loguear body ni respuesta.
