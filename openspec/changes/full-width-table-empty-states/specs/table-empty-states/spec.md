## ADDED Requirements

### Requirement: Full-width table empty states
Inventory, Clients, Trade-ins y Sales SHALL mostrar sus vacíos iniciales centrados a ancho completo, sin caja interna ni «0 resultados».

#### Scenario: Empty inventory
- **WHEN** Inventario no tiene equipos y no hay filtros activos
- **THEN** muestra el título y texto actuales sin contador, con sus acciones móviles funcionales

#### Scenario: Responsive shared empty states
- **WHEN** se muestra un vacío compartido de tabla
- **THEN** usa padding vertical generoso, tipografía ampliada y acciones apiladas de ancho completo en móvil

### Requirement: Preserve compact notifications and independent empty states
Notificaciones SHALL conservar una presentación compacta y los vacíos con clases independientes SHALL conservar su comportamiento.

#### Scenario: Notifications panel
- **WHEN** no hay notificaciones
- **THEN** el vacío mantiene padding compacto sin heredar los 64 px de tabla

#### Scenario: Active filters
- **WHEN** un filtro de Inventario no devuelve equipos
- **THEN** conserva su mensaje y comportamiento actuales
