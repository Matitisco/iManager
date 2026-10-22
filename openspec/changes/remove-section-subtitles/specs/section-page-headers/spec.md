## ADDED Requirements

### Requirement: Section headers without subtitles
La aplicación SHALL mostrar los encabezados de todas las secciones desk sin subtítulo bajo el título en desktop y móvil.

#### Scenario: Open a section
- **WHEN** el usuario abre una sección en desktop o móvil
- **THEN** el encabezado conserva título, acciones y pestañas y no muestra subtítulo

#### Scenario: Preserve contextual content
- **WHEN** el usuario consulta tablas, Dashboard o abre modales, overlays o sheets
- **THEN** los contadores de tabla, el saludo del Dashboard y los subtítulos de dichos modales/overlays/sheets conservan su comportamiento
