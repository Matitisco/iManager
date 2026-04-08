## Overview

La página `TradeIns.tsx` conservará sus KPIs y cards de canjes recientes, pero el bloque de historial migrará a `TableEngine`. El engine consumirá un adapter nuevo en `src/services/trade-ins-table-api.ts` que obtiene todos los canjes desde el backend, cachea por usuario y aplica paginado, filtros y ordenamiento en frontend, siguiendo el mismo patrón usado hoy en Clients y Sales.

## Architecture

### Data flow

1. `TableEngine` invoca `fetchTradeInsPage(user, params)`.
2. El adapter consulta `fetchBackendTradeIns(user)` y cachea el resultado por `uid`.
3. El adapter aplica filtros (`date`, `clientId`, `deviceReceived`, `status`) y ordenamiento local.
4. La página pasa `addTradeIn`, `updateTradeIn` y `deleteTradeIn` desde `AppContext` como mutaciones del engine.
5. Después de cada mutación, se invalida la cache del adapter para que las próximas lecturas reflejen el estado real del backend.

### Trade-ins page

- Mantener la fila de KPI sin cambios funcionales.
- Mantener los cards superiores de “Canjes recientes”.
- Reemplazar la tabla HTML manual, el dropdown de filtros y el panel custom por:
  - `TableEngine`
  - `TableEngineConfig<TradeIn>`
  - `editPanelFields` compartidos para editar cliente, equipos, valores y estado

### Column strategy

- Mostrar columnas separadas para fecha, cliente, equipo recibido, IMEI, valor de toma, equipo entregado, diferencia, estado, batería y grado.
- Usar badge metadata para todos los estados de Canjes.
- Resolver `clientId` a nombre/DNI con render personalizado para no exponer ids crudos.

## Decisions

- Las mutaciones seguirán pasando por `AppContext` para mantener sincronizados KPIs y cards superiores sin introducir un segundo source of truth.
- `batteryHealth` se trata como `text` en el engine y en el panel de edición para respetar que el tipo real del proyecto es `string`.
- No se agrega import ni categorías porque el alcance actual es sólo unificar el historial con el motor tabular.

## Risks

- Si el adapter cachea datos stale después de crear/editar/eliminar, el historial podría divergir del estado visible en KPIs. Se mitiga invalidando cache tras cada mutación.
- `clientId` necesita render de lookup; si el cliente ya no existe, la UI debe mostrar un fallback legible en vez de romper la fila.

## Validation

- `npm run lint` en la raíz del frontend
- Verificación manual de filtros y edición inline/panel en la sección de Canjes
