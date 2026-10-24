## ADDED Requirements

### Requirement: Invitar desde mobile
El Dashboard SHALL ofrecer una acción de invitación a roles autorizados con equipo pequeño y sin invitaciones pendientes. Más SHALL conservar un acceso al flujo existente.

#### Scenario: Primera invitación
- **WHEN** un dueño genera un link desde Dashboard
- **THEN** la acción destacada desaparece y Más conserva su acceso

#### Scenario: Empleado sin permiso
- **WHEN** STAFF abre Dashboard o Más
- **THEN** no se muestran acciones para invitar

### Requirement: Moneda y cotización
El reporte SHALL convertir cada venta y costo según su moneda guardada antes de sumar. La píldora mobile SHALL ajustarse al contenido.

#### Scenario: Local USD con ventas ARS
- **WHEN** se consultan ventas guardadas en ARS con cotización válida
- **THEN** totales, margen, comparación, gráfico y medios de pago se expresan en USD convertido
