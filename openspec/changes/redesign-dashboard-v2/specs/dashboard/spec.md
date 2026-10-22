## ADDED Requirements

### Requirement: Dashboard aprobado con datos reales
Dashboard SHALL presentar KPI, tendencia, medios, ventas recientes y accesos según las referencias aprobadas, adaptando la grilla a escritorio/celular.

#### Scenario: Usuario con permiso financiero
- **WHEN** abre Dashboard con sesión lista
- **THEN** cifras financieras y variaciones provienen de una misma respuesta de overview para el rango aplicado

#### Scenario: Sin permiso financiero
- **WHEN** el usuario carece de canSeeFinancials
- **THEN** no se consulta overview ni se muestran tarjetas financieras, tendencia o medios

### Requirement: Rango y comparación consistentes
Dashboard SHALL aplicar rangos inclusivos argentinos sólo al confirmar, conservar mes móvil y ofrecer calendario flotante desktop debajo de la isla existente.

#### Scenario: Aplicar rango
- **WHEN** se seleccionan fechas y se aplica
- **THEN** se consulta ese rango y se compara con una ventana anterior de igual duración sin anulaciones

#### Scenario: Base despreciable
- **WHEN** la base de comparación es cero o menor que una unidad
- **THEN** no se muestra un porcentaje de variación

#### Scenario: Consulta fallida
- **WHEN** falla overview
- **THEN** se muestra un estado vacío discreto sin inventar importes ni ofrecer mensajes rojos
