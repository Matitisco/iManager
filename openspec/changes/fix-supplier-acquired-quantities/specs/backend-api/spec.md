## ADDED Requirements

### Requirement: Cantidades adquiridas e inversión independientes del stock
El backend MUST conservar unidades adquiridas separadas del stock actual y sumar por moneda el costo unitario multiplicado por unidades adquiridas.

#### Scenario: Alta manual o importada de diez unidades
- **WHEN** se cargan diez equipos a USD 300 y se venden cuatro
- **THEN** la compra conserva diez adquiridos y USD 3.000 y el proveedor muestra seis en stock para OWNER y STAFF según permisos vigentes

#### Scenario: Devolución y anulación
- **WHEN** se devuelven parcialmente unidades o se anula/restaura una venta
- **THEN** solo cambia el stock y la adquisición histórica e inversión se conservan incluso al separar filas de devolución

#### Scenario: Backfill aditivo
- **WHEN** se actualiza una base existente
- **THEN** se agrega un campo nullable y se reconstruyen cantidades con stock más ventas descontadas menos reposiciones físicas sin borrar datos ni sobrescribir snapshots conocidos
