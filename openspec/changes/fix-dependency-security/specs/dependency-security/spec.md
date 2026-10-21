## ADDED Requirements

### Requirement: Dependencias auditables
El proyecto MUST conservar locks reproducibles y documentar vulnerabilidades restantes.

#### Scenario: Validación de corrección
- **WHEN** se actualizan dependencias por seguridad
- **THEN** se registran auditorías antes/después y pruebas sin usar producción.
