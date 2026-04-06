## Why

Los usuarios del POS necesitan exportar el inventario para reportes externos, auditorías y análisis en Excel. Hoy solo pueden ver los datos en pantalla sin forma de extraerlos, lo que obliga a copiar manualmente o hacer capturas.

## What Changes

- Nuevo botón "Exportar" en el toolbar del módulo Inventory
- Descarga el inventario visible (filtrado + ordenado) como `.xlsx`
- Respeta las columnas activas (toggle de visibilidad) — solo exporta las columnas visibles
- Nombre de archivo automático: `inventory_YYYY-MM-DD.xlsx`
- Exportación 100% client-side (sin llamada al backend)

## Non-goals

- No exporta a PDF
- No hay exportación programada o por email
- No exporta ítems fuera de la página actual (exporta todos los filtrados, no paginados)
- CSV como formato opcional secundario (nice-to-have, no bloqueante)

## Capabilities

### New Capabilities

- `inventory-export`: Botón de exportación en el toolbar que descarga los datos de inventario visibles (filtrados + columnas activas) como archivo `.xlsx`.

### Modified Capabilities

- `inventory-column-customization`: El estado de visibilidad de columnas debe ser consumible por el módulo de exportación (actualmente ya existe como estado interno; se formaliza como contrato observable).

## Impact

- **Frontend**: `src/pages/Inventory.tsx` — nuevo botón en toolbar, lógica de exportación
- **Dependencia nueva**: librería `xlsx` (SheetJS) para generación de `.xlsx` client-side
- **Sin cambios en backend** — los datos ya están cargados en el frontend
- **Sin cambios en Prisma/schema**
