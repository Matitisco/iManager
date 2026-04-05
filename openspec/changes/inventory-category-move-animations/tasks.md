## 1. Exit animation — ítems saliendo de la categoría actual

- [x] 1.1 En `src/pages/Inventory.tsx`, en el `<tbody>`, envolver el `pagedInventory.map(...)` en `<AnimatePresence mode="popLayout">`
- [x] 1.2 Cambiar `<tr key={invItem.id}>` a `<motion.tr key={invItem.id}>` con `exit={{ opacity: 0, x: 16 }}` y `transition={{ duration: 0.1 }}`
- [x] 1.3 Verificar que el exit animation solo se ve cuando `activeCategoryId !== 'all'` (ya lo garantiza la lógica de filtrado — no se requiere código extra)

## 2. Enter animation — ítems apareciendo en la nueva categoría

- [x] 2.1 Agregar `initial={{ opacity: 0 }}` y `animate={{ opacity: 1 }}` en el `motion.tr`, con `transition={{ duration: 0.1, delay: idx * 0.015 }}`
- [x] 2.2 Verificar que el stagger se resetea al cambiar de categoría (el re-render con nuevas filas dispara los `initial` automáticamente)

## 3. Verificación

- [x] 3.1 Mover un ítem individual desde el menú contextual: la fila debe deslizarse y desvanecerse antes de desaparecer; sin delay visible en el menú
- [x] 3.2 Mover bulk (3+ ítems): todas las filas salen simultáneamente en ≤ 150 ms
- [x] 3.3 Hacer click en cualquier tab de categoría: las filas entran en cascada con stagger corto
- [x] 3.4 Correr `npm run lint` en el frontend — sin errores TypeScript
