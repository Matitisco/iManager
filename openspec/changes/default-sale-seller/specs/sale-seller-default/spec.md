## ADDED Requirements

### Requirement: Vendedor inicial en ventas nuevas
El sistema SHALL preseleccionar al miembro logueado en una venta nueva cuando esté entre las opciones, en desktop y mobile.

#### Scenario: Miembro disponible
- **WHEN** se abre una venta nueva y los vendedores están disponibles o terminan de cargar
- **THEN** queda seleccionado el miembro de la sesión activa

#### Scenario: Sin coincidencia
- **WHEN** el miembro no figura entre las opciones o no está disponible su ID
- **THEN** queda «Sin vendedor»

#### Scenario: Elección manual
- **WHEN** se elige otro vendedor o «Sin vendedor»
- **THEN** nuevos renders o cargas del directorio conservan esa elección

#### Scenario: Operación existente
- **WHEN** se edita una venta o se retoma un canje
- **THEN** se conserva su vendedor guardado, incluido «Sin vendedor»
