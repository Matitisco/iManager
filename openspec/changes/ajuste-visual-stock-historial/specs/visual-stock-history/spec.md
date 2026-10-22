## ADDED Requirements

### Requirement: Presentación aprobada por viewport
El sistema MUST seguir las nuevas referencias aprobadas de Control de stock e Historial a 1440 y 390 sin cambiar las operaciones existentes.

#### Scenario: Control móvil
- **WHEN** se revisa un conteo cerrado en 390
- **THEN** aparecen tres pasos y cuatro tarjetas de grupos, listado compacto expandible y acción Registrar conteo sin superposición de navegación.

#### Scenario: Detalle de historial
- **WHEN** se abre un evento
- **THEN** muestra sección/fecha, registro y autor en el orden aprobado para el viewport; Antes/Después aparece solo con cambios estructurados.

#### Scenario: Carga y títulos
- **WHEN** se consultan las pantallas
- **THEN** la espera usa esqueletos sin textos visibles de carga y los títulos de sección no llevan subtítulos.
