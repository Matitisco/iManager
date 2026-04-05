## Why

Sin categorías, todo el inventario era una lista plana que se volvía inmanejable en tiendas con múltiples marcas o tipos de productos. Se implementó un sistema de categorías con tabs para que los usuarios puedan organizar, filtrar y mover items entre grupos.

## What Changes

- **Tabs de categoría**: filtran la tabla al hacer click; tab "Todos" siempre presente
- **Crear categoría**: botón `+` al final de los tabs; nombre con límite de 30 caracteres
- **Eliminar categoría**: confirmación modal antes de eliminar; items quedan sin categoría
- **Mover items**: menú contextual en fila individual + acción bulk para mover a otra categoría
- **Inline rename**: doble click en tab → input inline; Escape cancela, Enter/blur guarda
- **DnD reorder**: drag & drop de tabs con pointer events; bloque flotante sigue el cursor, cursor oculto durante el drag, indicador visual de drop
- **Shift+click** en checkboxes de filas para seleccionar rangos

## Capabilities

### New Capabilities

- `inventory-categories`: Sistema de categorías (CRUD, filtrado por tab, move individual y bulk)

### Modified Capabilities

- `inventory-bulk-actions`: Acción "Mover a categoría" sobre la selección masiva

## Impact

- **src/pages/Inventory.tsx**: estado de categorías, filtrado, DnD de tabs
- **backend/src/modules/inventory/**: endpoints `POST /api/inventory/categories`, `DELETE`, `PATCH /rename`, `PATCH /reorder`; campo `categoryId` en producto
- **prisma/schema.prisma**: nuevo modelo `InventoryCategory` con relación a `Product`

## Non-goals

- No hay subcategorías (un nivel de jerarquía)
- Las categorías son por tienda (storeId), no globales
- No hay categorías predefinidas por defecto
