## ADDED Requirements

### Requirement: Costo unitario desde una venta
El sistema SHALL guardar costo unitario del equipo y auditar inventory.cost en la misma transacción de creación/edición de venta.

#### Scenario: Encargue o equipo existente
- **WHEN** se confirma una venta con costo válido
- **THEN** el ítem vinculado conserva ese costo, autor y fecha; Ventas y Dashboard lo usan

#### Scenario: Edición sin modificar costo
- **WHEN** se edita una venta sin tocar costo o dejando el campo vacío
- **THEN** el costo actual no cambia

### Requirement: Permiso y ganancia coherentes
El sistema SHALL usar canSeeFinancials para mostrar y aceptar costo y calcular ganancia con la lógica de Ventas.

#### Scenario: Sin permiso financiero
- **WHEN** un usuario sin permiso abre el modal o envía costo por API
- **THEN** no ve costo/ganancia, la API rechaza la escritura y oculta el costo en respuestas

#### Scenario: Cantidad y canje
- **WHEN** hay varias unidades o un canje
- **THEN** la ganancia usa el precio completo y costo por unidad multiplicado por cantidad
