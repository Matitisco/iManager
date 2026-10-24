## Context
Pruebas UI en Chromium con DB falsa imanager_importqa y puertos 3490/4490. La UI ofrece equipos, clientes y ventas. El CSV actual separa por cada coma incluso dentro de comillas. El catálogo de inventario omite currency. Ventas crea una operación nueva en cada reintento.

## Goals / Non-Goals
Corregir corrupción de columnas, moneda y repetición de ventas. Mantener el diseño actual, los permisos, los costos y los enlaces de stock. No modificar Patrones/Fallas ni migraciones.

## Decisions
Usar un lector CSV con estado de comillas y detección de delimitador en el encabezado. Agregar moneda al catálogo/mapeo de inventario y resolverla antes de interpretar el precio. Guardar una huella de la fila normalizada en customFields de ventas, comprobada dentro de la transacción serializable con bloqueo por tienda/huella. Las filas repetidas muestran error y no alteran otras tablas.

## Risks / Trade-offs
Una venta idéntica sin identificador externo en el mismo día se considera repetida. Las ventas históricas anteriores a esta corrección carecen de huella; no se reescriben. Las importaciones de stock sin IMEI pueden representar varias unidades legítimas y no se fusionan por modelo/precio.

## Validation
Pruebas unitarias de CSV, monedas y servicio de ventas; TypeScript frontend/backend. QA UI real con archivos limpios de 50 filas, desordenados, ajenos y Stock iPhone Mendoza, a 1440 y 390.
