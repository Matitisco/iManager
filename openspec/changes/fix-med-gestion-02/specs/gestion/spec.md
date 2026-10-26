## ADDED Requirements
### Requirement: Margen bruto consistente
El overview SHALL descontar el margen de devoluciones reconocidas usando la misma matemática de Reportes.
#### Scenario: Devolución en otro período
- **WHEN** se emite una compensación
- **THEN** reduce el margen del período de emisión y su comparación, convertido a moneda de tienda.

