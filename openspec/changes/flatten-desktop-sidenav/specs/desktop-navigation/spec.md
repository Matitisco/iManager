## ADDED Requirements

### Requirement: Grupos laterales sin subsecciones
El sidenav de escritorio MUST mostrar un acceso por grupo permitido, sin desplegar sus subsecciones.

#### Scenario: Abrir y recorrer un grupo
- **WHEN** la persona selecciona Stock en el sidenav
- **THEN** se abre su primera sección permitida, Stock queda activo y las subsecciones disponibles se muestran en las pestañas de la página.

#### Scenario: Pendientes y acceso restringido
- **WHEN** un grupo tiene pendientes o permisos limitados
- **THEN** su acceso conserva la suma de pendientes de las secciones permitidas y nunca abre una sección sin permiso.
