## ADDED Requirements

### Requirement: Avisos compactos de la vista previa
La vista previa de equipos SHALL mostrar los avisos de precio e IMEI junto al indicador de descartes sin carteles amarillos grandes. Asignar MUST abrir y enfocar la columna correspondiente en Excel → campo.

#### Scenario: Precio sin asignar y equipos existentes
- **WHEN** falta la columna de precio y hay equipos que se actualizarán por IMEI
- **THEN** aparecen indicadores compactos, se puede asignar Precio y siguen disponibles los motivos de descarte

### Requirement: Scroll exclusivo del contenido de revisión
La tabla y el panel SHALL usar el alto disponible con scroll interno, encabezados visibles y sin scroll de la hoja completa.

#### Scenario: Archivo largo con avisos
- **WHEN** se revisa un archivo largo a 1440 o 390 px
- **THEN** la tabla conserva el alto disponible, los encabezados y las acciones se mantienen visibles y las columnas no asignadas conservan su resaltado rojo
