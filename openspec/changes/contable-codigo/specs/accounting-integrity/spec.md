## ADDED Requirements

### Requirement: Estados compatibles
El sistema SHALL normalizar estados conocidos sin convertir valores desconocidos en operaciones cobradas.

#### Scenario: Alias histórico
- **WHEN** se lee un alias reconocido
- **THEN** las comparaciones usan el estado canónico.

### Requirement: Relaciones por tienda
Los servicios MUST rechazar referencias existentes a otra tienda antes de producir efectos.

#### Scenario: Venta corrupta
- **WHEN** se intenta cancelar una venta ligada a inventario ajeno
- **THEN** falla la transacción sin modificar el inventario.
