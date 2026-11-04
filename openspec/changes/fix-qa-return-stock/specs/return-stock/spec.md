## ADDED Requirements

### Requirement: Reposición física por cantidad
El sistema SHALL conservar cantidad devuelta y reponer exactamente esas unidades una sola vez, en la tienda de la venta.

#### Scenario: Lote agotado con devolución parcial
- **WHEN** se venden diez unidades y se devuelven dos a STOCK
- **THEN** el registro vinculado al reclamo SHALL tener cantidad dos y el estado elegido, y el lote original agotado SHALL conservar cero

#### Scenario: Lote con unidades remanentes
- **WHEN** se devuelve parte de una venta y queda stock en el lote original
- **THEN** el sistema SHALL separar las unidades devueltas sin cambiar cantidad, estado ni reservas del lote original

#### Scenario: Validación y repetición
- **WHEN** se intenta devolver una cantidad no entera, mayor al alcance vendido o resolver dos veces
- **THEN** el sistema SHALL rechazarlo sin movimientos físicos ni financieros adicionales

#### Scenario: Compatibilidad histórica y RMA
- **WHEN** una venta histórica no descontó cantidad o se recibe un RMA ya ingresado
- **THEN** el sistema SHALL conservar la semántica histórica sin duplicar stock
