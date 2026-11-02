## ADDED Requirements

### Requirement: Dashboard mayorista
Dashboard SHALL reconocer ventas activas pendientes y completadas en todos los períodos.

#### Scenario: Ventas USD multicantidad
- **WHEN** existen ventas USD con cantidad mayor a uno
- **THEN** hoy, 7d, mes, mes anterior, personalizado y Total muestran importes y unidades correspondientes

### Requirement: Compras y garantías
Compras SHALL contar operaciones activas de venta/canje/reparación sin agrupación; Garantías SHALL sumar unidades vigentes.

#### Scenario: Siete ventas iguales
- **WHEN** se registran siete ventas del mismo modelo y día con cantidades 1,1,1,1,2,2,3
- **THEN** Compras muestra 7, Garantías 11 y Ver todas conserva las siete filas

### Requirement: Devolución parcial
Ventas, Dashboard y reportes SHALL descontar facturación y margen en el período de compensación.

#### Scenario: Diez unidades menos dos
- **WHEN** se venden diez unidades a USD 650 y costo USD 450 y se reintegran USD 1300
- **THEN** facturación neta es USD 5200 y margen USD 1600, con comprobante original intacto
