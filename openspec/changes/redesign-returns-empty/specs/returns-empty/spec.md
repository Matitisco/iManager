## ADDED Requirements

### Requirement: Vacío accionable y proporcionado de Devoluciones
Devoluciones SHALL presentar un ícono sobrio, título, descripción y una única acción primaria Nuevo reclamo cuando la consulta finalice sin registros y sin error; SHALL respetar el diseño a 1440 y 390 sin caja, borde, sombra ni desbordamiento.

#### Scenario: Lista vacía
- **WHEN** Todos, Activos o Archivados finaliza sin filas
- **THEN** muestra un título y descripción acordes al filtro, con un único botón Nuevo reclamo que abre el formulario existente

#### Scenario: Carga o error
- **WHEN** no se resolvió la consulta o hay un error
- **THEN** conserva el skeleton o el error existente y no presenta el vacío como resultado exitoso

#### Scenario: Lista con registros
- **WHEN** hay reclamos para el filtro
- **THEN** conserva las filas y las acciones de cabecera y dock existentes
