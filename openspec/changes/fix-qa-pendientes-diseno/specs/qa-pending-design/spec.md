## ADDED Requirements

### Requirement: Stock concise copy
Las hojas de reglas de catálogo, detalle de equipo y carga en serie MUST presentar solo el título, sin subtítulos ni ayudas redundantes.

#### Scenario: Open stock sheets
- **WHEN** se abre una de estas hojas
- **THEN** conserva sus datos, controles y validaciones, y no muestra el subtítulo heredado

### Requirement: Three-row count preview
El resultado del conteo MUST mostrar hasta tres equipos en su vista compacta.

#### Scenario: More than three results
- **WHEN** el grupo contiene cuatro o más equipos
- **THEN** muestra tres y permite consultar el resto mediante «Ver los N»

### Requirement: Visible quote validation
Onboarding MUST enfocar el campo de cotización inválido y mostrar su error al enviar, incluso con los detalles plegados o al repetir el envío.

#### Scenario: Invalid quote on mobile
- **WHEN** se envía compra mayor que venta, o solo una de las dos cotizaciones
- **THEN** no crea la tienda, abre los detalles y el campo inválido recibe foco y queda visible junto al error
