## ADDED Requirements

### Requirement: Últimos siete días por defecto
Dashboard SHALL iniciar con los siete días calendario desde hoy menos seis hasta hoy inclusive, usando America/Argentina/Buenos_Aires y el helper `dashboardLast7Days()`.

#### Scenario: Primer día de mes
- **WHEN** se abre el Dashboard el 1 de noviembre de 2026
- **THEN** consulta del 26 de octubre al 1 de noviembre inclusive y compara contra el 19 al 25 de octubre

### Requirement: Selector y vacíos del período
Dashboard SHALL ofrecer «Últimos 7 días» seleccionado inicialmente, conservar las demás opciones y describir los vacíos como «en los últimos 7 días» cuando corresponde al rango aplicado.

#### Scenario: Rango inicial sin ventas
- **WHEN** el rango inicial no tiene ventas
- **THEN** tendencia y medios muestran los vacíos de los últimos siete días

#### Scenario: Cambiar al mes
- **WHEN** se aplica Este mes
- **THEN** se conserva el rango mensual y su texto vacío cuando difiere de los últimos siete días
