## Why

La pantalla de Reportes sigue mostrando métricas y gráficos falsos, lo que rompe la confianza durante testing y no permite usar el módulo para operación real. Necesitamos que el usuario vea información agregada desde PostgreSQL con el mismo contexto de tienda que usa el resto de los módulos productivos.

## What Changes

- Reemplazar la página `Reports` mockeada por una vista conectada al backend.
- Agregar un endpoint autenticado que devuelva métricas agregadas del store para un rango de fechas.
- Mostrar KPIs, evolución de ventas, modelos más vendidos, origen de ingresos y snapshots operativos usando datos reales.
- Mantener estados honestos de loading, vacío y error; sin fallback silencioso a datos demo.
- Permitir exportar el resumen visible desde el frontend.

## Non-goals

- No convertir Dashboard en tiempo real ni tocar su pantalla demo.
- No agregar persistencia nueva ni cambios de schema Prisma.
- No modificar `AppContext.tsx` para sostener reportes globales si el consumo puede quedar encapsulado en la página.

## Capabilities

### New Capabilities
- `dynamic-reports`: reportes agregados por tienda con filtros de rango y visualización basada en datos reales del backend.

### Modified Capabilities
- `backend-api`: el backend expone un nuevo módulo autenticado para reportes agregados del store.

## Impact

- Frontend: `src/pages/Reports.tsx`, nuevo service HTTP y tipos del módulo.
- Backend: nuevo módulo Fastify bajo `/api/reports` y registro en `backend/src/app.ts`.
- APIs: nuevo endpoint `GET /api/reports/overview`.
- Dependencias: sin librerías nuevas; se reutilizan Prisma, Recharts y `fetch-with-timeout`.
