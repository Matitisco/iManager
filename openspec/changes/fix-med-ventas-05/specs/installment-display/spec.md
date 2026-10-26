## ADDED Requirements

### Requirement: Presentar importes exactos del plan
El sistema MUST mostrar los centavos de cuotas y pagos que forman el saldo de la venta y del cliente.

#### Scenario: Tres cuotas con recargo y primer cobro
- **WHEN** una venta de 1000 tiene recargo 100, tres cuotas y primera cobrada
- **THEN** muestra cobro 366,66, pendientes 366,66 y 366,68 y deuda 733,34, sin redondear a enteros.
