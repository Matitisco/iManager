## ADDED Requirements

### Requirement: Selector único de capacidad
El formulario de equipo MUST mostrar una sola opción por capacidad equivalente, conservando el valor elegido.

#### Scenario: Alta con datos importados
- **WHEN** el inventario y el catálogo contienen `128 GB`, `128gb` y `128GB`
- **THEN** Registrar equipo muestra una sola opción para esa capacidad, que puede seleccionarse y deseleccionarse

#### Scenario: Edición histórica
- **WHEN** se edita un equipo con capacidad `128 GB` y el catálogo ofrece `128GB`
- **THEN** aparece una sola opción seleccionada y guardar sin cambiarla conserva `128 GB`

#### Scenario: Capacidad personalizada
- **WHEN** existen capacidades adicionales o con nombres personalizados
- **THEN** se mantienen disponibles sin fusionar valores distintos ni convertir unidades
