## Why

La tabla de inventario cargaba todos los ítems de la base de datos en una sola request al iniciar la app (vía AppContext), lo cual no escala con cientos o miles de equipos — la primera carga se volvía lenta y el frontend mantenía todo en memoria. La paginación anterior era solo visual (slicing del array local).

## What Changes

- `GET /api/inventory` ahora acepta `skip`, `take` y parámetros de filtro/orden como query params; devuelve `{ items, total }` cuando están presentes (backward-compatible: sin params sigue devolviendo `{ inventory }` para AppContext)
- Nuevo endpoint `GET /api/inventory/ids` devuelve todos los IDs que matchean los filtros activos (usado para select-all global)
- La tabla de inventario usa scroll infinito real: fetches de 30 ítems al server a medida que el usuario scrollea, con spinner de carga
- "Seleccionar todo" fetcha los IDs desde el server y selecciona todos los ítems filtrados, no solo los cargados
- Las mutaciones (inline edit, delete, add row, bulk move, bulk delete) actualizan el estado local sin refetch innecesario

## Capabilities

### New Capabilities

- `inventory-server-pagination`: Paginación server-side del listado de inventario con filtros, orden y scroll infinito

### Modified Capabilities

- `inventory-pagination`: El comportamiento cambia de paginación por botones (client-side) a scroll infinito con fetches reales al servidor

## Impact

- `backend/src/modules/inventory/inventory.service.ts`: nuevas funciones `listInventoryPaged` y `getInventoryFilteredIds` con queries raw SQL (Prisma `$queryRaw`) para soportar filtro de batería y ordenamiento server-side
- `backend/src/modules/inventory/inventory.routes.ts`: GET `/` ampliado con query schema, nuevo GET `/ids`
- `src/services/inventory-api.ts`: nuevas funciones `fetchInventoryPage` y `fetchInventoryFilteredIds`
- `src/pages/Inventory.tsx`: eliminado client-side filtering/sorting/slicing; reemplazado por estado local `items[]` + `total` con IntersectionObserver

## Non-goals

- No se modifica cómo AppContext carga el inventario para otros módulos (Sales, etc.) — sigue cargando todo en background
- No se implementa búsqueda full-text (el filtro de modelo sigue siendo exact match por dropdown)
- No se agrega endpoint de distinct values para los dropdowns de filtro — siguen usando los datos de AppContext
