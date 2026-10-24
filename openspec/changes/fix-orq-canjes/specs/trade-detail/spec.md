## ADDED Requirements

### Requirement: Consistent outstanding trade debt
El detalle de Canjes SHALL calcular la deuda con las mismas reglas que Ventas, considerando la diferencia neta de señas, el saldo de la venta y los pagos del cliente.

#### Scenario: Partial general payment
- **WHEN** un canje confirmado tiene diferencia de $300.000 y el cliente paga $100.000, quedando $200.000 de saldo
- **THEN** el detalle muestra deuda $200.000, también después de recargar

#### Scenario: Explicit sale balance
- **WHEN** la venta vinculada tiene un saldo explícito menor que la diferencia
- **THEN** el detalle respeta ese saldo sin volver a mostrar la diferencia total

#### Scenario: Sale loaded with the operation
- **WHEN** la venta vinculada no está en la lista global pero se recupera con la operación
- **THEN** el detalle utiliza esa venta para mostrar precio y calcular deuda
