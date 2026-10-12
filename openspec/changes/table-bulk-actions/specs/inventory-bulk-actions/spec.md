## MODIFIED Requirements

### Requirement: Selección masiva de filas con checkboxes
La tabla SHALL tener un checkbox por fila y uno en el encabezado que seleccione todos los equipos filtrados, incluidas otras páginas. SHALL soportar rangos con Shift+click y selección móvil con pulsación prolongada.

#### Scenario: Seleccionar fila individual
- **WHEN** el usuario selecciona el checkbox de una fila
- **THEN** aparece la barra con la cantidad seleccionada.

#### Scenario: Shift+click para rango
- **WHEN** el usuario selecciona una fila y luego otra con Shift+click
- **THEN** se selecciona el rango en el orden filtrado actual.

#### Scenario: Header checkbox selecciona filtro completo
- **WHEN** se activa el checkbox del encabezado
- **THEN** se seleccionan todos los equipos del filtro, incluso en otras páginas.

### Requirement: Bulk delete con confirmación
El sistema SHALL confirmar la eliminación con cantidad explícita, respetar permisos sensibles y las validaciones/auditoría del endpoint individual. SHALL mantener pendientes y mostrar errores si falla alguna eliminación.

#### Scenario: Bulk delete confirmado
- **WHEN** las cinco eliminaciones confirmadas se guardan correctamente
- **THEN** los cinco productos salen del inventario y se limpia la selección.

#### Scenario: Bulk delete cancelado
- **WHEN** se cierra la confirmación sin confirmar
- **THEN** no se elimina ningún equipo y la selección se mantiene.

#### Scenario: Error parcial
- **WHEN** una eliminación falla tras dos eliminaciones correctas
- **THEN** se informa el resultado parcial y quedan seleccionados los pendientes.
