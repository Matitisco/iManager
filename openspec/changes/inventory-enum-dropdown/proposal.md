## Why

La columna "Disponibilidad" (campo `status`) muestra un badge estático sin hitbox ni capacidad de edición. Los campos con valores fijos como `status`, `condition` y `grade` son enums — no corresponde editarlos con un input de texto libre, sino con un desplegable que exponga sus opciones válidas. Además, `CustomColumn` carece del tipo `'enum'`, impidiendo que columnas personalizadas adopten este mecanismo.

## What Changes

- **`status` pasa a ser editable inline**: single-click en la celda abre un `<select>` con las opciones del enum; al seleccionar se guarda inmediatamente via PATCH.
- **Hitbox en celda `status`**: el área de hover y click cubre toda la celda, igual que las columnas de texto existentes.
- **Mecanismo de enum extensible**: se define `ENUM_COL_OPTIONS` como registro central de opciones por `ColId`, listo para agregar `condition` y `grade` cuando sean columnas fijas.
- **`CustomColumn` agrega tipo `'enum'`**: el campo `type` acepta `'enum'` y se suma `options?: string[]` para definir los valores del desplegable.
- **Custom columns de tipo enum**: la tabla renderiza sus celdas con el mismo dropdown inline que `status`.

## Capabilities

### New Capabilities
- `inventory-enum-cell`: Celdas de tabla con valores fijos (enums) que se editan via dropdown inline — hitbox, select estilizado, guardado inmediato.

### Modified Capabilities
- `inventory-inline-edit`: Se extiende el mecanismo de edición inline para soportar celdas de tipo enum (select) además de texto y número.

## Impact

- `src/pages/Inventory.tsx`: agregar `status` a `EDITABLE_COL_IDS`, `COL_TO_FIELD`, `FIELD_TO_COL`; definir `ENUM_COL_OPTIONS`; reescribir `case 'status'` en `renderTd`.
- `src/types.ts`: extender `CustomColumn` con `type: 'text' | 'number' | 'enum'` y `options?: string[]`.
- Sin cambios en backend, Prisma ni migraciones — los valores ya existen como strings en PG.

### Non-goals
- No se agregan `condition` ni `grade` como columnas fijas de la tabla en este change (el mecanismo queda listo para recibirlas).
- No se modifica el schema de Prisma ni se agregan validaciones de enum en el backend.
- No se toca el panel de edición completa (InventoryEditPanel).
