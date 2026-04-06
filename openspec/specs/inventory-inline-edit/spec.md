### Requirement: Edición inline de celdas con doble click
La tabla de inventario SHALL permitir editar el valor de una celda haciendo doble click sobre ella, sin abrir el panel lateral. El mecanismo SHALL también soportar filas inline vacías para alta rápida (donde los inputs parten de valores vacíos en lugar de valores existentes). El área de doble-click SHALL cubrir toda la columna horizontal de la celda — si el click no aterriza exactamente sobre el contenido del `<td>`, el sistema SHALL detectar la columna por posición X del click usando las dimensiones de los headers (`thRefs`). Las celdas de tipo enum SHALL activarse con single-click y mostrar un `<select>` en lugar de un `<input>`. Las celdas que muestran el placeholder `---` SHALL activar el inline edit igual que si tuvieran valor; el input aparece vacío.

#### Scenario: Activar edición inline en celda de texto/número
- **WHEN** el usuario hace click en una celda editable de texto o número (imei, model, battery, price)
- **THEN** aparece un input inline sobre la celda con el valor actual; la celda muestra un indicador de edición (borde redondeado)

#### Scenario: Activar edición inline en celda con placeholder
- **WHEN** el usuario hace click en una celda que muestra `---` (valor vacío)
- **THEN** aparece un input inline vacío; el string `---` no es el valor inicial del input

#### Scenario: Activar selección inline en celda enum
- **WHEN** el usuario hace click en una celda editable de tipo enum (ej. status/Disponibilidad)
- **THEN** aparece un `<select>` inline con el valor actual pre-seleccionado y las opciones válidas del enum

#### Scenario: Activar inputs en fila inline vacía
- **WHEN** se inserta una fila inline vacía via "Agregar ítem"
- **THEN** los campos de la fila muestran inputs vacíos con el mismo estilo visual que el inline edit (borde redondeado); el foco se posiciona en el primer campo (`nombre`)

#### Scenario: Guardar con Enter
- **WHEN** el usuario presiona Enter mientras edita una celda de texto/número de una fila existente
- **THEN** el valor se guarda via PATCH al backend; la celda activa pasa a ser la misma columna en la fila siguiente (si existe)

#### Scenario: Guardar con click fuera
- **WHEN** el usuario hace click fuera de la celda activa de una fila existente
- **THEN** el valor se guarda via PATCH al backend; el input se cierra

#### Scenario: Cancelar con Escape
- **WHEN** el usuario presiona Escape mientras edita una celda de una fila existente
- **THEN** el input o select se cierra sin guardar; la celda vuelve al valor anterior y permanece enfocada (sin input activo)

#### Scenario: Hitbox columna completa
- **WHEN** el usuario hace click en cualquier punto del eje X de una columna editable (texto, número o enum), incluso fuera del contenido del `<td>`
- **THEN** el input o select inline se activa para esa columna; no hay área horizontal dentro de la columna donde el click no tenga efecto

#### Scenario: Single-click no interfiere con doble-click en columnas de texto
- **WHEN** el usuario hace doble click sobre una fila con columnas de texto
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
