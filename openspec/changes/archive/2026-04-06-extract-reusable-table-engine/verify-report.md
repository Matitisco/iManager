## Verify Report ? `extract-reusable-table-engine`

### Estado

**Status:** Structural verification passed, runtime QA pending

La extracci?n del motor reusable ya qued? respaldada por c?digo y por `npm run lint` pasando. Este reporte deja trazabilidad de qu? comportamientos quedaron cubiertos y cu?les siguen dependiendo de validaci?n manual/visual.

### Evidencia revisada

- `src/components/TableEngine/types.ts`
- `src/components/TableEngine/hooks/useColumnCustomization.ts`
- `src/components/TableEngine/hooks/useTableSelection.ts`
- `src/components/TableEngine/hooks/useTableSort.ts`
- `src/components/TableEngine/components/TableHeader.tsx`
- `src/components/TableEngine/components/TableRow.tsx`
- `src/components/TableEngine/components/TableCell.tsx`
- `src/components/TableEngine/TableEngine.tsx`
- `src/components/inventory-table-domain.tsx`
- `src/services/inventory-table-adapter.ts`
- `src/pages/Inventory.tsx`
- `openspec/changes/extract-reusable-table-engine/parity-matrix.md`
- `openspec/changes/extract-reusable-table-engine/template-contract.md`

### Paridad verificada contra Inventory

#### Selecci?n y bulk actions
- [x] Checkbox por fila y header select-all
- [x] Shift+click para rango
- [x] Escape limpia la selecci?n activa
- [x] Select-all filtrado con IDs remotos
- [x] Acciones bulk conectadas al flujo de Inventory

#### Columnas
- [x] Resize con persistencia por `viewId`
- [x] Reorder por drag & drop
- [x] Rename inline
- [x] Persistencia de width / order / rename / visibility

#### Inline edit y navegaci?n
- [x] Placeholder `---` para valores vac?os
- [x] Enum cells con editor dedicado
- [x] Click vs double-click respetado por tipo de celda
- [x] Enter / Escape / Tab / Shift+Tab / ArrowUp / ArrowDown
- [x] Flujo optimista sin flash visual del valor viejo

#### Context menu y add-row
- [x] Context menu individual y bulk
- [x] Inline create row desde ?Agregar ?tem?
- [x] Guardrail de una sola draft row activa
- [x] Bloqueo de navegaci?n mientras hay draft activo

#### Paging y remote mode
- [x] Sort / filter / search soportados en modo remoto
- [x] Infinite loading remoto
- [x] El engine no asume dataset completo en memoria

#### Categor?as y dominio Inventory
- [x] Drag row -> categor?a fuera del core
- [x] Move a categor?a v?a plugin / adapter
- [x] Renderers espec?ficos de Inventory extra?dos fuera del core
- [x] Export basado en vista y selecci?n actuales

### Boundaries arquitect?nicos

- [x] El core no contiene l?gica espec?fica de Inventory
- [x] Los fetches y mutaciones viven en adapters
- [x] Las acciones y renderers de dominio viven en plugins/helpers de dominio
- [x] El engine soporta modo local y remoto bajo un mismo contrato

### Contrato reusable

- [x] `template-contract.md` describe el contrato instanciable sin depender de nombres de Inventory
- [x] La API p?blica del engine ya habla en t?rminos gen?ricos: columnas, selecci?n, acciones, adapters y persistencia
- [x] La matriz de paridad qued? trazable a artefactos concretos y a c?digo real

### Resultado

**Conclusi?n:** la base reusable qued? bien armada y Inventory ya consume el contrato del engine en lugar de depender de su implementaci?n de tabla anterior.

**Pendiente:** QA manual / visual de los flujos finos que dependen de interacci?n real del navegador y de datos reales en inventario.
