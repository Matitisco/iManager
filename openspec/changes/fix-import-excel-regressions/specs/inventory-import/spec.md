## ADDED Requirements

### Requirement: Lectura y validación segura de Excel
El sistema MUST conservar los valores combinados verticalmente y MUST rechazar identificadores científicos con precisión perdida sin actualizaciones silenciosas.

#### Scenario: Modelo combinado
- **WHEN** nueve equipos usan tres rangos verticales de modelo
- **THEN** los nueve equipos SHALL conservar su modelo en preview y confirmación

#### Scenario: IMEI abreviado
- **WHEN** cuatro IMEIs se guardan como notación científica abreviada
- **THEN** las cuatro filas SHALL rechazarse como invalid_imei con fila y motivo en preview y confirmación

### Requirement: Totales y notas descartados con detalle
El sistema MUST descartar pies sin identidad de equipo con reason footer y detalle de fila, conservando los equipos legítimos con IMEI o capacidad.

#### Scenario: Totales y notas
- **WHEN** diez equipos están seguidos de totales y notas
- **THEN** sólo los diez equipos SHALL contarse en preview y persistirse en confirmación

### Requirement: Regresión de duplicados dentro del archivo
El sistema MUST rechazar cada segunda ocurrencia con referencia a la primera fila física.

#### Scenario: Dos duplicados
- **WHEN** diez filas contienen dos IMEIs repetidos
- **THEN** ocho equipos SHALL contarse y persistirse, sin actualizaciones por los duplicados
