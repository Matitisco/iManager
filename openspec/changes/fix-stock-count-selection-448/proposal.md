## Why

Issue #448: consultar un control cerrado en Inventory preselecciona todos los faltantes y sobrantes. Las acciones actuales pueden modificar ambos grupos sin revisión ni confirmación, incluso al cerrar sin escaneos.

## What Changes

- Selección explícita, vacía al abrir/reabrir y cambiar de grupo.
- Una acción por grupo, con cantidad y consecuencia; confirmación con equipos, IMEI y motivo Faltante para archivo.
- Limitaciones del resultado y excluidos sin IMEI visibles por separado.
- Permisos, conteo a ciegas, clasificación, auditoría y resolución existentes conservados.

## Non-goals

Sin cambios en backend, AppContext, API, schema Prisma, reglas de archivo ni inferencias de pérdidas/completitud física. Sin operaciones productivas, build, commits ni push.

## Impact

StockCountScreen, estilos acotados, regresiones frontend y documentación. Validación con suites frontend/backend, integración PostgreSQL local y TypeScript.
