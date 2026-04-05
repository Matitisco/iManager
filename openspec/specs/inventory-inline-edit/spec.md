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

### Requirement: Actualización optimista sin flash visual
El sistema SHALL mostrar el nuevo valor inmediatamente al guardar, sin un flash del valor anterior mientras el API responde.

#### Scenario: Guardado con latencia de red
- **WHEN** el usuario guarda una celda y el backend tarda 500ms en responder
- **THEN** la celda muestra el nuevo valor desde el momento en que el usuario confirma; no se muestra el valor anterior durante la espera

### Requirement: Límite de 30 caracteres en campos de texto inline
Los inputs de edición inline de celdas de texto y nombres de columna SHALL tener un límite máximo de 30 caracteres.

#### Scenario: Input en límite
- **WHEN** el usuario escribe más de 30 caracteres en un input inline
- **THEN** el input no acepta más caracteres después del carácter 30

### Requirement: Modal de edición completa accesible solo via menú contextual
El sistema SHALL abrir el panel de edición completo (InventoryEditPanel) únicamente cuando el usuario selecciona la opción "Editar" del menú contextual. Un click simple sobre una fila de la tabla NO SHALL abrir el modal.

#### Scenario: Click simple en fila no abre modal
- **WHEN** el usuario hace un click simple sobre cualquier celda de una fila
- **THEN** no se abre el panel de edición completo; la fila queda visualmente enfocada o se activa la selección si corresponde

#### Scenario: Editar desde menú contextual
- **WHEN** el usuario hace click derecho sobre una fila y selecciona "Editar"
- **THEN** se abre el InventoryEditPanel con todos los campos del ítem seleccionado
