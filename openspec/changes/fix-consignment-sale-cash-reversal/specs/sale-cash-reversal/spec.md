## ADDED Requirements

### Requirement: Reversión de cobros de ventas anuladas
El sistema MUST revertir los movimientos de caja de una venta al anularla, incluidos los cobros de consignaciones, dentro de la misma transacción que restituye el stock.

#### Scenario: Anular un cobro de consignación
- **WHEN** se anula por DELETE una venta cobrada desde una consignación
- **THEN** su caja neta queda en cero y se restituye el stock una sola vez

#### Scenario: Repetir una anulación
- **WHEN** se repite o concurre la anulación de una venta directa o integrada
- **THEN** cada cobro tiene como máximo una reversión y no se duplica stock

### Requirement: Confirmación de devolución
El diálogo MUST informar el importe cobrado a devolver para ventas activas sin depender de su marca de operación integrada.

#### Scenario: Venta consignada cobrada
- **WHEN** se abre la confirmación de anulación
- **THEN** se informa la devolución en la moneda de la venta
