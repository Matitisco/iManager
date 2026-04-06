---
name: inventory-dblclick-detection
type: tasks
---

# Tasks: inventory-dblclick-detection

- [x] Agregar refs `clickTimerRef` y `pendingClickRef` en `Inventory.tsx`
- [x] Extraer lógica de selección a función `applySelection(invItem, index, shiftKey)`
- [x] Reescribir `handleRowClick` con debounce de 250ms para single-click
- [x] Agregar fallback de detección de columna por posición X en doble-click
- [x] Verificar lint TypeScript limpio
- [x] Push a main
