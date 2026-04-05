## 1. Backend de categorías

- [x] 1.1 Modelo `InventoryCategory` en schema Prisma: id, name, storeId, order
- [x] 1.2 Campo `categoryId` en `Product` (FK opcional)
- [x] 1.3 `GET /api/inventory/categories` — lista categorías del store
- [x] 1.4 `POST /api/inventory/categories` — crear categoría
- [x] 1.5 `DELETE /api/inventory/categories/:id` — eliminar (productos quedan sin categoría)
- [x] 1.6 `PATCH /api/inventory/categories/:id/rename` — renombrar
- [x] 1.7 `PATCH /api/inventory/categories/reorder` — actualizar orden
- [x] 1.8 `PATCH /api/inventory/:id` — actualizar `categoryId` del producto

## 2. Tabs de categoría en frontend

- [x] 2.1 Tabs renderizados dinámicamente; tab "Todos" siempre primero
- [x] 2.2 Click en tab → filtra la tabla a esa categoría
- [x] 2.3 Botón `+` → input de nueva categoría (límite 30 chars)
- [x] 2.4 Modal de confirmación antes de eliminar una categoría
- [x] 2.5 Rename inline: doble click en tab → input; Escape cancela sin guardar, Enter/blur guarda
- [x] 2.6 Fix: Escape en rename de categoría no dispara onBlur save

## 3. Drag & drop de tabs

- [x] 3.1 Implementar DnD con pointer events (pointerdown/pointermove/pointerup)
- [x] 3.2 Bloque flotante que sigue el cursor durante el drag
- [x] 3.3 Cursor oculto durante el drag; restaurado al soltar
- [x] 3.4 Indicador visual de posición de drop entre tabs
- [x] 3.5 Fix: cursor management a useEffect para evitar cursor invisible pegado

## 4. Mover items entre categorías

- [x] 4.1 Dropdown "Mover a" en panel de edición individual
- [x] 4.2 Acción bulk "Mover a categoría" sobre la selección masiva
- [x] 4.3 Fix: dropdown de bulk-move con posicionamiento fixed (getBoundingClientRect)
- [x] 4.4 Fix: cerrar otros paneles al abrir Columnas, Importar o Filtros
