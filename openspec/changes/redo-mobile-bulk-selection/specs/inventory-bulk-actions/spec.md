## MODIFIED Requirements

### Requirement: Selección masiva de filas con checkboxes
Desktop SHALL mostrar un checkbox por fila y en el header. Mobile SHALL ocultar checkboxes en modo normal y mostrarlos después de activar Seleccionar o Seleccionar varios desde la hoja de acciones. La selección SHALL estar aislada por tienda/usuario y excluir filas que dejan de estar filtradas.

#### Scenario: Seleccionar fila individual
- **WHEN** el usuario hace click en el checkbox de una fila
- **THEN** la fila queda marcada y aparece la barra de acciones con cantidad, acción destructiva y salida de selección.

#### Scenario: Shift+click para rango
- **WHEN** el usuario selecciona una fila desktop y hace Shift+click en otra
- **THEN** todas las filas del rango en el orden actual quedan seleccionadas.

#### Scenario: Seleccionar todos los filtrados
- **WHEN** el usuario activa Seleccionar todos
- **THEN** selecciona todas las filas filtradas incluyendo otras páginas.

#### Scenario: Toque largo móvil histórico
- **WHEN** mantiene una fila 480 ms sin mover más de 8 px ni hacer scroll
- **THEN** abre la hoja Editar/Eliminar sin seleccionar la fila ni abrir detalle; Seleccionar varios entra en modo selección con esa fila marcada.
