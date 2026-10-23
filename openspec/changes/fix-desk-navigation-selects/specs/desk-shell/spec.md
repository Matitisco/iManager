## ADDED Requirements

### Requirement: Navegación estable entre pantallas
El shell SHALL conservar la tipografía y ancho de la navegación al cambiar de sección.

#### Scenario: Historial y Control de stock
- **WHEN** se abre Historial o Control de stock
- **THEN** los items y labels mantienen font-size, line-height, weight y ancho del shell compartido.

### Requirement: Desplegables del desk
Los filtros y formularios del desk SHALL usar DeskSelect con teclado y opciones accesibles dentro del viewport.

#### Scenario: Abrir filtros o formularios
- **WHEN** se abre un desplegable de Historial, Equipos, reclamos, catálogos o importación
- **THEN** usa la lista propia con selección, cierre y scroll interno compartidos.

### Requirement: Más móvil sin superposición
Más SHALL separar banner, perfil y navegación y permitir acceder al último destino.

#### Scenario: Pantalla angosta con menú desplegado
- **WHEN** se muestra Más a 360, 375 o 390 px, con o sin banner
- **THEN** los bloques no se superponen y el último item puede desplazarse por encima de la barra inferior.
