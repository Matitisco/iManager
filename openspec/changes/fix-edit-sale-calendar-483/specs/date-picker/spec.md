## ADDED Requirements

### Requirement: Contain the edit sale calendar
Editar Venta SHALL mantener el calendario anclado a su campo y dentro del viewport, priorizando el cuerpo del modal, conservando el selector existente.

#### Scenario: Open on desktop or mobile
- **WHEN** se abre el calendario de Editar Venta en 1440 px o 390 px
- **THEN** el panel se ubica junto al campo sin cubrir el encabezado ni las acciones, reposicionándose al costado o dentro del viewport si no entra en el cuerpo; solo tendrá scroll propio cuando el viewport sea menor que el panel

#### Scenario: Scroll or resize
- **WHEN** cambia el scroll del modal o el viewport visual con el calendario abierto
- **THEN** el panel sigue el campo dentro de los límites visibles o se cierra si el campo deja de verse

#### Scenario: Select a date
- **WHEN** se elige una fecha y se guarda la venta
- **THEN** se conserva el contrato de persistencia y el cierre y foco del selector existente

#### Scenario: Short desktop viewport
- **WHEN** se abre el calendario a 1440×620 y el cuerpo del modal es menor que la altura medida del panel
- **THEN** el calendario completo se reposiciona junto al campo dentro del viewport sin scroll propio

#### Scenario: Inline mobile calendar
- **WHEN** se abre el calendario inline a 390×844
- **THEN** el cuerpo del formulario se desplaza lo necesario para mostrar todo el panel sin ocultar sus acciones detrás del pie fijo
