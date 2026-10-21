## Why
Reportes mezcla presupuestos con cobros, compara conteos con colores valorativos y oculta errores como períodos vacíos. Los períodos y el alcance del CSV necesitan ser explícitos.

## What Changes
- Períodos exclusivos de Reportes, 90 días exactos, Este mes y comparación del mismo número de días.
- Variaciones tipadas, resúmenes de Stock y Servicio, resultado financiero solo en Ventas para propietario.
- Comisiones por mes calendario, filtros consistentes con CSV y ajustes con signo.
- Disponibilidad por módulo sin debilitar las protecciones de concurrencia.

## Capabilities
### New Capabilities
- `report-metric-semantics`: significado, disponibilidad y variación de indicadores.
### Modified Capabilities
- `desk-report-period`: presets, límites, buckets y exportación consistente.

## Impact
Frontend de Reportes y metadatos de carga en store-records/AppContext. Servicios y cálculos financieros existentes. Sin cambios de Prisma ni endpoints.

## Non-goals
Dashboard, banner de instalación, Más, navegación inferior, SalesScreen, cálculos financieros compartidos, revaluación histórica, despliegues y operaciones git.
