## MODIFIED Requirements

### Requirement: Cobros integrados
El sistema SHALL registrar cobros de ventas, cuotas, señas y reparaciones en su moneda/medio original en la misma transacción del negocio cuando haya configuración compatible; aplicar una seña no vuelve a cobrarla. La caja MUST NOT impedir vender, cobrar, cancelar ni corregir precios.
#### Scenario: Sin apertura
- **WHEN** existe configuración compatible pero no una caja abierta hoy
- **THEN** la operación se guarda y el movimiento queda sin caja ni sesión, sin cambiar saldos cerrados.
#### Scenario: Sin configuración compatible
- **WHEN** no hay caja configurada para la moneda/medio o el medio no es de caja
- **THEN** la operación se guarda sin crear movimientos de caja.
#### Scenario: Cancelación posterior al cierre
- **WHEN** se cancela una venta cuyo cobro pertenece a un cierre anterior
- **THEN** cada cobro se compensa una sola vez en una caja compatible abierta hoy o sin asignar; el original, saldo cerrado y conteos se conservan.
#### Scenario: Corrección de precio pagado
- **WHEN** aumenta el precio de una venta pagada con cliente
- **THEN** se guarda la diferencia como deuda conforme a #305 sin rechazar por caja ni volver a cobrar el importe; el pago posterior impacta una caja abierta compatible o queda sin asignar.
