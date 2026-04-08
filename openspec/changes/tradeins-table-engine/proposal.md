## Why

La sección de Canjes todavía usa una tabla manual con filtros locales y un panel de edición propio, mientras Inventory, Clients y Sales ya operan sobre `TableEngine`. Esto deja una experiencia inconsistente, duplica lógica de tabla y hace más difícil mantener filtros, selección, edición y acciones masivas en el módulo.

## What Changes

- Reemplazar el bloque manual de historial de canjes por `TableEngine`.
- Agregar un adapter de datos para Canjes que traduzca el CRUD existente a `fetchPage` y `fetchFilteredIds`.
- Mantener los KPI y cards superiores de la pantalla, pero mover filtros, ordenamiento, edición y delete del historial al engine.
- Reutilizar `AppContext` para las mutaciones de Canjes, de modo que la pantalla siga sincronizada con el resto del core.

## Non-goals

- No cambiar el schema de Prisma ni el backend de `trade-ins`.
- No rediseñar los KPI o la sección superior de canjes.
- No agregar import XLSX ni categorías a Canjes en este cambio.

## Capabilities

### New Capabilities
- `tradeins-table-engine`: El historial de canjes usa el mismo motor tabular que Inventory, Clients y Sales, con filtros, ordenamiento, edición y eliminación sobre datos reales.

### Modified Capabilities

## Impact

- Frontend módulo Trade-ins: `src/pages/TradeIns.tsx`
- Nuevo servicio frontend: `src/services/trade-ins-table-api.ts`
- Documentación OpenSpec para el cambio: `openspec/changes/tradeins-table-engine/`
- Sin cambios de API, schema Prisma o migraciones
