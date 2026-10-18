## ADDED Requirements

### Requirement: Alineación del período de Reportes
El selector de período SHALL conservar sus chips y comportamiento y alinearse a la derecha de los filtros de Reportes.

#### Scenario: Desktop
- **WHEN** Reportes se muestra a 1280 px
- **THEN** los tipos quedan a la izquierda y el selector termina en el borde derecho de la misma fila, con tolerancia de 2 px

#### Scenario: Desktop con salto de línea
- **WHEN** los grupos no entran en la misma fila
- **THEN** el selector queda alineado a la derecha en su propia línea

#### Scenario: Móvil
- **WHEN** Reportes se muestra a 760 px o menos
- **THEN** ambos grupos conservan filas independientes desplazables, los períodos se alinean a la derecha cuando entran y ambos extremos son accesibles cuando desbordan, sin overflow horizontal de página a 393 o 320 px
