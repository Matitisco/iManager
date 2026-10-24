## ADDED Requirements

### Requirement: Cambio de período fallido visible
El Dashboard SHALL informar un fallo al aplicar un rango distinto mientras conserva los datos del período anterior y ofrecer Reintentar.

#### Scenario: Consulta fallida con instantánea previa
- **WHEN** el usuario aplica otro rango y su consulta falla
- **THEN** conserva la instantánea previa y muestra un alert indicando que son datos del período anterior, con Reintentar.

#### Scenario: Recuperación del rango solicitado
- **WHEN** el usuario elige Reintentar y la consulta tiene éxito
- **THEN** consulta las mismas fechas, reemplaza la instantánea y retira el error.

#### Scenario: Revalidación automática
- **WHEN** falla una revalidación del mismo período o una solicitud obsoleta
- **THEN** conserva la instantánea sin mostrar el error de cambio de período.
