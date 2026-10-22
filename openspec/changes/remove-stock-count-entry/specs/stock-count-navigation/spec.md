## ADDED Requirements

### Requirement: Acceso por pestaña
El sistema MUST ofrecer la pestaña Control de stock como único acceso de interfaz al conteo desde Inventario.

#### Scenario: Inventario en escritorio y móvil
- **WHEN** se abre Inventario en escritorio o móvil
- **THEN** no aparece el botón antiguo de Control de stock y la pestaña sigue disponible

#### Scenario: Navegación del grupo
- **WHEN** se activa la pestaña Control de stock
- **THEN** se abre la pantalla de conteo sin flecha propia de regreso y se puede volver a Equipos mediante su pestaña
