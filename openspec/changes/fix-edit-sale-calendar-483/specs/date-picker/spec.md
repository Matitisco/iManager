## ADDED Requirements

### Requirement: Contain the edit sale calendar
Editar Venta SHALL mantener el calendario anclado a su campo y dentro del cuerpo del modal y viewport, conservando el selector existente.

#### Scenario: Open on desktop or mobile
- **WHEN** se abre el calendario de Editar Venta en 1440 px o 390 px
- **THEN** el panel se ubica junto al campo sin cubrir el encabezado ni las acciones, con altura desplazable si no hay espacio suficiente

#### Scenario: Scroll or resize
- **WHEN** cambia el scroll del modal o el viewport visual con el calendario abierto
- **THEN** el panel sigue el campo dentro de los límites visibles o se cierra si el campo deja de verse

#### Scenario: Select a date
- **WHEN** se elige una fecha y se guarda la venta
- **THEN** se conserva el contrato de persistencia y el cierre y foco del selector existente
