# Tasks: inventory-drag-to-category

- [x] Agregar props `confirmLabel` y `confirmClassName` a `ConfirmModal`
- [x] Agregar estado y refs para item drag (`draggingItems`, `itemDragPos`, `itemDropTarget`, `pendingItemMove`, `itemDragStartRef`, `selectedIdsRef`, etc.)
- [x] `useEffect` global para `pointermove`/`pointerup` con threshold de 5px y auto-selección
- [x] `cursor: none` + `userSelect: none` en `document.body` durante drag
- [x] `onPointerDown` en todas las filas de la tabla (no solo seleccionadas)
- [x] Highlight de drop target en category tabs (`scale-110 bg-gray-100`)
- [x] Badge flotante con conteo + label dinámico "Soltar en [Cat]"
- [x] `ConfirmModal` para confirmar el bulk move con botón negro
- [x] Suprimir `contextMenu` durante drag activo
- [x] Actualización instantánea de tabla (sin delay ni animación de salida)
