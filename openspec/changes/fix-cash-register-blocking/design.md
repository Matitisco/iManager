## Decisions
CashMovement.registerId pasa a opcional; currency y method opcionales conservan denominación de movimientos sin asignar. Filas previas resuelven la denominación desde su caja, sin backfill. Los cobros buscan configuración de su moneda/medio y omiten movimientos si falta. Si existe, se usa una caja compatible abierta hoy, priorizando predeterminada; en su defecto queda sin caja ni sesión. No se reasignan cobros anteriores automáticamente.

Las compensaciones usan la misma selección sin exigir configuración activa (incluso tras archivar la caja original). El bloqueo transaccional por tienda y reversalOf existente conservan idempotencia. No se altera el movimiento original: historial deriva voidedAt de su compensación. No se toca saldo, sesiones ni conteos cerrados.

Editar precio, moneda o medio describe la venta y no acredita dinero nuevo. Se elimina el veto por cobros previos; #305 conserva el cargo por diferencia. Sólo los cobros reales posteriores generan movimientos; la cancelación revierte lo efectivamente registrado.

## Validation
Lint/typecheck frontend/backend, unitarios frontend/backend, integración PostgreSQL y E2E caja/ventas/cuenta corriente/cancelaciones/reparaciones/señas en escritorio e iPhone. Sin build ni push.
