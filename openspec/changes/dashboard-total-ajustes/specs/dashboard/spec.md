## ADDED Requirements

### Requirement: Historial completo
Dashboard SHALL ofrecer Total, consultar overview sin fechas y ocultar variación sin período previo.

#### Scenario: Aplicar Total
- **WHEN** se confirma el chip Total
- **THEN** el botón refleja Total, la serie usa meses y no hay comparación anterior

### Requirement: Alcance coherente
Dashboard SHALL filtrar ventas, margen, unidades, tendencia, medios y ventas recientes por días argentinos inclusivos; stock, canjes activos y saldos pendientes SHALL conservar su estado actual sin variación.

#### Scenario: Cambiar rango
- **WHEN** se aplica otro rango
- **THEN** las métricas comerciales cambian juntas y las operativas actuales permanecen visibles

### Requirement: Presentación estable
Dashboard SHALL esperar sesión, permisos, primeros pasos, listas y overview antes de pintar cifras y usar Skeleton con reservas mínimas sin cambiar el layout ni los estilos de #512.

#### Scenario: Respuestas desordenadas
- **WHEN** falta una dependencia del primer pintado
- **THEN** no se muestran cifras parciales ni pantallas intermedias incorrectas

#### Scenario: Ventas recientes
- **WHEN** hay ventas en el rango
- **THEN** las filas conservan el layout de #512, con apertura y menú contextual, mostrando hasta cinco ventas desktop y cuatro móvil
