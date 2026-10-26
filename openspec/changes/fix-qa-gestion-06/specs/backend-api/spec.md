## ADDED Requirements

### Requirement: Fecha económica independiente del cierre del RMA
El sistema SHALL reconocer cada reintegro o nota de crédito en su fecha de emisión, independientemente del cierre logístico del reclamo.

#### Scenario: Compensación emitida con equipo en proveedor
- **WHEN** se emite una compensación y el reclamo queda EN_PROVEEDOR con resolvedOn null
- **THEN** Devoluciones y ganancia neta incluyen el movimiento en el día de emisión según la zona horaria de la tienda

#### Scenario: Cierre logístico en otro período
- **WHEN** el proveedor rechaza o devuelve el equipo en un período posterior
- **THEN** el movimiento permanece en el período de emisión y no se duplica en el período de cierre
