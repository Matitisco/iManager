## ADDED Requirements
### Requirement: Mapeo estable y campos tipados
El sistema SHALL mapear cada columna por índice cuando no haya encabezado y ofrecer campo existente, custom:<key> o ignore, con tres ejemplos y modal Nuevo campo.
#### Scenario: Archivo sin encabezado
- **WHEN** se importa un archivo cuya primera fila es un equipo
- **THEN** la primera fila se conserva y las columnas se identifican A, B, C y siguientes.
#### Scenario: Confirmación de campos
- **WHEN** se confirma un mapeo con campos nuevos
- **THEN** se crean definiciones por tienda junto con los equipos y se convierten texto, fecha dd/mm/aaaa y número, informando errores por fila.
### Requirement: Datos de ingreso y personalizados
El sistema SHALL persistir fecha de ingreso y detalle batería opcionales y valores personalizados en InventoryItem.customFields.
#### Scenario: Consulta y edición
- **WHEN** se abre un equipo
- **THEN** se muestran y editan los campos definidos por su tienda; fecha de ingreso ocupa la primera columna y la parte superior móvil; detalle batería queda en detalle y formulario.
