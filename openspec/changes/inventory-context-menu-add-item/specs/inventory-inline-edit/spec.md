## MODIFIED Requirements

### Requirement: Edición inline de celdas con doble click
La tabla de inventario SHALL permitir editar el valor de una celda haciendo doble click sobre ella, sin abrir el panel lateral. El mecanismo SHALL también soportar filas inline vacías para alta rápida (donde los inputs parten de valores vacíos en lugar de valores existentes). El área de doble-click SHALL ocupar exactamente el espacio de contenido de la celda, sin padding sobrante que genere zonas muertas.

#### Scenario: Activar edición inline en celda existente
- **WHEN** el usuario hace doble click en una celda editable de una fila existente
- **THEN** aparece un input inline sobre la celda con el valor actual; la celda muestra un indicador de edición (borde redondeado)

#### Scenario: Activar inputs en fila inline vacía
- **WHEN** se inserta una fila inline vacía via "Agregar ítem"
- **THEN** los campos de la fila muestran inputs vacíos con el mismo estilo visual que el inline edit (borde redondeado); el foco se posiciona en el primer campo (`nombre`)

#### Scenario: Guardar con Enter
- **WHEN** el usuario presiona Enter mientras edita una celda de una fila existente
- **THEN** el valor se guarda via PATCH al backend; la celda activa pasa a ser la misma columna en la fila siguiente (si existe)

#### Scenario: Guardar con click fuera
- **WHEN** el usuario hace click fuera de la celda activa de una fila existente
- **THEN** el valor se guarda via PATCH al backend; el input se cierra

#### Scenario: Cancelar con Escape
- **WHEN** el usuario presiona Escape mientras edita una celda de una fila existente
- **THEN** el input se cierra sin guardar; la celda vuelve al valor anterior y permanece enfocada (sin input activo)

#### Scenario: Hitbox sin zonas muertas
- **WHEN** el usuario hace doble click sobre el texto visible de una celda
- **THEN** el input inline se activa; no hay área dentro de la celda donde el doble click no tenga efecto
