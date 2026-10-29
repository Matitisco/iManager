## ADDED Requirements

### Requirement: Acciones directas del equipo
El detalle de equipo SHALL ofrecer Editar, Archivar y Guardar estado reutilizando las acciones existentes y respetando permisos.

#### Scenario: Editar desde el detalle
- **WHEN** se presiona Editar
- **THEN** el detalle se reemplaza por el formulario existente del mismo equipo sin guardar el borrador de estado
- **AND** la X del detalle sigue cerrándolo

#### Scenario: Archivar con confirmación
- **WHEN** un usuario con permiso presiona Archivar en un equipo activo
- **THEN** se abre la confirmación existente con motivo opcional antes de persistir
- **AND** si falla la persistencia la confirmación conserva el error visible

#### Scenario: Venta desde la fila
- **WHEN** se abre el menú contextual de una fila de equipo en stock
- **THEN** Vender abre el registro de venta con el equipo preseleccionado

#### Scenario: Pie responsive
- **WHEN** se abre el detalle en escritorio o móvil
- **THEN** Editar y Archivar son botones secundarios y Guardar estado mantiene el estilo primario y su comportamiento existente
- **AND** Archivar se oculta sin permiso o si el equipo ya está archivado
