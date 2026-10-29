## MODIFIED Requirements

### Requirement: Importar productos desde CSV o XLSX
El sistema SHALL importar un equipo por fila no vacía del rango seleccionado y conservar los valores incompatibles en notas. Preview y confirmación MUST tener el mismo conteo. Una fila sin IMEI con texto total/subtotal/suma en alguna celda, o sin modelo ni IMEI cuyo valor coincide con la suma de al menos dos valores de su columna, SHALL importarse en revisión con nota «Parece una fila de total» y resaltarse como por revisar en la vista previa.

#### Scenario: Total etiquetado
- **WHEN** una fila sin IMEI tiene una etiqueta de total en cualquier celda
- **THEN** se conserva como equipo, en revisión, con la nota y resaltado visibles

#### Scenario: Total sin etiqueta
- **WHEN** una fila sin modelo ni IMEI coincide con una suma de su columna
- **THEN** se conserva y se marca como posible total

#### Scenario: Equipo identificable
- **WHEN** una fila tiene IMEI o un equipo con modelo coincide con la suma de precios anteriores
- **THEN** la coincidencia numérica no la marca como total

#### Scenario: Confirmación
- **WHEN** se confirma una importación con posibles totales
- **THEN** se persiste el mismo número de equipos de la vista previa, incluyendo nota y estado de los posibles totales
