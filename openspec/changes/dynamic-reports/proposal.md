## Why

La primera iteracion de `dynamic-reports` resolvio el problema de los datos mockeados, pero la pantalla sigue siendo un overview fijo. Para operacion real necesitamos que cada tienda pueda trabajar con un layout mas flexible, un rango manual de fechas y widgets enfocados en preguntas concretas del negocio.

## What Changes

- Extender `GET /api/reports/overview` para soportar `rangeKey=custom` con validacion de fechas.
- Enriquecer el payload con `inventory.valuation` y `topProducts`.
- Reemplazar la pantalla fija por una pagina de widgets configurables, con presets, rango custom y persistencia local por navegador.
- Exportar solo los widgets visibles del layout actual.
- Mantener la pantalla autocontenida, sin mover reportes a `AppContext`.

## Non-goals

- No agregar persistencia server-side del layout en esta iteracion.
- No cambiar schema Prisma ni agregar tablas nuevas.
- No convertir Dashboard en una capa reutilizable de analytics.

## Capabilities

### Modified Capabilities
- `dynamic-reports`: la pantalla de reportes pasa de overview fijo a layout configurable por widgets con filtros custom.
- `backend-api`: el endpoint de reportes admite rangos custom y devuelve informacion adicional de inventario y top productos.

## Impact

- Frontend: `src/pages/Reports.tsx`, `src/types/reports.ts`, `src/utils/reports.ts`.
- Backend: `backend/src/modules/reports/reports.routes.ts`, `backend/src/modules/reports/reports.service.ts`.
- Tests: nuevos tests para validacion de rango, agregacion de top productos y persistencia/export local.
