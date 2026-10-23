## ADDED Requirements

### Requirement: Dashboard alineado al sistema compartido
El Dashboard SHALL usar las clases compartidas para encabezado, KPI, cards, grillas, tabla y filas móviles, con el KPI neutral Ventas.

#### Scenario: Ventas por viewport
- **WHEN** se resuelve un período con al menos cinco ventas
- **THEN** escritorio muestra cinco ventas en una tabla Venta, Cliente, Equipo, Total, Estado y móvil muestra cuatro tarjetas con apertura y menú.

### Requirement: Contacto y selector v3
El Dashboard SHALL mostrar Contanos con el enlace de WhatsApp aprobado, sin subtítulo, y un selector con cinco presets, incluido Total.

#### Scenario: Contacto por viewport
- **WHEN** se muestra el Dashboard
- **THEN** el bento oscuro aparece debajo de saldos en escritorio y como última card en móvil, abre https://wa.me/5491141722188 con target _blank y rel noopener noreferrer.

#### Scenario: Carga coordinada estable
- **WHEN** aún faltan datos iniciales o está recalculándose el período
- **THEN** se reservan las superficies finales de KPI, tendencia, pagos y ventas; no aparecen cifras parciales ni mensajes visibles de carga y Contanos conserva su lugar.

#### Scenario: Total en popover y hoja móvil
- **WHEN** se abre el selector
- **THEN** los cinco chips caben en una fila; el panel mide 420 px en escritorio y se adapta a la hoja móvil, conservando borrador y Aplicar.
