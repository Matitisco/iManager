## ADDED Requirements

### Requirement: Conservar vendedor y garantía al retomar
El sistema MUST conservar vendedor y garantía elegidos en un canje pendiente.

#### Scenario: Retomar y confirmar
- **WHEN** se guarda un canje pendiente con vendedor y 90 días y se retoma tras recargar
- **THEN** formulario y venta confirmada conservan ambos valores y generan la comisión correspondiente.

#### Scenario: Valores explícitos y omitidos
- **WHEN** se edita un borrador sin enviar vendedor ni garantía
- **THEN** conserva lo guardado; vendedor null lo quita y garantía 0 queda sin cobertura.
