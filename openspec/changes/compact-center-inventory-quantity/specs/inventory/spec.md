## ADDED Requirements

### Requirement: Cantidad compacta y centrada
La tabla de Inventario SHALL mostrar la cantidad editable en un control de 48 px con padding horizontal de 4 px y texto centrado. Encabezado, input y cantidad fija MUST compartir el mismo eje horizontal. El valor fijo por IMEI SHALL conservar su tooltip y bloqueo de edición.

#### Scenario: Cantidades mixtas en escritorio
- **WHEN** se abre Inventario con equipos con y sin IMEI
- **THEN** el encabezado Cantidad, los inputs y los valores fijos quedan centrados en el mismo eje, con ancho de valor de 48 px

#### Scenario: Cantidad en móvil
- **WHEN** se abre Inventario a 390 px
- **THEN** se conservan las tarjetas y sus cantidades sin desbordar el viewport
