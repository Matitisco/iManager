# Reclamos: selector de ventas y devolución parcial

Validación del 02/11/2026 en `fix/reclamo-ventas-vacias`, base `origin/test`. Sin acceso a BD ni servicios de producción, sin build ni cambios en main.

## Causa reproducida

`ReturnForm` filtraba `sale.status === 'COMPLETADA'`; `createReturnCase` repetía la exigencia de estar cobrada. Una venta entregada con cuenta corriente puede seguir `PENDIENTE`. El endpoint admin `sale-corrections`, cuando aumenta el total sin cobrar la diferencia, deja precisamente ese estado y un `openBalance`. La regresión usa el endpoint real: 5 unidades a USD 405 pasan a USD 2.025 con USD 1.620 de deuda; antes no permitían reclamo, ahora se reclama una unidad con tope USD 81 y se conserva la deuda.

Además, el formulario dependía exclusivamente del array global `sales`, sin carga propia ni errores visibles. La carga global publica ventas después de esperar también inventario, clientes y canjes. Una lectura pendiente/fallida podía presentarse como selector vacío y producir el mensaje de validación «Elegí una venta cobrada».

Sin consultar producción no se afirma qué estado tienen las filas reales. Se reproduce el mecanismo de exclusión con el flujo administrativo existente y datos ficticios.

| Variante | Resultado |
| --- | --- |
| COMPLETADA, USD/ARS, cualquier fecha, cantidad 1 o mayor | Elegible sin exigir tender/pago explícito |
| PENDIENTE, cuenta corriente, corrección admin | Reclamo permitido sin cobrar ni modificar deuda |
| Importación real sin cliente ni método de pago | Reclamo permitido; compensación sigue exigiendo cliente |
| OWNER y STAFF con Ventas, sin acceso sensible | Pueden listar/abrir; STAFF no puede emitir compensación |
| Sin Ventas, otra tienda, anulada/cancelada | Se mantienen 403/404/rechazo de estado |
| Más de 20/125 ventas, filtros y carga global fallida | Selector completo e independiente de páginas y listas globales |

## Cambio

- `GET /api/returns/eligible-sales` consulta ventas activas de la tienda con el permiso de Ventas y descuenta unidades ya reclamadas.
- Formulario compartido desktop/mobile con carga, error, reintento y cantidad. Conserva borradores y no cierra ante errores al guardar.
- `ReturnCase.cantidad` nullable: los reclamos históricos sin cantidad conservan el alcance de toda la venta. Los nuevos se validan en transacción Serializable con el lock existente por tienda.
- Reintegros/notas tienen tope proporcional a unidades y cobro explícito, más el límite acumulado de la venta. Una pendiente sin saldo explícito tiene reintegrable cero.
- Las unidades de lotes retornan a un registro independiente, también en RMA, preservando el stock y estado del lote restante. Anular un reclamo con efectos no libera esas unidades/importes. Se bloquea anular/cambiar el equipo de una venta con devoluciones físicas/financieras resueltas para no duplicar efectos.
- Prisma agrega únicamente una columna nullable; el despliegue habitual aplica `db push`, sin backfill inferido.

## Evidencia rojo → verde

Antes del cambio, `return-sales.test.tsx`: 4 fallos (no consultaba ventas, no bloqueaba submit durante carga, no ofrecía reintento). `return-sales.integration.test.ts`: 3 fallos (endpoint inexistente, cantidad ignorada y sin límites); las dos variantes pendientes fallaron después por la exclusión de estado. Con el cambio, las mismas regresiones pasan.

Las integraciones usan PostgreSQL exclusivo de esta tarea en `127.0.0.1:5545/imanager_reclamo_test`. Playwright usa otra BD, `imanager_reclamo_e2e`, para evitar interferencia con las integraciones. Todos los datos son ficticios. Playwright recorre 1440×900 y 390×844, provoca fallo de la lista global y de la consulta del selector, reintenta, elige una venta pendiente USD de tres unidades, abre el reclamo por una y verifica persistencia tras recargar, dos unidades restantes y stock original sin cambios.

Verificación: TypeScript frontend/backend; tests relacionados frontend; 113 unitarias backend; 64 integraciones backend (devoluciones, cantidades, correcciones admin, importación, permisos y restauración de ventas); 2 recorridos Playwright aprobados.

Validación complementaria: la matriz `returns-eligibility.integration.test.ts` prueba ambos valores de `collectDifference` mediante el endpoint administrativo real. Contra `866ff3b`, las regresiones de interfaz fallan en las dos resoluciones (venta pendiente ausente); las de API fallan por el rechazo de pendientes y por cantidad ignorada. Con el fix pasan. La ejecución complementaria usa exclusivamente `127.0.0.1:55439/imanager_returns_test`; 1.021 unitarias backend y 72 integraciones relacionadas aprobadas antes de sincronizar la base.

Compatibilidad con `test` actualizado a `992a06a`: conservar `itemCost` unitario junto con `saleQuantity`, porque el consumidor de margen ya multiplica por las unidades vendidas. El test de devolución parcial verifica costo unitario USD 800 y cantidad vendida 5 para evitar duplicar el costo en el merge.


Verificación posterior al merge de `test`: TypeScript frontend/backend sin errores; 196 pruebas frontend relacionadas en 11 archivos y otras 56 en tres archivos revalidados; 1.021 unitarias backend; 119 integraciones en 12 archivos; 2 recorridos Playwright (390/1440) aprobados. Los archivos que fallaron por timeouts, worker sin recursos o mezcla de código antes/después del merge en la ejecución amplia se volvieron a ejecutar sobre el estado integrado con un worker y pasaron. No se modificaron los timeouts del repositorio.

Entrega: [PR #711 contra test](https://github.com/Matitisco/iManager/pull/711), sin merge.
