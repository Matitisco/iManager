## ADDED Requirements

### Requirement: Selección independiente de ventas activas
El sistema SHALL consultar ventas elegibles al abrir un reclamo con aislamiento por tienda y permiso de ventas, sin depender de la caché ni de filtros/paginación de Ventas.

#### Scenario: Apertura directa con listas globales vacías
- **WHEN** hay ventas COMPLETADA o PENDIENTE en USD o ARS de cualquier fecha y cantidad
- **THEN** el selector las muestra en mobile y desktop y permite abrir el reclamo

#### Scenario: Fallo de consulta
- **WHEN** falla la carga de ventas
- **THEN** se muestra el error y reintento y no se valida como una lista vacía

### Requirement: Devolución parcial por cantidad
El sistema SHALL validar y persistir unidades reclamadas sin exceder las vendidas ni devolver el lote entero.

#### Scenario: Una unidad de tres
- **WHEN** se reclama una unidad de una venta de tres
- **THEN** el reintegro máximo corresponde a una unidad, se devuelve una unidad al stock y quedan dos reclamables

#### Scenario: Cancelación con efectos
- **WHEN** se anula un reclamo ya compensado o devuelto físicamente
- **THEN** sus unidades e importes siguen consumiendo los límites de la venta

#### Scenario: Venta corregida con diferencia a cuenta corriente
- **WHEN** sale-corrections aumenta el total y deja la venta PENDIENTE
- **THEN** se permite abrir el reclamo sin cobrar ni modificar la deuda y cualquier reintegro se limita a su proporción de lo cobrado explícitamente

#### Scenario: Anulación posterior a una devolución física
- **WHEN** se intenta anular una venta con unidades ya devueltas
- **THEN** se rechaza la operación sin duplicar la restitución de stock ni la compensación
