## 1. Remover click-en-fila como disparador del modal

- [x] 1.1 En `src/pages/Inventory.tsx`, localizar el handler `onClick` del `<tr>` que abre `InventoryEditPanel` y eliminarlo
- [x] 1.2 Verificar que el modal sigue abriéndose correctamente desde la opción "Editar" del menú contextual (click derecho)
- [x] 1.3 Verificar que el doble-click sigue activando la edición inline (no colisiona con el onClick removido)

## 2. Mejorar hitbox de la celda editable

- [x] 2.1 En el wrapper del contenido editable de cada celda, cambiar la estructura para que el área de doble-click cubra `w-full h-full` sin padding interno sobrante
- [x] 2.2 Verificar que doble-click en cualquier punto dentro de la celda activa el input (sin zonas muertas)

## 3. Implementar navegación por teclado entre celdas

- [x] 3.1 Agregar estado `focusedCell: { rowIndex: number; colKey: string } | null` en `Inventory.tsx` para rastrear la celda enfocada sin edición activa
- [x] 3.2 En el `onKeyDown` del input inline, agregar handler para **Tab**: guarda la celda actual, calcula la siguiente celda (próxima columna visible → si es la última, primera columna de la fila siguiente) y activa edición en ella; `preventDefault()` para no cambiar foco del DOM
- [x] 3.3 En el `onKeyDown` del input inline, agregar handler para **Shift+Tab**: igual que Tab pero en sentido inverso; `preventDefault()`
- [x] 3.4 En el `onKeyDown` del input inline, agregar handler para **Enter**: guarda la celda actual y activa edición en la misma columna de la fila siguiente (si existe)
- [x] 3.5 En el `onKeyDown` del input inline, agregar handler para **↓**: guarda la celda actual, cierra el input, mueve `focusedCell` a la misma columna en la fila siguiente sin activar edición
- [x] 3.6 En el `onKeyDown` del input inline, agregar handler para **↑**: igual que ↓ pero sube a la fila anterior
- [x] 3.7 Verificar que **Escape** cierra el input sin guardar y mantiene `focusedCell` en la celda actual (comportamiento existente — revisar que no rompa)
- [x] 3.8 Asegurar que la lógica de navegación usa `colKey` (string) como identificador de columna, no índice numérico, para respetar reordenamiento de columnas

## 4. Verificación final

- [x] 4.1 Correr `npm run lint` en el frontend — cero errores TypeScript
- [ ] 4.2 Probar manualmente el flujo completo: doble-click → editar → Tab → editar otra celda → Enter → baja fila → Escape → cancela
- [ ] 4.3 Probar que click derecho → "Editar" sigue abriendo el modal completo
- [ ] 4.4 Probar que click simple en fila ya no abre el modal
