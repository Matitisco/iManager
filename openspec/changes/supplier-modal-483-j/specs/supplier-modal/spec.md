## ADDED Requirements

### Requirement: Confirmación de archivado exclusiva
La confirmación de archivar proveedor o gasto SHALL ser el único diálogo visible y montado mientras está abierta.

#### Scenario: Cancelar la confirmación
- **WHEN** se cancela o cierra la confirmación de archivo
- **THEN** reaparece la ficha de proveedor con el detalle ya cargado sin refetch ni skeleton, o el formulario de gasto con sus ediciones intactas

#### Scenario: Persistencia del archivado
- **WHEN** se confirma el archivado
- **THEN** el éxito cierra todo y el fallo conserva ReasonSheet con el motivo y el error visibles para reintentar

### Requirement: Ficha legible y acciones separadas
La ficha de Proveedor SHALL separar contacto, notas y compras con espaciado explícito, y mantener accesibles las acciones en el pie del Sheet sin invadir el contenido.

#### Scenario: Desktop y móvil
- **WHEN** se abre una ficha con contacto largo, notas y varios equipos en 1440 o 390 px
- **THEN** los valores y títulos se ajustan al ancho sin solaparse, el IMEI permanece completo y las compras tienen padding interno y divisores
- **AND** el cuerpo permite scroll y el pie conserva Registrar equipo y Más acciones para Subir stock, Editar y Archivar

#### Scenario: Contacto largo en móvil
- **WHEN** se abre una ficha con email o teléfono largo en un viewport de hasta 760 px
- **THEN** cada valor ocupa una sola línea con elipsis, sin solaparse con su etiqueta ni desbordar la ficha, y conserva el valor completo en el atributo title

#### Scenario: Costos y archivo
- **WHEN** un usuario sin permiso financiero consulta una ficha o se abre un proveedor archivado
- **THEN** se conserva la restricción de costos existente y el archivado ofrece Restaurar en lugar de acciones de alta o edición

### Requirement: Alta y edición con borrador seguro
Los formularios SHALL mostrar campos separados en una columna, con errores visibles y cierre solamente después de persistencia exitosa.

#### Scenario: Guardado pendiente o fallido
- **WHEN** se guarda un proveedor y la petición está pendiente o falla
- **THEN** no se duplican envíos ni se cierra el modal durante la petición, y el fallo conserva los valores y permite reintentar

#### Scenario: Carga y error de ficha
- **WHEN** se consulta un proveedor y la consulta tarda o falla
- **THEN** se presenta skeleton sin texto de carga o error visible con reintento, sin inventar datos
