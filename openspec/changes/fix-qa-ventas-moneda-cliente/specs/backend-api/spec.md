## ADDED Requirements

### Requirement: Moneda de movimientos de ventas del cliente
El backend MUST convertir gasto y deuda a la moneda del saldo con la cotización de la venta.

#### Scenario: Venta en ARS con saldo USD
- **WHEN** se registra una venta pendiente de ARS 812500 a cotización 1250 para un cliente con saldo USD
- **THEN** la venta conserva ARS 812500 y el cliente recibe USD 650 de gasto y deuda
