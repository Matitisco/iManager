## ADDED Requirements

### Requirement: Selección masiva de filas con checkboxes
La tabla SHALL tener un checkbox por fila para selección individual, y un checkbox en el header para seleccionar/deseleccionar todos los items de la página actual.

#### Scenario: Seleccionar fila individual
- **WHEN** el usuario hace click en el checkbox de una fila
- **THEN** la fila queda marcada y aparece la barra de bulk actions

#### Scenario: Shift+click para rango
- **WHEN** el usuario selecciona una fila y luego hace Shift+click en otra fila más abajo
- **THEN** todas las filas entre ambas quedan seleccionadas

#### Scenario: Header checkbox selecciona página
- **WHEN** el usuario hace click en el checkbox del header
- **THEN** todos los items de la página actual quedan seleccionados

### Requirement: Bulk delete con confirmación
El sistema SHALL permitir eliminar todos los items seleccionados con un único botón, previo modal de confirmación que indica la cantidad de items afectados.

#### Scenario: Bulk delete confirmado
- **WHEN** hay 5 items seleccionados y el usuario confirma el bulk delete
- **THEN** los 5 productos se eliminan del inventario; la selección se limpia

#### Scenario: Bulk delete cancelado
- **WHEN** el usuario abre el modal de confirmación y hace click en "Cancelar"
- **THEN** no se elimina ningún item; la selección se mantiene
