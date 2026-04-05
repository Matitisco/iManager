## Why

La tabla de inventario original mostraba todos los items en una lista plana sin paginación, sin orden, sin selección masiva y sin indicadores de estado de venta. Con inventarios de más de 20 productos la UX se degradaba notablemente.

## What Changes

- **Paginación**: 20 items por página con botones numerados y elipsis
- **Ordenar**: dropdown con opciones Modelo, Precio, Batería, Condición
- **Bulk select**: checkboxes por fila, `Shift+click` para rango, header checkbox selecciona todos en página
- **Bulk delete**: confirmación modal antes de eliminar la selección
- **Split columnas**: `capacityColor` separado en columnas independientes `Capacidad` y `Color`
- **Estado de venta**: columna que muestra Disponible / Vendido + fecha de venta
- **Click en fila**: abre modal de edición del producto

## Capabilities

### New Capabilities

- `inventory-pagination`: Paginación del lado cliente (20 items/página, botones con elipsis)
- `inventory-bulk-actions`: Selección masiva con checkboxes + Shift+click, acciones sobre la selección

### Modified Capabilities

- `inventory-table`: Nuevas columnas (Capacidad, Color, Estado), ordenamiento, click-to-edit

## Impact

- **src/pages/Inventory.tsx**: lógica de paginación, ordenamiento, selección, estado de venta
- **src/components/ConfirmModal.tsx**: reutilizado para bulk delete y delete individual
- **backend/src/modules/inventory/**: ningún cambio de API (paginación y ordenamiento son client-side)

## Non-goals

- La paginación es client-side; no se implementó paginación server-side
- El ordenamiento no persiste entre sesiones
- No se implementó ordenamiento por columnas custom
