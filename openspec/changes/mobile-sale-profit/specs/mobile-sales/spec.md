## ADDED Requirements

### Requirement: Ganancia por venta mobile
El sistema SHALL mostrar una fila Ganancia al pie de cada card mobile, separada por un divisor y sólo cuando `canSeeFinancials` lo permita, conservando el comportamiento vigente de #691 y desktop.

#### Scenario: Venta con costo o pendiente de cobro
- **WHEN** la venta tiene costo conocido, incluso si está a cuenta
- **THEN** el monto coincide con la ganancia desktop en la moneda activa, sin prorratearlo por lo cobrado.

#### Scenario: Devolución compensada
- **WHEN** una devolución compensada de esa venta cambia la ganancia
- **THEN** se muestra el bruto tachado junto al neto y un indicador de devolución; el neto positivo es ámbar.

#### Scenario: Sin costo o datos pendientes
- **WHEN** desktop no puede determinar ganancia por falta de costo o datos financieros
- **THEN** la fila mobile muestra «—».

#### Scenario: Ganancia negativa
- **WHEN** la ganancia neta es negativa
- **THEN** el monto conserva el signo menos y se muestra rojo, también con devolución.

#### Scenario: Sin permiso financiero
- **WHEN** `canSeeFinancials` devuelve falso
- **THEN** no se renderiza la fila ni sus montos.

#### Scenario: Temas y desktop
- **WHEN** se usan los temas claro u oscuro
- **THEN** el pie respeta los tokens del tema, sin desbordes a 390 px ni cambios de desktop.
