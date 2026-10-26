## ADDED Requirements

### Requirement: Límite acumulado de compensación por venta
El backend MUST descontar compensaciones previas conservadas al calcular el máximo compensable, incluso de reclamos anulados.

#### Scenario: Anulación y nueva compensación
- **WHEN** se anula un reclamo compensado y se abre otro sobre la misma venta
- **THEN** se rechaza todo importe que supere lo cobrado menos lo ya compensado, sin emitir nuevos movimientos.
