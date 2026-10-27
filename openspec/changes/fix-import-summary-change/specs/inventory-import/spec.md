## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL permitir al usuario cargar un archivo CSV o XLSX y mapear sus columnas a los campos del inventario para importar múltiples productos en un solo paso. El ajuste SHALL permitir revisar y cambiar cualquier columna desde Resumen conservando la edición.

#### Scenario: Importación exitosa
- **WHEN** el usuario sube un archivo, mapea las columnas y confirma la importación
- **THEN** los productos se crean en el inventario del store y aparecen en la tabla

#### Scenario: Solo Modelo es requerido
- **WHEN** el usuario importa filas donde solo el campo Modelo tiene valor
- **THEN** los productos se crean con los campos opcionales vacíos o en null; no se rechaza el import

## ADDED Requirements

### Requirement: Cambiar una columna desde Resumen
El sistema SHALL mostrar Cambiar en cada fila de los tres grupos, sin ocultarlo ni truncarlo en móvil. La fila completa SHALL activar la misma acción con nombre accesible por columna.

#### Scenario: Elegir una columna mapeada o descartada
- **WHEN** el usuario activa Cambiar
- **THEN** Columnas muestra su tarjeta con destino editable, hace scroll y le da foco con resaltado estático durante 1600 ms
- **AND** repetir Cambiar sobre la misma columna repite el foco y resaltado

### Requirement: Conservar las tarjetas durante la edición
El sistema SHALL acumular las tarjetas abiertas desde Resumen junto a las pendientes iniciales, incluso después de asignar destinos y recibir recalculados asíncronos.

#### Scenario: Editar varias columnas
- **WHEN** el usuario cambia destinos y abre otra columna desde Resumen
- **THEN** todas las tarjetas previamente abiertas permanecen visibles
- **AND** el conjunto se reinicia al entrar desde Archivo o cambiar hoja/encabezado
