## ADDED Requirements

### Requirement: Trade-ins history uses the shared table engine
La sección de historial de Canjes SHALL renderizarse con `TableEngine` para unificar la experiencia de tabla con Inventory, Clients y Sales.

#### Scenario: Open trade-ins history
- **WHEN** un usuario abre la página de Canjes con el backend listo
- **THEN** el historial se muestra dentro del motor tabular compartido
- **AND** el usuario puede ver columnas configurables, toolbar de filtros y acciones de fila

### Requirement: Trade-ins history preserves backend-backed filtering and editing
El historial de Canjes MUST permitir filtrar, ordenar, editar y eliminar registros reales sin volver a una tabla manual paralela.

#### Scenario: Filter and edit trade-ins from the engine
- **WHEN** un usuario aplica filtros o guarda cambios sobre un canje desde el engine
- **THEN** el historial refleja sólo los registros que cumplen los filtros activos
- **AND** los cambios se persisten usando el flujo real del módulo de Canjes
- **AND** la vista no se cierra como éxito si la persistencia falla
