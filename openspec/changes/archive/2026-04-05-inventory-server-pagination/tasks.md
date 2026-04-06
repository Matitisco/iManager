## 1. Backend — Servicio

- [x] 1.1 Agregar interfaz `ListInventoryParams` en `inventory.service.ts`
- [x] 1.2 Implementar `buildWhereConditions()` con `Prisma.sql` y soporte para filtros de condición, estado, capacidad, modelo, grado, categoría y batería (con SUBSTRING PostgreSQL)
- [x] 1.3 Implementar `buildOrderByClause()` con whitelist de columnas permitidas
- [x] 1.4 Implementar `listInventoryPaged()` usando `$queryRaw` con `Promise.all` para datos + conteo
- [x] 1.5 Implementar `getInventoryFilteredIds()` que devuelve solo IDs que matchean los filtros

## 2. Backend — Rutas

- [x] 2.1 Ampliar `GET /` en `inventory.routes.ts` con `pagedQuerySchema` (zod) para `skip`, `take` y todos los filtros
- [x] 2.2 Agregar detección de modo paginado (`skip` o `take` presentes) vs. legacy (sin params)
- [x] 2.3 Agregar `GET /ids` con mismos filtros, devuelve `{ ids: string[] }`

## 3. Frontend — Servicio API

- [x] 3.1 Agregar interfaz `InventoryPageParams` en `inventory-api.ts`
- [x] 3.2 Implementar `fetchInventoryPage(user, params)` → `{ items, total }`
- [x] 3.3 Implementar `fetchInventoryFilteredIds(user, params)` → `string[]`

## 4. Frontend — Inventory.tsx

- [x] 4.1 Reemplazar estado `currentPage`/`visibleCount` por `items: Product[]`, `total: number`, `isInitialLoading`, `isLoadingMore`
- [x] 4.2 Eliminar cómputos client-side (`filteredInventory`, `sortedInventory`, `paginatedItems`)
- [x] 4.3 Agregar refs para evitar stale closures en IntersectionObserver (`filterParamsRef`, `userRef`, `isLoadingRef`, `itemsLengthRef`, `totalRef`)
- [x] 4.4 Implementar efecto de fetch-on-filter que resetea `items[]` y carga primera página al cambiar filtros/orden/categoría
- [x] 4.5 Implementar IntersectionObserver estático (`root: null`) que carga páginas adicionales al scrollear
- [x] 4.6 Agregar sentinel `<div ref={sentinelRef}>` al final de la tabla con spinner de carga
- [x] 4.7 Actualizar `toggleSelectAll` para ser async y llamar `fetchInventoryFilteredIds` al seleccionar todos
- [x] 4.8 Actualizar todas las mutaciones (inline edit, delete, add, bulk delete, bulk move) para actualizar `items[]` local además de AppContext
