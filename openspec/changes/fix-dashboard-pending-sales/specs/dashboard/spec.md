## MODIFIED Requirements

### Requirement: Alcance coherente
Dashboard SHALL filtrar ventas, margen, unidades, tendencia, medios y ventas recientes por días argentinos inclusivos; stock, canjes activos y saldos pendientes SHALL conservar su estado actual sin variación. El overview SHALL reconocer ventas COMPLETADA y PENDIENTE sin anulación, sumando cantidades y el importe total registrado, en período actual y comparación.

#### Scenario: Mayorista con todas las ventas a cuenta
- **WHEN** existen ventas USD PENDIENTE de múltiples unidades en Hoy, Últimos 7 días, Este mes, Mes anterior, Total o un rango manual
- **THEN** resumen, tendencia, medios y agrupaciones incluyen sus importes y unidades, y el margen resta costo unitario por cantidad

#### Scenario: Ventas anuladas y tiendas distintas
- **WHEN** una venta está CANCELADA, ANULADA, tiene voidedAt/cancelledAt o pertenece a otra tienda
- **THEN** no afecta totales ni comparación
