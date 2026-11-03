## ADDED Requirements

### Requirement: Contratos compatibles con Zod 4
La API MUST conservar códigos HTTP, forma de errores y mensajes de validación al actualizar Zod.

#### Scenario: Entrada inválida
- **WHEN** se envía un payload inválido
- **THEN** el estado, error, message y fields coinciden con el contrato previo

#### Scenario: Edición parcial
- **WHEN** se edita una regla omitiendo campos con default de creación
- **THEN** los campos omitidos siguen ausentes en el input del servicio
