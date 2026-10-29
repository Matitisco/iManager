## MODIFIED Requirements

### Requirement: Normalización de valores de batería
El sistema SHALL normalizar valores de batería decimales con punto o coma a porcentaje durante el import. Valores como `0.87` y `0,87` MUST convertirse a `"87%"` y `1` a `"100%"`. Rangos como `"83-85%"` se preservan como string. La validación de columnas y la confirmación MUST aceptar los mismos formatos sin marcar dudas ni solicitar correcciones por ellos.

#### Scenario: Batería decimal en CSV con separador punto y coma
- **WHEN** la batería contiene `0,87` o `0.87`
- **THEN** análisis, preview y confirmación conservan la fila con `batteryHealth: "87%"`

#### Scenario: Porcentaje explícito y rango
- **WHEN** la batería contiene `1%` o `83-85%`
- **THEN** se mantiene la escala explícita sin convertir `1%` en `100%`

## ADDED Requirements

### Requirement: Calidad compuesta con barra
El sistema SHALL aceptar pares de calidad A/B/C con modificadores + o - separados por barra, conservar su información y mostrarlos para equipos usados. Etiquetas ajenas a la escala mantienen las protecciones existentes.

#### Scenario: Análisis y reimportación sin pérdida de calidad
- **WHEN** una columna contiene `A/A-` o `B/C`
- **THEN** se conserva como calidad sin desmapearla, sugerir un campo alternativo ni pedir corrección por esos valores, tanto al crear como al actualizar
