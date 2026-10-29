## ADDED Requirements

### Requirement: Separación vertical de filtros secundarios
El resumen periódico SHALL separar visualmente las pestañas de navegación, los filtros de período y las tarjetas sin alterar su comportamiento.

#### Scenario: Escritorio
- **WHEN** se muestra el resumen a más de 760 px de ancho
- **THEN** la barra de períodos tiene 24 px de margen superior e inferior

#### Scenario: Móvil
- **WHEN** se muestra el resumen a 760 px de ancho o menos
- **THEN** la barra de períodos tiene 20 px de margen superior e inferior y conserva su distribución adaptable
