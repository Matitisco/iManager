# Delta Spec: inventory-drag-to-category

## ADDED Requirements

### Requirement: Drag items to category tab

El sistema SHALL permitir arrastrar ítems de inventario hacia una pestaña de categoría para reasignarlos.

#### Scenario: Start drag on any row
- **WHEN** el usuario presiona sobre una fila y mueve el cursor más de 5px
- **THEN** se activa el modo drag, mostrando un badge flotante con el conteo de ítems

#### Scenario: Auto-select on drag
- **WHEN** el ítem arrastrado no estaba en la selección activa
- **THEN** la selección se reemplaza por ese único ítem antes de activar el drag

#### Scenario: Drag existing selection
- **WHEN** el ítem arrastrado ya pertenecía a `selectedIds`
- **THEN** se arrastran todos los ítems seleccionados

#### Scenario: Drop target highlight
- **WHEN** el cursor está sobre una pestaña de categoría durante el drag
- **THEN** esa pestaña se escala (`scale-110`) y muestra fondo gris; el badge cambia a "Soltar en [Categoría]"

#### Scenario: Confirmation before move
- **WHEN** el usuario suelta sobre una pestaña de categoría válida
- **THEN** aparece un diálogo "¿Mover N equipos a [Categoría]?" con botón "Mover"

#### Scenario: Instant table update
- **WHEN** el usuario confirma el movimiento
- **THEN** se llama a `bulkMoveCategory`, la selección se limpia y la tabla se actualiza sin animación de salida

#### Scenario: Cancel drag
- **WHEN** el usuario suelta fuera de cualquier pestaña de categoría
- **THEN** el drag se cancela sin cambios

#### Scenario: No drop on "Todas"
- **WHEN** el cursor está sobre la pestaña "Todas" durante el drag
- **THEN** no se activa como drop target (sin `data-cat-id`)
