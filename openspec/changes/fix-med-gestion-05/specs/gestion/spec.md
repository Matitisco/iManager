## ADDED Requirements
### Requirement: Compra histórica por listado
El sistema SHALL conservar fecha y nombre de compra al importar stock de proveedor.
#### Scenario: Varias compras y reimportación
- **WHEN** un archivo contiene compras con distintas fechas o nombres
- **THEN** agrupa cada compra correctamente y repetir no crea compras duplicadas.

