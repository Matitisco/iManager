## Why

La sección de Ventas todavía usa una tabla artesanal separada del template reusable de `TableEngine`, así que no hereda el mismo contrato de interacción que ya validamos en Inventario. Eso duplica mantenimiento y deja a Ventas con una UX menos consistente justo cuando el engine ya está maduro.

## What Changes

- Refactorizar `src/pages/Sales.tsx` para renderizar la grilla de ventas sobre `TableEngine` en lugar de una tabla ad hoc.
- Extraer un contrato específico de Ventas para el engine con columnas, renderers, acciones de fila y bulk actions.
- Preservar en Ventas las capacidades que hoy tiene Inventario a nivel de tabla: selección, sort, paginación, edición inline, menú contextual, persistencia de preferencias de columnas y export del view activo.
- Mantener los filtros y el panel de edición de ventas como workflows de página, encima del engine reusable.
- Evitar que el refactor toque backend, Prisma o el modelo de datos de ventas.

## Capabilities

### New Capabilities
- `sales-table-engine`: contrato reutilizable para la tabla de Ventas basada en `TableEngine`, con columnas configurables, edición inline, acciones de fila y bulk actions, export y persistencia de preferencias de columnas.

### Modified Capabilities
- `backend-api`: ninguna.
- `postgres-data-layer`: ninguna.
- `inventory`: ninguna.

## Impact

- Frontend: `src/pages/Sales.tsx`, `src/components/TableEngine/*` si hace falta una mejora menor de contrato, y nuevos helpers de dominio para ventas.
- Tests: nuevas pruebas unitarias para los helpers de la tabla de Ventas y para el contrato exportable.
- OpenSpec: nuevo change con spec, design y tasks propios para auditar la migración.

## Non-goals

- Migrar el backend de Sales ni cambiar Prisma.
- Agregar workflows de categorías o drag-and-drop de Inventario a Ventas.
- Reescribir el motor genérico de tablas desde cero.
- Cambiar la semántica transaccional de `addSale`, `updateSale` o `deleteSale`.
