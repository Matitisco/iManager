## Why
Servicio técnico muestra órdenes archivadas de cualquier estado aunque se seleccione un chip específico. QA local reprodujo una orden En reparación visible al elegir Recibido 0, tanto con datos ficticios como por inspección del predicado compartido de las vistas.

## What Changes
- Aplicar el estado seleccionado también al conjunto de órdenes archivadas.
- Mantener agrupación móvil consistente con el estado seleccionado.
- Cubrir tablero, lista, móvil, búsqueda y estados anteriores normalizados mediante regresiones relacionadas.

## Capabilities
### New Capabilities
- `service-archive-filters`: composición de archivado, estado y búsqueda de órdenes técnicas.

### Modified Capabilities
Ninguna.

## Impact
Frontend: ServiceScreen y su test relacionado. Sin cambios de backend, Prisma, AppContext, navegación ni componentes compartidos.

## Non-goals
Rediseños, permisos o acciones sobre archivados, cambios de Clientes, Seguimientos oculto, historial compartido, migraciones y datos de producción.
