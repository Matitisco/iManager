---
description: Skill específica para el módulo Inventory — el más complejo del proyecto. Cubre inline edit, categorías, import XLSX, paginación y bulk actions.
---

# iManager Inventory Skill

Aplicar esta skill **siempre que se toque `src/pages/Inventory.tsx`** o cualquier código de inventario.

Inventory es el módulo más grande del proyecto (~57KB). Antes de cualquier cambio, entender la estructura interna.

---

## Arquitectura del componente

```
Inventory.tsx
  ├── InventoryToolbar       → buscador, Filtros, Columnas, Importar, Ordenar, categorías
  ├── InventoryTable         → tabla principal con inline edit y checkboxes
  │     ├── inline edit       → double-click en celda abre input; confirm con Enter/blur
  │     └── bulk select       → checkbox header + shift+click para rango
  ├── InventoryEditPanel     → panel lateral de edición completa + delete
  ├── ImportInventoryModal   → import CSV/XLSX con mapeo de columnas y selector de hoja
  ├── ConfirmModal           → confirmación antes de delete masivo o de categoría
  └── BulkMoveDropdown       → dropdown con fixed positioning para mover items de categoría
```

---

## Categorías

Las categorías son tabs que filtran el inventario por `categoryId`.

```ts
// Estado de categorías
inventoryCategories: InventoryCategory[]   // desde AppContext
activeCategory: string | null              // 'all' muestra todo

// Operaciones via AppContext
createCategory(name: string)
renameCategory(id: string, name: string)
deleteCategory(id: string)                // nullifica categoryId en items afectados
bulkMoveCategory(ids: string[], categoryId: string | null)
```

**Al eliminar una categoría**, primero mostrar `ConfirmModal`. El backend nullifica el `categoryId` de todos los items afectados automáticamente.

---

## Inline edit

Double-click en una celda → `editingCell: { rowId, field }`.

Patrones críticos:

```ts
// Evitar el flash de valor entre write y re-render del servidor
const [pendingCell, setPendingCell] = useState<{ id: string; field: string; value: string } | null>(null);

// Al mostrar el valor en celda:
const displayValue = pendingCell?.id === item.id && pendingCell.field === field
  ? pendingCell.value
  : item[field];
```

- El input se cierra **después** de que la API responde (no antes)
- `Escape` cancela sin guardar (no hace blur → no dispara save)
- `Enter` guarda y cierra
- `blur` guarda (excepto si fue causado por `Escape`)

```ts
const handleCellSave = async (id: string, field: string, value: string) => {
  setPendingCell({ id, field, value });   // overlay optimista
  setEditingCell(null);                  // cierra input
  try {
    await updateProduct({ ...item, [field]: value });
  } finally {
    setPendingCell(null);                // limpia overlay
  }
};
```

---

## Bulk select

- Checkbox header → seleccionar/deseleccionar página actual
- Shift+click → selección en rango (entre el último seleccionado y el actual)
- `selectedIds: Set<string>` como estado

```ts
const handleRowCheck = (id: string, event: React.MouseEvent) => {
  if (event.shiftKey && lastChecked.current) {
    // calcular rango y togglear todos
  } else {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    lastChecked.current = id;
  }
};
```

---

## Import XLSX/CSV

`ImportInventoryModal` maneja:
1. Selección de archivo (CSV o XLSX)
2. Selección de hoja (si es Excel multi-hoja)
3. Selección de fila de header
4. Mapeo de columnas del archivo → campos del sistema
5. Preview de los items parseados
6. Submit → `inventory-import-api.ts`

### Parsing de batería

```ts
// batteryHealth es string. Normalizar en import:
// 1     → "100%"
// 0.84  → "84%"
// 85    → "85%"
// "83-85" → "83-85%"
// "" o null → "N/A"
```

### Columnas auto-mapeadas

Si una columna del archivo no matchea ningún campo conocido, se agrega como `customColumn`.

### Campos del sistema

```ts
const SYSTEM_FIELDS = ['modelo', 'marca', 'imei', 'capacity', 'color',
  'batteryHealth', 'condition', 'price', 'status', 'notes'];
```

---

## Paginación

20 items por página. El estado de paginación es local al componente.

```ts
const [currentPage, setCurrentPage] = useState(1);
const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
const paginatedItems = filteredItems.slice(
  (currentPage - 1) * PAGE_SIZE,
  currentPage * PAGE_SIZE
);
```

Resetear a página 1 cuando cambia el filtro activo o la categoría.

---

## BulkMoveDropdown: posicionamiento

El dropdown usa `getBoundingClientRect()` + `position: fixed` para evitar overflow clipping del scroll container:

```tsx
const rect = buttonRef.current.getBoundingClientRect();
setDropdownStyle({ top: rect.bottom + 8, left: rect.left });
// Renderizar con style={{ position: 'fixed', ...dropdownStyle }}
```

---

## Campos del modelo Product (PG)

```ts
id, storeId, modelo, marca, imei, capacity, color,
batteryHealth (string), condition, price, status ('DISPONIBLE' | 'VENDIDO'),
categoryId (nullable), customFields (JSON), createdAt, updatedAt
```

---

## Ordenamiento

El dropdown "Ordenar" permite sort local por: `modelo`, `price`, `batteryHealth`, `condition`.

`batteryHealth` se parsea para sort: extraer el primer número del string.

---

## Lo que NO hacer

- No guardar celdas en `onBlur` si fue causado por Escape
- No cerrar el input antes de que la API responda (causa flash de valor viejo)
- No mutar `inventoryCategories` directamente — siempre vía AppContext
- No usar un `fetch` directo para inventory — siempre `inventory-api.ts`
- No hardcodear el `PAGE_SIZE` en más de un lugar
