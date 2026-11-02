## MODIFIED Requirements

### Requirement: Desktop sale unit price
La tabla de escritorio SHALL mostrar «Precio unit.» inmediatamente después de «Vendedor» e inmediatamente antes de «Total», usando el precio unitario guardado o Total dividido por cantidad, con moneda y máximo dos decimales.

#### Scenario: Desktop column order
- **WHEN** se muestra la tabla con permiso de ganancias
- **THEN** encabezados y celdas siguen el orden Venta, Fecha, Cliente, Equipo, Cant., Vendedor, Precio unit., Total, Ganancia, Estado, después del selector de filas

#### Scenario: Historical sale without stored unit price
- **WHEN** una venta tiene total 100 y cantidad 3 sin precio unitario
- **THEN** la celda inmediatamente a la izquierda de Total muestra el equivalente monetario de 33,33

#### Scenario: Stored unit price
- **WHEN** una venta tiene unitPrice informado
- **THEN** la celda prioriza ese valor

#### Scenario: Filters and mobile
- **WHEN** se filtra Vendedor o Total, o se muestra la vista móvil
- **THEN** se conservan los filtros, el orden de filas y el contenido móvil existentes
