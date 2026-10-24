## Why
Dashboard conserva su última instantánea al fallar una consulta. Si el fallo ocurre después de aplicar otro período, el selector cambia y las cifras anteriores siguen visibles sin advertir que pertenecen a otro rango. Reproducido localmente con un HTTP 500 simulado al pasar de 7 días a Hoy.

## What Changes
- Mostrar un error accesible y Reintentar cuando falla un cambio de período con datos anteriores visibles.
- Conservar la instantánea completa y el comportamiento de revalidaciones automáticas.
- Cubrir recuperación y descarte de errores de solicitudes obsoletas.

## Capabilities
### New Capabilities
- `dashboard-period-recovery`: recuperación explícita de un cambio de período fallido.

## Impact
Solo DashboardContent y sus tests. Sin cambios de Prisma, backend, AppContext ni componentes compartidos.

## Non-goals
Rediseño, persistencia nueva de filtros, gráfico compartido, ventas y navegación.
