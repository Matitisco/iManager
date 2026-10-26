## ADDED Requirements
### Requirement: Importes del overview en moneda declarada
Los importes de devoluciones y stock SHALL convertirse con la cotización venta usada por los reportes.
#### Scenario: Stock y devoluciones en monedas mixtas
- **WHEN** hay registros ARS y USD
- **THEN** el overview convierte antes de sumar o devuelve error visible si falta cotización.

