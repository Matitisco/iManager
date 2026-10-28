## ADDED Requirements

### Requirement: Problemas de compra
El sistema SHALL contar una sola vez equipos EN_RMA, con reclamos activos o reparaciones abiertas. EN_REVISION por sí solo MUST NOT contar como problema. El aviso SHALL usar presente y concordancia singular/plural.

#### Scenario: Revisión sin otra señal
- **WHEN** un equipo está EN_REVISION sin reclamo ni reparación abierta
- **THEN** no incrementa los problemas de la compra.

#### Scenario: Compra con problemas
- **WHEN** el resumen informa 4 problemas entre 11 equipos
- **THEN** muestra «4 de 11 equipos de esta compra tienen problemas».

### Requirement: Identificación y costo
El detalle SHALL mostrar siempre la fila IMEI y mostrar la fila Costo con moneda solo si canSeeFinancials autoriza al usuario.

#### Scenario: Escritorio y móvil
- **WHEN** se abre un equipo en cualquier layout
- **THEN** se muestra IMEI, o — si está ausente.

#### Scenario: Permisos financieros
- **WHEN** el usuario tiene permiso financiero
- **THEN** ve Costo con moneda, incluso cero, o — si está ausente.

#### Scenario: Sin permiso financiero
- **WHEN** el usuario no tiene permiso financiero
- **THEN** no se renderiza la fila Costo ni su valor.
