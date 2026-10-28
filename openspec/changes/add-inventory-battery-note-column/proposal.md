## Why
Inventory ya guarda `batteryNote`, pero Stock > Equipos no permite consultar ese detalle desde el listado.

## What Changes
- Agregar «Detalle batería» inmediatamente después de Batería en desktop.
- Mostrar la misma información debajo de la batería en las tarjetas móviles.
- Truncar con elipsis, conservar el texto completo en `title` y mostrar «—» cuando está vacío.

## Capabilities
- Extiende la presentación de Inventory en `inventory-column-customization`.

## Impact
Solo frontend y estilos de Inventario; sin cambios de Prisma, API ni AppContext.

## Non-goals
Agregar un selector de columnas o redimensionado donde no existen, modificar filtros o editar notas desde el listado.
