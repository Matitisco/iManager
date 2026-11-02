## ADDED Requirements

### Requirement: Historial legible y privado
El panel SHALL mostrar exclusivamente cargas, bajas y modificaciones de equipos, ventas, clientes, canjes, devoluciones, reparaciones, empleados y configuración, además de conexiones diarias. SHALL mostrar fecha/hora de Buenos Aires, actor y rol, recientes primero, filtros Cargas/Bajas/Modificaciones/Conexiones y fechas y paginación. SHALL describir campos modificados disponibles con nombres seguros y excluir valores privados, navegación, aperturas, clics, fallos e hitos sin cambios.

#### Scenario: Edición con campos disponibles
- **WHEN** un admin consulta una edición con cambios de nombre y teléfono
- **THEN** ve «Editó un cliente · Campos: Nombre, Teléfono», sin valores anteriores o nuevos

#### Scenario: Acceso denegado
- **WHEN** un usuario sin permiso admin consulta el historial
- **THEN** recibe 403 sin datos

#### Scenario: Navegación excluida
- **WHEN** existen visitas, clics o aperturas posteriores a una carga
- **THEN** solo la carga aparece como acción

### Requirement: Fuentes combinadas
El backend SHALL combinar auditoría/BD y PostHog deduplicando operaciones coincidentes. SHALL mostrar como máximo una conexión por usuario, tienda y día argentino, incluso entre fuentes y páginas, con texto «Se conectó». La clave SHALL permanecer en backend.

#### Scenario: Varias sesiones diarias
- **WHEN** un usuario tiene varios logins y actividad local el mismo día argentino
- **THEN** aparece una sola conexión, incluso al cargar más; otro usuario u otro día conserva su propia conexión

#### Scenario: PostHog no disponible
- **WHEN** falla PostHog o falta configuración
- **THEN** se muestran datos locales y aviso discreto

### Requirement: Última acción
La lista SHALL mostrar la última operación o conexión diaria con el mismo alcance del historial.

#### Scenario: Visita posterior a una modificación
- **WHEN** una visita de PostHog es posterior a una modificación
- **THEN** la visita no reemplaza la última acción
