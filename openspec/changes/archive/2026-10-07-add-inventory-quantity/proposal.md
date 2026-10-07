## Why

El issue #82 pide una columna Cantidad en Inventario. El usuario confirmó que debe ser editable por fila e inicialmente 1; actualmente el modelo no guarda ese dato.

## What Changes

- Guardar `quantity` como entero positivo con default 1 en cada equipo.
- Mostrar Cantidad en la tabla y el detalle hi-fi, y permitir cargarla/editarla en el formulario de equipo.
- Incluirla en las respuestas completas/paginadas y en la importación de inventario, preservando el valor al actualizar otros campos.
- Mantener compatible el alta de clientes API que omiten la cantidad.

## Capabilities

### New Capabilities

- `inventory-quantity`: cantidad persistida y editable por ítem.

### Modified Capabilities

Ninguna.

## Impact

Módulo Inventory: Prisma, rutas/servicio backend, tipos/importación frontend y pantallas hi-fi. Schema Prisma: `InventoryItem.quantity Int @default(1)`. Sin nuevas dependencias.

## Non-goals

Agrupar equipos, implementar operaciones de ventas por unidades o resolver los flujos del issue #89.
