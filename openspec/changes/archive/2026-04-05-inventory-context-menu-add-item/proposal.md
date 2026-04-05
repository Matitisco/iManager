## Why

El flujo actual para agregar items al inventario requiere abrir un modal y navegar fuera del contexto de la tabla. En tiendas con alta rotación de stock, los operarios necesitan agregar múltiples items consecutivos con mínima fricción. Extender el menú contextual (clic derecho) con una opción "Agregar ítem" que abre una fila inline vacía directamente en la tabla reduce el tiempo de carga de inventario considerablemente.

## What Changes

- El menú contextual de la tabla de inventario incluye una nueva opción **"Agregar ítem"**
- Al seleccionarla, se inserta una fila inline vacía debajo del item sobre el que se hizo clic derecho (o al final si no hay fila activa)
- El usuario llena los campos directamente en la fila: nombre, categoría, precio, stock, etc.
- Al presionar Enter o Tab en el último campo, el item se persiste en base de datos via API
- Al presionar Escape, la fila inline se descarta sin guardar
- Las opciones existentes del menú contextual (Editar, Eliminar, Mover a categoría, bulk actions) se mantienen sin cambios
- No se abre ningún modal — todo el flujo es inline dentro de la tabla

## Capabilities

### New Capabilities
- `inventory-context-menu-add-item`: Fila inline de alta rápida insertable desde el menú contextual de la tabla de inventario, con persistencia directa a la API

### Modified Capabilities
- `inventory-context-menu`: Agregar la opción "Agregar ítem" al menú contextual existente — nuevo ítem en el menú, sin modificar los existentes
- `inventory-inline-edit`: El mecanismo de edición inline existente se reutiliza/extiende para soportar filas nuevas (vacías) además de edición de filas existentes

## Impact

- **Frontend**: `src/pages/Inventory.tsx` o el componente de tabla de inventario — agregar lógica de fila inline vacía; `ContextMenu` component — agregar opción
- **Backend**: `backend/src/modules/inventory/` — ya existe endpoint `POST /api/inventory` para crear items; no se requieren cambios de schema
- **AppContext**: agregar acción de creación inline que llame al service existente (`inventory-api.ts`)
- Sin cambios de schema Prisma

## Non-goals

- No se modifican los campos disponibles del formulario de creación (se usan los mismos que el modal actual)
- No se implementa validación en tiempo real campo por campo (solo al submit)
- No se agrega persistencia automática por timeout (solo Enter/Tab confirma)
- No se cambia el modal existente de "Agregar ítem" — ambos coexisten
