# Comisiones — API (#330, #334)

Todas las rutas requieren sesión y contexto de tienda. `period` es YYYY-MM en la zona horaria de la tienda. ARS/USD se conservan separados en `previousBalance`, `earned`, `adjustmentsTotal`, `paid`, `pending` y `carry`. `converted` proyecta importes con la cotización del devengado; deudas saldadas quedan en cero. Registros legados sin cotización usan el blue actual de DolarApi.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/commissions?period=YYYY-MM` | Comisiones: resumen del equipo, saldos y ventas sin vendedor |
| GET | `/api/commissions/members/:id?period=YYYY-MM` | Comisiones: ventas, pagos, ajustes y saldo de un miembro |
| GET | `/api/commissions/exchange-rate` | Miembro actual: blue vendedor, para guardar la cotización cuando el navegador no pudo obtenerla |
| GET | `/api/commissions/sellers` | Miembro actual: directorio mínimo de vendedores (id, nombre y rol) de su tienda |
| GET | `/api/commissions/mine?period=YYYY-MM` | Miembro actual: solo datos propios, sin costos/ganancia |
| GET, POST | `/api/commissions/rules` | Comisiones |
| PATCH, DELETE | `/api/commissions/rules/:id` | Comisiones |
| GET, POST | `/api/commissions/payments` | Comisiones; GET admite period y memberId |
| POST | `/api/commissions/payments/:id/void` | Comisiones; anulación idempotente con historial y auditoría |
| PATCH | `/api/commissions/sales/seller` | Comisiones; `{saleIds, sellerMemberId}` (null permite quitar vendedor) |
| GET | `/api/reports/commissions?from=YYYY-MM&to=YYYY-MM` | Comisiones y Reportes; totales por persona y período, hasta 120 meses |

Propietario tiene Comisiones por defecto. Socio/Empleado con `sections=null` no lo tienen; pueden recibirlo explícitamente. Costos/ganancia por venta requieren también Reportes. Mine nunca incluye esos campos, aun para Propietario o miembros con Reportes.

Las reglas admiten `memberId:null` (equipo), `basis` (PROFIT_PERCENT por defecto, SALE_PERCENT, FIXED_PER_UNIT), `rate`, `currency` para fijo y `effectiveFrom` (fecha YYYY-MM-DD local o timestamp ISO con offset). Una regla personal vigente prevalece sobre la de equipo. PATCH admite campos parciales, incluido `active:boolean` para activar/desactivar. Sólo reglas activas y sin `deletedAt` se aplican a nuevas ventas. DELETE conserva el registro con `deletedAt` y `active:false` y lo excluye del listado. El cálculo queda congelado al registrar/asignar una venta; crear, editar o eliminar reglas no cambia comisiones históricas.

Un pago admite `{memberId, period, amount, currency, exchangeRate, settlesCurrency, note?}`. Se pueden registrar varios pagos parciales. El importe convertido con la cotización del pago reduce solamente la deuda de settlesCurrency. Los pagos no se eliminan ni sobrescriben. Anular agrega `voidedAt` y `voidedBy`; el registro sigue en el historial y listado, pero queda excluido de pagado, saldo y asignación de ajustes.

Las altas de ventas/operaciones/importaciones aceptan vendedor opcional y nunca lo asignan por defecto. `registeredByUserId` conserva al usuario que registró la venta. `exchangeRate` positivo puede enviarse; si falta, el backend obtiene el blue vendedor actual. Una falla de cotización es visible, sin cotización inventada. Ediciones sin sellerMemberId conservan el vendedor existente; null lo quita. El nombre explícito del vendedor importado se resuelve solo si coincide con un miembro único de la tienda.

CommissionAccrual conserva snapshots y bajas aunque Sale se borre físicamente. Una venta cancelada/eliminada tiene comisión activa cero. Ganado y conteo son cero inmediatamente, también después del borrado físico. Los pagos liquidan el saldo de persona/moneda, sin vínculo directo a una venta: se asignan por orden de venta a snapshots elegibles antes del pago, usando `settlesCurrency` y la cotización del pago, con tope en la comisión original. La parte efectivamente pagada antes de la baja se muestra como «A descontar» el mes siguiente a la baja (nunca antes de su período original). El saldo ya refleja el exceso: en el mes del ajuste se reclasifica esa parte del saldo anterior, sin volver a descontarla. Anular el pago elimina su asignación y ajuste. La baja repetida no duplica ajustes. Cancelar y luego eliminar conserva fecha/período de baja y número/equipo, y actualiza el motivo a DELETED.

Ejemplo: comisión USD 20, pago parcial USD 10, cancelación y eliminación: ganado USD 0, pagado USD 10 y pendiente USD -10. En el mes siguiente, saldo anterior USD 0, ajuste USD -10 y pendiente USD -10; los meses posteriores conservan el débito hasta compensarlo. Resumen, detalle, mine y Reportes comparten este cálculo.

La migración es aditiva. La parte 1 no agrega pantallas ni exportaciones.

Las pantallas de la parte 2 conservan los saldos por moneda, muestran ajustes y pagos parciales y solo exportan desde Reportes. Reportes usa los agregados mensuales del endpoint; no inventa series diarias. La forma de pago se conserva en `note`; la fecha es la fecha real de registro, sin permitir retrofechar.

Las acciones escriben `commission.rule.activated`, `commission.rule.deactivated`, `commission.rule.deleted` y `commission.payment.voided` con actor y entidad, dentro de la misma transacción serializable. OWNER o permiso explícito `commissions` bastan; `sensitiveAccess` no reemplaza ese permiso. Todas las mutaciones están aisladas por tienda.
