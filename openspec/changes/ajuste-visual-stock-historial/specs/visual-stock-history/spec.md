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

### Requirement: Detalle sin comparación vacía
El sistema MUST omitir Antes y la flecha por campo cuando el valor anterior es null, vacío, espacios o el marcador —, conservando Después y el estilo actual en escritorio y móvil.

#### Scenario: Cierre de control sin valores anteriores
- **WHEN** se abre Cerró un control de stock y todos sus campos carecen de valor anterior
- **THEN** cada campo muestra solo Después, sin Antes ni flecha, y la tabla omite la cabecera Antes.

#### Scenario: Cambios mixtos y valores reales
- **WHEN** un evento combina campos sin valor anterior con campos cuyo valor anterior es real, incluido "0"
- **THEN** solo los campos con valor anterior real muestran Antes y flecha; un Después ausente sigue mostrándose como —.
