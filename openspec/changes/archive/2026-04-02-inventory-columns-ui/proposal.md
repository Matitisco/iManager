## Why

La tabla de inventario tenía columnas de ancho fijo y orden fijo, lo que no se adaptaba a las distintas formas en que cada tienda quiere visualizar su stock. Además, las acciones sobre items requerían abrir el panel lateral incluso para operaciones simples. Se implementó personalización completa de columnas y un menú contextual para acciones rápidas.

## What Changes

- **Columnas redimensionables**: drag handle en el borde derecho de cada header; `MIN_COL_WIDTH` respetado
- **Columnas reordenables**: drag del header mueve la columna; floating pill sigue el cursor, cursor oculto durante el drag, indicador vertical de drop
- **Columnas renombrables**: doble click en header → input inline; límite 30 chars
- **Headers planos**: sin gradiente ni borde inferior en columnas; indicador de edición con borde redondeado
- **Menú contextual (click derecho)**: en fila → opciones de acción individual (editar, eliminar, mover) y bulk (si hay selección)
- **Escape para deseleccionar**: `Escape` limpia la selección de filas
- **Indicador de batería rojo**: tercer tier de color (rojo) para batería < 70%
- Cursor management movido a `useEffect` para evitar cursor invisible pegado en hover

## Capabilities

### New Capabilities

- `inventory-column-customization`: Columnas redimensionables, reordenables y renombrables
- `inventory-context-menu`: Menú contextual en filas (click derecho) con acciones individuales y bulk

### Modified Capabilities

- `inventory-table`: Headers planos, indicadores de edición, Escape deselect, batería roja < 70%

## Impact

- **src/pages/Inventory.tsx**: estado de widths, orden de columnas, nombres custom; handlers pointer events para resize y reorder; menú contextual; listener Escape
- **src/services/inventory-api.ts**: `renameColumnApi`; persistencia de orden y widths (localStorage o backend según implementación)
- Sin cambios de backend para resize/reorder (client-side); sí para renombrar columnas custom

## Non-goals

- No se persiste el layout de columnas en el backend (localStorage)
- No se pueden agregar/quitar columnas del sistema (solo las custom)
- El menú contextual no soporta teclado (solo mouse)
