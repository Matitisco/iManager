## Why

Las celdas vacías en la tabla de inventario se muestran en blanco, lo que dificulta distinguir si un campo está vacío intencionalmente o si hay un error de carga de datos. Mostrar `---` en celdas sin valor mejora la legibilidad y transmite claramente que el dato no existe.

## What Changes

- Las celdas de la tabla de inventario que tengan valor `null`, `undefined` o string vacío (`""`) SHALL mostrar el texto `---` como placeholder visual.
- Aplica a todas las columnas de la tabla: columnas fijas (model, imei, price, battery, status) y columnas custom.
- El placeholder `---` es solo visual — no se persiste en base de datos ni interfiere con el inline edit.
- En modo edición inline, el input/select muestra el campo vacío real (no `---`).

## Capabilities

### New Capabilities

- `inventory-empty-cell-placeholder`: Muestra `---` en celdas sin valor en la tabla de inventario.

### Modified Capabilities

- `inventory-inline-edit`: Las celdas que muestran `---` deben activar el inline edit igual que si tuvieran valor; al entrar en edición el campo aparece vacío.

## Non-goals

- No cambiar el valor en base de datos.
- No aplicar a celdas fuera de la tabla de inventario (ej. paneles, modales).
- No personalizar el placeholder por columna (siempre es `---`).

## Impact

- `src/pages/Inventory.tsx`: función `renderTd` — agregar guard para valores vacíos en cada case.
