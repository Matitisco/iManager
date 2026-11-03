## ADDED Requirements

### Requirement: Integridad monetaria de operaciones
El backend MUST rechazar importes fuera de la representación monetaria persistida y estados de venta desconocidos; MUST registrar solamente el pago efectivo si se omite un excedente.

#### Scenario: Pago con excedente omitido
- **WHEN** una venta de 100 recibe 150 con excess OMIT
- **THEN** caja y pago aplicado registran 100 en la moneda correspondiente

#### Scenario: Idempotencia en endpoints heredados
- **WHEN** dos requests de creación concurrentes usan la misma requestKey en una tienda
- **THEN** las rutas de ventas y canjes recuperan el mismo registro sin repetir efectos
