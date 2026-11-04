## ADDED Requirements

### Requirement: Acumulado en moneda del cliente
El backend SHALL expresar Client.totalSpent en balanceCurrency, usando la moneda de la tienda cuando balanceCurrency sea null. Cada venta SHALL convertirse con su exchangeRate persistido, sin cambiar el importe ni la moneda de la venta o caja.

#### Scenario: Cobro de consignación en ARS para cliente USD
- **WHEN** se cobra una consignación ARS 500.310 con cotización 1.000 para un cliente USD
- **THEN** totalSpent aumenta USD 500,31 y venta/caja conservan ARS 500.310

#### Scenario: Ventas directas y recálculos
- **WHEN** se crea, importa, edita o anula una venta con moneda distinta de la del cliente
- **THEN** su contribución al acumulado usa la cotización guardada en esa venta y conserva dos decimales

#### Scenario: Cotización histórica ausente
- **WHEN** un recálculo necesita convertir una venta sin cotización positiva
- **THEN** se devuelve un error visible y la transacción no persiste efectos parciales
