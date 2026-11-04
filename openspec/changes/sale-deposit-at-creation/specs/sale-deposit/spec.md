## ADDED Requirements

### Requirement: Seña inicial real
El sistema SHALL permitir elegir Seña al registrar una venta con cliente, monto positivo y moneda ARS/USD, calculando el saldo con la cotización guardada y sin exceder el importe restante tras aplicar recibos anteriores.

#### Scenario: Encargue o equipo de stock
- **WHEN** se confirma una venta con seña válida
- **THEN** crea y aplica un único ClientDeposit, registra un solo ingreso de caja e historial, guarda openBalance y muestra Seña mientras quede deuda.

#### Scenario: Reintento y cancelación
- **WHEN** se reintenta la misma solicitud o se anula la venta
- **THEN** no duplica dinero y la anulación deja la seña como saldo a favor, con devolución posterior disponible.

#### Scenario: Cobro del saldo
- **WHEN** se cobra el saldo desde el flujo existente
- **THEN** la venta queda COMPLETADA sin perder el historial de la seña y Dashboard deja de computar su deuda.
