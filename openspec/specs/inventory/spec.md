# inventory Specification

## Purpose
TBD - created by archiving change inventory-drag-to-category. Update Purpose after archive.
## Requirements
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

### Requirement: Ocultar conteo durante carga inicial
El sistema SHALL mostrar indicadores de carga en lugar del conteo "0" mientras los datos de inventario están en vuelo (carga inicial o cambio de categoría). El badge de conteo en el header SHALL mostrar un skeleton animado y el footer SHALL mostrar "Cargando..." hasta que el fetch resuelva.

#### Scenario: Badge durante carga inicial
- **WHEN** el módulo Inventario monta por primera vez y el fetch aún no resolvió
- **THEN** el badge del header muestra un skeleton animado en lugar de "0"

#### Scenario: Badge durante cambio de categoría
- **WHEN** el usuario cambia de categoría y el nuevo fetch aún no resolvió
- **THEN** el badge del header muestra un skeleton animado en lugar del conteo anterior o "0"

#### Scenario: Footer durante carga
- **WHEN** `isInitialLoading` es `true`
- **THEN** el footer muestra "Cargando..." en lugar de "Mostrando 0 de 0"

#### Scenario: Restaurar conteo real
- **WHEN** el fetch de inventario resuelve exitosamente
- **THEN** el badge muestra el total real y el footer muestra "Mostrando N de M"
