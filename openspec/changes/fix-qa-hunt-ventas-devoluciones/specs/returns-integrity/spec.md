## ADDED Requirements

### Requirement: Acumulado en moneda de cuenta
El sistema MUST descontar devoluciones del acumulado de compras en la moneda de la cuenta del cliente, usando la cotización histórica de la venta.

#### Scenario: Venta USD y cliente ARS
- **WHEN** se devuelven USD 50 de una venta con cotización 1250 a un cliente con cuenta ARS
- **THEN** el acumulado baja ARS 62500 y el reintegro o nota conserva USD 50

#### Scenario: Falta cotización histórica
- **WHEN** la devolución requiere convertir monedas y la venta no tiene cotización válida
- **THEN** falla sin modificar stock, pagos, notas ni acumulados

### Requirement: Nota única por request
El sistema MUST aplicar cada nota de crédito una sola vez en una venta.

#### Scenario: ID repetido
- **WHEN** una venta de 150 recibe dos veces el ID de una nota con saldo 100
- **THEN** aplica 100 una sola vez y cobra 50

### Requirement: Alcance conjunto vigente
El sistema MUST validar el total de unidades comprometidas por los reclamos al resolverlos.

#### Scenario: Cantidad vendida reducida
- **WHEN** dos reclamos de dos unidades siguen abiertos después de reducir una venta de cuatro a dos
- **THEN** rechaza resolver dos unidades hasta corregir el alcance de los otros reclamos, sin movimientos parciales
