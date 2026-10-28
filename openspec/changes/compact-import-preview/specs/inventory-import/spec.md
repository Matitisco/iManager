## ADDED Requirements

### Requirement: Controles compactos en la vista previa
La vista previa SHALL reservar el alto disponible a equipos y mapeo con scroll interno y encabezados fijos.

#### Scenario: Archivo de una hoja
- **WHEN** se revisa un archivo con una sola hoja
- **THEN** no se muestra el checkbox de inclusión de hoja
- **AND** Encabezado aparece como enlace junto a los avisos y abre las mismas opciones en un popover

#### Scenario: Archivo de varias hojas
- **WHEN** se revisa un archivo con varias hojas
- **THEN** la selección e inclusión se muestran en una línea de chips con scroll horizontal
- **AND** se conservan las columnas rojas y los motivos de descarte
