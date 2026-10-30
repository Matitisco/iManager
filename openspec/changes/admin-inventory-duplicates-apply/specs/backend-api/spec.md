## ADDED Requirements

### Requirement: Aplicación reversible del plan de duplicados
El sistema SHALL permitir solo administradores de plataforma verificados aplicar el plan exacto del GET en una transacción, con validaciones de tienda, claves, totales y ausencia de riesgos, backup completo y auditorías por grupo.

#### Scenario: Plan coincidente
- **WHEN** todas las expectativas coinciden con un plan sin riesgos y con grupos
- **THEN** conservar la fila más antigua, sumar cantidad, borrar duplicados y devolver el backup previo completo

#### Scenario: Plan desactualizado o inseguro
- **WHEN** difieren expectativas o hay grupos a revisar, casi duplicados o excluidas de los grupos
- **THEN** responder 409 sin modificar ninguna tabla

### Requirement: Restauración del backup
El sistema SHALL restaurar las columnas físicas exactas del backup, solo dentro de la tienda esperada, y borrar únicamente sus auditorías de agrupado automático.

#### Scenario: Round trip repetible
- **WHEN** se restaura el backup válido una o más veces
- **THEN** las filas recuperan exactamente el estado previo y no se alteran filas ni auditorías ajenas
