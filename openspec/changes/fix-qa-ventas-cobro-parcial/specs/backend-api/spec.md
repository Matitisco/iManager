## ADDED Requirements

### Requirement: Cobro del remanente de venta
El backend MUST cobrar sólo el saldo abierto de la venta, cerrar su deuda y registrar el pago.

#### Scenario: Cliente con dos ventas pendientes
- **WHEN** se marca cobrada una venta de USD 1000 con USD 400 ya cobrados y otra venta pendiente de USD 500
- **THEN** el saldo del cliente queda en USD 500, la primera venta queda con openBalance cero y se registra el pago final de USD 600 una sola vez
