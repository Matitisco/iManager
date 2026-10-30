## ADDED Requirements

### Requirement: Cantidad persistida por equipo
El sistema SHALL crear un registro por fila con cantidad entera por defecto 1, costos unitarios y sin expandirlo. SHALL rechazar cantidades mayores a 1 con IMEI.

#### Scenario: Stock mayorista
- **WHEN** una fila indica cantidad 73 sin IMEI
- **THEN** se persiste un equipo con cantidad 73

### Requirement: Ventas parciales
El sistema SHALL permitir vender unidades disponibles, descontar atómicamente, marcar vendido en cero y reponer las unidades de la venta anulada. Los reportes SHALL sumar unidades.

#### Scenario: Descuento parcial
- **WHEN** se venden 3 de 73 unidades
- **THEN** quedan 70 disponibles y la venta registra 3
