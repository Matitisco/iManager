## MODIFIED Requirements

### Requirement: Edición inline de celdas con doble click
La tabla de inventario SHALL permitir editar el valor de una celda haciendo doble click sobre ella, sin abrir el panel lateral. El área de doble-click SHALL ocupar exactamente el espacio de contenido de la celda, sin padding sobrante que genere zonas muertas.

#### Scenario: Activar edición inline
- **WHEN** el usuario hace doble click en una celda editable
- **THEN** aparece un input inline sobre la celda con el valor actual; la celda muestra un indicador de edición (borde redondeado)

#### Scenario: Guardar con Enter
- **WHEN** el usuario presiona Enter mientras edita una celda
- **THEN** el valor se guarda via PATCH al backend; la celda activa pasa a ser la misma columna en la fila siguiente (si existe)

#### Scenario: Guardar con click fuera
- **WHEN** el usuario hace click fuera de la celda activa
- **THEN** el valor se guarda via PATCH al backend; el input se cierra

#### Scenario: Cancelar con Escape
- **WHEN** el usuario presiona Escape mientras edita una celda
- **THEN** el input se cierra sin guardar; la celda vuelve al valor anterior y permanece enfocada (sin input activo)

#### Scenario: Hitbox sin zonas muertas
- **WHEN** el usuario hace doble click sobre el texto visible de una celda
- **THEN** el input inline se activa; no hay área dentro de la celda donde el doble click no tenga efecto

## ADDED Requirements

### Requirement: Modal de edición completa accesible solo via menú contextual
El sistema SHALL abrir el panel de edición completo (InventoryEditPanel) únicamente cuando el usuario selecciona la opción "Editar" del menú contextual. Un click simple sobre una fila de la tabla NO SHALL abrir el modal.

#### Scenario: Click simple en fila no abre modal
- **WHEN** el usuario hace un click simple sobre cualquier celda de una fila
- **THEN** no se abre el panel de edición completo; la fila queda visualmente enfocada o se activa la selección si corresponde

#### Scenario: Editar desde menú contextual
- **WHEN** el usuario hace click derecho sobre una fila y selecciona "Editar"
- **THEN** se abre el InventoryEditPanel con todos los campos del ítem seleccionado
