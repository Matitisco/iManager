## ADDED Requirements

### Requirement: Directorio y atribución
El sistema SHALL mantener revendedores por tienda sin usuarios y validar vendedor/revendedor excluyentes.

#### Scenario: Archivo con ventas
- **WHEN** se archiva un revendedor con ventas
- **THEN** el historial se conserva y no se ofrece en nuevas asignaciones

### Requirement: Comisiones por beneficiario
El sistema SHALL aplicar reglas globales y personales, pagos por moneda y ajustes a los revendedores.

#### Scenario: Cancelación pagada
- **WHEN** se cancela una venta cuya comisión al revendedor se pagó
- **THEN** se genera el mismo ajuste A descontar que para un miembro
