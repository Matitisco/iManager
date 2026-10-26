## ADDED Requirements

### Requirement: Estado de deuda por corrección
El sistema MUST guardar PENDIENTE cuando la corrección crea deuda en una venta cobrada.

#### Scenario: Aumento cobrado previamente
- **WHEN** una venta cobrada de 655 se edita a 700
- **THEN** queda PENDIENTE con saldo 45 y puede cobrarse esa diferencia.
