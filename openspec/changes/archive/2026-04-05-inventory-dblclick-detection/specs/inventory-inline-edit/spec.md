## MODIFIED Requirements

### Requirement: Edición inline de celdas con doble click
La tabla de inventario SHALL permitir editar el valor de una celda haciendo doble click sobre ella, sin abrir el panel lateral. El mecanismo SHALL también soportar filas inline vacías para alta rápida (donde los inputs parten de valores vacíos en lugar de valores existentes). El área de doble-click SHALL cubrir toda la columna horizontal de la celda — si el click no aterriza exactamente sobre el contenido del `<td>`, el sistema SHALL detectar la columna por posición X del click usando las dimensiones de los headers (`thRefs`).

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

#### Scenario: Hitbox columna completa
- **WHEN** el usuario hace doble click en cualquier punto del eje X de una columna editable, incluso fuera del contenido del `<td>`
- **THEN** el input inline se activa para esa columna; no hay área horizontal dentro de la columna donde el doble click no tenga efecto

#### Scenario: Single-click no interfiere con doble-click
- **WHEN** el usuario hace doble click sobre una fila
- **THEN** el primer click no dispara selección de fila (la selección se debouncea 250ms y se cancela si llega un segundo click); solo se ejecuta la edición inline

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
- **THEN** no se abre el panel de edición completo; la fila queda visualmente enfocada o se activa la selección si corresponde (tras el debounce de 250ms)

#### Scenario: Editar desde menú contextual
- **WHEN** el usuario hace click derecho sobre una fila y selecciona "Editar"
- **THEN** se abre el InventoryEditPanel con todos los campos del ítem seleccionado
