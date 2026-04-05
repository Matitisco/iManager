## Why

El panel Ordenar usa etiquetas hardcodeadas (`'Modelo'`, `'Precio'`, `'Batería'`) en lugar de leer los nombres de columna del mismo estado (`colNames`) que usa el header de la tabla. Cuando el usuario renombra una columna, el panel Ordenar sigue mostrando el nombre original, rompiendo la consistencia. El fix es referencia única: sort lee de `colNames`.

## What Changes

- El panel Ordenar reemplaza etiquetas hardcodeadas por `colNames[key] || DEFAULT_COL_NAMES[key]` para las columnas `model`, `price`, `battery`
- La opción `condition` (que no es una ColId de la tabla) mantiene su etiqueta actual ya que no tiene columna renombrable asociada
- La persistencia de `colNames` en `localStorage` ya existe y funciona; se verifica que recarga correctamente

## Capabilities

### New Capabilities
- ninguna

### Modified Capabilities
- `inventory-column-customization`: el requisito de rename de columna se extiende — el nombre renombrado MUST reflejarse en todos los controles de la UI que muestran ese nombre de columna, incluyendo el panel Ordenar

## Impact

- `src/pages/Inventory.tsx`: únicamente la definición del array de sort options (líneas ~735-739) — pasar de objetos con `label` hardcodeado a derivar el label de `colNames`
- Sin cambio de schema, sin cambio de backend, sin nuevas dependencias

## Non-goals

- No cambiar el comportamiento de ordenación (lógica de `sortedInventory`)
- No agregar nuevas opciones de sort
- No mover `colNames` a AppContext ni a backend
