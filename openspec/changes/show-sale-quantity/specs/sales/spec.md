## ADDED Requirements

### Requirement: Cantidad visible en ventas
El sistema SHALL mostrar `xN` junto al equipo en la tabla y tarjetas de Ventas y en el historial de compras del cliente cuando la cantidad válida sea mayor a uno.

#### Scenario: Venta mayorista
- **WHEN** una venta tiene cantidad 5
- **THEN** sus filas muestran `x5` sin alterar el nombre del equipo en otras pantallas

#### Scenario: Venta individual o cantidad inválida
- **WHEN** la cantidad es 1, ausente o inválida
- **THEN** no se muestra sufijo y se cuenta una unidad

### Requirement: Unidades vendidas en el resumen
El sistema SHALL sumar unidades con el mismo período y exclusión de anuladas que las demás tarjetas de Ventas, tanto en escritorio como en móvil.

#### Scenario: Resumen del período
- **WHEN** hay ventas activas de cantidades 5, ausente y 2, y una venta anulada
- **THEN** Unidades vendidas muestra 8 y excluye registros fuera del período
