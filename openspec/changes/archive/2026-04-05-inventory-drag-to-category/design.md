# Design: inventory-drag-to-category

## Approach

Drag nativo con Pointer Events API (consistente con el drag existente de category tabs y column reordering). Sin librerías externas de DnD.

## Key Decisions

### Press + move (5px threshold), no hold timer
- `onPointerDown` en toda fila registra el punto de inicio
- `pointermove` global detecta el threshold y activa el drag
- Sin delay: el drag empieza al instante al mover el cursor
- Si el ítem no estaba seleccionado, se selecciona en ese momento

### Auto-selección al arrastrar
- Si el ítem arrastrado YA estaba en `selectedIds`: se arrastran todos los seleccionados
- Si NO estaba seleccionado: se limpia la selección y se selecciona solo ese ítem
- `selectedIdsRef` se actualiza sincrónicamente antes de activar el drag para evitar stale closures en los handlers

### Drop targets: solo category tabs
- Se detectan con `[data-cat-id]` en el contenedor de pestañas
- La pestaña "Todas" no tiene `data-cat-id` → no es drop target válido
- Hit testing via `getBoundingClientRect()` en `pointermove`

### Badge flotante
- `position: fixed` siguiendo el cursor con offset (+14px, -14px)
- Muestra conteo de ítems; cuando está sobre un drop target, cambia a "Soltar en [Categoría]"
- `cursor: none` + `userSelect: none` en `document.body` durante el drag

### Confirmación
- Reutiliza `ConfirmModal` con props opcionales `confirmLabel` y `confirmClassName`
- El confirm ejecuta `bulkMoveCategory` directamente (sin delay de animación)
- La tabla se actualiza al instante al recibir la respuesta del backend

### Highlight de drop target
- Tab hovered: `scale-110 bg-gray-100 border-gray-900`
- Otras tabs no-all: `opacity-70` para enfatizar el target activo

## State / Refs Added

```ts
// State
draggingItems: boolean
itemDragPos: { x, y }
itemDropTarget: string | null
pendingItemMove: { categoryId, categoryName, count } | null

// Refs (evitan stale closures en handlers globales)
draggingItemsRef
itemDropTargetRef
itemDragStartRef: { x, y, itemId } | null
selectedIdsRef  // mirror de selectedIds, siempre current
```
