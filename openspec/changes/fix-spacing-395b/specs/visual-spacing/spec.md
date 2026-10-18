## ADDED Requirements

### Requirement: Consistencia de espaciado #395
Las pantallas afectadas SHALL conservar el diseño y corregir los quince puntos de QA a 390px y 1440px.

#### Scenario: Teléfono
- **WHEN** se muestran Comisiones, Equipo, Permisos, Dashboard, Ventas, Configuración, Catálogo, Login y Reportes a 390px
- **THEN** el documento no desborda horizontalmente, las identidades largas se truncan y las acciones no cubren tarjetas

#### Scenario: Desktop
- **WHEN** se muestran las pantallas afectadas a 1440px
- **THEN** los títulos, márgenes, chips y botones respetan los patrones existentes y el email queda contenido en la barra lateral

#### Scenario: Equipo cargado
- **WHEN** la API devuelve dos miembros
- **THEN** Configuración y Equipo muestran dos y nunca presentan cero durante la carga
