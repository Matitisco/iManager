## ADDED Requirements

### Requirement: Importes decimales de ventas y pagos
El sistema MUST conservar los centavos en el importe persistido y en la base de comisión.

#### Scenario: Entrada con punto o coma decimal
- **WHEN** se ingresa 649,50 o 649.50 como precio o pago
- **THEN** se envía 649.50, y una comisión del 2% conserva el importe 12.99
