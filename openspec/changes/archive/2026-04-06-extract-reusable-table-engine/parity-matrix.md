# Inventory -> Table Engine Parity Matrix

| Inventory behavior | Source spec | Target layer | Minimum requirement in this change |
|---|---|---|---|
| Checkbox por fila + checkbox header | `inventory-bulk-actions` | Core | Engine must support row selection and visible-scope header selection |
| Shift+click para rango | `inventory-bulk-actions` | Core | Engine must preserve range selection semantics |
| Escape limpia seleccion | `inventory-context-menu` | Core | Engine must support escape-to-clear active multi-selection |
| Select-all sobre dataset filtrado aunque no este cargado completo | `inventory-server-pagination` | Adapter + Core | Engine must define `fetchFilteredIds` / selection-scope support |
| Resize de columnas con minimo | `inventory-column-customization` | Core | Engine must preserve resizable columns with min-width constraints |
| Reorder de columnas por drag | `inventory-column-customization` | Core | Engine must preserve reorder behavior and persisted preference state |
| Rename inline de columnas | `inventory-column-customization` | Core | Engine must preserve editable labels with save/cancel semantics |
| Persistencia de width/order/rename/visibility | `inventory-column-customization` | Adapter + Core | Engine must use a persistence adapter for column preferences |
| Inline edit con comportamiento fino | `inventory-inline-edit` | Core | Engine must preserve activation/save/cancel lifecycle |
| Placeholder `---` editable | `inventory-empty-cell-placeholder`, `inventory-inline-edit` | Core + Renderer | Placeholder is visual only; editing must start from empty value |
| Enum cell con `<select>` y single-click | `inventory-enum-cell`, `inventory-inline-edit` | Core + Renderer | Engine must support enum renderer/editor contract |
| Guardado optimista sin flash | `inventory-inline-edit` | Core | Engine must preserve optimistic display while callbacks resolve |
| Click simple no debe pisar doble click | `inventory-inline-edit` | Core | Engine must preserve configurable click vs double-click semantics |
| Tab / Shift+Tab entre celdas | `inventory-keyboard-cell-navigation` | Core | Engine must preserve horizontal traversal with commit semantics |
| Enter / flechas con foco vertical | `inventory-keyboard-cell-navigation` | Core | Engine must preserve vertical navigation contract |
| Menu contextual por fila | `inventory-context-menu` | Core | Engine must provide context-menu infrastructure |
| Acciones bulk desde menu / UI | `inventory-context-menu`, `inventory-bulk-actions` | Core + Plugin | Engine must support row and bulk action registration |
| `Agregar item` crea fila inline unica | `inventory-context-menu-add-item` | Plugin | Engine must support plugin-driven inline draft row creation |
| Solo una fila inline activa | `inventory-context-menu-add-item` | Plugin + Core | Engine must preserve single draft-row guardrail |
| Bloqueo de navegacion/paginacion con draft activo | `inventory-context-menu-add-item` | Plugin + Core | Engine/plugin must be able to block page change while draft is active |
| Sort/filter/search local o remoto | `inventory-server-pagination` + Inventory behavior | Core + Adapter | Engine must support both local and remote orchestration under one contract |
| Paginacion/infinite loading remota | `inventory-server-pagination` + Inventory behavior | Core + Adapter | Engine must not assume full dataset in memory |
| Drag row -> categoria | `inventory-categories` + Inventory behavior | Plugin | Category workflows remain outside core via plugin |
| Mover rows a categoria | `inventory-categories` | Plugin + Adapter | Inventory plugin owns category actions; engine owns action plumbing |
| Export segun vista actual | Inventory behavior | Adapter + Core | Engine must export from current view/selection contract, not hardcoded Inventory data |

## Notes

- Anything category-specific stays out of core.
- Anything requiring server coordination must go through adapters, not hidden side effects in the engine.
- Any behavior already covered by an Inventory spec must be explicitly mapped before implementation tasks can be marked complete.
