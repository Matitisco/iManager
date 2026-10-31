## ADDED Requirements

### Requirement: Ganancia total por cantidad y moneda
Ventas MUST mostrar «Ganancia total» con ingresos menos costo unitario convertido multiplicado por cantidad válida (fallback 1), sobre ventas no anuladas del resumen con costo positivo conocido. El porcentaje MUST usar solo sus ingresos. MUST informar ventas sin costo excluidas, o «Cargá el costo en el equipo» cuando ninguna tiene costo.

#### Scenario: Venta mayorista
- **WHEN** una venta totaliza 800 y tiene cantidad 5 y costo unitario 100 en la misma moneda
- **THEN** la ganancia es 300

#### Scenario: Costos en monedas distintas
- **WHEN** hay costos ARS y USD
- **THEN** el cálculo convierte cada costo unitario antes de multiplicarlo, igual que reports

#### Scenario: Costo desconocido
- **WHEN** falta el equipo o su costo es cero o negativo
- **THEN** la venta no aporta ganancia ni ingresos al porcentaje y se informa su exclusión
