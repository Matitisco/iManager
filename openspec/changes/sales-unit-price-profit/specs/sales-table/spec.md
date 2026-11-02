## ADDED Requirements

### Requirement: Desktop sale unit price
La tabla de escritorio SHALL mostrar «Precio unit.» después de «Cant.», usando el precio unitario guardado o Total dividido por cantidad, con moneda y máximo dos decimales.

#### Scenario: Historical sale without stored unit price
- **WHEN** una venta tiene total 100 y cantidad 3 sin precio unitario
- **THEN** la celda muestra el equivalente monetario de 33,33

#### Scenario: Stored unit price
- **WHEN** una venta tiene unitPrice informado
- **THEN** la celda prioriza ese valor

### Requirement: Desktop sale profit permission and calculation
La tabla SHALL mostrar «Ganancia» después de «Total» solo cuando el permiso existente de Ganancia total lo permite y SHALL reutilizar su cálculo de costo por cantidad y conversión monetaria.

#### Scenario: Unknown cost
- **WHEN** el equipo no tiene costo conocido
- **THEN** Ganancia muestra «—»

#### Scenario: Restricted financial permission
- **WHEN** el usuario no puede ver Ganancia total
- **THEN** no se renderizan encabezado ni celdas de Ganancia

### Requirement: Desktop scope
La tabla SHALL conservar Vendedor y las demás columnas excepto Pago, y SHALL conservar estilos y modo oscuro.

#### Scenario: Mobile sale cards
- **WHEN** se usa la vista móvil
- **THEN** las cards conservan su contenido actual sin las nuevas columnas
