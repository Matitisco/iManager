# Comisiones — API (#330, parte 1)

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
| PATCH | `/api/commissions/sales/seller` | Comisiones; `{saleIds, sellerMemberId}` (null permite quitar vendedor) |
| GET | `/api/reports/commissions?from=YYYY-MM&to=YYYY-MM` | Comisiones y Reportes; totales por persona y período, hasta 120 meses |

Dueño tiene Comisiones por defecto. Socio/Empleado con `sections=null` no lo tienen; pueden recibirlo explícitamente. Costos/ganancia por venta requieren también Reportes. Mine nunca incluye esos campos, aun para Dueño o miembros con Reportes.

Las reglas admiten `memberId:null` (equipo), `basis` (PROFIT_PERCENT por defecto, SALE_PERCENT, FIXED_PER_UNIT), `rate`, `currency` para fijo y `effectiveFrom` (fecha YYYY-MM-DD local o timestamp ISO con offset). Una regla personal vigente prevalece sobre la de equipo. PATCH admite campos parciales. El cálculo queda congelado al registrar/asignar una venta; crear, editar o eliminar reglas no cambia comisiones históricas.

Un pago admite `{memberId, period, amount, currency, exchangeRate, settlesCurrency, note?}`. Se pueden registrar varios pagos parciales. El importe convertido con la cotización del pago reduce solamente la deuda de settlesCurrency. Los pagos no se eliminan ni sobrescriben.

Las altas de ventas/operaciones/importaciones aceptan vendedor opcional y nunca lo asignan por defecto. `registeredByUserId` conserva al usuario que registró la venta. `exchangeRate` positivo puede enviarse; si falta, el backend obtiene el blue vendedor actual. Una falla de cotización es visible, sin cotización inventada. Ediciones sin sellerMemberId conservan el vendedor existente; null lo quita. El nombre explícito del vendedor importado se resuelve solo si coincide con un miembro único de la tienda.

CommissionAccrual conserva snapshots y bajas aunque Sale se borre físicamente. Una venta cancelada/eliminada tiene comisión activa cero. Sin pagos, se anula el crédito. Si su deuda ya recibió pagos, se conserva el crédito histórico y se revierte completo en el mes siguiente a la baja (nunca antes de su período original). En un período parcialmente pagado, el saldo no cobrado y la reversión se compensan, quedando a descontar solo lo efectivamente pagado. La baja repetida no duplica ajustes.

La migración es aditiva. La parte 1 no agrega pantallas ni exportaciones.

Las pantallas de la parte 2 conservan los saldos por moneda, muestran ajustes y pagos parciales y solo exportan desde Reportes. Reportes usa los agregados mensuales del endpoint; no inventa series diarias. La forma de pago se conserva en `note`; la fecha es la fecha real de registro, sin permitir retrofechar.
