## ADDED Requirements

### Requirement: Costos privados en reclamos
La API MUST omitir itemCost e itemCurrency cuando el miembro no tiene Reportes.

#### Scenario: Empleado con acciones sensibles sin Reportes
- **WHEN** consulta o modifica un reclamo
- **THEN** la respuesta no incluye costos; el dueño y quien tiene Reportes conservan acceso.
