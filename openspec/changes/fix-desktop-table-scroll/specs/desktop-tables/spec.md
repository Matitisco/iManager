## ADDED Requirements

### Requirement: Scroll horizontal contenido en tablas de escritorio
Las tablas de escritorio de Ventas, Inventario, Clientes y Canjes SHALL permitir alcanzar todas sus columnas con scroll horizontal dentro de su contenedor, sin ensanchar la página. Encabezado y paginación SHALL permanecer fuera del scroll horizontal.

#### Scenario: Presentación de escritorio en viewport angosto
- **WHEN** se renderiza una tabla de escritorio en un viewport de aproximadamente 470 px
- **THEN** su contenedor permite desplazarse horizontalmente hasta la última columna, incluso con las media queries de ancho angosto activas

#### Scenario: Escritorio amplio
- **WHEN** la tabla cabe en su contenedor
- **THEN** ocupa el ancho disponible sin generar scroll horizontal innecesario

#### Scenario: Presentación móvil
- **WHEN** se usa la presentación móvil real
- **THEN** se conservan las tarjetas existentes y no se renderiza el contenedor de tabla de escritorio
