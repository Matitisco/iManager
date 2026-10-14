## ADDED Requirements

### Requirement: Inventory text analysis
El sistema SHALL aceptar texto pegado y .txt con el mismo resultado, interpretar con un LLM backend y presentar una vista previa editable antes de cualquier escritura.

#### Scenario: Mixed listing
- **WHEN** el usuario pega o sube un listado informal con varios equipos, monedas y cantidades
- **THEN** el sistema muestra los equipos normalizados, dudas y descartes, y sólo importa tras confirmar.

### Requirement: Bounded and private LLM calls
El sistema MUST enviar únicamente texto aportado e instrucciones estáticas, usar JSON schema estricto validado con Zod, reintentar JSON inválido una vez y limitar tamaño, concurrencia, tiempo y llamadas por tienda.

#### Scenario: Invalid model response
- **WHEN** ambas respuestas fallan la validación
- **THEN** aparece un error en español sin crear equipos.

#### Scenario: Unrelated text
- **WHEN** el texto no contiene inventario
- **THEN** aparece «Este texto no parece tener equipos para importar» sin permitir confirmar.
