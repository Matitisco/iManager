## 1. tipos y constantes

- [x] 1.1 En `src/types.ts`: extender `CustomColumn.type` a `'text' | 'number' | 'enum'` y agregar campo `options?: string[]`
- [x] 1.2 En `Inventory.tsx`: agregar `ENUM_COL_OPTIONS: Partial<Record<ColId, string[]>>` con las opciones de `status` (`['DISPONIBLE', 'VENDIDO', 'EN_REVISION']`)
- [x] 1.3 En `Inventory.tsx`: agregar `'status'` a `EDITABLE_COL_IDS`, `COL_TO_FIELD` y `FIELD_TO_COL`

## 2. renderTd — celda status

- [x] 2.1 Reescribir `case 'status'` en `renderTd`: agregar `data-col="status"`, `focusRing`, y un `<div>` con `hover:bg-gray-200/70 cursor-pointer` hitbox
- [x] 2.2 En modo display (no editando): mantener el badge coloreado existente dentro del hitbox div
- [x] 2.3 En modo edición (`inlineEditCell.field === 'status'`): renderizar `<select autoFocus>` con las opciones de `ENUM_COL_OPTIONS.status`, valor `inlineEditValue`
- [x] 2.4 En el `<select>`: `onChange` actualiza `inlineEditValue`/`inlineEditValueRef` y llama `commitInlineEdit` directamente; `onBlur` llama `handleCellBlur`; `onKeyDown` llama `handleCellKeyDown`; `onClick` hace `stopPropagation`

## 3. navegación de teclado

- [x] 3.1 Verificar que `navigateFrom` incluye `status` en `editableCols` (ya que `FIELD_TO_COL['status'] = 'status'` y `EDITABLE_COL_IDS` ahora lo incluye)
- [x] 3.2 Verificar que Tab/Shift-Tab navega hacia/desde la celda status correctamente

## 4. custom columns de tipo enum

- [ ] 4.1 ⏳ PENDIENTE: custom columns no se renderizan como celdas de tabla hoy (solo en InventoryEditPanel). Cuando se agreguen custom columns a la tabla principal, detectar `col.type === 'enum'` y renderizar `<select>` con las `options` de la columna. Foundation: `CustomColumn.type` ya acepta `'enum'` y `options?: string[]` en types.ts.
- [ ] 4.2 ⏳ PENDIENTE: el guardado de custom column enum usará `customFields[col.id]` como campo, mismo flujo que custom columns de texto. Implementar junto con 4.1.

## 5. verificación

- [x] 5.1 Correr `npm run lint` en frontend — sin errores TypeScript
- [x] 5.2 Verificar en dev que click en Disponibilidad abre select con 3 opciones
- [x] 5.3 Verificar que el hover hitbox aparece sobre la celda status
- [x] 5.4 Verificar que seleccionar una opción guarda y actualiza el badge
- [x] 5.5 Verificar que Escape cierra el select sin guardar
