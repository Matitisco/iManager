## ADDED Requirements

### Requirement: Orden de carga y columnas
La tabla SHALL ordenar ventas por createdAt descendente, luego número de venta descendente y finalmente id descendente; SHALL conservar anuladas al final y permitir ordenar por columna con desempate por carga.

#### Scenario: Cargas del mismo día
- **WHEN** ventas se cargan con distinta hora y fecha comercial
- **THEN** la más recientemente cargada aparece primero independientemente de la fecha comercial

#### Scenario: Columna ordenable
- **WHEN** se activa un encabezado
- **THEN** alterna ascendente/descendente, desempata por carga y vuelve a la primera página; el menú permite restaurar el orden de carga
