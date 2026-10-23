## ADDED Requirements

### Requirement: Acceso estable al resumen periódico
El sistema SHALL incluir Resumen periódico en las pestañas compartidas de Análisis para usuarios con permiso Reportes.

#### Scenario: Navegación entre pantallas analíticas
- **WHEN** el usuario navega entre Reportes, Comisiones, Historial y Resumen periódico
- **THEN** Resumen periódico permanece accesible y sólo el destino actual queda seleccionado

#### Scenario: Restauración de selección
- **WHEN** el usuario recarga o usa Atrás/Adelante sobre la ruta del resumen
- **THEN** se muestra Resumen periódico con su pestaña seleccionada

#### Scenario: Permisos limitados
- **WHEN** el usuario no tiene permiso Reportes
- **THEN** no se ofrece el resumen y su ruta directa queda protegida por el mismo permiso
