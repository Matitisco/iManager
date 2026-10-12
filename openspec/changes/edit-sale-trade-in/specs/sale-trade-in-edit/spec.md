## ADDED Requirements

### Requirement: Editar el canje de una venta
El sistema SHALL permitir agregar, quitar y editar un canje en una venta existente desde desktop y mobile.

#### Scenario: Agregar canje
- **WHEN** se edita una venta sin canje y se activa Tiene canje con datos válidos
- **THEN** se conserva la venta y se crea un canje confirmado con su recibido en revisión y diferencia actualizada

#### Scenario: Quitar canje
- **WHEN** se desactiva Tiene canje al editar una venta
- **THEN** la venta sigue activa sin canje, el canje queda cancelado en el historial, el recibido se archiva y la deuda se recalcula

#### Scenario: Cambiar datos del canje
- **WHEN** se cambian equipo recibido o valor tomado
- **THEN** se actualizan el canje, su recibido y la diferencia sin duplicar la venta

#### Scenario: Persistencia fallida
- **WHEN** el recibido ya se vendió o el IMEI nuevo está duplicado
- **THEN** se rechaza la edición sin cambios parciales y el formulario conserva sus datos con un error visible
